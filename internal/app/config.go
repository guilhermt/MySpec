package app

import "io/fs"

// Config is what main passes to Run: the embedded assets and the process
// environment.
type Config struct {
	Assets  fs.FS    // the built frontend
	Icon    []byte   // the application icon
	Args    []string // os.Args[1:]
	Cwd     string
	Version string
}
