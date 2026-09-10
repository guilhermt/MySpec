package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/guilhermt/myspec/internal/task"
)

// TasksRepo stores the tasks of every workspace. It implements
// task.Store.
type TasksRepo struct{ db *sql.DB }

// taskColumns is the column list every task query selects, in scan order.
const taskColumns = `id, workspace_path, name, repo_path, initial_context, stage, revisiting,
	artifacts_dir, artifact_version, archived_at, created_at, updated_at`

// ListByWorkspace returns the tasks a workspace still holds, in creation
// order. The archived ones are not among them.
func (r *TasksRepo) ListByWorkspace(ctx context.Context, workspacePath string) ([]task.Task, error) {
	const query = `SELECT ` + taskColumns + ` FROM tasks
		WHERE workspace_path = ? AND archived_at IS NULL ORDER BY created_at, name`

	return r.listTasks(ctx, query, workspacePath)
}

// ListArchived returns the archived tasks of a workspace, the most recently
// archived first.
func (r *TasksRepo) ListArchived(ctx context.Context, workspacePath string) ([]task.Task, error) {
	const query = `SELECT ` + taskColumns + ` FROM tasks
		WHERE workspace_path = ? AND archived_at IS NOT NULL ORDER BY archived_at DESC, name`

	return r.listTasks(ctx, query, workspacePath)
}

// listTasks runs a query of the task columns for one workspace.
func (r *TasksRepo) listTasks(ctx context.Context, query, workspacePath string) ([]task.Task, error) {
	rows, err := r.db.QueryContext(ctx, query, workspacePath)
	if err != nil {
		return nil, fmt.Errorf("list tasks of %s: %w", workspacePath, err)
	}
	defer func() { _ = rows.Close() }()

	var tasks []task.Task
	for rows.Next() {
		t, err := scanTask(rows)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, t)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list tasks of %s: %w", workspacePath, err)
	}
	return tasks, nil
}

// Get returns a task by id, or task.ErrNotFound.
func (r *TasksRepo) Get(ctx context.Context, id string) (task.Task, error) {
	const query = `SELECT ` + taskColumns + ` FROM tasks WHERE id = ?`

	t, err := scanTask(r.db.QueryRowContext(ctx, query, id))
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return task.Task{}, fmt.Errorf("get task %s: %w", id, task.ErrNotFound)
	case err != nil:
		return task.Task{}, err
	}
	return t, nil
}

// Insert stores a new task. It returns task.ErrNameTaken when the workspace
// already has a task with that name.
func (r *TasksRepo) Insert(ctx context.Context, t task.Task) error {
	const taken = `SELECT 1 FROM tasks WHERE workspace_path = ? AND name = ?`
	const stmt = `INSERT INTO tasks (` + taskColumns + `)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin insert task: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	var one int
	err = tx.QueryRowContext(ctx, taken, t.WorkspacePath, t.Name).Scan(&one)
	switch {
	case err == nil:
		return fmt.Errorf("insert task %s: %w", t.Name, task.ErrNameTaken)
	case !errors.Is(err, sql.ErrNoRows):
		return fmt.Errorf("check task name %s: %w", t.Name, err)
	}

	_, err = tx.ExecContext(ctx, stmt,
		t.ID, t.WorkspacePath, t.Name, nullString(t.RepoPath), t.InitialContext, string(t.Stage), t.Revisiting,
		t.ArtifactsDir, t.ArtifactVersion, nullTime(t.ArchivedAt),
		formatTime(t.CreatedAt), formatTime(t.UpdatedAt))
	if err != nil {
		return fmt.Errorf("insert task %s: %w", t.Name, err)
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit insert task %s: %w", t.Name, err)
	}
	return nil
}

// UpdateStage rewrites the stage and the revisit flag of a task.
func (r *TasksRepo) UpdateStage(ctx context.Context, id, stage string, revisiting bool, updatedAt time.Time) error {
	const stmt = `UPDATE tasks SET stage = ?, revisiting = ?, updated_at = ? WHERE id = ?`

	if _, err := r.db.ExecContext(ctx, stmt, stage, revisiting, formatTime(updatedAt), id); err != nil {
		return fmt.Errorf("update stage of task %s: %w", id, err)
	}
	return nil
}

// UpdateArtifactVersion rewrites the artifact version of a task.
func (r *TasksRepo) UpdateArtifactVersion(ctx context.Context, id string, version int, updatedAt time.Time) error {
	const stmt = `UPDATE tasks SET artifact_version = ?, updated_at = ? WHERE id = ?`

	if _, err := r.db.ExecContext(ctx, stmt, version, formatTime(updatedAt), id); err != nil {
		return fmt.Errorf("update artifact version of task %s: %w", id, err)
	}
	return nil
}

// UpdateArchived records the instant a task left the workspace.
func (r *TasksRepo) UpdateArchived(ctx context.Context, id string, archivedAt, updatedAt time.Time) error {
	const stmt = `UPDATE tasks SET archived_at = ?, updated_at = ? WHERE id = ?`

	if _, err := r.db.ExecContext(ctx, stmt, formatTime(archivedAt), formatTime(updatedAt), id); err != nil {
		return fmt.Errorf("update archived of task %s: %w", id, err)
	}
	return nil
}

// Delete removes a task and, by cascade, its session and transcript.
func (r *TasksRepo) Delete(ctx context.Context, id string) error {
	const stmt = `DELETE FROM tasks WHERE id = ?`

	if _, err := r.db.ExecContext(ctx, stmt, id); err != nil {
		return fmt.Errorf("delete task %s: %w", id, err)
	}
	return nil
}

func scanTask(row scanner) (task.Task, error) {
	var (
		t                    task.Task
		repoPath             sql.NullString
		stage                string
		archivedAt           sql.NullString
		createdAt, updatedAt string
	)
	err := row.Scan(&t.ID, &t.WorkspacePath, &t.Name, &repoPath, &t.InitialContext, &stage, &t.Revisiting,
		&t.ArtifactsDir, &t.ArtifactVersion, &archivedAt, &createdAt, &updatedAt)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return task.Task{}, err
	case err != nil:
		return task.Task{}, fmt.Errorf("scan task: %w", err)
	}

	t.RepoPath = repoPath.String
	t.Stage = task.Stage(stage)
	if archivedAt.Valid {
		if t.ArchivedAt, err = parseTime(archivedAt.String, "task "+t.ID); err != nil {
			return task.Task{}, err
		}
	}
	if t.CreatedAt, err = parseTime(createdAt, "task "+t.ID); err != nil {
		return task.Task{}, err
	}
	if t.UpdatedAt, err = parseTime(updatedAt, "task "+t.ID); err != nil {
		return task.Task{}, err
	}
	return t, nil
}
