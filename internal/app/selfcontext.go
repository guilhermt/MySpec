package app

import (
	"errors"
	"fmt"
	"time"

	"github.com/guilhermt/myspec/internal/selfcontext"
	"github.com/guilhermt/myspec/internal/session"
)

// errNoItem means a session belongs to no task, review or discussion the app
// still holds.
var errNoItem = errors.New("app: no item for the session")

// itemState is the state of the item of a session as the app reads it now, in
// the words the interface shows. The session calls it off its mutex, right
// before a message that opens a turn leaves.
func (a *App) itemState(k session.Key) (string, error) {
	now := time.Now()
	summaries := a.sessions.Summaries()
	if t, ok := a.tasks.Get(k.TaskID); ok {
		in := selfcontext.TaskInput{
			Task: t, Stage: k.Stage, Artifacts: a.taskArtifacts(t.ID), Steps: a.flow.Steps(t.ID),
			Sessions: summaries, Divergence: a.divergenceOf(t.ID), Now: now,
		}
		if repo, registered := a.repositories.Get(t.RepositoryID); registered {
			in.Repository = repo.FullName()
		}
		if wt, exists := a.flow.Worktree(t.ID); exists {
			in.Worktree = &wt
		}
		if pr, exists := a.flow.PullRequest(t.ID); exists {
			in.PR = &pr
		}
		return selfcontext.Task(in), nil
	}
	if state, ok := a.reviewFlow.State(k.TaskID); ok {
		in := selfcontext.ReviewInput{State: state, Stage: k.Stage, Sessions: summaries, Now: now}
		if repo, registered := a.repositories.Get(state.Review.RepositoryID); registered {
			in.Repository = repo.FullName()
		}
		return selfcontext.Review(in), nil
	}
	if state, ok := a.discussionFlow.State(k.TaskID); ok {
		return selfcontext.Discussion(selfcontext.DiscussionInput{
			State: state, Stage: k.Stage, Sessions: summaries, Now: now,
		}), nil
	}
	return "", fmt.Errorf("state of %s: %w", k.TaskID, errNoItem)
}
