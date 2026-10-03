package bindings

import (
	"path/filepath"
	"testing"
)

func TestHomeTildeWritesTheHomeDirectoryAsATilde(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)

	tests := []struct{ path, want string }{
		{home, "~"},
		{filepath.Join(home, ".local", "share", "myspec"), "~/.local/share/myspec"},
		{home + "-other/x", home + "-other/x"},
		{"/var/lib/myspec", "/var/lib/myspec"},
	}
	for _, test := range tests {
		if got := homeTilde(test.path); got != test.want {
			t.Errorf("homeTilde(%q) = %q, want %q", test.path, got, test.want)
		}
	}
}
