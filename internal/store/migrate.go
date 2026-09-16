package store

import (
	"cmp"
	"context"
	"database/sql"
	"embed"
	"fmt"
	"io/fs"
	"log/slog"
	"path"
	"slices"
	"strconv"
	"strings"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

// migrationsDir is where the migration files live inside migrationsFS.
const migrationsDir = "migrations"

// versionDigits is how many digits the version prefix of a migration file has.
const versionDigits = 4

type migration struct {
	version int
	file    string
	sql     string
}

// migrate applies every migration newer than PRAGMA user_version, one
// transaction per file. upgrade carries the tasks of a version with workspaces
// over, in the transaction of the migration that registers the repositories.
func migrate(ctx context.Context, db *sql.DB, log *slog.Logger, upgrade Upgrade) error {
	current, err := schemaVersion(ctx, db)
	if err != nil {
		return err
	}

	migrations, err := loadMigrations(migrationsFS)
	if err != nil {
		return err
	}

	for _, m := range migrations {
		if m.version <= current {
			continue
		}
		if err := apply(ctx, db, m, upgrade); err != nil {
			return err
		}
		log.Info("migration applied", "version", m.version, "file", m.file)
	}
	return nil
}

// apply runs one migration and bumps the schema version in the same transaction.
func apply(ctx context.Context, db *sql.DB, m migration, upgrade Upgrade) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin migration %s: %w", m.file, err)
	}
	defer func() { _ = tx.Rollback() }()

	if _, err = tx.ExecContext(ctx, m.sql); err != nil {
		return fmt.Errorf("apply migration %s: %w", m.file, err)
	}

	plan := noPlan()
	if m.version == repositoriesVersion {
		if plan, err = upgradeTasks(ctx, tx, upgrade); err != nil {
			return fmt.Errorf("apply migration %s: %w", m.file, err)
		}
	}

	// PRAGMA takes no placeholders, so the version is inlined; it comes from the
	// file name and is already an int.
	if _, err = tx.ExecContext(ctx, "PRAGMA user_version = "+strconv.Itoa(m.version)); err != nil {
		plan.Undo()
		return fmt.Errorf("set schema version %d: %w", m.version, err)
	}
	if err = tx.Commit(); err != nil {
		plan.Undo()
		return fmt.Errorf("commit migration %s: %w", m.file, err)
	}
	plan.Done()
	return nil
}

// loadMigrations reads the migration files in version order and rejects a
// sequence with a hole or a repeated version.
func loadMigrations(fsys fs.FS) ([]migration, error) {
	entries, err := fs.ReadDir(fsys, migrationsDir)
	if err != nil {
		return nil, fmt.Errorf("read migrations: %w", err)
	}

	migrations := make([]migration, 0, len(entries))
	for _, entry := range entries {
		version, err := parseVersion(entry.Name())
		if err != nil {
			return nil, err
		}
		body, err := fs.ReadFile(fsys, path.Join(migrationsDir, entry.Name()))
		if err != nil {
			return nil, fmt.Errorf("read migration %s: %w", entry.Name(), err)
		}
		migrations = append(migrations, migration{version: version, file: entry.Name(), sql: string(body)})
	}

	slices.SortFunc(migrations, func(a, b migration) int { return cmp.Compare(a.version, b.version) })
	for i, m := range migrations {
		if m.version != i+1 {
			return nil, fmt.Errorf("migration %s: out of sequence, expected version %d", m.file, i+1)
		}
	}
	return migrations, nil
}

// parseVersion reads the NNNN prefix of a migration file name.
func parseVersion(name string) (int, error) {
	prefix, _, found := strings.Cut(strings.TrimSuffix(name, ".sql"), "_")
	if !found || len(prefix) != versionDigits {
		return 0, fmt.Errorf("migration %s: name must be NNNN_description.sql", name)
	}
	version, err := strconv.Atoi(prefix)
	if err != nil || version < 1 {
		return 0, fmt.Errorf("migration %s: invalid version prefix %q", name, prefix)
	}
	return version, nil
}

func schemaVersion(ctx context.Context, db *sql.DB) (int, error) {
	var version int
	if err := db.QueryRowContext(ctx, "PRAGMA user_version").Scan(&version); err != nil {
		return 0, fmt.Errorf("read schema version: %w", err)
	}
	return version, nil
}
