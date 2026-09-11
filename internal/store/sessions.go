package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/session"
)

// SessionsRepo stores one session per stage of a task. It implements
// session.SessionRepository.
type SessionsRepo struct{ db *sql.DB }

// sessionColumns is the column list every session query selects, in scan order.
const sessionColumns = `id, task_id, stage, started, paused, context_tokens,
	context_window, corrections, last_error, created_at, updated_at, model, effort`

// Get returns the session of a task in one stage, or session.ErrNotFound.
func (r *SessionsRepo) Get(ctx context.Context, taskID, stage string) (session.Record, error) {
	const query = `SELECT ` + sessionColumns + ` FROM sessions WHERE task_id = ? AND stage = ?`

	var (
		rec                  session.Record
		lastError            sql.NullString
		createdAt, updatedAt string
		model, effort        string
	)
	err := r.db.QueryRowContext(ctx, query, taskID, stage).Scan(&rec.ID, &rec.TaskID, &rec.Stage,
		&rec.Started, &rec.Paused, &rec.ContextTokens, &rec.ContextWindow, &rec.Corrections,
		&lastError, &createdAt, &updatedAt, &model, &effort)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return session.Record{}, fmt.Errorf("get %s session of task %s: %w", stage, taskID, session.ErrNotFound)
	case err != nil:
		return session.Record{}, fmt.Errorf("get %s session of task %s: %w", stage, taskID, err)
	}

	rec.LastError = lastError.String
	// The choice is not validated: only the app writes these columns.
	rec.Choice = models.Choice{Model: models.Model(model), Effort: models.Effort(effort)}
	if rec.CreatedAt, err = parseTime(createdAt, "session "+rec.ID); err != nil {
		return session.Record{}, err
	}
	if rec.UpdatedAt, err = parseTime(updatedAt, "session "+rec.ID); err != nil {
		return session.Record{}, err
	}
	return rec, nil
}

// Insert stores a new session.
func (r *SessionsRepo) Insert(ctx context.Context, rec session.Record) error {
	const stmt = `INSERT INTO sessions (` + sessionColumns + `)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	_, err := r.db.ExecContext(ctx, stmt, rec.ID, rec.TaskID, rec.Stage, rec.Started, rec.Paused,
		rec.ContextTokens, rec.ContextWindow, rec.Corrections, nullString(rec.LastError),
		formatTime(rec.CreatedAt), formatTime(rec.UpdatedAt),
		string(rec.Choice.Model), string(rec.Choice.Effort))
	if err != nil {
		return fmt.Errorf("insert session %s: %w", rec.ID, err)
	}
	return nil
}

// Update rewrites every mutable column of a session.
func (r *SessionsRepo) Update(ctx context.Context, rec session.Record) error {
	const stmt = `UPDATE sessions SET stage = ?, started = ?, paused = ?, context_tokens = ?,
		context_window = ?, corrections = ?, last_error = ?, model = ?, effort = ?, updated_at = ?
		WHERE id = ?`

	_, err := r.db.ExecContext(ctx, stmt, rec.Stage, rec.Started, rec.Paused, rec.ContextTokens,
		rec.ContextWindow, rec.Corrections, nullString(rec.LastError),
		string(rec.Choice.Model), string(rec.Choice.Effort), formatTime(rec.UpdatedAt), rec.ID)
	if err != nil {
		return fmt.Errorf("update session %s: %w", rec.ID, err)
	}
	return nil
}

// Delete removes the sessions of a task in the given stages, with their
// transcripts by cascade. Missing stages are not an error.
func (r *SessionsRepo) Delete(ctx context.Context, taskID string, stages ...string) error {
	if len(stages) == 0 {
		return nil
	}

	args := make([]any, 0, len(stages)+1)
	args = append(args, taskID)
	for _, stage := range stages {
		args = append(args, stage)
	}
	// The only thing built into the statement is one placeholder per stage; the
	// stages themselves travel as arguments.
	//nolint:gosec // G202: the concatenated text is a placeholder list, not data
	stmt := `DELETE FROM sessions WHERE task_id = ? AND stage IN (?` +
		strings.Repeat(", ?", len(stages)-1) + `)`

	if _, err := r.db.ExecContext(ctx, stmt, args...); err != nil {
		return fmt.Errorf("delete sessions of task %s: %w", taskID, err)
	}
	return nil
}

// DeleteByTask removes every session of a task, with their transcripts by
// cascade. A task without sessions is not an error.
func (r *SessionsRepo) DeleteByTask(ctx context.Context, taskID string) error {
	const stmt = `DELETE FROM sessions WHERE task_id = ?`

	if _, err := r.db.ExecContext(ctx, stmt, taskID); err != nil {
		return fmt.Errorf("delete sessions of task %s: %w", taskID, err)
	}
	return nil
}
