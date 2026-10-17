// Package relaunch starts a new MySpec in place of the running one: the new
// process is told the pid of the old one and waits for it to exit before it
// claims the single instance, which the old one holds until its very end.
package relaunch

import (
	"strconv"
	"strings"
	"time"
)

// Flag is the argument that tells a starting MySpec which process it replaces:
// --after-exit=<pid>. Every release keeps it, since the release before it is
// the one that passes it.
const Flag = "--after-exit"

// Previous reads the pid of Flag from the arguments of the process; ok is false
// without the flag or with a value that is not a positive number.
func Previous(args []string) (pid int, ok bool) {
	for _, arg := range args {
		value, found := strings.CutPrefix(arg, Flag+"=")
		if !found {
			continue
		}
		n, err := strconv.Atoi(value)
		if err != nil || n <= 0 {
			return 0, false
		}
		return n, true
	}
	return 0, false
}

// Start starts the executable at path, detached from this process, with Flag
// and pid, and does not wait for it.
func Start(path string, pid int) error {
	return start(path, pid)
}

// Wait waits for the process pid to exit, up to timeout; exited is false when
// the timeout passed first. A process that is already gone has exited.
func Wait(pid int, timeout time.Duration) (exited bool) {
	return wait(pid, timeout)
}
