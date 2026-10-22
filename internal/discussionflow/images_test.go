package discussionflow_test

import (
	"errors"
	"os"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/discussion"
	"github.com/guilhermt/myspec/internal/discussionflow"
	"github.com/guilhermt/myspec/internal/images"
)

var pngData = append([]byte("\x89PNG\r\n\x1a\n"), make([]byte, 60)...)

// pasteImage stores an image the user put in a draft and writes its reference
// in the body of the draft after the text it has.
func pasteImage(t *testing.T, f *fixture, id, draftID string) images.Image {
	t.Helper()

	img, err := f.discussions.SaveDraftImage(id, draftID, pngData)
	if err != nil {
		t.Fatalf("save image of draft %s: %v", draftID, err)
	}
	for _, d := range f.discussions.Drafts(id) {
		if d.ID != draftID {
			continue
		}
		body := d.Body + "\n\n![a screen](" + images.Ref(img) + ")"
		if err := f.discussions.SetDraftText(t.Context(), id, draftID, d.Title, body); err != nil {
			t.Fatalf("set text of draft %s: %v", draftID, err)
		}
	}
	return img
}

func TestAnImagePutInADraftIsUnseenOnce(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, draftsArtifact)
	img := pasteImage(t, f, id, "export-invoices")

	want := []images.Image{{
		ID: img.ID, MediaType: images.PNG, Origin: images.OriginDraft, Draft: "export-invoices", Alt: "a screen",
	}}
	if diff := cmp.Diff(want, f.flow.UnseenDraftImages(t.Context(), id)); diff != "" {
		t.Errorf("unseen images mismatch (-want +got):\n%s", diff)
	}

	// A second draft with the same file doesn't repeat it.
	for _, d := range f.discussions.Drafts(id) {
		if d.ID == "invoice-schema" {
			body := "![again](" + images.Ref(img) + ")"
			if err := f.discussions.SetDraftText(t.Context(), id, d.ID, d.Title, body); err != nil {
				t.Fatalf("set text: %v", err)
			}
		}
	}
	if got := f.flow.UnseenDraftImages(t.Context(), id); len(got) != 1 {
		t.Errorf("unseen images = %+v, want the file once", got)
	}
}

func TestAnImageAlreadyInTheConversationIsNotUnseen(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, draftsArtifact)
	img := pasteImage(t, f, id, "export-invoices")

	f.sessions.say(id, img)

	if got := f.flow.UnseenDraftImages(t.Context(), id); len(got) != 0 {
		t.Errorf("unseen images = %+v, want none after the agent got it", got)
	}
}

func TestAnImageOfTheInitialContextIsNotUnseen(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id, err := f.flow.Start(t.Context(), discussionflow.StartParams{
		BoardID: boardID, Title: "Invoices", Text: "Export invoices", Cards: []string{cardKey},
		Images: []images.Upload{{Image: images.Image{Origin: images.OriginUser}, Data: pngData}},
	})
	if err != nil {
		t.Fatalf("start discussion: %v", err)
	}
	f.record(id, draftsArtifact)
	initial := f.state(id).Discussion.InitialImages
	if len(initial) != 1 {
		t.Fatalf("initial images = %+v, want one", initial)
	}
	for _, d := range f.discussions.Drafts(id) {
		if d.ID != "export-invoices" {
			continue
		}
		body := d.Body + "\n\n![shot](" + images.Ref(initial[0]) + ")"
		if err := f.discussions.SetDraftText(t.Context(), id, d.ID, d.Title, body); err != nil {
			t.Fatalf("set text: %v", err)
		}
	}

	if got := f.flow.UnseenDraftImages(t.Context(), id); len(got) != 0 {
		t.Errorf("unseen images = %+v, want none for an initial image", got)
	}
}

func TestAnImageOfAPublishedDraftIsIgnored(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, draftsArtifact)
	pasteImage(t, f, id, "export-invoices")
	err := f.discussions.RecordPublication(t.Context(), id, "export-invoices", func(d *discussion.Draft) {
		d.Published.Outcome = discussion.OutcomeCreated
		d.Published.Number = 7
	})
	if err != nil {
		t.Fatalf("record publication: %v", err)
	}

	if got := f.flow.UnseenDraftImages(t.Context(), id); len(got) != 0 {
		t.Errorf("unseen images = %+v, want none from a published draft", got)
	}
}

func TestAMissingImageFileIsIgnored(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, draftsArtifact)
	img := pasteImage(t, f, id, "export-invoices")
	stored, _ := f.discussions.Get(id)
	if err := os.Remove(images.Path(stored.ArtifactsDir, img)); err != nil {
		t.Fatalf("remove image: %v", err)
	}

	if got := f.flow.UnseenDraftImages(t.Context(), id); len(got) != 0 {
		t.Errorf("unseen images = %+v, want none for a file that is gone", got)
	}
}

func TestUnseenImagesAreNoneWhenTheConversationCannotBeRead(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, draftsArtifact)
	pasteImage(t, f, id, "export-invoices")
	f.sessions.transcriptErr = errors.New("session: unreadable")

	if got := f.flow.UnseenDraftImages(t.Context(), id); got != nil {
		t.Errorf("unseen images = %+v, want nil", got)
	}
	if got := f.flow.UnseenDraftImages(t.Context(), "nope"); got != nil {
		t.Errorf("unseen images of an unknown discussion = %+v, want nil", got)
	}
}
