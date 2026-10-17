package relaunch_test

import (
	"testing"

	"github.com/guilhermt/myspec/internal/platform/relaunch"
)

func TestPrevious(t *testing.T) {
	tests := []struct {
		name    string
		args    []string
		wantPid int
		wantOK  bool
	}{
		{"no flag", []string{"myspec"}, 0, false},
		{"pid", []string{"myspec", "--after-exit=42"}, 42, true},
		{"zero", []string{"myspec", "--after-exit=0"}, 0, false},
		{"not a number", []string{"myspec", "--after-exit=x"}, 0, false},
		{"separate value", []string{"myspec", "--after-exit", "42"}, 0, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pid, ok := relaunch.Previous(tt.args)
			if pid != tt.wantPid || ok != tt.wantOK {
				t.Errorf("Previous(%v) = %d, %v; want %d, %v", tt.args, pid, ok, tt.wantPid, tt.wantOK)
			}
		})
	}
}
