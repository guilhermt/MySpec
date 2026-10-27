package deploys

import (
	"context"
	"encoding/json"
	"testing"
)

// Target is a repository to read with its environments.
type Target = target

// Cost is what a reading asked of GitHub.
type Cost = cost

var (
	// Literal is literal.
	Literal = literal
	// ReadQuery is readQuery.
	ReadQuery = readQuery
	// BranchesQuery is branchesQuery.
	BranchesQuery = branchesQuery
	// ReadRuns is readRuns.
	ReadRuns = readRuns
	// ReadRepositories is readRepositories.
	ReadRepositories = readRepositories
	// BatchSize is batchSize.
	BatchSize = batchSize
	// RunWaitLimit is runWaitLimit.
	RunWaitLimit = runWaitLimit
)

// Tick runs one turn of the fast loop, without waiting for its ticker.
func (s *Service) Tick(ctx context.Context) { s.tick(ctx) }

// PromotionOf is promotion over the commits written as the JSON GitHub
// answers them.
func PromotionOf(t *testing.T, prevTip string, ahead int, nodes string, envBranches []string) Promotion {
	t.Helper()

	var commits []commitNode
	if err := json.Unmarshal([]byte(nodes), &commits); err != nil {
		t.Fatalf("decode commits: %v", err)
	}
	return promotion(prevTip, ahead, commits, envBranches)
}
