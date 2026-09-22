package pulls

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/repository"
)

// GitHub is gh.Runner.GraphQL.
type GitHub interface {
	GraphQL(ctx context.Context, query string, vars gh.Vars) (gh.Response, error)
}

// batchSize is how many repositories one query reads. GitHub prices a query by
// what it walks, and fifteen repositories of a hundred pull requests each stay
// well inside a single call.
const batchSize = 15

// ghostAuthor stands for the author of a pull request whose account is gone.
const ghostAuthor = "ghost"

// The aliases the batched queries read each repository under.
const (
	listAlias   = "r"
	detailAlias = "p"
)

// The GraphQL error types the reading tells apart.
const (
	typeNotFound  = "NOT_FOUND"
	typeForbidden = "FORBIDDEN"
)

// viewerQuery reads the account gh is authenticated as.
const viewerQuery = `query { viewer { login } }`

// prFragment is a pull request as both queries read it. The last review of the
// viewer says whether the user already reviewed it, and at which commit.
const prFragment = `
fragment pr on PullRequest {
  number title url isDraft isCrossRepository updatedAt
  headRefName headRefOid baseRefName
  author { login }
  labels(first: 20) { nodes { name color } }
  reviews(last: 1, author: $viewer, states: [APPROVED, CHANGES_REQUESTED, COMMENTED, DISMISSED]) {
    nodes { commit { oid } }
  }
}
`

// listRepository reads the open pull requests of one repository of a batch:
// the alias, the owner variable and the name variable.
const listRepository = `%s: repository(owner: $%s, name: $%s) {
  pullRequests(states: OPEN, first: 100, orderBy: {field: UPDATED_AT, direction: DESC}) { nodes { ...pr } }
}
`

// detailRepository reads one pull request of a batch: the alias, the owner
// variable, the name variable and the number variable. Beyond the list, it
// reads whether the branch merges clean and the checks of the last commit.
const detailRepository = `%s: repository(owner: $%s, name: $%s) { pullRequest(number: $%s) { ...pr body state merged mergeable
  commits(last: 1) { nodes { commit { statusCheckRollup { contexts(first: 100) { nodes {
    __typename ... on CheckRun { name status conclusion detailsUrl } ... on StatusContext { context state targetUrl }
  } } } } } }
} }
`

// The names of the variables of the i-th repository of a batch.
func ownerVar(i int) string  { return "o" + strconv.Itoa(i) }
func nameVar(i int) string   { return "n" + strconv.Itoa(i) }
func numberVar(i int) string { return "k" + strconv.Itoa(i) }

// listQuery reads the open pull requests of n repositories, each under its
// alias.
func listQuery(n int) string {
	var b strings.Builder
	b.WriteString("query($viewer: String!")
	for i := range n {
		fmt.Fprintf(&b, ", $%s: String!, $%s: String!", ownerVar(i), nameVar(i))
	}
	b.WriteString(") {\n")
	for i := range n {
		fmt.Fprintf(&b, listRepository, alias(listAlias, i), ownerVar(i), nameVar(i))
	}
	b.WriteString("}\n")
	b.WriteString(prFragment)
	return b.String()
}

// detailQuery reads n pull requests, open or not, each under its alias.
func detailQuery(n int) string {
	var b strings.Builder
	b.WriteString("query($viewer: String!")
	for i := range n {
		fmt.Fprintf(&b, ", $%s: String!, $%s: String!, $%s: Int!", ownerVar(i), nameVar(i), numberVar(i))
	}
	b.WriteString(") {\n")
	for i := range n {
		fmt.Fprintf(&b, detailRepository, alias(detailAlias, i), ownerVar(i), nameVar(i), numberVar(i))
	}
	b.WriteString("}\n")
	b.WriteString(prFragment)
	return b.String()
}

// alias is the alias of the i-th repository of a batch.
func alias(prefix string, i int) string { return prefix + strconv.Itoa(i) }

// aliasIndex is the position a GraphQL error path points at, when it starts
// with an alias of a batch of n repositories.
func aliasIndex(path []any, prefix string, n int) (int, bool) {
	if len(path) == 0 {
		return 0, false
	}
	name, ok := path[0].(string)
	if !ok || !strings.HasPrefix(name, prefix) {
		return 0, false
	}
	i, err := strconv.Atoi(strings.TrimPrefix(name, prefix))
	if err != nil || i < 0 || i >= n {
		return 0, false
	}
	return i, true
}

// prNode is a pull request as the fragment reads it.
type prNode struct {
	Number            int       `json:"number"`
	Title             string    `json:"title"`
	URL               string    `json:"url"`
	IsDraft           bool      `json:"isDraft"`
	IsCrossRepository bool      `json:"isCrossRepository"`
	UpdatedAt         time.Time `json:"updatedAt"`
	HeadRefName       string    `json:"headRefName"`
	HeadRefOid        string    `json:"headRefOid"`
	BaseRefName       string    `json:"baseRefName"`
	Author            *struct {
		Login string `json:"login"`
	} `json:"author"`
	Labels struct {
		Nodes []struct {
			Name  string `json:"name"`
			Color string `json:"color"`
		} `json:"nodes"`
	} `json:"labels"`
	Reviews struct {
		Nodes []struct {
			Commit *struct {
				OID string `json:"oid"`
			} `json:"commit"`
		} `json:"nodes"`
	} `json:"reviews"`
}

// pullRequest is the node as a PullRequest of the repository owner/name.
func (n prNode) pullRequest(owner, name string) PullRequest {
	author := ghostAuthor
	if n.Author != nil && n.Author.Login != "" {
		author = n.Author.Login
	}
	labels := make([]Label, 0, len(n.Labels.Nodes))
	for _, l := range n.Labels.Nodes {
		labels = append(labels, Label{Name: l.Name, Color: l.Color})
	}
	pr := PullRequest{
		Owner:      owner,
		Name:       name,
		Number:     n.Number,
		Title:      n.Title,
		URL:        n.URL,
		Author:     author,
		Labels:     labels,
		Draft:      n.IsDraft,
		Fork:       n.IsCrossRepository,
		HeadBranch: n.HeadRefName,
		HeadCommit: n.HeadRefOid,
		BaseBranch: n.BaseRefName,
		UpdatedAt:  n.UpdatedAt,
	}
	if len(n.Reviews.Nodes) > 0 {
		pr.Reviewed = true
		if commit := n.Reviews.Nodes[0].Commit; commit != nil {
			pr.ReviewedCommit = commit.OID
		}
	}
	return pr
}

// detailNode is a pull request read on its own.
type detailNode struct {
	prNode
	Body   string `json:"body"`
	State  string `json:"state"`
	Merged bool   `json:"merged"`

	Mergeable string `json:"mergeable"`
	Commits   struct {
		Nodes []struct {
			Commit struct {
				// StatusCheckRollup is null for a commit with no checks.
				StatusCheckRollup *struct {
					Contexts struct {
						Nodes []gh.CheckNode `json:"nodes"`
					} `json:"contexts"`
				} `json:"statusCheckRollup"`
			} `json:"commit"`
		} `json:"nodes"`
	} `json:"commits"`
}

// detail is the node as a Detail of the repository owner/name.
func (n detailNode) detail(owner, name string) Detail {
	state := strings.ToLower(n.State)
	if n.Merged {
		state = "merged"
	}
	return Detail{
		PullRequest: n.pullRequest(owner, name),
		Body:        n.Body,
		State:       state,
		Checks:      gh.ParseChecks(n.checkNodes(), n.Mergeable),
	}
}

// checkNodes are the checks of the last commit; nil when the pull request has
// no commit or the commit no checks.
func (n detailNode) checkNodes() []gh.CheckNode {
	if len(n.Commits.Nodes) == 0 {
		return nil
	}
	rollup := n.Commits.Nodes[0].Commit.StatusCheckRollup
	if rollup == nil {
		return nil
	}
	return rollup.Contexts.Nodes
}

// readViewer is the account gh is authenticated as, read once and kept. It
// fails with a *Failure.
func (s *Service) readViewer(ctx context.Context) (string, error) {
	s.mu.Lock()
	viewer := s.viewer
	s.mu.Unlock()
	if viewer != "" {
		return viewer, nil
	}

	resp, err := s.github.GraphQL(ctx, viewerQuery, gh.Vars{})
	if err != nil {
		return "", FailureOf(err)
	}
	var data struct {
		Viewer struct {
			Login string `json:"login"`
		} `json:"viewer"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		return "", FailureOf(fmt.Errorf("decode viewer: %w", err))
	}
	if data.Viewer.Login == "" {
		return "", &Failure{Reason: ReasonUnauthenticated}
	}

	s.mu.Lock()
	s.viewer = data.Viewer.Login
	s.mu.Unlock()
	return data.Viewer.Login, nil
}

// readAll reads the open pull requests of repos, in batches, and returns what
// it found for each one by repository id. A repository whose reading failed
// carries the failure and no list.
func (s *Service) readAll(ctx context.Context, repos []repository.Repository, viewer string) map[string]RepositoryReading {
	found := make(map[string]RepositoryReading, len(repos))
	for chunk := range slices.Chunk(repos, batchSize) {
		for id, reading := range s.readBatch(ctx, chunk, viewer) {
			found[id] = reading
		}
	}
	return found
}

// readBatch reads one batch of repositories. A call that failed altogether is
// the failure of every repository of the batch; an error GitHub answered for
// one alias is the failure of that repository alone.
func (s *Service) readBatch(ctx context.Context, batch []repository.Repository, viewer string) map[string]RepositoryReading {
	vars := gh.Vars{"viewer": viewer}
	for i, repo := range batch {
		vars[ownerVar(i)], vars[nameVar(i)] = repo.Owner, repo.Name
	}
	resp, err := s.github.GraphQL(ctx, listQuery(len(batch)), vars)
	if err != nil {
		s.log.Warn("pull requests reading failed", "repositories", len(batch), "error", err)
		return batchFailure(batch, FailureOf(err))
	}
	var data map[string]json.RawMessage
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		return batchFailure(batch, FailureOf(fmt.Errorf("decode pull requests: %w", err)))
	}

	failures := aliasFailures(resp.Errors, listAlias, len(batch))
	found := make(map[string]RepositoryReading, len(batch))
	for i, repo := range batch {
		if failure, ok := failures[i]; ok {
			s.log.Warn("pull requests reading failed", "repository", repo.FullName(), "error", failure)
			found[repo.ID] = RepositoryReading{RepositoryID: repo.ID, Failure: failure}
			continue
		}
		prs, err := decodeList(data[alias(listAlias, i)], repo)
		if err != nil {
			found[repo.ID] = RepositoryReading{RepositoryID: repo.ID, Failure: FailureOf(err)}
			continue
		}
		found[repo.ID] = RepositoryReading{RepositoryID: repo.ID, PullRequests: prs}
	}
	return found
}

// decodeList is the pull requests one alias of a list query answered; never
// nil. A repository GitHub answered nothing for has none.
func decodeList(raw json.RawMessage, repo repository.Repository) ([]PullRequest, error) {
	prs := []PullRequest{}
	if len(raw) == 0 || string(raw) == "null" {
		return prs, nil
	}
	var node struct {
		PullRequests struct {
			Nodes []prNode `json:"nodes"`
		} `json:"pullRequests"`
	}
	if err := json.Unmarshal(raw, &node); err != nil {
		return nil, fmt.Errorf("decode pull requests of %s: %w", repo.FullName(), err)
	}
	for _, n := range node.PullRequests.Nodes {
		prs = append(prs, n.pullRequest(repo.Owner, repo.Name))
	}
	return prs, nil
}

// batchFailure is failure as the reading of every repository of batch.
func batchFailure(batch []repository.Repository, failure *Failure) map[string]RepositoryReading {
	found := make(map[string]RepositoryReading, len(batch))
	for _, repo := range batch {
		found[repo.ID] = RepositoryReading{RepositoryID: repo.ID, Failure: failure}
	}
	return found
}

// aliasFailures is the failure of each repository of a batch of n that GitHub
// answered an error for, by its position.
func aliasFailures(errs []gh.GraphQLError, prefix string, n int) map[int]*Failure {
	failures := map[int]*Failure{}
	for _, e := range errs {
		i, ok := aliasIndex(e.Path, prefix, n)
		if !ok {
			continue
		}
		if _, seen := failures[i]; seen {
			continue
		}
		if e.Type == typeNotFound || e.Type == typeForbidden {
			failures[i] = &Failure{Reason: ReasonNotFound}
			continue
		}
		failures[i] = &Failure{Reason: ReasonFailed, Detail: e.Message}
	}
	return failures
}

// readDetails reads refs in batches and returns what GitHub answered for each
// one. It fails with a *Failure.
func (s *Service) readDetails(ctx context.Context, refs []Ref, viewer string) (map[Ref]Detail, error) {
	found := map[Ref]Detail{}
	for chunk := range slices.Chunk(refs, batchSize) {
		vars := gh.Vars{"viewer": viewer}
		for i, r := range chunk {
			vars[ownerVar(i)], vars[nameVar(i)], vars[numberVar(i)] = r.Owner, r.Name, r.Number
		}
		resp, err := s.github.GraphQL(ctx, detailQuery(len(chunk)), vars)
		if err != nil {
			return nil, FailureOf(err)
		}
		var data map[string]json.RawMessage
		if err := json.Unmarshal(resp.Data, &data); err != nil {
			return nil, FailureOf(fmt.Errorf("decode pull requests: %w", err))
		}
		for i, r := range chunk {
			raw, ok := data[alias(detailAlias, i)]
			if !ok || string(raw) == "null" {
				continue
			}
			var node struct {
				PullRequest *detailNode `json:"pullRequest"`
			}
			if err := json.Unmarshal(raw, &node); err != nil {
				return nil, FailureOf(fmt.Errorf("decode pull request %s/%s#%d: %w", r.Owner, r.Name, r.Number, err))
			}
			if node.PullRequest == nil {
				continue
			}
			found[r] = node.PullRequest.detail(r.Owner, r.Name)
		}
	}
	return found, nil
}
