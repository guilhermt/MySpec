package store

import (
	"context"
	"fmt"

	"github.com/guilhermt/myspec/internal/divergence"
)

// divergenceColumns is the column list every divergence query selects, in scan
// order.
const divergenceColumns = `item_id, stage, kind, facts, started_at`

// Divergences returns the divergence every item has open. It implements
// divergence.Store.
func (s *Store) Divergences(ctx context.Context) ([]divergence.Row, error) {
	const query = `SELECT ` + divergenceColumns + ` FROM divergences ORDER BY item_id`

	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("list divergences: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var list []divergence.Row
	for rows.Next() {
		var (
			row       divergence.Row
			startedAt string
		)
		if err = rows.Scan(&row.ItemID, &row.Stage, &row.Kind, &row.Facts, &startedAt); err != nil {
			return nil, fmt.Errorf("scan divergence: %w", err)
		}
		if row.StartedAt, err = parseTime(startedAt, "divergence of "+row.ItemID); err != nil {
			return nil, err
		}
		list = append(list, row)
	}
	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("list divergences: %w", err)
	}
	return list, nil
}

// PutDivergence stores the divergence of an item, replacing the one it had.
func (s *Store) PutDivergence(ctx context.Context, row divergence.Row) error {
	const stmt = `INSERT INTO divergences (` + divergenceColumns + `) VALUES (?, ?, ?, ?, ?)
		ON CONFLICT (item_id) DO UPDATE SET
			stage = excluded.stage,
			kind = excluded.kind,
			facts = excluded.facts,
			started_at = excluded.started_at`

	_, err := s.db.ExecContext(ctx, stmt, row.ItemID, row.Stage, row.Kind, row.Facts, formatTime(row.StartedAt))
	if err != nil {
		return fmt.Errorf("put divergence of %s: %w", row.ItemID, err)
	}
	return nil
}

// DeleteDivergence removes the divergence of an item. A missing row is not an
// error.
func (s *Store) DeleteDivergence(ctx context.Context, itemID string) error {
	const stmt = `DELETE FROM divergences WHERE item_id = ?`

	if _, err := s.db.ExecContext(ctx, stmt, itemID); err != nil {
		return fmt.Errorf("delete divergence of %s: %w", itemID, err)
	}
	return nil
}
