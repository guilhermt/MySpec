package app

import (
	"context"
	"log/slog"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// onSecondInstance brings the window forward and opens the folder the second
// invocation asked for.
func (a *App) onSecondInstance(data application.SecondInstanceData) {
	a.log.Info("second instance", "args", data.Args, "cwd", data.WorkingDir)

	application.InvokeSync(func() {
		_, window := a.handles()
		if window == nil {
			return
		}
		if window.IsMinimised() {
			window.UnMinimise()
		}
		window.Show()
		window.Focus()
	})

	arg := firstArg(commandArgs(data.Args), a.log)
	if arg == "" {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	// A path that does not qualify has already become a notice, and the change
	// is published by the workspace service.
	if err := a.ws.OpenArg(ctx, arg, data.WorkingDir); err != nil {
		a.log.Error("second instance failed", "err", err)
	}
}

// commandArgs drops the executable Wails puts at the front of a second
// instance's arguments.
func commandArgs(args []string) []string {
	if len(args) == 0 {
		return nil
	}
	return args[1:]
}

// firstArg returns the first argument that is not a flag. Any other one is
// ignored, because the app opens a single workspace.
func firstArg(args []string, log *slog.Logger) string {
	first := ""
	for _, arg := range args {
		switch {
		case strings.HasPrefix(arg, "-"):
			continue
		case first == "":
			first = arg
		default:
			log.Warn("extra argument ignored", "arg", arg)
		}
	}
	return first
}
