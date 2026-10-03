package store_test

import (
	"database/sql"
	"errors"
	"fmt"
	"syscall"
	"testing"

	_ "modernc.org/sqlite" // database/sql driver

	"github.com/guilhermt/myspec/internal/store"
)

// databaseFull is the error the driver reports when the database has no page
// left to grow into.
func databaseFull(t *testing.T) error {
	t.Helper()

	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	db.SetMaxOpenConns(1)

	for _, statement := range []string{"PRAGMA max_page_count = 2", "CREATE TABLE t (v TEXT)"} {
		if _, err = db.ExecContext(t.Context(), statement); err != nil {
			t.Fatalf("%s: %v", statement, err)
		}
	}
	for range 100 {
		if _, err = db.ExecContext(t.Context(), "INSERT INTO t VALUES (hex(randomblob(2048)))"); err != nil {
			return fmt.Errorf("save: %w", err)
		}
	}
	t.Fatal("the database never filled")
	return nil
}

// databaseFailure is an error of the driver that is not a full disk.
func databaseFailure(t *testing.T) error {
	t.Helper()

	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	_, err = db.ExecContext(t.Context(), "SELECT * FROM nothing")
	if err == nil {
		t.Fatal("a query on a missing table = nil, want an error")
	}
	return fmt.Errorf("save: %w", err)
}

func TestDiskFullAndPermissionDeniedTellTheCauseApart(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name       string
		err        error
		diskFull   bool
		permission bool
	}{
		{"ENOSPC wrapped", fmt.Errorf("write: %w", syscall.ENOSPC), true, false},
		{"SQLITE_FULL", databaseFull(t), true, false},
		{"EACCES wrapped", fmt.Errorf("open: %w", syscall.EACCES), false, true},
		{"EPERM wrapped", fmt.Errorf("open: %w", syscall.EPERM), false, true},
		{"another sqlite error", databaseFailure(t), false, false},
		{"another error", errors.New("boom"), false, false},
		{"nil", nil, false, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := store.DiskFull(tc.err); got != tc.diskFull {
				t.Errorf("DiskFull() = %v, want %v", got, tc.diskFull)
			}
			if got := store.PermissionDenied(tc.err); got != tc.permission {
				t.Errorf("PermissionDenied() = %v, want %v", got, tc.permission)
			}
		})
	}
}
