package task_test

import (
	"errors"
	"testing"

	"github.com/guilhermt/myspec/internal/task"
)

func TestANameWindowsKeepsForADeviceIsRefused(t *testing.T) {
	t.Parallel()

	for _, name := range []string{"con", "nul", "com1"} {
		if err := task.ValidateName(name); !errors.Is(err, task.ErrInvalidName) {
			t.Errorf("ValidateName(%q) = %v, want ErrInvalidName", name, err)
		}
	}
}
