package cardimages_test

import (
	"context"
	"encoding/json"
	"fmt"
	"runtime"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/guilhermt/myspec/internal/cardimages"
	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/images"
)

// png is the smallest thing images.Sniff takes for a PNG.
var png = append([]byte("\x89PNG\r\n\x1a\n"), make([]byte, 20)...)

// fakeGitHub answers the body query with the bodyHTML it holds per issue key.
type fakeGitHub struct {
	mu      sync.Mutex
	bodies  map[string]string // issue key -> bodyHTML; a missing key is an issue that doesn't exist
	err     error
	queries []string
	started chan struct{} // when set, a query waits on release after signalling
	release chan struct{}
}

func (f *fakeGitHub) GraphQL(_ context.Context, query string, _ gh.Vars) (gh.Response, error) {
	f.mu.Lock()
	f.queries = append(f.queries, query)
	f.mu.Unlock()
	if f.started != nil {
		f.started <- struct{}{}
		<-f.release
	}
	if f.err != nil {
		return gh.Response{}, f.err
	}
	data := map[string]any{}
	for _, line := range strings.Split(query, "\n") {
		alias, rest, ok := strings.Cut(line, ": repository(owner: ")
		if !ok {
			continue
		}
		var owner, name string
		var number int
		if _, err := fmt.Sscanf(rest, "%q, name: %q) { issue(number: %d)", &owner, &name, &number); err != nil {
			return gh.Response{}, err
		}
		key := strings.ToLower(fmt.Sprintf("%s/%s#%d", owner, name, number))
		if body, ok := f.bodies[key]; ok {
			data[alias] = map[string]any{"issue": map[string]any{"bodyHTML": body}}
		} else {
			data[alias] = map[string]any{"issue": nil}
		}
	}
	raw, err := json.Marshal(data)
	return gh.Response{Data: raw}, err
}

func (f *fakeGitHub) queryCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.queries)
}

type fixture struct {
	service *cardimages.Service
	github  *fakeGitHub
	dir     string
	now     *time.Time
}

func newFixture(t *testing.T, client cardimages.Deps) *fixture {
	t.Helper()
	now := time.Date(2026, time.October, 21, 12, 0, 0, 0, time.UTC)
	f := &fixture{github: &fakeGitHub{bodies: map[string]string{}}, dir: t.TempDir() + "/card-images", now: &now}
	client.GitHub = f.github
	client.Dir = f.dir
	client.UserAgent = "MySpec/test"
	client.Now = func() time.Time { return *f.now }
	f.service = cardimages.New(client)
	return f
}

func card(number int) cardimages.Issue {
	return cardimages.Issue{Owner: "Owner", Name: "Name", Number: number, Origin: images.OriginCard}
}

func img(src, alt string) string {
	return fmt.Sprintf(`<p><img src=%q alt=%q></p>`, src, alt)
}

func runtimeIsUnix() bool { return runtime.GOOS != "windows" }
