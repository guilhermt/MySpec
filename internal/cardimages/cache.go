package cardimages

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/guilhermt/myspec/internal/images"
)

const (
	// tempPrefix starts the name of a file being written to the cache.
	tempPrefix = ".tmp-"
	// maxAge is how long a cached image lives, from its last write.
	maxAge = 30 * 24 * time.Hour
	// tempMaxAge is how long a temporary file may take to be renamed.
	tempMaxAge = time.Hour
	// freshFor is how long after a reading of an issue a missing image is
	// taken as not in its body, or failed, rather than read again.
	freshFor = 5 * time.Minute
	// serveTimeout bounds the reading Serve does on demand.
	serveTimeout = 2 * time.Minute
)

var idPattern = regexp.MustCompile(`^[0-9a-f]{64}$`)

// cacheID is the name of the cache file of an image of an issue.
func cacheID(issueKey, source string) string {
	sum := sha256.Sum256([]byte(issueKey + "\n" + source))
	return hex.EncodeToString(sum[:])
}

func (s *Service) path(id string) string { return filepath.Join(s.dir, id) }

// cached is the media type of the cache file id, when it is there and is an image.
func (s *Service) cached(id string) (string, bool) {
	f, err := os.Open(s.path(id))
	if err != nil {
		return "", false
	}
	defer func() { _ = f.Close() }()
	head := make([]byte, 12)
	n, _ := io.ReadFull(f, head)
	mediaType, err := images.Sniff(head[:n])
	return mediaType, err == nil
}

// Data is the bytes and the media type of the cached image id.
func (s *Service) Data(id string) ([]byte, string, error) {
	if !idPattern.MatchString(id) {
		return nil, "", ErrNotCached
	}
	data, err := os.ReadFile(s.path(id))
	if err != nil {
		return nil, "", ErrNotCached
	}
	mediaType, err := images.Sniff(data)
	if err != nil {
		return nil, "", ErrNotCached
	}
	return data, mediaType, nil
}

// Serve is the path of the file of the image src of the body of the issue
// issueKey, for the body shown in the panels. An image that isn't cached is
// read on demand, unless the issue was read a moment ago, which means the
// image isn't in the body or failed.
func (s *Service) Serve(ctx context.Context, issueKey, src string) (string, error) {
	issue, ok := parseKey(strings.ToLower(issueKey))
	if !ok {
		return "", ErrNotCached
	}
	path := s.path(cacheID(issue.Key(), sourceKey(src)))
	if exists(path) {
		return path, nil
	}
	s.mu.Lock()
	at, read := s.readAt[issue.Key()]
	s.mu.Unlock()
	if read && s.now().Sub(at) < freshFor {
		return "", ErrNotCached
	}
	// A body with 5 images asks for 5 URLs at once, and one reading serves them
	// all. It outlives the request that started it, which the webview may cancel
	// while the others still wait.
	_, _, _ = s.group.Do(issue.Key(), func() (any, error) {
		readCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), serveTimeout)
		defer cancel()
		return s.Read(readCtx, []Issue{issue}), nil
	})
	if exists(path) {
		return path, nil
	}
	return "", ErrNotCached
}

func exists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.Mode().IsRegular()
}

// Prune removes from the cache the images older than 30 days and the
// temporary files left behind.
func (s *Service) Prune() {
	entries, err := os.ReadDir(s.dir)
	if err != nil {
		return
	}
	now := s.now()
	removed := 0
	for _, e := range entries {
		info, err := e.Info()
		if err != nil || !info.Mode().IsRegular() {
			continue
		}
		limit := maxAge
		if strings.HasPrefix(e.Name(), tempPrefix) {
			limit = tempMaxAge
		}
		if now.Sub(info.ModTime()) <= limit {
			continue
		}
		if err := os.Remove(s.path(e.Name())); err != nil {
			s.log.Warn("card image not pruned", "file", e.Name(), "error", err)
			continue
		}
		removed++
	}
	s.log.Debug("card images pruned", "count", removed)
}
