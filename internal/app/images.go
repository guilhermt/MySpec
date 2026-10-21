package app

import (
	"bytes"
	"errors"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/cardimages"
	"github.com/guilhermt/myspec/internal/images"
)

// itemPattern and filePattern are all a request path may name: an item is a
// UUID and an image file is the id of the image with its extension, so nothing
// of a request reaches the disk outside the folders of the images.
var (
	itemPattern = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
	filePattern = regexp.MustCompile(`^[0-9a-f-]{36}\.(png|jpg|gif|webp)$`)
	cardPattern = regexp.MustCompile(`^[0-9a-f]{64}$`)
)

// imageFiles is what the image middleware reads from: where the images of an
// item are, and the cache of the images of the cards. Set once the services are up.
type imageFiles struct {
	artifactsDir func(itemID string) (string, bool)
	cards        *cardimages.Service
}

// artifactsDirOf is the artifacts folder of a task, a review of a pull request
// or a discussion, active or archived.
func (a *App) artifactsDirOf(itemID string) (string, bool) {
	if t, ok := a.tasks.Lookup(itemID); ok {
		return t.ArtifactsDir, true
	}
	if r, ok := a.prReviews.Lookup(itemID); ok {
		return r.ArtifactsDir, true
	}
	if d, ok := a.discussions.Lookup(itemID); ok {
		return d.ArtifactsDir, true
	}
	return "", false
}

// imagesMiddleware serves the images of the conversations and of the cards to
// the webview, and passes every other request on.
func (a *App) imagesMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		switch {
		case strings.HasPrefix(path, bindings.ImagesRoute), strings.HasPrefix(path, bindings.CardImagesRoute):
		default:
			next.ServeHTTP(w, r)
			return
		}
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		files := a.images.Load()
		if files == nil {
			http.Error(w, "not ready", http.StatusServiceUnavailable)
			return
		}
		if strings.HasPrefix(path, bindings.ImagesRoute) {
			files.serveItemImage(w, r, strings.TrimPrefix(path, bindings.ImagesRoute))
			return
		}
		files.serveCardImage(w, r, strings.TrimPrefix(path, bindings.CardImagesRoute))
	})
}

// serveItemImage serves <item>/<file>, an image stored with an item.
func (f *imageFiles) serveItemImage(w http.ResponseWriter, r *http.Request, rest string) {
	item, file, ok := strings.Cut(rest, "/")
	if !ok || !itemPattern.MatchString(item) || !filePattern.MatchString(file) {
		http.NotFound(w, r)
		return
	}
	dir, ok := f.artifactsDir(item)
	if !ok {
		http.NotFound(w, r)
		return
	}
	//nolint:gosec // G703: item and file matched strict patterns above, so they name only an image in the folder of the item.
	data, err := os.ReadFile(filepath.Join(dir, images.DirName, file))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", mime.TypeByExtension(filepath.Ext(file)))
	w.Header().Set("Cache-Control", "private, max-age=31536000, immutable")
	http.ServeContent(w, r, "", time.Time{}, bytes.NewReader(data))
}

// serveCardImage serves an image of a card: from the cache by id, or the one
// the body of an issue shows, by issue and source.
func (f *imageFiles) serveCardImage(w http.ResponseWriter, r *http.Request, rest string) {
	if rest == "body" {
		query := r.URL.Query()
		path, err := f.cards.Serve(r.Context(), query.Get("issue"), query.Get("src"))
		if err != nil {
			notCached(w, r, err)
			return
		}
		//nolint:gosec // G703: path is a file of the cache, named by a hash that Serve computed.
		data, err := os.ReadFile(path)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		mediaType, err := images.Sniff(data)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", mediaType)
		w.Header().Set("Cache-Control", "private, max-age=300")
		http.ServeContent(w, r, "", time.Time{}, bytes.NewReader(data))
		return
	}
	if !cardPattern.MatchString(rest) {
		http.NotFound(w, r)
		return
	}
	data, mediaType, err := f.cards.Data(rest)
	if err != nil {
		notCached(w, r, err)
		return
	}
	w.Header().Set("Content-Type", mediaType)
	w.Header().Set("Cache-Control", "private, max-age=86400")
	http.ServeContent(w, r, "", time.Time{}, bytes.NewReader(data))
}

// notCached answers an image the cache doesn't have: 404, and 500 for any
// other failure.
func notCached(w http.ResponseWriter, r *http.Request, err error) {
	if errors.Is(err, cardimages.ErrNotCached) {
		http.NotFound(w, r)
		return
	}
	http.Error(w, "the image couldn't be read", http.StatusInternalServerError)
}
