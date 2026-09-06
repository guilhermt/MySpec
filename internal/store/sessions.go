package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/guilhermt/myspec/internal/session"
)

// SessionsRepo stores one session per task. It implements
// session.SessionRepository.
type SessionsRepo struct{ db *sql.DB }

// sessionColumns is the column list every session query selects, in scan order.
const sessionColumns = `id, task_id, stage, started, paused, context_tokens,
	context_window, last_error, created_at, updated_at`

// GetByTask returns the session of a task, or session.ErrNotFound.
func (r *SessionsRepo) GetByTask(ctx context.Context, taskID string) (session.Record, error) {
	const query = `SELECT ` + sessionColumns + ` FROM sessions WHERE task_id = ?`

	var (
		rec                  session.Record
		lastError            sql.NullString
		createdAt, updatedAt string
	)
	err := r.db.QueryRowContext(ctx, query, taskID).Scan(&rec.ID, &rec.TaskID, &rec.Stage,
		&rec.Started, &rec.Paused, &rec.ContextTokens, &rec.ContextWindow, &lastError,
		&createdAt, &updatedAt)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return session.Record{}, fmt.Errorf("get session of task %s: %w", taskID, session.ErrNotFound)
	case err != nil:
		return session.Record{}, fmt.Errorf("get session of task %s: %w", taskID, err)
	}

	rec.LastError = lastError.String
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
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	_, err := r.db.ExecContext(ctx, stmt, rec.ID, rec.TaskID, rec.Stage, rec.Started, rec.Paused,
		rec.ContextTokens, rec.ContextWindow, nullString(rec.LastError),
		formatTime(rec.CreatedAt), formatTime(rec.UpdatedAt))
	if err != nil {
		return fmt.Errorf("insert session %s: %w", rec.ID, err)
	}
	return nil
}

// Update rewrites every mutable column of a session.
func (r *SessionsRepo) Update(ctx context.Context, rec session.Record) error {
	const stmt = `UPDATE sessions SET stage = ?, started = ?, paused = ?, context_tokens = ?,
		context_window = ?, last_error = ?, updated_at = ? WHERE id = ?`

	_, err := r.db.ExecContext(ctx, stmt, rec.Stage, rec.Started, rec.Paused, rec.ContextTokens,
		rec.ContextWindow, nullString(rec.LastError), formatTime(rec.UpdatedAt), rec.ID)
	if err != nil {
		return fmt.Errorf("update session %s: %w", rec.ID, err)
	}
	return nil
}
