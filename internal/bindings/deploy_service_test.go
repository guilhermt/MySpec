package bindings_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/deploys"
	"github.com/guilhermt/myspec/internal/gh"
)

// savedSettings are the deploys of the board of the fixture as the dialog
// saves them: the repository of the fixture, managed with two environments.
func savedSettings() bindings.SaveDeploySettingsRequest {
	return bindings.SaveDeploySettingsRequest{
		BoardID: testBoardID,
		Enabled: true,
		Repositories: []bindings.DeployRepositoryChoice{{
			RepositoryID: testRepoID,
			Environments: []bindings.DeployEnvironmentSettings{
				{Name: "Development", Branch: "dev", WorkflowID: 1, WorkflowName: "Deploy", WorkflowPath: ".github/workflows/deploy.yml"},
				{Name: "Production", Branch: "main", WorkflowID: 2, WorkflowName: "Release", WorkflowPath: ".github/workflows/release.yml"},
			},
		}},
	}
}

func TestDeployServiceTellsTheUserWhatWentWrong(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		call func(s *bindings.DeployService) error
		want string
	}{
		{
			name: "settings of a board that no longer exists",
			call: func(s *bindings.DeployService) error {
				return s.SaveDeploySettings(bindings.SaveDeploySettingsRequest{BoardID: "board-9"})
			},
			want: "The board no longer exists.",
		},
		{
			name: "a repository with one environment",
			call: func(s *bindings.DeployService) error {
				req := savedSettings()
				req.Repositories[0].Environments = req.Repositories[0].Environments[:1]
				return s.SaveDeploySettings(req)
			},
			want: "Each repository needs at least two environments.",
		},
		{
			name: "an environment without a workflow",
			call: func(s *bindings.DeployService) error {
				req := savedSettings()
				req.Repositories[0].Environments[1].WorkflowID = 0
				return s.SaveDeploySettings(req)
			},
			want: "Choose the workflow of every environment.",
		},
		{
			name: "two environments on one branch",
			call: func(s *bindings.DeployService) error {
				req := savedSettings()
				req.Repositories[0].Environments[1].Branch = "dev"
				return s.SaveDeploySettings(req)
			},
			want: "Two environments of a repository can't share a branch.",
		},
		{
			name: "a repository the board doesn't manage",
			call: func(s *bindings.DeployService) error {
				req := savedSettings()
				req.Repositories[0].RepositoryID = "repo-9"
				return s.SaveDeploySettings(req)
			},
			want: "This repository is not managed by the board.",
		},
		{
			name: "a deploy before the repository was read",
			call: func(s *bindings.DeployService) error {
				if err := s.SaveDeploySettings(savedSettings()); err != nil {
					return err
				}
				return s.Deploy(testRepoID, 1)
			},
			want: "The deploys of this repository haven't been read yet.",
		},
		{
			name: "a deploy on an environment that doesn't exist",
			call: func(s *bindings.DeployService) error { return s.Deploy(testRepoID, 1) },
			want: "That environment no longer exists.",
		},
		{
			name: "options of a repository nobody registered",
			call: func(s *bindings.DeployService) error {
				_, err := s.ReadDeployRepository("repo-9", nil)
				return err
			},
			want: "This repository isn't registered.",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			f := newFixture(t)
			f.register(t, t.TempDir())
			f.registerBoard(t, true)
			f.deployGH.fail(gh.ErrNotAuthenticated)

			err := tt.call(f.deploySvc)
			if err == nil || err.Error() != tt.want {
				t.Errorf("error = %v, want %q", err, tt.want)
			}
		})
	}
}

func TestDeploySettingsOffersTheDefaultEnvironmentsToARepositoryNotYetManaged(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())
	f.registerBoard(t, true)

	got, err := f.deploySvc.DeploySettings(testBoardID)
	if err != nil {
		t.Fatalf("DeploySettings() = %v, want nil", err)
	}

	want := bindings.DeploySettings{
		BoardID: testBoardID,
		Repositories: []bindings.DeployRepositorySettings{{
			RepositoryID: testRepoID,
			FullName:     "dev/web",
			Environments: []bindings.DeployEnvironmentSettings{
				{Name: "Development", Branch: "dev"},
				{Name: "Staging", Branch: "staging"},
				{Name: "Production", Branch: "main"},
			},
		}},
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("DeploySettings() mismatch (-want +got):\n%s", diff)
	}
}

func TestDeploySettingsReturnsWhatWasSaved(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())
	f.registerBoard(t, true)
	f.deployGH.fail(gh.ErrNotAuthenticated)
	req := savedSettings()
	if err := f.deploySvc.SaveDeploySettings(req); err != nil {
		t.Fatalf("SaveDeploySettings() = %v, want nil", err)
	}

	got, err := f.deploySvc.DeploySettings(testBoardID)
	if err != nil {
		t.Fatalf("DeploySettings() = %v, want nil", err)
	}

	want := bindings.DeploySettings{
		BoardID: testBoardID, Configured: true, Enabled: true,
		Repositories: []bindings.DeployRepositorySettings{{
			RepositoryID: testRepoID, FullName: "dev/web", Managed: true,
			Environments: req.Repositories[0].Environments,
		}},
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("DeploySettings() mismatch (-want +got):\n%s", diff)
	}
	if boards := f.state.GetState().Boards; len(boards) != 1 ||
		boards[0].Deploys != (bindings.BoardDeploys{Configured: true, Enabled: true, Repositories: 1}) {
		t.Errorf("Boards = %+v, want the board to sum up its deploys", boards)
	}
}

func TestReadDeployRepositoryReportsAFailureOfGitHubInsteadOfFailing(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())
	f.registerBoard(t, true)
	f.deployGH.fail(gh.ErrNotAuthenticated)

	got, err := f.deploySvc.ReadDeployRepository(testRepoID, []string{"dev"})
	if err != nil {
		t.Fatalf("ReadDeployRepository() = %v, want nil: a failure of GitHub is data", err)
	}

	want := bindings.DeployRepositoryOptions{
		Workflows: []bindings.DeployWorkflow{},
		Branches:  []bindings.DeployBranchOption{},
		Failure:   (&deploys.Failure{Reason: deploys.ReasonUnauthenticated}).Message(),
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("ReadDeployRepository() mismatch (-want +got):\n%s", diff)
	}
}

func TestSetDeployFilterShowsInTheState(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())
	f.registerBoard(t, true)

	if err := f.deploySvc.SetDeployFilter(testBoardID); err != nil {
		t.Fatalf("SetDeployFilter() = %v, want nil", err)
	}

	want := bindings.DeployFilter{BoardID: testBoardID, Title: "Roadmap"}
	if got := f.state.GetState().Deploys.Filter; got != want {
		t.Errorf("Deploys.Filter = %+v, want %+v", got, want)
	}
}
