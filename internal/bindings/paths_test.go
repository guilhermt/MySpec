package bindings

import (
	"path/filepath"
	"testing"
)

func TestHomeTildeWritesTheHomeDirectoryAsATilde(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)

	tests := []struct{ path, want string }{
		{home, "~"},
		{filepath.Join(home, ".local", "share", "myspec"), "~" + string(filepath.Separator) + filepath.Join(".local", "share", "myspec")},
		{home + "-other" + string(filepath.Separator) + "x", home + "-other" + string(filepath.Separator) + "x"},
		{filepath.FromSlash("/var/lib/myspec"), filepath.FromSlash("/var/lib/myspec")},
	}
	for _, test := range tests {
		if got := homeTilde(test.path); got != test.want {
			t.Errorf("homeTilde(%q) = %q, want %q", test.path, got, test.want)
		}
	}
}
