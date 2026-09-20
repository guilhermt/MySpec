package discussion

import (
	"fmt"
	"slices"
	"strings"
)

// The warnings a rewrite of the artifact leaves on a draft whose reference is
// no longer among the drafts.
const (
	epicGoneWarning       = "The epic %s is no longer among the drafts."
	dependencyGoneWarning = "The dependency %s is no longer among the drafts."
)

// reconcile is the drafts of the artifact against what is stored: a draft the
// agent did not change keeps what the user edited and decided, a draft that
// changed is replaced, a published draft never moves, and what the user made
// stays. The list comes out in the order of the artifact, with what it no
// longer has at the end.
func reconcile(discussionID string, stored []Draft, a Artifact) []Draft {
	drafts := make([]Draft, 0, len(stored)+len(a.Drafts))
	taken := map[string]bool{}
	for _, parsed := range a.Drafts {
		taken[parsed.ID] = true
		drafts = append(drafts, inherit(discussionID, stored, parsed))
	}
	for _, draft := range stored {
		if !taken[draft.ID] && (draft.Published.Started() || draft.Source == SourceUser) {
			drafts = append(drafts, cloneDraft(draft))
		}
	}

	normalize(drafts)
	for i := range drafts {
		drafts[i].Position = i
	}
	return drafts
}

// inherit is one draft of the artifact as it is stored: untouched when the
// agent rewrote it the same, replaced when it says something else.
func inherit(discussionID string, stored []Draft, parsed ParsedDraft) Draft {
	index := slices.IndexFunc(stored, func(d Draft) bool { return d.ID == parsed.ID })
	if index < 0 {
		draft := fresh(discussionID, parsed)
		draft.Revision = 1
		return draft
	}

	previous := cloneDraft(stored[index])
	if previous.Published.Started() || same(previous, parsed) {
		return previous
	}
	draft := fresh(discussionID, parsed)
	draft.Revision = previous.Revision + 1
	return draft
}

// fresh is a draft of the artifact nobody edited or decided anything about
// yet.
func fresh(discussionID string, parsed ParsedDraft) Draft {
	draft := Draft{
		DiscussionID:       discussionID,
		ID:                 parsed.ID,
		Kind:               parsed.Kind,
		Source:             SourceAgent,
		RepositoryOriginal: parsed.Repository,
		TitleOriginal:      parsed.Title,
		Title:              parsed.Title,
		BodyOriginal:       parsed.Body,
		Body:               parsed.Body,
		ModuleOriginal:     parsed.Module,
		Module:             parsed.Module,
	}

	owner, name, _ := strings.Cut(parsed.Repository, "/")
	draft.Owner, draft.Name = owner, name
	if parsed.Card != nil {
		draft.Card = &InputCard{Owner: parsed.Card.Owner, Name: parsed.Card.Name, Number: parsed.Card.Number}
		draft.Owner, draft.Name = parsed.Card.Owner, parsed.Card.Name
	}
	if parsed.Epic != nil {
		draft.EpicOriginal, draft.Epic = parsed.Epic.String(), parsed.Epic.String()
	}
	for _, ref := range parsed.Dependencies {
		draft.Dependencies = append(draft.Dependencies, Dependency{Ref: ref, Original: true})
	}
	return draft
}

// same reports whether the artifact says about a draft exactly what it said
// when the draft was stored.
func same(stored Draft, parsed ParsedDraft) bool {
	if stored.Kind != parsed.Kind || stored.RepositoryOriginal != parsed.Repository ||
		stored.TitleOriginal != parsed.Title || stored.BodyOriginal != parsed.Body ||
		stored.ModuleOriginal != parsed.Module || stored.EpicOriginal != epicOf(parsed) {
		return false
	}
	if cardKey(stored.Card) != refKey(parsed.Card) {
		return false
	}

	original := make([]string, 0, len(stored.Dependencies))
	for _, dependency := range stored.Dependencies {
		if dependency.Original {
			original = append(original, dependency.Key())
		}
	}
	if len(original) != len(parsed.Dependencies) {
		return false
	}
	for i, ref := range parsed.Dependencies {
		if original[i] != ref.Key() {
			return false
		}
	}
	return true
}

// epicOf is the epic of a parsed draft as a draft stores it.
func epicOf(parsed ParsedDraft) string {
	if parsed.Epic == nil {
		return ""
	}
	return parsed.Epic.String()
}

// cardKey identifies the card of a stored draft, "" when it has none.
func cardKey(card *InputCard) string {
	if card == nil {
		return ""
	}
	return card.Key()
}

// refKey identifies what a reference points at, "" when there is none.
func refKey(ref *Ref) string {
	if ref == nil {
		return ""
	}
	return ref.Key()
}

// normalize drops what a draft points at and the list no longer has, with a
// warning saying so.
func normalize(drafts []Draft) {
	present := map[string]bool{}
	for _, draft := range drafts {
		present[draft.ID] = true
	}

	for i := range drafts {
		draft := &drafts[i]
		if ref, ok := draft.EpicRef(); ok && ref.IsDraft() && !present[ref.Draft] {
			draft.Epic = ""
			warn(draft, fmt.Sprintf(epicGoneWarning, ref.Draft))
		}
		var kept []Dependency
		for _, dependency := range draft.Dependencies {
			if dependency.IsDraft() && !present[dependency.Draft] {
				warn(draft, fmt.Sprintf(dependencyGoneWarning, dependency.Draft))
				continue
			}
			kept = append(kept, dependency)
		}
		draft.Dependencies = kept
	}
}

// warn leaves a warning on a draft, once.
func warn(draft *Draft, warning string) {
	if !slices.Contains(draft.Warnings, warning) {
		draft.Warnings = append(slices.Clone(draft.Warnings), warning)
	}
}
