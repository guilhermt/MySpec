package session_test

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/claude"
	"github.com/guilhermt/myspec/internal/claude/claudetest"
	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/session"
)

func TestStartEchoesTheRenderedPrompt(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	info := taskInfo(t, "t1")
	f.start(t, info)

	sum := f.waitIdle(t, prd("t1"))
	if sum.ContextPercent <= 0 {
		t.Errorf("ContextPercent = %d, want > 0 after the first result", sum.ContextPercent)
	}
	if sum.TurnRunning || sum.PendingCount != 0 || sum.LastError != "" {
		t.Errorf("summary = %+v, want an idle session", sum)
	}

	tr := f.transcript(t, prd("t1"))
	if len(tr.Entries) != 3 {
		t.Fatalf("entries = %d, want the stage marker, the prompt and its answer", len(tr.Entries))
	}
	marker, user, assistant := tr.Entries[0], tr.Entries[1], tr.Entries[2]
	wantMarker := &session.MarkerEntry{Type: session.MarkerStageStarted, Stage: string(prompts.StagePRD)}
	if diff := cmp.Diff(wantMarker, marker.Marker); diff != "" {
		t.Errorf("stage marker mismatch (-want +got):\n%s", diff)
	}
	wantUser := &session.UserEntry{Text: info.InitialContext, Prompt: true}
	if diff := cmp.Diff(wantUser, user.User); diff != "" {
		t.Errorf("user entry mismatch (-want +got):\n%s", diff)
	}
	if user.TurnID != user.ID || assistant.TurnID != user.ID {
		t.Errorf("turn ids = %q, %q, want both %q", user.TurnID, assistant.TurnID, user.ID)
	}

	rendered, _ := renderPrompt(prompts.StagePRD, prompts.Vars{
		TaskName:       info.Name,
		ArtifactsDir:   info.ArtifactsDir,
		PRDPath:        info.PRDPath,
		InitialContext: info.InitialContext,
	})
	wantAssistant := &session.AssistantEntry{MessageID: "msg_fake_1", Text: rendered, Complete: true}
	if diff := cmp.Diff(wantAssistant, assistant.Assistant); diff != "" {
		t.Errorf("assistant entry mismatch (-want +got):\n%s", diff)
	}

	// The prompt was created pending and delivered right away: both versions
	// were emitted, and the final one is the one the transcript holds.
	events := f.eventsOf(prd("t1"), session.EventEntry)
	if len(events) < 4 {
		t.Fatalf("entry events = %d, want the marker, the pending prompt, its delivery and the answer", len(events))
	}
	if !events[1].Entry.User.Pending || events[2].Entry.User.Pending {
		t.Errorf("prompt events pending = %v, %v, want true then false",
			events[1].Entry.User.Pending, events[2].Entry.User.Pending)
	}
	last := events[len(events)-1].Entry
	if diff := cmp.Diff(assistant, *last); diff != "" {
		t.Errorf("last event mismatch (-want +got):\n%s", diff)
	}

	rec := f.sessions.get(t, "t1", string(prompts.StagePRD))
	if !rec.Started || rec.ContextWindow != claudetest.ContextWindow || rec.ID != tr.SessionID {
		t.Errorf("record = %+v, want started with the fake's window and id %s", rec, tr.SessionID)
	}
	starts := f.launcher.started()
	if len(starts) != 1 || starts[0].Resume || starts[0].SessionID != rec.ID || starts[0].Dir != info.Dir {
		t.Errorf("starts = %+v, want one fresh session %s in %s", starts, rec.ID, info.Dir)
	}
	if diff := cmp.Diff(tr.Entries, f.entries.list(t, tr.SessionID)); diff != "" {
		t.Errorf("stored entries mismatch (-memory +stored):\n%s", diff)
	}
}

func TestToolCallBecomesAnAction(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "tool")
	f.start(t, taskInfo(t, "t1"))
	f.waitIdle(t, prd("t1"))

	tr := f.transcript(t, prd("t1"))
	kinds := make([]session.Kind, 0, len(tr.Entries))
	for _, e := range tr.Entries {
		kinds = append(kinds, e.Kind)
	}
	want := []session.Kind{session.KindMarker, session.KindUser, session.KindAction, session.KindAssistant}
	if diff := cmp.Diff(want, kinds); diff != "" {
		t.Fatalf("kinds mismatch (-want +got):\n%s", diff)
	}

	wantAction := &session.ActionEntry{
		ToolUseID: "toolu_fake_3",
		Tool:      "Read",
		Label:     "Reading",
		Target:    claudetest.ReadPath,
		Status:    session.ActionDone,
	}
	if diff := cmp.Diff(wantAction, tr.Entries[2].Action); diff != "" {
		t.Errorf("action mismatch (-want +got):\n%s", diff)
	}
}

func TestCompactionAddsAMarker(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "compact")
	f.start(t, taskInfo(t, "t1"))
	f.waitIdle(t, prd("t1"))

	markers := f.entriesOf(t, prd("t1"), session.KindMarker)
	want := []*session.MarkerEntry{
		{Type: session.MarkerStageStarted, Stage: string(prompts.StagePRD)},
		{Type: session.MarkerCompacted, PreTokens: 120000},
	}
	got := make([]*session.MarkerEntry, 0, len(markers))
	for _, m := range markers {
		got = append(got, m.Marker)
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("markers mismatch (-want +got):\n%s", diff)
	}
}

// waitPermission starts a permission scenario and returns the pending request.
func waitPermission(t *testing.T, f *fixture) session.Entry {
	t.Helper()

	f.start(t, taskInfo(t, "t1"))
	sum := f.waitStatus(t, prd("t1"), "the permission request", func(s session.Summary) bool {
		return s.Status == session.StatusNeedsPermission
	})
	if !sum.TurnRunning {
		t.Errorf("TurnRunning = false, want true while the request is pending")
	}

	permissions := f.entriesOf(t, prd("t1"), session.KindPermission)
	if len(permissions) != 1 {
		t.Fatalf("permission entries = %d, want 1", len(permissions))
	}
	p := permissions[0].Permission
	if p.Tool != "Bash" || p.RequestID == "" || p.Status != session.PermissionPending {
		t.Fatalf("permission = %+v, want a pending Bash request", p)
	}
	if p.BlockedPath != claudetest.ReadPath || string(p.Suggestions) == "null" || string(p.Input) == "null" {
		t.Errorf("permission = %+v, want the blocked path, suggestions and input of the fake", p)
	}
	return permissions[0]
}

// finalText is the text of the last assistant entry of a session.
func finalText(t *testing.T, f *fixture, k session.Key) string {
	t.Helper()

	assistants := f.entriesOf(t, k, session.KindAssistant)
	if len(assistants) == 0 {
		t.Fatal("no assistant entry")
	}
	return assistants[len(assistants)-1].Assistant.Text
}

func TestAnswerPermission(t *testing.T) {
	t.Parallel()

	t.Run("allow", func(t *testing.T) {
		t.Parallel()

		f := newFixture(t, "permission")
		request := waitPermission(t, f)

		err := f.service.AnswerPermission(t.Context(), prd("t1"), request.Permission.RequestID, session.DecisionAllow, "")
		if err != nil {
			t.Fatalf("AnswerPermission() = %v, want nil", err)
		}
		f.waitIdle(t, prd("t1"))

		got := f.entriesOf(t, prd("t1"), session.KindPermission)[0].Permission
		if got.Status != session.PermissionAllowed || got.AnsweredAt == nil || got.DenyMessage != "" {
			t.Errorf("permission = %+v, want allowed with an answer time", got)
		}
		if text := finalText(t, f, prd("t1")); text != "done" {
			t.Errorf("final text = %q, want done", text)
		}
		actions := f.entriesOf(t, prd("t1"), session.KindAction)
		if len(actions) != 1 || actions[0].Action.Status != session.ActionDone {
			t.Errorf("actions = %+v, want one done Bash action", actions)
		}
	})

	t.Run("deny", func(t *testing.T) {
		t.Parallel()

		f := newFixture(t, "permission")
		request := waitPermission(t, f)

		err := f.service.AnswerPermission(t.Context(), prd("t1"), request.Permission.RequestID, session.DecisionDeny, "not now")
		if err != nil {
			t.Fatalf("AnswerPermission() = %v, want nil", err)
		}
		f.waitIdle(t, prd("t1"))

		got := f.entriesOf(t, prd("t1"), session.KindPermission)[0].Permission
		if got.Status != session.PermissionDenied || got.DenyMessage != "not now" {
			t.Errorf("permission = %+v, want denied with the message", got)
		}
		if text := finalText(t, f, prd("t1")); text != "denied: not now" {
			t.Errorf("final text = %q, want denied: not now", text)
		}
	})

	t.Run("allow for the session rewrites the suggestions", func(t *testing.T) {
		t.Parallel()

		f := newFixture(t, "permission")
		request := waitPermission(t, f)

		err := f.service.AnswerPermission(t.Context(), prd("t1"), request.Permission.RequestID, session.DecisionAllowSession, "")
		if err != nil {
			t.Fatalf("AnswerPermission() = %v, want nil", err)
		}
		f.waitIdle(t, prd("t1"))

		got := f.entriesOf(t, prd("t1"), session.KindPermission)[0].Permission
		if got.Status != session.PermissionAllowedSession {
			t.Errorf("status = %q, want allowed_session", got.Status)
		}

		text := finalText(t, f, prd("t1"))
		echoed, ok := strings.CutPrefix(text, "done ")
		if !ok {
			t.Fatalf("final text = %q, want the echoed permissions after done", text)
		}
		var suggestions []map[string]any
		if err := json.Unmarshal([]byte(echoed), &suggestions); err != nil {
			t.Fatalf("decode echoed permissions %q: %v", echoed, err)
		}
		if len(suggestions) != 2 {
			t.Fatalf("suggestions = %d, want the rule and the directory", len(suggestions))
		}
		for _, suggestion := range suggestions {
			if suggestion["destination"] != "session" {
				t.Errorf("suggestion %v, want destination session", suggestion)
			}
		}
	})

	t.Run("unknown request", func(t *testing.T) {
		t.Parallel()

		f := newFixture(t, "permission")
		waitPermission(t, f)

		err := f.service.AnswerPermission(t.Context(), prd("t1"), "nope", session.DecisionAllow, "")
		wantErrIs(t, err, session.ErrNoRequest)
		err = f.service.AnswerQuestion(t.Context(), prd("t1"), "nope", nil)
		wantErrIs(t, err, session.ErrNoRequest)
	})
}

func TestAnswerQuestion(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "question")
	f.start(t, taskInfo(t, "t1"))
	f.waitStatus(t, prd("t1"), "the question", func(s session.Summary) bool {
		return s.Status == session.StatusNeedsPermission
	})

	questions := f.entriesOf(t, prd("t1"), session.KindQuestion)
	if len(questions) != 1 {
		t.Fatalf("question entries = %d, want 1", len(questions))
	}
	q := questions[0].Question
	if len(q.Questions) != 2 || q.Questions[0].MultiSelect || !q.Questions[1].MultiSelect {
		t.Fatalf("questions = %+v, want two, the second multiple choice", q.Questions)
	}
	if q.Status != session.PermissionPending || q.Answers != nil {
		t.Errorf("question = %+v, want pending without answers", q)
	}
	if actions := f.entriesOf(t, prd("t1"), session.KindAction); len(actions) != 0 {
		t.Errorf("actions = %+v, want none for a question", actions)
	}

	answers := map[string]string{
		q.Questions[0].Question: "Red",
		q.Questions[1].Question: "Apple, Pear",
	}
	if err := f.service.AnswerQuestion(t.Context(), prd("t1"), q.RequestID, answers); err != nil {
		t.Fatalf("AnswerQuestion() = %v, want nil", err)
	}
	f.waitIdle(t, prd("t1"))

	got := f.entriesOf(t, prd("t1"), session.KindQuestion)[0].Question
	if got.Status != session.PermissionAllowed {
		t.Errorf("status = %q, want allowed", got.Status)
	}
	if diff := cmp.Diff(answers, got.Answers); diff != "" {
		t.Errorf("answers mismatch (-want +got):\n%s", diff)
	}
	var echoed map[string]string
	if err := json.Unmarshal([]byte(finalText(t, f, prd("t1"))), &echoed); err != nil {
		t.Fatalf("decode echoed answers: %v", err)
	}
	if diff := cmp.Diff(answers, echoed); diff != "" {
		t.Errorf("echoed answers mismatch (-want +got):\n%s", diff)
	}
}

// waitStreaming starts a slow scenario and waits until text is flowing.
func waitStreaming(t *testing.T, f *fixture, k session.Key) session.Entry {
	t.Helper()

	f.waitStatus(t, k, "the turn to run", func(s session.Summary) bool {
		return s.Status == session.StatusWorking && s.TurnRunning
	})
	assistants := f.waitEntries(t, k, session.KindAssistant, 1)
	entry := assistants[len(assistants)-1]
	waitFor(t, "streamed text", func() bool { return len(f.textsOf(k, entry.ID)) >= 2 })
	return entry
}

func TestInterruptEndsTheTurn(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "slow")
	f.start(t, taskInfo(t, "t1"))
	entry := waitStreaming(t, f, prd("t1"))

	if err := f.service.Interrupt(t.Context(), prd("t1")); err != nil {
		t.Fatalf("Interrupt() = %v, want nil", err)
	}
	f.waitIdle(t, prd("t1"))

	texts := f.textsOf(prd("t1"), entry.ID)
	for i := 1; i < len(texts); i++ {
		if !strings.HasPrefix(texts[i], texts[i-1]) || len(texts[i]) < len(texts[i-1]) {
			t.Errorf("text events %q then %q, want growing text", texts[i-1], texts[i])
		}
	}

	got := f.entriesOf(t, prd("t1"), session.KindAssistant)[0].Assistant
	if !got.Complete || !got.Interrupted || !strings.HasPrefix(got.Text, "tick ") {
		t.Errorf("assistant = %+v, want a complete, interrupted entry with the ticks", got)
	}
	if markers := f.entriesOf(t, prd("t1"), session.KindMarker); len(markers) != 1 {
		t.Errorf("markers = %+v, want only the stage marker when text was interrupted", markers)
	}

	// Interrupting an idle session does nothing.
	if err := f.service.Interrupt(t.Context(), prd("t1")); err != nil {
		t.Fatalf("Interrupt() on idle = %v, want nil", err)
	}

	f.send(t, prd("t1"), "again")
	f.waitEntries(t, prd("t1"), session.KindAssistant, 2)
	if starts := f.launcher.started(); len(starts) != 1 {
		t.Errorf("starts = %d, want the same process to take the next message", len(starts))
	}
}

func TestSendDuringATurnQueues(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "slow")
	f.start(t, taskInfo(t, "t1"))
	waitStreaming(t, f, prd("t1"))

	f.send(t, prd("t1"), "first")
	f.send(t, prd("t1"), "  second  ")
	tr := f.transcript(t, prd("t1"))
	if len(tr.Pending) != 2 || !tr.Pending[0].User.Pending || tr.Pending[1].User.Text != "second" {
		t.Fatalf("pending = %+v, want first and second, trimmed and pending", tr.Pending)
	}
	if sum := f.summary(t, prd("t1")); sum.PendingCount != 2 || sum.Status != session.StatusWorking {
		t.Errorf("summary = %+v, want two pending while working", sum)
	}

	first := tr.Pending[0].ID
	if err := f.service.RemovePending(t.Context(), prd("t1"), first); err != nil {
		t.Fatalf("RemovePending() = %v, want nil", err)
	}
	wantErrIs(t, f.service.RemovePending(t.Context(), prd("t1"), first), session.ErrNotPending)
	if sum := f.summary(t, prd("t1")); sum.PendingCount != 1 {
		t.Errorf("PendingCount = %d, want 1 after the removal", sum.PendingCount)
	}
	removes := f.eventsOf(prd("t1"), session.EventRemove)
	if len(removes) != 1 || removes[0].EntryID != first {
		t.Errorf("remove events = %+v, want one for %s", removes, first)
	}

	if err := f.service.Interrupt(t.Context(), prd("t1")); err != nil {
		t.Fatalf("Interrupt() = %v, want nil", err)
	}
	sum := f.waitStatus(t, prd("t1"), "the pending message to go out", func(s session.Summary) bool {
		return s.PendingCount == 0 && s.TurnRunning
	})
	if sum.Status != session.StatusWorking {
		t.Errorf("status = %q, want working on the queued message", sum.Status)
	}

	tr = f.transcript(t, prd("t1"))
	users := f.entriesOf(t, prd("t1"), session.KindUser)
	if len(users) != 2 || users[1].User.Text != "second" || users[1].User.Pending {
		t.Errorf("users = %+v, want the prompt then second, delivered", users)
	}
	last := tr.Entries[len(tr.Entries)-1]
	if last.Kind == session.KindUser && last.Seq <= tr.Entries[len(tr.Entries)-2].Seq {
		t.Errorf("delivered message seq = %d, want after the interrupted answer", last.Seq)
	}
	if err := f.service.RemovePending(t.Context(), prd("t1"), users[1].ID); !errors.Is(err, session.ErrNotPending) {
		t.Errorf("RemovePending(delivered) = %v, want ErrNotPending", err)
	}
}

func TestCrashIsReportedAndRetried(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "crash")
	f.start(t, taskInfo(t, "t1"))

	sum := f.waitStatus(t, prd("t1"), "the crash", func(s session.Summary) bool {
		return s.Status == session.StatusError
	})
	if sum.ProcessRunning || sum.TurnRunning {
		t.Errorf("summary = %+v, want no process and no turn after the crash", sum)
	}
	if !strings.Contains(sum.LastError, "exited with code 2") || !strings.Contains(sum.LastError, "boom") {
		t.Errorf("LastError = %q, want the exit code and stderr", sum.LastError)
	}

	errs := f.entriesOf(t, prd("t1"), session.KindError)
	if len(errs) != 1 {
		t.Fatalf("error entries = %d, want 1", len(errs))
	}
	want := &session.ErrorEntry{Kind: session.ErrorProcessExit, Message: sum.LastError, Retryable: true}
	if diff := cmp.Diff(want, errs[0].Error); diff != "" {
		t.Errorf("error entry mismatch (-want +got):\n%s", diff)
	}
	markers := f.entriesOf(t, prd("t1"), session.KindMarker)
	if len(markers) != 2 || markers[1].Marker.Type != session.MarkerInterrupted {
		t.Errorf("markers = %+v, want the interrupted marker of a turn without text", markers)
	}
	if rec := f.sessions.get(t, "t1", string(prompts.StagePRD)); rec.LastError != sum.LastError || !rec.Started {
		t.Errorf("record = %+v, want the error persisted on a started session", rec)
	}

	if err := f.service.Retry(t.Context(), prd("t1")); err != nil {
		t.Fatalf("Retry() = %v, want nil", err)
	}
	sum = f.waitIdle(t, prd("t1"))
	if sum.LastError != "" {
		t.Errorf("LastError = %q, want cleared", sum.LastError)
	}
	starts := f.launcher.started()
	if len(starts) != 2 || !starts[1].Resume || starts[1].SessionID != starts[0].SessionID {
		t.Errorf("starts = %+v, want a resumed second process", starts)
	}
}

func TestPauseStopsAndResumeContinues(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "slow")
	f.start(t, taskInfo(t, "t1"))
	waitStreaming(t, f, prd("t1"))

	if err := f.service.Pause(t.Context(), prd("t1")); err != nil {
		t.Fatalf("Pause() = %v, want nil", err)
	}
	sum := f.waitStatus(t, prd("t1"), "the process to stop", func(s session.Summary) bool {
		return s.Status == session.StatusPaused && !s.ProcessRunning
	})
	if sum.TurnRunning {
		t.Errorf("TurnRunning = true, want false after the pause")
	}
	got := f.entriesOf(t, prd("t1"), session.KindAssistant)[0].Assistant
	if !got.Complete || !got.Interrupted {
		t.Errorf("assistant = %+v, want completed as interrupted", got)
	}
	wantErrIs(t, f.service.Send(t.Context(), prd("t1"), "later"), session.ErrPaused)
	if rec := f.sessions.get(t, "t1", string(prompts.StagePRD)); !rec.Paused {
		t.Errorf("record paused = false, want true")
	}

	if err := f.service.Resume(t.Context(), prd("t1")); err != nil {
		t.Fatalf("Resume() = %v, want nil", err)
	}
	sum = f.summary(t, prd("t1"))
	if sum.Status != session.StatusWaiting || sum.ProcessRunning {
		t.Errorf("summary = %+v, want waiting without a process until a message comes", sum)
	}

	f.send(t, prd("t1"), "more")
	f.waitStatus(t, prd("t1"), "the new turn", func(s session.Summary) bool {
		return s.Status == session.StatusWorking && s.ProcessRunning
	})
	starts := f.launcher.started()
	if len(starts) != 2 || !starts[1].Resume {
		t.Errorf("starts = %+v, want a resumed second process", starts)
	}
}

func TestIdleProcessStopsAndResumesOnDemand(t *testing.T) {
	t.Parallel()

	f := newFixtureWith(t, &fakeLauncher{scenario: "echo"}, 50*time.Millisecond)
	f.start(t, taskInfo(t, "t1"))

	f.waitStatus(t, prd("t1"), "the idle stop", func(s session.Summary) bool {
		return s.Status == session.StatusWaiting && !s.ProcessRunning
	})
	if errs := f.entriesOf(t, prd("t1"), session.KindError); len(errs) != 0 {
		t.Errorf("errors = %+v, want none for an expected exit", errs)
	}

	f.send(t, prd("t1"), "again please")
	f.waitIdle(t, prd("t1"))
	assistants := f.entriesOf(t, prd("t1"), session.KindAssistant)
	if len(assistants) != 2 || assistants[1].Assistant.Text != "again please" {
		t.Errorf("second answer = %q, want the echo of the message", assistants[1].Assistant.Text)
	}
	starts := f.launcher.started()
	if len(starts) != 2 || !starts[1].Resume {
		t.Errorf("starts = %+v, want a resumed second process", starts)
	}
}

func TestOpenReconcilesALeftoverTranscript(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	rec := session.Record{ID: "sess-1", TaskID: "t1", Stage: "prd", Started: true, CreatedAt: base, UpdatedAt: base}
	if err := f.sessions.Insert(t.Context(), rec); err != nil {
		t.Fatalf("Insert() = %v, want nil", err)
	}
	f.entries.seed(
		t, "sess-1",
		session.Entry{
			ID: "u1", Seq: 1, TurnID: "u1", Kind: session.KindUser, CreatedAt: base,
			User: &session.UserEntry{Text: "hello", Prompt: true},
		},
		session.Entry{
			ID: "a1", Seq: 2, TurnID: "u1", Kind: session.KindAssistant, CreatedAt: base,
			Assistant: &session.AssistantEntry{MessageID: "m1", Text: "half"},
		},
		session.Entry{
			ID: "c1", Seq: 3, TurnID: "u1", Kind: session.KindAction, CreatedAt: base,
			Action: &session.ActionEntry{ToolUseID: "x", Tool: "Bash", Label: "Running", Status: session.ActionRunning},
		},
		session.Entry{
			ID: "p1", Seq: 4, TurnID: "u1", Kind: session.KindPermission, CreatedAt: base,
			Permission: &session.PermissionEntry{
				RequestID: "r1", Tool: "Bash", Status: session.PermissionPending,
				Input: json.RawMessage("null"), Suggestions: json.RawMessage("null"),
			},
		},
		session.Entry{
			ID: "q1", Seq: 5, TurnID: "u1", Kind: session.KindQuestion, CreatedAt: base,
			Question: &session.QuestionEntry{RequestID: "r2", Status: session.PermissionPending},
		},
	)

	info := taskInfo(t, "t1")
	info.ArtifactExists = true
	f.open(t, info)

	tr := f.transcript(t, prd("t1"))
	if tr.SessionID != "sess-1" || len(tr.Entries) != 6 || len(tr.Pending) != 0 {
		t.Fatalf("transcript = %+v, want the five stored entries and the PRD marker", tr)
	}
	if a := tr.Entries[1].Assistant; !a.Complete || !a.Interrupted || a.Text != "half" {
		t.Errorf("assistant = %+v, want complete and interrupted", a)
	}
	if c := tr.Entries[2].Action; c.Status != session.ActionInterrupted {
		t.Errorf("action status = %q, want interrupted", c.Status)
	}
	if p := tr.Entries[3].Permission; p.Status != session.PermissionCancelled {
		t.Errorf("permission status = %q, want cancelled", p.Status)
	}
	if q := tr.Entries[4].Question; q.Status != session.PermissionCancelled {
		t.Errorf("question status = %q, want cancelled", q.Status)
	}
	if m := tr.Entries[5]; m.Kind != session.KindMarker || m.Marker.Type != session.MarkerPRDWritten || m.Seq != 6 {
		t.Errorf("last entry = %+v, want the prd_written marker at seq 6", m)
	}
	if diff := cmp.Diff(tr.Entries, f.entries.list(t, "sess-1")); diff != "" {
		t.Errorf("stored entries mismatch (-memory +stored):\n%s", diff)
	}

	sum := f.summary(t, prd("t1"))
	if sum.Status != session.StatusWaiting || sum.ProcessRunning {
		t.Errorf("summary = %+v, want waiting without a process", sum)
	}
	if starts := f.launcher.started(); len(starts) != 0 {
		t.Errorf("starts = %d, want none: opening a task never starts the CLI", len(starts))
	}

	// Opening again keeps the run and adds no second marker.
	f.open(t, info)
	if markers := f.entriesOf(t, prd("t1"), session.KindMarker); len(markers) != 1 {
		t.Errorf("markers = %d, want 1 after a second Open", len(markers))
	}
}

func TestOpenDeliversWhatWasQueued(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	rec := session.Record{
		ID: "sess-1", TaskID: "t1", Stage: "prd", Started: true, Paused: true,
		CreatedAt: base, UpdatedAt: base,
	}
	if err := f.sessions.Insert(t.Context(), rec); err != nil {
		t.Fatalf("Insert() = %v, want nil", err)
	}
	f.entries.seed(
		t, "sess-1",
		session.Entry{
			ID: "u1", Seq: 1, TurnID: "u1", Kind: session.KindUser, CreatedAt: base,
			User: &session.UserEntry{Text: "queued while paused", Pending: true},
		},
	)

	f.open(t, taskInfo(t, "t1"))
	sum := f.summary(t, prd("t1"))
	if sum.Status != session.StatusPaused || sum.PendingCount != 1 || sum.ProcessRunning {
		t.Errorf("summary = %+v, want paused with one pending and no process", sum)
	}

	if err := f.service.Resume(t.Context(), prd("t1")); err != nil {
		t.Fatalf("Resume() = %v, want nil", err)
	}
	sum = f.waitIdle(t, prd("t1"))
	if sum.PendingCount != 0 {
		t.Errorf("PendingCount = %d, want 0 once delivered", sum.PendingCount)
	}
	assistants := f.entriesOf(t, prd("t1"), session.KindAssistant)
	if len(assistants) != 1 || assistants[0].Assistant.Text != "queued while paused" {
		t.Errorf("assistants = %+v, want the echo of the queued message", assistants)
	}
	if starts := f.launcher.started(); len(starts) != 1 || !starts[0].Resume {
		t.Errorf("starts = %+v, want one resumed process", starts)
	}
}

func TestStartFailures(t *testing.T) {
	t.Parallel()

	cases := map[string]struct {
		launcher    *fakeLauncher
		wantKind    session.ErrorKind
		wantMessage string
	}{
		"not found": {
			launcher:    &fakeLauncher{scenario: "echo", locateErr: claude.ErrNotFound},
			wantKind:    session.ErrorNotFound,
			wantMessage: "Claude Code was not found",
		},
		"not logged in": {
			launcher:    &fakeLauncher{scenario: "echo", preflightErr: claude.ErrNotLoggedIn},
			wantKind:    session.ErrorNotLoggedIn,
			wantMessage: "Claude Code is not logged in",
		},
		"preflight failed": {
			launcher:    &fakeLauncher{scenario: "echo", preflightErr: errors.New("exec: permission denied")},
			wantKind:    session.ErrorStartFailed,
			wantMessage: "Could not check Claude Code: exec: permission denied",
		},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			f := newFixtureWith(t, tc.launcher, 0)
			f.start(t, taskInfo(t, "t1"))

			sum := f.summary(t, prd("t1"))
			if sum.Status != session.StatusError || sum.PendingCount != 1 || sum.ProcessRunning {
				t.Errorf("summary = %+v, want error with the prompt still pending", sum)
			}
			if !strings.HasPrefix(sum.LastError, tc.wantMessage) {
				t.Errorf("LastError = %q, want prefix %q", sum.LastError, tc.wantMessage)
			}
			errs := f.entriesOf(t, prd("t1"), session.KindError)
			if len(errs) != 1 || errs[0].Error.Kind != tc.wantKind || !errs[0].Error.Retryable {
				t.Fatalf("errors = %+v, want one retryable %s", errs, tc.wantKind)
			}

			tc.launcher.fix()
			if err := f.service.Retry(t.Context(), prd("t1")); err != nil {
				t.Fatalf("Retry() = %v, want nil", err)
			}
			sum = f.waitIdle(t, prd("t1"))
			if sum.LastError != "" || sum.PendingCount != 0 {
				t.Errorf("summary = %+v, want the prompt delivered and the error gone", sum)
			}
		})
	}
}

func TestShutdownStopsEveryProcess(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	f.start(t, taskInfo(t, "t1"))
	f.start(t, taskInfo(t, "t2"))
	f.waitIdle(t, prd("t1"))
	f.waitIdle(t, prd("t2"))

	ctx, cancel := context.WithTimeout(t.Context(), pollTimeout)
	defer cancel()
	began := time.Now()
	f.service.Shutdown(ctx)
	if elapsed := time.Since(began); elapsed > pollTimeout {
		t.Errorf("Shutdown took %s, want within %s", elapsed, pollTimeout)
	}

	for id, sum := range f.service.Summaries() {
		if sum.ProcessRunning || sum.Status != session.StatusWaiting {
			t.Errorf("summary of %s = %+v, want waiting without a process", id, sum)
		}
	}
	if got := len(f.service.Summaries()); got != 2 {
		t.Errorf("summaries = %d, want both tasks still known", got)
	}
}

func TestCloseForgetsTheTask(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "slow")
	f.start(t, taskInfo(t, "t1"))
	waitStreaming(t, f, prd("t1"))

	if err := f.service.Close(t.Context(), prd("t1")); err != nil {
		t.Fatalf("Close() = %v, want nil", err)
	}
	if _, ok := f.service.Summary(prd("t1")); ok {
		t.Error("Summary() found the task after Close")
	}
	_, err := f.service.Transcript(t.Context(), prd("t1"))
	wantErrIs(t, err, session.ErrNotFound)
	wantErrIs(t, f.service.Send(t.Context(), prd("t1"), "hi"), session.ErrNotFound)

	// Closing what is not open is not an error.
	if err := f.service.Close(t.Context(), prd("t1")); err != nil {
		t.Errorf("Close() again = %v, want nil", err)
	}
}

func TestSendValidation(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	f.open(t, taskInfo(t, "t1"))

	wantErrIs(t, f.service.Send(t.Context(), prd("t1"), "   "), session.ErrEmptyMessage)
	wantErrIs(t, f.service.Send(t.Context(), prd("missing"), "hi"), session.ErrNotFound)
	wantErrIs(t, f.service.Pause(t.Context(), prd("missing")), session.ErrNotFound)
	wantErrIs(t, f.service.Resume(t.Context(), prd("missing")), session.ErrNotFound)
	wantErrIs(t, f.service.Retry(t.Context(), prd("missing")), session.ErrNotFound)
	wantErrIs(t, f.service.Interrupt(t.Context(), prd("missing")), session.ErrNotFound)
	wantErrIs(t, f.service.RemovePending(t.Context(), prd("missing"), "x"), session.ErrNotFound)
	if starts := f.launcher.started(); len(starts) != 0 {
		t.Errorf("starts = %d, want none", len(starts))
	}
}

func TestMarkArtifact(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	f.start(t, taskInfo(t, "t1"))
	f.waitIdle(t, prd("t1"))
	before := f.stateCount(prd("t1"))

	for _, kind := range []session.ArtifactKind{session.ArtifactPRD, session.ArtifactTechSpec, session.ArtifactPlan} {
		f.service.MarkArtifact(t.Context(), prd("t1"), kind, true)
		f.service.MarkArtifact(t.Context(), prd("t1"), kind, false)
	}
	f.service.MarkArtifact(t.Context(), prd("missing"), session.ArtifactPRD, true)

	markers := f.entriesOf(t, prd("t1"), session.KindMarker)
	want := []session.MarkerType{
		session.MarkerStageStarted,
		session.MarkerPRDWritten, session.MarkerPRDUpdated,
		session.MarkerTechSpecWritten, session.MarkerTechSpecUpdated,
		session.MarkerPlanWritten, session.MarkerPlanUpdated,
	}
	got := make([]session.MarkerType, 0, len(markers))
	for _, m := range markers {
		got = append(got, m.Marker.Type)
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("markers mismatch (-want +got):\n%s", diff)
	}
	events := f.eventsOf(prd("t1"), session.EventEntry)
	if last := events[len(events)-1].Entry; last.Kind != session.KindMarker || last.Marker.Type != session.MarkerPlanUpdated {
		t.Errorf("last event = %+v, want the plan_updated marker", last)
	}
	if after := f.stateCount(prd("t1")); after != before {
		t.Errorf("OnState ran %d times for a marker, want 0", after-before)
	}
}

func TestMarkPRReview(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	f.start(t, taskInfo(t, "t1"))
	f.waitIdle(t, prd("t1"))

	f.service.MarkPRReview(t.Context(), prd("t1"), 2)
	f.service.MarkPRReview(t.Context(), prd("missing"), 1)

	markers := f.entriesOf(t, prd("t1"), session.KindMarker)
	last := markers[len(markers)-1].Marker
	if last.Type != session.MarkerPRReviewWritten || last.Pass != 2 {
		t.Errorf("marker = %+v, want the pass of the review that was written", last)
	}
}

func TestStartOfALaterStageSendsItsPromptWithoutTheInitialContext(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	info := atStage(taskInfo(t, "t1"), prompts.StageTechSpec)
	f.start(t, info)
	f.waitIdle(t, info.Key())

	tr := f.transcript(t, info.Key())
	if tr.Stage != string(prompts.StageTechSpec) {
		t.Errorf("transcript stage = %q, want %q", tr.Stage, prompts.StageTechSpec)
	}
	if len(tr.Entries) != 3 {
		t.Fatalf("entries = %d, want the stage marker, the prompt and its answer", len(tr.Entries))
	}
	wantMarker := &session.MarkerEntry{Type: session.MarkerStageStarted, Stage: string(prompts.StageTechSpec)}
	if diff := cmp.Diff(wantMarker, tr.Entries[0].Marker); diff != "" {
		t.Errorf("stage marker mismatch (-want +got):\n%s", diff)
	}
	// What the user typed belongs to the PRD alone; a later stage reads the
	// artifacts instead, so its user entry is empty.
	wantUser := &session.UserEntry{Prompt: true}
	if diff := cmp.Diff(wantUser, tr.Entries[1].User); diff != "" {
		t.Errorf("user entry mismatch (-want +got):\n%s", diff)
	}
	rendered, _ := renderPrompt(prompts.StageTechSpec, prompts.Vars{
		TaskName:     info.Name,
		ArtifactsDir: info.ArtifactsDir,
		PRDPath:      info.PRDPath,
	})
	if got := tr.Entries[2].Assistant.Text; got != rendered {
		t.Errorf("prompt sent = %q, want %q", got, rendered)
	}
}

func TestStartAgainMarksTheStageAsRestarted(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	info := taskInfo(t, "t1")
	f.start(t, info)
	f.waitIdle(t, prd("t1"))

	if err := f.service.Start(t.Context(), info, true); err != nil {
		t.Fatalf("Start() = %v, want nil", err)
	}

	markers := f.entriesOf(t, prd("t1"), session.KindMarker)
	if len(markers) != 2 {
		t.Fatalf("markers = %d, want one per start", len(markers))
	}
	if m := markers[1].Marker; m.Type != session.MarkerStageStarted || !m.Restarted {
		t.Errorf("second marker = %+v, want a restarted stage_started", m)
	}
}

func TestOpenInAnotherStageKeepsBothSessions(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	info := taskInfo(t, "t1")
	f.start(t, info)
	f.waitIdle(t, prd("t1"))
	first := f.transcript(t, prd("t1"))

	spec := atStage(info, prompts.StageTechSpec)
	f.open(t, spec)

	tr := f.transcript(t, spec.Key())
	if tr.Stage != string(prompts.StageTechSpec) {
		t.Errorf("stage = %q, want %q", tr.Stage, prompts.StageTechSpec)
	}
	if tr.SessionID == first.SessionID {
		t.Errorf("session id = %q, want a session of its own for the new stage", tr.SessionID)
	}
	if len(tr.Entries) != 0 {
		t.Errorf("entries = %+v, want an empty conversation", tr.Entries)
	}
	if sum := f.summary(t, spec.Key()); sum.Stage != string(prompts.StageTechSpec) || sum.ProcessRunning {
		t.Errorf("summary = %+v, want the new stage with no process", sum)
	}

	// The PRD session is untouched: the new stage did not close it.
	if got := f.transcript(t, prd("t1")); got.SessionID != first.SessionID || len(got.Entries) != len(first.Entries) {
		t.Errorf("PRD transcript = %+v, want the one that was already there", got)
	}
	// Only the conversation that just loaded is told to read itself again.
	if resets := f.eventsOf(spec.Key(), session.EventReset); len(resets) != 1 {
		t.Errorf("reset events of the new stage = %d, want one", len(resets))
	}
	if resets := f.eventsOf(prd("t1"), session.EventReset); len(resets) != 1 {
		t.Errorf("reset events of the PRD = %d, want the one of its own load", len(resets))
	}
}

func TestTwoLiveSessionsOfATaskDoNotInterfere(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	info := taskInfo(t, "t1")
	f.start(t, info)
	spec := atStage(info, prompts.StageTechSpec)
	f.start(t, spec)
	f.waitIdle(t, prd("t1"))
	f.waitIdle(t, spec.Key())

	f.send(t, prd("t1"), "for the prd")
	f.waitIdle(t, prd("t1"))

	// The message reached one conversation and only that one.
	if users := f.entriesOf(t, prd("t1"), session.KindUser); len(users) != 2 {
		t.Errorf("PRD user entries = %d, want the prompt and the message", len(users))
	}
	if users := f.entriesOf(t, spec.Key(), session.KindUser); len(users) != 1 {
		t.Errorf("tech spec user entries = %d, want its prompt alone", len(users))
	}

	// Pausing one leaves the other free to take messages.
	if err := f.service.Pause(t.Context(), prd("t1")); err != nil {
		t.Fatalf("Pause() = %v, want nil", err)
	}
	wantErrIs(t, f.service.Send(t.Context(), prd("t1"), "held"), session.ErrPaused)
	f.send(t, spec.Key(), "for the tech spec")
	f.waitIdle(t, spec.Key())
	if users := f.entriesOf(t, spec.Key(), session.KindUser); len(users) != 2 {
		t.Errorf("tech spec user entries = %d, want the prompt and the message", len(users))
	}

	// Closing one leaves the other open.
	if err := f.service.Close(t.Context(), spec.Key()); err != nil {
		t.Fatalf("Close() = %v, want nil", err)
	}
	if _, ok := f.service.Summary(spec.Key()); ok {
		t.Error("Summary() found the tech spec session after Close")
	}
	if _, ok := f.service.Summary(prd("t1")); !ok {
		t.Error("Summary() lost the PRD session, want it still open")
	}
}

func TestCloseTaskClosesEverySessionOfIt(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	info := taskInfo(t, "t1")
	f.start(t, info)
	f.start(t, atStage(info, prompts.StageTechSpec))
	f.start(t, taskInfo(t, "t2"))

	if err := f.service.CloseTask(t.Context(), "t1"); err != nil {
		t.Fatalf("CloseTask() = %v, want nil", err)
	}

	summaries := f.service.Summaries()
	if len(summaries) != 1 {
		t.Fatalf("summaries = %+v, want only the session of the other task", summaries)
	}
	if _, ok := summaries[prd("t2")]; !ok {
		t.Errorf("summaries = %+v, want the session of t2", summaries)
	}
}

func TestSendFromAppMarksTheMessageWithoutCountingIt(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	f.start(t, taskInfo(t, "t1"))
	f.waitIdle(t, prd("t1"))

	if err := f.service.SendFromApp(t.Context(), prd("t1"), "  commit what is staged  "); err != nil {
		t.Fatalf("SendFromApp() = %v, want nil", err)
	}
	f.waitIdle(t, prd("t1"))

	users := f.entriesOf(t, prd("t1"), session.KindUser)
	if len(users) != 2 {
		t.Fatalf("user entries = %d, want the prompt and the message of the app", len(users))
	}
	want := &session.UserEntry{Text: "commit what is staged", App: true}
	if diff := cmp.Diff(want, users[1].User); diff != "" {
		t.Errorf("app entry mismatch (-want +got):\n%s", diff)
	}
	// A message of the app is not a correction of what the agent produced.
	if sum := f.summary(t, prd("t1")); sum.Corrections != 0 {
		t.Errorf("Corrections = %d, want none", sum.Corrections)
	}
	if rec := f.sessions.get(t, "t1", string(prompts.StagePRD)); rec.Corrections != 0 {
		t.Errorf("stored corrections = %d, want none", rec.Corrections)
	}
	wantErrIs(t, f.service.SendFromApp(t.Context(), prd("t1"), "   "), session.ErrEmptyMessage)
}

func TestSendCorrectionMarksTheMessageAndCountsIt(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	f.start(t, taskInfo(t, "t1"))
	f.waitIdle(t, prd("t1"))

	if err := f.service.SendCorrection(t.Context(), prd("t1"), "  fix the plan  "); err != nil {
		t.Fatalf("SendCorrection() = %v, want nil", err)
	}
	f.waitIdle(t, prd("t1"))

	users := f.entriesOf(t, prd("t1"), session.KindUser)
	if len(users) != 2 {
		t.Fatalf("user entries = %d, want the prompt and the correction", len(users))
	}
	want := &session.UserEntry{Text: "fix the plan", App: true}
	if diff := cmp.Diff(want, users[1].User); diff != "" {
		t.Errorf("correction entry mismatch (-want +got):\n%s", diff)
	}
	if sum := f.summary(t, prd("t1")); sum.Corrections != 1 {
		t.Errorf("Corrections = %d, want 1", sum.Corrections)
	}
	if rec := f.sessions.get(t, "t1", string(prompts.StagePRD)); rec.Corrections != 1 {
		t.Errorf("stored corrections = %d, want 1", rec.Corrections)
	}
	wantErrIs(t, f.service.SendCorrection(t.Context(), prd("t1"), "   "), session.ErrEmptyMessage)
}

func TestDiscardClosesTheRunAndDropsTheRecords(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	info := taskInfo(t, "t1")
	f.start(t, info)
	f.waitIdle(t, prd("t1"))

	// A stage the task never reached is discarded just the same.
	stages := []string{string(prompts.StagePRD), string(prompts.StagePlan)}
	if err := f.service.Discard(t.Context(), "t1", stages...); err != nil {
		t.Fatalf("Discard() = %v, want nil", err)
	}

	if _, ok := f.service.Summary(prd("t1")); ok {
		t.Error("Summary() found a run, want the session closed")
	}
	if _, err := f.sessions.Get(t.Context(), "t1", string(prompts.StagePRD)); !errors.Is(err, session.ErrNotFound) {
		t.Errorf("Get() = %v, want session.ErrNotFound", err)
	}

	// Starting the stage again builds a conversation from scratch.
	f.start(t, info)
	if tr := f.transcript(t, prd("t1")); len(tr.Entries) != 2 {
		t.Errorf("entries = %d, want the stage marker and the prompt of a fresh session", len(tr.Entries))
	}
}

func TestSummaryIsIdleOnlyAtRest(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "slow")
	info := taskInfo(t, "t1")
	f.start(t, info)

	// A turn in flight is not rest.
	f.waitStatus(t, prd("t1"), "the turn to start", func(s session.Summary) bool { return s.TurnRunning })
	if sum := f.summary(t, prd("t1")); sum.Idle {
		t.Error("Idle = true while a turn runs, want false")
	}

	// Nor is a message still queued behind it.
	f.send(t, prd("t1"), "next")
	sum := f.summary(t, prd("t1"))
	if sum.PendingCount != 1 || sum.Idle {
		t.Errorf("summary = %+v, want a queued message and Idle false", sum)
	}
	pending := f.transcript(t, prd("t1")).Pending[0]
	if err := f.service.RemovePending(t.Context(), prd("t1"), pending.ID); err != nil {
		t.Fatalf("RemovePending() = %v, want nil", err)
	}

	// With the turn interrupted and the queue empty, the session is at rest.
	if err := f.service.Interrupt(t.Context(), prd("t1")); err != nil {
		t.Fatalf("Interrupt() = %v, want nil", err)
	}
	if sum := f.waitIdle(t, prd("t1")); !sum.Idle {
		t.Errorf("summary = %+v, want Idle true", sum)
	}

	// A paused session is not rest.
	if err := f.service.Pause(t.Context(), prd("t1")); err != nil {
		t.Fatalf("Pause() = %v, want nil", err)
	}
	if sum := f.summary(t, prd("t1")); sum.Idle {
		t.Error("Idle = true while paused, want false")
	}
	if err := f.service.Resume(t.Context(), prd("t1")); err != nil {
		t.Fatalf("Resume() = %v, want nil", err)
	}
	waitFor(t, "the session to come back", func() bool { return f.summary(t, prd("t1")).Idle })

	// Nor is one holding an error.
	broken := newFixtureWith(t, &fakeLauncher{scenario: "echo", locateErr: claude.ErrNotFound}, 0)
	broken.start(t, taskInfo(t, "t2"))
	if sum := broken.summary(t, prd("t2")); sum.Idle || sum.Status != session.StatusError {
		t.Errorf("summary = %+v, want an error and Idle false", sum)
	}
}

func TestStepStageIsTheSessionKeyOfAStep(t *testing.T) {
	t.Parallel()

	if got := session.StepStage(7); got != "step:7" {
		t.Errorf("StepStage(7) = %q, want %q", got, "step:7")
	}
	for _, tc := range []struct {
		stage  string
		number int
		ok     bool
	}{
		{stage: "step:1", number: 1, ok: true},
		{stage: "step:12", number: 12, ok: true},
		{stage: "prd", number: 0, ok: false},
		{stage: "step:", number: 0, ok: false},
		{stage: "step:x", number: 0, ok: false},
		{stage: "step:0", number: 0, ok: false},
		{stage: "step:-1", number: 0, ok: false},
	} {
		number, ok := session.ParseStepStage(tc.stage)
		if number != tc.number || ok != tc.ok {
			t.Errorf("ParseStepStage(%q) = %d, %v, want %d, %v", tc.stage, number, ok, tc.number, tc.ok)
		}
	}
}

func TestPRStagesAreTheSessionKeysOfARepository(t *testing.T) {
	t.Parallel()

	if got := session.PRStage("apps-web"); got != "pr:apps-web" {
		t.Errorf("PRStage() = %q, want %q", got, "pr:apps-web")
	}
	if got := session.PRReviewStage("apps-web"); got != "pr_review:apps-web" {
		t.Errorf("PRReviewStage() = %q, want %q", got, "pr_review:apps-web")
	}
	for _, tc := range []struct {
		stage  string
		slug   string
		review bool
		ok     bool
	}{
		{stage: "pr:api", slug: "api", ok: true},
		{stage: "pr_review:api", slug: "api", review: true, ok: true},
		// The review key is read as a review, never as a PR of a repository
		// called "review:api".
		{stage: "pr_review:apps-web", slug: "apps-web", review: true, ok: true},
		{stage: "pr:", ok: false},
		{stage: "pr_review:", ok: false},
		{stage: "prd", ok: false},
		{stage: "step:1", ok: false},
	} {
		slug, review, ok := session.ParsePRStage(tc.stage)
		if slug != tc.slug || review != tc.review || ok != tc.ok {
			t.Errorf("ParsePRStage(%q) = %q, %v, %v, want %q, %v, %v",
				tc.stage, slug, review, ok, tc.slug, tc.review, tc.ok)
		}
	}
}

func TestStartOfAStepSendsTheStepFileVerbatim(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	// The step file carries a placeholder to prove nothing is replaced in it.
	content := "# Task 1: Step one\n\nWrite {{task_name}} as it is.\n"
	info := atStep(t, taskInfo(t, "t1"), 1, content)
	f.start(t, info)
	f.waitIdle(t, info.Key())

	tr := f.transcript(t, info.Key())
	if tr.Stage != "step:1" {
		t.Errorf("transcript stage = %q, want %q", tr.Stage, "step:1")
	}
	if len(tr.Entries) != 3 {
		t.Fatalf("entries = %d, want the step marker, the prompt and its answer", len(tr.Entries))
	}
	wantMarker := &session.MarkerEntry{Type: session.MarkerStepStarted, Step: 1}
	if diff := cmp.Diff(wantMarker, tr.Entries[0].Marker); diff != "" {
		t.Errorf("step marker mismatch (-want +got):\n%s", diff)
	}
	if got := tr.Entries[2].Assistant.Text; got != content {
		t.Errorf("prompt sent = %q, want the step file %q", got, content)
	}

	if rec := f.sessions.get(t, "t1", "step:1"); rec.Stage != "step:1" || rec.ID != tr.SessionID {
		t.Errorf("record = %+v, want the session of step:1 with id %s", rec, tr.SessionID)
	}
	if sum := f.summary(t, info.Key()); sum.Stage != "step:1" {
		t.Errorf("summary stage = %q, want %q", sum.Stage, "step:1")
	}
	// The CLI runs in the worktree of the step, not in the task directory.
	if started := f.launcher.started(); len(started) != 1 || started[0].Dir != info.Dir {
		t.Errorf("started = %+v, want one process in %s", started, info.Dir)
	}
}

func TestStartOfAStepAgainMarksItAsRestarted(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	info := atStep(t, taskInfo(t, "t1"), 2, "# Task 2\n")
	f.start(t, info)
	f.waitIdle(t, info.Key())
	if err := f.service.Start(t.Context(), info, true); err != nil {
		t.Fatalf("Start() = %v, want nil", err)
	}

	markers := f.entriesOf(t, info.Key(), session.KindMarker)
	if len(markers) != 2 {
		t.Fatalf("markers = %d, want one per start", len(markers))
	}
	wantMarker := &session.MarkerEntry{Type: session.MarkerStepStarted, Step: 2, Restarted: true}
	if diff := cmp.Diff(wantMarker, markers[1].Marker); diff != "" {
		t.Errorf("step marker mismatch (-want +got):\n%s", diff)
	}
}

func TestDiscardOfAStepClosesTheRunAndDropsTheRecord(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	info := atStep(t, taskInfo(t, "t1"), 1, "# Task 1\n")
	f.start(t, info)
	f.waitIdle(t, info.Key())

	if err := f.service.Discard(t.Context(), "t1", session.StepStage(1)); err != nil {
		t.Fatalf("Discard() = %v, want nil", err)
	}
	if _, ok := f.service.Summary(info.Key()); ok {
		t.Error("Summary() found a run, want the session closed")
	}
	if _, err := f.sessions.Get(t.Context(), "t1", "step:1"); !errors.Is(err, session.ErrNotFound) {
		t.Errorf("Get() = %v, want session.ErrNotFound", err)
	}
}
