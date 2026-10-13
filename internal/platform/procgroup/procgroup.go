// Package procgroup runs a command together with every process it starts, so
// that stopping it stops them all: a process group on Linux, a job object on
// Windows. It also keeps the commands of the app from opening a console window
// on Windows.
package procgroup

import "os/exec"

// Run runs cmd, made with exec.CommandContext, in a group of its own and waits
// for it, as cmd.Run does. A cancelled context kills the whole group, and on
// Windows nothing the command started outlives Run.
func Run(cmd *exec.Cmd) error {
	g := New(cmd)
	cmd.Cancel = g.Kill
	if err := cmd.Start(); err != nil {
		return err
	}
	if err := g.Started(); err != nil {
		// A process outside the group would outlive a cancellation.
		_ = g.Kill()
		_ = cmd.Wait()
		_ = g.Close()
		return err
	}
	err := cmd.Wait()
	// Closing only releases the group: the command already said how it went.
	_ = g.Close()
	return err
}
