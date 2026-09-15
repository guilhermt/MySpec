package store

import (
	"database/sql"
	"encoding/json"
	"log/slog"
	"maps"
	"slices"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/reviewmode"
	"github.com/guilhermt/myspec/internal/task"
)

// stagesVersion is the migration that brought the stages after the PRD,
// commitsVersion the one that gave a step its commits, prVersion the one that
// brought the PR stage, modelsVersion the one that brought the models,
// reviewModeVersion the one that brought the review mode, and latestVersion
// the version the embedded migrations end at.
const (
	stagesVersion     = 3
	commitsVersion    = 5
	prVersion         = 6
	modelsVersion     = 9
	reviewModeVersion = 10
	latestVersion     = 10
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

func TestMigrateGivesTheStepsOfAnOlderDatabaseEmptyCommits(t *testing.T) {
	t.Parallel()

	db := openAt(t, commitsVersion-1)
	const insertTask = `INSERT INTO tasks
		(id, workspace_path, name, initial_context, stage, artifacts_dir, created_at, updated_at, revisiting)
		VALUES ('task-1', '/ws', 'one', 'context', 'implementation', '/data/x',
			'2026-09-06T10:00:00Z', '2026-09-06T10:00:00Z', 0)`
	if _, err := db.ExecContext(t.Context(), insertTask); err != nil {
		t.Fatalf("insert task: %v", err)
	}
	const insertStep = `INSERT INTO steps (task_id, number, status, block_files, created_at, updated_at)
		VALUES ('task-1', 1, 'started', 0, '2026-09-06T10:00:00Z', '2026-09-06T10:00:00Z')`
	if _, err := db.ExecContext(t.Context(), insertStep); err != nil {
		t.Fatalf("insert step: %v", err)
	}

	if err := migrate(t.Context(), db, slog.New(slog.DiscardHandler)); err != nil {
		t.Fatalf("migrate() = %v, want nil", err)
	}

	const query = `SELECT start_commit, commit_sha, commit_subject FROM steps WHERE task_id = 'task-1'`
	var start, sha, subject string
	if err := db.QueryRowContext(t.Context(), query).Scan(&start, &sha, &subject); err != nil {
		t.Fatalf("query step: %v", err)
	}
	if start != "" || sha != "" || subject != "" {
		t.Errorf("commits = %q %q %q, want them empty on a step recorded before the column", start, sha, subject)
	}
}

func TestMigrateGivesTheWorktreesOfAnOlderDatabaseNoBaseAndAddsThePRRuns(t *testing.T) {
	t.Parallel()

	db := openAt(t, prVersion-1)
	const insertTask = `INSERT INTO tasks
		(id, workspace_path, name, initial_context, stage, artifacts_dir, created_at, updated_at, revisiting)
		VALUES ('task-1', '/ws', 'one', 'context', 'implementation', '/data/x',
			'2026-09-06T10:00:00Z', '2026-09-06T10:00:00Z', 0)`
	if _, err := db.ExecContext(t.Context(), insertTask); err != nil {
		t.Fatalf("insert task: %v", err)
	}
	const insertWorktree = `INSERT INTO worktrees (task_id, repo_path, path, branch, created_at)
		VALUES ('task-1', '/ws/api', '/ws/.myspec/worktrees/api/one', 'one', '2026-09-06T10:00:00Z')`
	if _, err := db.ExecContext(t.Context(), insertWorktree); err != nil {
		t.Fatalf("insert worktree: %v", err)
	}

	if err := migrate(t.Context(), db, slog.New(slog.DiscardHandler)); err != nil {
		t.Fatalf("migrate() = %v, want nil", err)
	}

	// The rule is applied again for a worktree created before the column, so
	// an empty base is what it has to read back as.
	const query = `SELECT base FROM worktrees WHERE task_id = 'task-1'`
	var base string
	if err := db.QueryRowContext(t.Context(), query).Scan(&base); err != nil {
		t.Fatalf("query worktree: %v", err)
	}
	if base != "" {
		t.Errorf("base = %q, want it empty on a worktree registered before the column", base)
	}

	const insertRun = `INSERT INTO pr_runs (task_id, repo_path, status, created_at, updated_at)
		VALUES ('task-1', '/ws/api', 'preparing', '2026-09-06T10:00:00Z', '2026-09-06T10:00:00Z')`
	if _, err := db.ExecContext(t.Context(), insertRun); err != nil {
		t.Fatalf("insert pr run: %v", err)
	}
	const runQuery = `SELECT pr_number, pr_url, pr_state, reviewed_commit, reported_pass
		FROM pr_runs WHERE task_id = 'task-1'`
	var (
		number, pass         int
		url, state, reviewed string
	)
	if err := db.QueryRowContext(t.Context(), runQuery).Scan(&number, &url, &state, &reviewed, &pass); err != nil {
		t.Fatalf("query pr run: %v", err)
	}
	if number != 0 || url != "" || state != "" || reviewed != "" || pass != 0 {
		t.Errorf("pr run = %d %q %q %q %d, want a row that knows nothing about a pull request yet",
			number, url, state, reviewed, pass)
	}
}

func TestTheModelsMigrationGivesTheFactoryDefaults(t *testing.T) {
	t.Parallel()

	migrations, err := loadMigrations(migrationsFS)
	if err != nil {
		t.Fatalf("loadMigrations() = %v, want nil", err)
	}
	index := slices.IndexFunc(migrations, func(candidate migration) bool { return candidate.version == modelsVersion })
	if index < 0 {
		t.Fatalf("no migration with version %d", modelsVersion)
	}

	_, after, found := strings.Cut(migrations[index].sql, "SET models = '")
	if !found {
		t.Fatal("the models migration does not set the models of the tasks that exist")
	}
	encoded, _, found := strings.Cut(after, "';")
	if !found {
		t.Fatal("the models migration does not close the value it sets")
	}

	var m task.Models
	if err := json.Unmarshal([]byte(encoded), &m); err != nil {
		t.Fatalf("json.Unmarshal(%q) = %v, want nil", encoded, err)
	}
	// The migration and the factory have to say the same thing, so that a task
	// that existed before it starts where a new one does. The step review came
	// later, and the migration of the review mode gives it to those tasks.
	want := models.Factory()
	delete(want, models.StepReview)
	if diff := cmp.Diff(want, m.Stages); diff != "" {
		t.Errorf("stages mismatch (-want +got):\n%s", diff)
	}
	if m.Steps != nil {
		t.Errorf("Steps = %v, want no step with a choice of its own", m.Steps)
	}
}

func TestMigrateLeavesTheTasksThatExistToTheUser(t *testing.T) {
	t.Parallel()

	db := openAt(t, reviewModeVersion-1)
	before := models.Factory()
	delete(before, models.StepReview)
	encoded, err := json.Marshal(task.Models{Stages: before})
	if err != nil {
		t.Fatalf("json.Marshal() = %v, want nil", err)
	}
	const insertTask = `INSERT INTO tasks
		(id, workspace_path, name, initial_context, stage, artifacts_dir, created_at, updated_at, revisiting, models)
		VALUES ('task-1', '/ws', 'one', 'context', 'implementation', '/data/x',
			'2026-09-06T10:00:00Z', '2026-09-06T10:00:00Z', 0, ?)`
	if _, err := db.ExecContext(t.Context(), insertTask, string(encoded)); err != nil {
		t.Fatalf("insert task: %v", err)
	}
	const insertStep = `INSERT INTO steps (task_id, number, status, block_files, created_at, updated_at)
		VALUES ('task-1', 1, 'started', 0, '2026-09-06T10:00:00Z', '2026-09-06T10:00:00Z')`
	if _, err := db.ExecContext(t.Context(), insertStep); err != nil {
		t.Fatalf("insert step: %v", err)
	}

	if err := migrate(t.Context(), db, slog.New(slog.DiscardHandler)); err != nil {
		t.Fatalf("migrate() = %v, want nil", err)
	}

	var reviewModes, stored string
	const taskQuery = `SELECT review_modes, models FROM tasks WHERE id = 'task-1'`
	if err := db.QueryRowContext(t.Context(), taskQuery).Scan(&reviewModes, &stored); err != nil {
		t.Fatalf("query task: %v", err)
	}

	var gotModes task.ReviewModes
	if err := json.Unmarshal([]byte(reviewModes), &gotModes); err != nil {
		t.Fatalf("json.Unmarshal(%q) = %v, want nil", reviewModes, err)
	}
	if diff := cmp.Diff(task.ReviewModes{Task: reviewmode.Manual}, gotModes); diff != "" {
		t.Errorf("review modes mismatch (-want +got):\n%s", diff)
	}

	var gotModels task.Models
	if err := json.Unmarshal([]byte(stored), &gotModels); err != nil {
		t.Fatalf("json.Unmarshal(%q) = %v, want nil", stored, err)
	}
	// The step review takes the factory choice, and every other stage keeps
	// the one it had.
	want := maps.Clone(before)
	want[models.StepReview] = models.Factory()[models.StepReview]
	if diff := cmp.Diff(want, gotModels.Stages); diff != "" {
		t.Errorf("stages mismatch (-want +got):\n%s", diff)
	}

	const stepQuery = `SELECT review_pass, reported_pass, review_fallback FROM steps WHERE task_id = 'task-1'`
	var (
		pass, reported int
		fallback       string
	)
	if err := db.QueryRowContext(t.Context(), stepQuery).Scan(&pass, &reported, &fallback); err != nil {
		t.Fatalf("query step: %v", err)
	}
	if pass != 0 || reported != 0 || fallback != "" {
		t.Errorf("agent review = %d %d %q, want a step that never went through one", pass, reported, fallback)
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
