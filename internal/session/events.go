package session

import (
	"cmp"
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/guilhermt/myspec/internal/claude"
)

// askUserQuestionTool is the tool whose permission request is a structured
// question rather than an action.
const askUserQuestionTool = "AskUserQuestion"

// abortedReason is the terminal reason of a turn the interrupt ended.
const abortedReason = "aborted_streaming"

// ansiEscape matches the terminal colours the CLI may put in a decision reason.
var ansiEscape = regexp.MustCompile(`\x1b\[[0-9;?]*[ -/]*[@-~]`)

// consume feeds the events of one process into the run and reports its exit.
// It runs on its own goroutine, one per process.
func (s *Service) consume(k Key, gen int, p Process) {
	for ev := range p.Events() {
		s.handle(k, gen, ev)
	}
	s.processExited(k, gen, p.Wait())
}

// handle applies one event to the run. Events of a process that is no longer
// the current one are dropped.
func (s *Service) handle(k Key, gen int, ev claude.Event) {
	ctx, cancel := bgCtx()
	defer cancel()
	n := &notes{}
	defer s.flush(n)
	s.mu.Lock()
	defer s.mu.Unlock()

	r := s.runs[k]
	if r == nil || r.procGen != gen {
		return
	}
	r.eventSeen = true
	r.stopTimer(&r.startTimer)
	if r.idleTimer != nil {
		r.idleTimer.Reset(s.idleTimeout)
	}

	if r.turn == nil && !r.stopping && opensTurn(ev) {
		s.openAgentTurnLocked(ctx, r, n)
	}

	switch ev.Type {
	case "system":
		s.handleSystem(ctx, r, ev, n)
	case "stream_event":
		if ev.Stream.ParentToolUseID != nil && *ev.Stream.ParentToolUseID != "" {
			return // a subagent's stream; its assistant events carry what is kept
		}
		s.handleStream(ctx, r, ev.Stream, n)
	case "assistant":
		s.noteMonitors(r, ev.Assistant)
		if parent := deref(ev.Assistant.ParentToolUseID); parent != "" {
			s.handleSubagentAssistant(ctx, r, parent, ev.Assistant, n)
		} else {
			s.handleAssistant(ctx, r, ev.Assistant, n)
		}
	case "user":
		if parent := deref(ev.User.ParentToolUseID); parent != "" {
			s.handleSubagentUser(ctx, r, parent, ev.User, n)
		} else {
			s.handleUser(ctx, r, ev.User, n)
		}
	case "control_request":
		s.handleControlRequest(ctx, r, ev.ControlRequest, n)
	case "control_response":
		s.handleControlResponse(ctx, r, ev.ControlResponse, n)
	case "result":
		s.handleResult(ctx, r, ev.Result, n)
	default:
		s.log.Debug("claude event ignored", "task", r.task.ID, "type", ev.Type, "subtype", ev.Subtype)
	}
}

// opensTurn reports whether an event is work only a turn does: a request to
// the API, a retry or a compaction of it, or a message or a tool result of the
// main thread. Init is not one: the CLI also opens the empty turns it runs on
// its own with it.
func opensTurn(ev claude.Event) bool {
	switch ev.Type {
	case "system":
		switch ev.Subtype {
		case "status":
			return ev.Status != nil && ev.Status.Status == "requesting"
		case "api_retry", "compact_boundary":
			return true
		}
	case "stream_event":
		return ev.Stream != nil && deref(ev.Stream.ParentToolUseID) == ""
	case "assistant":
		return ev.Assistant != nil && deref(ev.Assistant.ParentToolUseID) == ""
	case "user":
		return ev.User != nil && deref(ev.User.ParentToolUseID) == ""
	}
	return false
}

// handleSystem applies a system event.
func (s *Service) handleSystem(ctx context.Context, r *run, ev claude.Event, n *notes) {
	switch ev.Subtype {
	case "init":
		if !r.rec.Started {
			r.rec.Started = true
			_ = s.persistRecord(ctx, r)
		}
		s.log.Info("claude session ready",
			"task", r.task.ID,
			"version", ev.Init.ClaudeCodeVersion,
			"model", ev.Init.Model,
			"capabilities", ev.Init.Capabilities,
		)
		if !slices.Contains(ev.Init.Capabilities, interruptReceiptCapability) {
			s.log.Warn("claude capability missing", "task", r.task.ID, "capability", interruptReceiptCapability)
		}
	case "status":
		// Progress the interface does not show.
	case "api_retry":
		r.retryAttempt = ev.APIRetry.Attempt
		r.retryMax = ev.APIRetry.MaxRetries
		r.retryAt = s.now().UTC().Add(time.Duration(ev.APIRetry.RetryDelayMS) * time.Millisecond)
		r.retryReason = retryReasonOf(ev.APIRetry.Error)
		n.state(r.key())
	case "compact_boundary":
		pre := ev.CompactBoundary.CompactMetadata.PreTokens
		percent := 0
		if r.rec.ContextWindow > 0 {
			percent = pre * 100 / r.rec.ContextWindow
		}
		s.appendLocked(ctx, r, Entry{Kind: KindMarker, Marker: &MarkerEntry{
			Type:      MarkerCompacted,
			PreTokens: pre,
			Percent:   percent,
		}}, n)
		s.askContextLocked(r)
	case "task_started":
		s.handleTaskStarted(ctx, r, ev.TaskStarted, n)
	case "task_updated":
		s.handleTaskUpdated(ctx, r, ev.TaskUpdated, n)
	case "task_notification":
		s.handleTaskNotification(ctx, r, ev.TaskNotification, n)
	case "background_tasks_changed":
		s.handleBackgroundTasks(ctx, r, ev.BackgroundTasks, n)
	default:
		s.log.Debug("claude event ignored", "task", r.task.ID, "type", ev.Type, "subtype", ev.Subtype)
	}
}

// monitorTool is the tool whose task is a monitor, though the CLI types it as
// a command.
const monitorTool = "Monitor"

// monitorDefaultTimeout is how long a monitor runs when its call names no
// deadline, the CLI's own default.
const monitorDefaultTimeout = 5 * time.Minute

// noteMonitors keeps what each Monitor call of a message asked for, for the
// task it starts.
func (s *Service) noteMonitors(r *run, ev *claude.AssistantEvent) {
	for _, block := range ev.Message.Content {
		if block.Type != "tool_use" || block.Name != monitorTool {
			continue
		}
		var input struct {
			TimeoutMS  int  `json:"timeout_ms"`
			Persistent bool `json:"persistent"`
		}
		_ = json.Unmarshal(block.Input, &input) // a call that does not decode is a monitor with the default deadline
		call := monitorCall{timeout: monitorDefaultTimeout, persistent: input.Persistent}
		if input.TimeoutMS > 0 {
			call.timeout = time.Duration(input.TimeoutMS) * time.Millisecond
		}
		r.monitors[block.ID] = call
	}
}

// handleTaskStarted keeps a task the CLI runs for a tool call, with what the
// conversation calls it and what it counts as. A task of a type the
// conversation does not name is not kept.
func (s *Service) handleTaskStarted(ctx context.Context, r *run, ev *claude.TaskStartedEvent, n *notes) {
	kind := taskKindOf(r, ev)
	if kind == "" {
		return
	}
	t := &cliTask{
		kind:         kind,
		name:         ev.Description,
		runID:        ev.RunID,
		backgrounded: ev.IsBackgrounded,
		toolUseID:    ev.ToolUseID,
		startedAt:    s.now().UTC(),
		entry:        r.actions[ev.ToolUseID],
	}
	if t.entry != nil {
		t.entry.Action.TaskID = ev.TaskID
		if ev.IsBackgrounded {
			t.entry.Action.Background = true
		}
		s.updateLocked(ctx, r, t.entry, n)
	}
	switch kind {
	case WakeCommand:
		s.armLimitLocked(r, ev.TaskID, t, s.commandLimit)
	case WakeMonitor:
		call, ok := r.monitors[ev.ToolUseID]
		if !ok {
			call = monitorCall{timeout: monitorDefaultTimeout}
		}
		delete(r.monitors, ev.ToolUseID)
		t.persistent = call.persistent
		if !call.persistent {
			s.armLimitLocked(r, ev.TaskID, t, call.timeout+s.monitorGrace)
		}
	default:
		// A subagent counts until it ends, with no limit.
	}
	r.tasks[ev.TaskID] = t
	s.settleWorkLocked(ctx, r, n)
}

// armLimitLocked ends what a task counts after d.
func (s *Service) armLimitLocked(r *run, id string, t *cliTask, d time.Duration) {
	key, gen := r.key(), r.procGen
	t.limit = time.AfterFunc(d, func() { s.limitReached(key, gen, id, t) })
}

// limitReached stops counting a task that ran past its limit: it goes on
// running, but it is not the session's work any more.
func (s *Service) limitReached(k Key, gen int, id string, t *cliTask) {
	ctx, cancel := bgCtx()
	defer cancel()
	n := &notes{}
	defer s.flush(n)
	s.mu.Lock()
	defer s.mu.Unlock()

	r := s.runs[k]
	if r == nil || r.procGen != gen || r.tasks[id] != t {
		return
	}
	t.limit = nil
	t.pastLimit = true
	s.settleWorkLocked(ctx, r, n)
}

// taskKindOf is what the conversation calls a task: a monitor when the call
// that started it was the Monitor tool, whose task type is a command's too.
func taskKindOf(r *run, ev *claude.TaskStartedEvent) WakeKind {
	if _, ok := r.monitors[ev.ToolUseID]; ok {
		return WakeMonitor
	}
	if r.turn != nil {
		if e := r.turn.actions[ev.ToolUseID]; e != nil && e.Action.Tool == monitorTool {
			return WakeMonitor
		}
	}
	switch ev.TaskType {
	case "local_bash":
		return WakeCommand
	case "local_agent":
		return WakeAgent
	}
	return ""
}

// handleTaskUpdated follows a task the CLI moved to the background, which
// counts from then on.
func (s *Service) handleTaskUpdated(ctx context.Context, r *run, ev *claude.TaskUpdatedEvent, n *notes) {
	t := r.tasks[ev.TaskID]
	if t == nil || ev.Patch.IsBackgrounded == nil {
		return
	}
	t.backgrounded = *ev.Patch.IsBackgrounded
	if t.backgrounded && t.entry != nil {
		t.entry.Action.Background = true
		s.updateLocked(ctx, r, t.entry, n)
	}
	s.settleWorkLocked(ctx, r, n)
}

// handleTaskNotification records the return of a task in the background: a
// woke marker where it arrives when a turn is in progress, the next turn's
// first line otherwise. A task in the foreground only ends.
func (s *Service) handleTaskNotification(ctx context.Context, r *run, ev *claude.TaskNotificationEvent, n *notes) {
	task := r.tasks[ev.TaskID]
	if task == nil {
		return
	}
	w, ok := wakeOf(task.kind, task.name, ev)
	if !ok {
		return
	}
	task.wake = &w
	r.stopTimer(&task.limit)
	// A call in the background ends with its task, also a subagent's, whose
	// task the CLI does not mark as backgrounded.
	if task.entry != nil && task.entry.Action.Background {
		s.endBackgroundActionLocked(ctx, r, task, ev, n)
	}
	switch {
	case !task.backgrounded:
		// The turn waited for it: its result is the tool's, not a return.
	case r.turn == nil:
		r.wakes = append(r.wakes, w)
		s.awaitReturnLocked(r)
	default:
		s.appendLocked(ctx, r, Entry{Kind: KindMarker, Marker: &MarkerEntry{Type: MarkerWoke, Wakes: []Wake{w}}}, n)
	}
	s.settleWorkLocked(ctx, r, n)
}

// endBackgroundActionLocked ends the action of a call in the background with
// the end of its task: how it ended, who stopped it and the output it left. The
// actions of a subagent that were still running end with it.
func (s *Service) endBackgroundActionLocked(ctx context.Context, r *run, t *cliTask, ev *claude.TaskNotificationEvent, n *notes) {
	a := t.entry.Action
	now := s.now().UTC()
	var by string
	var closing ActionStatus
	switch t.wake.Status {
	case WakeCompleted:
		a.Status, closing = ActionDone, ActionDone
		a.FinishedAt = &now
	case WakeFailed:
		a.Status, closing, by = ActionError, ActionInterrupted, interruptedByCrash
		a.FinishedAt = &now
		a.ExitCode = t.wake.ExitCode
	default:
		by = interruptedByAgent
		if t.stopReq != "" {
			by = interruptedByUser
		}
		a.Status, closing = ActionInterrupted, ActionInterrupted
		a.InterruptedBy = by
	}

	var o Output
	var ok bool
	if t.kind == WakeAgent {
		o, ok = outputFromText(s.subagentReportLocked(r, t, ev))
	} else {
		var err error
		o, ok, err = fileOutput(ev.OutputFile)
		if err != nil {
			s.log.Warn("background output unreadable",
				"task", r.task.ID, "stage", r.rec.Stage, "path", ev.OutputFile, "error", err)
		}
	}
	if ok {
		s.saveOutputLocked(ctx, r, t.entry, o)
	}

	if sub := r.subagents[t.toolUseID]; sub != nil {
		s.closeSubagentLocked(ctx, r, sub, closing, by, n)
	}
	s.updateLocked(ctx, r, t.entry, n)
}

// subagentReportLocked is the report of a subagent in the background: its last
// complete speech, or the summary of its notification when it said nothing.
func (s *Service) subagentReportLocked(r *run, t *cliTask, ev *claude.TaskNotificationEvent) string {
	for _, e := range slices.Backward(r.entries) {
		if e.Kind == KindAssistant && e.Assistant.Complete && e.Assistant.ParentToolUseID == t.toolUseID {
			return e.Assistant.Text
		}
	}
	return ev.Summary
}

// closeSubagentLocked brings the actions of a subagent that still run to rest,
// all with the given status, interrupted ones by the given party.
func (s *Service) closeSubagentLocked(ctx context.Context, r *run, sub *subagent, status ActionStatus, by string, n *notes) {
	for _, e := range bySeq(sub.actions) {
		if e.Action.Status != ActionRunning {
			continue
		}
		e.Action.Status = status
		if status == ActionInterrupted {
			e.Action.InterruptedBy = by
		}
		s.updateLocked(ctx, r, e, n)
	}
}

// loseBackgroundLocked records the work in the background that dies with the
// process: its actions end interrupted by the crash, its tasks end stopped so
// that no late notification treats them again, and one marker names them.
func (s *Service) loseBackgroundLocked(ctx context.Context, r *run, n *notes) {
	type lost struct {
		item      BackgroundItem
		entry     *Entry
		toolUseID string
		startedAt time.Time
	}
	var all []lost
	known := make(map[string]bool, len(r.tasks))
	for _, t := range r.tasks {
		known[t.toolUseID] = true
		if !t.live() || !t.backgrounded {
			continue
		}
		t.wake = &Wake{Kind: t.kind, Name: s.taskNameOf(t), Status: WakeStopped}
		all = append(all, lost{BackgroundItem{Kind: t.kind, Name: s.taskNameOf(t)}, t.entry, t.toolUseID, t.startedAt})
	}
	slices.SortStableFunc(all, func(a, b lost) int { return a.startedAt.Compare(b.startedAt) })
	// A launch whose task_started never came has no task.
	for _, e := range bySeq(r.actions) {
		if !e.Action.Background || e.Action.Status != ActionRunning || known[e.Action.ToolUseID] {
			continue
		}
		kind := kindOfAction(e.Action)
		name := e.Action.Description
		if name == "" {
			name = e.Action.Target
		}
		all = append(all, lost{BackgroundItem{Kind: kind, Name: name}, e, e.Action.ToolUseID, time.Time{}})
	}
	if len(all) == 0 {
		return
	}

	items := make([]BackgroundItem, 0, len(all))
	for _, l := range all {
		items = append(items, l.item)
		if l.entry != nil && l.entry.Action.Status == ActionRunning {
			l.entry.Action.Status = ActionInterrupted
			l.entry.Action.InterruptedBy = interruptedByCrash
			s.updateLocked(ctx, r, l.entry, n)
		}
		if sub := r.subagents[l.toolUseID]; sub != nil {
			s.closeSubagentLocked(ctx, r, sub, ActionInterrupted, interruptedByCrash, n)
		}
	}
	s.appendLocked(ctx, r, Entry{Kind: KindMarker, Marker: &MarkerEntry{
		Type:       MarkerBackgroundLost,
		Background: items,
	}}, n)
}

// kindOfAction is what a call in the background counts as in a marker.
func kindOfAction(a *ActionEntry) WakeKind {
	switch a.Tool {
	case "Agent", "Task":
		return WakeAgent
	case monitorTool:
		return WakeMonitor
	}
	return WakeCommand
}

// awaitReturnLocked holds the session at work until the CLI answers a return
// that came with no turn: a turn it opens, an empty turn, or nothing within
// ReturnTimeout.
func (s *Service) awaitReturnLocked(r *run) {
	r.returnDue = true
	r.stopTimer(&r.returnTimer)
	key, gen := r.key(), r.procGen
	r.returnTimer = time.AfterFunc(s.returnTimeout, func() { s.returnExpired(key, gen) })
}

// returnExpired gives up on a return the CLI did not answer.
func (s *Service) returnExpired(k Key, gen int) {
	ctx, cancel := bgCtx()
	defer cancel()
	n := &notes{}
	defer s.flush(n)
	s.mu.Lock()
	defer s.mu.Unlock()

	r := s.runs[k]
	if r == nil || r.procGen != gen || !r.returnDue {
		return
	}
	r.returnTimer = nil
	r.returnDue = false
	s.log.Warn("claude return unanswered", "task", k.TaskID, "stage", k.Stage)
	s.settleWorkLocked(ctx, r, n)
}

// handleBackgroundTasks stops counting the tasks the CLI no longer lists among
// the ones it runs in the background, so that a lost task_notification never
// holds the session at work. A task that counted and leaves the list with no
// turn open is a return the CLI may still answer, often after its
// task_notification: the session waits for it as for any return.
func (s *Service) handleBackgroundTasks(ctx context.Context, r *run, ev *claude.BackgroundTasksEvent, n *notes) {
	live := make(map[string]bool, len(ev.Tasks))
	for _, t := range ev.Tasks {
		live[t.TaskID] = true
	}
	left := false
	for id, t := range r.tasks {
		if t.backgrounded && !live[id] {
			left = left || t.counts()
			t.gone = true
		}
	}
	if left && r.turn == nil {
		s.awaitReturnLocked(r)
	}
	s.settleWorkLocked(ctx, r, n)
}

// exitCodeIn is the code a failed background command's summary names.
var exitCodeIn = regexp.MustCompile(`\bexit code (-?\d+)`)

// wakeOf reads the return of a task in the background: how it ended and, for a
// command that failed, the code it exited with. ok is false for an end the
// conversation does not name.
func wakeOf(kind WakeKind, name string, ev *claude.TaskNotificationEvent) (w Wake, ok bool) {
	w = Wake{Kind: kind, Name: name}
	switch ev.Status {
	case "completed":
		w.Status = WakeCompleted
	case "failed":
		w.Status = WakeFailed
	case "stopped", "killed":
		w.Status = WakeStopped
	default:
		return Wake{}, false
	}
	if kind == WakeCommand && w.Status == WakeFailed {
		if match := exitCodeIn.FindStringSubmatch(ev.Summary); match != nil {
			if code, err := strconv.Atoi(match[1]); err == nil {
				w.ExitCode = &code
			}
		}
	}
	return w, true
}

// handleStream applies a partial message event to the turn in progress.
func (s *Service) handleStream(ctx context.Context, r *run, ev *claude.StreamEvent, n *notes) {
	t := r.turn
	if t == nil {
		return
	}
	event := ev.Event

	switch event.Type {
	case "message_start":
		if event.Message == nil {
			return
		}
		if r.retryAttempt > 0 {
			s.appendLocked(ctx, r, Entry{Kind: KindMarker, Marker: &MarkerEntry{
				Type:     MarkerRetried,
				Attempts: r.retryAttempt,
				Reason:   r.retryReason,
			}}, n)
			r.clearRetry()
		}
		t.messageID = event.Message.ID
		t.blocks = map[int]*Entry{}
		t.toolNames = map[int]string{}
		t.partial = map[int][]byte{}
		t.finalized = map[int]bool{}
		t.thinking = map[int]string{}
		r.rec.ContextTokens = event.Message.Usage.ContextTokens()
		r.readings++
		n.state(r.key())
	case "content_block_start":
		if event.ContentBlock == nil {
			return
		}
		s.startBlock(ctx, r, event.Index, *event.ContentBlock, n)
	case "content_block_delta":
		if event.Delta == nil {
			return
		}
		switch event.Delta.Type {
		case "text_delta":
			e := t.blocks[event.Index]
			if e == nil || e.Kind != KindAssistant {
				return
			}
			e.Assistant.Text += event.Delta.Text
			r.dirty[e.ID] = struct{}{}
			s.armFlushLocked(r)
		case "input_json_delta":
			t.partial[event.Index] = append(t.partial[event.Index], event.Delta.PartialJSON...)
		case "thinking_delta":
			s.streamThinking(ctx, r, event.Index, event.Delta.Thinking, n)
		default:
			// Signature deltas carry nothing to show.
		}
	case "content_block_stop":
		e := t.blocks[event.Index]
		if e == nil || e.Kind != KindAssistant {
			return
		}
		e.Assistant.Complete = true
		delete(r.dirty, e.ID)
		s.updateLocked(ctx, r, e, n)
	default:
		// message_delta and message_stop carry nothing the transcript keeps.
	}
}

// startBlock opens the entry of a content block that has just started.
func (s *Service) startBlock(ctx context.Context, r *run, index int, block claude.ContentBlock, n *notes) {
	t := r.turn
	switch block.Type {
	case "text":
		e := s.appendLocked(ctx, r, Entry{Kind: KindAssistant, Assistant: &AssistantEntry{
			MessageID:  t.messageID,
			BlockIndex: index,
		}}, n)
		t.blocks[index] = e
	case "tool_use":
		t.toolNames[index] = block.Name
		if block.Name == askUserQuestionTool {
			return
		}
		e := s.appendLocked(ctx, r, Entry{Kind: KindAction, Action: &ActionEntry{
			ToolUseID: block.ID,
			Tool:      block.Name,
			Label:     Label(block.Name),
			Status:    ActionRunning,
		}}, n)
		t.blocks[index] = e
		t.actions[block.ID] = e
		r.actions[block.ID] = e
		n.state(r.key())
	case "thinking":
		t.thinking[index] = ""
		s.streamThinking(ctx, r, index, block.Thinking, n)
	default:
		// A redacted thinking block has no text to show.
	}
}

// streamThinking adds a piece to a thinking block of the current message. The
// block is narration, a speech like a text, from the first piece that makes
// its text not blank on; internal reasoning, which never gets readable text,
// leaves nothing in the conversation.
func (s *Service) streamThinking(ctx context.Context, r *run, index int, piece string, n *notes) {
	t := r.turn
	text, ok := t.thinking[index]
	if !ok {
		return // not a thinking block of the current message
	}
	text += piece
	t.thinking[index] = text
	if e := t.blocks[index]; e != nil {
		e.Assistant.Text = text
		r.dirty[e.ID] = struct{}{}
		s.armFlushLocked(r)
		return
	}
	if strings.TrimSpace(text) == "" {
		return
	}
	// The entry event already carries the text, so the entry is not dirty.
	t.blocks[index] = s.appendLocked(ctx, r, Entry{Kind: KindAssistant, Assistant: &AssistantEntry{
		MessageID:  t.messageID,
		BlockIndex: index,
		Text:       text,
	}}, n)
}

// handleAssistant applies the authoritative version of a content block.
func (s *Service) handleAssistant(ctx context.Context, r *run, ev *claude.AssistantEvent, n *notes) {
	t := r.turn
	if t == nil {
		return
	}

	for i, block := range ev.Message.Content {
		switch block.Type {
		case "text":
			s.finishSpeech(ctx, r, ev.Message.ID, i, false, block.Text, n)
		case "thinking":
			if strings.TrimSpace(block.Thinking) == "" {
				continue // internal reasoning: only the signature
			}
			s.finishSpeech(ctx, r, ev.Message.ID, i, true, block.Thinking, n)
		case "tool_use":
			if block.Name == askUserQuestionTool {
				continue
			}
			e := t.actions[block.ID]
			if e == nil {
				e = s.appendLocked(ctx, r, Entry{Kind: KindAction, Action: &ActionEntry{
					ToolUseID: block.ID,
					Tool:      block.Name,
					Status:    ActionRunning,
				}}, n)
				t.actions[block.ID] = e
			}
			r.actions[block.ID] = e
			if isSubagentTool(block.Name) && r.subagents[block.ID] == nil {
				r.subagents[block.ID] = &subagent{entry: e, turnID: t.id, actions: map[string]*Entry{}}
			}
			d := For(block.Name, block.Input, r.task.Dir)
			e.Action.Label, e.Action.Target = d.Label, d.Target
			e.Action.Description, e.Action.CommandLines = d.Description, d.CommandLines
			e.Action.Prompt = d.Prompt
			e.Action.Background = e.Action.Background || d.Background
			if e.Action.StartedAt == nil {
				e.Action.StartedAt = new(s.now().UTC())
			}
			s.updateLocked(ctx, r, e, n)
			n.state(r.key())
		default:
			// A redacted thinking block has no text to show.
		}
	}
}

// isSubagentTool reports whether a tool starts a subagent.
func isSubagentTool(tool string) bool {
	return tool == "Agent" || tool == "Task"
}

// handleSubagentAssistant writes what a subagent said and did under the call
// that started it, in the turn the call was made in: the turn open now is not
// necessarily that one, and may be none.
func (s *Service) handleSubagentAssistant(ctx context.Context, r *run, parent string, ev *claude.AssistantEvent, n *notes) {
	sub := r.subagents[parent]
	if sub == nil {
		// A subagent of a subagent, or one from before this process.
		s.log.Debug("claude subagent event ignored", "task", r.task.ID, "stage", r.rec.Stage)
		return
	}
	for i, block := range ev.Message.Content {
		switch block.Type {
		case "text", "thinking":
			text := block.Text
			if block.Type == "thinking" {
				text = block.Thinking
				if strings.TrimSpace(text) == "" {
					continue // internal reasoning: only the signature
				}
			}
			s.appendInLocked(ctx, r, Entry{Kind: KindAssistant, Assistant: &AssistantEntry{
				MessageID:       ev.Message.ID,
				BlockIndex:      i,
				Text:            text,
				Complete:        true,
				ParentToolUseID: parent,
			}}, sub.turnID, n)
		case "tool_use":
			if block.Name == askUserQuestionTool {
				continue
			}
			d := For(block.Name, block.Input, r.task.Dir)
			e := s.appendInLocked(ctx, r, Entry{Kind: KindAction, Action: &ActionEntry{
				ToolUseID:       block.ID,
				Tool:            block.Name,
				Label:           d.Label,
				Target:          d.Target,
				Description:     d.Description,
				CommandLines:    d.CommandLines,
				Prompt:          d.Prompt,
				Background:      d.Background,
				Status:          ActionRunning,
				StartedAt:       new(s.now().UTC()),
				ParentToolUseID: parent,
			}}, sub.turnID, n)
			sub.actions[block.ID] = e
			r.actions[block.ID] = e
		default:
			// A redacted thinking block has no text to show.
		}
	}
	n.state(r.key())
}

// finishSpeech applies the authoritative version of a speech: a text block or,
// with thinking, the narration of a thinking block.
func (s *Service) finishSpeech(ctx context.Context, r *run, messageID string, position int, thinking bool, text string, n *notes) {
	e := s.textEntry(ctx, r, messageID, position, thinking, n)
	e.Assistant.Text = text
	e.Assistant.Complete = true
	delete(r.dirty, e.ID)
	s.updateLocked(ctx, r, e, n)
}

// textEntry finds the streamed entry a speech block is the final version of:
// the first block of the message of the same kind, text or thinking, not yet
// finalized, in block order. When the stream did not announce the block, the
// entry is created now.
func (s *Service) textEntry(ctx context.Context, r *run, messageID string, position int, thinking bool, n *notes) *Entry {
	t := r.turn
	indexes := make([]int, 0, len(t.blocks))
	for index, e := range t.blocks {
		_, isThinking := t.thinking[index]
		if e.Kind == KindAssistant && e.Assistant.MessageID == messageID && !t.finalized[index] && isThinking == thinking {
			indexes = append(indexes, index)
		}
	}
	if len(indexes) > 0 {
		index := slices.Min(indexes)
		t.finalized[index] = true
		return t.blocks[index]
	}

	e := s.appendLocked(ctx, r, Entry{Kind: KindAssistant, Assistant: &AssistantEntry{
		MessageID:  messageID,
		BlockIndex: position,
	}}, n)
	return e
}

// handleUser applies the tool results of a user event to their actions.
func (s *Service) handleUser(ctx context.Context, r *run, ev *claude.UserEvent, n *notes) {
	results := ev.ToolResults()
	var useResult json.RawMessage
	if len(results) == 1 {
		useResult = ev.ToolUseResult
	}
	changed := false
	for _, result := range results {
		var e *Entry
		if r.turn != nil {
			e = r.turn.actions[result.ToolUseID]
		}
		if e == nil {
			e = r.actions[result.ToolUseID]
		}
		if e == nil {
			continue
		}
		changed = s.finishActionLocked(ctx, r, e, result, useResult, n) || changed
	}
	if changed {
		n.state(r.key())
	}
}

// handleSubagentUser applies the tool results of a subagent to its actions.
func (s *Service) handleSubagentUser(ctx context.Context, r *run, parent string, ev *claude.UserEvent, n *notes) {
	sub := r.subagents[parent]
	if sub == nil {
		return
	}
	changed := false
	for _, result := range ev.ToolResults() {
		// The result of a subagent carries no tool_use_result.
		if e := sub.actions[result.ToolUseID]; e != nil {
			changed = s.finishActionLocked(ctx, r, e, result, nil, n) || changed
		}
	}
	if changed {
		n.state(r.key())
	}
}

// finishActionLocked brings an action to the end its tool result gives it, and
// reports whether it did. The result of a call in the background only says it
// was launched: the action runs until its task ends.
func (s *Service) finishActionLocked(ctx context.Context, r *run, e *Entry, result claude.ToolResult, useResult json.RawMessage, n *notes) bool {
	if e.Action.Background && (!result.IsError || e.Action.TaskID != "") {
		return false // launched; a launch that failed has no task to wait for
	}
	e.Action.Status = ActionDone
	e.Action.FinishedAt = new(s.now().UTC())
	if result.IsError {
		e.Action.Status = ActionError
		if e.Action.Tool == "Bash" {
			e.Action.ExitCode = exitCode(result.Text())
		}
	}
	if o, ok := outputOf(e.Action, result, useResult); ok {
		s.saveOutputLocked(ctx, r, e, o)
	}
	s.updateLocked(ctx, r, e, n)
	return true
}

// saveOutputLocked keeps the whole output of an action and its tail in the
// entry.
func (s *Service) saveOutputLocked(ctx context.Context, r *run, e *Entry, o Output) {
	if err := s.entries.SaveOutput(ctx, e.ID, o); err != nil {
		s.log.Error("save output failed", "task", r.task.ID, "entry", e.ID, "error", err)
	}
	e.Action.OutputLines = o.Lines
	e.Action.OutputTail = tailOf(o)
	e.Action.OutputTruncated = o.Truncated
}

// exitCodeLine is the first line of a failed Bash result that names the code.
var exitCodeLine = regexp.MustCompile(`^(?:Error: )?Exit code (-?\d+)`)

// exitCode reads the code a failed Bash command exited with, nil when the
// result does not say.
func exitCode(text string) *int {
	line, _, _ := strings.Cut(text, "\n")
	match := exitCodeLine.FindStringSubmatch(line)
	if match == nil {
		return nil
	}
	code, err := strconv.Atoi(match[1])
	if err != nil {
		return nil
	}
	return &code
}

// handleControlRequest turns a can_use_tool request into a permission or a
// question entry and parks the run on it.
func (s *Service) handleControlRequest(ctx context.Context, r *run, ev *claude.ControlRequestEvent, n *notes) {
	req := ev.Request
	if req.Subtype != "can_use_tool" {
		s.log.Debug("claude control request ignored", "task", r.task.ID, "subtype", req.Subtype)
		return
	}

	var e Entry
	if req.ToolName == askUserQuestionTool {
		e = Entry{Kind: KindQuestion, Question: &QuestionEntry{
			RequestID: ev.RequestID,
			ToolUseID: req.ToolUseID,
			Questions: decodeQuestions(req.Input),
			Status:    PermissionPending,
		}}
	} else {
		e = Entry{Kind: KindPermission, Permission: &PermissionEntry{
			RequestID:           ev.RequestID,
			ToolUseID:           req.ToolUseID,
			Tool:                req.ToolName,
			DisplayName:         req.DisplayName,
			Description:         req.Description,
			Input:               rawOrNull(req.Input),
			Suggestions:         rawOrNull(req.PermissionSuggestions),
			BlockedPath:         req.BlockedPath,
			DecisionReason:      stripANSI(req.DecisionReason),
			SuppressAlwaysAllow: req.SuppressAlwaysAllowRule,
			DefaultToNo:         req.DefaultToNo,
			Status:              PermissionPending,
			ParentToolUseID:     requesterOf(r, req.ToolUseID, req.AgentID),
		}}
	}
	r.permission = s.appendLocked(ctx, r, e, n)
	n.state(r.key())
}

// requesterOf is the Agent/Task call of the subagent that asks for a
// permission: the parent of the call it wants to make, or the call of the task
// the CLI names; "" for the main thread.
func requesterOf(r *run, toolUseID, agentID string) string {
	if e := r.actions[toolUseID]; e != nil && e.Action.ParentToolUseID != "" {
		return e.Action.ParentToolUseID
	}
	if t := r.tasks[agentID]; agentID != "" && t != nil && t.kind == WakeAgent {
		return t.toolUseID
	}
	return ""
}

// handleControlResponse delivers the answer to a control request of the app:
// the output a caller awaits, the use of the context, or the end of one stop
// of a batch. Any other
// answer, the interrupt's receipt among them, needs nothing.
func (s *Service) handleControlResponse(ctx context.Context, r *run, ev *claude.ControlResponseEvent, n *notes) {
	id := ev.Response.RequestID
	req := r.requests[id]
	if req == nil {
		return
	}
	delete(r.requests, id)
	if req.context {
		s.applyContextLocked(ctx, r, req, ev, n)
		return
	}
	if req.answer != nil {
		req.answer <- *ev
		return
	}

	t := r.tasks[req.taskID]
	if ev.Response.Subtype == "error" {
		if t != nil {
			t.stopReq, t.stopError = "", ev.Response.Error
		}
		req.batch.failed = append(req.batch.failed, ev.Response.Error)
	} else if t != nil {
		req.batch.stopped = append(req.batch.stopped, BackgroundItem{Kind: t.kind, Name: s.taskNameOf(t)})
		if sub := r.subagents[t.toolUseID]; sub != nil && !t.backgrounded {
			s.closeSubagentLocked(ctx, r, sub, ActionInterrupted, interruptedByUser, n)
		}
	}
	req.batch.pending--
	if req.batch.pending == 0 {
		s.settleStopLocked(ctx, r, req.batch, n)
	}
	n.state(r.key())
}

// applyContextLocked takes the window of the model from a get_context_usage
// answer, and its estimate of the tokens unless an exact reading arrived since
// it was asked.
func (s *Service) applyContextLocked(ctx context.Context, r *run, req *controlRequest, ev *claude.ControlResponseEvent, n *notes) {
	if ev.Response.Subtype == "error" {
		s.log.Debug("context usage refused", "task", r.task.ID, "stage", r.rec.Stage, "error", ev.Response.Error)
		return
	}
	usage, err := claude.DecodeContextUsage(ev.Response.Response)
	if err != nil {
		s.log.Debug("context usage unreadable", "task", r.task.ID, "stage", r.rec.Stage, "error", err)
		return
	}
	if usage.RawMaxTokens > 0 {
		r.rec.ContextWindow = usage.RawMaxTokens
	}
	if usage.TotalTokens > 0 && req.readings == r.readings {
		r.rec.ContextTokens = usage.TotalTokens
	}
	_ = s.persistRecord(ctx, r)
	n.state(r.key())
}

// taskNameOf is the name a marker gives a task: the one the agent gave it or,
// without one, the target of its call.
func (s *Service) taskNameOf(t *cliTask) string {
	if t.name == "" && t.entry != nil {
		return t.entry.Action.Target
	}
	return t.name
}

// settleStopLocked ends a batch of stops: what stopped is recorded in one
// marker and whoever waits for the batch is released.
func (s *Service) settleStopLocked(ctx context.Context, r *run, b *stopBatch, n *notes) {
	if len(b.stopped) > 0 {
		s.appendLocked(ctx, r, Entry{Kind: KindMarker, Marker: &MarkerEntry{
			Type:       MarkerBackgroundStopped,
			Background: b.stopped,
		}}, n)
	}
	b.finish()
}

// decodeQuestions reads the questions of an AskUserQuestion input.
func decodeQuestions(input json.RawMessage) []Question {
	var decoded struct {
		Questions []Question `json:"questions"`
	}
	if err := json.Unmarshal(input, &decoded); err != nil {
		return nil
	}
	return decoded.Questions
}

// rawOrNull keeps an absent JSON value as the null it is stored as.
func rawOrNull(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 {
		return json.RawMessage("null")
	}
	return raw
}

// Who interrupted a turn: the user asked for it (Stop, Pause, Review myself,
// discarding, closing), the process died, or the agent itself stopped a task
// in the background.
const (
	interruptedByUser  = "user"
	interruptedByCrash = "crash"
	interruptedByAgent = "agent"
)

// serverStatus is an HTTP 5xx status in an error text.
var serverStatus = regexp.MustCompile(`\b5\d\d\b`)

// retryReasonOf reads why an API call failed from the error of an api_retry:
// "overloaded", "rate_limit", "connection", "server" or "other".
func retryReasonOf(message string) string {
	text := strings.ToLower(message)
	has := func(words ...string) bool {
		return slices.ContainsFunc(words, func(w string) bool { return strings.Contains(text, w) })
	}
	switch {
	case has("overloaded", "529"):
		return "overloaded"
	case has("rate limit", "rate_limit", "ratelimit", "429"):
		return "rate_limit"
	case has("connection", "timeout", "timed out", "econn", "network", "socket"):
		return "connection"
	case serverStatus.MatchString(text):
		return "server"
	default:
		return "other"
	}
}

// stripANSI removes terminal escape sequences from a text.
func stripANSI(text string) string {
	return ansiEscape.ReplaceAllString(text, "")
}

// handleResult ends the turn.
func (s *Service) handleResult(ctx context.Context, r *run, ev *claude.ResultEvent, n *notes) {
	if emptyTurn(ev, r) {
		s.log.Debug("claude empty turn ignored", "task", r.task.ID, "stage", r.rec.Stage)
		if r.returnDue {
			// The CLI answered the return without a request to the API.
			r.answerReturn()
			s.settleWorkLocked(ctx, r, n)
		}
		return // an empty turn the CLI ran on its own: it ends no turn
	}
	aborted := ev.TerminalReason == abortedReason || r.interruptReq != ""
	hadTurn := r.turn != nil
	if t := r.turn; t != nil && t.opener != nil && len(t.opener.Marker.Wakes) == 0 {
		if w := originWake(r, ev.Origin); w != nil {
			t.opener.Marker.Wakes = []Wake{*w}
			s.updateLocked(ctx, r, t.opener, n)
		}
	}
	if hadTurn {
		s.closeTurnLocked(ctx, r, aborted, interruptedByUser, n)
	}

	_ = s.persistRecord(ctx, r)

	if ev.IsError && !aborted {
		message := cmp.Or(ev.Result, ev.TerminalReason, ev.Subtype)
		s.appendLocked(ctx, r, Entry{Kind: KindError, Error: &ErrorEntry{Kind: ErrorTurn, Message: message}}, n)
		r.turnFailed = true
	}

	if hadTurn {
		s.resetTurnLocked(r, n)
	}
	n.state(r.key())
	if !s.flushPendingLocked(ctx, r, n) {
		s.armIdleLocked(r)
	}
}

// emptyTurn reports whether a result closes a turn the CLI opened on its own
// and ran without a single request to the API, which ends no turn of the app.
func emptyTurn(ev *claude.ResultEvent, r *run) bool {
	return ev.NumTurns == 0 && ev.Origin != nil && !ev.IsError &&
		ev.TerminalReason != abortedReason && r.interruptReq == ""
}

// originWake is the return the origin of a result points at, when it is one
// of a task of the current process that already came back; nil otherwise, as
// for the event of a monitor, whose origin names no run.
func originWake(r *run, origin *claude.ResultOrigin) *Wake {
	if origin == nil {
		return nil
	}
	switch origin.Kind {
	case "task-notification":
		if origin.RunID == "" {
			return nil
		}
		for _, task := range r.tasks {
			if task.runID == origin.RunID {
				return task.wake
			}
		}
	case "peer":
		if task := r.tasks[origin.SenderTaskID]; task != nil {
			return task.wake
		}
	}
	return nil
}

// closeTurnLocked brings every entry of the turn to rest: streaming text is
// completed, running actions are done or interrupted, a pending request is
// cancelled. by is who aborted the turn (interruptedByUser or
// interruptedByCrash); the interrupted marker is only the user's. The caller
// holds the mutex and r.turn is set.
func (s *Service) closeTurnLocked(ctx context.Context, r *run, aborted bool, by string, n *notes) {
	t := r.turn

	interruptedText := false
	for _, e := range bySeq(t.blocks) {
		if e.Kind != KindAssistant || e.Assistant.Complete {
			continue
		}
		e.Assistant.Complete = true
		e.Assistant.Interrupted = aborted
		if aborted {
			e.Assistant.InterruptedBy = by
		}
		interruptedText = interruptedText || aborted
		delete(r.dirty, e.ID)
		s.updateLocked(ctx, r, e, n)
	}
	if aborted && by == interruptedByUser && !interruptedText {
		s.appendLocked(ctx, r, Entry{Kind: KindMarker, Marker: &MarkerEntry{
			Type:          MarkerInterrupted,
			InterruptedBy: interruptedByUser,
		}}, n)
	}

	for _, e := range bySeq(t.actions) {
		if e.Action.Status != ActionRunning || r.backgroundAlive(e) {
			continue
		}
		e.Action.Status = ActionDone
		if aborted {
			e.Action.Status = ActionInterrupted
			e.Action.InterruptedBy = by
		}
		s.updateLocked(ctx, r, e, n)
	}
	// What a subagent of the turn was doing ends with the turn, unless its call
	// goes on in the background.
	ended := ActionDone
	if aborted {
		ended = ActionInterrupted
	}
	for _, sub := range r.subagents {
		if sub.turnID == t.id && sub.entry.Action.Status != ActionRunning {
			s.closeSubagentLocked(ctx, r, sub, ended, by, n)
		}
	}

	if e := r.permission; e != nil {
		if e.Kind == KindQuestion {
			e.Question.Status = PermissionCancelled
		} else {
			e.Permission.Status = PermissionCancelled
		}
		r.permission = nil
		s.updateLocked(ctx, r, e, n)
	}
}

// resetTurnLocked forgets the turn and wakes whoever waits for its end.
func (s *Service) resetTurnLocked(r *run, n *notes) {
	if r.turnDone != nil {
		close(r.turnDone)
		r.turnDone = nil
	}
	r.turn = nil
	r.interruptReq = ""
	r.stopTimer(&r.interruptTmr)
	r.clearRetry()
	n.state(r.key())
}

// bySeq lists the entries of a map in conversation order.
func bySeq[K comparable](entries map[K]*Entry) []*Entry {
	out := make([]*Entry, 0, len(entries))
	for _, e := range entries {
		out = append(out, e)
	}
	slices.SortFunc(out, func(a, b *Entry) int { return cmp.Compare(a.Seq, b.Seq) })
	return out
}

// processExited records the end of a process: quietly when the session asked
// for it, as an error otherwise.
func (s *Service) processExited(k Key, gen int, exit claude.ExitInfo) {
	ctx, cancel := bgCtx()
	defer cancel()
	n := &notes{}
	defer s.flush(n)
	s.mu.Lock()
	defer s.mu.Unlock()

	r := s.runs[k]
	if r == nil || r.procGen != gen {
		return
	}
	r.proc = nil
	r.stopTimer(&r.startTimer)
	r.stopTimer(&r.idleTimer)
	r.stopTimer(&r.flushTimer)
	s.flushTextLocked(r, n)

	if r.stopping {
		r.forgetTasks()
		r.stopping = false
		if r.stopped != nil {
			close(r.stopped)
			r.stopped = nil
		}
		n.state(k)
		return
	}

	if r.turn != nil {
		s.closeTurnLocked(ctx, r, true, interruptedByCrash, n)
		s.resetTurnLocked(r, n)
	}
	s.loseBackgroundLocked(ctx, r, n)
	r.forgetTasks()

	message := fmt.Sprintf("Claude Code exited with code %d", exit.Code)
	if exit.Signal != "" {
		message = "Claude Code was killed by " + exit.Signal
	}
	if stderr := strings.TrimSpace(exit.Stderr); stderr != "" {
		message += ": " + stderr
	}
	r.rec.LastError = message
	_ = s.persistRecord(ctx, r)
	s.appendLocked(ctx, r, Entry{Kind: KindError, Error: &ErrorEntry{
		Kind:      ErrorProcessExit,
		Message:   message,
		Retryable: true,
	}}, n)
	s.log.Warn("claude exited unexpectedly",
		"task", k.TaskID, "stage", k.Stage, "code", exit.Code, "signal", exit.Signal)
	n.state(k)
}

// armFlushLocked schedules the delivery of streaming text, unless one is
// already due.
func (s *Service) armFlushLocked(r *run) {
	if r.flushTimer != nil {
		return
	}
	key, gen := r.key(), r.procGen
	r.flushTimer = time.AfterFunc(TextFlushInterval, func() { s.flushText(key, gen) })
}

// flushText delivers the text accumulated since the last flush.
func (s *Service) flushText(k Key, gen int) {
	n := &notes{}
	defer s.flush(n)
	s.mu.Lock()
	defer s.mu.Unlock()

	r := s.runs[k]
	if r == nil || r.procGen != gen {
		return
	}
	r.flushTimer = nil
	s.flushTextLocked(r, n)
}

// flushTextLocked emits the current text of every streaming entry with unsent
// text. The caller holds the mutex.
func (s *Service) flushTextLocked(r *run, n *notes) {
	for _, e := range bySeq(dirtyEntries(r)) {
		n.text(r.key(), e.ID, e.Assistant.Text)
	}
	clear(r.dirty)
}

// dirtyEntries resolves the ids of the streaming entries with unsent text.
func dirtyEntries(r *run) map[string]*Entry {
	out := make(map[string]*Entry, len(r.dirty))
	for id := range r.dirty {
		if e := r.byID[id]; e != nil {
			out[id] = e
		}
	}
	return out
}

// deref is the string a pointer points to, "" when it is nil.
func deref(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
