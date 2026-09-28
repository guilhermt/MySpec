package session_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/claude"
	"github.com/guilhermt/myspec/internal/claude/claudetest"
	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/models"
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
		return s.Status == session.StatusNeedsAnswer
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

func TestAFailedTurnIsReportedUntilTheNextOne(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "turn_error")
	f.start(t, taskInfo(t, "t1"))

	// The CLI survives a failed turn: the session is at rest, and only the
	// summary says how the turn ended.
	sum := f.waitStatus(t, prd("t1"), "the failed turn", func(s session.Summary) bool {
		return s.Idle && s.TurnFailed
	})
	if sum.Status != session.StatusWaiting || sum.LastError != "" || !sum.ProcessRunning {
		t.Errorf("summary = %+v, want waiting on a live process with no session error", sum)
	}
	errs := f.entriesOf(t, prd("t1"), session.KindError)
	if len(errs) != 1 {
		t.Fatalf("error entries = %d, want the one of the turn", len(errs))
	}
	want := &session.ErrorEntry{Kind: session.ErrorTurn, Message: "API Error: overloaded"}
	if diff := cmp.Diff(want, errs[0].Error); diff != "" {
		t.Errorf("error entry mismatch (-want +got):\n%s", diff)
	}

	// The next turn is not the failed one any more, from the moment it starts.
	f.send(t, prd("t1"), "try again")
	if sum = f.summary(t, prd("t1")); sum.TurnFailed {
		t.Errorf("summary = %+v, want TurnFailed false once the next turn runs", sum)
	}
	f.waitStatus(t, prd("t1"), "the next turn to end", func(s session.Summary) bool {
		return s.Idle && !s.TurnFailed
	})
	if text := finalText(t, f, prd("t1")); text != "try again" {
		t.Errorf("final text = %q, want the echo of the message", text)
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

func TestPausingASessionRecordsWhenItWasPaused(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "slow")
	f.open(t, taskInfo(t, "t1"))
	f.advance(time.Minute)

	if err := f.service.Pause(t.Context(), prd("t1")); err != nil {
		t.Fatalf("Pause() = %v, want nil", err)
	}
	want := base.Add(time.Minute)
	if got := f.summary(t, prd("t1")).PausedAt; !got.Equal(want) {
		t.Errorf("summary PausedAt = %v, want %v", got, want)
	}
	if got := f.sessions.get(t, "t1", string(prompts.StagePRD)).PausedAt; !got.Equal(want) {
		t.Errorf("record PausedAt = %v, want %v", got, want)
	}
}

func TestPausingAPausedSessionKeepsTheFirstTime(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "slow")
	f.open(t, taskInfo(t, "t1"))
	for range 2 {
		if err := f.service.Pause(t.Context(), prd("t1")); err != nil {
			t.Fatalf("Pause() = %v, want nil", err)
		}
		f.advance(time.Minute)
	}

	if got := f.summary(t, prd("t1")).PausedAt; !got.Equal(base) {
		t.Errorf("PausedAt = %v, want the first pause %v", got, base)
	}
}

func TestResumingASessionClearsThePauseTime(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "slow")
	f.open(t, taskInfo(t, "t1"))
	if err := f.service.Pause(t.Context(), prd("t1")); err != nil {
		t.Fatalf("Pause() = %v, want nil", err)
	}
	if err := f.service.Resume(t.Context(), prd("t1")); err != nil {
		t.Fatalf("Resume() = %v, want nil", err)
	}

	if got := f.summary(t, prd("t1")).PausedAt; !got.IsZero() {
		t.Errorf("summary PausedAt = %v, want zero", got)
	}
	if got := f.sessions.get(t, "t1", string(prompts.StagePRD)).PausedAt; !got.IsZero() {
		t.Errorf("record PausedAt = %v, want zero", got)
	}
}

func TestAPausedSessionKeepsItsPauseTimeAcrossARestart(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "slow")
	f.open(t, taskInfo(t, "t1"))
	if err := f.service.Pause(t.Context(), prd("t1")); err != nil {
		t.Fatalf("Pause() = %v, want nil", err)
	}

	next := f.restart(t)
	next.advance(time.Hour)
	next.open(t, taskInfo(t, "t1"))
	sum := next.summary(t, prd("t1"))
	if sum.Status != session.StatusPaused || !sum.PausedAt.Equal(base) {
		t.Errorf("summary = %v at %v, want paused at %v", sum.Status, sum.PausedAt, base)
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

func TestLastReplyIsTheLastMessageOfTheLastTurn(t *testing.T) {
	t.Parallel()

	// conversation is a turn the agent ended with a message of two blocks; the
	// ids carry the task, since every session shares the entry repository.
	conversation := func(taskID string) []session.Entry {
		id := func(name string) string { return taskID + "-" + name }
		return []session.Entry{
			{
				ID: id("u1"), Seq: 1, TurnID: id("u1"), Kind: session.KindUser, CreatedAt: base,
				User: &session.UserEntry{Text: "implement the step"},
			},
			{
				ID: id("a1"), Seq: 2, TurnID: id("u1"), Kind: session.KindAssistant, CreatedAt: base,
				Assistant: &session.AssistantEntry{MessageID: "m1", Text: "Reading the code", Complete: true},
			},
			{
				ID: id("c1"), Seq: 3, TurnID: id("u1"), Kind: session.KindAction, CreatedAt: base,
				Action: &session.ActionEntry{ToolUseID: "x", Tool: "Read", Label: "Reading", Status: session.ActionDone},
			},
			{
				ID: id("a2"), Seq: 4, TurnID: id("u1"), Kind: session.KindAssistant, CreatedAt: base,
				Assistant: &session.AssistantEntry{MessageID: "m2", Text: "Done.", Complete: true},
			},
			{
				ID: id("a3"), Seq: 5, TurnID: id("u1"), Kind: session.KindAssistant, CreatedAt: base,
				Assistant: &session.AssistantEntry{MessageID: "m2", BlockIndex: 1, Text: "Two findings contested.", Complete: true},
			},
		}
	}
	// The same conversation, with a message the agent has not answered yet.
	unanswered := append(conversation("t2"), session.Entry{
		ID: "t2-u2", Seq: 6, TurnID: "t2-u2", Kind: session.KindUser, CreatedAt: base,
		User: &session.UserEntry{Text: "one more thing"},
	})

	f := newFixture(t, "echo")
	for taskID, entries := range map[string][]session.Entry{"t1": conversation("t1"), "t2": unanswered} {
		rec := session.Record{ID: "sess-" + taskID, TaskID: taskID, Stage: "prd", Started: true, CreatedAt: base, UpdatedAt: base}
		if err := f.sessions.Insert(t.Context(), rec); err != nil {
			t.Fatalf("Insert() = %v, want nil", err)
		}
		f.entries.seed(t, rec.ID, entries...)
		f.open(t, taskInfo(t, taskID))
	}

	if got, want := f.service.LastReply(prd("t1")), "Done.\n\nTwo findings contested."; got != want {
		t.Errorf("LastReply() = %q, want %q", got, want)
	}
	if got := f.service.LastReply(prd("t2")); got != "" {
		t.Errorf("LastReply() after an unanswered message = %q, want nothing", got)
	}
	if got := f.service.LastReply(prd("missing")); got != "" {
		t.Errorf("LastReply() of a session that is not open = %q, want nothing", got)
	}
}

func TestOpenReadsAFailedTurnFromTheTranscript(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		last session.Entry // what follows the failure of the turn
		want bool
	}{
		{
			name: "a marker after the failure",
			last: session.Entry{
				ID: "m1", Seq: 3, TurnID: "u1", Kind: session.KindMarker, CreatedAt: base,
				Marker: &session.MarkerEntry{Type: session.MarkerPRDWritten},
			},
			want: true,
		},
		{
			name: "an answer after the failure",
			last: session.Entry{
				ID: "a1", Seq: 3, TurnID: "u1", Kind: session.KindAssistant, CreatedAt: base,
				Assistant: &session.AssistantEntry{MessageID: "m1", Text: "done", Complete: true},
			},
			want: false,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t, "echo")
			rec := session.Record{
				ID: "sess-1", TaskID: "t1", Stage: "prd", Started: true, CreatedAt: base, UpdatedAt: base,
			}
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
					ID: "e1", Seq: 2, TurnID: "u1", Kind: session.KindError, CreatedAt: base,
					Error: &session.ErrorEntry{Kind: session.ErrorTurn, Message: "API Error: overloaded"},
				},
				test.last,
			)

			f.open(t, taskInfo(t, "t1"))

			sum := f.summary(t, prd("t1"))
			if sum.TurnFailed != test.want {
				t.Errorf("TurnFailed = %v, want %v", sum.TurnFailed, test.want)
			}
			if !sum.Idle {
				t.Errorf("summary = %+v, want the session at rest", sum)
			}
		})
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
	wantErrIs(t, f.service.Send(t.Context(), prd("t1"), "hi"), session.ErrNotFound)

	// Closing what is not open is not an error.
	if err := f.service.Close(t.Context(), prd("t1")); err != nil {
		t.Errorf("Close() again = %v, want nil", err)
	}
}

func TestASessionExistsFromItsCreationUntilItIsThrownAway(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	exists := func(when string, want bool) {
		t.Helper()

		got, err := f.service.Exists(t.Context(), prd("t1"))
		if err != nil {
			t.Fatalf("Exists() %s = %v, want nil", when, err)
		}
		if got != want {
			t.Errorf("Exists() %s = %v, want %v", when, got, want)
		}
	}

	exists("before anything", false)
	if _, ok := f.service.Summary(prd("t1")); ok {
		t.Error("Exists() opened the session")
	}
	f.open(t, taskInfo(t, "t1"))
	exists("once open", true)
	// A closed session is still recorded, as one a previous run left is.
	if err := f.service.Close(t.Context(), prd("t1")); err != nil {
		t.Fatalf("Close() = %v, want nil", err)
	}
	exists("once closed", true)
	if err := f.service.DiscardTask(t.Context(), "t1"); err != nil {
		t.Fatalf("DiscardTask() = %v, want nil", err)
	}
	exists("once thrown away", false)
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

	kinds := []session.ArtifactKind{
		session.ArtifactPRD, session.ArtifactTechSpec, session.ArtifactPlan, session.ArtifactOneShot,
	}
	for _, kind := range kinds {
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
		session.MarkerOneShotWritten, session.MarkerOneShotUpdated,
	}
	got := make([]session.MarkerType, 0, len(markers))
	for _, m := range markers {
		got = append(got, m.Marker.Type)
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("markers mismatch (-want +got):\n%s", diff)
	}
	events := f.eventsOf(prd("t1"), session.EventEntry)
	if last := events[len(events)-1].Entry; last.Kind != session.KindMarker || last.Marker.Type != session.MarkerOneShotUpdated {
		t.Errorf("last event = %+v, want the one_shot_updated marker", last)
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

func TestMarkStepReview(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	f.start(t, taskInfo(t, "t1"))
	f.waitIdle(t, prd("t1"))

	f.service.MarkStepReview(t.Context(), prd("t1"), 2, true)
	f.service.MarkStepReview(t.Context(), prd("missing"), 1, false)

	markers := f.entriesOf(t, prd("t1"), session.KindMarker)
	want := &session.MarkerEntry{Type: session.MarkerStepReviewWritten, Pass: 2, Clean: true}
	if diff := cmp.Diff(want, markers[len(markers)-1].Marker); diff != "" {
		t.Errorf("marker mismatch (-want +got):\n%s", diff)
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

func TestThePullRequestPromptOfATaskWithACardCarriesTheCard(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	info := atStage(taskInfo(t, "t1"), prompts.StagePR)
	info.Branch = "login-screen"
	info.BaseBranch = "main"
	info.Card = "## Add the login screen\n\nEmail and password."
	info.CardReference = "dev/web#12"
	f.start(t, info)
	f.waitIdle(t, info.Key())

	tr := f.transcript(t, info.Key())
	if len(tr.Entries) != 3 {
		t.Fatalf("entries = %d, want the stage marker, the prompt and its answer", len(tr.Entries))
	}
	rendered, _ := renderPrompt(prompts.StagePR, prompts.Vars{
		TaskName:      info.Name,
		Branch:        info.Branch,
		BaseBranch:    info.BaseBranch,
		Card:          info.Card,
		CardReference: info.CardReference,
	})
	if got := tr.Entries[2].Assistant.Text; got != rendered {
		t.Errorf("prompt sent = %q, want %q", got, rendered)
	}
}

func TestStartOfTheOneShotPlanningSendsItsPromptWithTheInitialContext(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	info := atOneShot(taskInfo(t, "t1"))
	f.start(t, info)
	f.waitIdle(t, info.Key())

	tr := f.transcript(t, info.Key())
	if len(tr.Entries) != 3 {
		t.Fatalf("entries = %d, want the stage marker, the prompt and its answer", len(tr.Entries))
	}
	wantMarker := &session.MarkerEntry{Type: session.MarkerStageStarted, Stage: string(prompts.StageOneShot)}
	if diff := cmp.Diff(wantMarker, tr.Entries[0].Marker); diff != "" {
		t.Errorf("stage marker mismatch (-want +got):\n%s", diff)
	}
	// The planning of a One-Shot task opens the task, as the PRD does: it
	// carries what the user wrote when they created it.
	wantUser := &session.UserEntry{Text: info.InitialContext, Prompt: true}
	if diff := cmp.Diff(wantUser, tr.Entries[1].User); diff != "" {
		t.Errorf("user entry mismatch (-want +got):\n%s", diff)
	}
	rendered, _ := renderPrompt(prompts.StageOneShot, prompts.Vars{
		TaskName:       info.Name,
		OneShotPath:    info.OneShotPath,
		Repository:     info.Repository,
		InitialContext: info.InitialContext,
	})
	if got := tr.Entries[2].Assistant.Text; got != rendered {
		t.Errorf("prompt sent = %q, want %q", got, rendered)
	}
}

func TestOpenOfAOneShotPlanningWithItsDocumentMarksItWritten(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	info := atOneShot(taskInfo(t, "t1"))
	info.ArtifactExists = true
	f.open(t, info)

	markers := f.entriesOf(t, info.Key(), session.KindMarker)
	if len(markers) != 1 || markers[0].Marker.Type != session.MarkerOneShotWritten {
		t.Errorf("markers = %+v, want the one_shot_written marker alone", markers)
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

func TestDiscardTaskStopsTheSessionsAndThrowsThemAway(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	info := taskInfo(t, "t1")
	f.start(t, info)
	f.start(t, atStage(info, prompts.StageTechSpec))
	f.start(t, taskInfo(t, "t2"))
	f.waitIdle(t, prd("t1"))

	if err := f.service.DiscardTask(t.Context(), "t1"); err != nil {
		t.Fatalf("DiscardTask() = %v, want nil", err)
	}

	if _, ok := f.service.Summary(prd("t1")); ok {
		t.Error("Summary() found a run, want every session of the task closed")
	}
	_, err := f.service.Transcript(t.Context(), prd("t1"))
	wantErrIs(t, err, session.ErrNotFound)
	for _, stage := range []prompts.Stage{prompts.StagePRD, prompts.StageTechSpec} {
		if _, getErr := f.sessions.Get(t.Context(), "t1", string(stage)); !errors.Is(getErr, session.ErrNotFound) {
			t.Errorf("Get(%s) = %v, want session.ErrNotFound", stage, getErr)
		}
	}

	// Only the task that was archived goes; another one keeps its conversation.
	if _, ok := f.service.Summary(prd("t2")); !ok {
		t.Error("Summary() lost the session of the other task")
	}
	if _, getErr := f.sessions.Get(t.Context(), "t2", string(prompts.StagePRD)); getErr != nil {
		t.Errorf("Get(t2) = %v, want nil", getErr)
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

func TestStepReviewStageIsTheSessionKeyOfTheReviewerOfAStep(t *testing.T) {
	t.Parallel()

	stage := session.StepReviewStage(3)
	if stage != "step_review:3" {
		t.Errorf("StepReviewStage(3) = %q, want %q", stage, "step_review:3")
	}
	if number, ok := session.ParseStepReviewStage(stage); number != 3 || !ok {
		t.Errorf("ParseStepReviewStage(%q) = %d, %v, want 3, true", stage, number, ok)
	}
	for _, other := range []string{"step:3", "step_review:0", "step_review:x"} {
		if number, ok := session.ParseStepReviewStage(other); number != 0 || ok {
			t.Errorf("ParseStepReviewStage(%q) = %d, %v, want 0, false", other, number, ok)
		}
	}
	// The key of a reviewer is never read as the key of a step.
	if number, ok := session.ParseStepStage(stage); number != 0 || ok {
		t.Errorf("ParseStepStage(%q) = %d, %v, want 0, false", stage, number, ok)
	}
}

func TestThePRStagesAreTheSessionKeysOfTheTask(t *testing.T) {
	t.Parallel()

	if session.PRStage != "pr" {
		t.Errorf("PRStage = %q, want %q", session.PRStage, "pr")
	}
	if session.PRReviewStage != "pr_review" {
		t.Errorf("PRReviewStage = %q, want %q", session.PRReviewStage, "pr_review")
	}
	// Neither key is ever read as the key of a step or of a reviewer.
	if number, ok := session.ParseStepStage(session.PRStage); number != 0 || ok {
		t.Errorf("ParseStepStage(%q) = %d, %v, want 0, false", session.PRStage, number, ok)
	}
	if number, ok := session.ParseStepReviewStage(session.PRReviewStage); number != 0 || ok {
		t.Errorf("ParseStepReviewStage(%q) = %d, %v, want 0, false", session.PRReviewStage, number, ok)
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

func TestStartOfAStepReviewSendsThePromptWithTheReplyOfTheImplementer(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	const reply = "I added the store."
	info := atStepReview(t, taskInfo(t, "t1"), 2, reply)
	f.start(t, info)
	f.waitIdle(t, info.Key())

	tr := f.transcript(t, info.Key())
	if tr.Stage != "step_review:2" {
		t.Errorf("transcript stage = %q, want %q", tr.Stage, "step_review:2")
	}
	if len(tr.Entries) != 3 {
		t.Fatalf("entries = %d, want the review marker, the prompt and its answer", len(tr.Entries))
	}
	wantMarker := &session.MarkerEntry{Type: session.MarkerStepReviewStarted, Step: 2}
	if diff := cmp.Diff(wantMarker, tr.Entries[0].Marker); diff != "" {
		t.Errorf("review marker mismatch (-want +got):\n%s", diff)
	}
	// What the implementer said reaches the reviewer from the app.
	wantUser := &session.UserEntry{Text: reply, Prompt: true, App: true}
	if diff := cmp.Diff(wantUser, tr.Entries[1].User); diff != "" {
		t.Errorf("user entry mismatch (-want +got):\n%s", diff)
	}
	rendered, _ := renderPrompt(prompts.StageStepReview, prompts.Vars{StepPath: info.StepPath, ImplementerReply: reply})
	if got := tr.Entries[2].Assistant.Text; got != rendered {
		t.Errorf("prompt sent = %q, want %q", got, rendered)
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

// setChoice changes the model and effort of a session, failing the test when
// the service refuses it.
func (f *fixture) setChoice(t *testing.T, k session.Key, c models.Choice) {
	t.Helper()

	if err := f.service.SetChoice(t.Context(), k, c); err != nil {
		t.Fatalf("SetChoice(%v, %+v) = %v, want nil", k, c, err)
	}
}

// waitStarts waits until the launcher has started n processes and returns them.
func (f *fixture) waitStarts(t *testing.T, n int) []claude.Config {
	t.Helper()

	var starts []claude.Config
	waitFor(t, fmt.Sprintf("%d started processes", n), func() bool {
		starts = f.launcher.started()
		return len(starts) >= n
	})
	return starts
}

func TestStartRunsWithTheModelAndEffortOfTheStage(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	info := taskInfo(t, "t1")
	f.start(t, info)

	starts := f.launcher.started()
	if len(starts) != 1 {
		t.Fatalf("starts = %d, want one", len(starts))
	}
	if starts[0].Model != "claude-opus-5-5[1m]" || starts[0].Effort != "high" {
		t.Errorf("start = %q and %q, want claude-opus-5-5[1m] and high", starts[0].Model, starts[0].Effort)
	}
	if got := f.summary(t, prd("t1")).Choice; got != info.Choice {
		t.Errorf("Choice = %+v, want %+v", got, info.Choice)
	}
}

func TestAChangeOfModelTakesANewProcessOnTheNextMessage(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	f.start(t, taskInfo(t, "t1"))
	f.waitIdle(t, prd("t1"))

	want := models.Choice{Model: models.Fable51, Effort: models.XHigh}
	f.setChoice(t, prd("t1"), want)
	sum := f.summary(t, prd("t1"))
	if sum.Choice != want || !sum.ProcessRunning {
		t.Errorf("summary = %+v, want the new choice with the process still up", sum)
	}
	if starts := f.launcher.started(); len(starts) != 1 {
		t.Fatalf("starts = %d, want the process left alone until a message", len(starts))
	}

	f.send(t, prd("t1"), "with more effort")
	starts := f.waitStarts(t, 2)
	f.waitIdle(t, prd("t1"))

	if len(starts) != 2 {
		t.Fatalf("starts = %d, want a second process", len(starts))
	}
	second := starts[1]
	if second.Model != "claude-fable-5-1" || second.Effort != "xhigh" || !second.Resume {
		t.Errorf("second start = %+v, want claude-fable-5-1 and xhigh, resumed", second)
	}
	assistants := f.entriesOf(t, prd("t1"), session.KindAssistant)
	if len(assistants) != 2 || assistants[1].Assistant.Text != "with more effort" {
		t.Errorf("answers = %+v, want the echo of the message on the new process", assistants)
	}
	if errs := f.entriesOf(t, prd("t1"), session.KindError); len(errs) != 0 {
		t.Errorf("errors = %+v, want none: the restart is an expected stop", errs)
	}
}

func TestAChangeWithoutAMessageLeavesTheProcessAlone(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	f.start(t, taskInfo(t, "t1"))
	f.waitIdle(t, prd("t1"))

	f.setChoice(t, prd("t1"), models.Choice{Model: models.Sonnet5, Effort: models.Medium})

	// Nothing is expected to happen, so there is nothing to wait for.
	time.Sleep(200 * time.Millisecond)

	if starts := f.launcher.started(); len(starts) != 1 {
		t.Errorf("starts = %d, want the one process a change alone never replaces", len(starts))
	}
	if sum := f.summary(t, prd("t1")); !sum.ProcessRunning {
		t.Errorf("summary = %+v, want the process still running", sum)
	}
}

func TestAChangeDuringATurnWaitsForTheTurnToEnd(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "slow")
	f.start(t, taskInfo(t, "t1"))
	f.waitStatus(t, prd("t1"), "the turn to run", func(s session.Summary) bool { return s.TurnRunning })

	f.setChoice(t, prd("t1"), models.Choice{Model: models.Sonnet5, Effort: models.Low})
	f.send(t, prd("t1"), "take this one over")
	if starts := f.launcher.started(); len(starts) != 1 {
		t.Fatalf("starts = %d, want the running turn untouched", len(starts))
	}

	if err := f.service.Interrupt(t.Context(), prd("t1")); err != nil {
		t.Fatalf("Interrupt() = %v, want nil", err)
	}
	starts := f.waitStarts(t, 2)
	if starts[1].Model != "claude-sonnet-5" || starts[1].Effort != "low" {
		t.Errorf("second start = %+v, want claude-sonnet-5 and low", starts[1])
	}
}

func TestAChangeWhilePausedIsWhatTheResumedProcessRunsWith(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	f.start(t, taskInfo(t, "t1"))
	f.waitIdle(t, prd("t1"))

	if err := f.service.Pause(t.Context(), prd("t1")); err != nil {
		t.Fatalf("Pause() = %v, want nil", err)
	}
	f.waitStatus(t, prd("t1"), "the process to stop", func(s session.Summary) bool { return !s.ProcessRunning })

	f.setChoice(t, prd("t1"), models.Choice{Model: models.Fable51, Effort: models.Max})
	if err := f.service.Resume(t.Context(), prd("t1")); err != nil {
		t.Fatalf("Resume() = %v, want nil", err)
	}
	f.send(t, prd("t1"), "back to work")
	f.waitIdle(t, prd("t1"))

	starts := f.launcher.started()
	last := starts[len(starts)-1]
	if last.Model != "claude-fable-5-1" || last.Effort != "max" {
		t.Errorf("last start = %+v, want claude-fable-5-1 and max", last)
	}
}

func TestSetChoiceOfTheSameChoiceChangesNothing(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	info := taskInfo(t, "t1")
	f.open(t, info)

	before := f.stateCount(prd("t1"))
	f.setChoice(t, prd("t1"), info.Choice)
	if got := f.stateCount(prd("t1")); got != before {
		t.Errorf("OnState calls = %d, want the %d of before the no-op change", got, before)
	}
}

func TestOpenKeepsTheChoiceOfAnExistingSession(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	want := models.Choice{Model: models.Sonnet5, Effort: models.Low}
	rec := session.Record{
		ID: "sess-1", TaskID: "t1", Stage: "prd", Choice: want, CreatedAt: base, UpdatedAt: base,
	}
	if err := f.sessions.Insert(t.Context(), rec); err != nil {
		t.Fatalf("Insert() = %v, want nil", err)
	}

	f.open(t, taskInfo(t, "t1"))

	if got := f.summary(t, prd("t1")).Choice; got != want {
		t.Errorf("Choice = %+v, want the %+v the session was stored with", got, want)
	}
}

func TestOpenGivesASessionWithoutAChoiceTheOneOfItsStage(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	rec := session.Record{ID: "sess-1", TaskID: "t1", Stage: "prd", CreatedAt: base, UpdatedAt: base}
	if err := f.sessions.Insert(t.Context(), rec); err != nil {
		t.Fatalf("Insert() = %v, want nil", err)
	}

	info := taskInfo(t, "t1")
	f.open(t, info)

	if got := f.summary(t, prd("t1")).Choice; got != info.Choice {
		t.Errorf("Choice = %+v, want the %+v of the stage", got, info.Choice)
	}
	if got := f.sessions.get(t, "t1", "prd").Choice; got != info.Choice {
		t.Errorf("stored choice = %+v, want the %+v of the stage", got, info.Choice)
	}
}

func TestSetChoiceOfASessionThatIsNotOpenIsNotFound(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")

	err := f.service.SetChoice(t.Context(), prd("t1"), models.Choice{Model: models.Opus55, Effort: models.Low})
	wantErrIs(t, err, session.ErrNotFound)
}

func TestStartOfADiscussionMarksItSendsTheInitialContextAndOpensTheClones(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	info := atDiscussion(t, taskInfo(t, "d1"))
	f.start(t, info)
	f.waitIdle(t, info.Key())

	tr := f.transcript(t, info.Key())
	if tr.Stage != session.DiscussionStage {
		t.Errorf("transcript stage = %q, want %q", tr.Stage, session.DiscussionStage)
	}
	if len(tr.Entries) != 3 {
		t.Fatalf("entries = %d, want the discussion marker, the prompt and its answer", len(tr.Entries))
	}
	wantMarker := &session.MarkerEntry{Type: session.MarkerDiscussionStarted}
	if diff := cmp.Diff(wantMarker, tr.Entries[0].Marker); diff != "" {
		t.Errorf("marker mismatch (-want +got):\n%s", diff)
	}
	// The initial context of the discussion reads in the conversation as the
	// first message of the user, as the one of a task does.
	wantUser := &session.UserEntry{Text: info.InitialContext, Prompt: true}
	if diff := cmp.Diff(wantUser, tr.Entries[1].User); diff != "" {
		t.Errorf("user entry mismatch (-want +got):\n%s", diff)
	}
	rendered, _ := renderPrompt(prompts.StageDiscussion, prompts.Vars{
		TaskName:       info.Name,
		ArtifactsDir:   info.ArtifactsDir,
		PRDPath:        info.PRDPath,
		InitialContext: info.InitialContext,
	})
	if got := tr.Entries[2].Assistant.Text; got != rendered {
		t.Errorf("prompt sent = %q, want %q", got, rendered)
	}
	started := f.launcher.started()
	if len(started) != 1 {
		t.Fatalf("starts = %d, want the one of the discussion", len(started))
	}
	// The agent reads the code of the board in the clones, which reach the CLI
	// as --add-dir.
	if diff := cmp.Diff(info.ExtraDirs, started[0].ExtraDirs); diff != "" {
		t.Errorf("clones opened mismatch (-want +got):\n%s", diff)
	}
}

func TestStartOfAReviewOfAPullRequestMarksItAndSendsWhatTheUserWroteForThePass(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	info := atReview(taskInfo(t, "r1"))
	f.start(t, info)
	f.waitIdle(t, info.Key())

	tr := f.transcript(t, info.Key())
	if tr.Stage != session.ReviewStage {
		t.Errorf("transcript stage = %q, want %q", tr.Stage, session.ReviewStage)
	}
	if len(tr.Entries) != 3 {
		t.Fatalf("entries = %d, want the review marker, the prompt and its answer", len(tr.Entries))
	}
	wantMarker := &session.MarkerEntry{Type: session.MarkerReviewStarted}
	if diff := cmp.Diff(wantMarker, tr.Entries[0].Marker); diff != "" {
		t.Errorf("marker mismatch (-want +got):\n%s", diff)
	}
	// What the user wrote for the pass reads in the conversation as their first
	// message, as the initial context of a task does.
	wantUser := &session.UserEntry{Text: info.PassInstructions, Prompt: true}
	if diff := cmp.Diff(wantUser, tr.Entries[1].User); diff != "" {
		t.Errorf("user entry mismatch (-want +got):\n%s", diff)
	}
	rendered, _ := renderPrompt(prompts.StagePRReview, prompts.Vars{
		ContextPath:      info.ContextPath,
		External:         info.External,
		Publish:          info.Publish,
		Instructions:     info.Instructions,
		PassInstructions: info.PassInstructions,
	})
	if got := tr.Entries[2].Assistant.Text; got != rendered {
		t.Errorf("prompt sent = %q, want %q", got, rendered)
	}
}

func TestStartOfAReviewOfAPullRequestSendsWhatTheAppReadFromGitHub(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	info := atReview(taskInfo(t, "r1"))
	info.MergeBase = "origin/main"
	info.Checks = &gh.PRChecks{
		Checks:    []gh.Check{{Name: "test", URL: "https://ci.example.com/2", Conclusion: "failure"}},
		Mergeable: gh.MergeableConflicting,
	}
	f.start(t, info)
	f.waitIdle(t, info.Key())

	tr := f.transcript(t, info.Key())
	if len(tr.Entries) != 3 {
		t.Fatalf("entries = %d, want the review marker, the prompt and its answer", len(tr.Entries))
	}
	want := "\n\n## GitHub status\n\n" + prompts.PRChecksSection(info.Checks, info.MergeBase)
	if got := tr.Entries[2].Assistant.Text; !strings.Contains(got, want) {
		t.Errorf("prompt sent = %q, want it to contain %q", got, want)
	}
}

// readLabel is the label every action of the actions scenario carries.
var readLabel, _ = session.For("Read", nil, "")

// waitAction waits until the action in progress of a session has the target.
func waitAction(t *testing.T, f *fixture, k session.Key, target string) session.Summary {
	t.Helper()

	return f.waitStatus(t, k, "the action on "+target, func(s session.Summary) bool {
		return s.ActionTarget == target
	})
}

func TestATurnStartsWhenItsMessageGoesToTheCLI(t *testing.T) {
	t.Parallel()

	f, open := newGatedFixture(t)
	f.start(t, taskInfo(t, "t1"))
	if sum := waitAction(t, f, prd("t1"), claudetest.ReadPath); !sum.TurnStartedAt.Equal(base) {
		t.Errorf("TurnStartedAt = %v, want %v, when the prompt went out", sum.TurnStartedAt, base)
	}

	f.advance(time.Minute)
	f.send(t, prd("t1"), "queued")
	f.advance(time.Minute)
	open("1-1", "1-2", "1-3", "1-4")

	sum := f.waitStatus(t, prd("t1"), "the queued message to go out", func(s session.Summary) bool {
		return s.PendingCount == 0 && s.ActionTarget == claudetest.ReadPath
	})
	if want := base.Add(2 * time.Minute); !sum.TurnStartedAt.Equal(want) {
		t.Errorf("TurnStartedAt = %v, want %v, when the queued message went out", sum.TurnStartedAt, want)
	}
}

func TestAnActionRunsFromItsStartToItsResult(t *testing.T) {
	t.Parallel()

	f, open := newGatedFixture(t)
	f.start(t, taskInfo(t, "t1"))
	sum := waitAction(t, f, prd("t1"), claudetest.ReadPath)
	if sum.ActionLabel != readLabel {
		t.Errorf("ActionLabel = %q, want %q", sum.ActionLabel, readLabel)
	}

	open("1-1", "1-2", "1-3")
	sum = f.waitStatus(t, prd("t1"), "no action after both results", func(s session.Summary) bool {
		return s.ActionLabel == "" && s.ActionTarget == ""
	})
	if !sum.TurnRunning {
		t.Errorf("summary = %+v, want a running turn with no action after both results", sum)
	}
}

func TestTheLastOfTwoRunningActionsIsTheOneInProgress(t *testing.T) {
	t.Parallel()

	f, open := newGatedFixture(t)
	f.start(t, taskInfo(t, "t1"))
	waitAction(t, f, prd("t1"), claudetest.ReadPath)

	open("1-1")
	waitAction(t, f, prd("t1"), claudetest.SecondReadPath)

	open("1-2")
	if sum := waitAction(t, f, prd("t1"), claudetest.ReadPath); sum.ActionLabel != readLabel {
		t.Errorf("ActionLabel = %q, want %q when the first read goes on", sum.ActionLabel, readLabel)
	}
}

func TestATurnWithoutActionHasNoAction(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "slow")
	f.start(t, taskInfo(t, "t1"))
	waitStreaming(t, f, prd("t1"))

	sum := f.summary(t, prd("t1"))
	if !sum.TurnStartedAt.Equal(base) || sum.ActionLabel != "" || sum.ActionTarget != "" {
		t.Errorf("summary = %+v, want the turn started at %v and no action", sum, base)
	}
}

func TestAnInterruptedTurnLeavesNeitherTurnNorAction(t *testing.T) {
	t.Parallel()

	f, _ := newGatedFixture(t)
	f.start(t, taskInfo(t, "t1"))
	waitAction(t, f, prd("t1"), claudetest.ReadPath)

	if err := f.service.Interrupt(t.Context(), prd("t1")); err != nil {
		t.Fatalf("Interrupt() = %v, want nil", err)
	}
	sum := f.waitIdle(t, prd("t1"))
	if !sum.TurnStartedAt.IsZero() || sum.ActionLabel != "" || sum.ActionTarget != "" {
		t.Errorf("summary = %+v, want neither turn nor action", sum)
	}
}

func TestTheStartAndTheEndOfAnActionReportTheState(t *testing.T) {
	t.Parallel()

	f, open := newGatedFixture(t)
	f.start(t, taskInfo(t, "t1"))
	waitAction(t, f, prd("t1"), claudetest.ReadPath)

	for _, gate := range []string{"1-1", "1-2"} {
		before := f.stateCount(prd("t1"))
		open(gate)
		waitFor(t, "the state reported after gate "+gate, func() bool {
			return f.stateCount(prd("t1")) > before
		})
	}
}

func TestTheTranscriptOfAClosedSessionIsReadFromTheDatabase(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	f.start(t, taskInfo(t, "t1"))
	f.waitIdle(t, prd("t1"))
	open := f.transcript(t, prd("t1"))
	if err := f.service.Close(t.Context(), prd("t1")); err != nil {
		t.Fatalf("Close() = %v, want nil", err)
	}
	// A message still queued when the session closed is never sent.
	queued := session.Entry{ID: "queued", Seq: 99, Kind: session.KindUser, User: &session.UserEntry{Text: "later", Pending: true}}
	if err := f.entries.Insert(t.Context(), open.SessionID, queued); err != nil {
		t.Fatalf("Insert() = %v, want nil", err)
	}

	got, err := f.service.Transcript(t.Context(), prd("t1"))
	if err != nil {
		t.Fatalf("Transcript() = %v, want nil", err)
	}
	open.Pending = nil
	if diff := cmp.Diff(open, got); diff != "" {
		t.Errorf("Transcript() mismatch (-want +got):\n%s", diff)
	}
	if _, ok := f.service.Summary(prd("t1")); ok {
		t.Error("Transcript() opened the session")
	}
}

func TestTheTranscriptOfAClosedSessionSurvivesARestart(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	f.start(t, taskInfo(t, "t1"))
	f.waitIdle(t, prd("t1"))
	want := f.transcript(t, prd("t1"))
	want.Pending = nil

	next := f.restart(t)
	got, err := next.service.Transcript(t.Context(), prd("t1"))
	if err != nil {
		t.Fatalf("Transcript() = %v, want nil", err)
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("Transcript() mismatch (-want +got):\n%s", diff)
	}
	if _, ok := next.service.Summary(prd("t1")); ok {
		t.Error("Transcript() opened the session")
	}
}

func TestADiscardedSessionHasNoTranscript(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	f.start(t, taskInfo(t, "t1"))
	f.waitIdle(t, prd("t1"))
	if err := f.service.Discard(t.Context(), "t1", string(prompts.StagePRD)); err != nil {
		t.Fatalf("Discard() = %v, want nil", err)
	}

	_, err := f.service.Transcript(t.Context(), prd("t1"))
	wantErrIs(t, err, session.ErrNotFound)
}

func TestTheConversationsOfATaskListEverySessionItHadByStart(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "slow")
	info := taskInfo(t, "t1")
	f.open(t, info)
	f.advance(time.Minute)
	f.open(t, atStage(info, prompts.StageTechSpec))
	f.open(t, taskInfo(t, "t2"))
	if err := f.service.Close(t.Context(), prd("t1")); err != nil {
		t.Fatalf("Close() = %v, want nil", err)
	}

	// This one starts before both sessions already recorded, so it lands out of
	// start order in the index; Conversations still lists it first.
	f.advance(-90 * time.Second)
	f.open(t, atStage(info, prompts.StagePR))

	want := []session.Conversation{
		{Stage: string(prompts.StagePR), StartedAt: base.Add(-30 * time.Second)},
		{Stage: string(prompts.StagePRD), StartedAt: base},
		{Stage: string(prompts.StageTechSpec), StartedAt: base.Add(time.Minute)},
	}
	if diff := cmp.Diff(want, f.service.Conversations("t1")); diff != "" {
		t.Errorf("Conversations(t1) mismatch (-want +got):\n%s", diff)
	}
	if got := f.service.Conversations("t3"); len(got) != 0 {
		t.Errorf("Conversations(t3) = %+v, want none", got)
	}
}

func TestADiscardedStageLeavesTheConversationsOfItsTask(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "slow")
	info := taskInfo(t, "t1")
	f.open(t, info)
	f.open(t, atStage(info, prompts.StageTechSpec))
	f.open(t, taskInfo(t, "t2"))

	if err := f.service.Discard(t.Context(), "t1", string(prompts.StageTechSpec)); err != nil {
		t.Fatalf("Discard() = %v, want nil", err)
	}
	want := []session.Conversation{{Stage: string(prompts.StagePRD), StartedAt: base}}
	if diff := cmp.Diff(want, f.service.Conversations("t1")); diff != "" {
		t.Errorf("Conversations(t1) after Discard mismatch (-want +got):\n%s", diff)
	}

	if err := f.service.DiscardTask(t.Context(), "t1"); err != nil {
		t.Fatalf("DiscardTask() = %v, want nil", err)
	}
	if got := f.service.Conversations("t1"); len(got) != 0 {
		t.Errorf("Conversations(t1) after DiscardTask = %+v, want none", got)
	}
	if got := f.service.Conversations("t2"); len(got) != 1 {
		t.Errorf("Conversations(t2) = %+v, want the session of the other task", got)
	}
}

func TestForgettingATaskDropsItsConversationsWithoutTouchingTheDatabase(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "slow")
	f.open(t, taskInfo(t, "t1"))
	f.open(t, taskInfo(t, "t2"))

	f.service.ForgetTask("t1")

	if got := f.service.Conversations("t1"); len(got) != 0 {
		t.Errorf("Conversations(t1) after ForgetTask = %+v, want none", got)
	}
	if got := f.service.Conversations("t2"); len(got) != 1 {
		t.Errorf("Conversations(t2) = %+v, want the session of the other task", got)
	}

	// Unlike DiscardTask, ForgetTask leaves the sessions rows alone: a caller
	// whose task delete already removed them by cascade needs only the index
	// told, not a second removal.
	recs, err := f.sessions.List(t.Context())
	if err != nil {
		t.Fatalf("List() = %v, want nil", err)
	}
	if len(recs) != 2 {
		t.Errorf("sessions in the database = %d, want both still there", len(recs))
	}
}

func TestTheConversationsOfATaskAreLoadedAtStart(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "slow")
	f.open(t, taskInfo(t, "t1"))

	next := f.restart(t)
	if got := next.service.Conversations("t1"); len(got) != 0 {
		t.Errorf("Conversations() before loading = %+v, want none", got)
	}
	if err := next.service.LoadConversations(t.Context()); err != nil {
		t.Fatalf("LoadConversations() = %v, want nil", err)
	}
	want := []session.Conversation{{Stage: string(prompts.StagePRD), StartedAt: base}}
	if diff := cmp.Diff(want, next.service.Conversations("t1")); diff != "" {
		t.Errorf("Conversations() mismatch (-want +got):\n%s", diff)
	}
}
