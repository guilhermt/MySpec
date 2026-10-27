package deploys

import (
	"errors"
	"fmt"
	"slices"
	"strings"
)

// The ways a configuration is refused.
var (
	ErrTooFewEnvironments = errors.New("deploys: a repository needs two environments at least")
	ErrNoName             = errors.New("deploys: an environment has no name")
	ErrNoBranch           = errors.New("deploys: an environment has no branch")
	ErrNoWorkflow         = errors.New("deploys: an environment has no workflow")
	ErrSameName           = errors.New("deploys: two environments share a name")
	ErrSameBranch         = errors.New("deploys: two environments share a branch")
	ErrNotOnBoard         = errors.New("deploys: the repository is not managed by the board")
	ErrBoardNotFound      = errors.New("deploys: board not found")
)

// Validate checks a configuration against the repositories the board manages.
// Names and branches are compared trimmed; a branch missing on GitHub is not
// refused. It runs even when the deploys are off, because the configuration is
// stored either way.
func Validate(c BoardConfig, boardRepositories []string) error {
	for _, repo := range c.Repositories {
		if !slices.Contains(boardRepositories, repo.RepositoryID) {
			return fmt.Errorf("repository %s: %w", repo.RepositoryID, ErrNotOnBoard)
		}
		if err := validateEnvironments(repo.Environments); err != nil {
			return fmt.Errorf("repository %s: %w", repo.RepositoryID, err)
		}
	}
	return nil
}

func validateEnvironments(envs []Environment) error {
	if len(envs) < MinEnvironments {
		return ErrTooFewEnvironments
	}
	for i, env := range envs {
		name := strings.TrimSpace(env.Name)
		branch := strings.TrimSpace(env.Branch)
		switch {
		case name == "":
			return ErrNoName
		case branch == "":
			return ErrNoBranch
		case env.WorkflowID == 0:
			return ErrNoWorkflow
		}
		for _, other := range envs[:i] {
			if strings.EqualFold(strings.TrimSpace(other.Name), name) {
				return fmt.Errorf("%q: %w", name, ErrSameName)
			}
			if strings.TrimSpace(other.Branch) == branch {
				return fmt.Errorf("%q: %w", branch, ErrSameBranch)
			}
		}
	}
	return nil
}
