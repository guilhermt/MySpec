package deploys_test

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/guilhermt/myspec/internal/deploys"
	"github.com/guilhermt/myspec/internal/gh"
)

// base is the fixed instant the tests read the deploys at.
var base = time.Date(2026, time.September, 16, 12, 0, 0, 0, time.UTC)

// restReply is what the fake answers a REST call with.
type restReply struct {
	out string
	err error
}

// fakeGitHub answers what a test wrote down: the GraphQL through one function,
// the REST calls by a part of the endpoint.
type fakeGitHub struct {
	mu       sync.Mutex
	graphql  func(query string) (gh.Response, error)
	rest     map[string]restReply
	queries  []string
	endpoint []string
}

func newFakeGitHub() *fakeGitHub {
	return &fakeGitHub{rest: map[string]restReply{}}
}

// answerREST makes the calls whose endpoint contains part answer out and err.
func (g *fakeGitHub) answerREST(part, out string, err error) {
	g.mu.Lock()
	defer g.mu.Unlock()

	g.rest[part] = restReply{out: out, err: err}
}

// answerGraphQL makes every query answer data, with errs.
func (g *fakeGitHub) answerGraphQL(data string, errs ...gh.GraphQLError) {
	g.mu.Lock()
	defer g.mu.Unlock()

	g.graphql = func(string) (gh.Response, error) {
		return gh.Response{Data: json.RawMessage(data), Errors: errs}, nil
	}
}

// failGraphQL makes every query fail with err.
func (g *fakeGitHub) failGraphQL(err error) {
	g.mu.Lock()
	defer g.mu.Unlock()

	g.graphql = func(string) (gh.Response, error) { return gh.Response{}, err }
}

func (g *fakeGitHub) GraphQL(_ context.Context, query string, _ gh.Vars) (gh.Response, error) {
	g.mu.Lock()
	g.queries = append(g.queries, query)
	answer := g.graphql
	g.mu.Unlock()

	if answer == nil {
		return gh.Response{}, fmt.Errorf("no reply for the query %q", query)
	}
	return answer(query)
}

func (g *fakeGitHub) REST(_ context.Context, method, endpoint, _ string) (string, error) {
	g.mu.Lock()
	defer g.mu.Unlock()

	g.endpoint = append(g.endpoint, method+" "+endpoint)
	for part, reply := range g.rest {
		if strings.Contains(endpoint, part) {
			return reply.out, reply.err
		}
	}
	return "", fmt.Errorf("no reply for %s", endpoint)
}

// graphQLCalls is how many queries the fake answered.
func (g *fakeGitHub) graphQLCalls() int {
	g.mu.Lock()
	defer g.mu.Unlock()

	return len(g.queries)
}

// restCalls are the REST calls the fake answered, as "METHOD endpoint".
func (g *fakeGitHub) restCalls() []string {
	g.mu.Lock()
	defer g.mu.Unlock()

	return append([]string(nil), g.endpoint...)
}

// threeEnvironments are Development, Staging and Production, with a workflow
// each (10, 20 and 30).
func threeEnvironments() []deploys.Environment {
	return []deploys.Environment{
		{Name: "Development", Branch: "dev", WorkflowID: 10},
		{Name: "Staging", Branch: "staging", WorkflowID: 20},
		{Name: "Production", Branch: "main", WorkflowID: 30},
	}
}

// runsJSON is the answer of a REST call that lists runs, one per entry of runs.
func runsJSON(t *testing.T, runs ...map[string]any) string {
	t.Helper()

	out, err := json.Marshal(map[string]any{"workflow_runs": runs})
	if err != nil {
		t.Fatalf("marshal runs: %v", err)
	}
	return string(out)
}

// runJSON is one run as GitHub writes it.
func runJSON(id int, status, conclusion string, createdAt time.Time) map[string]any {
	var concluded any
	if conclusion != "" {
		concluded = conclusion
	}
	return map[string]any{
		"id": id, "workflow_id": 10, "status": status, "conclusion": concluded,
		"head_sha": fmt.Sprintf("sha%d", id), "html_url": fmt.Sprintf("https://github.com/acme/api/actions/runs/%d", id),
		"created_at": createdAt.Format(time.RFC3339), "updated_at": createdAt.Add(time.Minute).Format(time.RFC3339),
	}
}
