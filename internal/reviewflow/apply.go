package reviewflow

import (
	"context"
	"errors"
	"fmt"
)

// errNotImplemented is what the cycle that applies the findings answers until
// it is written. Nothing of the app reaches it before then: the interface only
// offers the mode where the cycle exists.
var errNotImplemented = errors.New("reviewflow: the apply mode is not implemented yet")

// Apply asks the agent to fix the findings the user approved, in the worktree
// of the review, for the user to review file by file as they do on a step.
func (s *Service) Apply(_ context.Context, id string) error {
	return s.notImplemented("apply", id)
}

// Approve approves the changes the agent made and asks it to commit them and
// push them to the head of the pull request.
func (s *Service) Approve(_ context.Context, id string) error {
	return s.notImplemented("approve", id)
}

// notImplemented refuses an action of the apply mode, saying which one it was.
func (s *Service) notImplemented(action, id string) error {
	s.log.Warn("apply mode asked for", "action", action, "review", id)
	return fmt.Errorf("%s review %s: %w", action, id, errNotImplemented)
}
