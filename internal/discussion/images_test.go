package discussion_test

import (
	"errors"
	"os"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/discussion"
	"github.com/guilhermt/myspec/internal/images"
)

const imageID = "0b6c3c1e-2f8a-4c7e-9b1d-2a4f5e6d7c8b"

func TestBodyImagesAreInTheOrderTheyAppearOncePerDestination(t *testing.T) {
	t.Parallel()

	body := "![First](images/" + imageID + ".png) text ![Again](images/" + imageID + ".png)\n\n" +
		"![Second](https://example.com/a.png)"

	got := discussion.BodyImages(body)

	want := []discussion.BodyImage{
		{
			Src: "images/" + imageID + ".png", Alt: "First", Local: true,
			Image: images.Image{ID: imageID, MediaType: "image/png"},
		},
		{Src: "https://example.com/a.png", Alt: "Second"},
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("BodyImages() mismatch (-want +got):\n%s", diff)
	}
}

func TestTheAltOfAnImageIsItsPlainText(t *testing.T) {
	t.Parallel()

	got := discussion.BodyImages("![**a** b](images/" + imageID + ".png)")

	if len(got) != 1 || got[0].Alt != "a b" {
		t.Errorf("BodyImages() = %+v, want one image with the alt %q", got, "a b")
	}
}

func TestAnImageInsideCodeIsText(t *testing.T) {
	t.Parallel()

	body := "```\n![a](images/" + imageID + ".png)\n```\n\nand `![b](images/" + imageID + ".png)` inline"

	if got := discussion.BodyImages(body); len(got) != 0 {
		t.Errorf("BodyImages() = %+v, want none", got)
	}
}

func TestADestinationIsLocalUnlessItIsAURL(t *testing.T) {
	t.Parallel()

	cases := []struct {
		src   string
		local bool
	}{
		{"https://example.com/x.png", false},
		{"//host/x.png", false},
		{"images/" + imageID + ".png", true},
		{"./images/" + imageID + ".png", true},
		{"foo.png", true},
		{`C:\x.png`, true},
	}
	for _, c := range cases {
		t.Run(c.src, func(t *testing.T) {
			t.Parallel()

			got := discussion.BodyImages("![x](<" + c.src + ">)")

			if len(got) != 1 || got[0].Local != c.local {
				t.Errorf("BodyImages(%q) = %+v, want Local %v", c.src, got, c.local)
			}
		})
	}
}

func TestCheckingImagesFindsWhatKeepsAnImageFromGitHub(t *testing.T) {
	t.Parallel()

	d := discussion.Discussion{ArtifactsDir: t.TempDir()}
	present, absent, big := imageFiles(t, d)

	body := present + absent + big + "![odd](foo.png) ![remote](https://example.com/a.png)"
	got := d.DraftImages(body)

	want := []discussion.ImageProblem{
		discussion.ImageOK, discussion.ImageMissing, discussion.ImageTooLarge, discussion.ImageMissing, discussion.ImageOK,
	}
	if len(got) != len(want) {
		t.Fatalf("images = %+v, want %d", got, len(want))
	}
	for i, img := range got {
		if img.Problem != want[i] {
			t.Errorf("problem of %q = %q, want %q", img.Src, img.Problem, want[i])
		}
	}
}

func TestUploadsAreTheLocalImagesWithoutAProblem(t *testing.T) {
	t.Parallel()

	imgs := []discussion.BodyImage{
		{Src: "a", Local: true},
		{Src: "b", Local: true, Problem: discussion.ImageMissing},
		{Src: "https://example.com/c.png"},
	}

	got := discussion.Uploads(imgs)

	if len(got) != 1 || got[0].Src != "a" {
		t.Errorf("Uploads() = %+v, want only a", got)
	}
}

func TestImagesErrorNamesTheFirstProblem(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		imgs []discussion.BodyImage
		want error
	}{
		{"none", []discussion.BodyImage{{Src: "a"}}, nil},
		{"missing first", []discussion.BodyImage{{Problem: discussion.ImageMissing}, {Problem: discussion.ImageTooLarge}}, discussion.ErrImageMissing},
		{"too large", []discussion.BodyImage{{}, {Problem: discussion.ImageTooLarge}}, discussion.ErrImageTooLarge},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()

			if got := discussion.ImagesError(c.imgs); !errors.Is(got, c.want) {
				t.Errorf("ImagesError() = %v, want %v", got, c.want)
			}
		})
	}
}

func TestAnImageIsNamedByItsAltOrItsSrc(t *testing.T) {
	t.Parallel()

	if got := discussion.ImageName(discussion.BodyImage{Src: "images/x.png", Alt: "Print"}); got != `"Print"` {
		t.Errorf("ImageName() = %s, want the alt quoted", got)
	}
	if got := discussion.ImageName(discussion.BodyImage{Src: "images/x.png"}); got != "images/x.png" {
		t.Errorf("ImageName() = %s, want the src", got)
	}
}

// imageFiles puts the files a body can reference in the folder of d and answers
// the Markdown of three images: a present one, one the folder doesn't have and
// one over the limit, the last made by a sparse file.
func imageFiles(t *testing.T, d discussion.Discussion) (present, absent, big string) {
	t.Helper()

	saved, err := images.Save(d.ArtifactsDir, []images.Upload{{Image: images.Image{Origin: images.OriginUser}, Data: pngData}})
	if err != nil {
		t.Fatalf("save: %v", err)
	}
	huge := images.Image{ID: "2b6c3c1e-2f8a-4c7e-9b1d-2a4f5e6d7c8b", MediaType: "image/png"}
	path := images.Path(d.ArtifactsDir, huge)
	if err := os.WriteFile(path, nil, 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}
	if err := os.Truncate(path, images.MaxPublishSize+1); err != nil {
		t.Fatalf("truncate: %v", err)
	}
	return "![a](" + images.Ref(saved[0]) + ")", "![b](images/" + imageID + ".png)", "![c](" + images.Ref(huge) + ")"
}
