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
