package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/guilhermt/myspec/internal/task"
)

// TasksRepo stores the tasks. It implements task.Store.
type TasksRepo struct{ db *sql.DB }

// taskColumns is the column list every task query selects, in scan order.
const taskColumns = `id, repository_id, name, initial_context, stage, revisiting,
	artifacts_dir, artifact_version, archived_at, created_at, updated_at, models, review_modes, mode`

// ListActive returns the tasks that were not archived, in creation order.
func (r *TasksRepo) ListActive(ctx context.Context) ([]task.Task, error) {
	const query = `SELECT ` + taskColumns + ` FROM tasks
		WHERE archived_at IS NULL ORDER BY created_at, name`

	return r.listTasks(ctx, query)
}

// ListArchived returns the archived tasks, the most recently archived first.
func (r *TasksRepo) ListArchived(ctx context.Context) ([]task.Task, error) {
	const query = `SELECT ` + taskColumns + ` FROM tasks
		WHERE archived_at IS NOT NULL ORDER BY archived_at DESC, name`

	return r.listTasks(ctx, query)
}

// listTasks runs a query of the task columns.
func (r *TasksRepo) listTasks(ctx context.Context, query string) ([]task.Task, error) {
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("list tasks: %w", err)
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
		return nil, fmt.Errorf("list tasks: %w", err)
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

// Insert stores a new task. It returns task.ErrNameTaken when the repository
// already has a task with that name.
func (r *TasksRepo) Insert(ctx context.Context, t task.Task) error {
	const taken = `SELECT 1 FROM tasks WHERE repository_id = ? AND name = ?`
	const stmt = `INSERT INTO tasks (` + taskColumns + `)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	encodedModels, err := encodeModels(t.Models)
	if err != nil {
		return fmt.Errorf("insert task %s: %w", t.Name, err)
	}
	encodedReviewModes, err := encodeReviewModes(t.ReviewModes)
	if err != nil {
		return fmt.Errorf("insert task %s: %w", t.Name, err)
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin insert task: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	var one int
	err = tx.QueryRowContext(ctx, taken, t.RepositoryID, t.Name).Scan(&one)
	switch {
	case err == nil:
		return fmt.Errorf("insert task %s: %w", t.Name, task.ErrNameTaken)
	case !errors.Is(err, sql.ErrNoRows):
		return fmt.Errorf("check task name %s: %w", t.Name, err)
	}

	_, err = tx.ExecContext(ctx, stmt,
		t.ID, t.RepositoryID, t.Name, t.InitialContext, string(t.Stage), t.Revisiting,
		t.ArtifactsDir, t.ArtifactVersion, nullTime(t.ArchivedAt),
		formatTime(t.CreatedAt), formatTime(t.UpdatedAt), encodedModels, encodedReviewModes, string(t.Mode))
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

// UpdateArchived records the instant a task was archived.
func (r *TasksRepo) UpdateArchived(ctx context.Context, id string, archivedAt, updatedAt time.Time) error {
	const stmt = `UPDATE tasks SET archived_at = ?, updated_at = ? WHERE id = ?`

	if _, err := r.db.ExecContext(ctx, stmt, formatTime(archivedAt), formatTime(updatedAt), id); err != nil {
		return fmt.Errorf("update archived of task %s: %w", id, err)
	}
	return nil
}

// UpdateModels rewrites the model and effort of the stages and steps of a task.
func (r *TasksRepo) UpdateModels(ctx context.Context, id string, m task.Models, updatedAt time.Time) error {
	const stmt = `UPDATE tasks SET models = ?, updated_at = ? WHERE id = ?`

	encoded, err := encodeModels(m)
	if err != nil {
		return fmt.Errorf("update models of task %s: %w", id, err)
	}
	if _, err := r.db.ExecContext(ctx, stmt, encoded, formatTime(updatedAt), id); err != nil {
		return fmt.Errorf("update models of task %s: %w", id, err)
	}
	return nil
}

// UpdateReviewModes rewrites who reviews the steps of a task.
func (r *TasksRepo) UpdateReviewModes(ctx context.Context, id string, m task.ReviewModes, updatedAt time.Time) error {
	const stmt = `UPDATE tasks SET review_modes = ?, updated_at = ? WHERE id = ?`

	encoded, err := encodeReviewModes(m)
	if err != nil {
		return fmt.Errorf("update review modes of task %s: %w", id, err)
	}
	if _, err := r.db.ExecContext(ctx, stmt, encoded, formatTime(updatedAt), id); err != nil {
		return fmt.Errorf("update review modes of task %s: %w", id, err)
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
		repositoryID         sql.NullString
		stage                string
		archivedAt           sql.NullString
		createdAt, updatedAt string
		encodedModels        string
		encodedReviewModes   string
		mode                 string
	)
	err := row.Scan(&t.ID, &repositoryID, &t.Name, &t.InitialContext, &stage, &t.Revisiting,
		&t.ArtifactsDir, &t.ArtifactVersion, &archivedAt, &createdAt, &updatedAt, &encodedModels,
		&encodedReviewModes, &mode)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return task.Task{}, err
	case err != nil:
		return task.Task{}, fmt.Errorf("scan task: %w", err)
	}

	t.RepositoryID = repositoryID.String
	t.Stage = task.Stage(stage)
	t.Mode = task.Mode(mode)
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
	if t.Models, err = decodeModels(encodedModels); err != nil {
		return task.Task{}, fmt.Errorf("read task %s: %w", t.ID, err)
	}
	if t.ReviewModes, err = decodeReviewModes(encodedReviewModes); err != nil {
		return task.Task{}, fmt.Errorf("read task %s: %w", t.ID, err)
	}
	return t, nil
}

// encodeModels is the JSON of the models of a task.
func encodeModels(m task.Models) (string, error) {
	encoded, err := json.Marshal(m)
	if err != nil {
		return "", fmt.Errorf("encode models: %w", err)
	}
	return string(encoded), nil
}

// decodeModels reads the JSON back. Every row has one since migration 0009.
func decodeModels(value string) (task.Models, error) {
	var m task.Models
	if err := json.Unmarshal([]byte(value), &m); err != nil {
		return task.Models{}, fmt.Errorf("decode models: %w", err)
	}
	return m, nil
}

// encodeReviewModes is the JSON of the review modes of a task.
func encodeReviewModes(m task.ReviewModes) (string, error) {
	encoded, err := json.Marshal(m)
	if err != nil {
		return "", fmt.Errorf("encode review modes: %w", err)
	}
	return string(encoded), nil
}

// decodeReviewModes reads the JSON back. Every row has one since migration 0010.
func decodeReviewModes(value string) (task.ReviewModes, error) {
	var m task.ReviewModes
	if err := json.Unmarshal([]byte(value), &m); err != nil {
		return task.ReviewModes{}, fmt.Errorf("decode review modes: %w", err)
	}
	return m, nil
}
