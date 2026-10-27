// Package deploys owns the deploys of the repositories of a board: the environments the user configured, the last reading of each environment on GitHub, the pull requests of promotion and their merges, and the runs those merges start. It reads and writes GitHub through gh, keeps its readings in memory and reports what changed by callbacks; it knows nothing about tasks.
package deploys

// Environment is one environment of a repository, as the user configured it.
type Environment struct {
	Name         string `json:"name"`         // Development
	Branch       string `json:"branch"`       // dev
	WorkflowID   int64  `json:"workflowId"`   // the id GitHub gives the workflow
	WorkflowName string `json:"workflowName"` // as GitHub named it when chosen
	WorkflowPath string `json:"workflowPath"` // .github/workflows/deploy.yml
}

// RepositoryConfig is the environments of one managed repository, in order.
type RepositoryConfig struct {
	RepositoryID string
	Environments []Environment // MinEnvironments at least
}

// BoardConfig is the deploys of one board.
type BoardConfig struct {
	BoardID      string
	Enabled      bool
	Repositories []RepositoryConfig // never nil
}

// MinEnvironments is how many environments a repository needs: one alone
// promotes nothing.
const MinEnvironments = 2

// DefaultEnvironments are the environments a repository starts with when the
// user checks it.
func DefaultEnvironments() []Environment {
	return []Environment{
		{Name: "Development", Branch: "dev"},
		{Name: "Staging", Branch: "staging"},
		{Name: "Production", Branch: "main"},
	}
}
