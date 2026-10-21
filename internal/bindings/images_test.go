package bindings_test

import (
	"encoding/base64"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/images"
	"github.com/guilhermt/myspec/internal/session"
)

// pngBytes is the smallest thing the product takes for a PNG; the marker tells
// two images apart.
func pngBytes(marker byte) []byte {
	return append([]byte("\x89PNG\r\n\x1a\n"), marker, marker, marker)
}

func encoded(data []byte) string { return base64.StdEncoding.EncodeToString(data) }

// imageServer serves one PNG per path, each with its own bytes.
func imageServer(t *testing.T, files map[string][]byte) *httptest.Server {
	t.Helper()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		data, ok := files[r.URL.Path]
		if !ok {
			http.NotFound(w, r)
			return
		}
		_, _ = w.Write(data)
	}))
	t.Cleanup(srv.Close)
	return srv
}

// bodyOf is the bodyHTML of an issue with one image.
func bodyOf(src, alt string) string {
	return fmt.Sprintf(`{"issue":{"bodyHTML":%q}}`, fmt.Sprintf(`<p><img src=%q alt=%q></p>`, src, alt))
}

func TestSendMessageTakesBase64ImagesAndTheConversationLoadsThemByURL(t *testing.T) {
	t.Parallel()

	f, _, id := createdTask(t)

	if err := f.tasks.SendMessage(id, "prd", "see this", []string{encoded(pngBytes(1))}); err != nil {
		t.Fatalf("SendMessage() = %v, want nil", err)
	}

	transcript, err := f.tasks.GetTranscript(id, "prd")
	if err != nil {
		t.Fatalf("GetTranscript() = %v, want nil", err)
	}
	var got *bindings.UserEntry
	for _, entry := range transcript.Entries {
		if entry.User != nil && entry.User.Text == "see this" {
			got = entry.User
		}
	}
	if got == nil || len(got.Images) != 1 {
		t.Fatalf("user entry = %+v, want one image", got)
	}
	img := got.Images[0]
	if want := bindings.ImagesRoute + id + "/" + img.ID + ".png"; img.URL != want {
		t.Errorf("url = %q, want %q", img.URL, want)
	}
	if img.Origin != "user" || img.Issue != "" || img.Number != 0 {
		t.Errorf("image = %+v, want one the user attached", img)
	}
	created, _ := f.taskSvc.Get(id)
	if _, err := os.Stat(filepath.Join(created.ArtifactsDir, images.DirName, img.ID+".png")); err != nil {
		t.Errorf("the image was not stored: %v", err)
	}
}

func TestSendMessageRefusesWhatIsNotAnImage(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		images []string
		want   string
	}{
		{"not base64", []string{"***"}, "An image isn't PNG, JPEG, GIF or WebP."},
		{"not an image", []string{encoded([]byte("BM and some more bytes"))}, "An image isn't PNG, JPEG, GIF or WebP."},
		{"over 20 MB", []string{encoded(append(pngBytes(1), make([]byte, images.MaxSize)...))}, "An image is over 20 MB."},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			f, _, id := createdTask(t)

			err := f.tasks.SendMessage(id, "prd", "see this", tt.images)

			if err == nil || err.Error() != tt.want {
				t.Errorf("SendMessage() = %v, want %q", err, tt.want)
			}
			if f.logged(t, "binding failed") {
				t.Error("a refusal the user can read was logged as a failure")
			}
		})
	}
}

func TestFromEntryGivesEachImageItsURL(t *testing.T) {
	t.Parallel()

	got := bindings.FromEntry("task-1", session.Entry{Kind: session.KindUser, User: &session.UserEntry{
		Text: "hi",
		Images: []images.Image{
			{ID: "a1", MediaType: images.JPEG, Origin: images.OriginUser},
			{ID: "b2", MediaType: images.PNG, Origin: images.OriginCard, Issue: "dev/web#474", Alt: "Logo", Position: 1, Count: 2},
		},
	}})

	want := []bindings.Image{
		{ID: "a1", URL: "/myspec/images/task-1/a1.jpg", Origin: "user"},
		{ID: "b2", URL: "/myspec/images/task-1/b2.png", Origin: "card", Issue: "dev/web#474", Number: 474, Alt: "Logo"},
	}
	if diff := cmp.Diff(want, got.User.Images); diff != "" {
		t.Errorf("images mismatch (-want +got):\n%s", diff)
	}
	if none := bindings.FromEntry("task-1", session.Entry{Kind: session.KindUser, User: &session.UserEntry{}}); none.User.Images == nil {
		t.Error("an entry without images has nil Images, want an empty list")
	}
}

func TestCardImagesReadsTheCardAndItsEpic(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())
	f.registerBoard(t, true, webCard(12))
	srv := imageServer(t, map[string][]byte{"/card.png": pngBytes(1), "/epic.png": pngBytes(2)})
	f.github.reply(`{"i0":` + bodyOf(srv.URL+"/card.png", "Card shot") + `,"i1":` + bodyOf(srv.URL+"/epic.png", "") + `}`)

	got, err := f.boardService.CardImages(testBoardID, []string{"dev/web#12"})
	if err != nil {
		t.Fatalf("CardImages() = %v, want nil", err)
	}

	if len(got.Images) != 2 || len(got.Failures) != 0 {
		t.Fatalf("CardImages() = %+v, want two images and no failure", got)
	}
	card, epic := got.Images[0], got.Images[1]
	if card.Origin != "card" || card.Issue != "dev/web#12" || card.Number != 12 || card.Alt != "Card shot" || card.Position != 1 || card.Count != 1 {
		t.Errorf("card image = %+v, want the one of dev/web#12", card)
	}
	if epic.Origin != "epic" || epic.Issue != "dev/web#1" || epic.Number != 1 {
		t.Errorf("epic image = %+v, want the one of dev/web#1", epic)
	}
	if want := bindings.CardImagesRoute + card.ID; card.URL != want {
		t.Errorf("url = %q, want %q", card.URL, want)
	}
}

func TestCardImagesKeepsFailuresInTheAnswer(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())
	f.registerBoard(t, true, webCard(12))
	srv := imageServer(t, nil)
	f.github.reply(`{"i0":` + bodyOf(srv.URL+"/gone.png", "Gone") + `,"i1":{"issue":null}}`)

	got, err := f.boardService.CardImages(testBoardID, []string{"dev/web#12"})
	if err != nil {
		t.Fatalf("CardImages() = %v, want nil", err)
	}

	if got.Images == nil || len(got.Images) != 0 {
		t.Errorf("images = %#v, want an empty list", got.Images)
	}
	if len(got.Failures) != 2 {
		t.Fatalf("failures = %+v, want the image and the epic", got.Failures)
	}
	for _, failure := range got.Failures {
		switch failure.Origin {
		case "card":
			if failure.Alt != "Gone" || failure.URL == "" || failure.Reason != "the server answered 404" {
				t.Errorf("failure = %+v, want the 404 of the image", failure)
			}
		case "epic":
			if failure.URL != "" || failure.Reason != "the issue wasn't found" {
				t.Errorf("failure = %+v, want the epic not found", failure)
			}
		default:
			t.Errorf("failure = %+v, want one of the card or of the epic", failure)
		}
	}
}

func TestCardImagesRefusesAKeyOutsideTheReading(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())
	f.registerBoard(t, true, webCard(12))

	_, err := f.boardService.CardImages(testBoardID, []string{"dev/web#99"})

	if want := "This card isn't in the last reading of the board."; err == nil || err.Error() != want {
		t.Errorf("CardImages() = %v, want %q", err, want)
	}
}

func TestCreateTaskFromACardStoresTheImagesOfTheCardThenTheUsers(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())
	f.registerBoard(t, true, webCard(12))
	srv := imageServer(t, map[string][]byte{"/card.png": pngBytes(1), "/epic.png": pngBytes(2)})
	f.github.reply(`{"i0":` + bodyOf(srv.URL+"/card.png", "Card shot") + `,"i1":` + bodyOf(srv.URL+"/epic.png", "") + `}`)
	read, err := f.boardService.CardImages(testBoardID, []string{"dev/web#12"})
	if err != nil {
		t.Fatalf("CardImages() = %v, want nil", err)
	}
	req := cardTask("12-add-the-login-screen", 12)
	req.CardImages = read.Images
	req.Images = []string{encoded(pngBytes(3))}

	id, err := f.tasks.CreateTask(req)
	if err != nil {
		t.Fatalf("CreateTask() = %v, want nil", err)
	}

	created, _ := f.taskSvc.Get(id)
	origins := make([]images.Origin, 0, len(created.InitialImages))
	for _, img := range created.InitialImages {
		origins = append(origins, img.Origin)
	}
	if want := []images.Origin{images.OriginCard, images.OriginEpic, images.OriginUser}; !cmp.Equal(origins, want) {
		t.Fatalf("origins = %v, want %v", origins, want)
	}
	first := created.InitialImages[0]
	if first.Issue != "dev/web#12" || first.Alt != "Card shot" || first.Position != 1 || first.Count != 1 {
		t.Errorf("first image = %+v, want the record of the card", first)
	}
	for i, img := range created.InitialImages {
		data, err := images.Read(created.ArtifactsDir, img)
		if err != nil || len(data) != 11 || data[8] != byte(i+1) {
			t.Errorf("image %d = %v, %v, want the bytes of its source", i+1, data, err)
		}
	}
}

func TestCreateTaskLeavesOutACardImageTheCacheLost(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())
	f.registerBoard(t, true, webCard(12))
	req := cardTask("12-add-the-login-screen", 12)
	req.CardImages = []bindings.CardImage{{ID: strings.Repeat("a", 64), Origin: "card", Issue: "dev/web#12"}}
	req.Images = []string{encoded(pngBytes(3))}

	id, err := f.tasks.CreateTask(req)
	if err != nil {
		t.Fatalf("CreateTask() = %v, want nil", err)
	}

	created, _ := f.taskSvc.Get(id)
	if len(created.InitialImages) != 1 || created.InitialImages[0].Origin != images.OriginUser {
		t.Errorf("images = %+v, want only the user's", created.InitialImages)
	}
	if !f.logged(t, "card image left out") {
		t.Error("the image left out was not logged")
	}
}

func TestCreateTaskWithoutACardIgnoresCardImages(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())
	req := newTask("login-screen")
	req.CardImages = []bindings.CardImage{{ID: strings.Repeat("a", 64), Origin: "card"}}

	id, err := f.tasks.CreateTask(req)
	if err != nil {
		t.Fatalf("CreateTask() = %v, want nil", err)
	}

	if created, _ := f.taskSvc.Get(id); len(created.InitialImages) != 0 {
		t.Errorf("images = %+v, want none", created.InitialImages)
	}
}

func TestCreateTaskRefusesABadImageWithoutCreatingTheTask(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())
	req := newTask("login-screen")
	req.Images = []string{encoded([]byte("not an image at all"))}

	_, err := f.tasks.CreateTask(req)

	if want := "An image isn't PNG, JPEG, GIF or WebP."; err == nil || err.Error() != want {
		t.Errorf("CreateTask() = %v, want %q", err, want)
	}
	if tasks := f.state.GetState().Tasks; len(tasks) != 0 {
		t.Errorf("tasks = %+v, want none created", tasks)
	}
}

func TestStartDiscussionStoresTheImages(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())
	f.registerBoard(t, true, webCard(12))
	srv := imageServer(t, map[string][]byte{"/card.png": pngBytes(1)})
	f.github.reply(`{"i0":` + bodyOf(srv.URL+"/card.png", "") + `,"i1":{"issue":null}}`)
	read, err := f.boardService.CardImages(testBoardID, []string{"dev/web#12"})
	if err != nil {
		t.Fatalf("CardImages() = %v, want nil", err)
	}

	id, err := f.discussionSvc.StartDiscussion(bindings.StartDiscussionRequest{
		BoardID: testBoardID, Title: "Invoices", Text: "Bill them.", Cards: []string{"dev/web#12"},
		Model: "claude-opus-5-5[1m]", Effort: "high",
		Images: []string{encoded(pngBytes(3))}, CardImages: read.Images,
	})
	if err != nil {
		t.Fatalf("StartDiscussion() = %v, want nil", err)
	}

	d, ok := f.discussions.Lookup(id)
	if !ok {
		t.Fatalf("discussion %s was not created", id)
	}
	if len(d.InitialImages) != 2 || d.InitialImages[0].Origin != images.OriginCard || d.InitialImages[1].Origin != images.OriginUser {
		t.Errorf("images = %+v, want the card's then the user's", d.InitialImages)
	}
	for _, img := range d.InitialImages {
		if _, err := os.Stat(images.Path(d.ArtifactsDir, img)); err != nil {
			t.Errorf("image %s was not stored: %v", img.ID, err)
		}
	}
}
