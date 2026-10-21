package app_test

import (
	"crypto/sha256"
	"encoding/hex"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"testing"

	"github.com/guilhermt/myspec/internal/app"
	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/cardimages"
)

const (
	taskItem       = "11111111-1111-4111-8111-111111111111"
	reviewItem     = "22222222-2222-4222-8222-222222222222"
	discussionItem = "33333333-3333-4333-8333-333333333333"
	archivedItem   = "44444444-4444-4444-8444-444444444444"
	imageFile      = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png"
)

var pngBytes = append([]byte("\x89PNG\r\n\x1a\n"), make([]byte, 16)...)

// imagesFixture is the middleware over folders on disk, with the image of every
// item in place and a cache of card images with one image in it.
type imagesFixture struct {
	handler http.Handler
	cache   string
	nexted  bool
}

func newImagesFixture(t *testing.T, ready bool) *imagesFixture {
	t.Helper()
	root := t.TempDir()
	dirs := map[string]string{}
	for _, item := range []string{taskItem, reviewItem, discussionItem, archivedItem} {
		dir := filepath.Join(root, item)
		if err := os.MkdirAll(filepath.Join(dir, "images"), 0o700); err != nil {
			t.Fatalf("create the images folder: %v", err)
		}
		if err := os.WriteFile(filepath.Join(dir, "images", imageFile), pngBytes, 0o600); err != nil {
			t.Fatalf("write the image: %v", err)
		}
		dirs[item] = dir
	}
	// A file next to the images folder must stay out of reach.
	if err := os.WriteFile(filepath.Join(root, taskItem, "secret.png"), pngBytes, 0o600); err != nil {
		t.Fatalf("write the secret: %v", err)
	}
	cache := filepath.Join(root, "card-images")
	if err := os.MkdirAll(cache, 0o700); err != nil {
		t.Fatalf("create the cache: %v", err)
	}
	f := &imagesFixture{cache: cache}
	cards := cardimages.New(cardimages.Deps{Dir: cache, Log: slog.New(slog.DiscardHandler)})
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		f.nexted = true
		w.WriteHeader(http.StatusTeapot)
	})
	f.handler = app.ImagesHandler(next, func(id string) (string, bool) {
		dir, ok := dirs[id]
		return dir, ok
	}, cards, ready)
	return f
}

func (f *imagesFixture) do(method, target string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	f.handler.ServeHTTP(rec, httptest.NewRequest(method, target, nil))
	return rec
}

func (f *imagesFixture) cacheImage(t *testing.T, id string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(f.cache, id), pngBytes, 0o600); err != nil {
		t.Fatalf("write the cached image: %v", err)
	}
}

func TestTheImageMiddlewareServesTheImageOfATaskAReviewAndADiscussionActiveOrArchived(t *testing.T) {
	t.Parallel()
	f := newImagesFixture(t, true)
	for _, item := range []string{taskItem, reviewItem, discussionItem, archivedItem} {
		rec := f.do(http.MethodGet, bindings.ImagesRoute+item+"/"+imageFile)

		if rec.Code != http.StatusOK {
			t.Fatalf("GET image of %s = %d, want 200", item, rec.Code)
		}
		if got := rec.Header().Get("Content-Type"); got != "image/png" {
			t.Errorf("Content-Type = %q, want image/png", got)
		}
		if got := rec.Header().Get("Cache-Control"); got != "private, max-age=31536000, immutable" {
			t.Errorf("Cache-Control = %q, want a year, immutable", got)
		}
		if got := rec.Body.Bytes(); string(got) != string(pngBytes) {
			t.Errorf("body of %s differs from the image on disk", item)
		}
	}
}

func TestTheImageMiddlewareAnswers404ForWhatIsNotAnImage(t *testing.T) {
	t.Parallel()
	f := newImagesFixture(t, true)
	for name, target := range map[string]string{
		"an unknown item":          bindings.ImagesRoute + "55555555-5555-4555-8555-555555555555/" + imageFile,
		"an item that isn't an id": bindings.ImagesRoute + "task/" + imageFile,
		"a missing file":           bindings.ImagesRoute + taskItem + "/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png",
		"an extension":             bindings.ImagesRoute + taskItem + "/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.svg",
		"a parent folder":          bindings.ImagesRoute + taskItem + "/../secret.png",
		"an encoded parent":        bindings.ImagesRoute + taskItem + "/..%2Fsecret.png",
		"a deeper path":            bindings.ImagesRoute + taskItem + "/images/" + imageFile,
		"no file":                  bindings.ImagesRoute + taskItem,
		"a card id too short":      bindings.CardImagesRoute + "abc",
		"a card id with dots":      bindings.CardImagesRoute + "../" + imageFile,
		"a card id not cached":     bindings.CardImagesRoute + hex.EncodeToString(make([]byte, 32)),
	} {
		if rec := f.do(http.MethodGet, target); rec.Code != http.StatusNotFound {
			t.Errorf("GET %s (%s) = %d, want 404", name, target, rec.Code)
		}
	}
}

func TestTheImageMiddlewareAnswers405ForAnythingButGetAndHead(t *testing.T) {
	t.Parallel()
	f := newImagesFixture(t, true)

	for _, target := range []string{bindings.ImagesRoute + taskItem + "/" + imageFile, bindings.CardImagesRoute + "body"} {
		if rec := f.do(http.MethodPost, target); rec.Code != http.StatusMethodNotAllowed {
			t.Errorf("POST %s = %d, want 405", target, rec.Code)
		}
	}
	if rec := f.do(http.MethodHead, bindings.ImagesRoute+taskItem+"/"+imageFile); rec.Code != http.StatusOK {
		t.Errorf("HEAD = %d, want 200", rec.Code)
	}
}

func TestTheImageMiddlewareAnswers503BeforeTheAppIsReady(t *testing.T) {
	t.Parallel()
	f := newImagesFixture(t, false)

	for _, target := range []string{bindings.ImagesRoute + taskItem + "/" + imageFile, bindings.CardImagesRoute + "body"} {
		if rec := f.do(http.MethodGet, target); rec.Code != http.StatusServiceUnavailable {
			t.Errorf("GET %s = %d, want 503", target, rec.Code)
		}
	}
}

func TestTheImageMiddlewarePassesOtherRequestsOn(t *testing.T) {
	t.Parallel()
	for _, ready := range []bool{true, false} {
		f := newImagesFixture(t, ready)

		rec := f.do(http.MethodPost, "/wails/runtime")

		if !f.nexted || rec.Code != http.StatusTeapot {
			t.Errorf("ready=%v: request outside the routes: next called = %v, code = %d, want next", ready, f.nexted, rec.Code)
		}
	}
}

func TestTheImageMiddlewareServesTheImagesOfTheCardsFromTheCache(t *testing.T) {
	t.Parallel()
	f := newImagesFixture(t, true)
	id := hex.EncodeToString(make([]byte, 32))
	f.cacheImage(t, id)

	rec := f.do(http.MethodGet, bindings.CardImagesRoute+id)

	if rec.Code != http.StatusOK || rec.Header().Get("Content-Type") != "image/png" {
		t.Fatalf("GET card image = %d %q, want 200 image/png", rec.Code, rec.Header().Get("Content-Type"))
	}
	if got := rec.Header().Get("Cache-Control"); got != "private, max-age=86400" {
		t.Errorf("Cache-Control = %q, want a day", got)
	}
}

func TestTheImageMiddlewareServesTheImageOfACardBody(t *testing.T) {
	t.Parallel()
	f := newImagesFixture(t, true)
	const issue, src = "acme/web#7", "https://example.com/a.png"
	sum := sha256.Sum256([]byte(issue + "\n" + src))
	f.cacheImage(t, hex.EncodeToString(sum[:]))
	query := url.Values{"issue": {issue}, "src": {src}}.Encode()

	rec := f.do(http.MethodGet, bindings.CardImagesRoute+"body?"+query)

	if rec.Code != http.StatusOK || rec.Header().Get("Content-Type") != "image/png" {
		t.Fatalf("GET body image = %d %q, want 200 image/png", rec.Code, rec.Header().Get("Content-Type"))
	}
	if got := rec.Header().Get("Cache-Control"); got != "private, max-age=300" {
		t.Errorf("Cache-Control = %q, want 5 minutes", got)
	}
	if rec := f.do(http.MethodGet, bindings.CardImagesRoute+"body?issue=nonsense&src="+url.QueryEscape(src)); rec.Code != http.StatusNotFound {
		t.Errorf("GET body image of a malformed issue = %d, want 404", rec.Code)
	}
}
