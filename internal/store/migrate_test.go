package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"log/slog"
	"maps"
	"slices"
	"strings"
	"testing"
	"testing/fstest"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/repository"
	"github.com/guilhermt/myspec/internal/reviewmode"
	"github.com/guilhermt/myspec/internal/task"
)

// stagesVersion is the migration that brought the stages after the PRD,
// commitsVersion the one that gave a step its commits, prVersion the one that
// brought the PR stage, modelsVersion the one that brought the models,
// reviewModeVersion the one that brought the review mode, modeVersion the one
// that brought the mode of a task, boardsVersion the one that brought the
// boards, itemsVersion the one that brought the items and the reviews, and
// latestVersion the version the embedded migrations end at.
const (
	stagesVersion     = 3
	commitsVersion    = 5
	prVersion         = 6
	modelsVersion     = 9
	reviewModeVersion = 10
	modeVersion       = 11
	boardsVersion     = 14
	itemsVersion      = 15
	latestVersion     = 17
)

// upgradeTime is the instant the repositories of the fake upgrades are stamped
// with.
var upgradeTime = time.Date(2026, time.September, 6, 10, 0, 0, 0, time.UTC)

// upgradeRepo is the repository the fake upgrades register.
var upgradeRepo = repository.Repository{
	ID:        "repo-1",
	Owner:     "acme",
	Name:      "api",
	Path:      "/code/api",
	CreatedAt: upgradeTime,
}

// carryOver is an Upgrade that ties every task to upgradeRepo and leaves the
// artifacts where they are. It is what the tests of the older migrations need
// to reach the latest version.
func carryOver(t *testing.T) Upgrade {
	t.Helper()

	return func(_ context.Context, legacy []LegacyTask) (UpgradePlan, error) {
		plan := UpgradePlan{
			Repositories: []repository.Repository{upgradeRepo},
			Undo:         func() { t.Error("Undo() called, want the plan to apply") },
			Done:         func() {},
		}
		for _, legacyTask := range legacy {
			plan.Tasks = append(plan.Tasks, UpgradedTask{
				ID:           legacyTask.ID,
				RepositoryID: upgradeRepo.ID,
				ArtifactsDir: legacyTask.ArtifactsDir,
			})
		}
		return plan, nil
	}
}

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

	if err := migrate(t.Context(), db, slog.New(slog.DiscardHandler), carryOver(t)); err != nil {
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

	if err := migrate(t.Context(), db, slog.New(slog.DiscardHandler), carryOver(t)); err != nil {
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

	if err := migrate(t.Context(), db, slog.New(slog.DiscardHandler), carryOver(t)); err != nil {
		t.Fatalf("migrate() = %v, want nil", err)
	}

	// The rule is applied again for a worktree created before the column, so
	// an empty base is what it has to read back as.
	const query = `SELECT base FROM worktrees WHERE item_id = 'task-1'`
	var base string
	if err := db.QueryRowContext(t.Context(), query).Scan(&base); err != nil {
		t.Fatalf("query worktree: %v", err)
	}
	if base != "" {
		t.Errorf("base = %q, want it empty on a worktree registered before the column", base)
	}

	const insertRun = `INSERT INTO pr_runs (task_id, status, created_at, updated_at)
		VALUES ('task-1', 'preparing', '2026-09-06T10:00:00Z', '2026-09-06T10:00:00Z')`
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

func TestTheModelsMigrationGivesTheDefaultsOfItsRelease(t *testing.T) {
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
	// The migration writes the choices of the release that shipped it, frozen:
	// a task that existed before it starts where a new one did then, and the
	// user changes what it holds from there. The step review came later, and
	// the migration of the review mode gives it to those tasks; the One-Shot
	// planning came later still, and only a One-Shot task, created with it,
	// runs one. The discussion is no stage of a task: it is an item of its own.
	want := models.Set{
		models.PRD:            {Model: models.Fable51, Effort: models.High},
		models.TechSpec:       {Model: models.Fable51, Effort: models.High},
		models.Plan:           {Model: models.Fable51, Effort: models.High},
		models.Implementation: {Model: "claude-opus-5", Effort: models.High},
		models.PR:             {Model: "claude-opus-5", Effort: models.Medium},
		models.PRReview:       {Model: "claude-opus-5", Effort: models.High},
	}
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
	delete(before, models.OneShot)
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

	if err := migrate(t.Context(), db, slog.New(slog.DiscardHandler), carryOver(t)); err != nil {
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
	// The step review takes the choice the migration froze, and every other
	// stage keeps the one it had.
	want := maps.Clone(before)
	want[models.StepReview] = models.Choice{Model: "claude-opus-5", Effort: models.High}
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

func TestMigrateMakesTheTasksThatExistStructured(t *testing.T) {
	t.Parallel()

	db := openAt(t, modeVersion-1)
	const insertTask = `INSERT INTO tasks
		(id, workspace_path, name, initial_context, stage, artifacts_dir, created_at, updated_at, revisiting)
		VALUES ('task-1', '/ws', 'one', 'context', 'plan', '/data/x',
			'2026-09-06T10:00:00Z', '2026-09-06T10:00:00Z', 0)`
	if _, err := db.ExecContext(t.Context(), insertTask); err != nil {
		t.Fatalf("insert task: %v", err)
	}

	if err := migrate(t.Context(), db, slog.New(slog.DiscardHandler), carryOver(t)); err != nil {
		t.Fatalf("migrate() = %v, want nil", err)
	}

	var mode string
	if err := db.QueryRowContext(t.Context(), `SELECT mode FROM tasks WHERE id = 'task-1'`).Scan(&mode); err != nil {
		t.Fatalf("query task: %v", err)
	}
	if mode != string(task.ModeStructured) {
		t.Errorf("mode = %q, want %q for a task created before the column", mode, task.ModeStructured)
	}
}

func TestTheBoardsMigrationKeepsTheRepositoriesWithoutABoardAndTheTasks(t *testing.T) {
	t.Parallel()

	db := openAt(t, boardsVersion-1)
	const insertRepository = `INSERT INTO repositories (id, owner, name, path, created_at)
		VALUES ('repo-1', 'acme', 'api', '/code/api', '2026-09-06T10:00:00Z')`
	const insertTask = `INSERT INTO tasks
		(id, repository_id, name, initial_context, stage, artifacts_dir, created_at, updated_at, revisiting)
		VALUES ('task-1', 'repo-1', 'one', 'context', 'plan', '/data/x',
			'2026-09-06T10:00:00Z', '2026-09-06T10:00:00Z', 0)`
	for _, stmt := range []string{insertRepository, insertTask} {
		if _, err := db.ExecContext(t.Context(), stmt); err != nil {
			t.Fatalf("seed: %v", err)
		}
	}

	if err := migrate(t.Context(), db, slog.New(slog.DiscardHandler), carryOver(t)); err != nil {
		t.Fatalf("migrate() = %v, want nil", err)
	}

	if diff := cmp.Diff([]repository.Repository{upgradeRepo}, readRepositories(t, db)); diff != "" {
		t.Errorf("repositories mismatch (-want +got):\n%s", diff)
	}
	if got := readOne(t, db, `SELECT count(*) FROM repositories WHERE board_id IS NULL`); got != "1" {
		t.Errorf("repositories without a board = %s, want 1", got)
	}
	wantTasks := map[string][2]string{"task-1": {upgradeRepo.ID, "/data/x"}}
	if diff := cmp.Diff(wantTasks, readTaskRepositories(t, db)); diff != "" {
		t.Errorf("tasks mismatch (-want +got):\n%s", diff)
	}
}

func TestTheItemsMigrationCarriesTheTaskAndWhatBelongsToIt(t *testing.T) {
	t.Parallel()

	db := openAt(t, itemsVersion-1)
	seedRepositoryAndTask(t, db)
	seedItemRecords(t, db, "task-1", "task_id")

	if err := migrate(t.Context(), db, slog.New(slog.DiscardHandler), carryOver(t)); err != nil {
		t.Fatalf("migrate() = %v, want nil", err)
	}

	if got := readOne(t, db, `SELECT count(*) FROM items WHERE id = 'task-1' AND kind = 'task'`); got != "1" {
		t.Errorf("items of the task = %s, want 1", got)
	}
	if got := readOne(t, db, `SELECT count(*) FROM items`); got != "1" {
		t.Errorf("items = %s, want one row per task", got)
	}
	for _, count := range itemCounts(t, db, "task-1") {
		if count.got != count.want {
			t.Errorf("%s = %d, want %d carried over to the item", count.subject, count.got, count.want)
		}
	}
	if got := readOne(t, db, `SELECT stage FROM sessions WHERE id = 'sess-2'`); got != "implementation" {
		t.Errorf("the stage of the second session = %q, want %q", got, "implementation")
	}
}

func TestATaskTakesItsItemAndWhatBelongsToItWhenItGoes(t *testing.T) {
	t.Parallel()

	db := openAt(t, latestVersion)
	seedRepositoryAndTask(t, db)
	seedItemRecords(t, db, "task-1", "item_id")

	if got := readOne(t, db, `SELECT kind FROM items WHERE id = 'task-1'`); got != "task" {
		t.Errorf("the item of the task is a %q, want a task", got)
	}

	if _, err := db.ExecContext(t.Context(), `DELETE FROM tasks WHERE id = 'task-1'`); err != nil {
		t.Fatalf("delete task: %v", err)
	}

	if got := readOne(t, db, `SELECT count(*) FROM items`); got != "0" {
		t.Errorf("items left = %s, want the item of the task gone with it", got)
	}
	for _, count := range itemCounts(t, db, "task-1") {
		if count.got != 0 {
			t.Errorf("%s = %d, want it gone by cascade", count.subject, count.got)
		}
	}
}

func TestAReviewTakesItsItemAndWhatBelongsToItWhenItGoes(t *testing.T) {
	t.Parallel()

	db := openAt(t, latestVersion)
	seedRepositoryAndTask(t, db)
	const insertReview = `INSERT INTO reviews
		(id, repository_id, number, title, author, url, head_branch, base_branch, mode, artifacts_dir,
			created_at, updated_at)
		VALUES ('review-1', 'repo-1', 7, 'Read the boards', 'colleague', 'https://github.com/acme/api/pull/7',
			'boards', 'main', 'publish', '/data/reviews/acme/api/pr-7-abcdef12',
			'2026-09-06T10:00:00Z', '2026-09-06T10:00:00Z')`
	if _, err := db.ExecContext(t.Context(), insertReview); err != nil {
		t.Fatalf("insert review: %v", err)
	}
	seedItemRecords(t, db, "review-1", "item_id")

	if got := readOne(t, db, `SELECT kind FROM items WHERE id = 'review-1'`); got != "review" {
		t.Errorf("the item of the review is a %q, want a review", got)
	}

	if _, err := db.ExecContext(t.Context(), `DELETE FROM reviews WHERE id = 'review-1'`); err != nil {
		t.Fatalf("delete review: %v", err)
	}

	if got := readOne(t, db, `SELECT count(*) FROM items WHERE id = 'review-1'`); got != "0" {
		t.Errorf("items of the review = %s, want the item gone with it", got)
	}
	for _, count := range itemCounts(t, db, "review-1") {
		if count.got != 0 {
			t.Errorf("%s = %d, want it gone by cascade", count.subject, count.got)
		}
	}
}

// seedRepositoryAndTask inserts the repository and the task the tests of the
// items migration hang everything else on.
func seedRepositoryAndTask(t *testing.T, db *sql.DB) {
	t.Helper()

	const insertRepository = `INSERT INTO repositories (id, owner, name, path, created_at)
		VALUES ('repo-1', 'acme', 'api', '/code/api', '2026-09-06T10:00:00Z')`
	const insertTask = `INSERT INTO tasks
		(id, repository_id, name, initial_context, stage, artifacts_dir, created_at, updated_at, revisiting)
		VALUES ('task-1', 'repo-1', 'one', 'context', 'implementation', '/data/x',
			'2026-09-06T10:00:00Z', '2026-09-06T10:00:00Z', 0)`
	for _, stmt := range []string{insertRepository, insertTask} {
		if _, err := db.ExecContext(t.Context(), stmt); err != nil {
			t.Fatalf("seed: %v", err)
		}
	}
}

// seedItemRecords fills what belongs to an item: two sessions with an entry
// each, a worktree and a situation. column is what the owner is called in this
// version of the schema.
func seedItemRecords(t *testing.T, db *sql.DB, itemID, column string) {
	t.Helper()

	statements := []struct {
		subject string
		sql     string
	}{
		{"first session", `INSERT INTO sessions (id, ` + column + `, stage, created_at, updated_at)
			VALUES ('sess-1', ?, 'prd', '2026-09-06T10:00:00Z', '2026-09-06T10:00:00Z')`},
		{"second session", `INSERT INTO sessions (id, ` + column + `, stage, created_at, updated_at)
			VALUES ('sess-2', ?, 'implementation', '2026-09-06T10:00:00Z', '2026-09-06T10:00:00Z')`},
		{"first entry", `INSERT INTO transcript_entries (id, session_id, seq, turn_id, kind, payload, created_at)
			VALUES ('entry-1', 'sess-1', 1, 'turn-1', 'user', '{}', '2026-09-06T10:00:00Z')`},
		{"second entry", `INSERT INTO transcript_entries (id, session_id, seq, turn_id, kind, payload, created_at)
			VALUES ('entry-2', 'sess-2', 1, 'turn-2', 'user', '{}', '2026-09-06T10:00:00Z')`},
		{"worktree", `INSERT INTO worktrees (` + column + `, repo_path, path, branch, base, created_at)
			VALUES (?, '/code/api', '/data/worktrees/acme/api/one', 'one', 'origin/main', '2026-09-06T10:00:00Z')`},
		{"situation", `INSERT INTO situations (` + column + `, place, id, kind, started_at)
			VALUES (?, 'stage:implementation', 'sit-1', 'reply', '2026-09-06T10:00:00Z')`},
	}
	for _, statement := range statements {
		args := []any{}
		if strings.Contains(statement.sql, "?") {
			args = append(args, itemID)
		}
		if _, err := db.ExecContext(t.Context(), statement.sql, args...); err != nil {
			t.Fatalf("insert %s: %v", statement.subject, err)
		}
	}
}

// itemCount is how many rows of one table belong to an item, and how many the
// test wants there.
type itemCount struct {
	subject   string
	got, want int
}

// itemCounts counts what belongs to an item in the schema the items migration
// left: its sessions, their entries, its worktree and its situations.
func itemCounts(t *testing.T, db *sql.DB, itemID string) []itemCount {
	t.Helper()

	queries := []struct {
		subject string
		query   string
		want    int
	}{
		{"sessions", `SELECT count(*) FROM sessions WHERE item_id = ?`, 2},
		{"entries", `SELECT count(*) FROM transcript_entries
			WHERE session_id IN (SELECT id FROM sessions WHERE item_id = ?)`, 2},
		{"worktrees", `SELECT count(*) FROM worktrees WHERE item_id = ?`, 1},
		{"situations", `SELECT count(*) FROM situations WHERE item_id = ?`, 1},
	}
	counts := make([]itemCount, 0, len(queries))
	for _, q := range queries {
		var got int
		if err := db.QueryRowContext(t.Context(), q.query, itemID).Scan(&got); err != nil {
			t.Fatalf("count %s: %v", q.subject, err)
		}
		counts = append(counts, itemCount{subject: q.subject, got: got, want: q.want})
	}
	return counts
}

// seedLegacyTask inserts a task the way a version with workspaces stored it.
// An empty repoPath is a task at the root of its workspace, an empty archivedAt
// a task that is still active.
func seedLegacyTask(t *testing.T, db *sql.DB, id, name, repoPath, archivedAt string) {
	t.Helper()

	const insert = `INSERT INTO tasks
		(id, workspace_path, name, repo_path, initial_context, stage, artifacts_dir, archived_at,
			created_at, updated_at, revisiting)
		VALUES (?, '/ws', ?, ?, 'context', 'implementation', ?, ?,
			'2026-09-06T10:00:00Z', '2026-09-06T10:00:00Z', 0)`

	_, err := db.ExecContext(t.Context(), insert, id, name, nullString(repoPath),
		"/data/workspaces/ws/"+name, nullString(archivedAt))
	if err != nil {
		t.Fatalf("insert task %s: %v", id, err)
	}
}

// readRepositories returns the registered repositories, in insertion order.
func readRepositories(t *testing.T, db *sql.DB) []repository.Repository {
	t.Helper()

	rows, err := db.QueryContext(t.Context(), `SELECT `+repositoryColumns+` FROM repositories ORDER BY id`)
	if err != nil {
		t.Fatalf("query repositories: %v", err)
	}
	defer func() { _ = rows.Close() }()

	var list []repository.Repository
	for rows.Next() {
		repo, scanErr := scanRepository(rows)
		if scanErr != nil {
			t.Fatalf("scan repository: %v", scanErr)
		}
		list = append(list, repo)
	}
	if err = rows.Err(); err != nil {
		t.Fatalf("query repositories: %v", err)
	}
	return list
}

// readTaskRepositories returns the repository and the artifact folder of every
// task left in the database, by task id.
func readTaskRepositories(t *testing.T, db *sql.DB) map[string][2]string {
	t.Helper()

	const query = `SELECT id, repository_id, artifacts_dir FROM tasks ORDER BY id`
	rows, err := db.QueryContext(t.Context(), query)
	if err != nil {
		t.Fatalf("query tasks: %v", err)
	}
	defer func() { _ = rows.Close() }()

	got := map[string][2]string{}
	for rows.Next() {
		var (
			id, artifactsDir string
			repositoryID     sql.NullString
		)
		if scanErr := rows.Scan(&id, &repositoryID, &artifactsDir); scanErr != nil {
			t.Fatalf("scan task: %v", scanErr)
		}
		got[id] = [2]string{repositoryID.String, artifactsDir}
	}
	if err = rows.Err(); err != nil {
		t.Fatalf("query tasks: %v", err)
	}
	return got
}

// seedLegacyRecords fills the rows of a task that 0013 rewrites: its step, its
// sessions, its PR run, its worktree and its situation.
func seedLegacyRecords(t *testing.T, db *sql.DB, id string) {
	t.Helper()

	statements := []struct {
		subject string
		sql     string
	}{
		{"step", `INSERT INTO steps (task_id, number, status, block_reason, block_files, created_at, updated_at)
			VALUES (?, 1, 'blocked', 'no_repository', 0, '2026-09-06T10:00:00Z', '2026-09-06T10:00:00Z')`},
		{"pr session", `INSERT INTO sessions (id, task_id, stage, created_at, updated_at)
			VALUES ('sess-pr', ?, 'pr:web', '2026-09-06T10:00:00Z', '2026-09-06T10:00:00Z')`},
		{"pr review session", `INSERT INTO sessions (id, task_id, stage, created_at, updated_at)
			VALUES ('sess-review', ?, 'pr_review:web', '2026-09-06T10:00:00Z', '2026-09-06T10:00:00Z')`},
		{"pr run", `INSERT INTO pr_runs (task_id, repo_path, status, created_at, updated_at)
			VALUES (?, '/ws/api', 'skipped', '2026-09-06T10:00:00Z', '2026-09-06T10:00:00Z')`},
		{"worktree", `INSERT INTO worktrees (task_id, repo_path, path, branch, base, created_at)
			VALUES (?, '/ws/api', '/ws/.myspec/worktrees/api/one', 'one', 'origin/dev', '2026-09-06T10:00:00Z')`},
		{"situation", `INSERT INTO situations (task_id, place, id, kind, started_at)
			VALUES (?, 'repo:/ws/api', 'sit-1', 'merge', '2026-09-06T10:00:00Z')`},
		{"recent workspace", `INSERT INTO recent_workspaces (path, name, last_opened_at)
			VALUES ('/ws', 'ws', '2026-09-06T10:00:00Z')`},
	}
	for _, statement := range statements {
		if _, err := db.ExecContext(t.Context(), statement.sql, id); err != nil {
			t.Fatalf("insert %s: %v", statement.subject, err)
		}
	}
}

// readOne is the single text value a query of the migrated database answers.
func readOne(t *testing.T, db *sql.DB, query string) string {
	t.Helper()

	var got string
	if err := db.QueryRowContext(t.Context(), query).Scan(&got); err != nil {
		t.Fatalf("query %q: %v", query, err)
	}
	return got
}

func TestTheRepositoriesMigrationTiesEveryTaskToItsRepository(t *testing.T) {
	t.Parallel()

	db := openAt(t, repositoriesVersion-1)
	seedLegacyTask(t, db, "task-1", "one", "/ws/api", "")
	seedLegacyTask(t, db, "task-2", "root", "", "2026-09-07T10:00:00Z")
	seedLegacyRecords(t, db, "task-1")

	const carried = "/data/tasks/acme/api/one"
	var seen []LegacyTask
	finished := 0
	upgrade := func(_ context.Context, legacy []LegacyTask) (UpgradePlan, error) {
		seen = legacy
		return UpgradePlan{
			Repositories: []repository.Repository{upgradeRepo},
			Tasks:        []UpgradedTask{{ID: "task-1", RepositoryID: upgradeRepo.ID, ArtifactsDir: carried}},
			Discarded:    []string{"task-2"},
			Undo:         func() { t.Error("Undo() called, want the plan to apply") },
			Done:         func() { finished++ },
		}, nil
	}

	if err := migrate(t.Context(), db, slog.New(slog.DiscardHandler), upgrade); err != nil {
		t.Fatalf("migrate() = %v, want nil", err)
	}

	wantLegacy := []LegacyTask{
		{
			ID: "task-1", Name: "one", WorkspacePath: "/ws", RepoPath: "/ws/api",
			ArtifactsDir: "/data/workspaces/ws/one", CreatedAt: upgradeTime,
		},
		{
			ID: "task-2", Name: "root", WorkspacePath: "/ws",
			ArtifactsDir: "/data/workspaces/ws/root", CreatedAt: upgradeTime,
			ArchivedAt: time.Date(2026, time.September, 7, 10, 0, 0, 0, time.UTC),
		},
	}
	if diff := cmp.Diff(wantLegacy, seen); diff != "" {
		t.Errorf("legacy tasks mismatch (-want +got):\n%s", diff)
	}

	if diff := cmp.Diff([]repository.Repository{upgradeRepo}, readRepositories(t, db)); diff != "" {
		t.Errorf("repositories mismatch (-want +got):\n%s", diff)
	}
	wantTasks := map[string][2]string{"task-1": {upgradeRepo.ID, carried}}
	if diff := cmp.Diff(wantTasks, readTaskRepositories(t, db)); diff != "" {
		t.Errorf("tasks mismatch (-want +got):\n%s", diff)
	}
	if finished != 1 {
		t.Errorf("Done() called %d times, want 1", finished)
	}

	// What 0013 does to the rows of the task that was carried over.
	if got := readOne(t, db, `SELECT stage FROM sessions WHERE id = 'sess-pr'`); got != "pr" {
		t.Errorf("the pr session is at stage %q, want %q", got, "pr")
	}
	if got := readOne(t, db, `SELECT stage FROM sessions WHERE id = 'sess-review'`); got != "pr_review" {
		t.Errorf("the pr review session is at stage %q, want %q", got, "pr_review")
	}
	if got := readOne(t, db, `SELECT place FROM situations WHERE id = 'sit-1'`); got != "pr" {
		t.Errorf("the situation is at place %q, want %q", got, "pr")
	}
	if got := readOne(t, db, `SELECT block_reason FROM steps WHERE task_id = 'task-1'`); got != "git_failed" {
		t.Errorf("the step is blocked for %q, want %q", got, "git_failed")
	}
	// The skipped status has no place left: it reads back as a closed one.
	if got := readOne(t, db, `SELECT status FROM pr_runs WHERE task_id = 'task-1'`); got != "closed" {
		t.Errorf("the pr run is %q, want %q", got, "closed")
	}
	if got := readOne(t, db, `SELECT path FROM worktrees WHERE item_id = 'task-1'`); got == "" {
		t.Error("the worktree of the task is gone, want it carried over")
	}
	const tableQuery = `SELECT count(*) FROM sqlite_master WHERE name IN ('recent_workspaces')`
	var tables int
	if err := db.QueryRowContext(t.Context(), tableQuery).Scan(&tables); err != nil {
		t.Fatalf("query sqlite_master: %v", err)
	}
	if tables != 0 {
		t.Error("recent_workspaces still exists, want the table dropped")
	}
	// A task belongs to one repository, so the columns of the workspace are gone.
	if _, err := db.ExecContext(t.Context(), `SELECT workspace_path FROM tasks`); err == nil {
		t.Error("tasks still has workspace_path, want the column dropped")
	}
}

func TestARefusedUpgradeLeavesTheDatabaseAtTheVersionBefore(t *testing.T) {
	t.Parallel()

	db := openAt(t, repositoriesVersion-1)
	seedLegacyTask(t, db, "task-1", "one", "/ws/api", "")

	refused := errors.New("upgrade: refused, 1 case to resolve")
	upgrade := func(context.Context, []LegacyTask) (UpgradePlan, error) {
		return UpgradePlan{}, refused
	}

	err := migrate(t.Context(), db, slog.New(slog.DiscardHandler), upgrade)
	if !errors.Is(err, refused) {
		t.Fatalf("migrate() = %v, want %v", err, refused)
	}

	version, err := schemaVersion(t.Context(), db)
	if err != nil {
		t.Fatalf("schemaVersion() = %v, want nil", err)
	}
	if version != repositoriesVersion-1 {
		t.Errorf("schemaVersion() = %d, want %d", version, repositoriesVersion-1)
	}

	// The table the migration creates is not there, so nothing it did survived.
	const tableQuery = `SELECT count(*) FROM sqlite_master WHERE name = 'repositories'`
	var tables int
	if err := db.QueryRowContext(t.Context(), tableQuery).Scan(&tables); err != nil {
		t.Fatalf("query sqlite_master: %v", err)
	}
	if tables != 0 {
		t.Errorf("the repositories table exists, want a refused migration to write nothing")
	}
}

func TestAPlanThatFailsToApplyIsUndone(t *testing.T) {
	t.Parallel()

	db := openAt(t, repositoriesVersion-1)
	seedLegacyTask(t, db, "task-1", "one", "/ws/api", "")

	twin := upgradeRepo
	twin.ID = "repo-2"
	undone := 0
	upgrade := func(context.Context, []LegacyTask) (UpgradePlan, error) {
		return UpgradePlan{
			Repositories: []repository.Repository{upgradeRepo, twin},
			Undo:         func() { undone++ },
			Done:         func() { t.Error("Done() called, want the migration to fail") },
		}, nil
	}

	if err := migrate(t.Context(), db, slog.New(slog.DiscardHandler), upgrade); err == nil {
		t.Fatal("migrate() = nil, want the second repository to be refused")
	}
	if undone != 1 {
		t.Errorf("Undo() called %d times, want 1", undone)
	}

	version, err := schemaVersion(t.Context(), db)
	if err != nil {
		t.Fatalf("schemaVersion() = %v, want nil", err)
	}
	if version != repositoriesVersion-1 {
		t.Errorf("schemaVersion() = %d, want %d", version, repositoriesVersion-1)
	}
}

func TestTasksOfAWorkspaceWithoutAnUpgradeFailTheMigration(t *testing.T) {
	t.Parallel()

	db := openAt(t, repositoriesVersion-1)
	seedLegacyTask(t, db, "task-1", "one", "/ws/api", "")

	if err := migrate(t.Context(), db, slog.New(slog.DiscardHandler), nil); !errors.Is(err, errUpgradeMissing) {
		t.Fatalf("migrate() = %v, want errUpgradeMissing", err)
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
		if err := apply(t.Context(), db, m, nil); err != nil {
			t.Fatalf("apply(%s) = %v, want nil", m.file, err)
		}
	}
	return db
}
