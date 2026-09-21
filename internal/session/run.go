package session

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/guilhermt/myspec/internal/claude"
	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/prompts"
)

// run is the in-memory state of one session. Every field is protected by
// Service.mu.
type run struct {
	task    TaskInfo
	rec     Record
	entries []*Entry // ordered, excluding pending
	pending []*Entry
	byID    map[string]*Entry // every entry, both lists
	nextSeq int

	proc       Process
	procGen    int           // bumped on every start; stale consumers compare and drop out
	stopping   bool          // we asked the process to stop; its exit is expected
	eventSeen  bool          // the current process has said something
	startTimer *time.Timer   // fires when a message got no event back in time
	procChoice models.Choice // the model and effort the current process was started with

	turn         *turn
	permission   *Entry // pending permission or question
	interruptReq string // request id of the interrupt in flight, "" otherwise
	interruptTmr *time.Timer
	retryAttempt int
	turnFailed   bool // the last turn ended in an error; the next turn clears it

	idleTimer  *time.Timer
	flushTimer *time.Timer
	dirty      map[string]struct{} // ids of streaming entries with unsent text

	turnDone chan struct{} // created when a turn starts, closed when its result arrives
	stopped  chan struct{} // created by stopProcess, closed by processExited
}

// turn is the state of the turn in progress.
type turn struct {
	id        string            // the user entry that started it
	messageID string            // current API message id
	blocks    map[int]*Entry    // content block index -> assistant or action entry of the current message
	toolNames map[int]string    // block index -> tool name, for tool_use blocks
	actions   map[string]*Entry // tool_use_id -> action entry
	partial   map[int][]byte    // accumulated input_json_delta per block (kept for future use; not rendered)
	finalized map[int]bool      // block index -> its assistant event has arrived
}

// graces are how long stopProcess waits at each step before escalating.
type graces struct {
	inputClose time.Duration
	terminate  time.Duration
}

// defaultGraces stop a process politely; closeGraces stop it fast, for a task
// about to be deleted.
var (
	defaultGraces = graces{inputClose: graceInputClose, terminate: graceTerminate}
	closeGraces   = graces{inputClose: time.Second, terminate: time.Second}
)

// interruptReceiptCapability is the CLI capability the interrupt relies on.
const interruptReceiptCapability = "interrupt_receipt_v1"

func newRun(t TaskInfo, rec Record, nextSeq int) *run {
	return &run{
		task:    t,
		rec:     rec,
		byID:    map[string]*Entry{},
		nextSeq: nextSeq,
		dirty:   map[string]struct{}{},
	}
}

// key is the session this run is held under.
func (r *run) key() Key { return Key{TaskID: r.task.ID, Stage: r.rec.Stage} }

func newTurn(id string) *turn {
	return &turn{
		id:        id,
		blocks:    map[int]*Entry{},
		toolNames: map[int]string{},
		actions:   map[string]*Entry{},
		partial:   map[int][]byte{},
		finalized: map[int]bool{},
	}
}

// newEntry stamps the envelope of an entry about to join the conversation: a
// fresh id, the next position, the turn in progress and the time.
func (r *run) newEntry(s *Service, e Entry) *Entry {
	e.ID = s.newID()
	e.Seq = r.nextSeq
	r.nextSeq++
	if r.turn != nil {
		e.TurnID = r.turn.id
	}
	e.CreatedAt = s.now().UTC()
	return &e
}

// summary derives what the interface shows from the state of the run.
func (r *run) summary() Summary {
	sum := Summary{
		TaskID:         r.task.ID,
		Stage:          r.rec.Stage,
		Choice:         r.rec.Choice,
		TurnRunning:    r.turn != nil,
		ProcessRunning: r.proc != nil,
		RetryAttempt:   r.retryAttempt,
		ContextPercent: contextPercent(r.rec.ContextTokens, r.rec.ContextWindow),
		PendingCount:   len(r.pending),
		Corrections:    r.rec.Corrections,
		LastError:      r.rec.LastError,
		TurnFailed:     r.turnFailed,
	}
	switch {
	case r.rec.Paused:
		sum.Status = StatusPaused
	case r.rec.LastError != "":
		sum.Status = StatusError
	case r.permission != nil && r.permission.Kind == KindQuestion:
		sum.Status = StatusNeedsAnswer
	case r.permission != nil:
		sum.Status = StatusNeedsPermission
	case r.turn != nil || r.startTimer != nil:
		sum.Status = StatusWorking
	default:
		sum.Status = StatusWaiting
	}
	sum.Idle = sum.Status == StatusWaiting && len(r.pending) == 0
	return sum
}

// stopTimer stops a timer and forgets it.
func (r *run) stopTimer(timer **time.Timer) {
	if *timer != nil {
		(*timer).Stop()
		*timer = nil
	}
}

// stopTimers stops every timer of the run.
func (r *run) stopTimers() {
	r.stopTimer(&r.startTimer)
	r.stopTimer(&r.interruptTmr)
	r.stopTimer(&r.idleTimer)
	r.stopTimer(&r.flushTimer)
}

// ensureProcessLocked starts the CLI when it is not running. A failure is
// recorded in the conversation and returned. The caller holds the mutex.
func (s *Service) ensureProcessLocked(ctx context.Context, r *run, n *notes) error {
	if r.proc != nil {
		return nil
	}

	binary, err := s.launcher.Locate()
	if err != nil {
		return s.failStart(ctx, r, n, ErrorNotFound,
			"Claude Code was not found. Install it or point MYSPEC_CLAUDE_PATH at the executable.", err)
	}

	if !s.preflightOK {
		preflightCtx, cancel := context.WithTimeout(context.Background(), preflightTimeout)
		preflightErr := s.launcher.Preflight(preflightCtx, binary)
		cancel()
		switch {
		case errors.Is(preflightErr, claude.ErrNotLoggedIn):
			return s.failStart(ctx, r, n, ErrorNotLoggedIn,
				"Claude Code is not logged in. Run `claude` in a terminal, log in, then retry.", preflightErr)
		case preflightErr != nil:
			return s.failStart(ctx, r, n, ErrorStartFailed,
				"Could not check Claude Code: "+preflightErr.Error(), preflightErr)
		}
		s.preflightOK = true
	}

	startCtx, cancel := context.WithTimeout(context.Background(), StartTimeout)
	defer cancel()
	p, err := s.launcher.Start(startCtx, claude.Config{
		Binary:    binary,
		Dir:       r.task.Dir,
		SessionID: r.rec.ID,
		Resume:    r.rec.Started,
		Model:     string(r.rec.Choice.Model),
		Effort:    string(r.rec.Choice.Effort),
		ExtraDirs: r.task.ExtraDirs,
	})
	if err != nil {
		return s.failStart(ctx, r, n, ErrorStartFailed, "Could not start Claude Code: "+err.Error(), err)
	}

	r.proc = p
	r.procChoice = r.rec.Choice
	r.procGen++
	r.stopping = false
	r.eventSeen = false
	r.stopTimer(&r.startTimer)
	r.stopTimer(&r.flushTimer)
	clear(r.dirty)
	if r.rec.LastError != "" {
		r.rec.LastError = ""
		_ = s.persistRecord(ctx, r)
	}
	go s.consume(r.key(), r.procGen, p)
	n.state(r.key())
	return nil
}

// armStartLocked gives a process that has not spoken yet a deadline to answer
// the message just sent. The CLI is silent until its first message, so the
// deadline starts with the message, not with the process.
func (s *Service) armStartLocked(r *run) {
	if r.eventSeen || r.startTimer != nil {
		return
	}
	key, gen := r.key(), r.procGen
	r.startTimer = time.AfterFunc(StartTimeout, func() { s.startExpired(key, gen) })
}

// startExpired gives up on a process that said nothing since it started.
func (s *Service) startExpired(k Key, gen int) {
	ctx, cancel := bgCtx()
	defer cancel()
	n := &notes{}
	defer s.flush(n)
	s.mu.Lock()
	defer s.mu.Unlock()

	r := s.runs[k]
	if r == nil || r.procGen != gen || r.startTimer == nil || r.proc == nil {
		return
	}
	r.startTimer = nil
	r.stopping = true
	if err := r.proc.Terminate(); err != nil {
		s.log.Warn("terminate claude failed", "task", k.TaskID, "stage", k.Stage, "error", err)
	}
	_ = s.failStart(ctx, r, n, ErrorStartFailed, "Claude Code did not respond in time.", nil)
}

// failStart records a failed start: the error on the session, an error entry
// in the conversation, and the wrapped cause for the caller.
func (s *Service) failStart(ctx context.Context, r *run, n *notes, kind ErrorKind, message string, cause error) error {
	r.rec.LastError = message
	_ = s.persistRecord(ctx, r)
	s.appendLocked(ctx, r, Entry{Kind: KindError, Error: &ErrorEntry{Kind: kind, Message: message, Retryable: true}}, n)
	n.state(r.key())
	if cause == nil {
		return errors.New(message)
	}
	return fmt.Errorf("%s: %w", message, cause)
}

// enqueueLocked puts a user message at the end of the queue.
func (s *Service) enqueueLocked(ctx context.Context, r *run, u *UserEntry, n *notes) error {
	u.Pending = true
	e := r.newEntry(s, Entry{Kind: KindUser, User: u})
	e.TurnID = e.ID
	r.pending = append(r.pending, e)
	r.byID[e.ID] = e
	if err := s.entries.Insert(ctx, r.rec.ID, *e); err != nil {
		return err
	}
	n.entry(r.key(), e)
	n.state(r.key())
	return nil
}

// flushPendingLocked delivers the first queued message when the session is
// free to take one, starting the process if needed. It reports whether a
// message went out. The caller holds the mutex.
func (s *Service) flushPendingLocked(ctx context.Context, r *run, n *notes) bool {
	if r.rec.Paused || r.stopping || r.turn != nil || r.permission != nil || len(r.pending) == 0 {
		return false
	}
	if r.proc != nil && r.procChoice != r.rec.Choice {
		// The process runs with the model and effort the session had when it
		// started. The message waits for one that runs with the ones it has now;
		// stopping is set here so that no other flush starts a second restart and
		// the idle timer leaves the process alone.
		r.stopping = true
		s.log.Info("claude restarting",
			"task", r.task.ID, "stage", r.rec.Stage,
			"model", string(r.rec.Choice.Model), "effort", string(r.rec.Choice.Effort))
		go s.restartProcess(r.key(), r.procGen)
		return false
	}
	if err := s.ensureProcessLocked(ctx, r, n); err != nil {
		return false
	}

	e := r.pending[0]
	text := e.User.Text
	if e.User.Prompt {
		vars := prompts.Vars{
			TaskName:     r.task.Name,
			ArtifactsDir: r.task.ArtifactsDir,
			PRDPath:      r.task.PRDPath,
			TechSpecPath: r.task.TechSpecPath,
			StepsDir:     r.task.StepsDir,
			StepPath:     r.task.StepPath,
			OneShotPath:  r.task.OneShotPath,
			Repository:   r.task.Repository,
			Branch:       r.task.Branch,
			BaseBranch:   r.task.BaseBranch,
			DraftPath:    r.task.DraftPath,
			ReviewPath:   r.task.ReviewPath,
			PRNumber:     r.task.PRNumber,
			PRURL:        r.task.PRURL,

			Card:          r.task.Card,
			CardReference: r.task.CardReference,

			ContextPath:  r.task.ContextPath,
			External:     r.task.External,
			Publish:      r.task.Publish,
			Instructions: r.task.Instructions,

			DocumentPath: r.task.DocumentPath,
			DraftsPath:   r.task.DraftsPath,
			Board:        r.task.Board,
		}
		// The text of a prompt entry is what the app appends to the prompt: the
		// initial context of the PRD, of the One-Shot planning and of a
		// discussion, the instructions of a review pass, or what the implementer
		// said last.
		switch r.task.Prompt {
		case prompts.StagePRD, prompts.StageOneShot, prompts.StageDiscussion:
			vars.InitialContext = e.User.Text
		case prompts.StagePRReview:
			vars.PassInstructions = e.User.Text
		case prompts.StageStepReview:
			vars.ImplementerReply = e.User.Text
		default:
			// The prompt of every other stage has nothing appended.
		}
		rendered, err := s.renderPrompt(r.task.Prompt, vars)
		if err != nil {
			_ = s.failStart(ctx, r, n, ErrorStartFailed, "Could not render the prompt: "+err.Error(), err)
			return false
		}
		text = rendered
	}

	if err := r.proc.Send(text); err != nil {
		// The process is gone or going; its exit reports the failure.
		s.log.Warn("send to claude failed", "task", r.task.ID, "error", err)
		if err := r.proc.Terminate(); err != nil {
			s.log.Warn("terminate claude failed", "task", r.task.ID, "error", err)
		}
		return false
	}

	r.pending = r.pending[1:]
	e.User.Pending = false
	e.Seq = r.nextSeq
	r.nextSeq++
	e.TurnID = e.ID
	r.entries = append(r.entries, e)
	s.updateLocked(ctx, r, e, n)

	r.turn = newTurn(e.ID)
	r.turnFailed = false
	r.turnDone = make(chan struct{})
	r.stopTimer(&r.idleTimer)
	s.armStartLocked(r)
	n.state(r.key())
	return true
}

// armIdleLocked schedules the stop of a process that has nothing to do.
func (s *Service) armIdleLocked(r *run) {
	if r.proc == nil || r.stopping {
		return
	}
	key, gen := r.key(), r.procGen
	r.stopTimer(&r.idleTimer)
	r.idleTimer = time.AfterFunc(s.idleTimeout, func() { s.idleExpired(key, gen) })
}

// idleExpired stops a process that stayed idle for the whole timeout.
func (s *Service) idleExpired(k Key, gen int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	r := s.runs[k]
	if r == nil || r.procGen != gen {
		return
	}
	r.idleTimer = nil
	if r.proc == nil || r.stopping || r.turn != nil || r.permission != nil || len(r.pending) > 0 {
		return
	}
	go s.stopProcess(k, gen, false, defaultGraces)
}

// restartProcess stops a process whose model or effort is not the session's
// any more and delivers the first queued message on a new one, which starts
// with the ones the session has now.
func (s *Service) restartProcess(k Key, gen int) {
	s.stopProcess(k, gen, false, defaultGraces)

	ctx, cancel := bgCtx()
	defer cancel()
	n := &notes{}
	defer s.flush(n)
	s.mu.Lock()
	defer s.mu.Unlock()

	if r := s.runs[k]; r != nil {
		s.flushPendingLocked(ctx, r, n)
	}
}

// stopProcess ends the process of a run and returns once it has exited. With
// graceful, a turn in progress is interrupted first and given the chance to
// end. The mutex is held only while state changes, never while waiting.
func (s *Service) stopProcess(k Key, gen int, graceful bool, g graces) {
	ctx, cancel := bgCtx()
	defer cancel()

	s.mu.Lock()
	r := s.runs[k]
	if r == nil || r.procGen != gen || r.proc == nil {
		s.mu.Unlock()
		return
	}
	if r.stopped != nil {
		// Another stop is under way; its end is ours too.
		stopped := r.stopped
		s.mu.Unlock()
		<-stopped
		return
	}
	p := r.proc
	stopped := make(chan struct{})
	r.stopping = true
	r.stopped = stopped
	var turnDone chan struct{}
	if graceful && r.turn != nil {
		if r.interruptReq == "" {
			if id, err := p.Interrupt(); err == nil {
				r.interruptReq = id
			} else {
				s.log.Warn("interrupt claude failed", "task", k.TaskID, "stage", k.Stage, "error", err)
			}
		}
		turnDone = r.turnDone
	}
	s.mu.Unlock()

	if turnDone != nil {
		wait(turnDone, InterruptTimeout)
	}

	n := &notes{}
	s.mu.Lock()
	if r.procGen == gen && r.turn != nil {
		s.closeTurnLocked(ctx, r, true, n)
		s.resetTurnLocked(r, n)
	}
	s.mu.Unlock()
	s.flush(n)

	if err := p.CloseInput(); err != nil {
		s.log.Warn("close claude input failed", "task", k.TaskID, "stage", k.Stage, "error", err)
	}
	if !wait(p.Done(), g.inputClose) {
		if err := p.Terminate(); err != nil {
			s.log.Warn("terminate claude failed", "task", k.TaskID, "stage", k.Stage, "error", err)
		}
		if !wait(p.Done(), g.terminate) {
			if err := p.Kill(); err != nil {
				s.log.Warn("kill claude failed", "task", k.TaskID, "stage", k.Stage, "error", err)
			}
			<-p.Done()
		}
	}
	<-stopped
}

// wait blocks until ch closes or the timeout passes, reporting which.
func wait(ch <-chan struct{}, timeout time.Duration) bool {
	timer := time.NewTimer(timeout)
	defer timer.Stop()
	select {
	case <-ch:
		return true
	case <-timer.C:
		return false
	}
}
