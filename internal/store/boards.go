package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/guilhermt/myspec/internal/board"
)

// BoardsRepo stores the registered boards, their readings and the repositories
// each one manages. It implements board.Store.
type BoardsRepo struct{ db *sql.DB }

// boardColumns is the column list every board query selects, in scan order.
const boardColumns = `id, owner, owner_type, number, title, url, final_statuses, created_at`

// ListBoards returns the registered boards, by title ignoring case, then id.
func (r *BoardsRepo) ListBoards(ctx context.Context) ([]board.Board, error) {
	const query = `SELECT ` + boardColumns + ` FROM boards ORDER BY title COLLATE NOCASE, id`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("list boards: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var list []board.Board
	for rows.Next() {
		b, scanErr := scanBoard(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		list = append(list, b)
	}
	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("list boards: %w", err)
	}
	return list, nil
}

// InsertBoard registers a board with an empty reading and applies the links,
// in one transaction.
func (r *BoardsRepo) InsertBoard(ctx context.Context, b board.Board, links []board.Link) error {
	const stmt = `INSERT INTO boards (` + boardColumns + `) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	const reading = `INSERT INTO board_readings (board_id) VALUES (?)`

	finals, err := encodeFinalStatuses(b.FinalStatuses)
	if err != nil {
		return err
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin insert board %s: %w", b.ID, err)
	}
	defer func() { _ = tx.Rollback() }()

	_, err = tx.ExecContext(ctx, stmt, b.ID, b.Owner, string(b.OwnerType), b.Number, b.Title, b.URL,
		finals, formatTime(b.CreatedAt))
	if err != nil {
		return fmt.Errorf("insert board %s: %w", b.ID, err)
	}
	if _, err = tx.ExecContext(ctx, reading, b.ID); err != nil {
		return fmt.Errorf("insert reading of board %s: %w", b.ID, err)
	}
	if err = applyLinks(ctx, tx, b.ID, links); err != nil {
		return err
	}
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("commit insert board %s: %w", b.ID, err)
	}
	return nil
}

// UpdateBoard stores the title and the final statuses of a board, applies the
// releases, then the links, in one transaction.
func (r *BoardsRepo) UpdateBoard(ctx context.Context, b board.Board, links []board.Link, releases []board.Release) error {
	const stmt = `UPDATE boards SET title = ?, final_statuses = ? WHERE id = ?`

	finals, err := encodeFinalStatuses(b.FinalStatuses)
	if err != nil {
		return err
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin update board %s: %w", b.ID, err)
	}
	defer func() { _ = tx.Rollback() }()

	if _, err = tx.ExecContext(ctx, stmt, b.Title, finals, b.ID); err != nil {
		return fmt.Errorf("update board %s: %w", b.ID, err)
	}
	if err = applyReleases(ctx, tx, releases); err != nil {
		return err
	}
	if err = applyLinks(ctx, tx, b.ID, links); err != nil {
		return err
	}
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("commit update board %s: %w", b.ID, err)
	}
	return nil
}

// DeleteBoard applies the releases, then removes the board, in one
// transaction. The reading goes with the board, and a repository left behind
// loses its board.
func (r *BoardsRepo) DeleteBoard(ctx context.Context, id string, releases []board.Release) error {
	const stmt = `DELETE FROM boards WHERE id = ?`

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin delete board %s: %w", id, err)
	}
	defer func() { _ = tx.Rollback() }()

	if err = applyReleases(ctx, tx, releases); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, stmt, id); err != nil {
		return fmt.Errorf("delete board %s: %w", id, err)
	}
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("commit delete board %s: %w", id, err)
	}
	return nil
}

// ListReadings returns the stored reading of every board, by board id.
func (r *BoardsRepo) ListReadings(ctx context.Context) (map[string]board.Stored, error) {
	const query = `SELECT board_id, reading, read_at, failure, failed_at FROM board_readings`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("list board readings: %w", err)
	}
	defer func() { _ = rows.Close() }()

	readings := map[string]board.Stored{}
	for rows.Next() {
		id, stored, scanErr := scanReading(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		readings[id] = stored
	}
	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("list board readings: %w", err)
	}
	return readings, nil
}

// SaveReading stores a reading that succeeded, clears the failure and sets the
// board's title, in one transaction.
func (r *BoardsRepo) SaveReading(ctx context.Context, boardID, title string, reading board.Reading, readAt time.Time) error {
	const stmt = `UPDATE board_readings SET reading = ?, read_at = ?, failure = '', failed_at = NULL
		WHERE board_id = ?`
	const titleStmt = `UPDATE boards SET title = ? WHERE id = ?`

	encoded, err := json.Marshal(reading)
	if err != nil {
		return fmt.Errorf("encode reading of board %s: %w", boardID, err)
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin save reading of board %s: %w", boardID, err)
	}
	defer func() { _ = tx.Rollback() }()

	if _, err = tx.ExecContext(ctx, stmt, string(encoded), formatTime(readAt), boardID); err != nil {
		return fmt.Errorf("save reading of board %s: %w", boardID, err)
	}
	if _, err = tx.ExecContext(ctx, titleStmt, title, boardID); err != nil {
		return fmt.Errorf("update title of board %s: %w", boardID, err)
	}
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("commit save reading of board %s: %w", boardID, err)
	}
	return nil
}

// SaveFailure stores a reading that failed. The stored reading stays.
func (r *BoardsRepo) SaveFailure(ctx context.Context, boardID string, f board.Failure, failedAt time.Time) error {
	const stmt = `UPDATE board_readings SET failure = ?, failed_at = ? WHERE board_id = ?`

	encoded, err := json.Marshal(f)
	if err != nil {
		return fmt.Errorf("encode failure of board %s: %w", boardID, err)
	}
	if _, err = r.db.ExecContext(ctx, stmt, string(encoded), formatTime(failedAt), boardID); err != nil {
		return fmt.Errorf("save failure of board %s: %w", boardID, err)
	}
	return nil
}

// applyLinks ties each repository of links to a board: a registered one gets
// the board, and its clone when it has none; a new one is registered.
func applyLinks(ctx context.Context, tx *sql.Tx, boardID string, links []board.Link) error {
	const link = `UPDATE repositories SET board_id = ? WHERE id = ?`
	const path = `UPDATE repositories SET path = ? WHERE id = ? AND path = ''`
	const insert = `INSERT INTO repositories (` + repositoryColumns + `) VALUES (?, ?, ?, ?, ?, ?, ?)`

	for _, l := range links {
		if l.RepositoryID == "" {
			// A repository the board registers starts without review instructions.
			_, err := tx.ExecContext(ctx, insert,
				l.NewID, l.Owner, l.Name, l.Path, boardID, "", formatTime(l.CreatedAt))
			if err != nil {
				return fmt.Errorf("insert repository %s/%s of board %s: %w", l.Owner, l.Name, boardID, err)
			}
			continue
		}
		if _, err := tx.ExecContext(ctx, link, boardID, l.RepositoryID); err != nil {
			return fmt.Errorf("link repository %s to board %s: %w", l.RepositoryID, boardID, err)
		}
		if l.Path == "" {
			continue
		}
		if _, err := tx.ExecContext(ctx, path, l.Path, l.RepositoryID); err != nil {
			return fmt.Errorf("set clone of repository %s: %w", l.RepositoryID, err)
		}
	}
	return nil
}

// applyReleases takes each repository of releases off its board, or out of the
// app.
func applyReleases(ctx context.Context, tx *sql.Tx, releases []board.Release) error {
	const unlink = `UPDATE repositories SET board_id = NULL WHERE id = ?`
	const remove = `DELETE FROM repositories WHERE id = ?`

	for _, rel := range releases {
		stmt := unlink
		if rel.Remove {
			stmt = remove
		}
		if _, err := tx.ExecContext(ctx, stmt, rel.RepositoryID); err != nil {
			return fmt.Errorf("release repository %s: %w", rel.RepositoryID, err)
		}
	}
	return nil
}

func scanBoard(row scanner) (board.Board, error) {
	var (
		b         board.Board
		ownerType string
		finals    string
		createdAt string
	)
	if err := row.Scan(&b.ID, &b.Owner, &ownerType, &b.Number, &b.Title, &b.URL, &finals, &createdAt); err != nil {
		return board.Board{}, fmt.Errorf("scan board: %w", err)
	}

	b.OwnerType = board.OwnerType(ownerType)
	if err := json.Unmarshal([]byte(finals), &b.FinalStatuses); err != nil {
		return board.Board{}, fmt.Errorf("decode final statuses of board %s: %w", b.ID, err)
	}
	if b.FinalStatuses == nil {
		b.FinalStatuses = []string{}
	}
	var err error
	if b.CreatedAt, err = parseTime(createdAt, "board "+b.ID); err != nil {
		return board.Board{}, err
	}
	return b, nil
}

func scanReading(row scanner) (string, board.Stored, error) {
	var (
		id       string
		stored   board.Stored
		reading  string
		readAt   sql.NullString
		failure  string
		failedAt sql.NullString
	)
	if err := row.Scan(&id, &reading, &readAt, &failure, &failedAt); err != nil {
		return "", board.Stored{}, fmt.Errorf("scan board reading: %w", err)
	}

	if reading != "" {
		stored.Reading = &board.Reading{}
		if err := json.Unmarshal([]byte(reading), stored.Reading); err != nil {
			return "", board.Stored{}, fmt.Errorf("decode reading of board %s: %w", id, err)
		}
	}
	if failure != "" {
		stored.Failure = &board.Failure{}
		if err := json.Unmarshal([]byte(failure), stored.Failure); err != nil {
			return "", board.Stored{}, fmt.Errorf("decode failure of board %s: %w", id, err)
		}
	}
	var err error
	if readAt.Valid {
		if stored.ReadAt, err = parseTime(readAt.String, "reading of board "+id); err != nil {
			return "", board.Stored{}, err
		}
	}
	if failedAt.Valid {
		if stored.FailedAt, err = parseTime(failedAt.String, "failure of board "+id); err != nil {
			return "", board.Stored{}, err
		}
	}
	return id, stored, nil
}

// encodeFinalStatuses is the JSON of the final statuses of a board; nil is an
// empty list.
func encodeFinalStatuses(ids []string) (string, error) {
	if ids == nil {
		ids = []string{}
	}
	encoded, err := json.Marshal(ids)
	if err != nil {
		return "", fmt.Errorf("encode final statuses: %w", err)
	}
	return string(encoded), nil
}
