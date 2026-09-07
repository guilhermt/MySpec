package store_test

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/store"
	"github.com/guilhermt/myspec/internal/task"
)

// logCapture is a logger writing JSON records into a buffer.
type logCapture struct {
	log *slog.Logger
	buf *bytes.Buffer
}

func newLogCapture() logCapture {
	buf := &bytes.Buffer{}
	return logCapture{log: slog.New(slog.NewJSONHandler(buf, nil)), buf: buf}
}

// count returns how many records carry the given message.
func (c logCapture) count(t *testing.T, msg string) int {
	t.Helper()

	total := 0
	for _, line := range strings.Split(strings.TrimSpace(c.buf.String()), "\n") {
		if line == "" {
			continue
		}
		var rec map[string]any
		if err := json.Unmarshal([]byte(line), &rec); err != nil {
			t.Fatalf("parse log line %q: %v", line, err)
		}
		if rec["msg"] == msg {
			total++
		}
	}
	return total
}

// newStore opens an in-memory store closed at the end of the test.
func newStore(t *testing.T) *store.Store {
	t.Helper()

	s, err := store.OpenMemory(t.Context(), newLogCapture().log)
	if err != nil {
		t.Fatalf("OpenMemory() = %v, want nil", err)
	}
	t.Cleanup(func() {
		if err := s.Close(); err != nil {
			t.Errorf("Close() = %v, want nil", err)
		}
	})
	return s
}

// writeEmptyFile creates an empty file, used to block a directory path.
func writeEmptyFile(t *testing.T, path string) error {
	t.Helper()
	return os.WriteFile(path, nil, 0o600)
}

// fixedTime is the instant the repository fixtures are stamped with.
var fixedTime = time.Date(2026, time.September, 6, 10, 0, 0, 0, time.UTC)

// newTask builds a task of the given workspace, ready to insert.
func newTask(id, workspacePath, name string, created time.Time) task.Task {
	return task.Task{
		ID:              id,
		WorkspacePath:   workspacePath,
		Name:            name,
		InitialContext:  "context of " + name,
		Stage:           task.StagePRD,
		ArtifactsDir:    "/data/tasks/" + name,
		ArtifactVersion: 0,
		CreatedAt:       created,
		UpdatedAt:       created,
	}
}

// newSession builds the session of a task at a stage, ready to insert.
func newSession(id, taskID string, stage task.Stage) session.Record {
	return session.Record{
		ID:        id,
		TaskID:    taskID,
		Stage:     string(stage),
		CreatedAt: fixedTime,
		UpdatedAt: fixedTime,
	}
}

// newStepRun builds the record of a step of a task, ready to upsert.
func newStepRun(taskID string, number int, status task.StepStatus) task.StepRun {
	return task.StepRun{
		TaskID:    taskID,
		Number:    number,
		Status:    status,
		CreatedAt: fixedTime,
		UpdatedAt: fixedTime,
	}
}

// newBlockedStepRun builds the record of a step blocked by a dirty worktree.
func newBlockedStepRun(taskID string, number int) task.StepRun {
	run := newStepRun(taskID, number, task.StepBlocked)
	run.Block = &task.StepBlock{Reason: task.BlockDirty, Detail: " M main.go\n?? new.go", Files: 2}
	return run
}

// newEntry builds a user entry at the given position.
func newEntry(id string, seq int, text string) session.Entry {
	return session.Entry{
		ID:        id,
		Seq:       seq,
		TurnID:    id,
		Kind:      session.KindUser,
		CreatedAt: fixedTime,
		User:      &session.UserEntry{Text: text},
	}
}

// seedSession inserts a task with a session and returns both ids.
func seedSession(t *testing.T, s *store.Store) (taskID, sessionID string) {
	t.Helper()

	taskID, sessionID = "task-1", "sess-1"
	if err := s.Tasks.Insert(t.Context(), newTask(taskID, "/ws", "one", fixedTime)); err != nil {
		t.Fatalf("Tasks.Insert() = %v, want nil", err)
	}
	if err := s.Sessions.Insert(t.Context(), newSession(sessionID, taskID, task.StagePRD)); err != nil {
		t.Fatalf("Sessions.Insert() = %v, want nil", err)
	}
	return taskID, sessionID
}
