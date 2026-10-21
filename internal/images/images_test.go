package images_test

import (
	"bytes"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/images"
)

var (
	pngBytes  = append([]byte("\x89PNG\r\n\x1a\n"), make([]byte, 8)...)
	jpegBytes = append([]byte{0xFF, 0xD8, 0xFF, 0xE0}, make([]byte, 12)...)
	gifBytes  = append([]byte("GIF89a"), make([]byte, 8)...)
	webpBytes = append([]byte("RIFF\x00\x00\x00\x00WEBP"), make([]byte, 4)...)
)

func TestSniff(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		data []byte
		want string
		err  error
	}{
		{"png", pngBytes, images.PNG, nil},
		{"jpeg", jpegBytes, images.JPEG, nil},
		{"gif87a", append([]byte("GIF87a"), 0, 0), images.GIF, nil},
		{"gif89a", gifBytes, images.GIF, nil},
		{"webp", webpBytes, images.WebP, nil},
		{"bmp", append([]byte("BM"), make([]byte, 20)...), "", images.ErrFormat},
		{"pdf", []byte("%PDF-1.7\n%abcdef"), "", images.ErrFormat},
		{"riff but not webp", append([]byte("RIFF\x00\x00\x00\x00WAVE"), 0, 0), "", images.ErrFormat},
		{"too few bytes", []byte{0x89}, "", images.ErrFormat},
		{"empty", nil, "", images.ErrFormat},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := images.Sniff(tt.data)
			if got != tt.want || !errors.Is(err, tt.err) {
				t.Errorf("Sniff() = %q, %v, want %q, %v", got, err, tt.want, tt.err)
			}
		})
	}
}

func TestCheck(t *testing.T) {
	t.Parallel()

	pad := func(head []byte, n int) []byte { return append(bytes.Clone(head), make([]byte, n-len(head))...) }

	if got, err := images.Check(pad(pngBytes, images.MaxSize)); got != images.PNG || err != nil {
		t.Errorf("Check(20 MB) = %q, %v, want PNG, nil", got, err)
	}
	if _, err := images.Check(pad(pngBytes, images.MaxSize+1)); !errors.Is(err, images.ErrTooLarge) {
		t.Errorf("Check(20 MB + 1) = %v, want ErrTooLarge", err)
	}
	if _, err := images.Check(make([]byte, images.MaxSize+1)); !errors.Is(err, images.ErrTooLarge) {
		t.Errorf("Check(20 MB + 1 of no format) = %v, want ErrTooLarge: the size comes before the format", err)
	}
}

func TestExt(t *testing.T) {
	t.Parallel()

	for mediaType, want := range map[string]string{images.PNG: ".png", images.JPEG: ".jpg", images.GIF: ".gif", images.WebP: ".webp"} {
		if got := images.Ext(mediaType); got != want {
			t.Errorf("Ext(%q) = %q, want %q", mediaType, got, want)
		}
	}
}

func TestSave(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	saved, err := images.Save(dir, []images.Upload{
		{Image: images.Image{Origin: images.OriginUser}, Data: pngBytes},
		{Image: images.Image{Origin: images.OriginCard, Issue: "o/n#1", Alt: "logo", Position: 1, Count: 2}, Data: jpegBytes},
	})
	if err != nil {
		t.Fatalf("Save() = %v, want nil", err)
	}
	if len(saved) != 2 {
		t.Fatalf("Save() = %d images, want 2", len(saved))
	}
	if saved[0].ID == "" || saved[0].ID == saved[1].ID {
		t.Errorf("ids = %q, %q, want two different ones", saved[0].ID, saved[1].ID)
	}
	want := images.Image{ID: saved[1].ID, MediaType: images.JPEG, Origin: images.OriginCard, Issue: "o/n#1", Alt: "logo", Position: 1, Count: 2}
	if diff := cmp.Diff(want, saved[1]); diff != "" {
		t.Errorf("saved[1] mismatch (-want +got):\n%s", diff)
	}
	if saved[0].MediaType != images.PNG {
		t.Errorf("saved[0].MediaType = %q, want PNG", saved[0].MediaType)
	}

	for i, content := range [][]byte{pngBytes, jpegBytes} {
		path := images.Path(dir, saved[i])
		if want := filepath.Join(dir, "images", saved[i].ID+images.Ext(saved[i].MediaType)); path != want {
			t.Errorf("Path() = %q, want %q", path, want)
		}
		got, readErr := images.Read(dir, saved[i])
		if readErr != nil || !bytes.Equal(got, content) {
			t.Errorf("Read(%d) = %v, %v, want the saved bytes", i, got, readErr)
		}
		info, statErr := os.Stat(path)
		if statErr != nil {
			t.Fatalf("Stat() = %v", statErr)
		}
		if info.Mode().Perm() != 0o600 {
			t.Errorf("file mode = %v, want 0600", info.Mode().Perm())
		}
	}
	info, err := os.Stat(filepath.Join(dir, "images"))
	if err != nil {
		t.Fatalf("Stat(images) = %v", err)
	}
	if info.Mode().Perm() != 0o700 {
		t.Errorf("folder mode = %v, want 0700", info.Mode().Perm())
	}
}

func TestSaveRemovesWhatItWroteWhenOneFails(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	saved, err := images.Save(dir, []images.Upload{{Data: pngBytes}, {Data: []byte("not an image at all")}})
	if saved != nil || !errors.Is(err, images.ErrFormat) {
		t.Fatalf("Save() = %v, %v, want nil, ErrFormat", saved, err)
	}
	if !strings.Contains(err.Error(), "image 2") {
		t.Errorf("error = %q, want the index of the image", err)
	}
	entries, readErr := os.ReadDir(filepath.Join(dir, "images"))
	if readErr != nil || len(entries) != 0 {
		t.Errorf("images/ = %v, %v, want an empty folder", entries, readErr)
	}
}

func TestSaveRefusesALargeImage(t *testing.T) {
	t.Parallel()

	_, err := images.Save(t.TempDir(), []images.Upload{{Data: make([]byte, images.MaxSize+1)}})
	if !errors.Is(err, images.ErrTooLarge) {
		t.Errorf("Save() = %v, want ErrTooLarge", err)
	}
}

func TestSaveWithoutUploadsCreatesNothing(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	if saved, err := images.Save(dir, nil); saved != nil || err != nil {
		t.Errorf("Save(nil) = %v, %v, want nil, nil", saved, err)
	}
	if _, err := os.Stat(filepath.Join(dir, "images")); !os.IsNotExist(err) {
		t.Errorf("Stat(images) = %v, want not exist", err)
	}
}

func TestRemoveIgnoresAFileThatIsGone(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	saved, err := images.Save(dir, []images.Upload{{Data: pngBytes}, {Data: gifBytes}})
	if err != nil {
		t.Fatalf("Save() = %v", err)
	}
	if err := os.Remove(images.Path(dir, saved[0])); err != nil {
		t.Fatalf("Remove() = %v", err)
	}

	images.Remove(dir, saved)

	for _, img := range saved {
		if _, err := os.Stat(images.Path(dir, img)); !os.IsNotExist(err) {
			t.Errorf("Stat(%s) = %v, want not exist", img.ID, err)
		}
	}
}

func TestLabel(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		n    int
		img  images.Image
		want string
	}{
		{"user", 3, images.Image{Origin: images.OriginUser}, "Image 3: attached by the user."},
		{"card", 1, images.Image{Origin: images.OriginCard, Issue: "owner/name#474", Position: 1, Count: 2}, "Image 1: image 1 of 2 in the body of the card owner/name#474."},
		{"epic", 2, images.Image{Origin: images.OriginEpic, Issue: "owner/name#470", Position: 1, Count: 1}, "Image 2: image 1 of 1 in the body of the epic owner/name#470."},
		{"card with alt", 1, images.Image{Origin: images.OriginCard, Issue: "owner/name#474", Position: 1, Count: 2, Alt: "Logo do MySpec"}, `Image 1: image 1 of 2 in the body of the card owner/name#474 (alt text: "Logo do MySpec").`},
		{"user with alt", 1, images.Image{Origin: images.OriginUser, Alt: "x"}, `Image 1: attached by the user (alt text: "x").`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := images.Label(tt.n, tt.img); got != tt.want {
				t.Errorf("Label() = %q, want %q", got, tt.want)
			}
		})
	}
}
