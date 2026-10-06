package store_test

import (
	"database/sql"
	"errors"
	"fmt"
	"path/filepath"
	"testing"

	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/store"
)

// schemaVersionNow is how many migrations the embedded set holds.
const schemaVersionNow = 25

func TestOpenMemoryAppliesMigrations(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	version, err := s.SchemaVersion(t.Context())
	if err != nil {
		t.Fatalf("SchemaVersion() = %v, want nil", err)
	}
	if version != schemaVersionNow {
		t.Errorf("SchemaVersion() = %d, want %d", version, schemaVersionNow)
	}
}

func TestOpenMemoryCreatesTheTables(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	// A read on each table proves every migration ran.
	if _, err := s.Repositories.List(t.Context()); err != nil {
		t.Errorf("Repositories.List() = %v, want nil", err)
	}
	if _, _, err := s.Settings.Get(t.Context(), "theme"); err != nil {
		t.Errorf("Settings.Get() = %v, want nil", err)
	}
	if _, err := s.Tasks.ListActive(t.Context()); err != nil {
		t.Errorf("Tasks.ListActive() = %v, want nil", err)
	}
	if _, err := s.Sessions.Get(t.Context(), "missing", "prd"); !errors.Is(err, session.ErrNotFound) {
		t.Errorf("Sessions.Get() = %v, want session.ErrNotFound", err)
	}
	if _, err := s.Entries.List(t.Context(), "missing"); err != nil {
		t.Errorf("Entries.List() = %v, want nil", err)
	}
	if _, err := s.Tasks.ListStepRuns(t.Context(), "missing"); err != nil {
		t.Errorf("Tasks.ListStepRuns() = %v, want nil", err)
	}
}

func TestOpenCreatesTheDatabaseDirectory(t *testing.T) {
	t.Parallel()
	path := filepath.Join(t.TempDir(), "data", "myspec.db")
	capture := newLogCapture()

	s, err := store.Open(t.Context(), path, capture.log, nil)
	if err != nil {
		t.Fatalf("Open() = %v, want nil", err)
	}
	if err := s.Close(); err != nil {
		t.Fatalf("Close() = %v, want nil", err)
	}

	if got := capture.count(t, "migration applied"); got != schemaVersionNow {
		t.Errorf("applied %d migrations, want %d", got, schemaVersionNow)
	}
	if got := capture.count(t, "database opened"); got != 1 {
		t.Errorf("logged %d openings, want 1", got)
	}
}

func TestOpenTwiceDoesNotReapplyMigrations(t *testing.T) {
	t.Parallel()
	path := filepath.Join(t.TempDir(), "myspec.db")

	first, err := store.Open(t.Context(), path, newLogCapture().log, nil)
	if err != nil {
		t.Fatalf("Open() = %v, want nil", err)
	}
	if err = first.Close(); err != nil {
		t.Fatalf("Close() = %v, want nil", err)
	}

	capture := newLogCapture()
	second, err := store.Open(t.Context(), path, capture.log, nil)
	if err != nil {
		t.Fatalf("Open() = %v, want nil", err)
	}
	defer func() {
		if closeErr := second.Close(); closeErr != nil {
			t.Errorf("Close() = %v, want nil", closeErr)
		}
	}()

	if got := capture.count(t, "migration applied"); got != 0 {
		t.Errorf("applied %d migrations on reopen, want 0", got)
	}
	version, err := second.SchemaVersion(t.Context())
	if err != nil {
		t.Fatalf("SchemaVersion() = %v, want nil", err)
	}
	if version != schemaVersionNow {
		t.Errorf("SchemaVersion() = %d, want %d", version, schemaVersionNow)
	}
}

func TestOpenPersistsAcrossReopen(t *testing.T) {
	t.Parallel()
	path := filepath.Join(t.TempDir(), "myspec.db")

	first, err := store.Open(t.Context(), path, newLogCapture().log, nil)
	if err != nil {
		t.Fatalf("Open() = %v, want nil", err)
	}
	if err = first.Settings.Set(t.Context(), "theme", "dark"); err != nil {
		t.Fatalf("Set() = %v, want nil", err)
	}
	if err = first.Close(); err != nil {
		t.Fatalf("Close() = %v, want nil", err)
	}

	second, err := store.Open(t.Context(), path, newLogCapture().log, nil)
	if err != nil {
		t.Fatalf("Open() = %v, want nil", err)
	}
	defer func() {
		if closeErr := second.Close(); closeErr != nil {
			t.Errorf("Close() = %v, want nil", closeErr)
		}
	}()

	value, ok, err := second.Settings.Get(t.Context(), "theme")
	if err != nil {
		t.Fatalf("Get() = %v, want nil", err)
	}
	if !ok || value != "dark" {
		t.Errorf("Get() = %q, %v, want %q, true", value, ok, "dark")
	}
}

func TestOpenFailsWhenTheDirectoryCannotBeCreated(t *testing.T) {
	t.Parallel()
	blocked := filepath.Join(t.TempDir(), "file")
	if err := writeEmptyFile(t, blocked); err != nil {
		t.Fatalf("write file: %v", err)
	}

	if _, err := store.Open(t.Context(), filepath.Join(blocked, "myspec.db"), newLogCapture().log, nil); err == nil {
		t.Fatal("Open() = nil, want error")
	}
}

func TestOpenRefusesADatabaseOfANewerVersionWithoutWritingToIt(t *testing.T) {
	t.Parallel()
	path := filepath.Join(t.TempDir(), "myspec.db")
	newer := schemaVersionNow + 3

	seeded, err := sql.Open("sqlite", "file:"+path)
	if err != nil {
		t.Fatalf("sql.Open() = %v, want nil", err)
	}
	for _, statement := range []string{
		"CREATE TABLE keep (name TEXT)",
		"INSERT INTO keep (name) VALUES ('from the newer version')",
		fmt.Sprintf("PRAGMA user_version = %d", newer),
	} {
		if _, err = seeded.ExecContext(t.Context(), statement); err != nil {
			t.Fatalf("Exec(%q) = %v, want nil", statement, err)
		}
	}
	if err = seeded.Close(); err != nil {
		t.Fatalf("Close() = %v, want nil", err)
	}

	st, err := store.Open(t.Context(), path, newLogCapture().log, nil)
	var refused *store.NewerError
	if !errors.As(err, &refused) {
		t.Fatalf("Open() = %v, want a *NewerError", err)
	}
	if st != nil {
		t.Errorf("Open() store = %v, want nil", st)
	}
	if refused.Data != newer || refused.Known != schemaVersionNow {
		t.Errorf("NewerError = %+v, want Data %d and Known %d", refused, newer, schemaVersionNow)
	}

	after, err := sql.Open("sqlite", "file:"+path)
	if err != nil {
		t.Fatalf("sql.Open() = %v, want nil", err)
	}
	defer func() {
		if closeErr := after.Close(); closeErr != nil {
			t.Errorf("Close() = %v, want nil", closeErr)
		}
	}()
	var version int
	if err = after.QueryRowContext(t.Context(), "PRAGMA user_version").Scan(&version); err != nil {
		t.Fatalf("user_version = %v, want nil", err)
	}
	if version != newer {
		t.Errorf("user_version = %d, want %d, untouched", version, newer)
	}
	var name string
	if err = after.QueryRowContext(t.Context(), "SELECT name FROM keep").Scan(&name); err != nil || name != "from the newer version" {
		t.Errorf("keep = %q, %v, want the row untouched", name, err)
	}
	var tables int
	if err = after.QueryRowContext(t.Context(), "SELECT count(*) FROM sqlite_master WHERE type = 'table'").Scan(&tables); err != nil || tables != 1 {
		t.Errorf("tables = %d, %v, want 1: no migration ran", tables, err)
	}
}
