package store_test

import (
	"fmt"
	"testing"

	"golang.org/x/sys/windows"

	"github.com/guilhermt/myspec/internal/store"
)

func TestDiskFullAndPermissionDeniedKnowTheErrorsOfWindows(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name       string
		err        error
		diskFull   bool
		permission bool
	}{
		{"ERROR_DISK_FULL wrapped", fmt.Errorf("write: %w", windows.ERROR_DISK_FULL), true, false},
		{"ERROR_HANDLE_DISK_FULL wrapped", fmt.Errorf("write: %w", windows.ERROR_HANDLE_DISK_FULL), true, false},
		{"ERROR_ACCESS_DENIED wrapped", fmt.Errorf("open: %w", windows.ERROR_ACCESS_DENIED), false, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := store.DiskFull(tc.err); got != tc.diskFull {
				t.Errorf("DiskFull() = %v, want %v", got, tc.diskFull)
			}
			if got := store.PermissionDenied(tc.err); got != tc.permission {
				t.Errorf("PermissionDenied() = %v, want %v", got, tc.permission)
			}
		})
	}
}
