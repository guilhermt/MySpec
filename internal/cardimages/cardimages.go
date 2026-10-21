// Package cardimages reads the images of the body of a card and of its epic.
// The Markdown body points to https://github.com/user-attachments/assets/<uuid>,
// which a private repository only opens with the cookie of the browser, so the
// package reads the bodyHTML of the issue through gh, which carries each image
// with a signed URL that downloads without authentication for a few minutes,
// and downloads it at once into a cache on disk.
package cardimages

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/images"
)

// ErrNotCached is an image that isn't in the cache and can't be had: it isn't
// in the body, it failed to download, or the id or the key is malformed.
var ErrNotCached = errors.New("the image isn't in the cache")

// GraphQL is gh.Runner.GraphQL.
type GraphQL interface {
	GraphQL(ctx context.Context, query string, vars gh.Vars) (gh.Response, error)
}

// Issue is an issue whose body the images are read from.
type Issue struct {
	Owner, Name string
	Number      int
	Origin      images.Origin // card or epic
}

// Key is owner/name#number in lower case, as task.IssueKey.
func (i Issue) Key() string {
	return strings.ToLower(i.Owner + "/" + i.Name + "#" + strconv.Itoa(i.Number))
}

// parseKey is the issue a key names, without an origin.
func parseKey(key string) (Issue, bool) {
	repo, num, ok := strings.Cut(key, "#")
	if !ok {
		return Issue{}, false
	}
	owner, name, ok := strings.Cut(repo, "/")
	if !ok || owner == "" || name == "" || strings.Contains(name, "/") {
		return Issue{}, false
	}
	number, err := strconv.Atoi(num)
	if err != nil || number <= 0 {
		return Issue{}, false
	}
	return Issue{Owner: owner, Name: name, Number: number, Origin: images.OriginCard}, true
}

// Image is an image read from the body of an issue and kept in the cache.
type Image struct {
	ID        string // the name of the file in the cache: hex sha256 of the issue key, "\n" and the source key
	Issue     Issue
	MediaType string
	Alt       string
	Position  int // its place among the images of the body, from 1
	Count     int // how many images the body has
}

// Failure is an image of a body that couldn't be read, or, with URL "", a
// body that couldn't be read at all.
type Failure struct {
	Issue  Issue
	URL    string // the src of the image in the body
	Alt    string
	Reason string // a clause in lower case: "it's over 20 MB"
}

// Reading is what reading the images of some issues gave.
type Reading struct {
	Images   []Image
	Failures []Failure
}

// Deps are what a Service needs.
type Deps struct {
	GitHub    GraphQL
	Client    *http.Client // nil is a client over http.DefaultTransport, without a timeout of its own
	Dir       string       // the cache: <data>/card-images
	UserAgent string       // "MySpec/<version>"
	Log       *slog.Logger
	Now       func() time.Time // nil is time.Now
}

// Service reads the images of card bodies and keeps them in the cache.
type Service struct {
	github GraphQL
	client *http.Client
	dir    string
	agent  string
	log    *slog.Logger
	now    func() time.Time

	mu     sync.Mutex
	readAt map[string]time.Time // issue key -> when a reading of it finished
	group  singleflight.Group
}

// New is a Service over d.
func New(d Deps) *Service {
	s := &Service{
		github: d.GitHub,
		client: d.Client,
		dir:    d.Dir,
		agent:  d.UserAgent,
		log:    d.Log,
		now:    d.Now,
		readAt: map[string]time.Time{},
	}
	if s.client == nil {
		s.client = &http.Client{Transport: http.DefaultTransport}
	}
	if s.log == nil {
		s.log = slog.Default()
	}
	if s.now == nil {
		s.now = time.Now
	}
	return s
}
