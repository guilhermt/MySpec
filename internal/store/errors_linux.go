package store

import "syscall"

// diskFullErrors are what the system says about a disk with no space left.
var diskFullErrors = []error{syscall.ENOSPC}
