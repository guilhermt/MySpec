// Package images is what an image given to the agent is: the formats the
// product takes, the size limit, the record conversations and items keep and
// the files under the artifacts folder of an item.
package images

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/google/uuid"
)

// MaxSize is the most bytes an image may have: a limit of the product, since
// Claude Code shrinks a larger one by itself and the product keeps the original.
const MaxSize = 20 << 20

// DirName is the folder, inside the artifacts folder of an item, that holds its images.
const DirName = "images"

// The media types the product takes, the ones Claude Code reads in a message.
const (
	PNG  = "image/png"
	JPEG = "image/jpeg"
	GIF  = "image/gif"
	WebP = "image/webp"
)

// The reasons an image is refused.
var (
	ErrFormat   = errors.New("the image isn't PNG, JPEG, GIF or WebP")
	ErrTooLarge = errors.New("the image is over 20 MB")
)

// Origin is where an image given to the agent came from.
type Origin string

// The origins of an image.
const (
	OriginUser Origin = "user" // attached by the user
	OriginCard Origin = "card" // read from the body of a card
	OriginEpic Origin = "epic" // read from the body of the epic of a card
)

// Image is an image stored with an item: the file images/<ID><ext> in its
// artifacts folder.
type Image struct {
	ID        string `json:"id"`        // a UUID
	MediaType string `json:"mediaType"` // PNG, JPEG, GIF or WebP
	Origin    Origin `json:"origin"`
	// Issue is the card or the epic it was read from, owner/name#number in
	// lower case (task.IssueKey); "" for one the user attached.
	Issue string `json:"issue,omitempty"`
	// Alt is the alternative text the body gave it; "" without one.
	Alt string `json:"alt,omitempty"`
	// Position is its place among the images of the body, from 1, and Count
	// how many the body has; 0 for one the user attached.
	Position int `json:"position,omitempty"`
	Count    int `json:"count,omitempty"`
}

// Upload is an image to store: what it is, without ID and MediaType, and its bytes.
type Upload struct {
	Image Image
	Data  []byte
}

// Sniff is the media type of data by its first bytes, never by an extension or
// a declared type.
func Sniff(data []byte) (string, error) {
	switch {
	case bytes.HasPrefix(data, []byte("\x89PNG\r\n\x1a\n")):
		return PNG, nil
	case bytes.HasPrefix(data, []byte{0xFF, 0xD8, 0xFF}):
		return JPEG, nil
	case bytes.HasPrefix(data, []byte("GIF87a")), bytes.HasPrefix(data, []byte("GIF89a")):
		return GIF, nil
	case len(data) >= 12 && bytes.Equal(data[0:4], []byte("RIFF")) && bytes.Equal(data[8:12], []byte("WEBP")):
		return WebP, nil
	}
	return "", ErrFormat
}

// Check is Sniff after the size limit: a 30 MB image in an accepted format is
// refused for its size.
func Check(data []byte) (string, error) {
	if len(data) > MaxSize {
		return "", ErrTooLarge
	}
	return Sniff(data)
}

// Ext is the file extension of a media type, with the dot.
func Ext(mediaType string) string {
	switch mediaType {
	case PNG:
		return ".png"
	case JPEG:
		return ".jpg"
	case GIF:
		return ".gif"
	case WebP:
		return ".webp"
	}
	return ""
}

// Path is where the file of img is under the artifacts folder of its item.
func Path(artifactsDir string, img Image) string {
	return filepath.Join(artifactsDir, DirName, img.ID+Ext(img.MediaType))
}

// Save checks and writes each upload as a file of artifactsDir and returns the
// records, with ID and MediaType filled. When one fails, the files this call
// wrote are removed and the error carries the index of the image.
func Save(artifactsDir string, uploads []Upload) ([]Image, error) {
	if len(uploads) == 0 {
		return nil, nil
	}
	saved := make([]Image, 0, len(uploads))
	for i, u := range uploads {
		img, err := saveOne(artifactsDir, u)
		if err != nil {
			Remove(artifactsDir, saved)
			return nil, fmt.Errorf("image %d: %w", i+1, err)
		}
		saved = append(saved, img)
	}
	return saved, nil
}

func saveOne(artifactsDir string, u Upload) (Image, error) {
	mediaType, err := Check(u.Data)
	if err != nil {
		return Image{}, err
	}
	img := u.Image
	img.ID = uuid.NewString()
	img.MediaType = mediaType
	if err := os.MkdirAll(filepath.Join(artifactsDir, DirName), 0o700); err != nil {
		return Image{}, err
	}
	if err := os.WriteFile(Path(artifactsDir, img), u.Data, 0o600); err != nil {
		return Image{}, err
	}
	return img, nil
}

// Remove deletes the file of each image and ignores the ones already gone. The
// caller logs a failure it cares about.
func Remove(artifactsDir string, imgs []Image) {
	for _, img := range imgs {
		_ = os.Remove(Path(artifactsDir, img))
	}
}

// Read is the bytes of the file of img.
func Read(artifactsDir string, img Image) ([]byte, error) {
	return os.ReadFile(Path(artifactsDir, img))
}

// Label is the text that introduces image n (from 1) when it goes to the agent
// with the initial context.
func Label(n int, img Image) string {
	var what string
	switch img.Origin {
	case OriginCard:
		what = fmt.Sprintf("image %d of %d in the body of the card %s", img.Position, img.Count, img.Issue)
	case OriginEpic:
		what = fmt.Sprintf("image %d of %d in the body of the epic %s", img.Position, img.Count, img.Issue)
	default:
		what = "attached by the user"
	}
	if img.Alt != "" {
		what += fmt.Sprintf(" (alt text: %q)", img.Alt)
	}
	return fmt.Sprintf("Image %d: %s.", n, what)
}
