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

	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/editor"
	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/platform/logging"
	"github.com/guilhermt/myspec/internal/platform/xdg"
	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/scan"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/store"
	"github.com/guilhermt/myspec/internal/task"
	"github.com/guilhermt/myspec/internal/theme"
	"github.com/guilhermt/myspec/internal/workspace"
	"github.com/guilhermt/myspec/internal/worktree"
)

// The process exit codes Run returns.
const (
	exitSuccess = 0
	exitFailure = 1
)

// startupTimeout bounds the database work done before the window opens.
const startupTimeout = 10 * time.Second

// callTimeout bounds the database work done while the app is running.
const callTimeout = 5 * time.Second

// shutdownTimeout is how long the sessions have to stop gracefully before
// their processes are killed.
const shutdownTimeout = 8 * time.Second

// App holds the running application: the Wails handles and the domain services
// they are wired to.
type App struct {
	log       *slog.Logger
	ws        *workspace.Service
	theme     *theme.Service
	tasks     *task.Service
	sessions  *session.Service
	worktrees *worktree.Service
	flow      *flow.Service

	mu      sync.Mutex
	wails   *application.App
	window  *application.WebviewWindow
	recents []bindings.Recent // last list read successfully

	publishMu sync.Mutex // keeps concurrent publishes from interleaving
}

// Run starts the application and returns the process exit code.
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
		"cwd", cfg.Cwd,
		"data_dir", dirs.Data,
		"state_dir", dirs.State,
	)

	applyWebKitEnvironment()

	ctx, cancel := context.WithTimeout(context.Background(), startupTimeout)
	defer cancel()

	st, err := store.Open(ctx, dirs.DatabasePath(), log)
	if err != nil {
		return fail(log, "open database", err)
	}
	defer func() { _ = st.Close() }()

	if err = prompts.Seed(dirs.Data, log); err != nil {
		return fail(log, "seed prompts", err)
	}

	bindings.RegisterEvents()

	a := &App{log: log}

	themeSvc, err := theme.New(ctx, st.Settings, false, log, a.publish)
	if err != nil {
		return fail(log, "read settings", err)
	}
	sessions := session.New(session.Deps{
		Sessions: st.Sessions,
		Entries:  st.Entries,
		Launcher: claudeLauncher{log: log},
		RenderPrompt: func(stage prompts.Stage, vars prompts.Vars) (string, error) {
			return prompts.Render(dirs.Data, stage, vars)
		},
		Log: log,
		OnState: func(taskID string) {
			a.publish()
			a.flow.Check(taskID)
		},
		OnTranscript: a.emitTranscript,
	})
	tasks, err := task.New(task.Deps{
		Repo:       st.Tasks,
		DataDir:    dirs.Data,
		Log:        log,
		Repos:      a.repoPaths,
		OnChange:   a.publish,
		OnArtifact: a.onArtifact,
	})
	if err != nil {
		return fail(log, "watch artifacts", err)
	}
	gitRunner := git.New(git.Deps{Log: log})
	worktrees := worktree.New(worktree.Deps{Git: gitRunner, Store: st.Worktrees, Log: log})
	// The session and task callbacks reach the flow through the app, which
	// holds it before anything can run: no process starts before Bootstrap.
	flowSvc := flow.New(flow.Deps{
		Tasks:     tasks,
		Sessions:  sessions,
		Worktrees: worktrees,
		Log:       log,
		OnChange:  func(string) { a.publish() },
	})
	wsSvc := workspace.New(workspace.Deps{
		Recents:  st.Recents,
		Scan:     func(root string) ([]string, error) { return scan.Repos(root, log) },
		Log:      log,
		OnChange: a.onWorkspaceChanged,
	})
	a.theme, a.ws, a.tasks, a.sessions, a.flow = themeSvc, wsSvc, tasks, sessions, flowSvc
	a.worktrees = worktrees

	if err := wsSvc.Bootstrap(ctx, firstArg(cfg.Args, log), cfg.Cwd); err != nil {
		return fail(log, "open initial workspace", err)
	}
	a.watchSystemTheme()

	wails := application.New(a.options(cfg, wsSvc, themeSvc, tasks, sessions, flowSvc, log))
	a.setWails(wails)
	a.openWindow(cfg)

	runErr := wails.Run()
	if runErr != nil {
		log.Error("run failed", "err", runErr)
	}
	log.Info("app stopped")
	if runErr != nil {
		return exitFailure
	}
	return exitSuccess
}

// options are the Wails application options, including the services the
// frontend binds to.
func (a *App) options(
	cfg Config,
	ws *workspace.Service,
	themeSvc *theme.Service,
	tasks *task.Service,
	sessions *session.Service,
	flowSvc *flow.Service,
	log *slog.Logger,
) application.Options {
	return application.Options{
		Name:        "MySpec",
		Description: "Orchestrates a Claude Code development workflow",
		Icon:        cfg.Icon,
		Services: []application.Service{
			application.NewService(bindings.NewWorkspaceService(ws, a.snapshot, a, log)),
			application.NewService(bindings.NewSettingsService(themeSvc, log)),
			application.NewService(bindings.NewTaskService(tasks, sessions, flowSvc, editor.Open, log)),
		},
		Assets: application.AssetOptions{Handler: application.AssetFileServerFS(cfg.Assets)},
		Linux:  application.LinuxOptions{ProgramName: "myspec"},
		SingleInstance: &application.SingleInstanceOptions{
			UniqueID:               "myspec",
			OnSecondInstanceLaunch: a.onSecondInstance,
		},
		OnShutdown: a.shutdown,
		Logger:     log,
		LogLevel:   wailsLogLevel(),
	}
}

// onWorkspaceChanged brings the tasks in line with the workspace that just
// changed before the state reaches the frontend.
func (a *App) onWorkspaceChanged() {
	a.syncTasks()
	a.publish()
}

// syncTasks loads the tasks of the open workspace and hands them to the flow,
// which opens the session of the stage each one is in and moves on the stages
// that finished while the app was closed. A task that cannot be loaded is
// logged and left out; it never keeps the workspace from opening.
func (a *App) syncTasks() {
	current := a.ws.Current()
	if current == nil {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := a.tasks.Sync(ctx, current.Path); err != nil {
		a.log.Error("sync tasks failed", "workspace", current.Path, "err", err)
		return
	}
	// The flow reads the registry of worktrees as it resumes the steps, so it
	// is loaded first; a failure only leaves the steps to block on their own.
	tasks := a.tasks.List()
	ids := make([]string, len(tasks))
	for i, t := range tasks {
		ids[i] = t.ID
	}
	if err := a.worktrees.Sync(ctx, ids); err != nil {
		a.log.Error("sync worktrees failed", "workspace", current.Path, "err", err)
	}
	a.flow.Sync(ctx)
}

// shutdown stops every session and the artifact watcher while the window is
// still closing, so no CLI process outlives the app.
func (a *App) shutdown() {
	ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()

	a.flow.Close()
	a.sessions.Shutdown(ctx)
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
