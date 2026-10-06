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

// version is the release this binary is: dev for a local build, and the
// version of VERSION for the release build, which sets it with
// -ldflags "-X main.version=X.Y.Z" (task package).
var version = "dev"

func main() {
	os.Exit(app.Run(app.Config{
		Assets:  assets,
		Icon:    icon,
		Args:    os.Args[1:],
		Version: version,
	}))
}
