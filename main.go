// Package main is the MySpec entry point.
package main

import (
	"embed"
	"os"

	"github.com/guilhermt/myspec/internal/app"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed build/appicon.png
var icon []byte

func main() {
	cwd, _ := os.Getwd()

	os.Exit(app.Run(app.Config{
		Assets:  assets,
		Icon:    icon,
		Args:    os.Args[1:],
		Cwd:     cwd,
		Version: "0.1.0",
	}))
}
