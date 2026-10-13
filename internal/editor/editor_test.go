package editor_test

import (
	"errors"
	"testing"

	"github.com/guilhermt/myspec/internal/editor"
)

func TestOpenReportsAnEditorThatIsNotInstalled(t *testing.T) {
	t.Setenv("PATH", "")

	err := editor.Open("/home/dev/code/api")
	if !errors.Is(err, editor.ErrNotFound) {
		t.Errorf("Open() = %v, want ErrNotFound", err)
	}
}
