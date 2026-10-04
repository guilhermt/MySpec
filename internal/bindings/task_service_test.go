package bindings_test

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/board"
	"github.com/guilhermt/myspec/internal/git/gittest"
	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/prreport"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
	"github.com/guilhermt/myspec/internal/worktree"
)

// newTask is the request every test starts from.
func newTask(name string) bindings.CreateTaskRequest {
	return bindings.CreateTaskRequest{
		Name:           name,
		RepositoryID:   testRepoID,
		InitialContext: "a login screen with email and password",
	}
}

// createdTask registers a repository, creates one task in it and waits for its
// session to settle. It returns the fixture, the clone and the id of the task.
func createdTask(t *testing.T) (*fixture, string, string) {
	t.Helper()

	f := newFixture(t)
	dir := t.TempDir()
	f.register(t, dir)

	id, err := f.tasks.CreateTask(newTask("login-screen"))
	if err != nil {
		t.Fatalf("CreateTask() = %v, want nil", err)
	}
	f.waitForStatus(t, id, "waiting")
	return f, dir, id
}

// startedTaskModels is the model of every stage of a Structured task that has
// just been created, in order: the PRD session is the live one, and every other
// stage is still to start.
func startedTaskModels(set models.Set) []bindings.TaskStageModel {
	stages := task.ModeStructured.ModelStages()
	converted := make([]bindings.TaskStageModel, 0, len(stages))
	for _, stage := range stages {
		c := set[stage]
		converted = append(converted, bindings.TaskStageModel{
			Stage:    string(stage),
			Model:    string(c.Model),
			Effort:   string(c.Effort),
			Editable: stage != models.PRD,
			Live:     stage == models.PRD,
		})
	}
	return converted
}

func TestCreateTaskAddsTheTaskToTheState(t *testing.T) {
	t.Parallel()

	f, _, id := createdTask(t)

	got := f.taskOf(t, id)
	// The request carries no mode, so the task is Structured.
	want := bindings.TaskSummary{
		ID:                 id,
		Name:               "login-screen",
		RepositoryID:       testRepoID,
		Repository:         "dev/web",
		Mode:               "structured",
		Stage:              "prd",
		ReviewMode:         "manual",
		ReviewModeEditable: true,
		SessionStatus:      "waiting",
		SessionModel:       "claude-fable-5-1",
		SessionEffort:      "high",
		Steps:              []bindings.Step{},
		PlanProblems:       []bindings.PlanProblem{},
		Situations:         []bindings.Situation{},
		Models:             startedTaskModels(models.Factory()),
		Conversations:      got.Conversations,
		CreatedAt:          got.CreatedAt,
		UpdatedAt:          got.UpdatedAt,
	}
	// The context percentage depends on the tokens the fake reports, and the
	// process may still be idling; neither belongs in this comparison.
	got.ContextPercent = 0
	got.ProcessRunning = false
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("task mismatch (-want +got):\n%s", diff)
	}
	if len(got.Conversations) != 1 || got.Conversations[0].Stage != "prd" {
		t.Errorf("conversations = %+v, want the PRD session", got.Conversations)
	}
}

func TestCreateTaskReportsWhatTheUserGotWrong(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	dir := t.TempDir()
	f.register(t, dir)

	if _, err := f.tasks.CreateTask(newTask("login-screen")); err != nil {
		t.Fatalf("CreateTask() = %v, want nil", err)
	}

	tests := []struct {
		name string
		req  bindings.CreateTaskRequest
		want string
	}{
		{
			name: "invalid name",
			req:  newTask("Login Screen"),
			want: "Use lowercase letters, digits and single hyphens.",
		},
		{
			name: "no context",
			req:  bindings.CreateTaskRequest{Name: "checkout", RepositoryID: testRepoID},
			want: "Describe what you want to build.",
		},
		{
			name: "a repository nobody registered",
			req: bindings.CreateTaskRequest{
				Name: "checkout", RepositoryID: "nobody", InitialContext: "a checkout",
			},
			want: "Choose a registered repository.",
		},
		{
			name: "unknown mode",
			req: bindings.CreateTaskRequest{
				Name: "checkout", RepositoryID: testRepoID, InitialContext: "a checkout", Mode: "quick",
			},
			want: "Unknown mode.",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			id, err := f.tasks.CreateTask(tt.req)
			if err == nil {
				t.Fatalf("CreateTask() = %q, nil, want an error", id)
			}
			if err.Error() != tt.want {
				t.Errorf("CreateTask() error = %q, want %q", err, tt.want)
			}
			if f.logged(t, "binding failed") {
				t.Error("a mistake the user can correct was logged as a failure")
			}
		})
	}
}

func TestCreateTaskSaysTheNameIsTakenInTheRepository(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())

	if _, err := f.tasks.CreateTask(newTask("login-screen")); err != nil {
		t.Fatalf("CreateTask() = %v, want nil", err)
	}

	_, err := f.tasks.CreateTask(newTask("login-screen"))
	if err == nil {
		t.Fatal("CreateTask() = nil, want the name refused")
	}
	if want := "A task named login-screen already exists in dev/web."; err.Error() != want {
		t.Errorf("CreateTask() error = %q, want %q", err, want)
	}
	if f.logged(t, "binding failed") {
		t.Error("a mistake the user can correct was logged as a failure")
	}
}

func TestCreateTaskIsRefusedWhenTheCloneIsMissing(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	dir := filepath.Join(t.TempDir(), "web")
	if err := os.MkdirAll(dir, 0o750); err != nil {
		t.Fatalf("MkdirAll(%s) = %v, want nil", dir, err)
	}
	f.register(t, dir)
	if err := os.RemoveAll(dir); err != nil {
		t.Fatalf("RemoveAll(%s) = %v, want nil", dir, err)
	}

	_, err := f.tasks.CreateTask(newTask("login-screen"))
	if err == nil {
		t.Fatal("CreateTask() = nil, want the missing clone refused")
	}
	if want := "The clone at " + dir + " is missing."; err.Error() != want {
		t.Errorf("CreateTask() error = %q, want %q", err, want)
	}
}

func TestCreateTaskSaysTheTaskWasUndoneOnlyWhenItWas(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		deleteErr error
		undone    bool
	}{
		{name: "the deletion worked", undone: true},
		{name: "the deletion failed", deleteErr: errors.New("database is locked")},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			f.register(t, t.TempDir())
			f.faults.failSessions(errors.New("disk I/O error"))
			f.faults.failTaskDeletes(tt.deleteErr)

			id, err := f.tasks.CreateTask(newTask("login-screen"))
			if err == nil {
				t.Fatalf("CreateTask() = %q, nil, want the first session refused", id)
			}
			const undone = " The task was undone."
			if got := strings.HasSuffix(err.Error(), undone); got != tt.undone {
				t.Errorf("CreateTask() error = %q, ends in %q = %v, want %v", err, undone, got, tt.undone)
			}
			if !strings.HasPrefix(err.Error(), "disk I/O error") {
				t.Errorf("CreateTask() error = %q, want the failure of the session first", err)
			}
			if left := len(f.taskSvc.List()); (left == 0) != tt.undone {
				t.Errorf("%d tasks left, want the task gone only when it was undone", left)
			}
		})
	}
}

func TestCreateTaskStartsAOneShotTaskInItsRepository(t *testing.T) {
	t.Parallel()

	f, dir := registeredClone(t)

	req := newTask("login-screen")
	req.Mode = "one_shot"
	id, err := f.tasks.CreateTask(req)
	if err != nil {
		t.Fatalf("CreateTask() = %v, want nil", err)
	}
	f.waitForStatus(t, id, "waiting")

	summary := f.taskOf(t, id)
	if summary.Mode != "one_shot" || summary.Stage != "one_shot" || summary.Repository != "dev/web" {
		t.Errorf("task = mode %q stage %q repository %q, want the One-Shot planning in %s",
			summary.Mode, summary.Stage, summary.Repository, dir)
	}
	if summary.HasOneShot {
		t.Error("hasOneShot = true, want the document still to be written")
	}

	// The planning opens with what the user wrote, as the PRD does.
	transcript := f.waitTranscript(t, id, "one_shot")
	if !hasUserText(transcript, "a login screen with email and password") {
		t.Error("the planning did not start with the initial context")
	}
}

// stageModelOf is the line of a stage in the models of a task, failing the
// test when the task has none for it.
func stageModelOf(t *testing.T, summary bindings.TaskSummary, stage string) bindings.TaskStageModel {
	t.Helper()

	for _, one := range summary.Models {
		if one.Stage == stage {
			return one
		}
	}
	t.Fatalf("models of task %s = %+v, want a line for %s", summary.ID, summary.Models, stage)
	return bindings.TaskStageModel{}
}

// waitAssistantText waits until the agent answered with text in the
// conversation of a stage, which is what tells a message that was answered
// from one that is still on its way.
func waitAssistantText(t *testing.T, f *fixture, id, stage, text string) {
	t.Helper()

	deadline := time.Now().Add(pollTimeout)
	for time.Now().Before(deadline) {
		transcript, err := f.tasks.GetTranscript(id, stage)
		if err != nil {
			t.Fatalf("GetTranscript(%s, %s) = %v, want nil", id, stage, err)
		}
		for _, entry := range transcript.Entries {
			if entry.Kind != "assistant" || entry.Assistant == nil {
				continue
			}
			if strings.Contains(entry.Assistant.Text, text) {
				return
			}
		}
		time.Sleep(pollStep)
	}
	t.Fatalf("the agent never answered %q in %s of task %s", text, stage, id)
}

func TestCreateTaskStartsThePRDWithTheChoiceOfTheDialog(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())

	req := newTask("login-screen")
	req.Models = []bindings.StageModel{{Stage: "prd", Model: "claude-fable-5-1", Effort: "xhigh"}}
	id, err := f.tasks.CreateTask(req)
	if err != nil {
		t.Fatalf("CreateTask() = %v, want nil", err)
	}
	f.waitForStatus(t, id, "waiting")

	set := models.Factory()
	set[models.PRD] = models.Choice{Model: models.Fable51, Effort: models.XHigh}
	got := f.taskOf(t, id)
	if diff := cmp.Diff(startedTaskModels(set), got.Models); diff != "" {
		t.Errorf("models mismatch (-want +got):\n%s", diff)
	}
	if got.SessionModel != "claude-fable-5-1" || got.SessionEffort != "xhigh" {
		t.Errorf("session choice = %q %q, want the one of the dialog", got.SessionModel, got.SessionEffort)
	}
}

func TestCreateTaskStartsFromTheDefaultsOfTheSettings(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())

	if err := f.settings.SetModelDefault("implementation", "claude-opus-5", "xhigh"); err != nil {
		t.Fatalf("SetModelDefault() = %v, want nil", err)
	}

	id, err := f.tasks.CreateTask(newTask("login-screen"))
	if err != nil {
		t.Fatalf("CreateTask() = %v, want nil", err)
	}
	f.waitForStatus(t, id, "waiting")

	got := stageModelOf(t, f.taskOf(t, id), "implementation")
	if got.Model != "claude-opus-5" || got.Effort != "xhigh" {
		t.Errorf("implementation = %+v, want the default of the settings", got)
	}
}

func TestCreateTaskReportsAnEmptyModel(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())

	req := newTask("login-screen")
	req.Models = []bindings.StageModel{{Stage: "prd", Model: "", Effort: "high"}}
	id, err := f.tasks.CreateTask(req)
	if err == nil {
		t.Fatalf("CreateTask() = %q, nil, want an error", id)
	}
	if err.Error() != "Choose a model." {
		t.Errorf("CreateTask() error = %q, want the notice about the model", err)
	}
	if tasks := f.state.GetState().Tasks; len(tasks) != 0 {
		t.Errorf("state has %d tasks, want none", len(tasks))
	}
}

func TestCreateTaskKeepsAModelTheCatalogDoesNotHave(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())

	// A model saved before, or one the installed CLI stopped offering, is
	// nobody's mistake: it is kept as it is, effort included.
	req := newTask("login-screen")
	req.Models = []bindings.StageModel{{Stage: "prd", Model: "gpt", Effort: ""}}
	id, err := f.tasks.CreateTask(req)
	if err != nil {
		t.Fatalf("CreateTask() = %v, want nil", err)
	}
	f.waitForStatus(t, id, "waiting")

	got := stageModelOf(t, f.taskOf(t, id), "prd")
	if got.Model != "gpt" || got.Effort != "" {
		t.Errorf("prd = %+v, want the choice as it was given", got)
	}
}

func TestCreateTaskStartsFromTheReviewModeOfTheSettings(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())

	if err := f.settings.SetReviewModeDefault("agent"); err != nil {
		t.Fatalf("SetReviewModeDefault() = %v, want nil", err)
	}

	id, err := f.tasks.CreateTask(newTask("login-screen"))
	if err != nil {
		t.Fatalf("CreateTask() = %v, want nil", err)
	}

	if got := f.taskOf(t, id).ReviewMode; got != "agent" {
		t.Errorf("reviewMode = %q, want the default of the settings", got)
	}
}

func TestCreateTaskKeepsTheReviewModeOfTheDialog(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())

	req := newTask("login-screen")
	req.ReviewMode = "agent"
	id, err := f.tasks.CreateTask(req)
	if err != nil {
		t.Fatalf("CreateTask() = %v, want nil", err)
	}

	if got := f.taskOf(t, id).ReviewMode; got != "agent" {
		t.Errorf("reviewMode = %q, want the one of the dialog", got)
	}
}

func TestCreateTaskReportsAnUnknownReviewMode(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())

	req := newTask("login-screen")
	req.ReviewMode = "auto"
	id, err := f.tasks.CreateTask(req)
	if err == nil {
		t.Fatalf("CreateTask() = %q, nil, want an error", id)
	}
	if err.Error() != "Unknown review mode." {
		t.Errorf("CreateTask() error = %q, want the unknown review mode notice", err)
	}
	if tasks := f.state.GetState().Tasks; len(tasks) != 0 {
		t.Errorf("state has %d tasks, want none", len(tasks))
	}
}

func TestSetReviewModeChangesTheModeOfTheState(t *testing.T) {
	t.Parallel()

	f, _, id := createdTask(t)

	if err := f.tasks.SetReviewMode(id, "agent"); err != nil {
		t.Fatalf("SetReviewMode() = %v, want nil", err)
	}
	if got := f.taskOf(t, id); got.ReviewMode != "agent" || !got.ReviewModeEditable {
		t.Errorf("task = reviewMode %q editable %v, want agent and still editable", got.ReviewMode, got.ReviewModeEditable)
	}

	if err := f.tasks.SetReviewMode(id, "auto"); err == nil || err.Error() != "Unknown review mode." {
		t.Errorf("SetReviewMode(auto) error = %v, want the unknown review mode notice", err)
	}
	if f.logged(t, "binding failed") {
		t.Error("a mistake the user can correct was logged as a failure")
	}
}

func TestSetStageModelChangesAStageStillToStart(t *testing.T) {
	t.Parallel()

	f, _, id := createdTask(t)

	if err := f.tasks.SetStageModel(id, "plan", "claude-sonnet-5", "low"); err != nil {
		t.Fatalf("SetStageModel(%s) = %v, want nil", id, err)
	}

	got := stageModelOf(t, f.taskOf(t, id), "plan")
	want := bindings.TaskStageModel{
		Stage: "plan", Model: "claude-sonnet-5", Effort: "low", Editable: true,
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("plan mismatch (-want +got):\n%s", diff)
	}
}

func TestSetStageModelOfAStageThatStartedTellsTheUser(t *testing.T) {
	t.Parallel()

	f, _, id := createdTask(t)

	// The PRD session starts with the task, so there is never a moment in
	// which its choice could still be changed from the task.
	err := f.tasks.SetStageModel(id, "prd", "claude-opus-5", "high")
	if err == nil {
		t.Fatal("SetStageModel(prd) = nil, want an error")
	}
	if err.Error() != "The sessions of this stage have already started." {
		t.Errorf("SetStageModel() error = %q, want the locked stage notice", err)
	}
	if f.logged(t, "binding failed") {
		t.Error("a mistake the user can correct was logged as a failure")
	}
}

func TestSetStepModelReportsWhatTheUserGotWrong(t *testing.T) {
	t.Parallel()

	f, _, id := createdTask(t)

	err := f.tasks.SetStepModel(id, 1, "", "high")
	if err == nil || err.Error() != "Choose a model." {
		t.Errorf("SetStepModel() error = %v, want the notice about the model", err)
	}

	// The task has no plan yet, so there is no step to change.
	err = f.tasks.SetStepModel(id, 1, "claude-opus-5", "max")
	if err == nil || err.Error() != "The task has no step to run." {
		t.Errorf("SetStepModel() error = %v, want the missing step notice", err)
	}
	if f.logged(t, "binding failed") {
		t.Error("a mistake the user can correct was logged as a failure")
	}
}

func TestSetSessionModelIsWhatTheNextMessageRunsWith(t *testing.T) {
	t.Parallel()

	f, _, id := createdTask(t)

	if err := f.tasks.SetSessionModel(id, "prd", "claude-opus-5", "max"); err != nil {
		t.Fatalf("SetSessionModel(%s) = %v, want nil", id, err)
	}

	got := f.taskOf(t, id)
	if got.SessionModel != "claude-opus-5" || got.SessionEffort != "max" {
		t.Errorf("session choice = %q %q, want the one of the conversation",
			got.SessionModel, got.SessionEffort)
	}
	// The change reaches the stage too, so discarding the PRD starts it again
	// with what the user last picked.
	stage := stageModelOf(t, got, "prd")
	if stage.Model != "claude-opus-5" || stage.Effort != "max" {
		t.Errorf("prd = %+v, want the choice of the conversation", stage)
	}

	// The next message runs with the new choice, which the session reaches by
	// stopping the idle process and starting it again with --resume.
	if err := f.tasks.SendMessage(id, "prd", "add a remember me box"); err != nil {
		t.Fatalf("SendMessage(%s) = %v, want nil", id, err)
	}
	waitAssistantText(t, f, id, "prd", "add a remember me box")
	if !f.logged(t, "claude restarting") {
		t.Error("the process was not started again with the new flags")
	}
}

func TestGetTranscriptCarriesThePrompt(t *testing.T) {
	t.Parallel()

	f, _, id := createdTask(t)

	transcript, err := f.tasks.GetTranscript(id, "prd")
	if err != nil {
		t.Fatalf("GetTranscript(%s) = %v, want nil", id, err)
	}
	if len(transcript.Pending) != 0 {
		t.Errorf("len(Pending) = %d, want 0", len(transcript.Pending))
	}
	if len(transcript.Entries) < 2 {
		t.Fatalf("entries = %d, want the stage marker and the prompt", len(transcript.Entries))
	}
	if transcript.Stage != "prd" {
		t.Errorf("stage = %q, want prd", transcript.Stage)
	}

	marker := transcript.Entries[0]
	if marker.Kind != "marker" || marker.Marker == nil {
		t.Fatalf("first entry = %+v, want a marker", marker)
	}
	if marker.Marker.Type != "stage_started" || marker.Marker.Stage != "prd" || marker.Marker.Restarted {
		t.Errorf("marker = %+v, want the first stage_started of the PRD", marker.Marker)
	}

	prompt := transcript.Entries[1]
	if prompt.Kind != "user" || prompt.User == nil {
		t.Fatalf("second entry = %+v, want a user one", prompt)
	}
	if !prompt.User.Prompt || prompt.User.App {
		t.Errorf("prompt flags = %+v, want the prompt of the user", prompt.User)
	}
	if prompt.User.Text != "a login screen with email and password" {
		t.Errorf("prompt text = %q, want the initial context", prompt.User.Text)
	}
	if prompt.User.Pending {
		t.Error("the prompt is still pending, want it delivered")
	}
}

func TestGetTranscriptRejectsAnUnknownTask(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	_, err := f.tasks.GetTranscript("nope", "prd")
	if err == nil {
		t.Fatal("GetTranscript() = nil, want an error")
	}
	if err.Error() != "This conversation has ended." {
		t.Errorf("GetTranscript() error = %q, want the ended conversation notice", err)
	}
}

func TestGetActionOutputReadsTheStoredOutputOfAnEntry(t *testing.T) {
	t.Parallel()

	f, _, id := createdTask(t)
	entryID := f.waitTranscript(t, id, "prd").Entries[0].ID
	stored := session.Output{Text: "ok\nwarn", Lines: 2, Truncated: true}
	if err := f.store.Entries.SaveOutput(t.Context(), entryID, stored); err != nil {
		t.Fatalf("SaveOutput() = %v, want nil", err)
	}

	got, err := f.tasks.GetActionOutput(id, "prd", entryID)
	if err != nil {
		t.Fatalf("GetActionOutput() = %v, want nil", err)
	}
	want := bindings.ActionOutput{Text: "ok\nwarn", Lines: 2, Truncated: true}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("GetActionOutput() mismatch (-want +got):\n%s", diff)
	}
}

func TestGetActionOutputRejectsWhatItDoesNotKnow(t *testing.T) {
	t.Parallel()

	f, _, id := createdTask(t)
	entryID := f.waitTranscript(t, id, "prd").Entries[0].ID
	tests := map[string]struct{ task, entry string }{
		"an unknown task":             {task: "nope", entry: entryID},
		"an unknown entry":            {task: id, entry: "nope"},
		"an entry that has no output": {task: id, entry: entryID},
	}
	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			_, err := f.tasks.GetActionOutput(tc.task, "prd", tc.entry)
			if err == nil {
				t.Fatal("GetActionOutput() = nil, want an error")
			}
			if err.Error() != "This conversation has ended." {
				t.Errorf("GetActionOutput() error = %q, want the ended conversation notice", err)
			}
		})
	}
}

func TestGetTranscriptReadsAClosedStage(t *testing.T) {
	t.Parallel()

	f, _, id := plannedTask(t)
	f.waitReviewed(t, id, 1)

	transcript, err := f.tasks.GetTranscript(id, "prd")
	if err != nil {
		t.Fatalf("GetTranscript() = %v, want nil", err)
	}
	if transcript.Stage != "prd" || len(transcript.Entries) == 0 {
		t.Errorf("transcript = stage %q with %d entries, want the conversation of the PRD", transcript.Stage, len(transcript.Entries))
	}
	conversations := f.taskOf(t, id).Conversations
	stages := make([]string, 0, len(conversations))
	for _, c := range conversations {
		stages = append(stages, c.Stage)
	}
	if diff := cmp.Diff([]string{"prd", "tech_spec", "plan", "step:1"}, stages); diff != "" {
		t.Errorf("conversations mismatch (-want +got):\n%s", diff)
	}
}

func TestClearStepReviewModeMakesTheStepFollowTheTask(t *testing.T) {
	t.Parallel()

	f, _, id := plannedTask(t)
	f.waitReviewed(t, id, 1)

	if err := f.tasks.SetStepReviewMode(id, 2, "agent"); err != nil {
		t.Fatalf("SetStepReviewMode() = %v, want nil", err)
	}
	if err := f.tasks.ClearStepReviewMode(id, 2); err != nil {
		t.Fatalf("ClearStepReviewMode() = %v, want nil", err)
	}
	if step := f.taskOf(t, id).Steps[1]; step.ReviewMode != "manual" || step.ReviewModeAdjusted {
		t.Errorf("step 2 = %+v, want it to follow the task again", step)
	}
	if err := f.tasks.ClearStepReviewMode(id, 1); err == nil {
		t.Error("ClearStepReviewMode() of a started step = nil, want an error")
	}
}

func TestDeleteTaskRemovesTheTaskAndItsFolder(t *testing.T) {
	t.Parallel()

	f, _, id := createdTask(t)
	artifacts := task.ArtifactsDir(f.dataDir, "dev", "web", "login-screen")

	if _, err := f.tasks.DeleteTask(id); err != nil {
		t.Fatalf("DeleteTask(%s) = %v, want nil", id, err)
	}
	if tasks := f.state.GetState().Tasks; len(tasks) != 0 {
		t.Errorf("state has %d tasks, want none", len(tasks))
	}
	if _, err := os.Stat(artifacts); !os.IsNotExist(err) {
		t.Errorf("Stat(%s) = %v, want the folder to be gone", artifacts, err)
	}
}

func TestSendMessageQueuesAnotherTurn(t *testing.T) {
	t.Parallel()

	f, _, id := createdTask(t)

	if err := f.tasks.SendMessage(id, "prd", "add a remember me box"); err != nil {
		t.Fatalf("SendMessage(%s) = %v, want nil", id, err)
	}
	f.waitForStatus(t, id, "waiting")

	transcript, err := f.tasks.GetTranscript(id, "prd")
	if err != nil {
		t.Fatalf("GetTranscript(%s) = %v, want nil", id, err)
	}
	if !hasUserText(transcript, "add a remember me box") {
		t.Error("the message is not in the transcript")
	}
}

func TestSendMessageReportsWhatTheUserGotWrong(t *testing.T) {
	t.Parallel()

	f, _, id := createdTask(t)

	if err := f.tasks.SendMessage(id, "prd", "  "); err == nil || err.Error() != "Write a message first." {
		t.Errorf("SendMessage() error = %v, want the empty message notice", err)
	}

	if err := f.tasks.Pause(id, "prd"); err != nil {
		t.Fatalf("Pause(%s) = %v, want nil", id, err)
	}
	if status := f.taskOf(t, id).SessionStatus; status != "paused" {
		t.Errorf("sessionStatus = %q, want paused", status)
	}
	if err := f.tasks.SendMessage(id, "prd", "hello"); err == nil || err.Error() != "Resume the task to send messages." {
		t.Errorf("SendMessage() error = %v, want the paused notice", err)
	}

	if err := f.tasks.Resume(id, "prd"); err != nil {
		t.Fatalf("Resume(%s) = %v, want nil", id, err)
	}
	if status := f.taskOf(t, id).SessionStatus; status == "paused" {
		t.Error("the session is still paused after Resume")
	}
}

func TestRemovePendingRejectsAnEntryThatIsNotQueued(t *testing.T) {
	t.Parallel()

	f, _, id := createdTask(t)

	if err := f.tasks.RemovePending(id, "prd", "nope"); err == nil {
		t.Fatal("RemovePending() = nil, want an error")
	}
	if !f.logged(t, "binding failed") {
		t.Error("the failure was not logged")
	}
}

func TestInterruptAndRetryLeaveTheSessionUsable(t *testing.T) {
	t.Parallel()

	f, _, id := createdTask(t)

	// Nothing is running, so the interrupt has nothing to abort and says so
	// by doing nothing at all.
	if err := f.tasks.Interrupt(id, "prd"); err != nil {
		t.Fatalf("Interrupt(%s) = %v, want nil", id, err)
	}
	if err := f.tasks.Retry(id, "prd"); err != nil {
		t.Fatalf("Retry(%s) = %v, want nil", id, err)
	}
	if err := f.tasks.SendMessage(id, "prd", "carry on"); err != nil {
		t.Fatalf("SendMessage(%s) = %v, want nil", id, err)
	}
	f.waitForStatus(t, id, "waiting")
}

func TestAnswerPermissionRejectsAnUnknownDecision(t *testing.T) {
	t.Parallel()

	f, _, id := createdTask(t)

	err := f.tasks.AnswerPermission(id, "prd", "req-1", "maybe", "")
	if err == nil {
		t.Fatal("AnswerPermission() = nil, want an error")
	}
	if !strings.Contains(err.Error(), "unknown decision") {
		t.Errorf("AnswerPermission() error = %q, want it to name the decision", err)
	}
}

func TestAnsweringWithoutAPendingRequestFails(t *testing.T) {
	t.Parallel()

	f, _, id := createdTask(t)

	if err := f.tasks.AnswerPermission(id, "prd", "req-1", "allow", ""); err == nil {
		t.Error("AnswerPermission() = nil, want an error")
	}
	if err := f.tasks.AnswerQuestion(id, "prd", "req-1", map[string]string{"Colour?": "Red"}); err == nil {
		t.Error("AnswerQuestion() = nil, want an error")
	}
}

func TestReadArtifactReturnsThePRD(t *testing.T) {
	t.Parallel()

	f, _, id := createdTask(t)

	if _, err := f.tasks.ReadArtifact(id, "PRD.md"); err == nil {
		t.Error("ReadArtifact() = nil, want an error before the PRD exists")
	}

	path := filepath.Join(task.ArtifactsDir(f.dataDir, "dev", "web", "login-screen"), "PRD.md")
	if err := os.WriteFile(path, []byte("# PRD\n"), 0o600); err != nil {
		t.Fatalf("WriteFile(%s) = %v, want nil", path, err)
	}

	content, err := f.tasks.ReadArtifact(id, "PRD.md")
	if err != nil {
		t.Fatalf("ReadArtifact(%s) = %v, want nil", id, err)
	}
	if content != "# PRD\n" {
		t.Errorf("ReadArtifact() = %q, want the file content", content)
	}
}

// hasUserText reports whether the transcript holds a user message with text.
func hasUserText(transcript bindings.Transcript, text string) bool {
	for _, entry := range transcript.Entries {
		if entry.Kind == "user" && entry.User != nil && entry.User.Text == text {
			return true
		}
	}
	return false
}

// writeBlock is what a seeded prompt carries for the fake CLI to write a file.
func writeBlock(path, content string) string {
	return "@@write " + path + "\n" + content + "\n@@end\n"
}

// stepFile is one step of a plan, as the fake CLI writes it.
func stepFile(number int, title string) string {
	return fmt.Sprintf("# Step %d: %s\n", number, title)
}

// The prompts that make the fake CLI finish a stage: each writes the artifact
// the stage waits for.
var (
	prdWriter      = writeBlock("{{prd_path}}", "# PRD")
	techSpecWriter = writeBlock("{{tech_spec_path}}", "# Tech spec")
	// The first step carries a write block of its own: the file is the prompt
	// of the step session, so the fake CLI writes hello.txt in the worktree it
	// runs in.
	planWriter = writeBlock("{{steps_dir}}/1-first.md", stepFile(1, "First")+writeBlock("hello.txt", "hi")) +
		writeBlock("{{steps_dir}}/2-second.md", stepFile(2, "Second"))
)

// registeredClone registers a repository whose clone is real: the steps of a
// plan are implemented in worktrees of it, which only git can make.
func registeredClone(t *testing.T) (*fixture, string) {
	t.Helper()

	f := newFixture(t)
	clone := gittest.Clone(t, gittest.Origin(t, true), filepath.Join(t.TempDir(), "web"))
	f.register(t, clone)
	return f, clone
}

// plannedTask walks a task through the three stages with prompts that write
// every artifact, leaving it in implementation.
func plannedTask(t *testing.T) (*fixture, string, string) {
	t.Helper()

	f, dir := registeredClone(t)
	f.seedPrompt(t, prompts.StagePRD, prdWriter)
	f.seedPrompt(t, prompts.StageTechSpec, techSpecWriter)
	f.seedPrompt(t, prompts.StagePlan, planWriter)

	id, err := f.tasks.CreateTask(newTask("login-screen"))
	if err != nil {
		t.Fatalf("CreateTask() = %v, want nil", err)
	}
	f.waitStage(t, id, "implementation")
	return f, dir, id
}

func TestPRDWrittenStartsTheTechSpec(t *testing.T) {
	t.Parallel()

	f, _ := registeredClone(t)
	f.seedPrompt(t, prompts.StagePRD, prdWriter)

	id, err := f.tasks.CreateTask(newTask("login-screen"))
	if err != nil {
		t.Fatalf("CreateTask() = %v, want nil", err)
	}
	f.waitStage(t, id, "tech_spec")

	if summary := f.taskOf(t, id); !summary.HasPRD || summary.Revisiting {
		t.Errorf("task = %+v, want the PRD written and no revisit", summary)
	}

	transcript := f.waitTranscript(t, id, "tech_spec")
	marker := transcript.Entries[0].Marker
	if marker == nil || marker.Type != "stage_started" || marker.Stage != "tech_spec" || marker.Restarted {
		t.Errorf("first entry = %+v, want the stage_started of the tech spec", transcript.Entries[0])
	}
}

func TestPlanWrittenReachesImplementation(t *testing.T) {
	t.Parallel()

	f, _, id := plannedTask(t)
	f.waitReviewed(t, id, 1)

	summary := f.taskOf(t, id)
	if !summary.HasPRD || !summary.HasTechSpec {
		t.Errorf("task = %+v, want the PRD and the tech spec written", summary)
	}
	if len(summary.PlanProblems) != 0 {
		t.Errorf("planProblems = %+v, want none", summary.PlanProblems)
	}
	if summary.CurrentStep != 1 {
		t.Errorf("currentStep = %d, want 1", summary.CurrentStep)
	}
	wt := worktree.Path(f.dataDir, "dev", "web", "login-screen")
	want := []bindings.Step{
		{
			Number: 1, File: "1-first.md", Title: "First",
			Status: "awaiting_review", WorktreePath: wt,
			// The step wrote hello.txt and nobody has staged it yet.
			Review: &bindings.Review{
				Files: []bindings.ReviewFile{{Path: "hello.txt", Kind: "untracked"}},
				Total: 1,
			},
			Model: "claude-opus-5-5[1m]", Effort: "high",
			ReviewMode: "manual", Reports: []bindings.StepReport{},
		},
		{
			Number: 2, File: "2-second.md", Title: "Second",
			Status: "not_started", WorktreePath: wt,
			Model: "claude-opus-5-5[1m]", Effort: "high", ModelEditable: true,
			ReviewMode: "manual", ReviewModeEditable: true, Reports: []bindings.StepReport{},
		},
	}
	if diff := cmp.Diff(want, summary.Steps); diff != "" {
		t.Errorf("steps mismatch (-want +got):\n%s", diff)
	}
}

func TestAStepRunsInTheWorktreeOfItsTask(t *testing.T) {
	t.Parallel()

	f, clone, id := plannedTask(t)
	step := f.waitReviewed(t, id, 1)

	wt := worktree.Path(f.dataDir, "dev", "web", "login-screen")
	if step.WorktreePath != wt {
		t.Errorf("worktreePath = %q, want %q", step.WorktreePath, wt)
	}
	if _, err := os.Stat(wt); err != nil {
		t.Errorf("Stat(%s) = %v, want the worktree to exist", wt, err)
	}
	if !hasBranch(t, clone, "login-screen") {
		t.Error("the branch of the task does not exist in the repository")
	}
	// The session of the step ran in the worktree, so what the agent wrote is
	// in it and not in the repository it came from.
	if _, err := os.Stat(filepath.Join(wt, "hello.txt")); err != nil {
		t.Errorf("Stat(hello.txt in the worktree) = %v, want the file the step wrote", err)
	}
	if _, err := os.Stat(filepath.Join(clone, "hello.txt")); !os.IsNotExist(err) {
		t.Errorf("Stat(hello.txt in the repository) = %v, want the repository untouched", err)
	}
}

func TestTheConversationOfAStepIsItsOwn(t *testing.T) {
	t.Parallel()

	f, _, id := plannedTask(t)
	f.waitStep(t, id, 1, "awaiting_review")

	transcript := f.waitTranscript(t, id, "step:1")
	marker := transcript.Entries[0].Marker
	if marker == nil || marker.Type != "step_started" || marker.Step != 1 || marker.Restarted {
		t.Errorf("first entry = %+v, want the first step_started of step 1", transcript.Entries[0])
	}
}

func TestDiscardingAStepBlocksOnTheWorkItLeftBehind(t *testing.T) {
	t.Parallel()

	f, _, id := plannedTask(t)
	f.waitReviewed(t, id, 1)

	// The step wrote hello.txt, so its worktree is dirty and starting over
	// without cleaning it cannot go through.
	if err := f.tasks.DiscardStep(id, false); err != nil {
		t.Fatalf("DiscardStep(%s, false) = %v, want nil", id, err)
	}
	step := f.waitStep(t, id, 1, "blocked")
	if step.Block == nil || step.Block.Reason != "dirty_worktree" || step.Block.Files != 1 {
		t.Fatalf("block = %+v, want one dirty file", step.Block)
	}
	if !strings.Contains(step.Block.Detail, "hello.txt") {
		t.Errorf("detail = %q, want it to name the file git listed", step.Block.Detail)
	}

	if err := f.tasks.CleanAndStartStep(id); err != nil {
		t.Fatalf("CleanAndStartStep(%s) = %v, want nil", id, err)
	}
	f.waitReviewed(t, id, 1)

	// The new session ran the step file again, in the cleaned worktree.
	path := filepath.Join(worktree.Path(f.dataDir, "dev", "web", "login-screen"), "hello.txt")
	if _, err := os.Stat(path); err != nil {
		t.Errorf("Stat(%s) = %v, want the file written again", path, err)
	}
}

func TestStepOperationsReportWhatTheUserGotWrong(t *testing.T) {
	t.Parallel()

	f, _, id := plannedTask(t)
	f.waitStep(t, id, 1, "awaiting_review")

	tests := []struct {
		name string
		call func() error
		want string
	}{
		{
			name: "retry a step that is not blocked",
			call: func() error { return f.tasks.RetryStep(id) },
			want: "The step isn't blocked.",
		},
		{
			name: "clean a step that is not blocked by a dirty worktree",
			call: func() error { return f.tasks.CleanAndStartStep(id) },
			want: "The worktree isn't what blocks the step.",
		},
		{
			// The task runs its steps in the mode it was created with, manual.
			name: "take over the review of a step the agent isn't reviewing",
			call: func() error { return f.tasks.ReviewStepMyself(id) },
			want: "The agent isn't reviewing this step.",
		},
		{
			name: "set an unknown review mode on a step",
			call: func() error { return f.tasks.SetStepReviewMode(id, 1, "auto") },
			want: "Unknown review mode.",
		},
	}

	for _, tt := range tests {
		if err := tt.call(); err == nil || err.Error() != tt.want {
			t.Errorf("%s: error = %v, want %q", tt.name, err, tt.want)
		}
	}
	if f.logged(t, "binding failed") {
		t.Error("a mistake the user can correct was logged as a failure")
	}
}

func TestPullRequestOperationsReportWhatTheUserGotWrong(t *testing.T) {
	t.Parallel()

	f, _, id := plannedTask(t)
	f.waitStep(t, id, 1, "awaiting_review")

	// The task is still implementing: it is not in the PR stage, and none of
	// these calls has anything to act on.
	tests := []struct {
		name string
		call func() error
	}{
		{"open a pull request", func() error { return f.tasks.OpenPR(id, "A title", "A body") }},
		{"approve a review", func() error { return f.tasks.ApprovePR(id) }},
		{"review again", func() error { return f.tasks.ReviewAgain(id) }},
		{"discard a draft", func() error { return f.tasks.DiscardDraft(id) }},
		{"retry the stage", func() error { return f.tasks.RetryPR(id) }},
		{"refresh a pull request", func() error { return f.tasks.RefreshPR(id) }},
		{"close the task", func() error { return f.tasks.CloseTask(id) }},
	}

	const want = "The task isn't in the pull request stage."
	for _, tt := range tests {
		if err := tt.call(); err == nil || err.Error() != want {
			t.Errorf("%s: error = %v, want %q", tt.name, err, want)
		}
	}
	if f.logged(t, "binding failed") {
		t.Error("a mistake the user can correct was logged as a failure")
	}
}

func TestOpenInEditorOpensTheWorktreeOfTheTask(t *testing.T) {
	t.Parallel()

	f, _, id := createdTask(t)
	if err := f.tasks.OpenInEditor(id); err == nil || err.Error() != "The worktree doesn't exist yet." {
		t.Errorf("OpenInEditor() error = %v, want the missing worktree notice", err)
	}

	planned, _, plannedID := plannedTask(t)
	planned.waitStep(t, plannedID, 1, "awaiting_review")

	if err := planned.tasks.OpenInEditor(plannedID); err != nil {
		t.Fatalf("OpenInEditor(%s) = %v, want nil", plannedID, err)
	}
	want := []string{worktree.Path(planned.dataDir, "dev", "web", "login-screen")}
	if diff := cmp.Diff(want, planned.editor.opened()); diff != "" {
		t.Errorf("opened folders mismatch (-want +got):\n%s", diff)
	}
}

func TestApprovingAStepSendsTheCommitPromptToTheAgent(t *testing.T) {
	t.Parallel()

	f, _, id := plannedTask(t)
	f.seedPrompt(t, prompts.StageCommit, "Commit what is staged of {{task_name}}.")
	f.waitReviewed(t, id, 1)

	// The step wrote hello.txt; staging it is the user reading it.
	wt := worktree.Path(f.dataDir, "dev", "web", "login-screen")
	gittest.Run(t, wt, "add", "hello.txt")

	step := f.waitStep(t, id, 1, "ready_to_approve")
	want := &bindings.Review{
		Files:   []bindings.ReviewFile{{Path: "hello.txt", Kind: "added", Staged: true}},
		Staged:  1,
		Total:   1,
		Percent: 100,
	}
	if diff := cmp.Diff(want, step.Review); diff != "" {
		t.Errorf("review mismatch (-want +got):\n%s", diff)
	}

	if err := f.tasks.ApproveStep(id); err != nil {
		t.Fatalf("ApproveStep(%s) = %v, want nil", id, err)
	}
	// The fake agent answers without committing, so the branch stays where it
	// was and the app hands the step back with the warning.
	after := f.waitStepWhere(t, id, 1, "the step back with the commit warning", func(step bindings.Step) bool {
		return step.Status == "ready_to_approve" && step.CommitFailed
	})
	if after.Review == nil || after.Review.Percent != 100 {
		t.Errorf("review = %+v, want the reading that was there before", after.Review)
	}

	transcript, err := f.tasks.GetTranscript(id, "step:1")
	if err != nil {
		t.Fatalf("GetTranscript(%s) = %v, want nil", id, err)
	}
	if !hasAppMessage(transcript.Entries, "Commit what is staged of login-screen.") {
		t.Error("the commit prompt did not reach the conversation as a message of the app")
	}
}

func TestApprovingAStepThatIsNotWholeReadTellsTheUser(t *testing.T) {
	t.Parallel()

	f, _, id := plannedTask(t)
	// The step wrote a file nobody has staged: there is nothing to approve.
	f.waitReviewed(t, id, 1)

	err := f.tasks.ApproveStep(id)
	if err == nil || err.Error() != "Stage every changed file before approving." {
		t.Errorf("ApproveStep() error = %v, want the unfinished review notice", err)
	}
	if f.logged(t, "binding failed") {
		t.Error("a mistake the user can correct was logged as a failure")
	}
}

func TestOpenFileInEditorOpensTheFileInTheWindowOfTheWorktree(t *testing.T) {
	t.Parallel()

	f, _, id := plannedTask(t)
	f.waitReviewed(t, id, 1)

	if err := f.tasks.OpenFileInEditor(id, "hello.txt"); err != nil {
		t.Fatalf("OpenFileInEditor(%s) = %v, want nil", id, err)
	}
	wt := worktree.Path(f.dataDir, "dev", "web", "login-screen")
	want := []string{wt + " " + filepath.Join(wt, "hello.txt")}
	if diff := cmp.Diff(want, f.editor.opened()); diff != "" {
		t.Errorf("opened paths mismatch (-want +got):\n%s", diff)
	}
}

func TestOpenFileInEditorRefusesWhatIsNotOfTheTask(t *testing.T) {
	t.Parallel()

	f, _, id := plannedTask(t)
	f.waitReviewed(t, id, 1)

	tests := []struct {
		name string
		path string
	}{
		{"an absolute path", "/etc/passwd"},
		{"a path that goes up", "../secrets.txt"},
		{"a path that goes up the long way", "sub/../../secrets.txt"},
		{"the parent of the worktree", ".."},
	}

	for _, tt := range tests {
		err := f.tasks.OpenFileInEditor(id, tt.path)
		if err == nil || err.Error() != "This file is not in the worktree of the task." {
			t.Errorf("%s: error = %v, want the outside notice", tt.name, err)
		}
	}
	if opened := f.editor.opened(); len(opened) != 0 {
		t.Errorf("opened paths = %q, want none", opened)
	}
	if f.logged(t, "binding failed") {
		t.Error("a mistake the user can correct was logged as a failure")
	}
}

func TestOpenFileInEditorNeedsAWorktree(t *testing.T) {
	t.Parallel()

	f, _, id := createdTask(t)
	err := f.tasks.OpenFileInEditor(id, "hello.txt")
	if err == nil || err.Error() != "The worktree doesn't exist yet." {
		t.Errorf("OpenFileInEditor() error = %v, want the missing worktree notice", err)
	}
}

func TestDiscardingThePlanRemovesTheWorktrees(t *testing.T) {
	t.Parallel()

	f, clone, id := plannedTask(t)
	f.waitStep(t, id, 1, "awaiting_review")
	wt := worktree.Path(f.dataDir, "dev", "web", "login-screen")

	if err := f.tasks.DiscardStage(id, "plan"); err != nil {
		t.Fatalf("DiscardStage(%s, plan) = %v, want nil", id, err)
	}
	f.waitStage(t, id, "plan")

	assertWorktreeGone(t, wt, clone)
	if steps := f.taskOf(t, id).Steps; len(steps) != 0 {
		t.Errorf("steps = %+v, want the plan thrown away", steps)
	}
}

func TestDeleteTaskRemovesTheWorktrees(t *testing.T) {
	t.Parallel()

	f, clone, id := plannedTask(t)
	f.waitStep(t, id, 1, "awaiting_review")
	wt := worktree.Path(f.dataDir, "dev", "web", "login-screen")

	result, err := f.tasks.DeleteTask(id)
	if err != nil {
		t.Fatalf("DeleteTask(%s) = %v, want nil", id, err)
	}
	if result.Leftover != nil {
		t.Errorf("leftover = %+v, want nothing left behind", result.Leftover)
	}
	if tasks := f.state.GetState().Tasks; len(tasks) != 0 {
		t.Errorf("state has %d tasks, want none", len(tasks))
	}
	assertWorktreeGone(t, wt, clone)
}

func TestPreviewDeleteSaysWhatTheDeletionWouldDestroy(t *testing.T) {
	t.Parallel()

	f, _, id := plannedTask(t)
	// The preview reads the worktree, so the step has to have written to it.
	f.waitReviewed(t, id, 1)

	preview, err := f.tasks.PreviewDelete(id)
	if err != nil {
		t.Fatalf("PreviewDelete(%s) = %v, want nil", id, err)
	}

	want := worktree.Path(f.dataDir, "dev", "web", "login-screen")
	if preview.Worktree == nil || preview.Worktree.Path != want {
		t.Errorf("worktree = %+v, want the one of the task", preview.Worktree)
	}
	// The step wrote a file the user has not committed yet.
	if !preview.Worktree.Dirty || preview.Worktree.Files == 0 {
		t.Errorf("worktree = %+v, want the work it holds counted", preview.Worktree)
	}
	if preview.Branch == nil || preview.Branch.Name != "login-screen" {
		t.Errorf("branch = %+v, want the branch of the task", preview.Branch)
	}
	// The task never reached the pull request stage.
	if preview.PR != nil {
		t.Errorf("pull request = %+v, want none", preview.PR)
	}
}

// assertWorktreeGone checks that neither the worktree of a task nor its branch
// is left in the repository.
func assertWorktreeGone(t *testing.T, wt, repo string) {
	t.Helper()

	if _, err := os.Stat(wt); !os.IsNotExist(err) {
		t.Errorf("Stat(%s) = %v, want the worktree to be gone", wt, err)
	}
	if hasBranch(t, repo, "login-screen") {
		t.Error("the branch of the task is still in the repository")
	}
}

// hasBranch reports whether repo has a local branch by that name.
func hasBranch(t *testing.T, repo, branch string) bool {
	t.Helper()

	return gittest.Run(t, repo, "branch", "--list", branch) != ""
}

func TestInvalidPlanIsCorrected(t *testing.T) {
	t.Parallel()

	f, _ := registeredClone(t)
	f.seedPrompt(t, prompts.StagePRD, prdWriter)
	f.seedPrompt(t, prompts.StageTechSpec, techSpecWriter)
	f.seedPrompt(t, prompts.StagePlan, writeBlock("{{steps_dir}}/1-first.md", "Just a paragraph.\n"))
	f.fixStep(filepath.Join(task.ArtifactsDir(f.dataDir, "dev", "web", "login-screen"), "steps", "1-first.md"))

	id, err := f.tasks.CreateTask(newTask("login-screen"))
	if err != nil {
		t.Fatalf("CreateTask() = %v, want nil", err)
	}
	f.waitStage(t, id, "implementation")
	f.waitCorrected(t, id, "1-first.md")

	// The stage is past the plan, so no other correction can follow.
	if got := f.correctionCount(id); got != 1 {
		t.Errorf("corrections = %d, want 1", got)
	}
}

func TestBackToPRDReopensTheConversation(t *testing.T) {
	t.Parallel()

	f, _, id := taskWithPRD(t)
	f.waitStage(t, id, "tech_spec")

	if err := f.tasks.BackToStage(id, "prd"); err != nil {
		t.Fatalf("BackToStage(%s) = %v, want nil", id, err)
	}

	summary := f.taskOf(t, id)
	if summary.Stage != "prd" || !summary.Revisiting {
		t.Errorf("task = %+v, want the PRD stage revisited", summary)
	}
	f.waitContinue(t, id)

	transcript, err := f.tasks.GetTranscript(id, "prd")
	if err != nil {
		t.Fatalf("GetTranscript(%s) = %v, want nil", id, err)
	}
	if transcript.Stage != "prd" {
		t.Errorf("stage = %q, want prd", transcript.Stage)
	}
	if !hasUserText(transcript, "a login screen with email and password") {
		t.Error("the conversation of the PRD did not come back")
	}

	if err := f.tasks.ContinueStage(id); err != nil {
		t.Fatalf("ContinueStage(%s) = %v, want nil", id, err)
	}
	f.waitStage(t, id, "tech_spec")

	path := filepath.Join(task.ArtifactsDir(f.dataDir, "dev", "web", "login-screen"), "PRD.md")
	if _, err := os.Stat(path); err != nil {
		t.Errorf("Stat(%s) = %v, want the PRD to be kept", path, err)
	}
}

func TestDiscardRestartsTheStage(t *testing.T) {
	t.Parallel()

	f, _, id := taskWithPRD(t)
	f.waitStage(t, id, "tech_spec")

	if err := f.tasks.DiscardStage(id, "prd"); err != nil {
		t.Fatalf("DiscardStage(%s) = %v, want nil", id, err)
	}
	f.waitStage(t, id, "prd")

	if summary := f.taskOf(t, id); summary.HasPRD || summary.Revisiting {
		t.Errorf("task = %+v, want the PRD thrown away and no revisit", summary)
	}
	path := filepath.Join(task.ArtifactsDir(f.dataDir, "dev", "web", "login-screen"), "PRD.md")
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Errorf("Stat(%s) = %v, want the PRD to be gone", path, err)
	}

	transcript := f.waitTranscript(t, id, "prd")
	marker := transcript.Entries[0].Marker
	if marker == nil || marker.Type != "stage_started" || marker.Stage != "prd" || !marker.Restarted {
		t.Errorf("first entry = %+v, want a restarted stage_started of the PRD", transcript.Entries[0])
	}
}

func TestContinueRequiresAFinishedStage(t *testing.T) {
	t.Parallel()

	f, _, id := createdTask(t)

	tests := []struct {
		name string
		call func() error
		want string
	}{
		{
			name: "continue without a revisit",
			call: func() error { return f.tasks.ContinueStage(id) },
			want: "The task isn't revisiting a stage.",
		},
		{
			name: "back to a stage that is not one",
			call: func() error { return f.tasks.BackToStage(id, "review") },
			want: "Unknown stage.",
		},
		{
			name: "back to a stage not reached yet",
			call: func() error { return f.tasks.BackToStage(id, "tech_spec") },
			want: "This stage can't be reached from here.",
		},
		{
			name: "discard a stage not reached yet",
			call: func() error { return f.tasks.DiscardStage(id, "plan") },
			want: "This stage can't be reached from here.",
		},
	}

	for _, tt := range tests {
		if err := tt.call(); err == nil || err.Error() != tt.want {
			t.Errorf("%s: error = %v, want %q", tt.name, err, tt.want)
		}
	}
	if f.logged(t, "binding failed") {
		t.Error("a mistake the user can correct was logged as a failure")
	}
}

// taskWithPRD creates a task whose prompts write nothing and puts a PRD in its
// folder, which is what ends the stage without the agent finishing anything
// else.
func taskWithPRD(t *testing.T) (*fixture, string, string) {
	t.Helper()

	f, dir, id := createdTask(t)
	path := filepath.Join(task.ArtifactsDir(f.dataDir, "dev", "web", "login-screen"), "PRD.md")
	if err := os.WriteFile(path, []byte("# PRD\n"), 0o600); err != nil {
		t.Fatalf("WriteFile(%s) = %v, want nil", path, err)
	}
	return f, dir, id
}

// hasAppMessage reports whether the app wrote a message naming file.
func hasAppMessage(entries []bindings.Entry, file string) bool {
	for _, entry := range entries {
		if entry.User != nil && entry.User.App && strings.Contains(entry.User.Text, file) {
			return true
		}
	}
	return false
}

// cardTask is the request for a task created from the card dev/web#number.
func cardTask(name string, number int) bindings.CreateTaskRequest {
	return bindings.CreateTaskRequest{
		Name:           name,
		InitialContext: "Keep the form short.",
		Card:           &bindings.CreateTaskCard{BoardID: testBoardID, Key: fmt.Sprintf("dev/web#%d", number)},
	}
}

func TestCreateTaskFromACardKeepsTheCardAndTheAssembledContext(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())
	card := webCard(12)
	f.registerBoard(t, true, card)

	id, err := f.tasks.CreateTask(cardTask("12-add-the-login-screen", 12))
	if err != nil {
		t.Fatalf("CreateTask() = %v, want nil", err)
	}
	f.waitForStatus(t, id, "waiting")

	created, ok := f.taskSvc.Get(id)
	if !ok {
		t.Fatalf("task %s was not created", id)
	}
	if want := board.Context(card, "", "Keep the form short."); created.InitialContext != want {
		t.Errorf("initial context = %q, want %q", created.InitialContext, want)
	}
	wantCard := &bindings.TaskCard{
		BoardID: testBoardID, Key: "dev/web#12", Repository: "dev/web", Number: 12,
		Title: "Add the login screen", URL: "https://github.com/dev/web/issues/12", Status: "Todo", State: "open",
		Epic: &bindings.CardIssue{
			Key: "dev/web#1", Repository: "dev/web", Number: 1, Title: "Auth", URL: "https://github.com/dev/web/issues/1",
		},
	}
	got := f.taskOf(t, id)
	if diff := cmp.Diff(wantCard, got.Card); diff != "" {
		t.Errorf("card mismatch (-want +got):\n%s", diff)
	}
	if got.RepositoryID != testRepoID {
		t.Errorf("repositoryId = %q, want %q", got.RepositoryID, testRepoID)
	}
	if boards := f.state.GetState().Boards; len(boards) != 1 || boards[0].Cards[0].Action != "has_task" {
		t.Errorf("boards = %+v, want the card with its active task", boards)
	}
}

func TestCreateTaskRefusesACardTheBoardCannotStart(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		managed bool
		number  int
		want    string
	}{
		{"a repository the board does not manage", false, 12, "dev/web isn't managed by this board."},
		{"a card outside the reading", true, 99, "This card isn't in the last reading of the board."},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			f.register(t, t.TempDir())
			f.registerBoard(t, tt.managed, webCard(12))

			_, err := f.tasks.CreateTask(cardTask("12-add-the-login-screen", tt.number))
			if err == nil || err.Error() != tt.want {
				t.Errorf("CreateTask() = %v, want %q", err, tt.want)
			}
			if tasks := f.taskSvc.List(); len(tasks) != 0 {
				t.Errorf("tasks = %+v, want none", tasks)
			}
		})
	}
}

func TestCreateTaskRefusesASecondActiveTaskForTheCard(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())
	f.registerBoard(t, true, webCard(12))

	id, err := f.tasks.CreateTask(cardTask("first", 12))
	if err != nil {
		t.Fatalf("CreateTask(first) = %v, want nil", err)
	}
	f.waitForStatus(t, id, "waiting")

	_, err = f.tasks.CreateTask(cardTask("second", 12))
	if want := "Card #12 already has an active task: first."; err == nil || err.Error() != want {
		t.Errorf("CreateTask(second) = %v, want %q", err, want)
	}
}

// reviewedTask is a task under the review of its pull request, with a
// structured first pass whose report lists a finding about the pull request as
// a whole and one about a line.
func reviewedTask(t *testing.T) (*fixture, string) {
	t.Helper()

	f, _, id := createdTask(t)
	ctx := t.Context()
	if _, err := f.taskSvc.SetStage(ctx, id, task.StagePR, false); err != nil {
		t.Fatalf("SetStage() = %v, want nil", err)
	}
	if _, err := f.taskSvc.SetPRRun(ctx, id, task.PRReviewing, nil); err != nil {
		t.Fatalf("SetPRRun() = %v, want nil", err)
	}
	if _, err := f.taskSvc.AskPRPass(ctx, id, 1); err != nil {
		t.Fatalf("AskPRPass() = %v, want nil", err)
	}
	report := prreport.Report{
		Pass:    1,
		Summary: "Two things to look at.",
		Findings: []prreport.ParsedFinding{
			{Number: 1, Text: "The pull request has no tests."},
			{Number: 2, Path: "main.go", Line: 12, Text: "Handle the error."},
		},
	}
	if _, _, err := f.taskSvc.RecordPRReport(ctx, id, report); err != nil {
		t.Fatalf("RecordPRReport() = %v, want nil", err)
	}
	return f, id
}

func TestDecidePRFindingRejectsAnUnknownDecision(t *testing.T) {
	t.Parallel()

	f, id := reviewedTask(t)

	err := f.tasks.DecidePRFinding(id, 1, 1, "maybe")

	if err == nil || err.Error() != "Unknown decision." {
		t.Errorf("DecidePRFinding(maybe) = %v, want the sentence about an unknown decision", err)
	}
}

func TestApplyingFindingsWithNoneApprovedSaysSo(t *testing.T) {
	t.Parallel()

	f, id := reviewedTask(t)
	for _, number := range []int{1, 2} {
		if err := f.taskSvc.DecidePRFinding(t.Context(), id, 1, number, prreport.DecisionDiscarded); err != nil {
			t.Fatalf("DecidePRFinding(%d) = %v, want nil", number, err)
		}
	}

	if err := f.tasks.ApplyPRFindings(id); err == nil || err.Error() != "No finding is approved." {
		t.Errorf("ApplyPRFindings() = %v, want the sentence about no finding approved", err)
	}
}

func TestAFindingARewriteRemovedSaysItNoLongerExists(t *testing.T) {
	t.Parallel()

	f, id := reviewedTask(t)
	rewrite := prreport.Report{
		Pass: 1, Summary: "One thing to look at.",
		Findings: []prreport.ParsedFinding{{Number: 1, Text: "The pull request has no tests."}},
	}
	if _, _, err := f.taskSvc.RecordPRReport(t.Context(), id, rewrite); err != nil {
		t.Fatalf("RecordPRReport(rewrite) = %v, want nil", err)
	}

	if err := f.tasks.DecidePRFinding(id, 1, 2, "approved"); err == nil ||
		err.Error() != "This finding no longer exists." {
		t.Errorf("DecidePRFinding(removed) = %v, want the sentence about a finding that is gone", err)
	}
	if err := f.tasks.SetPRFindingText(id, 1, 2, "Handle it."); err == nil ||
		err.Error() != "This finding no longer exists." {
		t.Errorf("SetPRFindingText(removed) = %v, want the sentence about a finding that is gone", err)
	}
}

func TestOpeningAFindingOfAPullRequestThatIsGoneOrGeneralIsRefused(t *testing.T) {
	t.Parallel()

	f, id := reviewedTask(t)

	if err := f.tasks.OpenPRFindingInEditor(id, 1, 1); err == nil ||
		err.Error() != "This finding isn't about a line of the pull request." {
		t.Errorf("OpenPRFindingInEditor(general) = %v, want the sentence about a finding of no file", err)
	}
	if err := f.tasks.OpenPRFindingInEditor(id, 1, 9); err == nil ||
		err.Error() != "This finding no longer exists." {
		t.Errorf("OpenPRFindingInEditor(unknown finding) = %v, want the sentence about a finding that is gone", err)
	}
	if opened := f.editor.opened(); len(opened) != 0 {
		t.Errorf("the editor was asked to open %v, want nothing", opened)
	}
}
