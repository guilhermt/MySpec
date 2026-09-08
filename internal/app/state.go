package app

import (
	"context"

	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
)

// appName is the window title with no workspace open, and its suffix with one.
const appName = "MySpec"

// snapshot builds the state the frontend renders.
func (a *App) snapshot() bindings.State {
	return bindings.State{
		Workspace:  bindings.FromWorkspace(a.ws.Current()),
		Recents:    a.recentList(),
		Theme:      string(a.theme.Preference()),
		SystemDark: a.theme.SystemDark(),
		Notice:     bindings.FromNotice(a.ws.Notice()),
		Tasks: bindings.FromTasks(
			a.tasks.List(), a.taskArtifacts, a.flow.Steps, a.flow.Repos, a.sessions.Summaries(),
		),
	}
}

// taskArtifacts is what the last inspection of a task's folder found, which is
// nothing at all for a task the service does not hold.
func (a *App) taskArtifacts(id string) task.Artifacts {
	artifacts, _ := a.tasks.Artifacts(id)
	return artifacts
}

// onArtifact records what changed in the conversation and lets the flow decide.
func (a *App) onArtifact(t task.Task, changes []task.Change) {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	key := session.Key{TaskID: t.ID, Stage: string(t.Stage)}
	for _, c := range changes {
		a.sessions.MarkArtifact(ctx, key, session.ArtifactKind(c.Kind), c.First)
	}
	a.flow.Check(t.ID)
}

// emitTranscript sends one change of a conversation to the frontend. The
// conversation has its own event because it changes far more often than the
// rest of the state, and each event is idempotent on its own.
func (a *App) emitTranscript(ev session.TranscriptEvent) {
	wails, _ := a.handles()
	if wails != nil {
		wails.Event.Emit(bindings.EventTranscriptChanged, bindings.FromTranscriptEvent(ev))
	}
}

// publish sends the whole state to the frontend and retitles the window. It
// runs on every domain change, including the ones a second instance causes, and
// tolerates being called before the window exists.
func (a *App) publish() {
	a.publishMu.Lock()
	defer a.publishMu.Unlock()

	state := a.snapshot()
	title := a.title()

	wails, window := a.handles()
	if window != nil {
		window.SetTitle(title)
	}
	if wails != nil {
		wails.Event.Emit(bindings.EventStateChanged, state)
	}
}

// title names the window after the open workspace.
func (a *App) title() string {
	if current := a.ws.Current(); current != nil {
		return current.Name + " — " + appName
	}
	return appName
}

// recentList reads the recent workspaces, falling back to the last list it read
// successfully so a database hiccup does not empty the welcome screen.
func (a *App) recentList() []bindings.Recent {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	recents, err := a.ws.Recents(ctx)
	if err != nil {
		a.log.Error("read recents failed", "err", err)
		return a.lastRecents()
	}

	converted := bindings.FromRecents(recents)
	a.mu.Lock()
	a.recents = converted
	a.mu.Unlock()
	return converted
}

// lastRecents returns the last recent workspaces read from the database.
func (a *App) lastRecents() []bindings.Recent {
	a.mu.Lock()
	defer a.mu.Unlock()

	if a.recents == nil {
		return []bindings.Recent{}
	}
	return a.recents
}
