// Package store persists the app state in a SQLite database.
package store

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite" // database/sql driver
)

// filePragmas keep one writer, WAL journaling and foreign keys on.
const filePragmas = "?_pragma=busy_timeout(5000)" +
	"&_pragma=journal_mode(WAL)" +
	"&_pragma=foreign_keys(1)" +
	"&_pragma=synchronous(NORMAL)"

// memoryDSN backs a private database that lives as long as its connection.
const memoryDSN = "file::memory:?_pragma=foreign_keys(1)"

// dirPerm keeps the database directory private to the user.
const dirPerm = 0o700

// Store owns the database connection and the repositories built on it.
type Store struct {
	db           *sql.DB
	Repositories *RepositoriesRepo
	Settings     *SettingsRepo
	Tasks        *TasksRepo
	Sessions     *SessionsRepo
	Entries      *EntriesRepo
	Worktrees    *WorktreesRepo
	Situations   *SituationsRepo
	Boards       *BoardsRepo
}

// Open opens the database at path, creating its directory and applying the
// pending migrations. upgrade carries the tasks of a database that still holds
// workspaces over; a database without them takes a nil upgrade.
func Open(ctx context.Context, path string, log *slog.Logger, upgrade Upgrade) (*Store, error) {
	if err := os.MkdirAll(filepath.Dir(path), dirPerm); err != nil {
		return nil, fmt.Errorf("create database directory: %w", err)
	}
	return open(ctx, "file:"+path+filePragmas, path, log, upgrade)
}

// OpenMemory opens a private in-memory database. It is meant for tests.
func OpenMemory(ctx context.Context, log *slog.Logger) (*Store, error) {
	return open(ctx, memoryDSN, ":memory:", log, nil)
}

func open(ctx context.Context, dsn, path string, log *slog.Logger, upgrade Upgrade) (*Store, error) {
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open database %s: %w", path, err)
	}
	// A single connection removes SQLITE_BUSY between the app's goroutines and
	// keeps an in-memory database alive for as long as the Store.
	db.SetMaxOpenConns(1)

	if err = db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("ping database %s: %w", path, err)
	}
	if err = migrate(ctx, db, log, upgrade); err != nil {
		_ = db.Close()
		return nil, err
	}

	version, err := schemaVersion(ctx, db)
	if err != nil {
		_ = db.Close()
		return nil, err
	}
	log.Info("database opened", "path", path, "schema_version", version)

	return &Store{
		db:           db,
		Repositories: &RepositoriesRepo{db: db},
		Settings:     &SettingsRepo{db: db},
		Tasks:        &TasksRepo{db: db},
		Sessions:     &SessionsRepo{db: db},
		Entries:      &EntriesRepo{db: db},
		Worktrees:    &WorktreesRepo{db: db},
		Situations:   &SituationsRepo{db: db},
		Boards:       &BoardsRepo{db: db},
	}, nil
}

// Close closes the database.
func (s *Store) Close() error {
	if err := s.db.Close(); err != nil {
		return fmt.Errorf("close database: %w", err)
	}
	return nil
}

// SchemaVersion is the migration version currently applied.
func (s *Store) SchemaVersion(ctx context.Context) (int, error) {
	return schemaVersion(ctx, s.db)
}

// scanner is what *sql.Row and *sql.Rows have in common, so a row of a table
// is scanned by one function whatever the query returned it.
type scanner interface {
	Scan(dest ...any) error
}

// formatTime writes an instant the way every timestamp column stores it.
func formatTime(t time.Time) string {
	return t.UTC().Format(time.RFC3339Nano)
}

// parseTime reads a timestamp column; subject names the row in the error.
func parseTime(value, subject string) (time.Time, error) {
	parsed, err := time.Parse(time.RFC3339Nano, value)
	if err != nil {
		return time.Time{}, fmt.Errorf("parse time of %s: %w", subject, err)
	}
	return parsed, nil
}

// nullString stores an empty string as NULL, which is how the nullable columns
// spell "absent".
func nullString(value string) sql.NullString {
	return sql.NullString{String: value, Valid: value != ""}
}

// nullTime stores an instant nobody recorded as NULL, which is how a nullable
// timestamp column spells "never".
func nullTime(t time.Time) sql.NullString {
	if t.IsZero() {
		return sql.NullString{}
	}
	return sql.NullString{String: formatTime(t), Valid: true}
}
