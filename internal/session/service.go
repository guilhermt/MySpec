package session

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/guilhermt/myspec/internal/claude"
	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/prompts"
)

// EntryRepository persists the transcript of every session.
type EntryRepository interface {
	List(ctx context.Context, sessionID string) ([]Entry, error)
	Insert(ctx context.Context, sessionID string, e Entry) error
	Update(ctx context.Context, e Entry) error
	Delete(ctx context.Context, id string) error
	MaxSeq(ctx context.Context, sessionID string) (int, error)
	SaveOutput(ctx context.Context, entryID string, o Output) error
	Output(ctx context.Context, entryID string) (Output, error) // ErrNotFound
}

// Process is the running CLI, as internal/claude provides it.
type Process interface {
	Events() <-chan claude.Event
	Send(text string) error
	Interrupt() (string, error)
	Respond(requestID string, resp claude.PermissionResponse) error
	CloseInput() error
	Terminate() error
	Kill() error
	Wait() claude.ExitInfo
	Done() <-chan struct{}
}

// Launcher finds, checks and starts the CLI. internal/app adapts
// internal/claude to it.
type Launcher interface {
	Locate() (string, error)
	Preflight(ctx context.Context, binary string) error
	Start(ctx context.Context, cfg claude.Config) (Process, error)
}

// TaskInfo is what the session needs to know about its task, at the stage it
// is in.
type TaskInfo struct {
	ID             string
	Name           string
	Dir            string // working directory of the CLI: the clone of the repository, or the worktree of the task
	ArtifactsDir   string
	Stage          string        // session key: a task stage, or StepStage(n)
	Prompt         prompts.Stage // the prompt that opens the session
	Step           int           // step and step review sessions: the number; 0 otherwise
	StepPath       string        // step sessions: the file sent as the prompt, verbatim; step review sessions: the step under review
	PRDPath        string
	TechSpecPath   string
	StepsDir       string
	OneShotPath    string // One-Shot tasks only: the document the prompts point to; "" for a Structured task
	InitialContext string
	// ImplementerReply is what the implementer of a step said last, which the
	// prompt of its reviewer ends with; step review sessions only.
	ImplementerReply string
	ArtifactExists   bool // the artifact of Prompt is already there; always false for a step

	// Choice is the model and effort a session created for this task and stage
	// starts with. A session that already exists keeps its own.
	Choice models.Choice

	// The PR sessions of a task: what the prompt of the pull request and the
	// prompt of its review are about.
	Repository string // owner/name of the repository of the task, which every prompt may name
	Branch     string
	BaseBranch string
	DraftPath  string
	ReviewPath string
	PRNumber   string
	PRURL      string

	// PR sessions of a task created from a card.
	Card          string
	CardReference string

	// The review of a pull request that comes from no task.
	ContextPath  string // the single document the prompts read in place of the PRD and the tech spec
	External     bool   // the pull request comes from no task of the product
	Publish      bool   // external only: the findings are published on GitHub, not applied
	Instructions string // the fixed review instructions of the repository
	// PassInstructions is what the user wrote for the pass that opens the
	// session, which reads in the conversation as their first message.
	PassInstructions string
	// Checks is what the app read from GitHub before the pass that opens the
	// session, and MergeBase the origin/<base> ref an approved conflict is
	// resolved by merging; PR review sessions only.
	Checks    *gh.PRChecks
	MergeBase string

	// The discussion sessions.
	ExtraDirs    []string // the clones the agent may read, passed to the CLI with --add-dir; discussions only
	DocumentPath string   // the document of the understanding the agent writes
	DraftsPath   string   // the file of drafts the agent writes and the app reads
	Board        string   // the section that describes the board of the discussion
}

// Key is the session this task and stage are held under.
func (t TaskInfo) Key() Key { return Key{TaskID: t.ID, Stage: t.Stage} }

// artifactOf is the artifact a prompt produces, "" when it produces none.
func artifactOf(stage prompts.Stage) ArtifactKind {
	switch stage {
	case prompts.StageTechSpec:
		return ArtifactTechSpec
	case prompts.StagePlan:
		return ArtifactPlan
	case prompts.StageOneShot:
		return ArtifactOneShot
	case prompts.StageStep, prompts.StageStepReview, prompts.StagePR, prompts.StagePRReview, prompts.StageDiscussion:
		// A step file, the PR prompts and a discussion produce no artifact of the
		// planning: what they write is the work itself, not a document of a stage.
		return ""
	default:
		return ArtifactPRD
	}
}

// Deps are what Service needs from the outside.
type Deps struct {
	Sessions     SessionRepository
	Entries      EntryRepository
	Launcher     Launcher
	RenderPrompt func(stage prompts.Stage, vars prompts.Vars) (string, error)
	Log          *slog.Logger
	Now          func() time.Time         // defaults to time.Now
	NewID        func() string            // defaults to uuid.NewString
	IdleTimeout  time.Duration            // defaults to DefaultIdleTimeout
	OnState      func(k Key)              // a Summary changed; may be nil
	OnTranscript func(ev TranscriptEvent) // the conversation changed; may be nil
}

// The errors the service reports to its callers.
var (
	ErrEmptyMessage = errors.New("session: message is empty")
	ErrPaused       = errors.New("session: paused")
	ErrNoRequest    = errors.New("session: no pending request with that id")
	ErrNotPending   = errors.New("session: entry is not pending")
)

// The timeouts of a session's life cycle.
const (
	// DefaultIdleTimeout is how long a process without a turn, a request or a
	// pending message stays alive before the session stops it.
	DefaultIdleTimeout = 10 * time.Minute
	// StartTimeout is how long a started process has to say anything.
	StartTimeout = 90 * time.Second
	// InterruptTimeout is how long an interrupted turn has to end.
	InterruptTimeout = 5 * time.Second
	// TextFlushInterval is how often streaming text reaches the interface.
	TextFlushInterval = 40 * time.Millisecond
	// graceInputClose is how long a process has to exit after its input closes.
	graceInputClose = 5 * time.Second
	// graceTerminate is how long a process has to exit after SIGTERM.
	graceTerminate = 2 * time.Second
	// preflightTimeout bounds the login check before the first start.
	preflightTimeout = 10 * time.Second
	// persistTimeout bounds the database work done on the session's own
	// goroutines, which have no caller to carry a context.
	persistTimeout = 5 * time.Second
)

// Service owns the sessions of every open task.
type Service struct {
	sessions     SessionRepository
	entries      EntryRepository
	launcher     Launcher
	renderPrompt func(stage prompts.Stage, vars prompts.Vars) (string, error)
	log          *slog.Logger
	now          func() time.Time
	newID        func() string
	idleTimeout  time.Duration
	onState      func(k Key)
	onTranscript func(ev TranscriptEvent)

	mu            sync.Mutex
	runs          map[Key]*run
	conversations map[string][]Conversation // by task id: every session row, loaded by LoadConversations
	preflightOK   bool
}

// New builds a Service from deps.
func New(deps Deps) *Service {
	s := &Service{
		sessions:      deps.Sessions,
		entries:       deps.Entries,
		launcher:      deps.Launcher,
		renderPrompt:  deps.RenderPrompt,
		log:           deps.Log,
		now:           deps.Now,
		newID:         deps.NewID,
		idleTimeout:   deps.IdleTimeout,
		onState:       deps.OnState,
		onTranscript:  deps.OnTranscript,
		runs:          map[Key]*run{},
		conversations: map[string][]Conversation{},
	}
	if s.log == nil {
		s.log = slog.New(slog.DiscardHandler)
	}
	if s.now == nil {
		s.now = time.Now
	}
	if s.newID == nil {
		s.newID = uuid.NewString
	}
	if s.idleTimeout <= 0 {
		s.idleTimeout = DefaultIdleTimeout
	}
	return s
}

// Open loads or creates the session of a task at the stage it is in and
// reconciles its transcript. A task may have one session per stage, and each
// is opened on its own key. It is idempotent and safe to call at the start of
// the app.
func (s *Service) Open(ctx context.Context, t TaskInfo) error {
	n := &notes{}
	defer s.flush(n)
	s.mu.Lock()
	defer s.mu.Unlock()

	k := t.Key()
	if r, ok := s.runs[k]; ok {
		r.task = t
		return nil
	}

	r, err := s.load(ctx, t, n)
	if err != nil {
		return err
	}
	s.runs[k] = r

	if len(r.pending) > 0 && !r.rec.Paused {
		s.flushPendingLocked(ctx, r, n)
	}
	return nil
}

// load reads the session of a task at its stage from the repositories,
// creating the record when there is none, and brings a transcript left by a
// previous run to rest.
func (s *Service) load(ctx context.Context, t TaskInfo, n *notes) (*run, error) {
	rec, err := s.sessions.Get(ctx, t.ID, t.Stage)
	switch {
	case errors.Is(err, ErrNotFound):
		now := s.now().UTC()
		rec = Record{
			ID: s.newID(), TaskID: t.ID, Stage: t.Stage, Choice: t.Choice,
			CreatedAt: now, UpdatedAt: now,
		}
		if insertErr := s.sessions.Insert(ctx, rec); insertErr != nil {
			return nil, insertErr
		}
		s.conversations[t.ID] = append(s.conversations[t.ID], Conversation{Stage: rec.Stage, StartedAt: rec.CreatedAt})
	case err != nil:
		return nil, err
	}

	// A session a version before this one created has no model: it takes the one
	// of its stage, which is what a new one would start with.
	if rec.Choice.Model == "" {
		rec.Choice = t.Choice
		rec.UpdatedAt = s.now().UTC()
		if updateErr := s.sessions.Update(ctx, rec); updateErr != nil {
			return nil, updateErr
		}
	}

	stored, err := s.entries.List(ctx, rec.ID)
	if err != nil {
		return nil, err
	}
	maxSeq, err := s.entries.MaxSeq(ctx, rec.ID)
	if err != nil {
		return nil, err
	}

	r := newRun(t, rec, maxSeq+1)
	// A step session produces no artifact, so it has no written marker to
	// look for either.
	kind := artifactOf(t.Prompt)
	written := MarkerType("")
	if kind != "" {
		written = writtenMarker(kind)
	}
	marked := false
	for i := range stored {
		e := &stored[i]
		r.byID[e.ID] = e
		if e.Kind == KindUser && e.User.Pending {
			r.pending = append(r.pending, e)
			continue
		}
		r.entries = append(r.entries, e)
		if written != "" && e.Kind == KindMarker && e.Marker.Type == written {
			marked = true
		}
		if settle(e) {
			if err := s.entries.Update(ctx, *e); err != nil {
				return nil, err
			}
		}
	}
	r.turnFailed = lastTurnFailed(r.entries)

	if t.ArtifactExists && !marked {
		e := r.newEntry(s, Entry{Kind: KindMarker, Marker: &MarkerEntry{Type: written}})
		r.entries = append(r.entries, e)
		r.byID[e.ID] = e
		if err := s.entries.Insert(ctx, rec.ID, *e); err != nil {
			return nil, err
		}
	}

	// The conversation on screen is the one of the stage that just loaded, so
	// the frontend has to read it again from scratch.
	n.reset(t.Key())
	return r, nil
}

// settle marks an entry a previous run left open as interrupted or cancelled,
// reporting whether it changed anything. Only an app that died mid-turn leaves
// one open, and nothing asked for that, so a text or an action it cuts short
// was cut by a crash.
func settle(e *Entry) bool {
	switch {
	case e.Kind == KindAssistant && !e.Assistant.Complete:
		e.Assistant.Complete = true
		e.Assistant.Interrupted = true
		e.Assistant.InterruptedBy = interruptedByCrash
	case e.Kind == KindAction && e.Action.Status == ActionRunning:
		e.Action.Status = ActionInterrupted
		e.Action.InterruptedBy = interruptedByCrash
	case e.Kind == KindPermission && e.Permission.Status == PermissionPending:
		e.Permission.Status = PermissionCancelled
	case e.Kind == KindQuestion && e.Question.Status == PermissionPending:
		e.Question.Status = PermissionCancelled
	default:
		return false
	}
	return true
}

// lastTurnFailed reports whether a conversation a previous run left ends in a
// failed turn: its last entry that is not a marker is the error of a turn.
func lastTurnFailed(entries []*Entry) bool {
	for _, e := range slices.Backward(entries) {
		if e.Kind == KindMarker {
			continue
		}
		return e.Kind == KindError && e.Error.Kind == ErrorTurn
	}
	return false
}

// Start opens the session of a stage or a step, marks its beginning and
// queues the prompt. restarted says it is being started over, not reached for
// the first time.
func (s *Service) Start(ctx context.Context, t TaskInfo, restarted bool) error {
	if err := s.Open(ctx, t); err != nil {
		return err
	}

	n := &notes{}
	defer s.flush(n)
	s.mu.Lock()
	defer s.mu.Unlock()

	r, err := s.runOf(t.Key())
	if err != nil {
		return err
	}
	marker := MarkerEntry{Type: MarkerStageStarted, Stage: t.Stage, Restarted: restarted}
	switch {
	case t.Stage == ReviewStage:
		// The review of a pull request has no stage to announce: the item is the
		// review itself.
		mode := "apply"
		if t.Publish {
			mode = "publish"
		}
		marker = MarkerEntry{
			Type: MarkerReviewStarted, Model: string(r.rec.Choice.Model), Effort: string(r.rec.Choice.Effort), Mode: mode,
		}
	case t.Stage == DiscussionStage:
		// A discussion has no stage to announce either: the item is the
		// conversation itself.
		marker = MarkerEntry{Type: MarkerDiscussionStarted}
	case t.Prompt == prompts.StageStepReview:
		marker = MarkerEntry{Type: MarkerStepReviewStarted, Step: t.Step}
	case t.Step > 0:
		marker = MarkerEntry{Type: MarkerStepStarted, Step: t.Step, Restarted: restarted}
	}
	s.appendLocked(ctx, r, Entry{Kind: KindMarker, Marker: &marker}, n)

	// Only the prompts that open an item, the PRD and the One-Shot planning of a
	// task and the discussion, carry what the user wrote when they created it,
	// the prompt of a review pass what the user wrote for the pass, and the
	// prompt of a reviewer what the implementer said last; every other stage
	// reads the artifacts of the ones before it. What the implementer said
	// reaches the reviewer from the app, and reads as such.
	entry := &UserEntry{Prompt: true}
	switch t.Prompt {
	case prompts.StagePRD, prompts.StageOneShot, prompts.StageDiscussion:
		entry.Text = t.InitialContext
	case prompts.StageStepReview:
		entry.Text, entry.App = t.ImplementerReply, true
	case prompts.StagePRReview:
		entry.Text = t.PassInstructions
	default:
		// Every other stage starts with an empty prompt entry.
	}
	if err := s.enqueueLocked(ctx, r, entry, n); err != nil {
		return err
	}
	s.flushPendingLocked(ctx, r, n)
	return nil
}

// Send queues a message and delivers it right away when the session is free.
func (s *Service) Send(ctx context.Context, k Key, text string) error {
	text = strings.TrimSpace(text)
	if text == "" {
		return ErrEmptyMessage
	}

	n := &notes{}
	defer s.flush(n)
	s.mu.Lock()
	defer s.mu.Unlock()

	r, err := s.runOf(k)
	if err != nil {
		return err
	}
	if r.rec.Paused {
		return fmt.Errorf("send to task %s: %w", k.TaskID, ErrPaused)
	}
	if err := s.enqueueLocked(ctx, r, &UserEntry{Text: text}, n); err != nil {
		return err
	}
	r.stopTimer(&r.idleTimer)
	s.flushPendingLocked(ctx, r, n)
	return nil
}

// SendFromApp queues a message the app wrote for the agent.
func (s *Service) SendFromApp(ctx context.Context, k Key, m AppMessage) error {
	return s.sendFromApp(ctx, k, m, false)
}

// SendCorrection queues a message the app wrote to fix what the agent
// produced, and counts it against MaxCorrections.
func (s *Service) SendCorrection(ctx context.Context, k Key, m AppMessage) error {
	return s.sendFromApp(ctx, k, m, true)
}

// sendFromApp queues a message of the app, counting it as a correction of the
// session when it is one.
func (s *Service) sendFromApp(ctx context.Context, k Key, m AppMessage, correction bool) error {
	text := strings.TrimSpace(m.Text)
	if text == "" {
		return ErrEmptyMessage
	}

	n := &notes{}
	defer s.flush(n)
	s.mu.Lock()
	defer s.mu.Unlock()

	r, err := s.runOf(k)
	if err != nil {
		return err
	}
	if r.rec.Paused {
		return fmt.Errorf("send to task %s: %w", k.TaskID, ErrPaused)
	}
	if correction {
		r.rec.Corrections++
		if err := s.persistRecord(ctx, r); err != nil {
			return err
		}
	}
	if err := s.enqueueLocked(ctx, r, &UserEntry{
		Text: text, App: true,
		AppKind: m.Kind, AppPass: m.Pass, AppRound: m.Round, AppRounds: m.Rounds, AppCount: m.Count,
	}, n); err != nil {
		return err
	}
	r.stopTimer(&r.idleTimer)
	s.flushPendingLocked(ctx, r, n)
	return nil
}

// Discard throws away the sessions of a task in the given stages, with their
// conversations. The ones in memory are stopped first.
func (s *Service) Discard(ctx context.Context, taskID string, stages ...string) error {
	s.mu.Lock()
	live := make([]Key, 0, len(stages))
	for k := range s.runs {
		if k.TaskID == taskID && slices.Contains(stages, k.Stage) {
			live = append(live, k)
		}
	}
	s.mu.Unlock()

	for _, k := range live {
		if err := s.Close(ctx, k); err != nil {
			return err
		}
	}
	if err := s.sessions.Delete(ctx, taskID, stages...); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.conversations[taskID] = slices.DeleteFunc(s.conversations[taskID], func(c Conversation) bool {
		return slices.Contains(stages, c.Stage)
	})
	return nil
}

// RemovePending drops a queued message before it reaches the CLI.
func (s *Service) RemovePending(ctx context.Context, k Key, entryID string) error {
	n := &notes{}
	defer s.flush(n)
	s.mu.Lock()
	defer s.mu.Unlock()

	r, err := s.runOf(k)
	if err != nil {
		return err
	}
	index := slices.IndexFunc(r.pending, func(e *Entry) bool { return e.ID == entryID })
	if index < 0 {
		return fmt.Errorf("remove entry %s: %w", entryID, ErrNotPending)
	}

	r.pending = slices.Delete(r.pending, index, index+1)
	delete(r.byID, entryID)
	if err := s.entries.Delete(ctx, entryID); err != nil {
		return err
	}
	n.remove(k, entryID)
	n.state(k)
	return nil
}

// Interrupt asks the CLI to abort the running turn. The session stays alive.
func (s *Service) Interrupt(_ context.Context, k Key) error {
	n := &notes{}
	defer s.flush(n)
	s.mu.Lock()
	defer s.mu.Unlock()

	r, err := s.runOf(k)
	if err != nil {
		return err
	}
	if r.turn == nil || r.proc == nil || r.interruptReq != "" {
		return nil
	}

	id, err := r.proc.Interrupt()
	if err != nil {
		return fmt.Errorf("interrupt task %s: %w", k.TaskID, err)
	}
	r.interruptReq = id
	gen := r.procGen
	r.stopTimer(&r.interruptTmr)
	r.interruptTmr = time.AfterFunc(InterruptTimeout, func() { s.interruptExpired(k, gen) })
	n.state(k)
	return nil
}

// interruptExpired stops the process of a turn that ignored an interrupt.
func (s *Service) interruptExpired(k Key, gen int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	r := s.runs[k]
	if r == nil || r.procGen != gen || r.turn == nil || r.interruptReq == "" || r.stopping {
		return
	}
	go s.stopProcess(k, gen, false, defaultGraces)
}

// Pause stops the process and holds every message until Resume.
func (s *Service) Pause(ctx context.Context, k Key) error {
	n := &notes{}
	defer s.flush(n)
	s.mu.Lock()
	defer s.mu.Unlock()

	r, err := s.runOf(k)
	if err != nil {
		return err
	}
	was := r.rec.Paused
	if !was {
		r.rec.PausedAt = s.now().UTC()
	}
	r.rec.Paused = true
	if err := s.persistRecord(ctx, r); err != nil {
		return err
	}
	if !was {
		s.appendLocked(ctx, r, Entry{Kind: KindMarker, Marker: &MarkerEntry{Type: MarkerPaused}}, n)
	}
	n.state(k)
	if r.proc != nil && !r.stopping {
		go s.stopProcess(k, r.procGen, true, defaultGraces)
	}
	return nil
}

// Resume lifts a pause and delivers what was queued meanwhile.
func (s *Service) Resume(ctx context.Context, k Key) error {
	n := &notes{}
	defer s.flush(n)
	s.mu.Lock()
	defer s.mu.Unlock()

	r, err := s.runOf(k)
	if err != nil {
		return err
	}
	r.rec.Paused = false
	r.rec.PausedAt = time.Time{}
	if err := s.persistRecord(ctx, r); err != nil {
		return err
	}
	n.state(k)
	s.flushPendingLocked(ctx, r, n)
	return nil
}

// Retry clears the last error and starts the process again.
func (s *Service) Retry(ctx context.Context, k Key) error {
	n := &notes{}
	defer s.flush(n)
	s.mu.Lock()
	defer s.mu.Unlock()

	r, err := s.runOf(k)
	if err != nil {
		return err
	}
	r.rec.LastError = ""
	if err := s.persistRecord(ctx, r); err != nil {
		return err
	}
	if err := s.ensureProcessLocked(ctx, r, n); err != nil {
		return err
	}
	if !s.flushPendingLocked(ctx, r, n) {
		s.armIdleLocked(r)
	}
	n.state(k)
	return nil
}

// SetChoice changes the model and effort of a session from its next message
// on. A process that is running keeps the ones it started with until then; a
// turn in progress ends with them.
func (s *Service) SetChoice(ctx context.Context, k Key, c models.Choice) error {
	n := &notes{}
	defer s.flush(n)
	s.mu.Lock()
	defer s.mu.Unlock()

	r, err := s.runOf(k)
	if err != nil {
		return err
	}
	if r.rec.Choice == c {
		return nil
	}
	r.rec.Choice = c
	if err := s.persistRecord(ctx, r); err != nil {
		return err
	}
	s.log.Info("session model changed",
		"task", k.TaskID, "stage", k.Stage, "model", string(c.Model), "effort", string(c.Effort))
	n.state(k)
	return nil
}

// Decision is the user's answer to a permission request.
type Decision string

// The answers a permission request accepts.
const (
	DecisionAllow        Decision = "allow"
	DecisionAllowSession Decision = "allow_session"
	DecisionDeny         Decision = "deny"
)

// defaultDenyMessage is what the agent reads when the user denies without a
// word.
const defaultDenyMessage = "The user denied this action."

// AnswerPermission answers the pending permission request of a task.
func (s *Service) AnswerPermission(ctx context.Context, k Key, requestID string, d Decision, message string) error {
	n := &notes{}
	defer s.flush(n)
	s.mu.Lock()
	defer s.mu.Unlock()

	r, e, err := s.pendingRequest(k, requestID, KindPermission)
	if err != nil {
		return err
	}
	p := e.Permission

	var resp claude.PermissionResponse
	status := PermissionAllowed
	switch d {
	case DecisionAllow:
		resp = claude.PermissionResponse{Behavior: "allow", UpdatedInput: p.Input}
	case DecisionAllowSession:
		status = PermissionAllowedSession
		resp = claude.PermissionResponse{
			Behavior:           "allow",
			UpdatedInput:       p.Input,
			UpdatedPermissions: sessionSuggestions(p.Suggestions),
		}
	case DecisionDeny:
		status = PermissionDenied
		if message == "" {
			message = defaultDenyMessage
		}
		resp = claude.PermissionResponse{Behavior: "deny", Message: message}
	default:
		return fmt.Errorf("answer permission %s: unknown decision %q", requestID, d)
	}

	if err := r.proc.Respond(requestID, resp); err != nil {
		return fmt.Errorf("answer permission %s: %w", requestID, err)
	}

	answeredAt := s.now().UTC()
	p.Status = status
	p.AnsweredAt = &answeredAt
	if d == DecisionDeny {
		p.DenyMessage = message
	}
	s.answered(ctx, r, e, n)
	return nil
}

// AnswerQuestion answers the pending structured question of a task. The
// answers map each question text to the chosen label, or labels joined with
// ", " for a multiple choice.
func (s *Service) AnswerQuestion(ctx context.Context, k Key, requestID string, answers map[string]string) error {
	n := &notes{}
	defer s.flush(n)
	s.mu.Lock()
	defer s.mu.Unlock()

	r, e, err := s.pendingRequest(k, requestID, KindQuestion)
	if err != nil {
		return err
	}
	q := e.Question

	updatedInput, err := json.Marshal(struct {
		Questions []Question        `json:"questions"`
		Answers   map[string]string `json:"answers"`
	}{Questions: q.Questions, Answers: answers})
	if err != nil {
		return fmt.Errorf("answer question %s: %w", requestID, err)
	}
	resp := claude.PermissionResponse{Behavior: "allow", UpdatedInput: updatedInput}
	if err := r.proc.Respond(requestID, resp); err != nil {
		return fmt.Errorf("answer question %s: %w", requestID, err)
	}

	answeredAt := s.now().UTC()
	q.Answers = answers
	q.Status = PermissionAllowed
	q.AnsweredAt = &answeredAt
	s.answered(ctx, r, e, n)
	return nil
}

// pendingRequest finds the pending request of a task by id and kind, with the
// process that has to hear the answer. The caller holds the mutex.
func (s *Service) pendingRequest(k Key, requestID string, kind Kind) (*run, *Entry, error) {
	r, err := s.runOf(k)
	if err != nil {
		return nil, nil, err
	}
	e := r.permission
	if e == nil || e.Kind != kind || requestOf(e) != requestID || statusOf(e) != PermissionPending {
		return nil, nil, fmt.Errorf("answer request %s: %w", requestID, ErrNoRequest)
	}
	if r.proc == nil {
		return nil, nil, fmt.Errorf("answer request %s: %w", requestID, ErrNoRequest)
	}
	return r, e, nil
}

// answered records the answer to the pending request of a run.
func (s *Service) answered(ctx context.Context, r *run, e *Entry, n *notes) {
	r.permission = nil
	r.stopTimer(&r.idleTimer)
	s.updateLocked(ctx, r, e, n)
	n.state(r.key())
}

// requestOf is the request id of a permission or question entry.
func requestOf(e *Entry) string {
	if e.Kind == KindQuestion {
		return e.Question.RequestID
	}
	return e.Permission.RequestID
}

// statusOf is the status of a permission or question entry.
func statusOf(e *Entry) PermissionStatus {
	if e.Kind == KindQuestion {
		return e.Question.Status
	}
	return e.Permission.Status
}

// sessionSuggestions keeps the permission suggestions the CLI can apply to the
// session alone, so that nothing is written to the user's settings. It returns
// nil when none remains.
func sessionSuggestions(raw json.RawMessage) json.RawMessage {
	var suggestions []map[string]any
	if err := json.Unmarshal(raw, &suggestions); err != nil {
		return nil
	}

	kept := make([]map[string]any, 0, len(suggestions))
	for _, suggestion := range suggestions {
		kind, _ := suggestion["type"].(string)
		if kind != "addRules" && kind != "addDirectories" {
			continue
		}
		suggestion["destination"] = "session"
		kept = append(kept, suggestion)
	}
	if len(kept) == 0 {
		return nil
	}

	encoded, err := json.Marshal(kept)
	if err != nil {
		return nil
	}
	return encoded
}

// MarkArtifact records that an artifact appeared (first) or was rewritten.
func (s *Service) MarkArtifact(ctx context.Context, k Key, kind ArtifactKind, first bool) {
	n := &notes{}
	defer s.flush(n)
	s.mu.Lock()
	defer s.mu.Unlock()

	r, err := s.runOf(k)
	if err != nil {
		return
	}
	marker := updatedMarker(kind)
	if first {
		marker = writtenMarker(kind)
	}
	s.appendLocked(ctx, r, Entry{Kind: KindMarker, Marker: &MarkerEntry{Type: marker}}, n)
}

// MarkPRReview records that a pass of the review of a pull request was
// written, with its verdict and how many findings it reported (-1 unknown).
func (s *Service) MarkPRReview(ctx context.Context, k Key, pass int, clean bool, findings int) {
	s.mark(ctx, k, reportMarker(MarkerPRReviewWritten, pass, clean, findings))
}

// MarkPRReviewRevised records that the agent rewrote the report of a pass of
// the review of a pull request, with its verdict and how many findings it now
// reports (-1 unknown).
func (s *Service) MarkPRReviewRevised(ctx context.Context, k Key, pass int, clean bool, findings int) {
	s.mark(ctx, k, reportMarker(MarkerPRReviewRevised, pass, clean, findings))
}

// MarkFindingsDecided records how many findings of a pass were approved and
// how many discarded, unless the last findings_decided marker of the pass says
// the same: an Apply approved tried again after a failed send records its
// decision once.
func (s *Service) MarkFindingsDecided(ctx context.Context, k Key, pass, approved, discarded int) {
	n := &notes{}
	defer s.flush(n)
	s.mu.Lock()
	defer s.mu.Unlock()

	r, err := s.runOf(k)
	if err != nil {
		return
	}
	for _, e := range slices.Backward(r.entries) {
		if e.Kind != KindMarker || e.Marker == nil || e.Marker.Type != MarkerFindingsDecided || e.Marker.Pass != pass {
			continue
		}
		if e.Marker.Approved == approved && e.Marker.Discarded == discarded {
			return
		}
		break
	}
	marker := &MarkerEntry{Type: MarkerFindingsDecided, Pass: pass, Approved: approved, Discarded: discarded}
	s.appendLocked(ctx, r, Entry{Kind: KindMarker, Marker: marker}, n)
}

// MarkReviewPublished records that a pass was published on GitHub as a review.
func (s *Service) MarkReviewPublished(ctx context.Context, k Key, p PublishedReview) {
	s.mark(ctx, k, &MarkerEntry{
		Type: MarkerReviewPublished, Pass: p.Pass, Verdict: p.Verdict, Inline: p.Inline, Body: p.Body,
		Summary: p.Summary, Minimal: p.Minimal, URL: p.URL,
	})
}

// MarkNewCommits records the commits that reached the pull request after its
// review was published; count is how many came, -1 when the commit the
// published review was about is not among the ones read.
func (s *Service) MarkNewCommits(ctx context.Context, k Key, commits []MarkerCommit, count int) {
	s.mark(ctx, k, &MarkerEntry{Type: MarkerNewCommits, Commits: commits, Count: count})
}

// reportMarker is the marker of a written or revised report.
func reportMarker(t MarkerType, pass int, clean bool, findings int) *MarkerEntry {
	marker := &MarkerEntry{Type: t, Pass: pass, Clean: clean}
	if findings >= 0 {
		marker.Findings = &findings
	}
	return marker
}

// MarkStepReview records that a pass of the agent review of a step was
// written, with its verdict and how many findings it reported (-1 unknown).
func (s *Service) MarkStepReview(ctx context.Context, k Key, pass int, clean bool, findings int) {
	s.mark(ctx, k, reportMarker(MarkerStepReviewWritten, pass, clean, findings))
}

// mark records a marker in the conversation of a session; a session that is
// not open records nothing.
func (s *Service) mark(ctx context.Context, k Key, marker *MarkerEntry) {
	n := &notes{}
	defer s.flush(n)
	s.mu.Lock()
	defer s.mu.Unlock()

	r, err := s.runOf(k)
	if err != nil {
		return
	}
	s.appendLocked(ctx, r, Entry{Kind: KindMarker, Marker: marker}, n)
}

// MarkCommitted records that the changes were committed; pushed says the
// commit went to pull request number.
func (s *Service) MarkCommitted(ctx context.Context, k Key, sha, subject string, pushed bool, number int) {
	s.mark(ctx, k, &MarkerEntry{Type: MarkerCommitted, SHA: sha, Subject: subject, Pushed: pushed, Number: number})
}

// MarkPROpened records that pull request number was opened against base,
// unless the conversation already records it: a reading of the pull request
// that starts its review again, after a block, finds it opened already.
func (s *Service) MarkPROpened(ctx context.Context, k Key, number int, base string) {
	n := &notes{}
	defer s.flush(n)
	s.mu.Lock()
	defer s.mu.Unlock()

	r, err := s.runOf(k)
	if err != nil {
		return
	}
	opened := slices.ContainsFunc(r.entries, func(e *Entry) bool {
		return e.Kind == KindMarker && e.Marker != nil && e.Marker.Type == MarkerPROpened && e.Marker.Number == number
	})
	if opened {
		return
	}
	marker := &MarkerEntry{Type: MarkerPROpened, Number: number, Base: base}
	s.appendLocked(ctx, r, Entry{Kind: KindMarker, Marker: marker}, n)
}

// MarkChecksRead records the checks of the pull request read for a pass of
// its review.
func (s *Service) MarkChecksRead(ctx context.Context, k Key, pass, passed, total int, failed []string, conflict bool) {
	s.mark(ctx, k, &MarkerEntry{
		Type: MarkerChecksRead, Pass: pass, Passed: passed, Total: total, Failed: failed, Conflict: conflict,
	})
}

// MarkDraftApproved records that the draft of the pull request was approved.
func (s *Service) MarkDraftApproved(ctx context.Context, k Key, title string) {
	s.mark(ctx, k, &MarkerEntry{Type: MarkerDraftApproved, Title: title})
}

// MarkChangesApproved records that the user approved the changed files.
func (s *Service) MarkChangesApproved(ctx context.Context, k Key, files int) {
	s.mark(ctx, k, &MarkerEntry{Type: MarkerChangesApproved, Files: files})
}

// MarkPlanInvalid records the problems of a plan that is not valid, unless
// the last plan_invalid marker of the conversation has the same ones.
func (s *Service) MarkPlanInvalid(ctx context.Context, k Key, problems []PlanProblem) {
	n := &notes{}
	defer s.flush(n)
	s.mu.Lock()
	defer s.mu.Unlock()

	r, err := s.runOf(k)
	if err != nil {
		return
	}
	for _, e := range slices.Backward(r.entries) {
		if e.Kind == KindMarker && e.Marker != nil && e.Marker.Type == MarkerPlanInvalid {
			if slices.Equal(e.Marker.Problems, problems) {
				return
			}
			break
		}
	}
	marker := &MarkerEntry{Type: MarkerPlanInvalid, Problems: problems}
	s.appendLocked(ctx, r, Entry{Kind: KindMarker, Marker: marker}, n)
}

// LastReply is what the agent of a session said at the end of its last turn:
// the text of the last message it wrote after the last message it was sent,
// its blocks joined by a blank line. It is "" for a session that is not open,
// and for an agent that wrote nothing since.
func (s *Service) LastReply(k Key) string {
	s.mu.Lock()
	defer s.mu.Unlock()

	r, ok := s.runs[k]
	if !ok {
		return ""
	}
	var last *Entry
	for _, e := range slices.Backward(r.entries) {
		if e.Kind == KindUser {
			break
		}
		if e.Kind == KindAssistant {
			last = e
			break
		}
	}
	if last == nil {
		return ""
	}
	var parts []string
	for _, e := range r.entries {
		if e.Kind != KindAssistant || e.TurnID != last.TurnID || e.Assistant.MessageID != last.Assistant.MessageID {
			continue
		}
		if text := strings.TrimSpace(e.Assistant.Text); text != "" {
			parts = append(parts, text)
		}
	}
	return strings.Join(parts, "\n\n")
}

// Transcript returns a copy of the conversation of a session, open or
// closed. A closed one is read from the database.
func (s *Service) Transcript(ctx context.Context, k Key) (Transcript, error) {
	s.mu.Lock()
	r, ok := s.runs[k]
	var tr Transcript
	if ok {
		tr = Transcript{
			TaskID:    k.TaskID,
			SessionID: r.rec.ID,
			Stage:     r.rec.Stage,
			Entries:   cloneEntries(r.entries),
			Pending:   cloneEntries(r.pending),
		}
	}
	s.mu.Unlock()
	if ok {
		return tr, nil
	}
	return s.closedTranscript(ctx, k)
}

// closedTranscript reads the conversation of a session that is not open from
// the database, without opening it: nothing is written and no run is created.
// A closed session sends nothing more, so its queued messages stay out.
func (s *Service) closedTranscript(ctx context.Context, k Key) (Transcript, error) {
	rec, err := s.sessions.Get(ctx, k.TaskID, k.Stage)
	if err != nil {
		return Transcript{}, err
	}
	stored, err := s.entries.List(ctx, rec.ID)
	if err != nil {
		return Transcript{}, err
	}
	entries := make([]Entry, 0, len(stored))
	for _, e := range stored {
		if e.User != nil && e.User.Pending {
			continue
		}
		entries = append(entries, e)
	}
	return Transcript{TaskID: k.TaskID, SessionID: rec.ID, Stage: rec.Stage, Entries: entries}, nil
}

// ActionOutput reads the whole output of an action of a session, open or
// closed; ErrNotFound when the entry is not of that session or has no output.
func (s *Service) ActionOutput(ctx context.Context, k Key, entryID string) (Output, error) {
	s.mu.Lock()
	r, open := s.runs[k]
	found := open && r.byID[entryID] != nil
	s.mu.Unlock()

	if !open {
		tr, err := s.closedTranscript(ctx, k)
		if err != nil {
			return Output{}, err
		}
		found = slices.ContainsFunc(tr.Entries, func(e Entry) bool { return e.ID == entryID })
	}
	if !found {
		return Output{}, fmt.Errorf("output of entry %s: %w", entryID, ErrNotFound)
	}
	return s.entries.Output(ctx, entryID)
}

// Summary describes one session, false when it is not open.
func (s *Service) Summary(k Key) (Summary, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	r, ok := s.runs[k]
	if !ok {
		return Summary{}, false
	}
	return r.summary(), true
}

// Summaries describes every open session, by key.
func (s *Service) Summaries() map[Key]Summary {
	s.mu.Lock()
	defer s.mu.Unlock()

	out := make(map[Key]Summary, len(s.runs))
	for k, r := range s.runs {
		out[k] = r.summary()
	}
	return out
}

// Exists reports whether a session was ever created for a key: open now, or
// only recorded, as one a previous run of the app left behind is. Unlike Open,
// it never creates one.
func (s *Service) Exists(ctx context.Context, k Key) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.runs[k]; ok {
		return true, nil
	}
	_, err := s.sessions.Get(ctx, k.TaskID, k.Stage)
	switch {
	case errors.Is(err, ErrNotFound):
		return false, nil
	case err != nil:
		return false, err
	}
	return true, nil
}

// Close stops the process of one session, quickly, and forgets it. Used when
// a stage is over or a task is deleted.
func (s *Service) Close(_ context.Context, k Key) error {
	s.mu.Lock()
	r, ok := s.runs[k]
	if !ok {
		s.mu.Unlock()
		return nil
	}
	gen := r.procGen
	s.mu.Unlock()

	s.stopProcess(k, gen, false, closeGraces)

	s.mu.Lock()
	defer s.mu.Unlock()
	r.stopTimers()
	delete(s.runs, k)
	return nil
}

// CloseTask stops every session of a task and forgets them all. Used before
// the task, or the worktrees its sessions run in, go away.
func (s *Service) CloseTask(ctx context.Context, taskID string) error {
	s.mu.Lock()
	keys := make([]Key, 0, len(s.runs))
	for k := range s.runs {
		if k.TaskID == taskID {
			keys = append(keys, k)
		}
	}
	s.mu.Unlock()

	for _, k := range keys {
		if err := s.Close(ctx, k); err != nil {
			return err
		}
	}
	return nil
}

// DiscardTask stops every session of a task and throws all of them away with
// their conversations. Used when a task is archived: the history keeps the
// artifacts, not the talks that produced them.
func (s *Service) DiscardTask(ctx context.Context, taskID string) error {
	if err := s.CloseTask(ctx, taskID); err != nil {
		return err
	}
	if err := s.sessions.DeleteByTask(ctx, taskID); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.conversations, taskID)
	return nil
}

// ForgetTask makes the conversations index forget a task, without touching
// the database. Used when a task is deleted: its sessions rows go with it by
// cascade, but nobody tells the index that on its own.
func (s *Service) ForgetTask(taskID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.conversations, taskID)
}

// LoadConversations reads every session the database keeps into the index
// Conversations answers from. The app calls it once, at start.
func (s *Service) LoadConversations(ctx context.Context) error {
	recs, err := s.sessions.List(ctx)
	if err != nil {
		return err
	}
	index := map[string][]Conversation{}
	for _, rec := range recs {
		index[rec.TaskID] = append(index[rec.TaskID], Conversation{Stage: rec.Stage, StartedAt: rec.CreatedAt})
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.conversations = index
	return nil
}

// Conversations lists every session a task has, open or closed, by start.
func (s *Service) Conversations(taskID string) []Conversation {
	s.mu.Lock()
	defer s.mu.Unlock()

	out := slices.Clone(s.conversations[taskID])
	slices.SortStableFunc(out, func(a, b Conversation) int { return a.StartedAt.Compare(b.StartedAt) })
	return out
}

// Shutdown stops every process gracefully within ctx, and kills what is left
// when ctx expires.
func (s *Service) Shutdown(ctx context.Context) {
	s.mu.Lock()
	type live struct {
		key  Key
		gen  int
		proc Process
	}
	var procs []live
	for k, r := range s.runs {
		if r.proc != nil {
			procs = append(procs, live{key: k, gen: r.procGen, proc: r.proc})
		}
	}
	s.mu.Unlock()

	var wg sync.WaitGroup
	for _, p := range procs {
		wg.Go(func() { s.stopProcess(p.key, p.gen, true, defaultGraces) })
	}

	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()
	select {
	case <-done:
	case <-ctx.Done():
		for _, p := range procs {
			if err := p.proc.Kill(); err != nil {
				s.log.Warn("kill claude failed", "task", p.key.TaskID, "stage", p.key.Stage, "error", err)
			}
		}
		<-done
	}
}

// runOf finds an open session by key. The caller holds the mutex.
func (s *Service) runOf(k Key) (*run, error) {
	r, ok := s.runs[k]
	if !ok {
		return nil, fmt.Errorf("session %s of task %s: %w", k.Stage, k.TaskID, ErrNotFound)
	}
	return r, nil
}

// persistRecord writes the session row, stamping the update time.
func (s *Service) persistRecord(ctx context.Context, r *run) error {
	r.rec.UpdatedAt = s.now().UTC()
	if err := s.sessions.Update(ctx, r.rec); err != nil {
		s.log.Error("update session failed", "task", r.task.ID, "error", err)
		return err
	}
	return nil
}

// appendLocked adds an entry to the end of the conversation, persists it and
// emits it. The caller holds the mutex.
func (s *Service) appendLocked(ctx context.Context, r *run, e Entry, n *notes) *Entry {
	entry := r.newEntry(s, e)
	r.entries = append(r.entries, entry)
	r.byID[entry.ID] = entry
	if err := s.entries.Insert(ctx, r.rec.ID, *entry); err != nil {
		s.log.Error("insert entry failed", "task", r.task.ID, "entry", entry.ID, "error", err)
	}
	n.entry(r.key(), entry)
	return entry
}

// updateLocked persists a changed entry and emits it. The caller holds the
// mutex.
func (s *Service) updateLocked(ctx context.Context, r *run, e *Entry, n *notes) {
	if err := s.entries.Update(ctx, *e); err != nil {
		s.log.Error("update entry failed", "task", r.task.ID, "entry", e.ID, "error", err)
	}
	n.entry(r.key(), e)
}

// bgCtx bounds the database work of the session's own goroutines.
func bgCtx() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), persistTimeout)
}

// notes collects the callbacks an operation owes, so that they run once the
// mutex is released: OnState and OnTranscript are never called with it held.
type notes struct {
	states []Key
	events []TranscriptEvent
}

// state notes that the summary of a session changed.
func (n *notes) state(k Key) {
	if !slices.Contains(n.states, k) {
		n.states = append(n.states, k)
	}
}

// entry notes that an entry was created or changed, with a copy of it as it
// is now.
func (n *notes) entry(k Key, e *Entry) {
	c := cloneEntry(e)
	n.events = append(n.events, event(k, TranscriptEvent{Kind: EventEntry, Entry: &c, EntryID: e.ID}))
}

// text notes the current text of a streaming entry.
func (n *notes) text(k Key, entryID, text string) {
	n.events = append(n.events, event(k, TranscriptEvent{Kind: EventText, EntryID: entryID, Text: text}))
}

// remove notes that an entry was deleted.
func (n *notes) remove(k Key, entryID string) {
	n.events = append(n.events, event(k, TranscriptEvent{Kind: EventRemove, EntryID: entryID}))
}

// reset notes that a conversation has to be read again whole.
func (n *notes) reset(k Key) {
	n.events = append(n.events, event(k, TranscriptEvent{Kind: EventReset}))
}

// event stamps the session an event belongs to.
func event(k Key, ev TranscriptEvent) TranscriptEvent {
	ev.TaskID, ev.Stage = k.TaskID, k.Stage
	return ev
}

// flush runs the callbacks an operation collected. It must be called after
// the mutex is released.
func (s *Service) flush(n *notes) {
	if s.onTranscript != nil {
		for _, ev := range n.events {
			s.onTranscript(ev)
		}
	}
	if s.onState != nil {
		for _, k := range n.states {
			s.onState(k)
		}
	}
}

// cloneEntry copies an entry and its payload, so that a reader outside the
// mutex never shares memory with the live conversation.
func cloneEntry(e *Entry) Entry {
	c := *e
	if e.User != nil {
		v := *e.User
		c.User = &v
	}
	if e.Assistant != nil {
		v := *e.Assistant
		c.Assistant = &v
	}
	if e.Action != nil {
		v := *e.Action
		c.Action = &v
	}
	if e.Permission != nil {
		v := *e.Permission
		c.Permission = &v
	}
	if e.Question != nil {
		v := *e.Question
		c.Question = &v
	}
	if e.Marker != nil {
		v := *e.Marker
		c.Marker = &v
	}
	if e.Error != nil {
		v := *e.Error
		c.Error = &v
	}
	return c
}

// cloneEntries copies a list of entries.
func cloneEntries(entries []*Entry) []Entry {
	out := make([]Entry, 0, len(entries))
	for _, e := range entries {
		out = append(out, cloneEntry(e))
	}
	return out
}

// contextPercent is how full the context window is, 0 until the first result
// of the session says how large the window is.
func contextPercent(tokens, window int) int {
	if window <= 0 {
		return 0
	}
	return int(math.Round(100 * float64(tokens) / float64(window)))
}
