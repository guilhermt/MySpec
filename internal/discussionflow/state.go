package discussionflow

import (
	"maps"
	"slices"

	"github.com/guilhermt/myspec/internal/discussion"
	"github.com/guilhermt/myspec/internal/session"
)

// Status is what the interface shows about a discussion.
type Status string

// The states a discussion is shown in.
const (
	StatusNone            Status = ""                // Waiting only: nothing waits for the user
	StatusDiscussing      Status = "discussing"      // the conversation goes on; no drafts to act on
	StatusAwaitingDrafts  Status = "awaiting_drafts" // the agent rested with a drafts artifact the app can't read
	StatusDeciding        Status = "deciding"        // a draft is still to decide
	StatusPublishing      Status = "publishing"      // a run writes on GitHub, or is about to
	StatusPublishFailed   Status = "publish_failed"
	StatusEpicDiscarded   Status = "epic_discarded"    // a discarded epic has an approved card that won't publish
	StatusEpicCantPublish Status = "epic_cant_publish" // an approved epic has every card decided and fewer than two approved
	StatusReadyToArchive  Status = "ready_to_archive"  // every draft is published or discarded
)

// The sentences a discussion says about why it cannot be archived yet.
const (
	hintPublicationFailed  = "A publication failed: Retry it, or discard the draft."
	hintPublicationRunning = "A publication is running."
	hintWaitingPublication = "Approved drafts wait to be published."
)

// epicShortHint is why a discussion with an epic that can't publish is not
// archived yet, and how out of it.
func epicShortHint(approved, cards int) string {
	switch {
	case cards == 0:
		return "The epic can't publish: move two cards into it, or discard the epic."
	case cards == 1:
		return "The epic can't publish: move another card into it, or discard the epic."
	case approved == 1:
		return "The epic can't publish: approve one more card, or discard the epic."
	default:
		return "The epic can't publish: approve two more cards, or discard the epic."
	}
}

// DraftState is one draft with what the interface needs to offer around it.
type DraftState struct {
	Draft discussion.Draft
	// Hold is what keeps an approved draft out of the next run.
	Hold Hold
	// Publishing says the draft is in the publication under way.
	Publishing bool
}

// State is everything the app knows about a discussion: what it recorded, the
// drafts with what can be done to each one, and what the conversation is doing.
type State struct {
	Discussion discussion.Discussion
	Status     Status
	// Waiting is the state the situation of the discussion comes from: Status
	// without a run, so that what waits for the user stands through one, and
	// StatusNone while a run is under way or about to start with nothing else
	// waiting.
	Waiting     Status
	Drafts      []DraftState
	Session     session.Summary
	SessionOpen bool
	// UnreadableDrafts is why the drafts artifact could not be read; "" when
	// that is not the case.
	UnreadableDrafts string
	// HasDocument says the agent has written the document of the discussion,
	// and DocumentRevision changes every time it does.
	HasDocument      bool
	DocumentRevision int
	// Publishing says a run that writes on GitHub is under way.
	Publishing bool
	// CanArchive says the discussion can leave the list for the history, and
	// ArchiveHint is why it cannot.
	CanArchive  bool
	ArchiveHint string
}

// State is everything the app knows about an active discussion, false for an
// id that is no discussion of its own.
func (s *Service) State(id string) (State, bool) {
	stored, ok := s.discussions.Get(id)
	if !ok {
		return State{}, false
	}
	sum, open := s.sessions.Summary(sessionKey(id))

	l := s.lockOf(id)

	s.mu.Lock()
	state := State{
		Discussion:       stored,
		Session:          sum,
		SessionOpen:      open,
		UnreadableDrafts: l.unreadable,
		HasDocument:      l.hasDocument,
		DocumentRevision: l.documentRevision,
		Publishing:       l.publishing,
	}
	running := maps.Clone(l.running)
	s.mu.Unlock()

	drafts := s.effectiveDrafts(id, s.discussions.Drafts(id))
	settle(&state, drafts, running)
	return state, true
}

// ShortEpic is the first epic, by position, that can't publish for want of
// approved cards: how many of its cards are approved, of how many.
func (s State) ShortEpic() (approved, cards int, ok bool) {
	for _, d := range s.Drafts {
		if d.Draft.Kind == discussion.KindEpic && d.Hold.Reason == HoldEpicShort {
			return d.Hold.Approved, d.Hold.Cards, true
		}
	}
	return 0, 0, false
}

// DiscardedEpic is the first discarded epic, by position, with approved cards
// that won't publish, and how many they are.
func (s State) DiscardedEpic() (approvedCards int, ok bool) {
	for _, e := range s.Drafts {
		if e.Draft.Kind != discussion.KindEpic || e.Draft.Decision != discussion.DecisionDiscarded || e.Draft.Published.Done() {
			continue
		}
		count := 0
		for _, d := range s.Drafts {
			if d.Draft.IsCard() && d.Draft.Epic == e.Draft.ID && d.Draft.Decision == discussion.DecisionApproved && !d.Draft.Published.Done() {
				count++
			}
		}
		if count > 0 {
			return count, true
		}
	}
	return 0, false
}

// settle fills in what the drafts say about a discussion: the chain of them,
// what holds each one, the status, what waits for the user, and whether it
// can be archived.
func settle(state *State, drafts []discussion.Draft, running map[string]bool) {
	c := chainOf(drafts)
	state.Drafts = draftStates(c, running)
	state.Status = standing(*state, c, true)
	state.Waiting = standing(*state, c, false)
	state.CanArchive, state.ArchiveHint = canArchive(*state, c)
}

// effectiveDrafts are the drafts as the app knows them: what it recorded, with
// what a publication left it unable to record on top. A step GitHub took and
// no write held lives only in memory, so everything derived from the drafts
// reads it from there until a retry writes it down.
func (s *Service) effectiveDrafts(id string, drafts []discussion.Draft) []discussion.Draft {
	entries := s.unrecordedDrafts(id)
	if len(entries) == 0 {
		return drafts
	}
	for i := range drafts {
		entry, ok := entries[drafts[i].ID]
		if !ok {
			continue
		}
		drafts[i].Published = entry.Published
		drafts[i].PublishError = entry.Error
	}
	return drafts
}

// standing is where a discussion stands: the first that holds of the
// conversation at work, a run, a failure, an unreadable artifact, no drafts
// yet, a discarded epic with approved cards, a draft to decide, an epic that
// can't publish, a run about to start, and every draft settled. run says
// whether a run counts: Waiting leaves it out, so that a situation stands
// through it.
func standing(in State, c chain, run bool) Status {
	_, _, short := in.ShortEpic()
	_, discarded := in.DiscardedEpic()
	switch {
	case in.SessionOpen && !in.Session.Idle:
		return StatusDiscussing
	case run && in.Publishing:
		return StatusPublishing
	case slices.ContainsFunc(in.Drafts, func(d DraftState) bool { return d.Draft.PublishError != "" }):
		return StatusPublishFailed
	case in.UnreadableDrafts != "":
		return StatusAwaitingDrafts
	case !in.Discussion.DraftsRead || len(in.Drafts) == 0:
		return StatusDiscussing
	case discarded:
		return StatusEpicDiscarded
	case slices.ContainsFunc(in.Drafts, func(d DraftState) bool { return !d.Draft.Decided() }):
		return StatusDeciding
	case short:
		return StatusEpicCantPublish
	case run && len(c.due()) > 0:
		return StatusPublishing
	case !slices.ContainsFunc(in.Drafts, func(d DraftState) bool { return pending(d.Draft) }):
		return StatusReadyToArchive
	default:
		return StatusNone
	}
}

// pending reports whether a draft is still to reach GitHub or to be
// discarded.
func pending(d discussion.Draft) bool {
	return !d.Published.Done() && d.Decision != discussion.DecisionDiscarded
}

// draftStates is every draft with what keeps it out of the next run, with
// running saying which of them the publication under way writes.
func draftStates(c chain, running map[string]bool) []DraftState {
	states := make([]DraftState, 0, len(c.drafts))
	for _, d := range c.drafts {
		states = append(states, DraftState{Draft: d, Hold: c.hold(d.ID), Publishing: running[d.ID]})
	}
	return states
}

// canArchive says whether a discussion can leave the list for the history, and
// why it cannot: what was approved goes to GitHub first.
func canArchive(in State, c chain) (bool, string) {
	if slices.ContainsFunc(in.Drafts, func(d DraftState) bool { return d.Draft.PublishError != "" }) {
		return false, hintPublicationFailed
	}
	if in.Publishing {
		return false, hintPublicationRunning
	}
	if approved, cards, ok := in.ShortEpic(); ok {
		return false, epicShortHint(approved, cards)
	}
	waiting := slices.ContainsFunc(in.Drafts, func(d DraftState) bool {
		return d.Draft.Decision == discussion.DecisionApproved && !d.Draft.Published.Done() && !c.wontPublish(d.Draft.ID)
	})
	if waiting {
		return false, hintWaitingPublication
	}
	return true, ""
}

// membersOf are the cards an epic draft groups, in position order.
func membersOf(epic discussion.Draft, drafts []discussion.Draft) []discussion.Draft {
	var members []discussion.Draft
	for _, draft := range drafts {
		if draft.IsCard() && draft.Epic == epic.ID {
			members = append(members, draft)
		}
	}
	return members
}

// epicDraftOf is the epic of a card when it is another draft of the
// discussion, which is published with it.
func epicDraftOf(draft discussion.Draft, drafts []discussion.Draft) (discussion.Draft, bool) {
	if !draft.InEpicDraft() {
		return discussion.Draft{}, false
	}
	ref, _ := draft.EpicRef()
	return draftOf(drafts, ref.Draft)
}

// draftOf is a draft of the discussion by id.
func draftOf(drafts []discussion.Draft, id string) (discussion.Draft, bool) {
	index := slices.IndexFunc(drafts, func(d discussion.Draft) bool { return d.ID == id })
	if index < 0 {
		return discussion.Draft{}, false
	}
	return drafts[index], true
}

// titleOf names a draft to the user: the title it has, or the sentence that
// says it has none.
func titleOf(draft discussion.Draft) string {
	return discussion.DisplayTitle(draft)
}

// maxRound is the highest round of the drafts, 0 without any.
func maxRound(drafts []discussion.Draft) int {
	highest := 0
	for _, d := range drafts {
		highest = max(highest, d.Round)
	}
	return highest
}
