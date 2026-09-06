package session

import (
	"cmp"
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"slices"
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
func (s *Service) consume(taskID string, gen int, p Process) {
	for ev := range p.Events() {
		s.handle(taskID, gen, ev)
	}
	s.processExited(taskID, gen, p.Wait())
}

// handle applies one event to the run. Events of a process that is no longer
// the current one are dropped.
func (s *Service) handle(taskID string, gen int, ev claude.Event) {
	ctx, cancel := bgCtx()
	defer cancel()
	n := &notes{}
	defer s.flush(n)
	s.mu.Lock()
	defer s.mu.Unlock()

	r := s.runs[taskID]
	if r == nil || r.procGen != gen {
		return
	}
	r.eventSeen = true
	r.stopTimer(&r.startTimer)
	if r.idleTimer != nil {
		r.idleTimer.Reset(s.idleTimeout)
	}

	switch ev.Type {
	case "system":
		s.handleSystem(ctx, r, ev, n)
	case "stream_event":
		s.handleStream(ctx, r, ev.Stream, n)
	case "assistant":
		s.handleAssistant(ctx, r, ev.Assistant, n)
	case "user":
		s.handleUser(ctx, r, ev.User, n)
	case "control_request":
		s.handleControlRequest(ctx, r, ev.ControlRequest, n)
	case "control_response":
		// The interrupt receipt; the result closes the turn.
	case "result":
		s.handleResult(ctx, r, ev.Result, n)
	default:
		s.log.Debug("claude event ignored", "task", r.task.ID, "type", ev.Type, "subtype", ev.Subtype)
	}
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
		n.state(r.task.ID)
	case "compact_boundary":
		s.appendLocked(ctx, r, Entry{Kind: KindMarker, Marker: &MarkerEntry{
			Type:      MarkerCompacted,
			PreTokens: ev.CompactBoundary.CompactMetadata.PreTokens,
		}}, n)
	default:
		s.log.Debug("claude event ignored", "task", r.task.ID, "type", ev.Type, "subtype", ev.Subtype)
	}
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
		t.messageID = event.Message.ID
		t.blocks = map[int]*Entry{}
		t.toolNames = map[int]string{}
		t.partial = map[int][]byte{}
		t.finalized = map[int]bool{}
		r.rec.ContextTokens = event.Message.Usage.ContextTokens()
		n.state(r.task.ID)
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
		default:
			// Thinking and signature deltas carry nothing to show.
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
	default:
		// Thinking blocks are not shown.
	}
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
			e := s.textEntry(ctx, r, ev.Message.ID, i, n)
			e.Assistant.Text = block.Text
			e.Assistant.Complete = true
			delete(r.dirty, e.ID)
			s.updateLocked(ctx, r, e, n)
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
			e.Action.Label, e.Action.Target = For(block.Name, block.Input, r.task.Dir)
			s.updateLocked(ctx, r, e, n)
		default:
			// Thinking blocks are not shown.
		}
	}
}

// textEntry finds the streamed entry an assistant text block is the final
// version of: the first text block of the message not yet finalized, in block
// order. When the stream did not announce the block, the entry is created now.
func (s *Service) textEntry(ctx context.Context, r *run, messageID string, position int, n *notes) *Entry {
	t := r.turn
	indexes := make([]int, 0, len(t.blocks))
	for index, e := range t.blocks {
		if e.Kind == KindAssistant && e.Assistant.MessageID == messageID && !t.finalized[index] {
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
	if r.turn == nil {
		return
	}
	for _, result := range ev.ToolResults() {
		e := r.turn.actions[result.ToolUseID]
		if e == nil {
			continue
		}
		e.Action.Status = ActionDone
		if result.IsError {
			e.Action.Status = ActionError
		}
		s.updateLocked(ctx, r, e, n)
	}
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
		}}
	}
	r.permission = s.appendLocked(ctx, r, e, n)
	n.state(r.task.ID)
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

// stripANSI removes terminal escape sequences from a text.
func stripANSI(text string) string {
	return ansiEscape.ReplaceAllString(text, "")
}

// handleResult ends the turn.
func (s *Service) handleResult(ctx context.Context, r *run, ev *claude.ResultEvent, n *notes) {
	aborted := ev.TerminalReason == abortedReason || r.interruptReq != ""
	hadTurn := r.turn != nil
	if hadTurn {
		s.closeTurnLocked(ctx, r, aborted, n)
	}

	if w := ev.ContextWindow(); w > 0 {
		r.rec.ContextWindow = w
	}
	_ = s.persistRecord(ctx, r)

	if ev.IsError && !aborted {
		message := cmp.Or(ev.Result, ev.TerminalReason, ev.Subtype)
		s.appendLocked(ctx, r, Entry{Kind: KindError, Error: &ErrorEntry{Kind: ErrorTurn, Message: message}}, n)
	}

	if hadTurn {
		s.resetTurnLocked(r, n)
	}
	n.state(r.task.ID)
	if !s.flushPendingLocked(ctx, r, n) {
		s.armIdleLocked(r)
	}
}

// closeTurnLocked brings every entry of the turn to rest: streaming text is
// completed, running actions are done or interrupted, a pending request is
// cancelled. The caller holds the mutex and r.turn is set.
func (s *Service) closeTurnLocked(ctx context.Context, r *run, aborted bool, n *notes) {
	t := r.turn

	interruptedText := false
	for _, e := range bySeq(t.blocks) {
		if e.Kind != KindAssistant || e.Assistant.Complete {
			continue
		}
		e.Assistant.Complete = true
		e.Assistant.Interrupted = aborted
		interruptedText = interruptedText || aborted
		delete(r.dirty, e.ID)
		s.updateLocked(ctx, r, e, n)
	}
	if aborted && !interruptedText {
		s.appendLocked(ctx, r, Entry{Kind: KindMarker, Marker: &MarkerEntry{Type: MarkerInterrupted}}, n)
	}

	for _, e := range bySeq(t.actions) {
		if e.Action.Status != ActionRunning {
			continue
		}
		e.Action.Status = ActionDone
		if aborted {
			e.Action.Status = ActionInterrupted
		}
		s.updateLocked(ctx, r, e, n)
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
	r.retryAttempt = 0
	n.state(r.task.ID)
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
func (s *Service) processExited(taskID string, gen int, exit claude.ExitInfo) {
	ctx, cancel := bgCtx()
	defer cancel()
	n := &notes{}
	defer s.flush(n)
	s.mu.Lock()
	defer s.mu.Unlock()

	r := s.runs[taskID]
	if r == nil || r.procGen != gen {
		return
	}
	r.proc = nil
	r.stopTimer(&r.startTimer)
	r.stopTimer(&r.idleTimer)
	r.stopTimer(&r.flushTimer)
	s.flushTextLocked(r, n)

	if r.stopping {
		r.stopping = false
		if r.stopped != nil {
			close(r.stopped)
			r.stopped = nil
		}
		n.state(taskID)
		return
	}

	if r.turn != nil {
		s.closeTurnLocked(ctx, r, true, n)
		s.resetTurnLocked(r, n)
	}

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
	s.log.Warn("claude exited unexpectedly", "task", taskID, "code", exit.Code, "signal", exit.Signal)
	n.state(taskID)
}

// armFlushLocked schedules the delivery of streaming text, unless one is
// already due.
func (s *Service) armFlushLocked(r *run) {
	if r.flushTimer != nil {
		return
	}
	taskID, gen := r.task.ID, r.procGen
	r.flushTimer = time.AfterFunc(TextFlushInterval, func() { s.flushText(taskID, gen) })
}

// flushText delivers the text accumulated since the last flush.
func (s *Service) flushText(taskID string, gen int) {
	n := &notes{}
	defer s.flush(n)
	s.mu.Lock()
	defer s.mu.Unlock()

	r := s.runs[taskID]
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
		n.text(r.task.ID, e.ID, e.Assistant.Text)
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
