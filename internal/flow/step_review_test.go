package flow_test

import (
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/reviewmode"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
)

// implementerKey is the session that implements a step of a task.
func implementerKey(id string, number int) session.Key {
	return session.Key{TaskID: id, Stage: session.StepStage(number)}
}

// startAgentStep brings task-1, in the agent mode, to its first step with the
// implementer at work, the worktree on the commit the step started from and
// the reading of it that the test says.
func startAgentStep(t *testing.T, f *fixture, snap review.Snapshot) {
	t.Helper()

	f.tasks.setReviewModes("task-1", task.ReviewModes{Task: reviewmode.Agent})
	f.worktrees.setStatus(git.Status{Head: startCommit})
	f.reviews.setSnapshot(snap)
	implementing(f, "task-1", twoStepPlan())
	f.service.Sync(t.Context())
	f.waitStep(t, "task-1", 1, flow.StepImplementing)
	f.waitStepSession(t, "task-1", 1)
}

// underAgentReview brings task-1, in the agent mode, to the first pass of its
// first step: the implementer rested with two changed files, and the reviewer
// started.
func underAgentReview(t *testing.T, f *fixture) {
	t.Helper()

	f.sessions.setReply(implementerKey("task-1", 1), "I added the form.")
	startAgentStep(t, f, staged(0, 2))
	f.sessions.goIdleSession(implementerKey("task-1", 1))
	f.service.Check("task-1")
	f.waitReviewer(t, "task-1", 1)
}

// reviewerWrites is the reviewer of step 1 ending its pass with a report.
func reviewerWrites(f *fixture, report task.ReviewReport) {
	f.tasks.setStepReports("task-1", 1, report)
	f.sessions.goIdleSession(reviewerKey("task-1", 1))
	f.service.Check("task-1")
}

// waitSessionCall polls until the sessions fake took a call.
func (f *fixture) waitSessionCall(t *testing.T, call string) {
	t.Helper()

	waitFor(t, "session call "+call, func() bool { return slices.Contains(f.sessions.recorded(), call) })
}

// reportDelivered brings task-1 to the implementer of step 1 at work on the
// report of the first pass, which asked for changes.
func reportDelivered(t *testing.T, f *fixture) {
	t.Helper()

	underAgentReview(t, f)
	reviewerWrites(f, stepReport(1, 1, false))
	f.waitSessionCall(t, "markStep:task-1:step_review:1:pass=1:clean=false")
}

// countCalls is how many times a call was taken.
func countCalls(calls []string, call string) int {
	n := 0
	for _, c := range calls {
		if c == call {
			n++
		}
	}
	return n
}

func TestAStepStartsWithTheReviewModeOfTheTaskAndKeepsIt(t *testing.T) {
	t.Parallel()

	t.Run("a step that follows the task", func(t *testing.T) {
		t.Parallel()

		f := newFixture(t)
		f.tasks.setReviewModes("task-1", task.ReviewModes{Task: reviewmode.Agent})
		f.tasks.add("task-1", task.StagePlan, task.Artifacts{PRD: true, TechSpec: true, Plan: twoStepPlan()})
		f.sessions.setSummary("task-1", idle(task.StagePlan))

		f.service.Check("task-1")
		f.waitStep(t, "task-1", 1, flow.StepImplementing)
		f.waitStepSession(t, "task-1", 1)

		// The mode is written on the step, so that a later change of the task no
		// longer reaches it.
		if calls := f.tasks.recorded(); !slices.Contains(calls, "stepReviewMode:task-1:1:agent") {
			t.Errorf("task calls = %v, want the review mode of step 1 recorded", calls)
		}
		if err := f.service.SetReviewMode(t.Context(), "task-1", reviewmode.Manual); err != nil {
			t.Fatalf("SetReviewMode() = %v, want nil", err)
		}
		if got := f.stepState(t, "task-1", 1).ReviewMode; got != reviewmode.Agent {
			t.Errorf("review mode of step 1 = %q, want agent", got)
		}
		if got := f.stepState(t, "task-1", 2).ReviewMode; got != reviewmode.Manual {
			t.Errorf("review mode of step 2 = %q, want manual", got)
		}
	})

	t.Run("a step with a mode of its own", func(t *testing.T) {
		t.Parallel()

		f := newFixture(t)
		f.tasks.setReviewModes("task-1", task.ReviewModes{
			Task:  reviewmode.Agent,
			Steps: map[int]reviewmode.Mode{1: reviewmode.Manual},
		})
		f.tasks.add("task-1", task.StagePlan, task.Artifacts{PRD: true, TechSpec: true, Plan: twoStepPlan()})
		f.sessions.setSummary("task-1", idle(task.StagePlan))

		f.service.Check("task-1")
		f.waitStep(t, "task-1", 1, flow.StepImplementing)
		f.waitStepSession(t, "task-1", 1)

		// The step already had a mode of its own: there is nothing to freeze.
		recorded := f.tasks.recorded()
		if slices.ContainsFunc(recorded, func(call string) bool { return strings.HasPrefix(call, "stepReviewMode:") }) {
			t.Errorf("task calls = %v, want no review mode recorded for a step that had one", recorded)
		}
		if got := f.stepState(t, "task-1", 1).ReviewMode; got != reviewmode.Manual {
			t.Errorf("review mode of step 1 = %q, want manual", got)
		}
	})
}

func TestStepsCarryTheirReviewMode(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.tasks.setReviewModes("task-1", task.ReviewModes{
		Task:  reviewmode.Agent,
		Steps: map[int]reviewmode.Mode{1: reviewmode.Agent, 2: reviewmode.Manual},
	})
	implementing(f, "task-1", threeStepPlan())
	f.tasks.setStepRun("task-1", task.StepRun{
		Number: 1, Status: task.StepStarted, StartCommit: startCommit, Fallback: task.FallbackTakenOver,
	})

	type modeOfStep struct {
		Number       int
		ReviewMode   reviewmode.Mode
		ModeAdjusted bool
		Fallback     task.ReviewFallback
	}
	got := make([]modeOfStep, 0, 3)
	for _, state := range f.service.Steps("task-1") {
		got = append(got, modeOfStep{
			Number: state.Step.Number, ReviewMode: state.ReviewMode,
			ModeAdjusted: state.ModeAdjusted, Fallback: state.Fallback,
		})
	}
	// The step that started under the agent review and went back to the user is
	// reviewed by the user, and shows why; only a step still to start shows a
	// mode of its own as adjusted.
	want := []modeOfStep{
		{Number: 1, ReviewMode: reviewmode.Manual, Fallback: task.FallbackTakenOver},
		{Number: 2, ReviewMode: reviewmode.Manual, ModeAdjusted: true},
		{Number: 3, ReviewMode: reviewmode.Agent},
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("steps mismatch (-want +got):\n%s", diff)
	}
}

func TestSetReviewModeChangesTheStepsStillToStart(t *testing.T) {
	t.Parallel()

	tests := map[string]struct {
		stage   task.Stage
		started []int
	}{
		"the plan, before any step":        {stage: task.StagePlan},
		"implementation with step 2 ahead": {stage: task.StageImplementation, started: []int{1}},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			f.tasks.add("task-1", tc.stage, task.Artifacts{PRD: true, TechSpec: true, Plan: twoStepPlan()})
			for _, number := range tc.started {
				f.tasks.setStepRun("task-1", task.StepRun{Number: number, Status: task.StepStarted, StartCommit: startCommit})
			}

			if err := f.service.SetReviewMode(t.Context(), "task-1", reviewmode.Agent); err != nil {
				t.Fatalf("SetReviewMode() = %v, want nil", err)
			}
			f.wantTaskCalls(t, "reviewMode:task-1:agent")
		})
	}
}

func TestSetReviewModeRefusesATaskWhoseStepsAllStarted(t *testing.T) {
	t.Parallel()

	t.Run("implementation with every step started", func(t *testing.T) {
		t.Parallel()

		f := newFixture(t)
		implementing(f, "task-1", twoStepPlan())
		f.tasks.setStepRun("task-1", task.StepRun{
			Number: 1, Status: task.StepDone, StartCommit: startCommit, CommitSHA: commitSHA,
		})
		f.tasks.setStepRun("task-1", task.StepRun{Number: 2, Status: task.StepStarted, StartCommit: startCommit})

		wantErrIs(t, f.service.SetReviewMode(t.Context(), "task-1", reviewmode.Agent), flow.ErrReviewModeLocked)
		f.wantTaskCalls(t)
	})

	t.Run("the pr stage", func(t *testing.T) {
		t.Parallel()

		f := newFixture(t)
		f.tasks.add("task-1", task.StagePR, task.Artifacts{PRD: true, TechSpec: true, Plan: twoStepPlan()})

		wantErrIs(t, f.service.SetReviewMode(t.Context(), "task-1", reviewmode.Agent), flow.ErrReviewModeLocked)
		wantErrIs(t, f.service.SetReviewMode(t.Context(), "nobody", reviewmode.Agent), task.ErrNotFound)
		f.wantTaskCalls(t)
	})
}

func TestSetStepReviewModeChangesAStepThatHasNotStarted(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementing(f, "task-1", twoStepPlan())

	if err := f.service.SetStepReviewMode(t.Context(), "task-1", 2, reviewmode.Agent); err != nil {
		t.Fatalf("SetStepReviewMode() = %v, want nil", err)
	}
	f.wantTaskCalls(t, "stepReviewMode:task-1:2:agent")

	if state := f.stepState(t, "task-1", 2); state.ReviewMode != reviewmode.Agent || !state.ModeAdjusted {
		t.Errorf("step 2 = %+v, want it adjusted to agent", state)
	}
}

func TestSetStepReviewModeRefusesAStartedStep(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementing(f, "task-1", twoStepPlan())
	f.tasks.setStepRun("task-1", task.StepRun{Number: 1, Status: task.StepStarted, StartCommit: startCommit})

	wantErrIs(t, f.service.SetStepReviewMode(t.Context(), "task-1", 1, reviewmode.Agent), flow.ErrStepStarted)
	f.wantTaskCalls(t)
}

func TestAStepThatFollowsTheTaskAgainTakesTheModeOfTheTask(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementing(f, "task-1", twoStepPlan())
	if err := f.service.SetStepReviewMode(t.Context(), "task-1", 2, reviewmode.Agent); err != nil {
		t.Fatalf("SetStepReviewMode() = %v, want nil", err)
	}

	if err := f.service.ClearStepReviewMode(t.Context(), "task-1", 2); err != nil {
		t.Fatalf("ClearStepReviewMode() = %v, want nil", err)
	}
	f.wantTaskCalls(t, "stepReviewMode:task-1:2:agent", "clearStepReviewMode:task-1:2")
	if state := f.stepState(t, "task-1", 2); state.ReviewMode != reviewmode.Manual || state.ModeAdjusted {
		t.Errorf("step 2 = %+v, want it to follow the manual mode of the task", state)
	}
}

func TestFollowingTheTaskIsRefusedOnceTheStepStarted(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementing(f, "task-1", twoStepPlan())
	f.tasks.setStepRun("task-1", task.StepRun{Number: 1, Status: task.StepStarted, StartCommit: startCommit})

	wantErrIs(t, f.service.ClearStepReviewMode(t.Context(), "task-1", 1), flow.ErrStepStarted)
	wantErrIs(t, f.service.ClearStepReviewMode(t.Context(), "task-1", 7), flow.ErrNoStep)
	wantErrIs(t, f.service.ClearStepReviewMode(t.Context(), "nobody", 1), task.ErrNotFound)
	f.wantTaskCalls(t)
}

func TestSetStepReviewModeOfAStepThePlanDoesNotHave(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementing(f, "task-1", twoStepPlan())

	wantErrIs(t, f.service.SetStepReviewMode(t.Context(), "task-1", 7, reviewmode.Agent), flow.ErrNoStep)
	wantErrIs(t, f.service.SetStepReviewMode(t.Context(), "nobody", 1, reviewmode.Agent), task.ErrNotFound)
	f.wantTaskCalls(t)
}

func TestReviewModeEditable(t *testing.T) {
	t.Parallel()

	tests := map[string]struct {
		stage task.Stage
		steps []flow.StepState
		want  bool
	}{
		"the prd":  {stage: task.StagePRD, want: true},
		"the plan": {stage: task.StagePlan, want: true},
		"implementation with a step still to start": {
			stage: task.StageImplementation,
			steps: []flow.StepState{stepAt(1, flow.StepDone), stepAt(2, flow.StepNotStarted)},
			want:  true,
		},
		"implementation with every step started": {
			stage: task.StageImplementation,
			steps: []flow.StepState{stepAt(1, flow.StepDone), stepAt(2, flow.StepAgentReview)},
		},
		"the pr stage": {stage: task.StagePR, steps: []flow.StepState{stepAt(1, flow.StepDone)}},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			tk := task.Task{ID: "task-1", Stage: tc.stage}
			if got := flow.ReviewModeEditable(tk, tc.steps); got != tc.want {
				t.Errorf("ReviewModeEditable() = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestSetSessionModelOfAReviewerKeepsTheChoiceToItself(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementing(f, "task-1", twoStepPlan())
	stage := session.StepReviewStage(1)
	f.sessions.setSummary("task-1", session.Summary{Stage: stage, Status: session.StatusWaiting, Idle: true})

	if err := f.service.SetSessionModel(t.Context(), "task-1", stage, aChoice); err != nil {
		t.Fatalf("SetSessionModel() = %v, want nil", err)
	}
	f.wantCalls(t, "choice:task-1:step_review:1:claude-sonnet-5:low")
	// Neither the stage nor the step takes the choice of one reviewer.
	f.wantTaskCalls(t)
}

func TestTheFirstPassStartsTheReviewerOnceTheImplementerRests(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	underAgentReview(t, f)

	if calls := f.sessions.recorded(); !slices.Contains(calls, "start:task-1:step_review:1:restarted=false") {
		t.Errorf("session calls = %v, want the reviewer started", calls)
	}
	if calls := f.tasks.recorded(); !slices.Contains(calls, "stepPass:task-1:1:1") {
		t.Errorf("task calls = %v, want the first pass recorded", calls)
	}

	tk, _ := f.tasks.Get("task-1")
	info, _ := f.sessions.info(reviewerKey("task-1", 1))
	type reviewerInfo struct {
		Prompt           prompts.Stage
		Step             int
		StepPath         string
		ReviewPath       string
		ImplementerReply string
		Repository       string
		Choice           models.Choice
	}
	want := reviewerInfo{
		Prompt:           prompts.StageStepReview,
		Step:             1,
		StepPath:         filepath.Join(tk.StepsDir(), "1-first.md"),
		ReviewPath:       tk.StepReportPath(1, 1),
		ImplementerReply: "I added the form.",
		Repository:       "dev/web",
		Choice:           tk.Models.Stage(models.StepReview),
	}
	got := reviewerInfo{
		Prompt: info.Prompt, Step: info.Step, StepPath: info.StepPath, ReviewPath: info.ReviewPath,
		ImplementerReply: info.ImplementerReply, Repository: info.Repository, Choice: info.Choice,
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("reviewer info mismatch (-want +got):\n%s", diff)
	}

	state := f.stepState(t, "task-1", 1)
	if state.Status != flow.StepAgentReview || state.ReviewPass != 1 || state.ReviewerStage != "step_review:1" {
		t.Errorf("step 1 = %+v, want the first pass under way in step_review:1", state)
	}
}

func TestTheReviewerOfAOneShotStepReadsTheDocument(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.tasks.setReviewModes("task-1", task.ReviewModes{Task: reviewmode.Agent})
	f.worktrees.setStatus(git.Status{Head: startCommit})
	f.reviews.setSnapshot(staged(0, 2))
	tk := implementingOneShot(f, "task-1")
	f.service.Sync(t.Context())
	f.waitStep(t, "task-1", 1, flow.StepImplementing)
	f.waitStepSession(t, "task-1", 1)

	f.sessions.goIdleSession(implementerKey("task-1", 1))
	f.service.Check("task-1")
	f.waitReviewer(t, "task-1", 1)

	info, _ := f.sessions.info(reviewerKey("task-1", 1))
	type reviewerInfo struct {
		StepPath    string
		OneShotPath string
		Repository  string
	}
	want := reviewerInfo{StepPath: tk.OneShotPath(), OneShotPath: tk.OneShotPath(), Repository: "dev/web"}
	got := reviewerInfo{StepPath: info.StepPath, OneShotPath: info.OneShotPath, Repository: info.Repository}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("reviewer info mismatch (-want +got):\n%s", diff)
	}
}

func TestTheImplementerWithoutAReplyIsSaidToHaveNone(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	startAgentStep(t, f, staged(0, 2))
	f.sessions.goIdleSession(implementerKey("task-1", 1))
	f.service.Check("task-1")
	f.waitReviewer(t, "task-1", 1)

	info, _ := f.sessions.info(reviewerKey("task-1", 1))
	if !strings.HasPrefix(info.ImplementerReply, "(The implementer") {
		t.Errorf("implementer reply = %q, want the app to say there was none", info.ImplementerReply)
	}
}

func TestAnImplementerWithoutChangesIsNotReviewed(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	startAgentStep(t, f, staged(0, 0))
	f.sessions.goIdleSession(implementerKey("task-1", 1))
	before := f.tasks.inspectCount()
	f.service.Check("task-1")
	f.waitEvaluated(t, "task-1", before)

	if _, open := f.sessions.Summary(reviewerKey("task-1", 1)); open {
		t.Error("the reviewer started, want nothing to review")
	}
	if got := f.stepState(t, "task-1", 1).Status; got != flow.StepNothingToCommit {
		t.Errorf("status = %q, want nothing_to_commit", got)
	}
}

func TestTheLoopWaitsWhileTheReviewerWorks(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	underAgentReview(t, f)
	f.tasks.setStepReports("task-1", 1, stepReport(1, 1, false))
	f.sessions.setSummary("task-1", session.Summary{
		Stage: session.StepReviewStage(1), Status: session.StatusWorking, TurnRunning: true,
	})
	before := f.tasks.inspectCount()
	f.service.Check("task-1")
	f.waitEvaluated(t, "task-1", before)

	if sent := f.sessions.sent(); len(sent) != 0 {
		t.Errorf("messages = %q, want none while the reviewer works", sent)
	}
	if calls := f.tasks.recorded(); slices.Contains(calls, "stepReported:task-1:1:1") {
		t.Errorf("task calls = %v, want the report not acted on", calls)
	}
}

func TestAPassWithoutAReportWaitsForTheUser(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	underAgentReview(t, f)
	f.sessions.goIdleSession(reviewerKey("task-1", 1))
	before := f.tasks.inspectCount()
	f.service.Check("task-1")
	f.waitEvaluated(t, "task-1", before)

	if sent := f.sessions.sent(); len(sent) != 0 {
		t.Errorf("messages = %q, want none without a report", sent)
	}
	if state := f.stepState(t, "task-1", 1); state.Status != flow.StepAgentReview || !state.ReportMissing {
		t.Errorf("step 1 = %+v, want the pass under way with its report missing", state)
	}

	// The user sorts it out with the reviewer, which writes the report.
	f.tasks.setStepReports("task-1", 1, stepReport(1, 1, false))
	f.service.Check("task-1")
	f.waitSessionCall(t, "send:task-1:step:1")
}

func TestAReportWithChangesGoesToTheImplementer(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	reportDelivered(t, f)

	tk, _ := f.tasks.Get("task-1")
	sent := f.sessions.sent()
	if len(sent) != 1 {
		t.Fatalf("messages = %q, want the report", sent)
	}
	for _, part := range []string{tk.StepReportPath(1, 1), "the report step-reviews/1-review-1.md", "Do not commit"} {
		if !strings.Contains(sent[0], part) {
			t.Errorf("message = %q, want it to carry %q", sent[0], part)
		}
	}
	// The report is acted on first, and recorded as acted on after.
	calls := f.sessions.recorded()
	send := slices.Index(calls, "send:task-1:step:1")
	mark := slices.Index(calls, "markStep:task-1:step_review:1:pass=1:clean=false")
	if send < 0 || send > mark {
		t.Errorf("session calls = %v, want the report sent before it is marked", calls)
	}
	taskCalls := f.tasks.recorded()
	read := slices.Index(taskCalls, "read:task-1:step-reviews/1-review-1.md")
	reported := slices.Index(taskCalls, "stepReported:task-1:1:1")
	if read < 0 || read > reported {
		t.Errorf("task calls = %v, want the report read before it is recorded", taskCalls)
	}

	if state := f.stepState(t, "task-1", 1); state.Status != flow.StepAddressingReview || state.ReviewRound != 1 {
		t.Errorf("step 1 = %+v, want the implementer addressing the first report", state)
	}
}

func TestTheNextPassIsAskedInTheSameConversation(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	reportDelivered(t, f)

	f.sessions.setReply(implementerKey("task-1", 1), "1. fixed. 2. contested: the error cannot happen there.")
	f.sessions.goIdleSession(implementerKey("task-1", 1))
	f.service.Check("task-1")
	f.waitSessionCall(t, "send:task-1:step_review:1")

	if calls := f.tasks.recorded(); !slices.Contains(calls, "stepPass:task-1:1:2") {
		t.Errorf("task calls = %v, want the second pass recorded", calls)
	}
	if n := countCalls(f.sessions.recorded(), "start:task-1:step_review:1:restarted=false"); n != 1 {
		t.Errorf("reviewer starts = %d, want the first one only", n)
	}
	tk, _ := f.tasks.Get("task-1")
	sent := f.sessions.sent()
	last := sent[len(sent)-1]
	for _, part := range []string{"the error cannot happen there", tk.StepReportPath(1, 2)} {
		if !strings.Contains(last, part) {
			t.Errorf("message = %q, want it to carry %q", last, part)
		}
	}
	if state := f.stepState(t, "task-1", 1); state.Status != flow.StepAgentReview || state.ReviewPass != 2 {
		t.Errorf("step 1 = %+v, want the second pass under way", state)
	}
}

func TestACleanReportGetsTheStepCommittedWithEveryChange(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	underAgentReview(t, f)
	reviewerWrites(f, stepReport(1, 1, true))
	f.waitSessionCall(t, "markStep:task-1:step_review:1:pass=1:clean=true")

	if want := []string{commitAllPrompt("task-1")}; !slices.Equal(f.sessions.sent(), want) {
		t.Errorf("messages = %q, want %q", f.sessions.sent(), want)
	}
	// Nobody stages under the agent review: there is no progress to show.
	if state := f.stepState(t, "task-1", 1); state.Status != flow.StepCommitting || state.Review != nil {
		t.Errorf("step 1 = %+v, want committing without a reading", state)
	}

	f.reviews.setSnapshot(review.Snapshot{Head: commitSHA})
	f.sessions.goIdleSession(implementerKey("task-1", 1))
	f.service.Check("task-1")
	f.waitStep(t, "task-1", 1, flow.StepDone)
	// The commit is recorded before the sessions are closed.
	f.waitSessionCall(t, "close:task-1:step:1")
	f.waitSessionCall(t, "close:task-1:step_review:1")
}

func TestACommitTurnUnderWayAsksForNoPass(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	underAgentReview(t, f)
	reviewerWrites(f, stepReport(1, 1, true))
	f.waitSessionCall(t, "markStep:task-1:step_review:1:pass=1:clean=true")

	// The implementer commits, the reviewer rests and the worktree still has the
	// changes: the report was already acted on, and nothing else is.
	before := f.tasks.inspectCount()
	f.service.Check("task-1")
	f.waitEvaluated(t, "task-1", before)

	if calls := f.tasks.recorded(); slices.Contains(calls, "stepPass:task-1:1:2") {
		t.Errorf("task calls = %v, want no pass asked during the commit", calls)
	}
	if calls := f.sessions.recorded(); slices.Contains(calls, "send:task-1:step_review:1") {
		t.Errorf("session calls = %v, want nothing sent to the reviewer", calls)
	}
}

func TestAReportThatCannotBeSentIsActedOnAgain(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	underAgentReview(t, f)
	f.sessions.failWith(errStart)
	f.tasks.setStepReports("task-1", 1, stepReport(1, 1, false))
	f.sessions.goIdleSession(reviewerKey("task-1", 1))
	before := f.tasks.inspectCount()
	f.service.Check("task-1")
	f.waitEvaluated(t, "task-1", before)

	if calls := f.tasks.recorded(); slices.Contains(calls, "stepReported:task-1:1:1") {
		t.Errorf("task calls = %v, want the report not recorded as acted on", calls)
	}

	f.sessions.failWith(nil)
	f.service.Check("task-1")
	f.waitSessionCall(t, "markStep:task-1:step_review:1:pass=1:clean=false")
	if n := countCalls(f.tasks.recorded(), "stepReported:task-1:1:1"); n != 1 {
		t.Errorf("reports recorded = %d, want one", n)
	}
}

func TestTheLastRoundThatStillAsksForChangesHandsTheStepToTheUser(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.tasks.setReviewModes("task-1", task.ReviewModes{Task: reviewmode.Agent})
	f.reviews.setSnapshot(staged(0, 2))
	created := implementing(f, "task-1", twoStepPlan())
	f.worktrees.seed(created)
	f.tasks.setStepRun("task-1", task.StepRun{
		Number: 1, Status: task.StepStarted, StartCommit: startCommit, ReviewPass: 4, ReportedPass: 3,
	})
	f.tasks.setStepReports("task-1", 1,
		stepReport(1, 1, false), stepReport(1, 2, false), stepReport(1, 3, false), stepReport(1, 4, false))

	// Both conversations come back at rest.
	f.service.Sync(t.Context())
	f.waitSessionCall(t, "markStep:task-1:step_review:1:pass=4:clean=false")

	calls := f.tasks.recorded()
	fallback := slices.Index(calls, "stepFallback:task-1:1:rounds_exhausted")
	reported := slices.Index(calls, "stepReported:task-1:1:4")
	if fallback < 0 || fallback > reported {
		t.Errorf("task calls = %v, want the fallback recorded before the report", calls)
	}
	if sent := f.sessions.sent(); len(sent) != 0 {
		t.Errorf("messages = %q, want the last report kept from the implementer", sent)
	}
	state := f.stepState(t, "task-1", 1)
	if state.Status != flow.StepAwaitingReview || state.ReviewMode != reviewmode.Manual ||
		state.Fallback != task.FallbackRoundsExhausted || state.Review == nil {
		t.Errorf("step 1 = %+v, want it awaiting the review of the user, with the reading", state)
	}
}

func TestACommitAfterACleanReportThatDoesNotHappenHandsTheStepToTheUser(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	underAgentReview(t, f)
	reviewerWrites(f, stepReport(1, 1, true))
	f.waitSessionCall(t, "markStep:task-1:step_review:1:pass=1:clean=true")

	// The implementer stops with the branch exactly where it was.
	f.sessions.goIdleSession(implementerKey("task-1", 1))
	f.service.Check("task-1")
	f.waitStep(t, "task-1", 1, flow.StepAwaitingReview)
	// The step is given back before the missing commit is recorded.
	waitFor(t, "the user to be told the commit did not happen", func() bool {
		return f.stepState(t, "task-1", 1).CommitFailed
	})

	if calls := f.tasks.recorded(); !slices.Contains(calls, "stepFallback:task-1:1:commit_failed") {
		t.Errorf("task calls = %v, want the fallback recorded", calls)
	}
	if got := f.stepState(t, "task-1", 1).ReviewMode; got != reviewmode.Manual {
		t.Errorf("review mode = %q, want manual", got)
	}
}

func TestAFailedTurnOfTheImplementerStopsTheLoop(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	startAgentStep(t, f, staged(0, 2))
	f.sessions.setSummary("task-1", session.Summary{
		Stage: session.StepStage(1), Status: session.StatusWaiting, Idle: true, TurnFailed: true,
	})
	before := f.tasks.inspectCount()
	f.service.Check("task-1")
	f.waitEvaluated(t, "task-1", before)

	if _, open := f.sessions.Summary(reviewerKey("task-1", 1)); open {
		t.Error("the reviewer started, want the loop to wait on the failed turn")
	}
	if calls := f.tasks.recorded(); slices.ContainsFunc(calls, func(c string) bool { return strings.HasPrefix(c, "stepPass:") }) {
		t.Errorf("task calls = %v, want no pass", calls)
	}
}

func TestSyncReopensTheReviewerOfAStepThatHadAPass(t *testing.T) {
	t.Parallel()

	t.Run("a step that had a pass", func(t *testing.T) {
		t.Parallel()

		f := newFixture(t)
		created := implementing(f, "task-1", twoStepPlan())
		f.worktrees.seed(created)
		f.tasks.setStepRun("task-1", task.StepRun{
			Number: 1, Status: task.StepStarted, StartCommit: startCommit, ReviewPass: 2, ReportedPass: 1,
		})

		f.service.Sync(t.Context())

		calls := f.sessions.recorded()
		if !slices.Contains(calls, "open:task-1:step:1") || !slices.Contains(calls, "open:task-1:step_review:1") {
			t.Errorf("session calls = %v, want the implementer and the reviewer opened", calls)
		}
		info, _ := f.sessions.info(reviewerKey("task-1", 1))
		if want := created.StepReportPath(1, 2); info.ReviewPath != want {
			t.Errorf("review path = %q, want %q", info.ReviewPath, want)
		}
	})

	t.Run("a step without a pass", func(t *testing.T) {
		t.Parallel()

		f := newFixture(t)
		created := implementing(f, "task-1", twoStepPlan())
		f.worktrees.seed(created)
		f.tasks.setStepRun("task-1", task.StepRun{Number: 1, Status: task.StepStarted, StartCommit: startCommit})

		f.service.Sync(t.Context())

		if calls := f.sessions.recorded(); slices.Contains(calls, "open:task-1:step_review:1") {
			t.Errorf("session calls = %v, want no reviewer", calls)
		}
	})
}

func TestReviewStepMyselfInterruptsAPassUnderWay(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	underAgentReview(t, f)
	f.sessions.setSummary("task-1", session.Summary{
		Stage: session.StepReviewStage(1), Status: session.StatusWorking, TurnRunning: true,
	})

	if err := f.service.ReviewStepMyself(t.Context(), "task-1"); err != nil {
		t.Fatalf("ReviewStepMyself() = %v, want nil", err)
	}

	if calls := f.tasks.recorded(); !slices.Contains(calls, "stepFallback:task-1:1:taken_over") {
		t.Errorf("task calls = %v, want the fallback recorded", calls)
	}
	if calls := f.sessions.recorded(); !slices.Contains(calls, "interrupt:task-1:step_review:1") {
		t.Errorf("session calls = %v, want the pass interrupted", calls)
	}
	state := f.stepState(t, "task-1", 1)
	if state.Status != flow.StepAwaitingReview || state.ReviewMode != reviewmode.Manual {
		t.Errorf("step 1 = %+v, want it awaiting the review of the user", state)
	}
}

func TestReviewStepMyselfLeavesAReviewerAtRestAlone(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	underAgentReview(t, f)
	f.sessions.goIdleSession(reviewerKey("task-1", 1))
	f.sessions.setSummary("task-1", session.Summary{
		Stage: session.StepStage(1), Status: session.StatusWorking, TurnRunning: true,
	})

	if err := f.service.ReviewStepMyself(t.Context(), "task-1"); err != nil {
		t.Fatalf("ReviewStepMyself() = %v, want nil", err)
	}

	if calls := f.sessions.recorded(); slices.Contains(calls, "interrupt:task-1:step_review:1") {
		t.Errorf("session calls = %v, want no interrupt", calls)
	}
	// The implementer ends its turn, and the step is the user's to review then.
	state := f.stepState(t, "task-1", 1)
	if state.Status != flow.StepImplementing || state.ReviewMode != reviewmode.Manual {
		t.Errorf("step 1 = %+v, want it implementing, reviewed by the user", state)
	}
}

func TestReviewStepMyselfIsRefusedOutsideTheAgentReview(t *testing.T) {
	t.Parallel()

	tests := map[string]struct {
		mode reviewmode.Mode
		run  task.StepRun
	}{
		"a step in manual mode": {
			mode: reviewmode.Manual,
			run:  task.StepRun{Number: 1, Status: task.StepStarted, StartCommit: startCommit},
		},
		"a step that went back to the user": {
			mode: reviewmode.Agent,
			run: task.StepRun{
				Number: 1, Status: task.StepStarted, StartCommit: startCommit, Fallback: task.FallbackTakenOver,
			},
		},
		"a step committing": {
			mode: reviewmode.Agent,
			run: task.StepRun{
				Number: 1, Status: task.StepCommitting, StartCommit: startCommit, ReviewPass: 1, ReportedPass: 1,
			},
		},
		"a step preparing": {
			mode: reviewmode.Agent,
			run:  task.StepRun{Number: 1, Status: task.StepPreparing},
		},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			f.tasks.setReviewModes("task-1", task.ReviewModes{Task: tc.mode})
			implementing(f, "task-1", twoStepPlan())
			f.tasks.setStepRun("task-1", tc.run)

			wantErrIs(t, f.service.ReviewStepMyself(t.Context(), "task-1"), flow.ErrNoAgentReview)
			f.wantTaskCalls(t)
		})
	}
}

func TestApprovingAStepUnderAgentReviewIsRefused(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.tasks.setReviewModes("task-1", task.ReviewModes{Task: reviewmode.Agent})
	f.reviews.setSnapshot(staged(3, 3))
	created := implementing(f, "task-1", twoStepPlan())
	f.worktrees.seed(created)
	f.tasks.setStepRun("task-1", task.StepRun{Number: 1, Status: task.StepStarted, StartCommit: startCommit})
	f.sessions.setSummary("task-1", session.Summary{Stage: session.StepStage(1), Status: session.StatusWaiting, Idle: true})

	// Everything is staged, and still only a clean report gets the step committed.
	wantErrIs(t, f.service.ApproveStep(t.Context(), "task-1"), flow.ErrAgentReviewing)
	f.wantTaskCalls(t)
	f.wantCalls(t)
}

func TestDiscardStepThrowsTheReviewAway(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	underAgentReview(t, f)

	if err := f.service.DiscardStep(t.Context(), "task-1", false); err != nil {
		t.Fatalf("DiscardStep() = %v, want nil", err)
	}

	if calls := f.sessions.recorded(); !slices.Contains(calls, "discard:task-1:step:1,step_review:1") {
		t.Errorf("session calls = %v, want both conversations discarded", calls)
	}
	calls := f.tasks.recorded()
	cleared := slices.Index(calls, "clearStepReview:task-1:1")
	if cleared < 0 || !slices.Contains(calls[cleared:], "step:task-1:1:preparing") {
		t.Errorf("task calls = %v, want the review cleared before the step starts over", calls)
	}
	// The step starts over with the mode it started with, from its first pass.
	f.waitSessionCall(t, "start:task-1:step:1:restarted=true")
	if run, _ := f.tasks.stepRun("task-1", 1); run.ReviewPass != 0 || run.ReportedPass != 0 {
		t.Errorf("run = %+v, want the passes forgotten", run)
	}
	if got := f.stepState(t, "task-1", 1).ReviewMode; got != reviewmode.Agent {
		t.Errorf("review mode = %q, want agent", got)
	}
}
