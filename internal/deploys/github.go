package deploys

import (
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/guilhermt/myspec/internal/gh"
)

// GitHub is the gh the service runs; gh.Runner implements it.
type GitHub interface {
	GraphQL(ctx context.Context, query string, vars gh.Vars) (gh.Response, error)
	REST(ctx context.Context, method, endpoint, body string) (string, error)
}

const (
	// batchSize is how many repositories one query reads, as in pulls: GitHub
	// prices a query by what it walks.
	batchSize = 15
	// compareLimit is how many commits one comparison reads.
	compareLimit = 100
	// associatedLimit is how many pull requests one commit reads.
	associatedLimit = 5
	// deployPRLimit is how many open pull requests of deploy one pair reads.
	deployPRLimit = 5
	// runsPage is how many runs of the workflow one environment reads.
	runsPage = 20
	// pushRunsPage is how many runs of a push one branch reads to suggest its
	// workflow.
	pushRunsPage = 50
	// workflowsPage is how many workflows a repository lists.
	workflowsPage = 100
	// restConcurrency is how many REST calls of one reading run at once.
	restConcurrency = 4
)

// The aliases the query reads each repository, branch and pair of branches under.
const (
	repositoryAlias = "r"
	branchAlias     = "b"
	pullsAlias      = "p"
)

// ghostAuthor stands for the author of a pull request whose account is gone.
const ghostAuthor = "ghost"

// The GraphQL error types that mean the repository can't be read by this account.
const (
	typeNotFound  = "NOT_FOUND"
	typeForbidden = "FORBIDDEN"
)

// The REST methods the reading uses.
const methodGet = "GET"

// literal is s as a GraphQL string literal, quotes included. A JSON string is
// one, with the quotes and the backslashes escaped.
func literal(s string) string {
	quoted, err := json.Marshal(s)
	if err != nil {
		panic(fmt.Sprintf("deploys: marshal string: %v", err)) // a string always marshals
	}
	return string(quoted)
}

// target is a repository to read with its environments.
type target struct {
	ID           string
	Owner        string
	Name         string
	Environments []Environment
}

// alias is the alias of the i-th repository, branch or pair.
func alias(prefix string, i int) string { return prefix + strconv.Itoa(i) }

// refFields is what a branch reads: its tip.
const refFields = `target { oid }`

// compareFields is what a branch reads of the one before it: the commits that
// are in the previous one and not in it, with the pull requests they came from.
const compareFields = `compare(headRef: %s) {
      aheadBy
      commits(first: %d) {
        nodes {
          oid committedDate
          parents(first: 1) { totalCount nodes { oid } }
          associatedPullRequests(first: %d) {
            nodes { number title url mergedAt author { login } headRefName baseRefName }
          }
        }
      }
    }`

// pullsFields is the open pull requests of deploy from the previous branch.
const pullsFields = `%s: pullRequests(states: OPEN, baseRefName: %s, headRefName: %s, first: %d, orderBy: {field: CREATED_AT, direction: DESC}) {
    totalCount
    nodes { number title url isDraft createdAt isCrossRepository }
  }`

// readQuery reads the branches, the comparisons and the open pull requests of
// deploy of the repositories of targets, each under its alias.
func readQuery(targets []target) string {
	var b strings.Builder
	b.WriteString("query {\n")
	for i, t := range targets {
		fmt.Fprintf(&b, "%s: repository(owner: %s, name: %s) {\n", alias(repositoryAlias, i), literal(t.Owner), literal(t.Name))
		for j, env := range t.Environments {
			fmt.Fprintf(&b, "  %s: ref(qualifiedName: %s) {\n    %s\n", alias(branchAlias, j), literal("refs/heads/"+env.Branch), refFields)
			if j > 0 {
				previous := t.Environments[j-1].Branch
				fmt.Fprintf(&b, "    "+compareFields+"\n", literal(previous), compareLimit, associatedLimit)
			}
			b.WriteString("  }\n")
			if j > 0 {
				fmt.Fprintf(&b, "  "+pullsFields+"\n", alias(pullsAlias, j), literal(env.Branch), literal(t.Environments[j-1].Branch), deployPRLimit)
			}
		}
		b.WriteString("}\n")
	}
	b.WriteString("rateLimit { cost }\n}\n")
	return b.String()
}

// aliasIndex is the position a GraphQL error path points at, when it starts
// with an alias of a batch of n repositories.
func aliasIndex(path []any, n int) (int, bool) {
	if len(path) == 0 {
		return 0, false
	}
	name, ok := path[0].(string)
	if !ok || !strings.HasPrefix(name, repositoryAlias) {
		return 0, false
	}
	i, err := strconv.Atoi(strings.TrimPrefix(name, repositoryAlias))
	if err != nil || i < 0 || i >= n {
		return 0, false
	}
	return i, true
}

// failureOfError is the failure of one error GitHub answered for a repository.
func failureOfError(e gh.GraphQLError) *Failure {
	if e.Type == typeNotFound || e.Type == typeForbidden {
		return &Failure{Reason: ReasonNotFound}
	}
	return &Failure{Reason: ReasonFailed, Detail: e.Message}
}

// aliasFailures is the failure of each repository of a batch of n that GitHub
// answered an error for, by its position. The first error of a repository
// decides.
func aliasFailures(errs []gh.GraphQLError, n int) map[int]*Failure {
	failures := map[int]*Failure{}
	for _, e := range errs {
		i, ok := aliasIndex(e.Path, n)
		if !ok {
			continue
		}
		if _, seen := failures[i]; !seen {
			failures[i] = failureOfError(e)
		}
	}
	return failures
}

// commitNode is a commit of a comparison.
type commitNode struct {
	OID           string    `json:"oid"`
	CommittedDate time.Time `json:"committedDate"`
	Parents       struct {
		TotalCount int `json:"totalCount"`
		Nodes      []struct {
			OID string `json:"oid"`
		} `json:"nodes"`
	} `json:"parents"`
	AssociatedPullRequests struct {
		Nodes []associatedPR `json:"nodes"`
	} `json:"associatedPullRequests"`
}

// associatedPR is a pull request a commit came from.
type associatedPR struct {
	Number      int        `json:"number"`
	Title       string     `json:"title"`
	URL         string     `json:"url"`
	MergedAt    *time.Time `json:"mergedAt"`
	HeadRefName string     `json:"headRefName"`
	BaseRefName string     `json:"baseRefName"`
	Author      *struct {
		Login string `json:"login"`
	} `json:"author"`
}

// refNode is a branch as the query reads it.
type refNode struct {
	Target struct {
		OID string `json:"oid"`
	} `json:"target"`
	Compare *struct {
		AheadBy int `json:"aheadBy"`
		Commits struct {
			Nodes []commitNode `json:"nodes"`
		} `json:"commits"`
	} `json:"compare"`
}

// pullsNode is the open pull requests of deploy of a pair of branches.
type pullsNode struct {
	TotalCount int `json:"totalCount"`
	Nodes      []struct {
		Number            int       `json:"number"`
		Title             string    `json:"title"`
		URL               string    `json:"url"`
		IsDraft           bool      `json:"isDraft"`
		CreatedAt         time.Time `json:"createdAt"`
		IsCrossRepository bool      `json:"isCrossRepository"`
	} `json:"nodes"`
}

// deployPR is the most recent open pull request of deploy and how many are
// open, leaving out the ones from a fork: a branch of a fork with the same name
// is not a deploy. It is nil, with 0, when none is.
func (p pullsNode) deployPR() (*DeployPR, int) {
	var first *DeployPR
	forks := 0
	for _, n := range p.Nodes {
		if n.IsCrossRepository {
			forks++
			continue
		}
		if first == nil {
			first = &DeployPR{Number: n.Number, Title: n.Title, URL: n.URL, Draft: n.IsDraft, CreatedAt: n.CreatedAt}
		}
	}
	if first == nil {
		return nil, 0
	}
	return first, max(p.TotalCount-forks, 1)
}

// promotion is what waits in the previous branch, whose tip is prevTip, to
// enter the next one: ahead is what GitHub counts, nodes the commits it
// listed and envBranches the branches of the environments of the repository,
// which tell the pull requests of deploy from the ones of the tasks.
func promotion(prevTip string, ahead int, nodes []commitNode, envBranches []string) Promotion {
	p := Promotion{Ahead: ahead, Partial: ahead > len(nodes), PullRequests: []PullRequest{}}

	for _, n := range nodes {
		if n.Parents.TotalCount < 2 {
			p.Commits++
		}
	}
	// The commits not read are taken as common ones.
	p.Commits += max(0, ahead-len(nodes))
	p.PullRequests = pullRequestsOf(nodes, envBranches)
	if p.Commits > 0 {
		p.PendingSince = pendingSince(prevTip, nodes)
	}
	return p
}

// pendingSince is when the oldest change waiting reached the previous branch.
// On the first-parent line of that branch, the date of a commit is when its
// change arrived: the squash of a task, the merge commit of the promotion
// before. The walk starts at the tip and stops at the first commit that is not
// among nodes; when the tip is not there, the oldest date read stands.
func pendingSince(prevTip string, nodes []commitNode) time.Time {
	byOID := make(map[string]commitNode, len(nodes))
	for _, n := range nodes {
		byOID[n.OID] = n
	}
	cur, ok := byOID[prevTip]
	if !ok {
		var oldest time.Time
		for _, n := range nodes {
			if oldest.IsZero() || n.CommittedDate.Before(oldest) {
				oldest = n.CommittedDate
			}
		}
		return oldest
	}
	since := cur.CommittedDate
	for range nodes {
		if len(cur.Parents.Nodes) == 0 {
			break
		}
		next, ok := byOID[cur.Parents.Nodes[0].OID]
		if !ok {
			break
		}
		cur = next
		since = cur.CommittedDate
	}
	return since
}

// pullRequestsOf are the pull requests the commits came from: the merged ones,
// not the ones of deploy between the environments, once each, by number from
// the highest.
func pullRequestsOf(nodes []commitNode, envBranches []string) []PullRequest {
	prs := []PullRequest{}
	seen := map[int]bool{}
	for _, n := range nodes {
		for _, pr := range n.AssociatedPullRequests.Nodes {
			if pr.MergedAt == nil || seen[pr.Number] {
				continue
			}
			if slices.Contains(envBranches, pr.HeadRefName) && slices.Contains(envBranches, pr.BaseRefName) {
				continue
			}
			seen[pr.Number] = true
			author := ghostAuthor
			if pr.Author != nil && pr.Author.Login != "" {
				author = pr.Author.Login
			}
			prs = append(prs, PullRequest{Number: pr.Number, Title: pr.Title, URL: pr.URL, Author: author})
		}
	}
	slices.SortFunc(prs, func(a, b PullRequest) int { return cmp.Compare(b.Number, a.Number) })
	return prs
}

// environmentBranches are the branches of envs.
func environmentBranches(envs []Environment) []string {
	branches := make([]string, len(envs))
	for i, env := range envs {
		branches[i] = env.Branch
	}
	return branches
}

// decodeRepository is the environments one alias of the query answered, with
// no runs yet. A repository GitHub answered nothing for is not found.
func decodeRepository(raw json.RawMessage, envs []Environment) ([]EnvironmentReading, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return nil, &Failure{Reason: ReasonNotFound}
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(raw, &fields); err != nil {
		return nil, fmt.Errorf("decode repository: %w", err)
	}
	refs := make([]*refNode, len(envs))
	for j := range envs {
		field := fields[alias(branchAlias, j)]
		if len(field) == 0 || string(field) == "null" {
			continue
		}
		refs[j] = &refNode{}
		if err := json.Unmarshal(field, refs[j]); err != nil {
			return nil, fmt.Errorf("decode branch %s: %w", envs[j].Branch, err)
		}
	}

	branches := environmentBranches(envs)
	readings := make([]EnvironmentReading, len(envs))
	for j, env := range envs {
		r := EnvironmentReading{Branch: env.Branch, WorkflowID: env.WorkflowID, BranchMissing: refs[j] == nil}
		if j > 0 {
			r.PreviousBranch = envs[j-1].Branch
		}
		if refs[j] != nil {
			r.Head = refs[j].Target.OID
		}
		if j > 0 && refs[j] != nil && refs[j-1] != nil && refs[j].Compare != nil {
			var pulls pullsNode
			if field := fields[alias(pullsAlias, j)]; len(field) > 0 && string(field) != "null" {
				if err := json.Unmarshal(field, &pulls); err != nil {
					return nil, fmt.Errorf("decode pull requests of %s: %w", env.Branch, err)
				}
			}
			p := promotion(refs[j-1].Target.OID, refs[j].Compare.AheadBy, refs[j].Compare.Commits.Nodes, branches)
			p.DeployPR, p.OpenDeployPRs = pulls.deployPR()
			r.Promotion = &p
		}
		readings[j] = r
	}
	return readings, nil
}

// runsResponse is the runs of a workflow as the REST call answers them.
type runsResponse struct {
	WorkflowRuns []runResponse `json:"workflow_runs"`
}

// runResponse is one run as the REST calls answer it.
type runResponse struct {
	ID           int64      `json:"id"`
	WorkflowID   int64      `json:"workflow_id"`
	Status       string     `json:"status"`
	Conclusion   string     `json:"conclusion"`
	HeadSHA      string     `json:"head_sha"`
	HTMLURL      string     `json:"html_url"`
	CreatedAt    time.Time  `json:"created_at"`
	RunStartedAt *time.Time `json:"run_started_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// readRuns is the runs of the workflow on the branch that count, the most
// recent first. A workflow GitHub answers not found for is gh.ErrNoResource.
func readRuns(ctx context.Context, github GitHub, owner, name string, workflowID int64, branch string) ([]Run, error) {
	endpoint := fmt.Sprintf("%s/actions/workflows/%d/runs?branch=%s&per_page=%d&exclude_pull_requests=true",
		repoEndpoint(owner, name), workflowID, url.QueryEscape(branch), runsPage)
	out, err := github.REST(ctx, methodGet, endpoint, "")
	if err != nil {
		return nil, fmt.Errorf("read runs of workflow %d: %w", workflowID, err)
	}
	var resp runsResponse
	if err := json.Unmarshal([]byte(out), &resp); err != nil {
		return nil, fmt.Errorf("decode runs of workflow %d: %w", workflowID, err)
	}
	runs := make([]Run, 0, len(resp.WorkflowRuns))
	for _, r := range resp.WorkflowRuns {
		if run, counts := r.run(); counts {
			runs = append(runs, run)
		}
	}
	return runs, nil
}

// readRun is the run id of owner/name; nil when it no longer exists or ended
// in a conclusion that does not count.
func readRun(ctx context.Context, github GitHub, owner, name string, id int64) (*Run, error) {
	out, err := github.REST(ctx, methodGet, fmt.Sprintf("%s/actions/runs/%d", repoEndpoint(owner, name), id), "")
	if errors.Is(err, gh.ErrNoResource) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read run %d: %w", id, err)
	}
	var r runResponse
	if err := json.Unmarshal([]byte(out), &r); err != nil {
		return nil, fmt.Errorf("decode run %d: %w", id, err)
	}
	run, counts := r.run()
	if !counts {
		return nil, nil
	}
	return &run, nil
}

// run is r as a Run, and whether its conclusion counts.
func (r runResponse) run() (Run, bool) {
	status, counts := statusOf(r.Status, r.Conclusion)
	if !counts {
		return Run{}, false
	}
	run := Run{
		ID: r.ID, Status: status, Conclusion: r.Conclusion, HeadSHA: r.HeadSHA, URL: r.HTMLURL,
		CreatedAt: r.CreatedAt, StartedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt,
	}
	if r.RunStartedAt != nil && !r.RunStartedAt.IsZero() {
		run.StartedAt = *r.RunStartedAt
	}
	return run, true
}

// lastRuns are the most recent run and the most recent completed one of runs,
// which come the most recent first; nil for the ones there are none.
func lastRuns(runs []Run) (last, completed *Run) {
	for i := range runs {
		if last == nil {
			last = &runs[i]
		}
		if !runs[i].Active() {
			completed = &runs[i]
			break
		}
	}
	return last, completed
}

// cost is what a reading asked of GitHub.
type cost struct {
	GraphQL int // what GitHub priced the queries at
	REST    int // the REST calls made
}

// readRepositories reads targets: a GraphQL query per batch of repositories,
// then a REST call per environment whose branch exists, at most
// restConcurrency at once. A repository whose reading failed carries the
// failure and no environments. A failure that holds for the whole reading is
// returned as the error, a *Failure, with no readings; so is the cancellation
// of ctx.
func readRepositories(ctx context.Context, github GitHub, targets []target) (map[string]RepositoryReading, cost, error) {
	found := make(map[string]RepositoryReading, len(targets))
	var spent cost
	for chunk := range slices.Chunk(targets, batchSize) {
		priced, err := readBatch(ctx, github, chunk, found)
		spent.GraphQL += priced
		if err != nil {
			return nil, spent, err
		}
	}

	rest, err := readAllRuns(ctx, github, targets, found)
	spent.REST = rest
	if err != nil {
		return nil, spent, err
	}
	if err := ctx.Err(); err != nil {
		return nil, spent, err
	}
	return found, spent, nil
}

// readBatch reads one batch of repositories into found and returns what GitHub
// priced the query at; 0 for a call that failed. A call that failed altogether
// is the failure of every repository of the batch, and an error GitHub
// answered for one alias is the failure of that repository alone. A general
// failure is returned.
func readBatch(ctx context.Context, github GitHub, batch []target, found map[string]RepositoryReading) (int, error) {
	resp, err := github.GraphQL(ctx, readQuery(batch), gh.Vars{})
	if err != nil {
		return 0, markBatchFailed(ctx, batch, found, FailureOf(err))
	}
	var data map[string]json.RawMessage
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		return 0, markBatchFailed(ctx, batch, found, FailureOf(fmt.Errorf("decode deploys: %w", err)))
	}
	var priced struct {
		RateLimit *struct {
			Cost int `json:"cost"`
		} `json:"rateLimit"`
	}
	spent := 0
	if err := json.Unmarshal(resp.Data, &priced); err == nil && priced.RateLimit != nil {
		spent = priced.RateLimit.Cost
	}

	failures := aliasFailures(resp.Errors, len(batch))
	for i, t := range batch {
		if failure, ok := failures[i]; ok {
			found[t.ID] = RepositoryReading{RepositoryID: t.ID, Environments: []EnvironmentReading{}, Failure: failure}
			continue
		}
		envs, err := decodeRepository(data[alias(repositoryAlias, i)], t.Environments)
		if err != nil {
			failure := FailureOf(err)
			var own *Failure
			if errors.As(err, &own) {
				failure = own
			}
			found[t.ID] = RepositoryReading{RepositoryID: t.ID, Environments: []EnvironmentReading{}, Failure: failure}
			continue
		}
		found[t.ID] = RepositoryReading{RepositoryID: t.ID, Environments: envs}
	}
	return spent, nil
}

// markBatchFailed records failure as the reading of every repository of batch.
// It returns the failure as the error when it holds for the whole reading, and
// the error of ctx when the reading was cancelled.
func markBatchFailed(ctx context.Context, batch []target, found map[string]RepositoryReading, failure *Failure) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if failure.General() {
		return failure
	}
	for _, t := range batch {
		found[t.ID] = RepositoryReading{RepositoryID: t.ID, Environments: []EnvironmentReading{}, Failure: failure}
	}
	return nil
}

// runSlot is where the runs of one environment of one repository go.
type runSlot struct {
	target target
	index  int
}

// readAllRuns reads the runs of every environment of the repositories found
// without failure and whose branch exists, and puts them in found. It returns
// how many calls it made, and a general failure as the error.
func readAllRuns(ctx context.Context, github GitHub, targets []target, found map[string]RepositoryReading) (int, error) {
	var slots []runSlot
	for _, t := range targets {
		reading, ok := found[t.ID]
		if !ok || reading.Failure != nil {
			continue
		}
		for j, env := range reading.Environments {
			if !env.BranchMissing {
				slots = append(slots, runSlot{target: t, index: j})
			}
		}
	}

	var (
		wg      sync.WaitGroup
		mu      sync.Mutex
		general *Failure
		calls   atomic.Int64
		sem     = make(chan struct{}, restConcurrency)
	)
	for _, slot := range slots {
		wg.Add(1)
		sem <- struct{}{}
		go func() {
			defer wg.Done()
			defer func() { <-sem }()
			calls.Add(1)
			env := slot.target.Environments[slot.index]
			runs, err := readRuns(ctx, github, slot.target.Owner, slot.target.Name, env.WorkflowID, env.Branch)

			mu.Lock()
			defer mu.Unlock()
			reading := found[slot.target.ID]
			if reading.Failure != nil {
				return
			}
			switch {
			case err == nil:
				reading.Environments[slot.index].LastRun, reading.Environments[slot.index].LastCompleted = lastRuns(runs)
			case errors.Is(err, gh.ErrNoResource):
				reading.Environments[slot.index].WorkflowMissing = true
			default:
				failure := FailureOf(err)
				if failure.General() && general == nil {
					general = failure
				}
				reading.Failure = failure
				reading.Environments = []EnvironmentReading{}
			}
			found[slot.target.ID] = reading
		}()
	}
	wg.Wait()

	if err := ctx.Err(); err != nil {
		return int(calls.Load()), err
	}
	if general != nil {
		return int(calls.Load()), general
	}
	return int(calls.Load()), nil
}

// Options is what the configuration of a repository offers.
type Options struct {
	Workflows []Workflow     // the active ones, by name ignoring case; never nil
	Branches  []BranchOption // one per branch asked, in the same order; never nil
}

// Workflow is a workflow of GitHub Actions of a repository.
type Workflow struct {
	ID   int64
	Name string
	Path string
}

// BranchOption is what GitHub says of one branch asked.
type BranchOption struct {
	Branch    string
	Exists    bool
	Suggested int64 // the only workflow that ran on a push to the branch; 0 when none or several
}

// ReadOptions reads what the configuration of owner/name offers: its active
// workflows, whether each of branches exists and, for the ones that do, the
// workflow to suggest. The history of runs says what really runs on a push,
// paths filters and branch globs included, without reading YAML; a workflow of
// tests that also runs on the push leaves more than one, and no suggestion. It
// fails with a *Failure.
func ReadOptions(ctx context.Context, github GitHub, owner, name string, branches []string) (Options, error) {
	workflows, err := readWorkflows(ctx, github, owner, name)
	if err != nil {
		return Options{}, err
	}
	options := Options{Workflows: workflows, Branches: make([]BranchOption, len(branches))}
	for i, branch := range branches {
		options.Branches[i] = BranchOption{Branch: branch}
	}
	if len(branches) == 0 {
		return options, nil
	}

	exists, err := readBranches(ctx, github, owner, name, branches)
	if err != nil {
		return Options{}, err
	}
	active := make(map[int64]bool, len(workflows))
	for _, w := range workflows {
		active[w.ID] = true
	}

	var (
		wg      sync.WaitGroup
		mu      sync.Mutex
		failure *Failure
		sem     = make(chan struct{}, restConcurrency)
	)
	for i, branch := range branches {
		options.Branches[i].Exists = exists[i]
		if !exists[i] {
			continue
		}
		wg.Add(1)
		sem <- struct{}{}
		go func() {
			defer wg.Done()
			defer func() { <-sem }()
			suggested, err := suggestWorkflow(ctx, github, owner, name, branch, active)

			mu.Lock()
			defer mu.Unlock()
			if err != nil {
				if failure == nil {
					failure = FailureOf(err)
				}
				return
			}
			options.Branches[i].Suggested = suggested
		}()
	}
	wg.Wait()
	if failure != nil {
		return Options{}, failure
	}
	return options, nil
}

// readWorkflows are the active workflows of owner/name, by name ignoring case.
func readWorkflows(ctx context.Context, github GitHub, owner, name string) ([]Workflow, error) {
	out, err := github.REST(ctx, methodGet, fmt.Sprintf("%s/actions/workflows?per_page=%d", repoEndpoint(owner, name), workflowsPage), "")
	if err != nil {
		return nil, FailureOf(err)
	}
	var resp struct {
		Workflows []struct {
			ID    int64  `json:"id"`
			Name  string `json:"name"`
			Path  string `json:"path"`
			State string `json:"state"`
		} `json:"workflows"`
	}
	if err := json.Unmarshal([]byte(out), &resp); err != nil {
		return nil, FailureOf(fmt.Errorf("decode workflows: %w", err))
	}
	workflows := []Workflow{}
	for _, w := range resp.Workflows {
		if w.State == "active" {
			workflows = append(workflows, Workflow{ID: w.ID, Name: w.Name, Path: w.Path})
		}
	}
	slices.SortStableFunc(workflows, func(a, b Workflow) int {
		return cmp.Compare(strings.ToLower(a.Name), strings.ToLower(b.Name))
	})
	return workflows, nil
}

// branchesQuery reads the tip of each of branches in owner/name; a branch that
// doesn't exist answers null.
func branchesQuery(owner, name string, branches []string) string {
	var b strings.Builder
	fmt.Fprintf(&b, "query {\n  repository(owner: %s, name: %s) {\n", literal(owner), literal(name))
	for i, branch := range branches {
		fmt.Fprintf(&b, "    %s: ref(qualifiedName: %s) { %s }\n", alias(branchAlias, i), literal("refs/heads/"+branch), refFields)
	}
	b.WriteString("  }\n}\n")
	return b.String()
}

// readBranches says, for each of branches, whether it exists in owner/name.
func readBranches(ctx context.Context, github GitHub, owner, name string, branches []string) ([]bool, error) {
	resp, err := github.GraphQL(ctx, branchesQuery(owner, name, branches), gh.Vars{})
	if err != nil {
		return nil, FailureOf(err)
	}
	if len(resp.Errors) > 0 {
		return nil, failureOfError(resp.Errors[0])
	}
	var data struct {
		Repository map[string]json.RawMessage `json:"repository"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		return nil, FailureOf(fmt.Errorf("decode branches: %w", err))
	}
	if data.Repository == nil {
		return nil, &Failure{Reason: ReasonNotFound}
	}
	exists := make([]bool, len(branches))
	for i := range branches {
		field := data.Repository[alias(branchAlias, i)]
		exists[i] = len(field) > 0 && string(field) != "null"
	}
	return exists, nil
}

// suggestWorkflow is the workflow that ran on the pushes to branch, among the
// active ones; 0 when none did or more than one did.
func suggestWorkflow(ctx context.Context, github GitHub, owner, name, branch string, active map[int64]bool) (int64, error) {
	endpoint := fmt.Sprintf("%s/actions/runs?branch=%s&event=push&per_page=%d", repoEndpoint(owner, name), url.QueryEscape(branch), pushRunsPage)
	out, err := github.REST(ctx, methodGet, endpoint, "")
	if err != nil {
		return 0, fmt.Errorf("read pushes to %s: %w", branch, err)
	}
	var resp runsResponse
	if err := json.Unmarshal([]byte(out), &resp); err != nil {
		return 0, fmt.Errorf("decode pushes to %s: %w", branch, err)
	}
	ran := map[int64]bool{}
	for _, r := range resp.WorkflowRuns {
		if active[r.WorkflowID] {
			ran[r.WorkflowID] = true
		}
	}
	if len(ran) != 1 {
		return 0, nil
	}
	for id := range ran {
		return id, nil
	}
	return 0, nil
}
