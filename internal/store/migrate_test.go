package store

import (
	"testing"
	"testing/fstest"
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
