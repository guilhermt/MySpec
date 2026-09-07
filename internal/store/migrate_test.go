package store

import (
	"database/sql"
	"log/slog"
	"testing"
	"testing/fstest"

	"github.com/google/go-cmp/cmp"
)

// stagesVersion is the migration that brought the stages after the PRD;
// latestVersion is the version the embedded migrations end at.
const (
	stagesVersion = 3
	latestVersion = 4
)

// mapFS builds a migrations tree with the given file names.
func mapFS(names ...string) fstest.MapFS {
	fsys := fstest.MapFS{}
	for _, name := range names {
		fsys["migrations/"+name] = &fstest.MapFile{Data: []byte("SELECT 1;")}
	}
	return fsys
}

func TestLoadMigrationsReadsTheEmbeddedFiles(t *testing.T) {
	t.Parallel()

	migrations, err := loadMigrations(migrationsFS)
	if err != nil {
		t.Fatalf("loadMigrations() = %v, want nil", err)
	}
	if len(migrations) == 0 {
		t.Fatal("loadMigrations() returned nothing, want at least the initial migration")
	}
	if migrations[0].version != 1 || migrations[0].file != "0001_initial.sql" {
		t.Errorf("first migration = %d %q, want 1 %q", migrations[0].version, migrations[0].file, "0001_initial.sql")
	}
	if migrations[0].sql == "" {
		t.Error("first migration has no SQL")
	}
}

func TestLoadMigrationsSortsByVersion(t *testing.T) {
	t.Parallel()

	migrations, err := loadMigrations(mapFS("0002_second.sql", "0001_first.sql", "0003_third.sql"))
	if err != nil {
		t.Fatalf("loadMigrations() = %v, want nil", err)
	}

	for i, m := range migrations {
		if m.version != i+1 {
			t.Errorf("migration %d has version %d, want %d", i, m.version, i+1)
		}
	}
}

func TestLoadMigrationsRejectsBadSequences(t *testing.T) {
	t.Parallel()

	tests := map[string][]string{
		"hole":                  {"0001_first.sql", "0003_third.sql"},
		"does not start at one": {"0002_second.sql"},
		"repeated version":      {"0001_first.sql", "0001_again.sql"},
	}

	for name, names := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			if _, err := loadMigrations(mapFS(names...)); err == nil {
				t.Fatalf("loadMigrations(%v) = nil, want error", names)
			}
		})
	}
}

func TestLoadMigrationsRejectsBadNames(t *testing.T) {
	t.Parallel()

	tests := map[string]string{
		"no separator": "0001.sql",
		"short prefix": "001_first.sql",
		"long prefix":  "00001_first.sql",
		"non numeric":  "abcd_first.sql",
		"zero version": "0000_first.sql",
	}

	for name, file := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			if _, err := loadMigrations(mapFS(file)); err == nil {
				t.Fatalf("loadMigrations(%q) = nil, want error", file)
			}
		})
	}
}

func TestLoadMigrationsFailsWithoutTheDirectory(t *testing.T) {
	t.Parallel()

	if _, err := loadMigrations(fstest.MapFS{}); err == nil {
		t.Fatal("loadMigrations() = nil, want error")
	}
}

func TestParseVersion(t *testing.T) {
	t.Parallel()

	got, err := parseVersion("0042_something.sql")
	if err != nil {
		t.Fatalf("parseVersion() = %v, want nil", err)
	}
	if got != 42 {
		t.Errorf("parseVersion() = %d, want 42", got)
	}
}

func TestMigrateEndsAtTheLatestVersion(t *testing.T) {
	t.Parallel()

	migrations, err := loadMigrations(migrationsFS)
	if err != nil {
		t.Fatalf("loadMigrations() = %v, want nil", err)
	}
	if got := migrations[len(migrations)-1].version; got != latestVersion {
		t.Errorf("last migration version = %d, want %d", got, latestVersion)
	}

	db := openAt(t, latestVersion)
	got, err := schemaVersion(t.Context(), db)
	if err != nil {
		t.Fatalf("schemaVersion() = %v, want nil", err)
	}
	if got != latestVersion {
		t.Errorf("schemaVersion() = %d, want %d", got, latestVersion)
	}
}

func TestMigrateTurnsAFinishedPRDIntoThePRDStage(t *testing.T) {
	t.Parallel()

	db := openAt(t, stagesVersion-1)
	const insert = `INSERT INTO tasks
		(id, workspace_path, name, initial_context, stage, artifacts_dir, created_at, updated_at)
		VALUES (?, '/ws', ?, 'context', ?, '/data/x', '2026-09-06T10:00:00Z', '2026-09-06T10:00:00Z')`
	for _, row := range [][2]string{{"done", "prd_done"}, {"open", "prd"}} {
		if _, err := db.ExecContext(t.Context(), insert, row[0], row[0], row[1]); err != nil {
			t.Fatalf("insert task %s: %v", row[0], err)
		}
	}

	if err := migrate(t.Context(), db, slog.New(slog.DiscardHandler)); err != nil {
		t.Fatalf("migrate() = %v, want nil", err)
	}

	rows, err := db.QueryContext(t.Context(), `SELECT id, stage, revisiting FROM tasks ORDER BY id`)
	if err != nil {
		t.Fatalf("query tasks: %v", err)
	}
	defer func() { _ = rows.Close() }()

	got := map[string]string{}
	for rows.Next() {
		var id, stage string
		var revisiting bool
		if err := rows.Scan(&id, &stage, &revisiting); err != nil {
			t.Fatalf("scan task: %v", err)
		}
		if revisiting {
			t.Errorf("task %s revisiting = true, want the column to default to false", id)
		}
		got[id] = stage
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("query tasks: %v", err)
	}

	want := map[string]string{"done": "prd", "open": "prd"}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("stages mismatch (-want +got):\n%s", diff)
	}
}

// openAt opens an in-memory database migrated up to version, closed at the end
// of the test.
func openAt(t *testing.T, version int) *sql.DB {
	t.Helper()

	db, err := sql.Open("sqlite", memoryDSN)
	if err != nil {
		t.Fatalf("sql.Open() = %v, want nil", err)
	}
	db.SetMaxOpenConns(1)
	t.Cleanup(func() {
		if closeErr := db.Close(); closeErr != nil {
			t.Errorf("Close() = %v, want nil", closeErr)
		}
	})

	migrations, err := loadMigrations(migrationsFS)
	if err != nil {
		t.Fatalf("loadMigrations() = %v, want nil", err)
	}
	for _, m := range migrations {
		if m.version > version {
			break
		}
		if err := apply(t.Context(), db, m); err != nil {
			t.Fatalf("apply(%s) = %v, want nil", m.file, err)
		}
	}
	return db
}
