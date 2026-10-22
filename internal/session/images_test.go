package session_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/images"
	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/session"
)

var (
	pngImage  = append([]byte("\x89PNG\r\n\x1a\n"), make([]byte, 60)...)
	jpegImage = append([]byte{0xFF, 0xD8, 0xFF, 0xE0}, make([]byte, 10)...)
)

// imageFiles is the names of the files in the images folder of a task.
func imageFiles(t *testing.T, info session.TaskInfo) []string {
	t.Helper()

	entries, err := os.ReadDir(filepath.Join(info.ArtifactsDir, images.DirName))
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		t.Fatalf("ReadDir(images) = %v", err)
	}
	names := make([]string, len(entries))
	for i, e := range entries {
		names[i] = e.Name()
	}
	return names
}

func TestSendWithAnImageStoresItAndHandsItToTheCLIBeforeTheText(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	info := taskInfo(t, "t1")
	f.start(t, info)
	f.waitIdle(t, prd("t1"))

	if err := f.service.Send(t.Context(), prd("t1"), "what is this?", [][]byte{pngImage}, nil); err != nil {
		t.Fatalf("Send() = %v, want nil", err)
	}
	f.waitIdle(t, prd("t1"))

	users := f.entriesOf(t, prd("t1"), session.KindUser)
	if len(users) != 2 || len(users[1].User.Images) != 1 {
		t.Fatalf("users = %+v, want the prompt and a message with one image", users)
	}
	img := users[1].User.Images[0]
	if img.MediaType != images.PNG || img.Origin != images.OriginUser || img.ID == "" {
		t.Errorf("image = %+v, want a user PNG with an id", img)
	}
	if got, err := images.Read(info.ArtifactsDir, img); err != nil || string(got) != string(pngImage) {
		t.Errorf("stored file = %d bytes, %v, want the upload", len(got), err)
	}
	last := f.entriesOf(t, prd("t1"), session.KindAssistant)
	if got, want := last[len(last)-1].Assistant.Text, "[image image/png 68]what is this?"; got != want {
		t.Errorf("the CLI got %q, want %q", got, want)
	}
}

func TestSendWithOnlyAnImageIsAMessage(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	f.start(t, taskInfo(t, "t1"))
	f.waitIdle(t, prd("t1"))

	f.sendImages(t, prd("t1"), "", pngImage, jpegImage)
	f.waitIdle(t, prd("t1"))

	last := f.entriesOf(t, prd("t1"), session.KindAssistant)
	if got, want := last[len(last)-1].Assistant.Text, "[image image/png 68][image image/jpeg 14]"; got != want {
		t.Errorf("the CLI got %q, want %q", got, want)
	}
	wantErrIs(t, f.service.Send(t.Context(), prd("t1"), "  ", nil, nil), session.ErrEmptyMessage)
}

func TestSendRefusesABadImageWithoutQueueingOrStoring(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	info := taskInfo(t, "t1")
	f.start(t, info)
	f.waitIdle(t, prd("t1"))

	err := f.service.Send(t.Context(), prd("t1"), "look", [][]byte{pngImage, []byte("%PDF-1.7 not an image")}, nil)
	wantErrIs(t, err, images.ErrFormat)

	if got := imageFiles(t, info); len(got) != 0 {
		t.Errorf("image files = %v, want none", got)
	}
	if sum := f.summary(t, prd("t1")); sum.PendingCount != 0 {
		t.Errorf("PendingCount = %d, want 0", sum.PendingCount)
	}
	if users := f.entriesOf(t, prd("t1"), session.KindUser); len(users) != 1 {
		t.Errorf("users = %d, want the prompt alone", len(users))
	}
}

func TestSendWithImagesNeedsAFolderForThem(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	info := taskInfo(t, "t1")
	info.ArtifactsDir = ""
	f.start(t, info)
	f.waitIdle(t, prd("t1"))

	wantErrIs(t, f.service.Send(t.Context(), prd("t1"), "look", [][]byte{pngImage}, nil), session.ErrNoImagesFolder)
}

func TestAQueuedMessageWithAnImageGoesOutAtTheEndOfTheTurn(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "slow")
	f.start(t, taskInfo(t, "t1"))
	waitStreaming(t, f, prd("t1"))

	f.sendImages(t, prd("t1"), "queued", pngImage)
	if tr := f.transcript(t, prd("t1")); len(tr.Pending) != 1 || len(tr.Pending[0].User.Images) != 1 {
		t.Fatalf("pending = %+v, want one message with its image", tr.Pending)
	}

	if err := f.service.Interrupt(t.Context(), prd("t1")); err != nil {
		t.Fatalf("Interrupt() = %v, want nil", err)
	}
	f.waitStatus(t, prd("t1"), "the queued message to go out", func(s session.Summary) bool {
		return s.PendingCount == 0 && s.TurnRunning
	})
	users := f.entriesOf(t, prd("t1"), session.KindUser)
	if len(users) != 2 || len(users[1].User.Images) != 1 || users[1].User.Pending {
		t.Errorf("users = %+v, want the queued message delivered with its image", users)
	}
}

func TestRemovePendingDeletesTheImageFiles(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "slow")
	info := taskInfo(t, "t1")
	f.start(t, info)
	waitStreaming(t, f, prd("t1"))

	f.sendImages(t, prd("t1"), "queued", pngImage, jpegImage)
	if got := imageFiles(t, info); len(got) != 2 {
		t.Fatalf("image files = %v, want two", got)
	}
	pending := f.transcript(t, prd("t1")).Pending
	if err := f.service.RemovePending(t.Context(), prd("t1"), pending[0].ID); err != nil {
		t.Fatalf("RemovePending() = %v, want nil", err)
	}
	if got := imageFiles(t, info); len(got) != 0 {
		t.Errorf("image files = %v, want none after the removal", got)
	}
}

func TestStartOfThePRDSendsTheInitialImagesWithTheirLabels(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	info := taskInfo(t, "t1")
	saved, err := images.Save(info.ArtifactsDir, []images.Upload{
		{Image: images.Image{Origin: images.OriginCard, Issue: "dev/web#12", Alt: "login", Position: 1, Count: 1}, Data: pngImage},
		{Image: images.Image{Origin: images.OriginUser}, Data: jpegImage},
		{Image: images.Image{Origin: images.OriginEpic, Issue: "dev/web#10", Position: 1, Count: 1}, Data: pngImage},
	})
	if err != nil {
		t.Fatalf("Save() = %v", err)
	}
	// The second file goes missing: it is left out, the rest go and the
	// numbers count only those that went.
	if err := os.Remove(images.Path(info.ArtifactsDir, saved[1])); err != nil {
		t.Fatalf("Remove() = %v", err)
	}
	info.InitialImages = saved
	f.start(t, info)
	f.waitIdle(t, info.Key())

	users := f.entriesOf(t, info.Key(), session.KindUser)
	if diff := cmp.Diff(saved, users[0].User.Images); diff != "" {
		t.Errorf("prompt entry images mismatch (-want +got):\n%s", diff)
	}
	rendered, _ := renderPrompt(prompts.StagePRD, prompts.Vars{
		TaskName:       info.Name,
		ArtifactsDir:   info.ArtifactsDir,
		PRDPath:        info.PRDPath,
		InitialContext: info.InitialContext,
	})
	assistant := f.entriesOf(t, info.Key(), session.KindAssistant)
	want := images.Label(1, saved[0]) + "[image image/png 68]" + images.Label(2, saved[2]) + "[image image/png 68]" + rendered
	if got := assistant[0].Assistant.Text; got != want {
		t.Errorf("the CLI got %q, want %q", got, want)
	}
}

func TestTheTranscriptDoesNotShareTheImagesOfAnEntry(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	f.start(t, taskInfo(t, "t1"))
	f.waitIdle(t, prd("t1"))
	f.sendImages(t, prd("t1"), "look", pngImage)
	f.waitIdle(t, prd("t1"))

	users := f.entriesOf(t, prd("t1"), session.KindUser)
	users[1].User.Images[0].ID = "changed"

	again := f.entriesOf(t, prd("t1"), session.KindUser)
	if again[1].User.Images[0].ID == "changed" {
		t.Error("a copy of the transcript shares the images of the entry")
	}
}

func TestInADiscussionEveryImageCarriesTheLabelWithItsReference(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	info := atDiscussion(t, taskInfo(t, "d1"))
	saved, err := images.Save(info.ArtifactsDir, []images.Upload{
		{Image: images.Image{Origin: images.OriginCard, Issue: "dev/web#12", Position: 1, Count: 1}, Data: pngImage},
	})
	if err != nil {
		t.Fatalf("Save() = %v", err)
	}
	info.InitialImages = saved
	f.start(t, info)
	f.waitIdle(t, info.Key())
	f.sendImages(t, info.Key(), "look", jpegImage)
	f.waitIdle(t, info.Key())

	users := f.entriesOf(t, info.Key(), session.KindUser)
	sent := users[1].User.Images[0]
	assistant := f.entriesOf(t, info.Key(), session.KindAssistant)
	if got, want := assistant[0].Assistant.Text, images.ReferenceLabel(1, saved[0])+"[image image/png 68]"; !strings.HasPrefix(got, want) {
		t.Errorf("the prompt got %q, want it to start with %q", got, want)
	}
	if got, want := assistant[1].Assistant.Text, images.ReferenceLabel(1, sent)+"[image image/jpeg 14]look"; got != want {
		t.Errorf("the message got %q, want %q", got, want)
	}
}

func TestInATaskAMessageImageHasNoLabel(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	f.start(t, taskInfo(t, "t1"))
	f.waitIdle(t, prd("t1"))
	f.sendImages(t, prd("t1"), "look", pngImage)
	f.waitIdle(t, prd("t1"))

	assistant := f.entriesOf(t, prd("t1"), session.KindAssistant)
	if got, want := assistant[len(assistant)-1].Assistant.Text, "[image image/png 68]look"; got != want {
		t.Errorf("the CLI got %q, want %q", got, want)
	}
}

func TestSendWithStoredImagesRecordsBothListsInOrder(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "echo")
	info := atDiscussion(t, taskInfo(t, "d1"))
	f.start(t, info)
	f.waitIdle(t, info.Key())
	stored, err := images.Save(info.ArtifactsDir, []images.Upload{
		{Image: images.Image{Origin: images.OriginDraft, Draft: "d-1"}, Data: jpegImage},
	})
	if err != nil {
		t.Fatalf("Save() = %v", err)
	}

	if err := f.service.Send(t.Context(), info.Key(), "see", [][]byte{pngImage}, stored); err != nil {
		t.Fatalf("Send() = %v, want nil", err)
	}
	f.waitIdle(t, info.Key())

	got := f.entriesOf(t, info.Key(), session.KindUser)[1].User.Images
	if len(got) != 2 || got[0].Origin != images.OriginUser || got[1].ID != stored[0].ID {
		t.Fatalf("images = %+v, want the upload and then the stored one", got)
	}
	wantErrIs(t, f.service.Send(t.Context(), info.Key(), "", nil, stored), session.ErrEmptyMessage)
}

func TestRemovePendingKeepsTheFileOfADraftImage(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "slow")
	info := atDiscussion(t, taskInfo(t, "d1"))
	f.start(t, info)
	waitStreaming(t, f, info.Key())
	stored, err := images.Save(info.ArtifactsDir, []images.Upload{
		{Image: images.Image{Origin: images.OriginDraft, Draft: "d-1"}, Data: jpegImage},
	})
	if err != nil {
		t.Fatalf("Save() = %v", err)
	}

	if err := f.service.Send(t.Context(), info.Key(), "queued", [][]byte{pngImage}, stored); err != nil {
		t.Fatalf("Send() = %v, want nil", err)
	}
	pending := f.transcript(t, info.Key()).Pending
	if err := f.service.RemovePending(t.Context(), info.Key(), pending[0].ID); err != nil {
		t.Fatalf("RemovePending() = %v, want nil", err)
	}
	if got := imageFiles(t, info); len(got) != 1 || got[0] != filepath.Base(images.Path(info.ArtifactsDir, stored[0])) {
		t.Errorf("image files = %v, want only the one of the draft", got)
	}
}
