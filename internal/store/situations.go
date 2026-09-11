package store

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/guilhermt/myspec/internal/attention"
)

// SituationsRepo stores the situations of the tasks, one per place of a task.
// It implements attention.Store.
type SituationsRepo struct{ db *sql.DB }

// situationColumns is the column list every situation query selects, in scan
// order.
const situationColumns = `task_id, place, id, kind, started_at`

// ListByTasks returns the situations of the given tasks. An empty list of
// tasks asks the database nothing.
func (r *SituationsRepo) ListByTasks(ctx context.Context, taskIDs []string) ([]attention.Record, error) {
	if len(taskIDs) == 0 {
		return nil, nil
	}

	args := make([]any, len(taskIDs))
	for i, id := range taskIDs {
		args[i] = id
	}
	// The only thing built into the statement is one placeholder per task; the
	// ids themselves travel as arguments.
	//nolint:gosec // G202: the concatenated text is a placeholder list, not data
	query := `SELECT ` + situationColumns + ` FROM situations WHERE task_id IN (?` +
		strings.Repeat(", ?", len(taskIDs)-1) + `) ORDER BY task_id, place`

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list situations: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var list []attention.Record
	for rows.Next() {
		rec, scanErr := scanSituation(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		list = append(list, rec)
	}
	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("list situations: %w", err)
	}
	return list, nil
}

// Upsert stores the situation of a place, replacing the one the place had.
func (r *SituationsRepo) Upsert(ctx context.Context, rec attention.Record) error {
	const stmt = `INSERT INTO situations (` + situationColumns + `) VALUES (?, ?, ?, ?, ?)
		ON CONFLICT (task_id, place) DO UPDATE SET
			id = excluded.id,
			kind = excluded.kind,
			started_at = excluded.started_at`

	_, err := r.db.ExecContext(ctx, stmt, rec.TaskID, rec.Place, rec.ID, string(rec.Kind), formatTime(rec.StartedAt))
	if err != nil {
		return fmt.Errorf("upsert situation of %s in task %s: %w", rec.Place, rec.TaskID, err)
	}
	return nil
}

// Delete removes the situation of a place. A missing row is not an error.
func (r *SituationsRepo) Delete(ctx context.Context, taskID, place string) error {
	const stmt = `DELETE FROM situations WHERE task_id = ? AND place = ?`

	if _, err := r.db.ExecContext(ctx, stmt, taskID, place); err != nil {
		return fmt.Errorf("delete situation of %s in task %s: %w", place, taskID, err)
	}
	return nil
}

// scanSituation reads a situation row. The kind is taken as stored: a kind this
// version does not know never matches a derived one, so its situation simply
// ends.
func scanSituation(row scanner) (attention.Record, error) {
	var (
		rec       attention.Record
		kind      string
		startedAt string
	)
	if err := row.Scan(&rec.TaskID, &rec.Place, &rec.ID, &kind, &startedAt); err != nil {
		return attention.Record{}, fmt.Errorf("scan situation: %w", err)
	}
	rec.Kind = attention.Kind(kind)

	var err error
	if rec.StartedAt, err = parseTime(startedAt, "situation "+rec.ID); err != nil {
		return attention.Record{}, err
	}
	return rec, nil
}
