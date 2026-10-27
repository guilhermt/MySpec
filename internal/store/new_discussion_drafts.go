package store

import (
	"context"
	"fmt"

	"github.com/guilhermt/myspec/internal/newdiscussion"
)

var _ newdiscussion.Store = (*Store)(nil)

// newDiscussionDraftColumns is the column list every draft query selects, in
// scan order.
const newDiscussionDraftColumns = `id, board_id, title, text, created_at, saved_at`

// NewDiscussionDrafts returns every draft of the New discussion dialog, the
// most recently saved first. It implements newdiscussion.Store.
func (s *Store) NewDiscussionDrafts(ctx context.Context) ([]newdiscussion.Draft, error) {
	const query = `SELECT ` + newDiscussionDraftColumns + ` FROM new_discussion_drafts ORDER BY saved_at DESC, id`

	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("list new discussion drafts: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var list []newdiscussion.Draft
	for rows.Next() {
		var (
			d                  newdiscussion.Draft
			createdAt, savedAt string
		)
		if err = rows.Scan(&d.ID, &d.BoardID, &d.Title, &d.Text, &createdAt, &savedAt); err != nil {
			return nil, fmt.Errorf("scan new discussion draft: %w", err)
		}
		if d.CreatedAt, err = parseTime(createdAt, "new discussion draft "+d.ID); err != nil {
			return nil, err
		}
		if d.SavedAt, err = parseTime(savedAt, "new discussion draft "+d.ID); err != nil {
			return nil, err
		}
		list = append(list, d)
	}
	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("list new discussion drafts: %w", err)
	}
	return list, nil
}

// PutNewDiscussionDraft stores a draft, updating the one with its id and
// keeping when it was created.
func (s *Store) PutNewDiscussionDraft(ctx context.Context, d newdiscussion.Draft) error {
	const stmt = `INSERT INTO new_discussion_drafts (` + newDiscussionDraftColumns + `) VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT (id) DO UPDATE SET
			board_id = excluded.board_id,
			title = excluded.title,
			text = excluded.text,
			saved_at = excluded.saved_at`

	_, err := s.db.ExecContext(ctx, stmt, d.ID, d.BoardID, d.Title, d.Text, formatTime(d.CreatedAt), formatTime(d.SavedAt))
	if err != nil {
		return fmt.Errorf("put new discussion draft %s: %w", d.ID, err)
	}
	return nil
}

// DeleteNewDiscussionDraft removes a draft. A missing row is not an error.
func (s *Store) DeleteNewDiscussionDraft(ctx context.Context, id string) error {
	const stmt = `DELETE FROM new_discussion_drafts WHERE id = ?`

	if _, err := s.db.ExecContext(ctx, stmt, id); err != nil {
		return fmt.Errorf("delete new discussion draft %s: %w", id, err)
	}
	return nil
}
