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
    nodes { state submittedAt commit { oid } }
  }
}
`

// listRepository reads the open pull requests of one repository of a batch:
// the alias, the owner variable and the name variable. Beyond the fragment, it
// reads what only the list shows: the description, whether the branch merges
// clean, the checks of the head and the last hundred commits, which say how
// many came after the last review of the viewer.
const listRepository = `%s: repository(owner: $%s, name: $%s) {
  pullRequests(states: OPEN, first: 100, orderBy: {field: UPDATED_AT, direction: DESC}) { nodes { ...pr body mergeable
    head: commits(last: 1) { nodes { commit { statusCheckRollup { contexts(first: 100) { nodes {
      __typename ... on CheckRun { name status conclusion detailsUrl startedAt completedAt } ... on StatusContext { context state targetUrl }
    } } } } } }
    since: commits(last: 100) { nodes { commit { oid } } }
  } }
}
`

// detailRepository reads one pull request of a batch: the alias, the owner
// variable, the name variable and the number variable. Beyond the list, it
// reads whether the branch merges clean, the checks of the last commit with
// their hours, the last fifty commits and how the pull request ended.
const detailRepository = `%s: repository(owner: $%s, name: $%s) { pullRequest(number: $%s) { ...pr body state merged mergeable
  mergedBy { login } mergedAt closedAt
  head: commits(last: 1) { nodes { commit { statusCheckRollup { contexts(first: 100) { nodes {
    __typename ... on CheckRun { name status conclusion detailsUrl startedAt completedAt } ... on StatusContext { context state targetUrl }
  } } } } } }
  recent: commits(last: 50) { nodes { commit { oid messageHeadline author { name user { login } } } } }
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
	b.WriteString("  rateLimit { cost }\n}\n")
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
			State       string    `json:"state"`
			SubmittedAt time.Time `json:"submittedAt"`
			Commit      *struct {
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
		pr.YourReview = &YourReview{State: strings.ToLower(n.Reviews.Nodes[0].State), At: n.Reviews.Nodes[0].SubmittedAt}
		if commit := n.Reviews.Nodes[0].Commit; commit != nil {
			pr.ReviewedCommit = commit.OID
		}
	}
	return pr
}

// checksNode is the checks of the head of a pull request, as the aliased
// commits(last: 1) of both queries answer them.
type checksNode struct {
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
}

// nodes are the checks of the last commit; nil when the pull request has no
// commit or the commit no checks.
func (c checksNode) nodes() []gh.CheckNode {
	if len(c.Nodes) == 0 {
		return nil
	}
	rollup := c.Nodes[0].Commit.StatusCheckRollup
	if rollup == nil {
		return nil
	}
	return rollup.Contexts.Nodes
}

// listNode is a pull request as the list reads it.
type listNode struct {
	prNode
	Body      string     `json:"body"`
	Mergeable string     `json:"mergeable"`
	Head      checksNode `json:"head"`
	Since     struct {
		Nodes []struct {
			Commit struct {
				OID string `json:"oid"`
			} `json:"commit"`
		} `json:"nodes"`
	} `json:"since"`
}

// pullRequest is the node as a PullRequest of the repository owner/name.
func (n listNode) pullRequest(owner, name string) PullRequest {
	pr := n.prNode.pullRequest(owner, name)
	pr.Body = n.Body
	pr.Checks = gh.ParseChecks(n.Head.nodes(), n.Mergeable)
	pr.NewCommitCount = n.newCommitCount(pr)
	return pr
}

// newCommitCount is how many commits came after the commit of the last review
// of the viewer: 0 without a review or when the head is its commit, -1 when
// its commit is not among the last hundred.
func (n listNode) newCommitCount(pr PullRequest) int {
	if !pr.Reviewed || pr.ReviewedCommit == "" || pr.ReviewedCommit == pr.HeadCommit {
		return 0
	}
	for i, c := range n.Since.Nodes {
		if c.Commit.OID == pr.ReviewedCommit {
			return len(n.Since.Nodes) - 1 - i
		}
	}
	return -1
}

// detailNode is a pull request read on its own.
type detailNode struct {
	prNode
	Body   string `json:"body"`
	State  string `json:"state"`
	Merged bool   `json:"merged"`

	Mergeable string `json:"mergeable"`
	MergedBy  *struct {
		Login string `json:"login"`
	} `json:"mergedBy"`
	MergedAt *time.Time `json:"mergedAt"`
	ClosedAt *time.Time `json:"closedAt"`
	Head     checksNode `json:"head"`
	Recent   struct {
		Nodes []struct {
			Commit struct {
				OID             string `json:"oid"`
				MessageHeadline string `json:"messageHeadline"`
				Author          struct {
					Name string `json:"name"`
					User *struct {
						Login string `json:"login"`
					} `json:"user"`
				} `json:"author"`
			} `json:"commit"`
		} `json:"nodes"`
	} `json:"recent"`
}

// detail is the node as a Detail of the repository owner/name.
func (n detailNode) detail(owner, name string) Detail {
	state := strings.ToLower(n.State)
	if n.Merged {
		state = "merged"
	}
	pr := n.pullRequest(owner, name)
	pr.Body = n.Body
	detail := Detail{
		PullRequest: pr,
		State:       state,
		Checks:      gh.ParseChecks(n.Head.nodes(), n.Mergeable),
		Commits:     make([]Commit, 0, len(n.Recent.Nodes)),
	}
	if n.MergedBy != nil {
		detail.MergedBy = n.MergedBy.Login
	}
	if n.MergedAt != nil {
		detail.MergedAt = *n.MergedAt
	}
	if n.ClosedAt != nil {
		detail.ClosedAt = *n.ClosedAt
	}
	for _, c := range n.Recent.Nodes {
		author := c.Commit.Author.Name
		if c.Commit.Author.User != nil && c.Commit.Author.User.Login != "" {
			author = c.Commit.Author.User.Login
		}
		detail.Commits = append(detail.Commits, Commit{SHA: c.Commit.OID, Subject: c.Commit.MessageHeadline, Author: author})
	}
	return detail
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
// it found for each one by repository id, and what GitHub priced the queries
// at. A repository whose reading failed carries the failure and no list.
func (s *Service) readAll(ctx context.Context, repos []repository.Repository, viewer string) (map[string]RepositoryReading, int) {
	found := make(map[string]RepositoryReading, len(repos))
	cost := 0
	for chunk := range slices.Chunk(repos, batchSize) {
		readings, batchCost := s.readBatch(ctx, chunk, viewer)
		cost += batchCost
		for id, reading := range readings {
			found[id] = reading
		}
	}
	return found, cost
}

// readBatch reads one batch of repositories. A call that failed altogether is
// the failure of every repository of the batch; an error GitHub answered for
// one alias is the failure of that repository alone. The cost is what GitHub
// priced the query at; 0 for a call that failed.
func (s *Service) readBatch(ctx context.Context, batch []repository.Repository, viewer string) (map[string]RepositoryReading, int) {
	vars := gh.Vars{"viewer": viewer}
	for i, repo := range batch {
		vars[ownerVar(i)], vars[nameVar(i)] = repo.Owner, repo.Name
	}
	resp, err := s.github.GraphQL(ctx, listQuery(len(batch)), vars)
	if err != nil {
		s.log.Warn("pull requests reading failed", "repositories", len(batch), "error", err)
		return batchFailure(batch, FailureOf(err)), 0
	}
	var data map[string]json.RawMessage
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		return batchFailure(batch, FailureOf(fmt.Errorf("decode pull requests: %w", err))), 0
	}
	var priced struct {
		RateLimit *struct {
			Cost int `json:"cost"`
		} `json:"rateLimit"`
	}
	cost := 0
	if err := json.Unmarshal(resp.Data, &priced); err == nil && priced.RateLimit != nil {
		cost = priced.RateLimit.Cost
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
	return found, cost
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
			Nodes []listNode `json:"nodes"`
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
