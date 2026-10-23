package session_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/contract"
	"github.com/guilhermt/myspec/internal/session"
)

func TestRoleOf(t *testing.T) {
	t.Parallel()

	tests := map[string]struct {
		info session.TaskInfo
		want contract.Role
	}{
		"prd":         {session.TaskInfo{Stage: "prd"}, contract.RolePlanning},
		"tech spec":   {session.TaskInfo{Stage: "tech_spec"}, contract.RolePlanning},
		"plan":        {session.TaskInfo{Stage: "plan"}, contract.RolePlanning},
		"one shot":    {session.TaskInfo{Stage: "one_shot"}, contract.RolePlanning},
		"step":        {session.TaskInfo{Stage: session.StepStage(3)}, contract.RoleStep},
		"step review": {session.TaskInfo{Stage: session.StepReviewStage(3)}, contract.RoleStepReview},
		"pr":          {session.TaskInfo{Stage: session.PRStage}, contract.RolePRDraft},
		"pr review":   {session.TaskInfo{Stage: session.PRReviewStage}, contract.RolePRReview},
		"pr fix":      {session.TaskInfo{Stage: session.PRFixStage}, contract.RolePRFix},
		"publish":     {session.TaskInfo{Stage: session.ReviewStage, Publish: true}, contract.RoleReviewPublish},
		"apply":       {session.TaskInfo{Stage: session.ReviewStage}, contract.RoleReviewApply},
		"discussion":  {session.TaskInfo{Stage: session.DiscussionStage}, contract.RoleDiscussion},
	}
	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			if got := session.RoleOf(tc.info); got != tc.want {
				t.Errorf("RoleOf(%q) = %q, want %q", tc.info.Stage, got, tc.want)
			}
		})
	}
}

func TestTurnOf(t *testing.T) {
	t.Parallel()

	app := func(kind session.AppKind) *session.Entry {
		return &session.Entry{User: &session.UserEntry{App: true, AppKind: kind}}
	}
	prompt := &session.Entry{User: &session.UserEntry{Prompt: true}}
	fix := func(kind session.AppKind) session.TaskInfo {
		return session.TaskInfo{Stage: session.PRFixStage, Request: session.AppMessage{Kind: kind}}
	}

	tests := map[string]struct {
		entry *session.Entry
		info  session.TaskInfo
		want  contract.Turn
	}{
		"commit":                  {app(session.AppCommit), session.TaskInfo{}, contract.TurnCommit},
		"commit all":              {app(session.AppCommitAll), session.TaskInfo{}, contract.TurnCommit},
		"commit push":             {app(session.AppCommitPush), session.TaskInfo{}, contract.TurnCommit},
		"commit all push":         {app(session.AppCommitAllPush), session.TaskInfo{}, contract.TurnCommit},
		"apply":                   {app(session.AppApply), session.TaskInfo{}, contract.TurnApply},
		"report":                  {app(session.AppReport), session.TaskInfo{}, contract.TurnApply},
		"pass":                    {app(session.AppPass), session.TaskInfo{}, contract.TurnNone},
		"a message of the user":   {&session.Entry{User: &session.UserEntry{Text: "hi"}}, session.TaskInfo{}, contract.TurnNone},
		"fix prompt, apply":       {prompt, fix(session.AppApply), contract.TurnApply},
		"fix prompt, report":      {prompt, fix(session.AppReport), contract.TurnApply},
		"fix prompt, other":       {prompt, fix(session.AppCommit), contract.TurnNone},
		"prompt of another stage": {prompt, session.TaskInfo{Stage: "prd", Request: session.AppMessage{Kind: session.AppApply}}, contract.TurnNone},
		"no user entry":           {&session.Entry{}, session.TaskInfo{}, contract.TurnNone},
	}
	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			if got := session.TurnOf(tc.entry, tc.info); got != tc.want {
				t.Errorf("TurnOf() = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestStateOf(t *testing.T) {
	t.Parallel()

	tests := map[string]struct {
		info session.TaskInfo
		want contract.State
	}{
		"a step": {
			session.TaskInfo{Stage: session.StepStage(2), Step: 2, Branch: "login", BaseBranch: "origin/dev"},
			contract.State{Role: contract.RoleStep, Turn: contract.TurnCommit, Branch: "login", Base: "dev", Step: 2},
		},
		"a review takes the branch of the pull request": {
			session.TaskInfo{Stage: session.ReviewStage, HeadBranch: "feature", BaseBranch: "origin/main"},
			contract.State{Role: contract.RoleReviewApply, Turn: contract.TurnCommit, Branch: "feature", Base: "main"},
		},
		"the branch of the task wins": {
			session.TaskInfo{Stage: session.PRStage, Branch: "login", HeadBranch: "feature"},
			contract.State{Role: contract.RolePRDraft, Turn: contract.TurnCommit, Branch: "login"},
		},
	}
	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			got := session.StateOf(tc.info, contract.TurnCommit)
			if diff := cmp.Diff(tc.want, got); diff != "" {
				t.Errorf("StateOf() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

// stateOnDisk reads the state file the hook would read for a session.
func stateOnDisk(t *testing.T, f *fixture, k session.Key) (contract.State, bool) {
	t.Helper()

	id := f.sessions.get(t, k.TaskID, k.Stage).ID
	data, err := os.ReadFile(filepath.Join(f.hooksDir, id+".json"))
	if os.IsNotExist(err) {
		return contract.State{}, false
	}
	if err != nil {
		t.Fatalf("read the contract state: %v", err)
	}
	var st contract.State
	if err := json.Unmarshal(data, &st); err != nil {
		t.Fatalf("decode the contract state: %v", err)
	}
	return st, true
}

func TestTheContractStateFollowsTheTurn(t *testing.T) {
	t.Parallel()

	f := newContractFixture(t, "slow")
	f.start(t, taskInfo(t, "t1"))
	waitStreaming(t, f, prd("t1"))

	if cfg := f.launcher.started()[0]; cfg.Settings != contract.Settings(`'/opt/myspec' --claude-hook '`+f.hooksDir+`'`) {
		t.Errorf("Settings = %q, want the hook of the contract", cfg.Settings)
	}
	want := contract.State{Role: contract.RolePlanning, Base: ""}
	if got, ok := stateOnDisk(t, f, prd("t1")); !ok || got != want {
		t.Errorf("state during a turn of the user = %+v, %v, want %+v", got, ok, want)
	}

	if err := f.service.SendFromApp(t.Context(), prd("t1"), session.AppMessage{Text: "commit it", Kind: session.AppCommit}); err != nil {
		t.Fatalf("SendFromApp() = %v, want nil", err)
	}
	if err := f.service.Interrupt(t.Context(), prd("t1")); err != nil {
		t.Fatalf("Interrupt() = %v, want nil", err)
	}
	f.waitStatus(t, prd("t1"), "the commit message to go out", func(s session.Summary) bool {
		return s.PendingCount == 0 && s.TurnRunning
	})
	want.Turn = contract.TurnCommit
	if got, _ := stateOnDisk(t, f, prd("t1")); got != want {
		t.Errorf("state during the commit turn = %+v, want %+v", got, want)
	}

	if err := f.service.Interrupt(t.Context(), prd("t1")); err != nil {
		t.Fatalf("Interrupt() = %v, want nil", err)
	}
	f.waitIdle(t, prd("t1"))
	want.Turn = contract.TurnNone
	if got, _ := stateOnDisk(t, f, prd("t1")); got != want {
		t.Errorf("state at rest = %+v, want %+v", got, want)
	}

	if err := f.service.Close(t.Context(), prd("t1")); err != nil {
		t.Fatalf("Close() = %v, want nil", err)
	}
	if _, ok := stateOnDisk(t, f, prd("t1")); ok {
		t.Error("the state file is still there after Close, want it removed")
	}
}

func TestANewServiceForgetsTheStatesOfThePreviousRun(t *testing.T) {
	t.Parallel()

	f := newContractFixture(t, "echo")
	stale := filepath.Join(f.hooksDir, "stale.json")
	if err := os.WriteFile(stale, []byte("{}"), 0o600); err != nil {
		t.Fatal(err)
	}

	f.restart(t)

	if _, err := os.Stat(stale); !os.IsNotExist(err) {
		t.Errorf("stat(stale) = %v, want it removed", err)
	}
}

func TestADeviationIsAnsweredOneActionAtATime(t *testing.T) {
	t.Parallel()

	f := newContractFixture(t, "deviation")
	f.start(t, taskInfo(t, "t1"))
	f.waitStatus(t, prd("t1"), "the deviation", func(s session.Summary) bool {
		return s.Status == session.StatusNeedsPermission
	})
	p := f.entriesOf(t, prd("t1"), session.KindPermission)[0].Permission
	if !p.Deviation || p.DecisionReason != "This is outside what this stage does: this stage only writes its document." {
		t.Fatalf("permission = %+v, want a deviation with the reason without escapes", p)
	}

	err := f.service.AnswerPermission(t.Context(), prd("t1"), p.RequestID, session.DecisionAllowSession, "")
	wantErrIs(t, err, session.ErrDeviationSession)

	if err := f.service.AnswerPermission(t.Context(), prd("t1"), p.RequestID, session.DecisionDeny, ""); err != nil {
		t.Fatalf("AnswerPermission(deny) = %v, want nil", err)
	}
	f.waitIdle(t, prd("t1"))
	got := f.entriesOf(t, prd("t1"), session.KindPermission)[0].Permission
	if got.Status != session.PermissionDenied || got.DenyMessage != p.DecisionReason {
		t.Errorf("permission = %+v, want denied with the reason as the message", got)
	}
}

func TestAHookReasonWithoutThePrefixIsNotADeviation(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "permission")
	request := waitPermission(t, f)
	if request.Permission.Deviation {
		t.Error("Deviation = true for a permission with no hook reason, want false")
	}
}
