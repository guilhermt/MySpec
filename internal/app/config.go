package app

import "io/fs"

// Config is what main passes to Run: the embedded assets and the process
// environment.
type Config struct {
	Assets           fs.FS    // the built frontend
	Icon             []byte   // the application icon
	NotificationIcon []byte   // the image the notifications show
	Args             []string // os.Args[1:]
	Version          string
}
