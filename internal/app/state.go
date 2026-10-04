package app

import (
	"context"
	"time"

	"github.com/guilhermt/myspec/internal/attention"
	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/discussionflow"
	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/reviewflow"
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
	reviews, reviewFound := a.reviewStates()
	found = append(found, reviewFound...)
	discussions, discussionFound := a.discussionStates()
	found = append(found, discussionFound...)
	situations := a.attention.Update(found)

	repositories := bindings.FromRepositories(
		a.repositories.List(), a.repositories.Missing, a.tasks.Counts, a.prReviews.Counts, a.repositories.Cloning,
	)
	return bindings.State{
		Repositories:     repositories,
		RepositoryFilter: a.repositories.Filter(),
		Theme:            string(a.theme.Preference()),
		SystemDark:       a.theme.SystemDark(),
		// ModelDefaults and ReviewModeDefault are the app's own: every
		// repository sees the same ones.
		ModelDefaults: bindings.FromModelSet(a.models.Defaults()),
		ModelFactory:  bindings.FromModelSet(models.Factory()),
		// ModelCatalog is what the installed CLI offers; like the defaults, it
		// is the app's own.
		ModelCatalog:      bindings.FromCatalog(a.models.Catalog(), a.models.CatalogFailure()),
		ReviewModeDefault: string(a.reviewModes.Default()),
		Tasks: bindings.FromTasks(
			tasks,
			func(id string) task.Artifacts { return artifacts[id] },
			func(id string) []flow.StepState { return steps[id] },
			func(id string) (flow.PullRequest, bool) { pr, ok := prs[id]; return pr, ok },
			a.flow.Worktree,
			a.sessions.Conversations,
			a.repositories.Get,
			summaries, situations,
		),
		History: bindings.FromArchived(a.tasks.ListArchived(), bindings.ArchivedSources{
			Artifacts:    a.taskArtifacts,
			PRRun:        a.tasks.PRRun,
			PRPasses:     a.tasks.PRPasses,
			StepRuns:     a.tasks.StepRuns,
			Repositories: a.repositories.Get,
		}),
		Boards: bindings.FromBoards(
			a.boards.List(), a.boards.Stored, a.boards.Reading,
			a.repositories.List(), a.repositories.Missing, a.tasks.CardTasks(),
			a.discussions.CardWriters(),
		),
		ReviewCenter: bindings.FromReviewCenter(
			a.pulls.Readings(), a.pulls.Reading(), a.pulls.ReadAt(), a.pulls.Viewer(), a.pulls.Filters(),
			repositories, a.taskPullRequests(), a.prReviews.ActiveOf, a.boards.CardOfPullRequest,
		),
		Reviews: bindings.FromReviews(reviews, situations, repositories),
		ReviewHistory: bindings.FromArchivedReviews(
			a.prReviews.ListArchived(), a.prReviews.Passes, repositories,
		),
		Discussions: bindings.FromDiscussions(
			discussions, situations, a.boards.Get, a.boards.Stored, repositories, a.repositories.Missing,
		),
		DiscussionHistory: bindings.FromArchivedDiscussions(
			a.discussions.ListArchived(), a.discussions.Drafts, repositories,
		),
		CloneFolder: a.repositories.CloneFolder(),
	}
}

// reviewTitle is the title of the notification of a review: the pull request
// as GitHub names it, and its title when the review has one.
func reviewTitle(fullName string, stored prreview.Review) string {
	title := stored.Reference(fullName)
	if stored.Title != "" {
		title += " · " + stored.Title
	}
	return title
}

// reviewStates is what the app knows about every active review, with the
// situations each one waits on the user for.
func (a *App) reviewStates() ([]reviewflow.State, []attention.Found) {
	list := a.prReviews.List()
	states := make([]reviewflow.State, 0, len(list))
	found := make([]attention.Found, 0, len(list)) // a review waits on one thing at a time
	for _, stored := range list {
		state, ok := a.reviewFlow.State(stored.ID)
		if !ok {
			continue
		}
		states = append(states, state)
		fullName := ""
		if repo, registered := a.repositories.Get(stored.RepositoryID); registered {
			fullName = repo.FullName()
		}
		found = append(found, attention.DeriveReview(attention.ReviewInput{
			State: state, Title: reviewTitle(fullName, stored),
		})...)
	}
	return states, found
}

// discussionStates is what the app knows about every active discussion, with
// the situations each one waits on the user for.
func (a *App) discussionStates() ([]discussionflow.State, []attention.Found) {
	list := a.discussions.List()
	states := make([]discussionflow.State, 0, len(list))
	found := make([]attention.Found, 0, len(list)) // a discussion waits on one thing at a time
	for _, stored := range list {
		state, ok := a.discussionFlow.State(stored.ID)
		if !ok {
			continue
		}
		states = append(states, state)
		found = append(found, attention.DeriveDiscussion(attention.DiscussionInput{
			State: state, Title: stored.Title,
		})...)
	}
	return states, found
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

// publishWindow is the shortest time between two publishes of the state, which
// keeps the bursts of a busy session from flooding the frontend.
const publishWindow = 100 * time.Millisecond

// publish asks for the state to be sent to the frontend; a burst of changes is
// sent at most once per publishWindow, the last change included. It tolerates
// being called before the window exists.
func (a *App) publish() {
	a.publisher.request()
}

// publishNow sends the whole state to the frontend.
func (a *App) publishNow() {
	// Before the startup ends there is no state to send.
	if !a.isReady() {
		return
	}
	a.publishMu.Lock()
	defer a.publishMu.Unlock()

	state := a.snapshot()

	if wails, _ := a.handles(); wails != nil {
		wails.Event.Emit(bindings.EventStateChanged, state)
		a.log.Debug("state published")
	}
}
