package store

import (
	"errors"
	"syscall"

	"modernc.org/sqlite"
	sqlite3 "modernc.org/sqlite/lib"
)

// DiskFull reports whether err comes from a disk with no space left: ENOSPC from
// the system, or SQLITE_FULL from the database.
func DiskFull(err error) bool {
	if errors.Is(err, syscall.ENOSPC) {
		return true
	}
	var sqliteErr *sqlite.Error
	return errors.As(err, &sqliteErr) && sqliteErr.Code()&0xff == sqlite3.SQLITE_FULL
}

// PermissionDenied reports whether err is the system refusing access: EACCES or
// EPERM. The database reports a folder it can't open without the errno, so only
// the probe of the data directory (Probe) finds this case.
func PermissionDenied(err error) bool {
	return errors.Is(err, syscall.EACCES) || errors.Is(err, syscall.EPERM)
}
