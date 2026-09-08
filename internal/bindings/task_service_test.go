package bindings_test

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/git/gittest"
	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/task"
	"github.com/guilhermt/myspec/internal/worktree"
)

// newTask is the request every test starts from.
func newTask(name string) bindings.CreateTaskRequest {
	return bindings.CreateTaskRequest{
		Name:           name,
		InitialContext: "a login screen with email and password",
	}
}

// createdTask opens a workspace, creates one task in it and waits for its
// session to settle. It returns the fixture, the workspace path and the id.
func createdTask(t *testing.T) (*fixture, string, string) {
	t.Helper()

	f := newFixture(t)
	dir := t.TempDir()
	f.open(t, dir)

	id, err := f.tasks.CreateTask(newTask("login-screen"))
	if err != nil {
		t.Fatalf("CreateTask() = %v, want nil", err)
	}
	f.waitForStatus(t, id, "waiting")
	return f, dir, id
}

func TestCreateTaskAddsTheTaskToTheState(t *testing.T) {
	t.Parallel()

	f, dir, id := createdTask(t)

	got := f.taskOf(t, id)
	want := bindings.TaskSummary{
		ID:            id,
		Name:          "login-screen",
		Dir:           dir,
		Stage:         "prd",
		SessionStatus: "waiting",
		Steps:         []bindings.Step{},
		Repos:         []bindings.RepoPR{},
		PlanProblems:  []bindings.PlanProblem{},
		CreatedAt:     got.CreatedAt,
		UpdatedAt:     got.UpdatedAt,
	}
	// The context percentage depends on the tokens the fake reports, and the
	// process may still be idling; neither belongs in this comparison.
	got.ContextPercent = 0
	got.ProcessRunning = false
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("task mismatch (-want +got):\n%s", diff)
	}
}

func TestCreateTaskReportsWhatTheUserGotWrong(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	dir := t.TempDir()
	f.open(t, dir)

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
			name: "name taken",
			req:  newTask("login-screen"),
			want: "A task with this name already exists in this workspace.",
		},
		{
			name: "no context",
			req:  bindings.CreateTaskRequest{Name: "checkout"},
			want: "Describe what you want to build.",
		},
		{
			name: "repository outside the workspace",
			req:  bindings.CreateTaskRequest{Name: "checkout", RepoPath: "/elsewhere/api", InitialContext: "a checkout"},
			want: "This repository is not part of the workspace.",
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

func TestDeleteTaskRemovesTheTaskAndItsFolder(t *testing.T) {
	t.Parallel()

	f, dir, id := createdTask(t)
	artifacts := task.ArtifactsDir(f.dataDir, dir, "login-screen")

	if err := f.tasks.DeleteTask(id); err != nil {
		t.Fatalf("DeleteTask(%s) = %v, want nil", id, err)
	}
	if tasks := f.workspace.GetState().Tasks; len(tasks) != 0 {
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

	f, dir, id := createdTask(t)

	if _, err := f.tasks.ReadArtifact(id, "PRD.md"); err == nil {
		t.Error("ReadArtifact() = nil, want an error before the PRD exists")
	}

	path := filepath.Join(task.ArtifactsDir(f.dataDir, dir, "login-screen"), "PRD.md")
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
func stepFile(number int, title, repo string) string {
	return fmt.Sprintf("---\nrepository: %s\n---\n\n# Step %d: %s\n", repo, number, title)
}

// The prompts that make the fake CLI finish a stage: each writes the artifact
// the stage waits for.
var (
	prdWriter      = writeBlock("{{prd_path}}", "# PRD")
	techSpecWriter = writeBlock("{{tech_spec_path}}", "# Tech spec")
	// The first step carries a write block of its own: the file is the prompt
	// of the step session, so the fake CLI writes hello.txt in the worktree it
	// runs in.
	planWriter = writeBlock("{{steps_dir}}/1-first.md", stepFile(1, "First", "api")+writeBlock("hello.txt", "hi")) +
		writeBlock("{{steps_dir}}/2-second.md", stepFile(2, "Second", "api"))
)

// repoWorkspace opens a workspace holding one repository, which is what a plan
// names in its step files.
func repoWorkspace(t *testing.T) (*fixture, string) {
	t.Helper()

	f := newFixture(t)
	dir := t.TempDir()
	// api is a real clone: the steps of a plan are implemented in worktrees of
	// it, which only git can make.
	gittest.Clone(t, gittest.Origin(t, true), filepath.Join(dir, "api"))
	f.setScan([]string{filepath.Join(dir, "api")}, nil)
	f.open(t, dir)
	return f, dir
}

// plannedTask walks a task through the three stages with prompts that write
// every artifact, leaving it in implementation.
func plannedTask(t *testing.T) (*fixture, string, string) {
	t.Helper()

	f, dir := repoWorkspace(t)
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

	f, _ := repoWorkspace(t)
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

	f, dir, id := plannedTask(t)
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
	repo := filepath.Join(dir, "api")
	wt := worktree.Path(dir, "api", "login-screen")
	want := []bindings.Step{
		{
			Number: 1, File: "1-first.md", Title: "First",
			Repository: "api", RepoPath: repo, Status: "awaiting_review", WorktreePath: wt,
			// The step wrote hello.txt and nobody has staged it yet.
			Review: &bindings.Review{
				Files: []bindings.ReviewFile{{Path: "hello.txt", Kind: "untracked"}},
				Total: 1,
			},
		},
		{
			Number: 2, File: "2-second.md", Title: "Second",
			Repository: "api", RepoPath: repo, Status: "not_started", WorktreePath: wt,
		},
	}
	if diff := cmp.Diff(want, summary.Steps); diff != "" {
		t.Errorf("steps mismatch (-want +got):\n%s", diff)
	}
}

func TestAStepRunsInAWorktreeOfItsRepository(t *testing.T) {
	t.Parallel()

	f, dir, id := plannedTask(t)
	step := f.waitReviewed(t, id, 1)

	wt := worktree.Path(dir, "api", "login-screen")
	if step.WorktreePath != wt {
		t.Errorf("worktreePath = %q, want %q", step.WorktreePath, wt)
	}
	if _, err := os.Stat(wt); err != nil {
		t.Errorf("Stat(%s) = %v, want the worktree to exist", wt, err)
	}
	if !hasBranch(t, filepath.Join(dir, "api"), "login-screen") {
		t.Error("the branch of the task does not exist in the repository")
	}
	// The session of the step ran in the worktree, so what the agent wrote is
	// in it and not in the repository it came from.
	if _, err := os.Stat(filepath.Join(wt, "hello.txt")); err != nil {
		t.Errorf("Stat(hello.txt in the worktree) = %v, want the file the step wrote", err)
	}
	if _, err := os.Stat(filepath.Join(dir, "api", "hello.txt")); !os.IsNotExist(err) {
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

	f, dir, id := plannedTask(t)
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
	path := filepath.Join(worktree.Path(dir, "api", "login-screen"), "hello.txt")
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

	f, dir, id := plannedTask(t)
	f.waitStep(t, id, 1, "awaiting_review")
	repoPath := filepath.Join(dir, "api")

	// The task is still implementing: it has no repository of the PR stage,
	// and none of these calls has anything to act on.
	tests := []struct {
		name string
		call func() error
	}{
		{"open a pull request", func() error { return f.tasks.OpenPR(id, repoPath, "A title", "A body") }},
		{"approve a review", func() error { return f.tasks.ApproveRepo(id, repoPath) }},
		{"review again", func() error { return f.tasks.ReviewAgain(id, repoPath) }},
		{"discard a draft", func() error { return f.tasks.DiscardDraft(id, repoPath) }},
		{"retry a repository", func() error { return f.tasks.RetryRepo(id, repoPath) }},
		{"refresh a pull request", func() error { return f.tasks.RefreshPR(id, repoPath) }},
		{"open a repository in the editor", func() error { return f.tasks.OpenInEditor(id, repoPath) }},
		{"open a file of a repository", func() error { return f.tasks.OpenFileInEditor(id, repoPath, "main.go") }},
	}

	const want = "This repository isn't part of the task."
	for _, tt := range tests {
		if err := tt.call(); err == nil || err.Error() != want {
			t.Errorf("%s: error = %v, want %q", tt.name, err, want)
		}
	}
	if f.logged(t, "binding failed") {
		t.Error("a mistake the user can correct was logged as a failure")
	}
}

func TestOpenInEditorOpensTheWorktreeOfTheStep(t *testing.T) {
	t.Parallel()

	f, _, id := createdTask(t)
	if err := f.tasks.OpenInEditor(id, ""); err == nil || err.Error() != "The task has no step to run." {
		t.Errorf("OpenInEditor() error = %v, want the missing step notice", err)
	}

	planned, dir, plannedID := plannedTask(t)
	planned.waitStep(t, plannedID, 1, "awaiting_review")

	if err := planned.tasks.OpenInEditor(plannedID, ""); err != nil {
		t.Fatalf("OpenInEditor(%s) = %v, want nil", plannedID, err)
	}
	want := []string{worktree.Path(dir, "api", "login-screen")}
	if diff := cmp.Diff(want, planned.editor.opened()); diff != "" {
		t.Errorf("opened folders mismatch (-want +got):\n%s", diff)
	}
}

func TestApprovingAStepSendsTheCommitPromptToTheAgent(t *testing.T) {
	t.Parallel()

	f, dir, id := plannedTask(t)
	f.seedPrompt(t, prompts.StageCommit, "Commit what is staged of {{task_name}}.")
	f.waitReviewed(t, id, 1)

	// The step wrote hello.txt; staging it is the user reading it.
	wt := worktree.Path(dir, "api", "login-screen")
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

	f, dir, id := plannedTask(t)
	f.waitReviewed(t, id, 1)

	if err := f.tasks.OpenFileInEditor(id, "", "hello.txt"); err != nil {
		t.Fatalf("OpenFileInEditor(%s) = %v, want nil", id, err)
	}
	wt := worktree.Path(dir, "api", "login-screen")
	want := []string{wt + " " + filepath.Join(wt, "hello.txt")}
	if diff := cmp.Diff(want, f.editor.opened()); diff != "" {
		t.Errorf("opened paths mismatch (-want +got):\n%s", diff)
	}
}

func TestOpenFileInEditorRefusesWhatIsNotOfTheStep(t *testing.T) {
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
		err := f.tasks.OpenFileInEditor(id, "", tt.path)
		if err == nil || err.Error() != "This file is not in the worktree of the step." {
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

func TestOpenFileInEditorNeedsAStepWithAWorktree(t *testing.T) {
	t.Parallel()

	f, _, id := createdTask(t)
	err := f.tasks.OpenFileInEditor(id, "", "hello.txt")
	if err == nil || err.Error() != "The task has no step to run." {
		t.Errorf("OpenFileInEditor() error = %v, want the missing step notice", err)
	}
}

func TestOpenInEditorWaitsForTheWorktree(t *testing.T) {
	t.Parallel()

	f, _ := repoWorkspace(t)
	f.seedPrompt(t, prompts.StagePRD, prdWriter)
	f.seedPrompt(t, prompts.StageTechSpec, techSpecWriter)
	// A step of a repository the workspace does not have never gets a
	// worktree, which is what leaves the editor with nothing to open.
	f.seedPrompt(t, prompts.StagePlan, writeBlock("{{steps_dir}}/1-first.md", stepFile(1, "First", "api")))

	id, err := f.tasks.CreateTask(newTask("login-screen"))
	if err != nil {
		t.Fatalf("CreateTask() = %v, want nil", err)
	}
	f.waitStage(t, id, "implementation")

	// The worktree is only registered once the preparation gets that far, so
	// the answer before it does is that there is none yet.
	if err := f.tasks.OpenInEditor(id, ""); err != nil && err.Error() != "The worktree doesn't exist yet." {
		t.Errorf("OpenInEditor() error = %v, want the missing worktree notice", err)
	}
}

func TestDiscardingThePlanRemovesTheWorktrees(t *testing.T) {
	t.Parallel()

	f, dir, id := plannedTask(t)
	f.waitStep(t, id, 1, "awaiting_review")
	wt := worktree.Path(dir, "api", "login-screen")

	if err := f.tasks.DiscardStage(id, "plan"); err != nil {
		t.Fatalf("DiscardStage(%s, plan) = %v, want nil", id, err)
	}
	f.waitStage(t, id, "plan")

	assertWorktreeGone(t, wt, filepath.Join(dir, "api"))
	if steps := f.taskOf(t, id).Steps; len(steps) != 0 {
		t.Errorf("steps = %+v, want the plan thrown away", steps)
	}
}

func TestDeleteTaskRemovesTheWorktrees(t *testing.T) {
	t.Parallel()

	f, dir, id := plannedTask(t)
	f.waitStep(t, id, 1, "awaiting_review")
	wt := worktree.Path(dir, "api", "login-screen")

	if err := f.tasks.DeleteTask(id); err != nil {
		t.Fatalf("DeleteTask(%s) = %v, want nil", id, err)
	}
	if tasks := f.workspace.GetState().Tasks; len(tasks) != 0 {
		t.Errorf("state has %d tasks, want none", len(tasks))
	}
	assertWorktreeGone(t, wt, filepath.Join(dir, "api"))
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

	f, dir := repoWorkspace(t)
	f.seedPrompt(t, prompts.StagePRD, prdWriter)
	f.seedPrompt(t, prompts.StageTechSpec, techSpecWriter)
	f.seedPrompt(t, prompts.StagePlan, writeBlock("{{steps_dir}}/1-first.md", stepFile(1, "First", "cli")))
	f.fixStep(filepath.Join(task.ArtifactsDir(f.dataDir, dir, "login-screen"), "steps", "1-first.md"), "api")

	id, err := f.tasks.CreateTask(newTask("login-screen"))
	if err != nil {
		t.Fatalf("CreateTask() = %v, want nil", err)
	}
	f.waitStage(t, id, "implementation")

	if got := f.correctionCount(id); got != 1 {
		t.Errorf("corrections = %d, want 1", got)
	}
	if !hasAppMessage(f.entries(), "1-first.md") {
		t.Error("the plan was not corrected by a message from the app")
	}
}

func TestBackToPRDReopensTheConversation(t *testing.T) {
	t.Parallel()

	f, dir, id := taskWithPRD(t)
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

	path := filepath.Join(task.ArtifactsDir(f.dataDir, dir, "login-screen"), "PRD.md")
	if _, err := os.Stat(path); err != nil {
		t.Errorf("Stat(%s) = %v, want the PRD to be kept", path, err)
	}
}

func TestDiscardRestartsTheStage(t *testing.T) {
	t.Parallel()

	f, dir, id := taskWithPRD(t)
	f.waitStage(t, id, "tech_spec")

	if err := f.tasks.DiscardStage(id, "prd"); err != nil {
		t.Fatalf("DiscardStage(%s) = %v, want nil", id, err)
	}
	f.waitStage(t, id, "prd")

	if summary := f.taskOf(t, id); summary.HasPRD || summary.Revisiting {
		t.Errorf("task = %+v, want the PRD thrown away and no revisit", summary)
	}
	path := filepath.Join(task.ArtifactsDir(f.dataDir, dir, "login-screen"), "PRD.md")
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
	path := filepath.Join(task.ArtifactsDir(f.dataDir, dir, "login-screen"), "PRD.md")
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
