package bindings

import (
	"encoding/base64"
	"fmt"
	"log/slog"
	"strconv"
	"strings"

	"github.com/guilhermt/myspec/internal/cardimages"
	"github.com/guilhermt/myspec/internal/images"
)

// ImagesRoute is where the webview loads an image stored with an item:
// ImagesRoute + <item id>/<image id><ext>.
const ImagesRoute = "/myspec/images/"

// CardImagesRoute is where it loads an image read from a card: CardImagesRoute
// + <cache id>, or CardImagesRoute + "body?issue=<key>&src=<url>" for an image
// of a body the panels show.
const CardImagesRoute = "/myspec/card-images/"

// imageURL is where the webview loads an image stored with an item.
func imageURL(itemID string, img images.Image) string {
	return ImagesRoute + itemID + "/" + img.ID + images.Ext(img.MediaType)
}

// cardImageURL is where the webview loads an image of the cache of the cards.
func cardImageURL(id string) string { return CardImagesRoute + id }

// fromImages converts the images of an item, never nil.
func fromImages(itemID string, imgs []images.Image) []Image {
	converted := make([]Image, len(imgs))
	for i, img := range imgs {
		converted[i] = Image{
			ID:     img.ID,
			URL:    imageURL(itemID, img),
			Origin: string(img.Origin),
			Issue:  img.Issue,
			Number: issueNumber(img.Issue),
			Alt:    img.Alt,
		}
	}
	return converted
}

// issueNumber is the number after the # of owner/name#number; 0 for "" or a
// key without one.
func issueNumber(key string) int {
	_, number, found := strings.Cut(key, "#")
	if !found {
		return 0
	}
	n, err := strconv.Atoi(number)
	if err != nil {
		return 0
	}
	return n
}

// uploadsOf decodes the images the frontend sends in base64. What isn't base64
// is no image of a format the product takes.
func uploadsOf(encoded []string) ([][]byte, error) {
	uploads := make([][]byte, len(encoded))
	for i, e := range encoded {
		data, err := base64.StdEncoding.DecodeString(e)
		if err != nil {
			return nil, fmt.Errorf("image %d: %w", i+1, images.ErrFormat)
		}
		uploads[i] = data
	}
	return uploads, nil
}

// creationUploads are the images a creation starts with, in the order they
// reach the agent: the ones read from the cards, from the cache, then the ones
// the user attached. A card image the cache no longer has is left out.
func creationUploads(cards *cardimages.Service, log *slog.Logger, cardImages []CardImage, attached []string) ([]images.Upload, error) {
	user, err := uploadsOf(attached)
	if err != nil {
		return nil, err
	}
	uploads := make([]images.Upload, 0, len(cardImages)+len(user))
	for _, ci := range cardImages {
		data, _, err := cards.Data(ci.ID)
		if err != nil {
			log.Warn("card image left out", "image", ci.ID, "error", err)
			continue
		}
		origin := images.OriginCard
		if ci.Origin == string(images.OriginEpic) {
			origin = images.OriginEpic
		}
		uploads = append(uploads, images.Upload{
			Image: images.Image{Origin: origin, Issue: ci.Issue, Alt: ci.Alt, Position: ci.Position, Count: ci.Count},
			Data:  data,
		})
	}
	for _, data := range user {
		uploads = append(uploads, images.Upload{Image: images.Image{Origin: images.OriginUser}, Data: data})
	}
	return uploads, nil
}

// fromCardImages converts what reading the images of cards gave.
func fromCardImages(reading cardimages.Reading) CardImages {
	converted := CardImages{
		Images:   make([]CardImage, len(reading.Images)),
		Failures: make([]CardImageFailure, len(reading.Failures)),
	}
	for i, img := range reading.Images {
		converted.Images[i] = CardImage{
			ID:       img.ID,
			URL:      cardImageURL(img.ID),
			Origin:   string(img.Issue.Origin),
			Issue:    img.Issue.Key(),
			Number:   img.Issue.Number,
			Alt:      img.Alt,
			Position: img.Position,
			Count:    img.Count,
		}
	}
	for i, f := range reading.Failures {
		converted.Failures[i] = CardImageFailure{
			Origin: string(f.Issue.Origin),
			Issue:  f.Issue.Key(),
			Number: f.Issue.Number,
			URL:    f.URL,
			Alt:    f.Alt,
			Reason: f.Reason,
		}
	}
	return converted
}
