package cardimages

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/net/html"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/images"
)

const (
	// batchSize is how many issues a query reads.
	batchSize = 20
	// maxDownloads is how many images download at the same time.
	maxDownloads = 4
	// downloadTimeout bounds the download of one image.
	downloadTimeout = 60 * time.Second
)

// bodyQuery is the part of the query that reads the body of one issue, under
// the alias i<n>.
const bodyQuery = "i%d: repository(owner: %s, name: %s) { issue(number: %d) { bodyHTML } }\n"

// bodyBatch is the query that reads the bodyHTML of issues, each under its alias.
func bodyBatch(issues []Issue) string {
	var b strings.Builder
	b.WriteString("query {\n")
	for i, is := range issues {
		fmt.Fprintf(&b, bodyQuery, i, strconv.Quote(is.Owner), strconv.Quote(is.Name), is.Number)
	}
	b.WriteString("rateLimit { cost } }\n")
	return b.String()
}

// Read downloads the images of the bodies of issues into the cache. An issue
// that repeats is read once; the images come in the order of the issues and,
// in each, of the body. Only the issues whose body was read count as read for
// Serve.
func (s *Service) Read(ctx context.Context, issues []Issue) Reading {
	var jobs []job
	var reading Reading
	var read []Issue
	for chunk := range slices.Chunk(dedupe(issues), batchSize) {
		bodies, failures := s.readBodies(ctx, chunk)
		reading.Failures = append(reading.Failures, failures...)
		for i, is := range chunk {
			if bodies[i] == nil {
				continue
			}
			read = append(read, is)
			found := imagesOf(*bodies[i])
			for n, f := range found {
				jobs = append(jobs, job{issue: is, found: f, position: n + 1, count: len(found)})
			}
		}
	}
	s.runJobs(ctx, jobs)
	for _, j := range jobs {
		if j.failure != nil {
			reading.Failures = append(reading.Failures, *j.failure)
			continue
		}
		reading.Images = append(reading.Images, j.image)
	}
	now := s.now()
	s.mu.Lock()
	for _, is := range read {
		s.readAt[is.Key()] = now
	}
	s.mu.Unlock()
	return reading
}

// dedupe keeps the first of each issue, by key.
func dedupe(issues []Issue) []Issue {
	seen := map[string]bool{}
	var out []Issue
	for _, is := range issues {
		if seen[is.Key()] {
			continue
		}
		seen[is.Key()] = true
		out = append(out, is)
	}
	return out
}

// readBodies reads the bodyHTML of issues in one query. A body that couldn't be
// read is nil at its index and has a Failure.
func (s *Service) readBodies(ctx context.Context, issues []Issue) ([]*string, []Failure) {
	bodies := make([]*string, len(issues))
	resp, err := s.github.GraphQL(ctx, bodyBatch(issues), gh.Vars{})
	if err != nil {
		s.log.Warn("card bodies not read", "issues", len(issues), "error", err)
		failures := make([]Failure, len(issues))
		for i, is := range issues {
			failures[i] = Failure{Issue: is, Reason: reasonOf(err)}
		}
		return bodies, failures
	}
	var data map[string]json.RawMessage
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		s.log.Warn("card bodies not decoded", "error", err)
		failures := make([]Failure, len(issues))
		for i, is := range issues {
			failures[i] = Failure{Issue: is, Reason: reasonOf(err)}
		}
		return bodies, failures
	}
	var failures []Failure
	for i, is := range issues {
		var result *struct {
			Issue *struct {
				BodyHTML string `json:"bodyHTML"`
			} `json:"issue"`
		}
		if err := json.Unmarshal(data["i"+strconv.Itoa(i)], &result); err != nil || result == nil || result.Issue == nil {
			failures = append(failures, Failure{Issue: is, Reason: "the issue wasn't found"})
			continue
		}
		bodies[i] = &result.Issue.BodyHTML
	}
	return bodies, failures
}

// reasonOf is why a query failed, as the interface says it.
func reasonOf(err error) string {
	switch {
	case errors.Is(err, gh.ErrNotFound):
		return "gh isn't installed"
	case errors.Is(err, gh.ErrNotAuthenticated):
		return "gh isn't signed in"
	case errors.Is(err, gh.ErrRateLimited):
		return "GitHub's rate limit was reached"
	}
	return "GitHub couldn't be read"
}

// found is an <img> of a body.
type found struct {
	src, alt, canonical string
}

// imagesOf is the images of a bodyHTML, in document order. Emoji and sources
// that aren't http or https are left out.
func imagesOf(bodyHTML string) []found {
	doc, err := html.Parse(strings.NewReader(bodyHTML))
	if err != nil {
		return nil
	}
	var out []found
	var walk func(n *html.Node)
	walk = func(n *html.Node) {
		if n.Type == html.ElementNode && n.Data == "img" {
			if f, ok := foundOf(n); ok {
				out = append(out, f)
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(doc)
	return out
}

func foundOf(n *html.Node) (found, bool) {
	var f found
	var class string
	for _, a := range n.Attr {
		switch a.Key {
		case "src":
			f.src = a.Val
		case "alt":
			f.alt = a.Val
		case "data-canonical-src":
			f.canonical = a.Val
		case "class":
			class = a.Val
		}
	}
	if slices.Contains(strings.Fields(class), "emoji") {
		return found{}, false
	}
	if !strings.HasPrefix(f.src, "https://") && !strings.HasPrefix(f.src, "http://") {
		return found{}, false
	}
	return f, true
}

var uuidPattern = regexp.MustCompile(`(?i)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`)

// attachmentHosts are the hosts whose images carry the UUID of the attachment.
var attachmentHosts = []string{"github.com", "user-images.githubusercontent.com", "private-user-images.githubusercontent.com"}

// sourceKey is the key that ties an image of the bodyHTML to the one in the
// Markdown: the UUID of a GitHub attachment, which both URLs carry, or else the
// whole URL.
func sourceKey(src string) string {
	u, err := url.Parse(src)
	if err == nil && slices.Contains(attachmentHosts, strings.ToLower(u.Hostname())) {
		if id := uuidPattern.FindString(u.Path); id != "" {
			return "github:" + strings.ToLower(id)
		}
	}
	return src
}

// job is an image to bring into the cache and what came of it.
type job struct {
	issue           Issue
	found           found
	position, count int

	image   Image
	failure *Failure
}

// runJobs brings each job's image into the cache, a few at a time.
func (s *Service) runJobs(ctx context.Context, jobs []job) {
	sem := make(chan struct{}, maxDownloads)
	var wg sync.WaitGroup
	for i := range jobs {
		wg.Add(1)
		sem <- struct{}{}
		go func() {
			defer func() { <-sem; wg.Done() }()
			s.fetch(ctx, &jobs[i])
		}()
	}
	wg.Wait()
}

// fetch fills the image or the failure of j: from the cache when it is there,
// else from the network.
func (s *Service) fetch(ctx context.Context, j *job) {
	key := j.found.canonical
	if key == "" {
		key = j.found.src
	}
	id := cacheID(j.issue.Key(), sourceKey(key))
	fail := func(reason string) {
		j.failure = &Failure{Issue: j.issue, URL: j.found.src, Alt: j.found.alt, Reason: reason}
	}

	mediaType, ok := s.cached(id)
	if !ok {
		var data []byte
		var reason string
		data, mediaType, reason = s.download(ctx, j.found.src)
		if reason != "" {
			fail(reason)
			return
		}
		if err := s.store(id, data); err != nil {
			s.log.Warn("card image not saved", "issue", j.issue.Key(), "error", err)
			fail("it couldn't be saved")
			return
		}
	}
	j.image = Image{ID: id, Issue: j.issue, MediaType: mediaType, Alt: j.found.alt, Position: j.position, Count: j.count}
}

func reasonOfImage(err error) string {
	if errors.Is(err, images.ErrTooLarge) {
		return "it's over 20 MB"
	}
	return "it isn't PNG, JPEG, GIF or WebP"
}

// download is the bytes at src and their media type, or the reason they
// couldn't be had.
func (s *Service) download(ctx context.Context, src string) ([]byte, string, string) {
	ctx, cancel := context.WithTimeout(ctx, downloadTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, src, nil)
	if err != nil {
		return nil, "", "it couldn't be downloaded"
	}
	req.Header.Set("User-Agent", s.agent)
	resp, err := s.client.Do(req)
	if err != nil {
		s.log.Debug("card image not downloaded", "error", err)
		return nil, "", "it couldn't be downloaded"
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		who := "the server"
		if host := req.URL.Hostname(); strings.HasSuffix(host, "github.com") || strings.HasSuffix(host, "githubusercontent.com") {
			who = "GitHub"
		}
		return nil, "", fmt.Sprintf("%s answered %d", who, resp.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, images.MaxSize+1))
	if err != nil {
		return nil, "", "it couldn't be downloaded"
	}
	mediaType, err := images.Check(data)
	if err != nil {
		return nil, "", reasonOfImage(err)
	}
	return data, mediaType, ""
}

// store writes data as the cache file id, through a temporary file.
func (s *Service) store(id string, data []byte) error {
	if err := os.MkdirAll(s.dir, 0o700); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(s.dir, tempPrefix+"*")
	if err != nil {
		return err
	}
	if _, err := tmp.Write(data); err != nil {
		_ = tmp.Close()
		_ = os.Remove(tmp.Name())
		return err
	}
	if err := tmp.Close(); err != nil {
		_ = os.Remove(tmp.Name())
		return err
	}
	if err := os.Rename(tmp.Name(), s.path(id)); err != nil {
		_ = os.Remove(tmp.Name())
		return err
	}
	return nil
}
