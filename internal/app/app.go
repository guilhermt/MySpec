// Package app composes the Wails application from the domain services. It is
// the only place, together with internal/bindings, that knows about Wails.
package app

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"

	"github.com/guilhermt/myspec/internal/attention"
	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/board"
	"github.com/guilhermt/myspec/internal/discussion"
	"github.com/guilhermt/myspec/internal/discussionflow"
	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/platform/chime"
	"github.com/guilhermt/myspec/internal/platform/logging"
	"github.com/guilhermt/myspec/internal/platform/notify"
	"github.com/guilhermt/myspec/internal/platform/xdg"
	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/pulls"
	"github.com/guilhermt/myspec/internal/repository"
	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/reviewflow"
	"github.com/guilhermt/myspec/internal/reviewmode"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
	"github.com/guilhermt/myspec/internal/theme"
	"github.com/guilhermt/myspec/internal/worktree"
)

// The process exit codes Run returns.
const (
	exitSuccess = 0
	exitFailure = 1
)

// callTimeout bounds the database work done while the app is running.
const callTimeout = 5 * time.Second

// shutdownTimeout is how long the sessions have to stop gracefully before
// their processes are killed.
const shutdownTimeout = 8 * time.Second

// What the app is called, to the user and to the system.
const (
	appName        = "MySpec" // the title of the window and the name the notifications carry
	appDescription = "Orchestrates a Claude Code development workflow"
	programName    = "myspec" // the Linux program and the lock of the single instance
)

// App holds the running application: the Wails handles and the domain services
// they are wired to.
type App struct {
	log            *slog.Logger
	dirs           xdg.Dirs
	services       *bindings.Services // the placeholders Wails holds, bound when the startup ends
	startup        *startup
	deps           attemptDeps // what an attempt reaches outside the data directory with
	systemDark     bool        // what the desktop asked for before the window opened
	repositories   *repository.Service
	theme          *theme.Service
	models         *models.Service
	reviewModes    *reviewmode.Service
	tasks          *task.Service
	boards         *board.Service
	sessions       *session.Service
	worktrees      *worktree.Service
	review         *review.Service
	flow           *flow.Service
	pulls          *pulls.Service
	prReviews      *prreview.Service
	reviewFlow     *reviewflow.Service
	discussions    *discussion.Service
	discussionFlow *discussionflow.Service
	attention      *attention.Service
	notifier       *notify.Notifier // nil when the desktop has no notification service
	player         *chime.Player    // nil when there is no notifier or the chime could not be installed

	pollCtx  context.Context // ends when the app does; what runs in the background for as long as it runs
	stopPoll context.CancelFunc

	mu      sync.Mutex
	wails   *application.App
	window  *application.WebviewWindow
	ready   bool     // the startup ended with the services bound
	closers []func() // what the attempt that stands leaves to close after Run

	publishMu sync.Mutex // keeps concurrent publishes from interleaving
	publisher *throttle  // limits how often the state is published
}

// Run starts the application and returns the process exit code. The window
// opens before the data: the startup runs after it, and the services Wails holds
// answer once it ends.
func Run(cfg Config) int {
	dirs := xdg.Resolve()
	if err := dirs.Ensure(); err != nil {
		return fail(nil, "prepare app directories", err)
	}

	log, closer, err := logging.New(logging.Options{
		Path:   dirs.LogPath(),
		Level:  logLevel(),
		Stderr: !production,
	})
	if err != nil {
		return fail(nil, "open log", err)
	}
	defer func() { _ = closer.Close() }()

	log.Info(
		"app starting",
		"version", cfg.Version,
		"args", cfg.Args,
		"data_dir", dirs.Data,
		"state_dir", dirs.State,
	)

	applyWebKitEnvironment()

	a := &App{log: log, dirs: dirs, services: bindings.NewWaitingServices()}
	a.publisher = newThrottle(publishWindow, a.publishNow)
	a.systemDark = readSystemDark(log)
	a.deps = a.desktopDeps()
	a.startup = newStartup(a.attempt, a.emitStartup, log, a.systemDark, dirs.Data, dirs.LogPath())
	a.pollCtx, a.stopPoll = context.WithCancel(context.Background())
	defer a.stopPoll()

	bindings.RegisterEvents()
	wails := application.New(a.options(cfg))
	a.setWails(wails)
	a.openWindow(cfg, modeFor(a.systemDark))
	a.startup.start()

	runErr := wails.Run()
	if runErr != nil {
		log.Error("run failed", "err", runErr)
	}
	// Normally shutdown has stopped the startup already; this covers a Run that
	// ended before it could.
	a.startup.close()
	a.mu.Lock()
	closers := a.closers
	a.mu.Unlock()
	for i := len(closers) - 1; i >= 0; i-- {
		closers[i]()
	}
	log.Info("app stopped")
	if runErr != nil {
		return exitFailure
	}
	return exitSuccess
}

// options are the Wails application options, including the services the
// frontend binds to: the placeholders of the app, which wait for the startup to
// end, and the one service that never waits, the startup itself.
func (a *App) options(cfg Config) application.Options {
	return application.Options{
		Name:        appName,
		Description: appDescription,
		Icon:        cfg.Icon,
		Services: append(
			a.services.Wails(),
			application.NewService(bindings.NewStartupService(a.startup.snapshot, a.startup.tryAgain)),
		),
		Assets: application.AssetOptions{Handler: application.AssetFileServerFS(cfg.Assets)},
		Linux:  application.LinuxOptions{ProgramName: programName},
		SingleInstance: &application.SingleInstanceOptions{
			UniqueID:               programName,
			OnSecondInstanceLaunch: a.onSecondInstance,
		},
		OnShutdown: a.shutdown,
		Logger:     a.log,
		LogLevel:   wailsLogLevel(),
	}
}

// activeItemIDs are the ids of the items that run: the active tasks, the
// active reviews of pull requests and the active discussions.
func (a *App) activeItemIDs() []string {
	tasks := a.tasks.List()
	reviews := a.prReviews.List()
	discussions := a.discussions.List()
	ids := make([]string, 0, len(tasks)+len(reviews)+len(discussions))
	for _, t := range tasks {
		ids = append(ids, t.ID)
	}
	for _, r := range reviews {
		ids = append(ids, r.ID)
	}
	for _, d := range discussions {
		ids = append(ids, d.ID)
	}
	return ids
}

// itemCounts are how many items of a repository are active and archived: its
// tasks and the reviews of its pull requests together.
func (a *App) itemCounts(repositoryID string) (active, archived int) {
	activeTasks, archivedTasks := a.tasks.Counts(repositoryID)
	activeReviews, archivedReviews := a.prReviews.Counts(repositoryID)
	return activeTasks + activeReviews, archivedTasks + archivedReviews
}

// taskPullRequests are the pull requests the active tasks of the product own,
// which are reviewed in the task and never on their own.
func (a *App) taskPullRequests() []reviewflow.TaskPR {
	var prs []reviewflow.TaskPR
	for _, t := range a.tasks.List() {
		if t.Stage != task.StagePR {
			continue
		}
		run, ok := a.tasks.PRRun(t.ID)
		if !ok || run.PR.Number == 0 {
			continue
		}
		prs = append(prs, reviewflow.TaskPR{TaskID: t.ID, RepositoryID: t.RepositoryID, Number: run.PR.Number})
	}
	return prs
}

// hasConversation says whether an id names an item of another kind with a
// conversation of its own: a review of a pull request or a discussion, active
// or archived. It is what tells those conversations from the one of a task.
func (a *App) hasConversation(id string) bool {
	if _, ok := a.prReviews.Get(id); ok {
		return true
	}
	_, ok := a.discussions.Lookup(id)
	return ok
}

// onRepositoryPathChanged reloads the worktrees, whose clone moved with the
// repository.
func (a *App) onRepositoryPathChanged(string) {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := a.worktrees.Sync(ctx, a.activeItemIDs()); err != nil {
		a.log.Error("sync worktrees failed", "err", err)
	}
}

// shutdown stops the startup, then the situations, every session, the notifications, the chime
// and the watchers while the window is still closing, so that no CLI process and
// no notification outlives the app.
func (a *App) shutdown() {
	a.stopPoll()
	a.startup.close()
	// An app that never got ready has nothing else open: the attempt that was
	// cancelled closed what it had.
	if !a.isReady() {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()

	a.attention.Close()
	a.flow.Close()
	a.reviewFlow.Close()
	a.discussionFlow.Close()
	a.pulls.Close()
	a.sessions.Shutdown(ctx)
	// After the sessions, whose exits publish: a trailing publish would run
	// after Run closed the store and the log.
	a.publisher.stop()
	// The notifications go with the app: one left behind would lead nowhere.
	if a.notifier != nil {
		a.notifier.Close()
	}
	// After the notifier, which is what rings it: a chime still playing is cut
	// off rather than waited for.
	if a.player != nil {
		a.player.Close()
	}
	if err := a.review.Close(); err != nil {
		a.log.Error("close review watcher failed", "err", err)
	}
	if err := a.tasks.Close(); err != nil {
		a.log.Error("close artifact watcher failed", "err", err)
	}
	a.log.Info("sessions stopped")
}

// setWails records the application handle for the callbacks that run after it
// exists.
func (a *App) setWails(wails *application.App) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.wails = wails
}

// handles returns the Wails handles, either of which is nil before it is built.
func (a *App) handles() (*application.App, *application.WebviewWindow) {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.wails, a.window
}

// fail reports a startup failure and returns the process exit code. It always
// writes to stderr because a production build does not log there, and the user
// running the binary from a terminal deserves to see why it gave up.
func fail(log *slog.Logger, step string, err error) int {
	if log != nil {
		log.Error("startup failed", "step", step, "err", err)
	}
	fmt.Fprintf(os.Stderr, "myspec: %s: %v\n", step, err)
	return exitFailure
}

// logLevel reads the app log level from MYSPEC_LOG_LEVEL.
func logLevel() slog.Level {
	switch strings.ToLower(os.Getenv("MYSPEC_LOG_LEVEL")) {
	case "debug":
		return slog.LevelDebug
	case "warn":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

// wailsLogLevel keeps the Wails system logger quiet in production.
func wailsLogLevel() slog.Level {
	if production {
		return slog.LevelWarn
	}
	return slog.LevelInfo
}
