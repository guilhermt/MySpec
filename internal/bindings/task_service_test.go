package bindings_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/task"
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
		CreatedAt:     got.CreatedAt,
		UpdatedAt:     got.UpdatedAt,
	}
	// The context percentage depends on the tokens the fake reports, and the
	// process may still be idling; neither belongs in this comparison.
	got.ContextPercent = 0
	got.ProcessRunning = false
	if got != want {
		t.Errorf("task = %+v, want %+v", got, want)
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

	transcript, err := f.tasks.GetTranscript(id)
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
	if _, err := f.tasks.GetTranscript("nope"); err == nil {
		t.Fatal("GetTranscript() = nil, want an error")
	}
	if !f.logged(t, "binding failed") {
		t.Error("the failure was not logged")
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

	if err := f.tasks.SendMessage(id, "add a remember me box"); err != nil {
		t.Fatalf("SendMessage(%s) = %v, want nil", id, err)
	}
	f.waitForStatus(t, id, "waiting")

	transcript, err := f.tasks.GetTranscript(id)
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

	if err := f.tasks.SendMessage(id, "  "); err == nil || err.Error() != "Write a message first." {
		t.Errorf("SendMessage() error = %v, want the empty message notice", err)
	}

	if err := f.tasks.Pause(id); err != nil {
		t.Fatalf("Pause(%s) = %v, want nil", id, err)
	}
	if status := f.taskOf(t, id).SessionStatus; status != "paused" {
		t.Errorf("sessionStatus = %q, want paused", status)
	}
	if err := f.tasks.SendMessage(id, "hello"); err == nil || err.Error() != "Resume the task to send messages." {
		t.Errorf("SendMessage() error = %v, want the paused notice", err)
	}

	if err := f.tasks.Resume(id); err != nil {
		t.Fatalf("Resume(%s) = %v, want nil", id, err)
	}
	if status := f.taskOf(t, id).SessionStatus; status == "paused" {
		t.Error("the session is still paused after Resume")
	}
}

func TestRemovePendingRejectsAnEntryThatIsNotQueued(t *testing.T) {
	t.Parallel()

	f, _, id := createdTask(t)

	if err := f.tasks.RemovePending(id, "nope"); err == nil {
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
	if err := f.tasks.Interrupt(id); err != nil {
		t.Fatalf("Interrupt(%s) = %v, want nil", id, err)
	}
	if err := f.tasks.Retry(id); err != nil {
		t.Fatalf("Retry(%s) = %v, want nil", id, err)
	}
	if err := f.tasks.SendMessage(id, "carry on"); err != nil {
		t.Fatalf("SendMessage(%s) = %v, want nil", id, err)
	}
	f.waitForStatus(t, id, "waiting")
}

func TestAnswerPermissionRejectsAnUnknownDecision(t *testing.T) {
	t.Parallel()

	f, _, id := createdTask(t)

	err := f.tasks.AnswerPermission(id, "req-1", "maybe", "")
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

	if err := f.tasks.AnswerPermission(id, "req-1", "allow", ""); err == nil {
		t.Error("AnswerPermission() = nil, want an error")
	}
	if err := f.tasks.AnswerQuestion(id, "req-1", map[string]string{"Colour?": "Red"}); err == nil {
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
