package store

import (
	"syscall"

	"golang.org/x/sys/windows"
)

// diskFullErrors are what the system says about a disk with no space left.
// ENOSPC is the errno Go itself reports for a full disk in a few places, and
// what the tests wrap.
var diskFullErrors = []error{windows.ERROR_DISK_FULL, windows.ERROR_HANDLE_DISK_FULL, syscall.ENOSPC}
