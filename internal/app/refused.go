package app

import (
	"log/slog"

	"github.com/wailsapp/wails/v3/pkg/application"

	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/theme"
	"github.com/guilhermt/myspec/internal/upgrade"
)

// runRefused opens the window on the migration that was refused, with nothing
// of the product behind it: the database stays as the version before left it,
// and the only thing the frontend can ask for is the state that lists what to
// resolve.
func runRefused(cfg Config, log *slog.Logger, refused *upgrade.RefusedError) int {
	log.Warn("migration refused", "cases", len(refused.Cases))

	bindings.RegisterEvents()

	a := &App{log: log}
	state := bindings.RefusedState(refused)

	wails := application.New(application.Options{
		Name:        appName,
		Description: appDescription,
		Icon:        cfg.Icon,
		Services: []application.Service{
			application.NewService(bindings.NewStateService(func() bindings.State { return state })),
		},
		Assets: application.AssetOptions{Handler: application.AssetFileServerFS(cfg.Assets)},
		Linux:  application.LinuxOptions{ProgramName: programName},
		SingleInstance: &application.SingleInstanceOptions{
			UniqueID:               programName,
			OnSecondInstanceLaunch: a.onSecondInstance,
		},
		Logger:   log,
		LogLevel: wailsLogLevel(),
	})
	a.setWails(wails)
	// Nothing of the app is loaded, so there is no theme to read: the screen
	// opens light and the system theme is left alone.
	a.openWindow(cfg, theme.ModeLight)

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
