package bindings

import "github.com/guilhermt/myspec/internal/workspace"

// FromWorkspace converts the open workspace, keeping nil for none.
func FromWorkspace(ws *workspace.Workspace) *Workspace {
	if ws == nil {
		return nil
	}

	repos := make([]Repo, len(ws.Repos))
	for i, repo := range ws.Repos {
		repos[i] = Repo{Name: repo.Name, Path: repo.Path}
	}
	return &Workspace{Name: ws.Name, Path: ws.Path, Repos: repos}
}

// FromRecents converts the recent workspaces, always returning a slice so the
// frontend never sees null.
func FromRecents(recents []workspace.Recent) []Recent {
	converted := make([]Recent, len(recents))
	for i, rec := range recents {
		converted[i] = Recent{Name: rec.Name, Path: rec.Path}
	}
	return converted
}

// FromNotice converts the current notice, keeping nil for none.
func FromNotice(notice *workspace.Notice) *Notice {
	if notice == nil {
		return nil
	}
	return &Notice{Path: notice.Path, Reason: string(notice.Reason)}
}
