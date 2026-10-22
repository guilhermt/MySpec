package session_test

import (
	"errors"
	"slices"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/claude/claudetest"
	"github.com/guilhermt/myspec/internal/session"
)

// taskOf returns the live task of a session with the given kind.
func taskOf(t *testing.T, f *fixture, k session.Key, kind session.WakeKind) session.RunningTask {
	t.Helper()

	for _, task := range f.summary(t, k).Tasks {
		if task.Kind == kind {
			return task
		}
	}
	t.Fatalf("no %s among the tasks %+v", kind, f.summary(t, k).Tasks)
	return session.RunningTask{}
}

// markersOf returns the markers of a session with the given type.
func markersOf(t *testing.T, f *fixture, k session.Key, typ session.MarkerType) []session.Entry {
	t.Helper()

	var out []session.Entry
	for _, e := range f.entriesOf(t, k, session.KindMarker) {
		if e.Marker.Type == typ {
			out = append(out, e)
		}
	}
	return out
}

func TestStoppingATaskRecordsStoppedByYouAndEndsItsAction(t *testing.T) {
	t.Parallel()

	f, _ := bgScenarioRun(t, "bg_live_agent", 0, limits{})
	f.waitBackground(t, prd("t1"))
	cmd := taskOf(t, f, prd("t1"), session.WakeCommand)

	if err := f.service.StopTasks(t.Context(), prd("t1"), []string{cmd.TaskID}); err != nil {
		t.Fatalf("StopTasks = %v, want nil", err)
	}

	markers := markersOf(t, f, prd("t1"), session.MarkerBackgroundStopped)
	want := []session.BackgroundItem{{Kind: session.WakeCommand, Name: claudetest.BackgroundServer}}
	if len(markers) != 1 || !cmp.Equal(markers[0].Marker.Background, want) {
		t.Fatalf("markers = %+v, want one naming %+v", markers, want)
	}
	bash, _ := actionOf(t, f, prd("t1"), "Bash", "")
	if bash.Action.Status != session.ActionInterrupted || bash.Action.InterruptedBy != "user" {
		t.Errorf("Bash action = %+v, want it interrupted by the user", bash.Action)
	}
	if got := taskOf(t, f, prd("t1"), session.WakeAgent); got.Kind != session.WakeAgent || len(f.summary(t, prd("t1")).Tasks) != 1 {
		t.Errorf("tasks = %+v, want only the subagent left", f.summary(t, prd("t1")).Tasks)
	}
}

func TestStoppingSeveralTasksRecordsOneMarker(t *testing.T) {
	t.Parallel()

	f, _ := bgScenarioRun(t, "bg_live_agent", 0, limits{})
	f.waitBackground(t, prd("t1"))
	tasks := f.summary(t, prd("t1")).Tasks
	ids := make([]string, 0, len(tasks))
	for _, task := range tasks {
		ids = append(ids, task.TaskID)
	}

	if err := f.service.StopTasks(t.Context(), prd("t1"), ids); err != nil {
		t.Fatalf("StopTasks = %v, want nil", err)
	}

	markers := markersOf(t, f, prd("t1"), session.MarkerBackgroundStopped)
	if len(markers) != 1 {
		t.Fatalf("markers = %+v, want one for the whole batch", markers)
	}
	kinds := make([]session.WakeKind, 0, len(markers[0].Marker.Background))
	for _, item := range markers[0].Marker.Background {
		kinds = append(kinds, item.Kind)
	}
	slices.Sort(kinds)
	if want := []session.WakeKind{session.WakeAgent, session.WakeCommand}; !cmp.Equal(kinds, want) {
		t.Errorf("kinds = %v, want %v", kinds, want)
	}
	if tasks := f.summary(t, prd("t1")).Tasks; len(tasks) != 0 {
		t.Errorf("tasks = %+v, want none", tasks)
	}
}

func TestARefusedStopLeavesTheTaskRunningWithTheReason(t *testing.T) {
	t.Parallel()

	f := newFixtureLimits(t, &fakeLauncher{
		scenario: "bg_live_agent",
		env:      []string{claudetest.EnvGates + "=" + t.TempDir(), claudetest.EnvStop + "=refuse"},
	}, 0, limits{})
	f.start(t, taskInfo(t, "t1"))
	f.waitBackground(t, prd("t1"))
	cmd := taskOf(t, f, prd("t1"), session.WakeCommand)

	err := f.service.StopTasks(t.Context(), prd("t1"), []string{cmd.TaskID})

	var refusal *session.StopRefusal
	if !errors.As(err, &refusal) || !cmp.Equal(refusal.Reasons, []string{"Task cannot be stopped"}) {
		t.Fatalf("StopTasks = %v, want a refusal with the reason of the CLI", err)
	}
	cmd = taskOf(t, f, prd("t1"), session.WakeCommand)
	if cmd.Stopping || cmd.StopError != "Task cannot be stopped" {
		t.Errorf("task = %+v, want it running, not stopping, with the reason", cmd)
	}
	if markers := markersOf(t, f, prd("t1"), session.MarkerBackgroundStopped); len(markers) != 0 {
		t.Errorf("markers = %+v, want none", markers)
	}
}

func TestTheSummaryListsWhatRunsWithTheProgressOfASubagent(t *testing.T) {
	t.Parallel()

	f, _ := bgScenarioRun(t, "bg_permission_sub", 0, limits{})
	f.waitStatus(t, prd("t1"), "the permission", func(s session.Summary) bool {
		return s.Status == session.StatusNeedsPermission
	})

	tasks := f.summary(t, prd("t1")).Tasks
	if len(tasks) != 1 {
		t.Fatalf("tasks = %+v, want the subagent", tasks)
	}
	agent, _ := actionOf(t, f, prd("t1"), "Agent", "")
	got := tasks[0]
	if got.Kind != session.WakeAgent || got.Name != claudetest.BackgroundAgentA || !got.Background || !got.Counts ||
		got.EntryID != agent.ID || got.ToolUseID != agent.Action.ToolUseID || got.StartedAt.IsZero() {
		t.Errorf("task = %+v, want the background subagent of the Agent action", got)
	}
	if got.Actions != 1 || got.ActionLabel == "" || got.ActionTarget == "" {
		t.Errorf("progress = %d, %q, %q, want one action running", got.Actions, got.ActionLabel, got.ActionTarget)
	}
}

func TestTheOutputOfARunningCommandIsReadFromTheCLI(t *testing.T) {
	t.Parallel()

	f, _ := bgScenarioRun(t, "bg_live_agent", 0, limits{})
	f.waitBackground(t, prd("t1"))
	cmd := taskOf(t, f, prd("t1"), session.WakeCommand)
	agent := taskOf(t, f, prd("t1"), session.WakeAgent)

	out, err := f.service.TaskOutput(t.Context(), prd("t1"), cmd.TaskID)
	if err != nil {
		t.Fatalf("TaskOutput = %v, want nil", err)
	}
	if want := (session.Output{Text: "tick 1\ntick 2", Lines: 2}); out != want {
		t.Errorf("output = %+v, want %+v", out, want)
	}
	if _, err := f.service.TaskOutput(t.Context(), prd("t1"), agent.TaskID); !errors.Is(err, session.ErrNotFound) {
		t.Errorf("TaskOutput of a subagent = %v, want ErrNotFound", err)
	}
	if _, err := f.service.TaskOutput(t.Context(), prd("t1"), "nope"); !errors.Is(err, session.ErrNotFound) {
		t.Errorf("TaskOutput of an unknown task = %v, want ErrNotFound", err)
	}
}

func TestAPermissionOfASubagentNamesIt(t *testing.T) {
	t.Parallel()

	f, _ := bgScenarioRun(t, "bg_permission_sub", 0, limits{})
	f.waitStatus(t, prd("t1"), "the permission", func(s session.Summary) bool {
		return s.Status == session.StatusNeedsPermission
	})

	agent, _ := actionOf(t, f, prd("t1"), "Agent", "")
	permissions := f.entriesOf(t, prd("t1"), session.KindPermission)
	if len(permissions) != 1 || permissions[0].Permission.ParentToolUseID != agent.Action.ToolUseID {
		t.Errorf("permissions = %+v, want one asked by the Agent call %q", permissions, agent.Action.ToolUseID)
	}
}

// markerTypes lists the types of the markers of a session, in order.
func markerTypes(t *testing.T, f *fixture, k session.Key) []session.MarkerType {
	t.Helper()

	markers := f.entriesOf(t, k, session.KindMarker)
	out := make([]session.MarkerType, 0, len(markers))
	for _, e := range markers {
		out = append(out, e.Marker.Type)
	}
	return out
}

func TestPausingWithWorkInTheBackgroundRecordsItLostBeforePaused(t *testing.T) {
	t.Parallel()

	f, _ := bgScenarioRun(t, "bg_live_agent", 0, limits{})
	f.waitBackground(t, prd("t1"))

	if err := f.service.Pause(t.Context(), prd("t1")); err != nil {
		t.Fatalf("Pause() = %v, want nil", err)
	}

	types := markerTypes(t, f, prd("t1"))
	if n := len(types); n < 2 || types[n-2] != session.MarkerBackgroundLost || types[n-1] != session.MarkerPaused {
		t.Fatalf("markers = %v, want background_lost then paused last", types)
	}
	lost := markersOf(t, f, prd("t1"), session.MarkerBackgroundLost)
	if len(lost) != 1 || len(lost[0].Marker.Background) != 2 {
		t.Fatalf("lost markers = %+v, want one naming the subagent and the command", lost)
	}
	bash, _ := actionOf(t, f, prd("t1"), "Bash", "")
	if bash.Action.Status != session.ActionInterrupted || bash.Action.InterruptedBy != "crash" {
		t.Errorf("Bash action = %+v, want it interrupted by the crash", bash.Action)
	}
}

func TestAProcessThatDiesLosesItsBackgroundWork(t *testing.T) {
	t.Parallel()

	f, _ := bgScenarioRun(t, "bg_live_agent", 0, limits{})
	f.waitBackground(t, prd("t1"))

	f.launcher.kill(t)
	f.waitStatus(t, prd("t1"), "the crash", func(s session.Summary) bool {
		return s.Status == session.StatusError
	})

	lost := markersOf(t, f, prd("t1"), session.MarkerBackgroundLost)
	if len(lost) != 1 {
		t.Fatalf("lost markers = %+v, want one", lost)
	}
	var lostSeq, errSeq int
	lostSeq = lost[0].Seq
	errs := f.entriesOf(t, prd("t1"), session.KindError)
	if len(errs) != 1 {
		t.Fatalf("errors = %+v, want one", errs)
	}
	errSeq = errs[0].Seq
	if lostSeq >= errSeq {
		t.Errorf("lost marker at %d, error at %d, want the loss first", lostSeq, errSeq)
	}
	bash, _ := actionOf(t, f, prd("t1"), "Bash", "")
	if bash.Action.Status != session.ActionInterrupted || bash.Action.InterruptedBy != "crash" {
		t.Errorf("Bash action = %+v, want it interrupted by the crash", bash.Action)
	}
	if tasks := f.summary(t, prd("t1")).Tasks; len(tasks) != 0 {
		t.Errorf("tasks = %+v, want none", tasks)
	}
}

func TestAConversationReopenedWithBackgroundWorkRunningRecordsItLost(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	rec := session.Record{ID: "sess-1", TaskID: "t1", Stage: "prd", Started: true, CreatedAt: base, UpdatedAt: base}
	if err := f.sessions.Insert(t.Context(), rec); err != nil {
		t.Fatalf("Insert() = %v, want nil", err)
	}
	f.entries.seed(
		t, "sess-1",
		session.Entry{
			ID: "c1", Seq: 1, TurnID: "u1", Kind: session.KindAction, CreatedAt: base,
			Action: &session.ActionEntry{
				ToolUseID: "x", Tool: "Bash", Description: "Serve", Target: "serve", Label: "Running",
				Status: session.ActionRunning, Background: true,
			},
		},
		session.Entry{
			ID: "c2", Seq: 2, TurnID: "u1", Kind: session.KindAction, CreatedAt: base,
			Action: &session.ActionEntry{
				ToolUseID: "y", Tool: "Monitor", Target: "tail -f log", Label: "Watching",
				Status: session.ActionRunning, Background: true,
			},
		},
		session.Entry{
			ID: "c3", Seq: 3, TurnID: "u1", Kind: session.KindAction, CreatedAt: base,
			Action: &session.ActionEntry{ToolUseID: "z", Tool: "Read", Label: "Reading", Status: session.ActionRunning},
		},
	)

	f.open(t, taskInfo(t, "t1"))

	lost := markersOf(t, f, prd("t1"), session.MarkerBackgroundLost)
	want := []session.BackgroundItem{
		{Kind: session.WakeCommand, Name: "Serve"},
		{Kind: session.WakeMonitor, Name: "tail -f log"},
	}
	if len(lost) != 1 || !cmp.Equal(lost[0].Marker.Background, want) {
		t.Fatalf("lost markers = %+v, want one naming %+v", lost, want)
	}
	for _, e := range f.entriesOf(t, prd("t1"), session.KindAction) {
		if e.Action.Status != session.ActionInterrupted || e.Action.InterruptedBy != "crash" {
			t.Errorf("action %s = %+v, want it interrupted by the crash", e.ID, e.Action)
		}
	}
}
