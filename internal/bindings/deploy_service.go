package bindings

import (
	"context"
	"errors"
	"log/slog"
	"slices"
	"strings"
	"time"

	"github.com/guilhermt/myspec/internal/deploys"
	"github.com/guilhermt/myspec/internal/repository"
)

// deployOptionsTimeout bounds the reading of what GitHub offers the
// configuration of one repository: its workflows, its branches and the runs
// that suggest a workflow.
const deployOptionsTimeout = 30 * time.Second

// DeployService is the deploys API the frontend calls.
type DeployService struct {
	late         late[DeployService]
	deploys      *deploys.Service
	repositories func() []repository.Repository
	log          *slog.Logger
}

// NewDeployService builds the service over the deploys domain. repositories are
// the registered ones, with their board.
func NewDeployService(d *deploys.Service, repositories func() []repository.Repository, log *slog.Logger) *DeployService {
	return &DeployService{deploys: d, repositories: repositories, log: log}
}

// RefreshDeploys starts a reading of every managed repository. It returns at
// once; the reading arrives as state.
func (s *DeployService) RefreshDeploys() error {
	s, err := s.late.resolve(s)
	if err != nil {
		return err
	}
	s.deploys.Refresh()
	return nil
}

// RefreshDeployRepository starts a reading of one managed repository. It
// returns at once; the reading arrives as state.
func (s *DeployService) RefreshDeployRepository(repositoryID string) error {
	s, err := s.late.resolve(s)
	if err != nil {
		return err
	}
	s.deploys.RefreshRepository(repositoryID)
	return nil
}

// SetDeployFilter chooses the board the Deploys view shows; "" is every board.
func (s *DeployService) SetDeployFilter(boardID string) error {
	s, err := s.late.resolve(s)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.deploys.SetFilter(ctx, boardID); err != nil {
		return s.fail("SetDeployFilter", err)
	}
	return nil
}

// Deploy opens the pull request that promotes the previous environment into
// the one at position; merging it is Merge. It returns at once; the action
// arrives as state.
func (s *DeployService) Deploy(repositoryID string, position int) error {
	s, err := s.late.resolve(s)
	if err != nil {
		return err
	}
	if err := s.deploys.Deploy(repositoryID, position); err != nil {
		return s.fail("Deploy", err)
	}
	return nil
}

// Merge merges the pull request of deploy open for the environment at
// position. It returns at once; the action arrives as state.
func (s *DeployService) Merge(repositoryID string, position int) error {
	s, err := s.late.resolve(s)
	if err != nil {
		return err
	}
	if err := s.deploys.Merge(repositoryID, position); err != nil {
		return s.fail("Merge", err)
	}
	return nil
}

// DeploySettings is the deploys of a board as the dialog edits them, from what
// the app holds: a repository without a configuration comes with the default
// environments and unmanaged.
func (s *DeployService) DeploySettings(boardID string) (DeploySettings, error) {
	s, err := s.late.resolve(s)
	if err != nil {
		return DeploySettings{}, err
	}
	config, configured := s.deploys.Config(boardID)
	saved := make(map[string][]deploys.Environment, len(config.Repositories))
	for _, rc := range config.Repositories {
		saved[rc.RepositoryID] = rc.Environments
	}

	settings := DeploySettings{
		BoardID:      boardID,
		Configured:   configured,
		Enabled:      config.Enabled,
		Repositories: []DeployRepositorySettings{},
	}
	for _, repo := range s.repositories() {
		if repo.BoardID != boardID {
			continue
		}
		environments, managed := saved[repo.ID]
		if !managed {
			environments = deploys.DefaultEnvironments()
		}
		settings.Repositories = append(settings.Repositories, DeployRepositorySettings{
			RepositoryID: repo.ID,
			FullName:     repo.FullName(),
			Managed:      managed,
			Environments: fromDeployEnvironmentSettings(environments),
		})
	}
	slices.SortFunc(settings.Repositories, func(a, b DeployRepositorySettings) int {
		return strings.Compare(strings.ToLower(a.FullName), strings.ToLower(b.FullName))
	})
	return settings, nil
}

// ReadDeployRepository reads what GitHub offers the configuration of a
// repository: its workflows and, for each of branches, whether it exists and
// the workflow that runs on its push. A repository GitHub can't be read for is
// not an error: the reason comes back in Failure, with empty lists.
func (s *DeployService) ReadDeployRepository(repositoryID string, branches []string) (DeployRepositoryOptions, error) {
	s, err := s.late.resolve(s)
	if err != nil {
		return DeployRepositoryOptions{}, err
	}
	if !slices.ContainsFunc(s.repositories(), func(r repository.Repository) bool { return r.ID == repositoryID }) {
		return DeployRepositoryOptions{}, s.fail("ReadDeployRepository", repository.ErrNotFound)
	}
	ctx, cancel := context.WithTimeout(context.Background(), deployOptionsTimeout)
	defer cancel()

	options, err := s.deploys.Options(ctx, repositoryID, branches)
	if err != nil {
		var failure *deploys.Failure
		if errors.As(err, &failure) {
			return DeployRepositoryOptions{
				Workflows: []DeployWorkflow{}, Branches: []DeployBranchOption{}, Failure: failure.Message(),
			}, nil
		}
		return DeployRepositoryOptions{}, s.fail("ReadDeployRepository", err)
	}
	return fromDeployOptions(options), nil
}

// SaveDeploySettings stores what the user chose in the dialog. An environment
// without a workflow is refused.
func (s *DeployService) SaveDeploySettings(req SaveDeploySettingsRequest) error {
	s, err := s.late.resolve(s)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.deploys.SaveConfig(ctx, deployConfigOf(req)); err != nil {
		return s.fail("SaveDeploySettings", err)
	}
	return nil
}

func (s *DeployService) fail(method string, err error) error { return failure(s.log, method, err) }
