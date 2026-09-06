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
	"github.com/guilhermt/myspec/internal/platform/logging"
	"github.com/guilhermt/myspec/internal/platform/xdg"
	"github.com/guilhermt/myspec/internal/scan"
	"github.com/guilhermt/myspec/internal/store"
	"github.com/guilhermt/myspec/internal/theme"
	"github.com/guilhermt/myspec/internal/workspace"
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

// App holds the running application: the Wails handles and the domain services
// they are wired to.
type App struct {
	log   *slog.Logger
	ws    *workspace.Service
	theme *theme.Service

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

	bindings.RegisterEvents()

	a := &App{log: log}

	themeSvc, err := theme.New(ctx, st.Settings, false, log, a.publish)
	if err != nil {
		return fail(log, "read settings", err)
	}
	wsSvc := workspace.New(workspace.Deps{
		Recents:  st.Recents,
		Scan:     func(root string) ([]string, error) { return scan.Repos(root, log) },
		Log:      log,
		OnChange: a.publish,
	})
	a.theme, a.ws = themeSvc, wsSvc

	if err := wsSvc.Bootstrap(ctx, firstArg(cfg.Args, log), cfg.Cwd); err != nil {
		return fail(log, "open initial workspace", err)
	}
	a.watchSystemTheme()

	wails := application.New(a.options(cfg, wsSvc, themeSvc, log))
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
func (a *App) options(cfg Config, ws *workspace.Service, themeSvc *theme.Service, log *slog.Logger) application.Options {
	return application.Options{
		Name:        "MySpec",
		Description: "Orchestrates a Claude Code development workflow",
		Icon:        cfg.Icon,
		Services: []application.Service{
			application.NewService(bindings.NewWorkspaceService(ws, a.snapshot, a, log)),
			application.NewService(bindings.NewSettingsService(themeSvc, log)),
		},
		Assets: application.AssetOptions{Handler: application.AssetFileServerFS(cfg.Assets)},
		Linux:  application.LinuxOptions{ProgramName: "myspec"},
		SingleInstance: &application.SingleInstanceOptions{
			UniqueID:               "myspec",
			OnSecondInstanceLaunch: a.onSecondInstance,
		},
		Logger:   log,
		LogLevel: wailsLogLevel(),
	}
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
