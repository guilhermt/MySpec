package app

import (
	"fmt"

	"github.com/guilhermt/myspec/internal/bindings"
)

// App implements the folder picker the workspace service calls.
var _ bindings.FolderPicker = (*App)(nil)

// PickFolder opens the native folder chooser, starting at startIn. ok is false
// when the user cancels.
func (a *App) PickFolder(startIn string) (string, bool, error) {
	wails, _ := a.handles()

	path, err := wails.Dialog.OpenFile().
		SetTitle("Open folder").
		SetDirectory(startIn).
		CanChooseDirectories(true).
		CanChooseFiles(false).
		PromptForSingleSelection()
	if err != nil {
		return "", false, fmt.Errorf("open folder dialog: %w", err)
	}
	if path == "" {
		return "", false, nil
	}
	return path, true, nil
}
