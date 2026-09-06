package store

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/guilhermt/myspec/internal/workspace"
)

// RecentsRepo stores the recently opened workspaces. It implements
// workspace.RecentsRepository.
type RecentsRepo struct{ db *sql.DB }

// List returns the recent workspaces, newest first, ties broken by path.
func (r *RecentsRepo) List(ctx context.Context) ([]workspace.Recent, error) {
	const query = `SELECT path, name, last_opened_at FROM recent_workspaces
		ORDER BY last_opened_at DESC, path`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("list recents: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var recents []workspace.Recent
	for rows.Next() {
		rec, err := scanRecent(rows)
		if err != nil {
			return nil, err
		}
		recents = append(recents, rec)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list recents: %w", err)
	}
	return recents, nil
}

func scanRecent(rows *sql.Rows) (workspace.Recent, error) {
	var (
		rec      workspace.Recent
		openedAt string
	)
	if err := rows.Scan(&rec.Path, &rec.Name, &openedAt); err != nil {
		return workspace.Recent{}, fmt.Errorf("scan recent: %w", err)
	}

	parsed, err := time.Parse(time.RFC3339Nano, openedAt)
	if err != nil {
		return workspace.Recent{}, fmt.Errorf("parse recent %s: %w", rec.Path, err)
	}
	rec.LastOpenedAt = parsed
	return rec, nil
}

// Touch inserts or refreshes rec by path and drops everything past the keep
// newest entries.
func (r *RecentsRepo) Touch(ctx context.Context, rec workspace.Recent, keep int) error {
	const upsert = `INSERT INTO recent_workspaces (path, name, last_opened_at) VALUES (?, ?, ?)
		ON CONFLICT (path) DO UPDATE SET name = excluded.name, last_opened_at = excluded.last_opened_at`
	const prune = `DELETE FROM recent_workspaces WHERE path NOT IN (
		SELECT path FROM recent_workspaces ORDER BY last_opened_at DESC, path LIMIT ?)`

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin touch recent: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	openedAt := rec.LastOpenedAt.UTC().Format(time.RFC3339Nano)
	if _, err := tx.ExecContext(ctx, upsert, rec.Path, rec.Name, openedAt); err != nil {
		return fmt.Errorf("touch recent %s: %w", rec.Path, err)
	}
	if _, err := tx.ExecContext(ctx, prune, keep); err != nil {
		return fmt.Errorf("prune recents: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit touch recent: %w", err)
	}
	return nil
}

// Delete removes the given paths. Deleting nothing is not an error.
func (r *RecentsRepo) Delete(ctx context.Context, paths ...string) error {
	if len(paths) == 0 {
		return nil
	}
	const stmt = `DELETE FROM recent_workspaces WHERE path = ?`

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin delete recents: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	for _, path := range paths {
		if _, err := tx.ExecContext(ctx, stmt, path); err != nil {
			return fmt.Errorf("delete recent %s: %w", path, err)
		}
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit delete recents: %w", err)
	}
	return nil
}
