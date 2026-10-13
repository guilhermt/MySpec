package bindings

import (
	"strings"
	"testing"
)

func TestHomeTildeIgnoresTheCaseOfTheHomeOnWindows(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)

	if got := homeTilde(strings.ToUpper(home)); got != "~" {
		t.Errorf("homeTilde(%q) = %q, want ~", strings.ToUpper(home), got)
	}
}
