package store

import (
	"errors"
	"io/fs"

	"modernc.org/sqlite"
	sqlite3 "modernc.org/sqlite/lib"
)

// DiskFull reports whether err comes from a disk with no space left: what the
// system says about it, or SQLITE_FULL from the database.
func DiskFull(err error) bool {
	for _, full := range diskFullErrors {
		if errors.Is(err, full) {
			return true
		}
	}
	var sqliteErr *sqlite.Error
	return errors.As(err, &sqliteErr) && sqliteErr.Code()&0xff == sqlite3.SQLITE_FULL
}

// PermissionDenied reports whether err is the system refusing access: EACCES or
// EPERM on Linux, ERROR_ACCESS_DENIED on Windows. The database reports a folder
// it can't open without the errno, so only the probe of the data directory
// (Probe) finds this case.
func PermissionDenied(err error) bool {
	return errors.Is(err, fs.ErrPermission)
}
