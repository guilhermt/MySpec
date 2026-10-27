package store_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/board"
	"github.com/guilhermt/myspec/internal/deploys"
	"github.com/guilhermt/myspec/internal/store"
)

// deployEnvironments is a two-environment configuration.
func deployEnvironments(first, second string) []deploys.Environment {
	return []deploys.Environment{
		{Name: "Development", Branch: first, WorkflowID: 11, WorkflowName: "Deploy dev", WorkflowPath: ".github/workflows/dev.yml"},
		{Name: "Production", Branch: second, WorkflowID: 12, WorkflowName: "Deploy prod", WorkflowPath: ".github/workflows/prod.yml"},
	}
}

// listDeployConfigs reads the stored configurations, failing the test on error.
func listDeployConfigs(t *testing.T, s *store.Store) []deploys.BoardConfig {
	t.Helper()

	configs, err := s.Deploys.ListDeployConfigs(t.Context())
	if err != nil {
		t.Fatalf("ListDeployConfigs() = %v, want nil", err)
	}
	return configs
}

// saveDeployConfig stores a configuration, failing the test on error.
func saveDeployConfig(t *testing.T, s *store.Store, c deploys.BoardConfig) {
	t.Helper()

	if err := s.Deploys.SaveDeployConfig(t.Context(), c); err != nil {
		t.Fatalf("SaveDeployConfig(%s) = %v, want nil", c.BoardID, err)
	}
}

// newDeployStore opens a store with a board that manages the web and api
// repositories.
func newDeployStore(t *testing.T) *store.Store {
	t.Helper()

	s := newStoreWithRepositories(t)
	insertBoard(t, s, newBoard("board-1", "Roadmap", 1),
		board.Link{RepositoryID: webRepo},
		board.Link{RepositoryID: apiRepo},
	)
	return s
}

func TestDeploysSaveAndList(t *testing.T) {
	t.Parallel()
	s := newDeployStore(t)

	want := deploys.BoardConfig{
		BoardID: "board-1",
		Enabled: true,
		Repositories: []deploys.RepositoryConfig{
			{RepositoryID: apiRepo, Environments: deployEnvironments("dev", "main")},
			{RepositoryID: webRepo, Environments: deployEnvironments("develop", "release")},
		},
	}
	saveDeployConfig(t, s, want)

	if diff := cmp.Diff([]deploys.BoardConfig{want}, listDeployConfigs(t, s)); diff != "" {
		t.Errorf("ListDeployConfigs() mismatch (-want +got):\n%s", diff)
	}
}

func TestDeploysListIsEmptyWithoutConfigs(t *testing.T) {
	t.Parallel()
	s := newDeployStore(t)

	if got := listDeployConfigs(t, s); len(got) != 0 {
		t.Errorf("ListDeployConfigs() = %v, want empty", got)
	}
}

func TestDeploysSaveAgainReplacesTheWholeList(t *testing.T) {
	t.Parallel()
	s := newDeployStore(t)

	saveDeployConfig(t, s, deploys.BoardConfig{
		BoardID: "board-1",
		Enabled: true,
		Repositories: []deploys.RepositoryConfig{
			{RepositoryID: apiRepo, Environments: deployEnvironments("dev", "main")},
			{RepositoryID: webRepo, Environments: deployEnvironments("dev", "main")},
		},
	})
	want := deploys.BoardConfig{
		BoardID: "board-1",
		Repositories: []deploys.RepositoryConfig{
			{RepositoryID: webRepo, Environments: deployEnvironments("staging", "prod")},
		},
	}
	saveDeployConfig(t, s, want)

	if diff := cmp.Diff([]deploys.BoardConfig{want}, listDeployConfigs(t, s)); diff != "" {
		t.Errorf("ListDeployConfigs() mismatch (-want +got):\n%s", diff)
	}
}

func TestDeploysDeleteBoardRemovesTheConfiguration(t *testing.T) {
	t.Parallel()
	s := newDeployStore(t)

	saveDeployConfig(t, s, deploys.BoardConfig{
		BoardID:      "board-1",
		Enabled:      true,
		Repositories: []deploys.RepositoryConfig{{RepositoryID: webRepo, Environments: deployEnvironments("dev", "main")}},
	})
	if err := s.Boards.DeleteBoard(t.Context(), "board-1", []board.Release{{RepositoryID: webRepo}, {RepositoryID: apiRepo}}); err != nil {
		t.Fatalf("DeleteBoard() = %v, want nil", err)
	}

	if got := listDeployConfigs(t, s); len(got) != 0 {
		t.Errorf("ListDeployConfigs() = %v, want empty", got)
	}
}

func TestDeploysRemovingTheRepositoryRemovesItsRow(t *testing.T) {
	t.Parallel()
	s := newDeployStore(t)

	saveDeployConfig(t, s, deploys.BoardConfig{
		BoardID: "board-1",
		Enabled: true,
		Repositories: []deploys.RepositoryConfig{
			{RepositoryID: apiRepo, Environments: deployEnvironments("dev", "main")},
			{RepositoryID: webRepo, Environments: deployEnvironments("dev", "main")},
		},
	})
	if err := s.Repositories.Delete(t.Context(), webRepo); err != nil {
		t.Fatalf("Delete() = %v, want nil", err)
	}

	got := listDeployConfigs(t, s)
	if len(got) != 1 || len(got[0].Repositories) != 1 || got[0].Repositories[0].RepositoryID != apiRepo {
		t.Errorf("ListDeployConfigs() = %+v, want only the api repository", got)
	}
}
