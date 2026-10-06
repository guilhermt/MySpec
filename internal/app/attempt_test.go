package app_test

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	_ "modernc.org/sqlite" // database/sql driver

	"github.com/guilhermt/myspec/internal/app"
	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/repository"
	"github.com/guilhermt/myspec/internal/store"
	"github.com/guilhermt/myspec/internal/upgrade"
)

// databaseName is the file the app keeps its database in, inside the data
// directory.
const databaseName = "myspec.db"

// newApp builds an app over a data directory of its own and closes it when the
// test ends.
func newApp(t *testing.T, opts app.AppOptions) (*app.App, <-chan bindings.Startup) {
	t.Helper()
	if opts.DataDir == "" {
		opts.DataDir = t.TempDir()
	}
	a, published := app.NewAppForTest(opts)
	t.Cleanup(a.Close)
	return a, published
}

// seed writes to the database of dataDir before the app opens it.
func seed(t *testing.T, dataDir string, write func(st *store.Store)) {
	t.Helper()
	st, err := store.Open(t.Context(), filepath.Join(dataDir, databaseName), slog.New(slog.DiscardHandler), nil)
	if err != nil {
		t.Fatalf("open the database to seed it: %v", err)
	}
	write(st)
	if err := st.Close(); err != nil {
		t.Fatalf("close the seeded database: %v", err)
	}
}

// stepsOf are the ids and states of the steps, without the times they began.
func stepsOf(s bindings.Startup) []string {
	steps := make([]string, len(s.Steps))
	for i, step := range s.Steps {
		steps[i] = fmt.Sprintf("%s %s %d", step.ID, step.State, step.Count)
	}
	return steps
}

// probeFailing is a probe that fails with errno, wrapped the way store.Probe
// wraps what the system says.
func probeFailing(errno syscall.Errno) func(dir string) error {
	return func(dir string) error {
		return fmt.Errorf("probe: %w", &fs.PathError{Op: "open", Path: dir, Err: errno})
	}
}

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
			return fmt.Errorf("apply migrations: %w", err)
		}
	}
	t.Fatal("the database never filled")
	return nil
}

func TestAnAttemptOverFreshDataEndsReadyWithTheServicesBound(t *testing.T) {
	t.Parallel()
	a, published := newApp(t, app.AppOptions{SystemDark: true})

	a.Start()
	got := waitFor(t, published, phaseIs("ready"))

	if diff := cmp.Diff([]string{"data done 0"}, stepsOf(got)); diff != "" {
		t.Errorf("steps mismatch (-want +got):\n%s", diff)
	}
	if !a.IsReady() {
		t.Error("IsReady() = false after a ready startup, want true")
	}
	state := a.State()
	if state.Migration != nil || state.Repositories == nil {
		t.Errorf("State() = %+v, want the state of the app bound", state)
	}
	if !state.SystemDark {
		t.Error("State().SystemDark = false, want what the desktop asked for")
	}
	// The flows resumed: the first reading of the pull requests began.
	if center := state.ReviewCenter; !center.Reading && center.ReadAt == "" {
		t.Error("the pull requests were never read, want the reading the resume starts")
	}
}

func TestTheProbeOfTheDataDirectoryTellsTheFailureByItsCause(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name  string
		errno syscall.Errno
		want  string
	}{
		{name: "access denied", errno: syscall.EACCES, want: "permission"},
		{name: "operation not permitted", errno: syscall.EPERM, want: "permission"},
		{name: "no space left", errno: syscall.ENOSPC, want: "disk_full"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			dataDir := t.TempDir()
			a, published := newApp(t, app.AppOptions{DataDir: dataDir, Probe: probeFailing(test.errno)})

			a.Start()
			got := waitFor(t, published, phaseIs("failed"))

			if got.Failure.Case != test.want || got.Failure.DataDir != dataDir {
				t.Errorf("Failure = %+v, want the case %s in %s", got.Failure, test.want, dataDir)
			}
			if diff := cmp.Diff([]string{"data running 0"}, stepsOf(got)); diff != "" {
				t.Errorf("steps mismatch (-want +got):\n%s", diff)
			}
			if _, err := os.Stat(filepath.Join(dataDir, databaseName)); !errors.Is(err, fs.ErrNotExist) {
				t.Errorf("Stat(database) = %v, want no database opened after the probe failed", err)
			}
		})
	}
}

func TestADatabaseWithNoSpaceLeftIsADiskFull(t *testing.T) {
	t.Parallel()
	full := databaseFull(t)
	a, published := newApp(t, app.AppOptions{
		OpenStore: func(context.Context, string, *slog.Logger, store.Upgrade) (*store.Store, error) {
			return nil, full
		},
	})

	a.Start()
	got := waitFor(t, published, phaseIs("failed"))

	if got.Failure.Case != "disk_full" {
		t.Errorf("Failure = %+v, want disk_full", got.Failure)
	}
}

func TestARefusedMigrationEndsTheFirstStepWithWhatToResolve(t *testing.T) {
	t.Parallel()
	refused := &upgrade.RefusedError{Cases: []upgrade.Case{{
		Kind: upgrade.CaseRootTask, Entries: []upgrade.Entry{{Task: "login", Workspace: "work"}},
	}}}
	a, published := newApp(t, app.AppOptions{
		SystemDark: true,
		OpenStore: func(context.Context, string, *slog.Logger, store.Upgrade) (*store.Store, error) {
			return nil, fmt.Errorf("upgrade data: %w", refused)
		},
	})

	a.Start()
	got := waitFor(t, published, phaseIs("ready"))

	if diff := cmp.Diff([]string{"data done 0"}, stepsOf(got)); diff != "" {
		t.Errorf("steps mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff(bindings.RefusedState(refused, true), a.State()); diff != "" {
		t.Errorf("State() mismatch (-want +got):\n%s", diff)
	}
	// Nothing was opened, so there is nothing to shut down.
	if a.IsReady() {
		t.Error("IsReady() = true after a refused migration, want false")
	}
}

func TestDataFromANewerVersionEndsTheFirstStepWithTheVersionsAndNothingOpened(t *testing.T) {
	t.Parallel()
	newer := &store.NewerError{Data: 40, Known: 25}
	a, published := newApp(t, app.AppOptions{
		SystemDark: true,
		OpenStore: func(context.Context, string, *slog.Logger, store.Upgrade) (*store.Store, error) {
			return nil, fmt.Errorf("open database: %w", newer)
		},
	})

	a.Start()
	got := waitFor(t, published, phaseIs("ready"))

	if diff := cmp.Diff([]string{"data done 0"}, stepsOf(got)); diff != "" {
		t.Errorf("steps mismatch (-want +got):\n%s", diff)
	}
	state := a.State()
	if diff := cmp.Diff(&bindings.NewerData{DataVersion: 40, AppVersion: 25}, state.Migration.Newer); diff != "" {
		t.Errorf("Migration.Newer mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff(bindings.NewerState(newer, true), state); diff != "" {
		t.Errorf("State() mismatch (-want +got):\n%s", diff)
	}
	if a.IsReady() {
		t.Error("IsReady() = true for data from a newer version, want false")
	}
}

func TestTheStepOfTheClonesRunsOnlyWithARepositoryThatHasAPath(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name  string
		repos []repository.Repository
		want  []string
	}{
		{name: "no repository", want: []string{"data done 0"}},
		{
			name:  "a repository without a clone",
			repos: []repository.Repository{{ID: "repo-1", Owner: "acme", Name: "web"}},
			want:  []string{"data done 0"},
		},
		{
			name: "two repositories, one with a clone",
			repos: []repository.Repository{
				{ID: "repo-1", Owner: "acme", Name: "web", Path: "/nowhere/web"},
				{ID: "repo-2", Owner: "acme", Name: "api"},
			},
			want: []string{"data done 0", "clones done 1"},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			dataDir := t.TempDir()
			seed(t, dataDir, func(st *store.Store) {
				for _, repo := range test.repos {
					repo.CreatedAt = time.Date(2026, 10, 3, 12, 0, 0, 0, time.UTC)
					if err := st.Repositories.Insert(t.Context(), repo); err != nil {
						t.Fatalf("insert %s: %v", repo.FullName(), err)
					}
				}
			})
			a, published := newApp(t, app.AppOptions{DataDir: dataDir})

			a.Start()
			got := waitFor(t, published, phaseIs("ready"))

			if diff := cmp.Diff(test.want, stepsOf(got)); diff != "" {
				t.Errorf("steps mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestTheStateCarriesTheFactoryDefaultsApartFromTheChosenOnes(t *testing.T) {
	t.Parallel()
	dataDir := t.TempDir()
	seed(t, dataDir, func(st *store.Store) {
		svc, err := models.New(t.Context(), st.Settings, slog.New(slog.DiscardHandler), func() {})
		if err != nil {
			t.Fatalf("models.New() = %v, want nil", err)
		}
		if err := svc.SetDefault(t.Context(), models.PRD, models.Choice{Model: models.Sonnet5, Effort: models.Medium}); err != nil {
			t.Fatalf("SetDefault() = %v, want nil", err)
		}
	})
	a, published := newApp(t, app.AppOptions{DataDir: dataDir})

	a.Start()
	waitFor(t, published, phaseIs("ready"))
	state := a.State()

	if diff := cmp.Diff(bindings.FromModelSet(models.Factory()), state.ModelFactory); diff != "" {
		t.Errorf("ModelFactory mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff(state.ModelFactory, state.ModelDefaults); diff == "" {
		t.Error("ModelDefaults = the factory, want the choice the user made")
	}
}

func TestTryAgainOpensTheAppOnceThePermissionIsBack(t *testing.T) {
	t.Parallel()
	if os.Geteuid() == 0 {
		t.Skip("root reads and writes every directory")
	}
	dataDir := filepath.Join(t.TempDir(), "myspec")
	if err := os.Mkdir(dataDir, 0); err != nil {
		t.Fatalf("Mkdir() = %v, want nil", err)
	}
	t.Cleanup(func() { _ = os.Chmod(dataDir, 0o700) })
	a, published := newApp(t, app.AppOptions{DataDir: dataDir})

	a.Start()
	failed := waitFor(t, published, phaseIs("failed"))
	if failed.Failure.Case != "permission" || failed.Failure.DataDir != dataDir {
		t.Fatalf("Failure = %+v, want permission in %s", failed.Failure, dataDir)
	}
	if err := os.Chmod(dataDir, 0o700); err != nil {
		t.Fatalf("Chmod() = %v, want nil", err)
	}
	a.TryAgain()
	got := waitFor(t, published, phaseIs("ready"))

	if got.Failure != nil {
		t.Errorf("Failure = %+v after the second attempt, want nil", got.Failure)
	}
	if !a.IsReady() {
		t.Error("IsReady() = false after Try again, want true")
	}
}

func TestShutdownDuringTheStartupStopsTheAttemptAndWaitsForIt(t *testing.T) {
	t.Parallel()
	opening := make(chan struct{})
	returned := make(chan struct{})
	a, _ := newApp(t, app.AppOptions{
		OpenStore: func(ctx context.Context, _ string, _ *slog.Logger, _ store.Upgrade) (*store.Store, error) {
			close(opening)
			<-ctx.Done()
			close(returned)
			return nil, ctx.Err()
		},
	})

	a.Start()
	<-opening
	a.Shutdown()

	select {
	case <-returned:
	default:
		t.Fatal("Shutdown returned before the attempt did")
	}
	if phase := a.Startup().Phase; phase == "failed" {
		t.Error("Phase = failed after the window closed, want the stopped attempt not shown")
	}
	if a.IsReady() {
		t.Error("IsReady() = true after the window closed during the startup, want false")
	}
}

func TestPublishingBeforeTheAppIsReadySendsNothing(t *testing.T) {
	t.Parallel()
	a, _ := newApp(t, app.AppOptions{})

	// Before the startup ends there is no service to read a state from: a
	// publish that read one would panic.
	a.PublishNow()
}

// openFiles counts the descriptors of the process that are watchers of the
// file system and files of the database at path.
func openFiles(t *testing.T, path string) (watchers, database int) {
	t.Helper()
	entries, err := os.ReadDir("/proc/self/fd")
	if err != nil {
		t.Skipf("no /proc/self/fd to count the open files: %v", err)
	}
	for _, entry := range entries {
		target, err := os.Readlink(filepath.Join("/proc/self/fd", entry.Name()))
		if err != nil {
			continue
		}
		switch {
		case target == "anon_inode:inotify":
			watchers++
		case strings.HasPrefix(target, path):
			database++
		}
	}
	return watchers, database
}

// TestAFailureClosesWhatTheAttemptOpened counts the descriptors of the whole
// process, so it runs alone and never in parallel with another test.
func TestAFailureClosesWhatTheAttemptOpened(t *testing.T) {
	dataDir := t.TempDir()
	databasePath := filepath.Join(dataDir, databaseName)
	seed(t, dataDir, func(st *store.Store) {
		repo := repository.Repository{
			ID: "repo-1", Owner: "acme", Name: "web", Path: "/nowhere/web",
			CreatedAt: time.Date(2026, 10, 3, 12, 0, 0, 0, time.UTC),
		}
		if err := st.Repositories.Insert(t.Context(), repo); err != nil {
			t.Fatalf("insert: %v", err)
		}
	})
	watchersBefore, databaseBefore := openFiles(t, databasePath)

	var mu sync.Mutex
	var opened *store.Store
	var a *app.App
	a, published := newApp(t, app.AppOptions{
		DataDir: dataDir,
		OpenStore: func(ctx context.Context, path string, log *slog.Logger, up store.Upgrade) (*store.Store, error) {
			st, err := store.Open(ctx, path, log, up)
			mu.Lock()
			opened = st
			mu.Unlock()
			return st, err
		},
		// The window closes as the clones begin, after the database and the
		// watchers opened.
		OnStartup: func(s bindings.Startup) {
			if len(s.Steps) == 2 && s.Steps[1].State == "running" {
				a.CancelAttempt()
			}
		},
	})

	a.Start()
	got := waitFor(t, published, phaseIs("failed"))

	if !strings.Contains(got.Failure.Error, context.Canceled.Error()) {
		t.Errorf("Failure = %+v, want the cancelled test of the clones", got.Failure)
	}
	mu.Lock()
	st := opened
	mu.Unlock()
	if st == nil {
		t.Fatal("the attempt never opened the database")
	}
	if _, err := st.Repositories.List(t.Context()); err == nil {
		t.Error("the database answers after the failure, want it closed")
	}
	watchers, database := openFiles(t, databasePath)
	if watchers != watchersBefore {
		t.Errorf("watchers open = %d after the failure, want the %d of before", watchers, watchersBefore)
	}
	if database != databaseBefore {
		t.Errorf("files of the database open = %d after the failure, want the %d of before", database, databaseBefore)
	}
}
