package reviewmode_test

import (
	"errors"
	"testing"

	"github.com/guilhermt/myspec/internal/reviewmode"
)

func TestParseMode(t *testing.T) {
	t.Parallel()

	for _, mode := range []reviewmode.Mode{reviewmode.Manual, reviewmode.Agent} {
		got, err := reviewmode.ParseMode(string(mode))
		if err != nil {
			t.Errorf("ParseMode(%q) = %v, want nil", mode, err)
		}
		if got != mode {
			t.Errorf("ParseMode(%q) = %q, want %q", mode, got, mode)
		}
	}

	for _, value := range []string{"", "auto", "Manual"} {
		if _, err := reviewmode.ParseMode(value); !errors.Is(err, reviewmode.ErrUnknownMode) {
			t.Errorf("ParseMode(%q) = %v, want ErrUnknownMode", value, err)
		}
	}
}
