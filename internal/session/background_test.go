package session_test

import (
	"testing"

	"github.com/guilhermt/myspec/internal/claude/claudetest"
	"github.com/guilhermt/myspec/internal/session"
)

// actionOf returns the action of a session with the given tool and target.
func actionOf(t *testing.T, f *fixture, k session.Key, tool, target string) (session.Entry, bool) {
	t.Helper()

	for _, e := range f.entriesOf(t, k, session.KindAction) {
		if e.Action.Tool == tool && (target == "" || e.Action.Target == target) {
			return e, true
		}
	}
	return session.Entry{}, false
}

// waitActionStatus waits until the action of a tool has the given status.
func waitActionStatus(t *testing.T, f *fixture, k session.Key, tool string, status session.ActionStatus) session.Entry {
	t.Helper()

	var found session.Entry
	waitFor(t, tool+" action to be "+string(status), func() bool {
		e, ok := actionOf(t, f, k, tool, "")
		found = e
		return ok && e.Action.Status == status
	})
	return found
}

func TestASubagentInTheBackgroundKeepsWritingUnderItsCallAfterTheTurnEnds(t *testing.T) {
	t.Parallel()

	f, open := bgScenarioRun(t, "bg_live_agent", 0, limits{})
	f.waitBackground(t, prd("t1"))
	root, ok := actionOf(t, f, prd("t1"), "Agent", "")
	if !ok {
		t.Fatal("no Agent action in the conversation")
	}

	open("1-1")
	said := waitSaid(t, f, prd("t1"), claudetest.SubagentNarration)
	read := waitActionStatus(t, f, prd("t1"), "Read", session.ActionDone)

	if said.Assistant.ParentToolUseID != root.Action.ToolUseID || read.Action.ParentToolUseID != root.Action.ToolUseID {
		t.Errorf("parents = %q and %q, want the Agent call %q", said.Assistant.ParentToolUseID, read.Action.ParentToolUseID, root.Action.ToolUseID)
	}
	if said.TurnID != root.TurnID || read.TurnID != root.TurnID {
		t.Errorf("turns = %q and %q, want the turn of the launch %q", said.TurnID, read.TurnID, root.TurnID)
	}
	if sum := f.summary(t, prd("t1")); sum.TurnRunning {
		t.Errorf("summary = %+v, want no turn open for what the subagent wrote", sum)
	}
}

func TestABackgroundCallStaysRunningUntilItsTaskEnds(t *testing.T) {
	t.Parallel()

	f, open := bgScenarioRun(t, "bg_live_agent", 0, limits{})
	f.waitBackground(t, prd("t1"))

	for _, tool := range []string{"Agent", "Bash"} {
		e, ok := actionOf(t, f, prd("t1"), tool, "")
		if !ok {
			t.Fatalf("no %s action in the conversation", tool)
		}
		if e.Action.Status != session.ActionRunning || !e.Action.Background || e.Action.TaskID == "" {
			t.Errorf("%s action = %+v, want it running in the background with the id of its task", tool, e.Action)
		}
	}
	if agent, _ := actionOf(t, f, prd("t1"), "Agent", ""); agent.Action.Prompt != claudetest.BackgroundAgentA+"." {
		t.Errorf("prompt = %q, want the task the subagent got", agent.Action.Prompt)
	}

	open("1-1", "1-2")
	agent := waitActionStatus(t, f, prd("t1"), "Agent", session.ActionDone)
	if agent.Action.OutputTail != claudetest.SubagentReport {
		t.Errorf("report = %q, want the last speech of the subagent %q", agent.Action.OutputTail, claudetest.SubagentReport)
	}
	if bash, _ := actionOf(t, f, prd("t1"), "Bash", ""); bash.Action.Status != session.ActionRunning {
		t.Errorf("Bash status = %q, want it running: its task did not end", bash.Action.Status)
	}
}

func TestABackgroundCommandEndsWithTheOutputOfItsFile(t *testing.T) {
	t.Parallel()

	f, open := bgScenarioRun(t, "bg_promoted", 0, limits{})
	f.waitBackground(t, prd("t1"))
	if e, ok := actionOf(t, f, prd("t1"), "Bash", ""); !ok || e.Action.Status != session.ActionRunning || !e.Action.Background {
		t.Fatalf("action = %+v, want the command moved to the background still running", e.Action)
	}

	open("1-1")
	bash := waitActionStatus(t, f, prd("t1"), "Bash", session.ActionDone)
	if bash.Action.OutputTail != "line 1\nline 2" || bash.Action.OutputLines != 2 {
		t.Errorf("output = %q (%d lines), want the content of the output file", bash.Action.OutputTail, bash.Action.OutputLines)
	}
}

func TestABackgroundCallThatFailsToLaunchEndsWithItsError(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "bg_refused")
	f.start(t, taskInfo(t, "t1"))
	f.waitIdle(t, prd("t1"))

	bash := waitActionStatus(t, f, prd("t1"), "Bash", session.ActionError)
	if bash.Action.OutputTail != "Permission to use Bash has been denied." {
		t.Errorf("output = %q, want the error of the result", bash.Action.OutputTail)
	}
}
