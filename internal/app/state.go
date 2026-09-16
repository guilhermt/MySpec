package app

import (
	"context"

	"github.com/guilhermt/myspec/internal/attention"
	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
)

// snapshot builds the state the frontend renders. The situations are derived
// from the same readings the tasks are converted from, so that every surface
// agrees with every other. The caller holds publishMu.
func (a *App) snapshot() bindings.State {
	tasks := a.tasks.List()
	summaries := a.sessions.Summaries()
	artifacts := make(map[string]task.Artifacts, len(tasks))
	steps := make(map[string][]flow.StepState, len(tasks))
	prs := make(map[string]flow.PullRequest, len(tasks))
	found := make([]attention.Found, 0, len(tasks)) // one place waits at a time outside implementation
	for _, t := range tasks {
		artifacts[t.ID], steps[t.ID] = a.taskArtifacts(t.ID), a.flow.Steps(t.ID)
		var pr *flow.PullRequest
		if stage, ok := a.flow.PullRequest(t.ID); ok {
			prs[t.ID] = stage
			pr = &stage
		}
		found = append(found, attention.Derive(attention.Input{
			Task: t, Artifacts: artifacts[t.ID], Steps: steps[t.ID], PR: pr, Sessions: summaries,
		})...)
	}
	situations := a.attention.Update(found)

	return bindings.State{
		Repositories: bindings.FromRepositories(
			a.repositories.List(), a.repositories.Missing, a.tasks.Counts, a.repositories.Cloning,
		),
		RepositoryFilter: a.repositories.Filter(),
		Theme:            string(a.theme.Preference()),
		SystemDark:       a.theme.SystemDark(),
		// ModelDefaults and ReviewModeDefault are the app's own: every
		// repository sees the same ones.
		ModelDefaults:     bindings.FromModelSet(a.models.Defaults()),
		ReviewModeDefault: string(a.reviewModes.Default()),
		Tasks: bindings.FromTasks(
			tasks,
			func(id string) task.Artifacts { return artifacts[id] },
			func(id string) []flow.StepState { return steps[id] },
			func(id string) (flow.PullRequest, bool) { pr, ok := prs[id]; return pr, ok },
			a.repositories.Get,
			summaries, situations,
		),
		History: bindings.FromArchived(
			a.tasks.ListArchived(), a.taskArtifacts, a.tasks.PRRun, a.repositories.Get,
		),
		Boards: bindings.FromBoards(
			a.boards.List(), a.boards.Stored, a.boards.Reading,
			a.repositories.List(), a.repositories.Missing, a.tasks.CardTasks(),
		),
		CloneFolder: a.repositories.CloneFolder(),
	}
}

// state is the snapshot the frontend asks for. It takes the lock a publish
// takes, so that two readings never update the situations at once.
func (a *App) state() bindings.State {
	a.publishMu.Lock()
	defer a.publishMu.Unlock()

	return a.snapshot()
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

// emitSituationStarted tells the frontend a situation started, which is what
// the brief highlight of a row or a tab needs. The event leaves before the
// state that brings the situation, and the frontend keeps the highlight by id,
// so the order does not matter.
func (a *App) emitSituationStarted(started attention.Started) {
	if wails, _ := a.handles(); wails != nil {
		wails.Event.Emit(bindings.EventSituationStarted, bindings.FromStarted(started))
	}
}

// publish sends the whole state to the frontend. It runs on every domain
// change and tolerates being called before the window exists.
func (a *App) publish() {
	a.publishMu.Lock()
	defer a.publishMu.Unlock()

	state := a.snapshot()

	if wails, _ := a.handles(); wails != nil {
		wails.Event.Emit(bindings.EventStateChanged, state)
	}
}
