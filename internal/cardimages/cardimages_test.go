package cardimages_test

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"

	"github.com/guilhermt/myspec/internal/cardimages"
	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/images"
)

// assets serves the files of a map by path and counts the requests.
func assets(t *testing.T, files map[string][]byte) (*httptest.Server, *atomic.Int32) {
	t.Helper()
	var hits atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		if r.Header.Get("User-Agent") != "MySpec/test" {
			t.Errorf("User-Agent = %q", r.Header.Get("User-Agent"))
		}
		data, ok := files[r.URL.Path]
		if !ok {
			http.NotFound(w, r)
			return
		}
		_, _ = w.Write(data)
	}))
	t.Cleanup(srv.Close)
	return srv, &hits
}

func TestReadDownloadsTheImagesOfABodyIntoTheCache(t *testing.T) {
	t.Parallel()

	srv, _ := assets(t, map[string][]byte{"/a.png": png, "/b.png": png})
	f := newFixture(t, cardimages.Deps{})
	f.github.bodies["owner/name#474"] = img(srv.URL+"/a.png", "First") + img(srv.URL+"/b.png", "")

	got := f.service.Read(t.Context(), []cardimages.Issue{card(474)})

	if len(got.Failures) != 0 {
		t.Fatalf("Failures = %+v", got.Failures)
	}
	if len(got.Images) != 2 {
		t.Fatalf("Images = %+v", got.Images)
	}
	first, second := got.Images[0], got.Images[1]
	if first.Alt != "First" || first.Position != 1 || first.Count != 2 || first.MediaType != images.PNG {
		t.Errorf("first = %+v", first)
	}
	if second.Position != 2 || first.ID == second.ID {
		t.Errorf("second = %+v", second)
	}
	data, mediaType, err := f.service.Data(first.ID)
	if err != nil || mediaType != images.PNG || len(data) != len(png) {
		t.Errorf("Data = %d bytes, %q, %v", len(data), mediaType, err)
	}
	if runtimeIsUnix() {
		info, err := os.Stat(filepath.Join(f.dir, first.ID))
		if err != nil || info.Mode().Perm() != 0o600 {
			t.Errorf("cache file = %v, %v", info, err)
		}
	}
}

func TestReadKeepsTheOrderOfTheIssuesAndReadsARepeatedOneOnce(t *testing.T) {
	t.Parallel()

	srv, hits := assets(t, map[string][]byte{"/a.png": png, "/b.png": append(png, 1)})
	f := newFixture(t, cardimages.Deps{})
	f.github.bodies["owner/name#1"] = img(srv.URL+"/a.png", "")
	f.github.bodies["owner/name#2"] = img(srv.URL+"/b.png", "")
	epic := cardimages.Issue{Owner: "owner", Name: "name", Number: 2, Origin: images.OriginEpic}

	got := f.service.Read(t.Context(), []cardimages.Issue{card(1), epic, card(2), epic})

	if len(got.Images) != 2 || got.Images[0].Issue.Number != 1 || got.Images[1].Issue.Number != 2 {
		t.Fatalf("Images = %+v", got.Images)
	}
	if got.Images[1].Issue.Origin != images.OriginEpic {
		t.Errorf("origin = %q, the first mention should win", got.Images[1].Issue.Origin)
	}
	if hits.Load() != 2 || f.github.queryCount() != 1 {
		t.Errorf("downloads = %d, queries = %d, want 2 and 1", hits.Load(), f.github.queryCount())
	}
}

func TestReadFailuresNameTheirReason(t *testing.T) {
	t.Parallel()

	big := append([]byte("\x89PNG\r\n\x1a\n"), make([]byte, images.MaxSize)...)
	srv, _ := assets(t, map[string][]byte{"/big.png": big, "/doc.pdf": []byte("%PDF-1.7 not an image"), "/ok.png": png})
	f := newFixture(t, cardimages.Deps{})
	f.github.bodies["owner/name#1"] = img(srv.URL+"/missing.png", "gone") + img(srv.URL+"/big.png", "") +
		img(srv.URL+"/doc.pdf", "") + img(srv.URL+"/ok.png", "") + img("http://127.0.0.1:1/x.png", "")

	got := f.service.Read(t.Context(), []cardimages.Issue{card(1)})

	reasons := make([]string, 0, len(got.Failures))
	for _, fl := range got.Failures {
		reasons = append(reasons, fl.Reason)
	}
	want := []string{"the server answered 404", "it's over 20 MB", "it isn't PNG, JPEG, GIF or WebP", "it couldn't be downloaded"}
	if diff := cmp.Diff(want, reasons, cmpopts.SortSlices(func(a, b string) bool { return a < b })); diff != "" {
		t.Errorf("reasons (-want +got):\n%s", diff)
	}
	if len(got.Images) != 1 || got.Images[0].Position != 4 || got.Images[0].Count != 5 {
		t.Errorf("Images = %+v", got.Images)
	}
	if got.Failures[0].URL == "" || got.Failures[0].Alt != "gone" {
		t.Errorf("failure = %+v", got.Failures[0])
	}
}

func TestReadSaysWhyAQueryFailed(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		err  error
		want string
	}{
		{"gh missing", gh.ErrNotFound, "gh isn't installed"},
		{"not signed in", gh.ErrNotAuthenticated, "gh isn't signed in"},
		{"rate limit", &gh.RateLimitError{ResetAt: time.Now()}, "GitHub's rate limit was reached"},
		{"anything else", errors.New("boom"), "GitHub couldn't be read"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			f := newFixture(t, cardimages.Deps{})
			f.github.err = tt.err

			got := f.service.Read(t.Context(), []cardimages.Issue{card(1), card(2)})

			if len(got.Images) != 0 || len(got.Failures) != 2 {
				t.Fatalf("got = %+v", got)
			}
			for _, fl := range got.Failures {
				if fl.URL != "" || fl.Reason != tt.want {
					t.Errorf("failure = %+v, want reason %q", fl, tt.want)
				}
			}
		})
	}
}

func TestReadFailsAnIssueThatDoesNotExistAndKeepsTheOthers(t *testing.T) {
	t.Parallel()

	srv, _ := assets(t, map[string][]byte{"/a.png": png})
	f := newFixture(t, cardimages.Deps{})
	f.github.bodies["owner/name#2"] = img(srv.URL+"/a.png", "")

	got := f.service.Read(t.Context(), []cardimages.Issue{card(1), card(2)})

	if len(got.Images) != 1 || len(got.Failures) != 1 {
		t.Fatalf("got = %+v", got)
	}
	if fl := got.Failures[0]; fl.Issue.Number != 1 || fl.URL != "" || fl.Reason != "the issue wasn't found" {
		t.Errorf("failure = %+v", fl)
	}
}

func TestReadReadsMoreThanABatchOfIssuesInSeveralQueries(t *testing.T) {
	t.Parallel()

	f := newFixture(t, cardimages.Deps{})
	var issues []cardimages.Issue
	for i := 1; i <= 25; i++ {
		issues = append(issues, card(i))
	}

	got := f.service.Read(t.Context(), issues)

	if f.github.queryCount() != 2 || len(got.Failures) != 25 {
		t.Errorf("queries = %d, failures = %d", f.github.queryCount(), len(got.Failures))
	}
}

func TestReadTakesAnImageFromTheCacheWithoutDownloadingAgain(t *testing.T) {
	t.Parallel()

	srv, hits := assets(t, map[string][]byte{"/a.png": png})
	f := newFixture(t, cardimages.Deps{})
	f.github.bodies["owner/name#1"] = img(srv.URL+"/a.png", "")
	first := f.service.Read(t.Context(), []cardimages.Issue{card(1)})

	second := f.service.Read(t.Context(), []cardimages.Issue{card(1)})

	if hits.Load() != 1 {
		t.Errorf("downloads = %d, want 1", hits.Load())
	}
	if diff := cmp.Diff(first, second); diff != "" {
		t.Errorf("reading (-first +second):\n%s", diff)
	}
}

func TestReadTiesAMarkdownAttachmentToTheSignedURLOfTheHTML(t *testing.T) {
	t.Parallel()

	const id = "2e53d98e-1f4c-4b7e-9a01-5d3c7a1b8e22"
	srv, _ := assets(t, map[string][]byte{"/85903764/675031994-" + id + ".png": png})
	f := newFixture(t, cardimages.Deps{})
	// The signed URL lives on the test server, so the key has to come from the
	// canonical source the HTML carries, as it does for an image of camo.
	f.github.bodies["owner/name#1"] = `<img src="` + srv.URL + `/85903764/675031994-` + id + `.png" data-canonical-src="https://github.com/user-attachments/assets/` + id + `" alt="">`
	got := f.service.Read(t.Context(), []cardimages.Issue{card(1)})
	if len(got.Images) != 1 {
		t.Fatalf("got = %+v", got)
	}

	path, err := f.service.Serve(t.Context(), "OWNER/Name#1", "https://github.com/user-attachments/assets/"+id)

	if err != nil || filepath.Base(path) != got.Images[0].ID {
		t.Errorf("Serve = %q, %v, want the cache file %s", path, err, got.Images[0].ID)
	}
}

func TestDataRefusesAnIdThatIsNotACacheFile(t *testing.T) {
	t.Parallel()

	f := newFixture(t, cardimages.Deps{})
	for _, id := range []string{"", "../x", "abc", "0000000000000000000000000000000000000000000000000000000000000000"} {
		if _, _, err := f.service.Data(id); !errors.Is(err, cardimages.ErrNotCached) {
			t.Errorf("Data(%q) error = %v, want ErrNotCached", id, err)
		}
	}
}

func TestServeReadsTheIssueOnDemandAndThenKeepsAnswerFromTheCache(t *testing.T) {
	t.Parallel()

	srv, hits := assets(t, map[string][]byte{"/a.png": png})
	f := newFixture(t, cardimages.Deps{})
	f.github.bodies["owner/name#1"] = img(srv.URL+"/a.png", "")

	path, err := f.service.Serve(t.Context(), "owner/name#1", srv.URL+"/a.png")
	if err != nil {
		t.Fatalf("Serve: %v", err)
	}
	if _, statErr := os.Stat(path); statErr != nil {
		t.Errorf("file: %v", statErr)
	}
	again, err := f.service.Serve(t.Context(), "owner/name#1", srv.URL+"/a.png")

	if err != nil || again != path || hits.Load() != 1 || f.github.queryCount() != 1 {
		t.Errorf("again = %q, %v; downloads = %d, queries = %d", again, err, hits.Load(), f.github.queryCount())
	}
}

func TestServeDoesNotReadAgainAnIssueReadAMomentAgo(t *testing.T) {
	t.Parallel()

	srv, _ := assets(t, map[string][]byte{})
	f := newFixture(t, cardimages.Deps{})
	f.github.bodies["owner/name#1"] = img(srv.URL+"/gone.png", "")
	f.service.Read(t.Context(), []cardimages.Issue{card(1)})

	_, err := f.service.Serve(t.Context(), "owner/name#1", srv.URL+"/gone.png")
	if !errors.Is(err, cardimages.ErrNotCached) || f.github.queryCount() != 1 {
		t.Fatalf("Serve = %v, queries = %d, want ErrNotCached and 1", err, f.github.queryCount())
	}

	*f.now = f.now.Add(6 * time.Minute)
	_, err = f.service.Serve(t.Context(), "owner/name#1", srv.URL+"/gone.png")
	if !errors.Is(err, cardimages.ErrNotCached) || f.github.queryCount() != 2 {
		t.Errorf("after 6 minutes: Serve = %v, queries = %d, want ErrNotCached and 2", err, f.github.queryCount())
	}
}

func TestServeRefusesAMalformedIssueKey(t *testing.T) {
	t.Parallel()

	f := newFixture(t, cardimages.Deps{})
	for _, key := range []string{"", "owner/name", "owner#1", "owner/name#x", "a/b/c#1", "owner/name#0"} {
		if _, err := f.service.Serve(t.Context(), key, "https://x/y.png"); !errors.Is(err, cardimages.ErrNotCached) {
			t.Errorf("Serve(%q) error = %v, want ErrNotCached", key, err)
		}
	}
	if f.github.queryCount() != 0 {
		t.Errorf("queries = %d, want 0", f.github.queryCount())
	}
}

func TestServeAnswersSeveralImagesOfABodyWithOneReading(t *testing.T) {
	t.Parallel()

	srv, _ := assets(t, map[string][]byte{"/a.png": png, "/b.png": png})
	f := newFixture(t, cardimages.Deps{})
	f.github.bodies["owner/name#1"] = img(srv.URL+"/a.png", "") + img(srv.URL+"/b.png", "")
	f.github.started = make(chan struct{}, 2)
	f.github.release = make(chan struct{})

	var wg sync.WaitGroup
	errs := make([]error, 2)
	for i, name := range []string{"/a.png", "/b.png"} {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, errs[i] = f.service.Serve(t.Context(), "owner/name#1", srv.URL+name)
		}()
	}
	<-f.github.started
	// The second call joins the reading in flight rather than starting its own.
	time.Sleep(50 * time.Millisecond)
	close(f.github.release)
	wg.Wait()

	for i, err := range errs {
		if err != nil {
			t.Errorf("Serve %d: %v", i, err)
		}
	}
	if f.github.queryCount() != 1 {
		t.Errorf("queries = %d, want 1", f.github.queryCount())
	}
}

func TestPruneRemovesOldImagesAndLeftoverTemporaryFiles(t *testing.T) {
	t.Parallel()

	f := newFixture(t, cardimages.Deps{})
	if err := os.MkdirAll(f.dir, 0o700); err != nil {
		t.Fatal(err)
	}
	age := func(name string, ago time.Duration) {
		t.Helper()
		path := filepath.Join(f.dir, name)
		if err := os.WriteFile(path, png, 0o600); err != nil {
			t.Fatal(err)
		}
		at := f.now.Add(-ago)
		if err := os.Chtimes(path, at, at); err != nil {
			t.Fatal(err)
		}
	}
	age("old", 31*24*time.Hour)
	age("young", 29*24*time.Hour)
	age(".tmp-stale", 2*time.Hour)
	age(".tmp-writing", time.Minute)

	f.service.Prune()

	entries, err := os.ReadDir(f.dir)
	if err != nil {
		t.Fatal(err)
	}
	left := make([]string, 0, len(entries))
	for _, e := range entries {
		left = append(left, e.Name())
	}
	if diff := cmp.Diff([]string{".tmp-writing", "young"}, left); diff != "" {
		t.Errorf("left (-want +got):\n%s", diff)
	}
}

func TestPruneOfAMissingCacheDoesNothing(t *testing.T) {
	t.Parallel()

	newFixture(t, cardimages.Deps{}).service.Prune()
}
