package discussion

import (
	"net/url"
	"os"
	"strconv"
	"strings"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/text"

	"github.com/guilhermt/myspec/internal/images"
)

// ImageProblem is what keeps an image of a draft from GitHub; "" for none.
type ImageProblem string

// The problems an image of a draft can have.
const (
	ImageOK       ImageProblem = ""
	ImageMissing  ImageProblem = "missing"   // a file the discussion doesn't have
	ImageTooLarge ImageProblem = "too_large" // over images.MaxPublishSize
)

// BodyImage is an image of the body of a draft, once per destination.
type BodyImage struct {
	Src     string       // the destination as the body writes it
	Alt     string       // the plain text of the alternative text
	Local   bool         // a path, not a URL: a file of the discussion or nothing
	Image   images.Image // ID and MediaType of the file Src names; zero when Src names none
	Problem ImageProblem
}

// BodyImages are the images of a Markdown body, in the order they first appear,
// once per destination. Images inside code are text, not images.
func BodyImages(body string) []BodyImage {
	src := []byte(body)
	doc := goldmark.New().Parser().Parse(text.NewReader(src))

	var found []BodyImage
	seen := map[string]bool{}
	_ = ast.Walk(doc, func(n ast.Node, entering bool) (ast.WalkStatus, error) {
		img, ok := n.(*ast.Image)
		if !entering || !ok {
			return ast.WalkContinue, nil
		}
		dest := string(img.Destination)
		if seen[dest] {
			return ast.WalkSkipChildren, nil
		}
		seen[dest] = true
		bi := BodyImage{Src: dest, Alt: string(plainText(img, src)), Local: isLocal(dest)}
		if bi.Local {
			bi.Image, _ = images.ParseRef(dest)
		}
		found = append(found, bi)
		return ast.WalkSkipChildren, nil
	})
	return found
}

// plainText is the text of the children of a node, without markup.
func plainText(n ast.Node, src []byte) []byte {
	var out []byte
	for c := n.FirstChild(); c != nil; c = c.NextSibling() {
		if t, ok := c.(*ast.Text); ok {
			out = append(out, t.Segment.Value(src)...)
			continue
		}
		out = append(out, plainText(c, src)...)
	}
	return out
}

// isLocal reports whether a destination is a path rather than a URL, the way the
// gh CLI tells them apart.
func isLocal(dest string) bool {
	if dest == "" || strings.HasPrefix(dest, "#") {
		return false
	}
	u, err := url.Parse(dest)
	if err != nil {
		return true
	}
	return len(u.Scheme) <= 1 && u.Host == ""
}

// CheckImages fills the problem of every local image by its file in the images
// folder of artifactsDir.
func CheckImages(artifactsDir string, imgs []BodyImage) []BodyImage {
	for i := range imgs {
		img := &imgs[i]
		if !img.Local {
			continue
		}
		if img.Image.ID == "" {
			img.Problem = ImageMissing
			continue
		}
		info, err := os.Stat(images.Path(artifactsDir, img.Image))
		switch {
		case err != nil:
			img.Problem = ImageMissing
		case info.Size() > images.MaxPublishSize:
			img.Problem = ImageTooLarge
		}
	}
	return imgs
}

// DraftImages are the images of a body of a draft of the discussion, checked.
func (d Discussion) DraftImages(body string) []BodyImage {
	return CheckImages(d.ArtifactsDir, BodyImages(body))
}

// Uploads are the images of a body that go to GitHub as attachments: the local
// ones without a problem.
func Uploads(imgs []BodyImage) []BodyImage {
	var ups []BodyImage
	for _, img := range imgs {
		if img.Local && img.Problem == ImageOK {
			ups = append(ups, img)
		}
	}
	return ups
}

// ImagesError is ErrImageMissing or ErrImageTooLarge for the first image with a
// problem, nil without one.
func ImagesError(imgs []BodyImage) error {
	for _, img := range imgs {
		switch img.Problem {
		case ImageMissing:
			return ErrImageMissing
		case ImageTooLarge:
			return ErrImageTooLarge
		case ImageOK:
		}
	}
	return nil
}

// ImageName is how a sentence names an image: its alternative text in quotes,
// or its Src without one.
func ImageName(img BodyImage) string {
	if img.Alt != "" {
		return strconv.Quote(img.Alt)
	}
	return img.Src
}
