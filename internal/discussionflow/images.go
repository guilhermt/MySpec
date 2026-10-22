package discussionflow

import (
	"context"

	"github.com/guilhermt/myspec/internal/discussion"
	"github.com/guilhermt/myspec/internal/images"
	"github.com/guilhermt/myspec/internal/session"
)

// UnseenDraftImages are the images the user put in the drafts of a discussion
// while editing them that the agent hasn't seen: they go with the next message
// of the user, each with the draft whose body has it.
func (s *Service) UnseenDraftImages(ctx context.Context, id string) []images.Image {
	stored, ok := s.discussions.Get(id)
	if !ok {
		return nil
	}
	transcript, err := s.sessions.Transcript(ctx, sessionKey(id))
	if err != nil {
		s.log.Warn("unseen draft images unread", "discussion", id, "error", err)
		return nil
	}

	seen := map[string]bool{}
	for _, img := range stored.InitialImages {
		seen[img.ID] = true
	}
	for _, entries := range [][]session.Entry{transcript.Entries, transcript.Pending} {
		for _, e := range entries {
			if e.Kind != session.KindUser || e.User == nil {
				continue
			}
			for _, img := range e.User.Images {
				seen[img.ID] = true
			}
		}
	}

	var unseen []images.Image
	for _, d := range s.discussions.Drafts(id) {
		if d.Published.Started() {
			continue
		}
		for _, bi := range stored.DraftImages(d.Body) {
			if !bi.Local || bi.Image.ID == "" || bi.Problem == discussion.ImageMissing || seen[bi.Image.ID] {
				continue
			}
			seen[bi.Image.ID] = true
			unseen = append(unseen, images.Image{
				ID: bi.Image.ID, MediaType: bi.Image.MediaType,
				Origin: images.OriginDraft, Draft: d.ID, Alt: bi.Alt,
			})
		}
	}
	return unseen
}
