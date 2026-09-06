package store

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/guilhermt/myspec/internal/session"
)

// EntriesRepo stores the transcript of every session. It implements
// session.EntryRepository.
type EntriesRepo struct{ db *sql.DB }

// List returns the entries of a session in transcript order.
func (r *EntriesRepo) List(ctx context.Context, sessionID string) ([]session.Entry, error) {
	const query = `SELECT id, seq, turn_id, kind, payload, created_at FROM transcript_entries
		WHERE session_id = ? ORDER BY seq`

	rows, err := r.db.QueryContext(ctx, query, sessionID)
	if err != nil {
		return nil, fmt.Errorf("list entries of session %s: %w", sessionID, err)
	}
	defer func() { _ = rows.Close() }()

	var entries []session.Entry
	for rows.Next() {
		entry, err := scanEntry(rows)
		if err != nil {
			return nil, err
		}
		entries = append(entries, entry)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list entries of session %s: %w", sessionID, err)
	}
	return entries, nil
}

// Insert stores a new entry of a session.
func (r *EntriesRepo) Insert(ctx context.Context, sessionID string, e session.Entry) error {
	const stmt = `INSERT INTO transcript_entries (id, session_id, seq, turn_id, kind, payload, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)`

	payload, err := e.MarshalPayload()
	if err != nil {
		return fmt.Errorf("insert entry %s: %w", e.ID, err)
	}
	if _, err := r.db.ExecContext(ctx, stmt, e.ID, sessionID, e.Seq, e.TurnID, string(e.Kind),
		string(payload), formatTime(e.CreatedAt)); err != nil {
		return fmt.Errorf("insert entry %s: %w", e.ID, err)
	}
	return nil
}

// Update rewrites the position, the turn and the payload of an entry.
func (r *EntriesRepo) Update(ctx context.Context, e session.Entry) error {
	const stmt = `UPDATE transcript_entries SET seq = ?, turn_id = ?, payload = ? WHERE id = ?`

	payload, err := e.MarshalPayload()
	if err != nil {
		return fmt.Errorf("update entry %s: %w", e.ID, err)
	}
	if _, err := r.db.ExecContext(ctx, stmt, e.Seq, e.TurnID, string(payload), e.ID); err != nil {
		return fmt.Errorf("update entry %s: %w", e.ID, err)
	}
	return nil
}

// Delete removes an entry. Deleting what is not there is not an error.
func (r *EntriesRepo) Delete(ctx context.Context, id string) error {
	const stmt = `DELETE FROM transcript_entries WHERE id = ?`

	if _, err := r.db.ExecContext(ctx, stmt, id); err != nil {
		return fmt.Errorf("delete entry %s: %w", id, err)
	}
	return nil
}

// MaxSeq is the highest position used in a session, 0 when it has no entries.
func (r *EntriesRepo) MaxSeq(ctx context.Context, sessionID string) (int, error) {
	const query = `SELECT COALESCE(MAX(seq), 0) FROM transcript_entries WHERE session_id = ?`

	var maxSeq int
	if err := r.db.QueryRowContext(ctx, query, sessionID).Scan(&maxSeq); err != nil {
		return 0, fmt.Errorf("max seq of session %s: %w", sessionID, err)
	}
	return maxSeq, nil
}

func scanEntry(row scanner) (session.Entry, error) {
	var (
		id, turnID, kind, payload, createdAt string
		seq                                  int
	)
	if err := row.Scan(&id, &seq, &turnID, &kind, &payload, &createdAt); err != nil {
		return session.Entry{}, fmt.Errorf("scan entry: %w", err)
	}

	entry, err := session.UnmarshalPayload(session.Kind(kind), []byte(payload))
	if err != nil {
		return session.Entry{}, fmt.Errorf("entry %s: %w", id, err)
	}
	entry.ID = id
	entry.Seq = seq
	entry.TurnID = turnID
	if entry.CreatedAt, err = parseTime(createdAt, "entry "+id); err != nil {
		return session.Entry{}, err
	}
	return entry, nil
}
