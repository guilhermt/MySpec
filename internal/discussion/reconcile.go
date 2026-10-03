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
	dependencyGoneWarning = "The dependency on %s is no longer among the drafts."
)

// reconcile is the drafts of the artifact against what is stored: a draft the
// agent did not change keeps what the user edited and decided, one it rewrote
// as the user had edited it keeps the decision, a draft that changed is
// replaced, a published draft never moves, and what the user made stays. The
// list comes out in the order of the artifact, with what it no longer has at
// the end.
//
// A reading belongs to the current round, or opens the next one when every
// draft of the current round is on GitHub or discarded: a closed round never
// changes nor loses a draft, except an id the agent reuses with another
// content, which is a draft of the new round. The content is what the user
// sees: a draft the agent rewrote as the user had left it stays in its round.
// reading is the DraftsRevision the discussion has if the reading revises its
// round.
func reconcile(discussionID string, stored []Draft, a Artifact, reading int) ([]Draft, Recorded) {
	current := maxRound(stored)
	round := max(current, 1)
	if current >= 1 && roundSettled(stored, current) {
		round = current + 1
	}

	drafts := make([]Draft, 0, len(stored)+len(a.Drafts))
	taken, replaced := map[string]bool{}, map[string]bool{}
	for _, parsed := range a.Drafts {
		taken[parsed.ID] = true
		draft, kept := inherit(discussionID, stored, parsed)
		if !kept {
			draft.Round = round
			replaced[draft.ID] = true
		}
		drafts = append(drafts, draft)
	}
	for _, draft := range stored {
		if !taken[draft.ID] && (draft.Published.Started() || draft.Source == SourceUser || draft.Round < round) {
			drafts = append(drafts, cloneDraft(draft))
		}
	}

	normalize(drafts, stored)
	unapproveMoved(stored, drafts)
	for i := range drafts {
		drafts[i].Position = i
	}

	changes := map[string][]string{}
	for i := range drafts {
		after := &drafts[i]
		j := slices.IndexFunc(stored, func(d Draft) bool { return d.ID == after.ID })
		if j < 0 {
			continue
		}
		before := stored[j]
		ch := changesOf(before, *after, stored, drafts)
		if len(ch) == 0 && replaced[after.ID] {
			// The user sees the draft as it was: it stays in its round, with
			// what was decided about it.
			after.Round = before.Round
			carryOver(after, before)
			continue
		}
		// Only a draft that stays in the round of the reading is revised: one
		// of a closed round never is, and an id reused with another content is
		// a draft of the new round.
		if len(ch) == 0 || before.Round != round || after.Round != round {
			continue
		}
		changes[after.ID] = ch
		after.RevisedReading = reading
		after.ApprovalCleared = (before.Decision == DecisionApproved && after.Decision != DecisionApproved) ||
			(before.ApprovalCleared && after.Decision == DecisionNone)
	}
	return drafts, recordedOf(stored, drafts, changes, round)
}

// recordedOf says what a reading did to its round: how many drafts it has,
// and, unless the reading is the first of the round, the round as it was. A
// reading that leaves no draft and revised nothing has no round.
func recordedOf(stored, drafts []Draft, changes map[string][]string, round int) Recorded {
	rec := Recorded{Round: round}
	for _, draft := range drafts {
		if draft.Round == round {
			rec.Drafts++
		}
	}
	rec.First = rec.Drafts > 0 && !slices.ContainsFunc(stored, func(d Draft) bool { return d.Round == round })
	if rec.First {
		return rec
	}

	inRound := func(list []Draft, id string) (Draft, bool) {
		i := slices.IndexFunc(list, func(d Draft) bool { return d.ID == id && d.Round == round })
		if i < 0 {
			return Draft{}, false
		}
		return list[i], true
	}
	for _, before := range stored {
		if before.Round != round {
			continue
		}
		after, kept := inRound(drafts, before.ID)
		row := BeforeDraft{
			Title:    before.Title,
			Kind:     before.Kind,
			Decision: before.Decision,
			Outcome:  before.Published.Outcome,
			Changes:  changes[before.ID],
			Dropped:  !kept,
		}
		if before.Published.Started() {
			row.Reference = before.Reference()
		}
		row.ApprovalCleared = kept && before.Decision == DecisionApproved && after.Decision != DecisionApproved
		switch {
		case !kept:
			rec.Dropped++
		case len(row.Changes) > 0:
			rec.Replaced++
		}
		rec.Before = append(rec.Before, row)
	}
	for _, after := range drafts {
		if after.Round != round {
			continue
		}
		if _, was := inRound(stored, after.ID); !was {
			rec.Before = append(rec.Before, BeforeDraft{Title: after.Title, Kind: after.Kind, Added: true})
			rec.Added++
		}
	}
	if rec.Replaced+rec.Added+rec.Dropped == 0 {
		rec.Before = nil
	}
	if len(drafts) == 0 && rec.Before == nil {
		rec.Round = 0
	}
	return rec
}

// maxRound is the highest round of the drafts, 0 without any.
func maxRound(drafts []Draft) int {
	highest := 0
	for _, draft := range drafts {
		highest = max(highest, draft.Round)
	}
	return highest
}

// roundSettled reports whether every draft of the round is on GitHub or
// discarded, which is what lets the next reading open another round.
func roundSettled(drafts []Draft, round int) bool {
	for _, draft := range drafts {
		if draft.Round == round && !draft.Published.Done() && draft.Decision != DecisionDiscarded {
			return false
		}
	}
	return true
}

// changesOf names the fields a reading changed in a draft, in the order of
// Fields. The comparison is with what is stored, which carries the edits of the
// user.
func changesOf(before, after Draft, stored, drafts []Draft) []string {
	differs := map[string]bool{
		"title":        before.Title != after.Title,
		"body":         before.Body != after.Body,
		"repository":   before.FullName() != after.FullName(),
		"module":       before.Module != after.Module,
		"epic":         before.Epic != after.Epic,
		"dependencies": !slices.Equal(dependencyKeys(before), dependencyKeys(after)),
		"cards":        !slices.Equal(memberIDs(before.ID, stored), memberIDs(after.ID, drafts)),
		"kind":         before.Kind != after.Kind,
		"card":         cardKey(before.Card) != cardKey(after.Card),
	}
	var names []string
	for _, field := range Fields {
		if differs[field] {
			names = append(names, field)
		}
	}
	return names
}

// inherit is one draft of the artifact as it is stored: untouched when the
// agent rewrote it the same, replaced when it says something else. kept says
// the stored draft came back, in the round it was.
func inherit(discussionID string, stored []Draft, parsed ParsedDraft) (draft Draft, kept bool) {
	index := slices.IndexFunc(stored, func(d Draft) bool { return d.ID == parsed.ID })
	if index < 0 {
		draft = fresh(discussionID, parsed)
		draft.Revision = 1
		return draft, false
	}

	previous := cloneDraft(stored[index])
	if previous.Published.Started() {
		return previous, true
	}
	if same(previous, parsed) {
		adoptCard(&previous, parsed)
		return previous, true
	}
	draft = fresh(discussionID, parsed)
	draft.Revision = previous.Revision + 1
	return draft, false
}

// carryOver gives a replaced draft that reads as it was stored what the user
// and the app left on the stored one: the agent rewrote it as the user had
// edited it, so nothing changed for the user and the decision stands. What
// the artifact says now stays as its originals, and the warnings are the ones
// of this reading.
func carryOver(draft *Draft, stored Draft) {
	draft.Decision = stored.Decision
	draft.Revision = stored.Revision
	draft.RevisedReading = stored.RevisedReading
	draft.ApprovalCleared = stored.ApprovalCleared
	draft.PublishError = stored.PublishError
	draft.Published = stored.Published
	for i := range draft.Dependencies {
		dependency := &draft.Dependencies[i]
		j := slices.IndexFunc(stored.Dependencies, func(d Dependency) bool { return d.Key() == dependency.Key() })
		if j >= 0 {
			dependency.Linked, dependency.Dropped, dependency.Detail =
				stored.Dependencies[j].Linked, stored.Dependencies[j].Dropped, stored.Dependencies[j].Detail
		}
	}
}

// adoptCard gives a kept draft the title and the url of its card, which a
// draft stored before the board answered for them has empty. The artifact says
// nothing about either, so this is no rewrite of the draft.
func adoptCard(draft *Draft, parsed ParsedDraft) {
	if draft.Card == nil || draft.Card.Title != "" || parsed.CardTitle == "" {
		return
	}
	draft.Card.Title, draft.Card.URL = parsed.CardTitle, parsed.CardURL
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
		draft.Card = &InputCard{
			Owner:  parsed.Card.Owner,
			Name:   parsed.Card.Name,
			Number: parsed.Card.Number,
			Title:  parsed.CardTitle,
			URL:    parsed.CardURL,
		}
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
// when the draft was stored. The title and the url of a card come from the
// board, never from the artifact, so neither is compared.
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
// warning saying so. A published draft is left alone: what it points at is
// already on GitHub.
func normalize(drafts, stored []Draft) {
	present := map[string]bool{}
	for _, draft := range drafts {
		present[draft.ID] = true
	}

	for i := range drafts {
		draft := &drafts[i]
		if draft.Published.Started() {
			continue
		}
		if ref, ok := draft.EpicRef(); ok && ref.IsDraft() && !present[ref.Draft] {
			draft.Epic = ""
			warn(draft, fmt.Sprintf(epicGoneWarning, goneTitle(stored, ref.Draft)))
		}
		var kept []Dependency
		for _, dependency := range draft.Dependencies {
			if dependency.IsDraft() && !present[dependency.Draft] {
				warn(draft, fmt.Sprintf(dependencyGoneWarning, goneTitle(stored, dependency.Draft)))
				continue
			}
			kept = append(kept, dependency)
		}
		draft.Dependencies = kept
	}
}

// goneTitle is what a warning calls a draft that left the list: the title it
// had when it was stored.
func goneTitle(stored []Draft, id string) string {
	i := slices.IndexFunc(stored, func(d Draft) bool { return d.ID == id })
	if i < 0 {
		return "Untitled draft"
	}
	return DisplayTitle(stored[i])
}

// warn leaves a warning on a draft, once.
func warn(draft *Draft, warning string) {
	if !slices.Contains(draft.Warnings, warning) {
		draft.Warnings = append(slices.Clone(draft.Warnings), warning)
	}
}

// unapproveMoved takes back the approval of a draft the rewrite kept but moved
// in the chain: a card whose epic or dependency left with a draft that left
// the artifact, and an epic whose cards are no longer the ones the user
// approved it with.
func unapproveMoved(stored, drafts []Draft) {
	for i := range drafts {
		draft := &drafts[i]
		j := slices.IndexFunc(stored, func(d Draft) bool { return d.ID == draft.ID })
		if j < 0 {
			continue
		}
		before := stored[j]
		moved := draft.Epic != before.Epic || !slices.Equal(dependencyKeys(*draft), dependencyKeys(before))
		if draft.Kind == KindEpic {
			moved = !slices.Equal(memberIDs(draft.ID, drafts), memberIDs(draft.ID, stored))
		}
		if moved {
			unapprove(draft)
		}
	}
}

// dependencyKeys are what the dependencies of a draft point at, in order.
func dependencyKeys(d Draft) []string {
	keys := make([]string, 0, len(d.Dependencies))
	for _, dependency := range d.Dependencies {
		keys = append(keys, dependency.Key())
	}
	return keys
}

// memberIDs are the cards that point at an epic draft, sorted.
func memberIDs(epicID string, drafts []Draft) []string {
	var ids []string
	for _, d := range drafts {
		if d.IsCard() && d.Epic == epicID {
			ids = append(ids, d.ID)
		}
	}
	slices.Sort(ids)
	return ids
}
