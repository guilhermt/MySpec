// Package main is the MySpec entry point.
package main

import (
	"embed"
	"log"

	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed build/appicon.png
var icon []byte

func main() {
	app := application.New(application.Options{
		Name:        "MySpec",
		Description: "Orchestrates a Claude Code development workflow",
		Icon:        icon,
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Linux: application.LinuxOptions{ProgramName: "myspec"},
	})

	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title: "MySpec",
		URL:   "/",
	})

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
