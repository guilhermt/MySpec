package deploys_test

import (
	"errors"
	"testing"

	"github.com/guilhermt/myspec/internal/deploys"
)

// env is a complete environment.
func env(name, branch string) deploys.Environment {
	return deploys.Environment{Name: name, Branch: branch, WorkflowID: 7, WorkflowName: "Deploy", WorkflowPath: ".github/workflows/deploy.yml"}
}

func TestDefaultEnvironments(t *testing.T) {
	t.Parallel()

	got := deploys.DefaultEnvironments()
	if len(got) < deploys.MinEnvironments {
		t.Fatalf("DefaultEnvironments() has %d environments, want %d at least", len(got), deploys.MinEnvironments)
	}
	if got[0].Name != "Development" || got[len(got)-1].Branch != "main" {
		t.Errorf("DefaultEnvironments() = %+v, want Development first and main last", got)
	}
}

func TestValidate(t *testing.T) {
	t.Parallel()

	noWorkflow := env("Staging", "staging")
	noWorkflow.WorkflowID = 0

	tests := []struct {
		name string
		envs []deploys.Environment
		repo string
		want error
	}{
		{"valid", []deploys.Environment{env("Dev", "dev"), env("Prod", "main")}, "repo-1", nil},
		{"one environment", []deploys.Environment{env("Dev", "dev")}, "repo-1", deploys.ErrTooFewEnvironments},
		{"no environments", nil, "repo-1", deploys.ErrTooFewEnvironments},
		{"blank name", []deploys.Environment{env("  ", "dev"), env("Prod", "main")}, "repo-1", deploys.ErrNoName},
		{"blank branch", []deploys.Environment{env("Dev", "dev"), env("Prod", " ")}, "repo-1", deploys.ErrNoBranch},
		{"no workflow on the first", []deploys.Environment{noWorkflow, env("Prod", "main")}, "repo-1", deploys.ErrNoWorkflow},
		{"no workflow on the last", []deploys.Environment{env("Dev", "dev"), noWorkflow}, "repo-1", deploys.ErrNoWorkflow},
		{"same name ignoring case", []deploys.Environment{env("Prod", "dev"), env(" prod ", "main")}, "repo-1", deploys.ErrSameName},
		{"same branch", []deploys.Environment{env("Dev", "main"), env("Prod", "main ")}, "repo-1", deploys.ErrSameBranch},
		{"branches differ by case", []deploys.Environment{env("Dev", "Main"), env("Prod", "main")}, "repo-1", nil},
		{"repository off the board", []deploys.Environment{env("Dev", "dev"), env("Prod", "main")}, "repo-9", deploys.ErrNotOnBoard},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			c := deploys.BoardConfig{BoardID: "board-1", Repositories: []deploys.RepositoryConfig{{RepositoryID: tt.repo, Environments: tt.envs}}}
			err := deploys.Validate(c, []string{"repo-1"})
			if !errors.Is(err, tt.want) || (tt.want == nil && err != nil) {
				t.Errorf("Validate() = %v, want %v", err, tt.want)
			}
		})
	}
}

func TestValidateChecksADisabledBoardToo(t *testing.T) {
	t.Parallel()

	c := deploys.BoardConfig{Repositories: []deploys.RepositoryConfig{{RepositoryID: "repo-1", Environments: []deploys.Environment{env("Dev", "dev")}}}}
	if err := deploys.Validate(c, []string{"repo-1"}); !errors.Is(err, deploys.ErrTooFewEnvironments) {
		t.Errorf("Validate() = %v, want ErrTooFewEnvironments", err)
	}
}

func TestValidateAcceptsABoardWithoutRepositories(t *testing.T) {
	t.Parallel()

	if err := deploys.Validate(deploys.BoardConfig{BoardID: "board-1"}, nil); err != nil {
		t.Errorf("Validate() = %v, want nil", err)
	}
}
