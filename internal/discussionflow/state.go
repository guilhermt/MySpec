package discussionflow

import (
	"slices"

	"github.com/guilhermt/myspec/internal/discussion"
	"github.com/guilhermt/myspec/internal/session"
)

// Status is what the interface shows about a discussion.
type Status string

// The states a discussion is shown in.
const (
	StatusDiscussing     Status = "discussing"      // the conversation goes on; no drafts to act on
	StatusAwaitingDrafts Status = "awaiting_drafts" // the agent rested with a drafts artifact the app can't read
	StatusDeciding       Status = "deciding"        // a draft is still to decide, or an epic is ready to publish
	StatusPublishing     Status = "publishing"
	StatusPublishFailed  Status = "publish_failed"
	StatusPublished      Status = "published" // every draft is published or discarded, and at least one was published
)

// minEpicCards is how many approved cards an epic needs to be worth one.
const minEpicCards = 2

// The sentences a draft says about why it is not ready to be published.
const (
	hintTooFewCards     = "An epic needs at least two cards."
	hintDecideEveryCard = "Approve or discard every card of the epic."
	hintApproveTheEpic  = "Approve the epic."
	hintEpicDiscarded   = "The epic is discarded."
	hintWaitsFor        = "Waits for "
)

// The sentences a discussion says about why it cannot be archived yet.
const (
	hintWaitingPublication = "Approved drafts are waiting to be published."
	hintPublicationFailed  = "A publication failed."
)

// DraftState is one draft with what the interface needs to offer around it.
type DraftState struct {
	Draft discussion.Draft
	// Waits is the title of the draft this one waits for before it is
	// published; "" when it waits for none.
	Waits string
	// CanPublish says Publish epic is enabled; epics only.
	CanPublish bool
	// Hint is why an epic can't be published, or why a card of a discarded
	// epic goes nowhere.
	Hint string
}

// State is everything the app knows about a discussion: what it recorded, the
// drafts with what can be done to each one, and what the conversation is doing.
type State struct {
	Discussion  discussion.Discussion
	Status      Status
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
	drafts := s.discussions.Drafts(id)
	sum, open := s.sessions.Summary(sessionKey(id))

	l := s.lockOf(id)

	s.mu.Lock()
	state := State{
		Discussion:       stored,
		Drafts:           draftStates(drafts),
		Session:          sum,
		SessionOpen:      open,
		UnreadableDrafts: l.unreadable,
		HasDocument:      l.hasDocument,
		DocumentRevision: l.documentRevision,
		Publishing:       l.publishing,
	}
	s.mu.Unlock()

	state.Status = status(state)
	state.CanArchive, state.ArchiveHint = canArchive(drafts)
	return state, true
}

// status is the state a discussion is shown in. The conversation comes first:
// while the agent works, what it works on is what the discussion is.
func status(in State) Status {
	switch {
	case in.SessionOpen && !in.Session.Idle:
		return StatusDiscussing
	case in.Publishing:
		return StatusPublishing
	case slices.ContainsFunc(in.Drafts, func(d DraftState) bool { return d.Draft.PublishError != "" }):
		return StatusPublishFailed
	case in.UnreadableDrafts != "":
		return StatusAwaitingDrafts
	case !in.Discussion.DraftsRead || len(in.Drafts) == 0:
		// The agent has not written a readable artifact yet: there is nothing
		// to decide on.
		return StatusDiscussing
	case slices.ContainsFunc(in.Drafts, func(d DraftState) bool { return pending(d.Draft) }):
		return StatusDeciding
	case slices.ContainsFunc(in.Drafts, func(d DraftState) bool { return d.Draft.Published.Done() }):
		return StatusPublished
	default:
		// Every draft was discarded, so the conversation is where the
		// discussion is again.
		return StatusDiscussing
	}
}

// pending reports whether a draft still asks something of the user or of a
// publication: one to decide on, or an approved one that did not finish.
func pending(d discussion.Draft) bool {
	return !d.Published.Done() && (d.Decision == discussion.DecisionNone || d.Decision == discussion.DecisionApproved)
}

// draftStates is every draft with what can be done to it now.
func draftStates(drafts []discussion.Draft) []DraftState {
	states := make([]DraftState, 0, len(drafts))
	for _, draft := range drafts {
		state := DraftState{Draft: draft}
		if draft.Kind == discussion.KindEpic {
			state.CanPublish, state.Hint = epicReady(draft, drafts)
		} else {
			state.Waits = waits(draft, drafts)
			if epic, ok := epicDraftOf(draft, drafts); ok && epic.Decision == discussion.DecisionDiscarded {
				state.Hint = hintEpicDiscarded
			}
		}
		states = append(states, state)
	}
	return states
}

// waits is the draft an approved card of its own waits for before it is
// published: the first dependency of the discussion that is neither published
// nor discarded.
func waits(draft discussion.Draft, drafts []discussion.Draft) string {
	if !draft.Loose() || draft.Decision != discussion.DecisionApproved || draft.Published.Done() {
		return ""
	}
	for _, dependency := range draft.Dependencies {
		if !dependency.IsDraft() || dependency.Dropped != discussion.DropNone {
			continue
		}
		on, ok := draftOf(drafts, dependency.Draft)
		if !ok || on.Published.Done() || on.Decision == discussion.DecisionDiscarded {
			continue
		}
		return titleOf(on)
	}
	return ""
}

// epicReady says whether an epic can be published now, and why it cannot: its
// cards are all settled, at least two of them are approved, and nothing they
// depend on is still to come.
func epicReady(epic discussion.Draft, drafts []discussion.Draft) (canPublish bool, hint string) {
	if epic.Published.Done() || epic.PublishError != "" {
		return false, ""
	}

	return epicSettled(epic, membersOf(epic, drafts), drafts)
}

// epicSettled says whether every card of an epic is where the run of it needs
// them, and what is missing while they are not.
func epicSettled(epic discussion.Draft, members, drafts []discussion.Draft) (canPublish bool, hint string) {
	approved, undecided := 0, false
	for _, member := range members {
		switch member.Decision {
		case discussion.DecisionApproved:
			approved++
		case discussion.DecisionDiscarded:
		default:
			undecided = true
		}
	}
	switch {
	case approved < minEpicCards:
		return false, hintTooFewCards
	case undecided:
		return false, hintDecideEveryCard
	case epic.Decision != discussion.DecisionApproved:
		return false, hintApproveTheEpic
	}
	if outside := epicWaits(members, drafts); outside != "" {
		return false, hintWaitsFor + outside
	}
	return true, ""
}

// epicWaits is the title of the first draft an approved card of the epic
// depends on and that neither the run of the epic nor an earlier one settles.
func epicWaits(members, drafts []discussion.Draft) string {
	inRun := map[string]bool{}
	for _, member := range members {
		if member.Decision == discussion.DecisionApproved {
			inRun[member.ID] = true
		}
	}
	for _, member := range members {
		if member.Decision != discussion.DecisionApproved {
			continue
		}
		for _, dependency := range member.Dependencies {
			if !dependency.IsDraft() || inRun[dependency.Draft] || dependency.Dropped != discussion.DropNone {
				continue
			}
			on, ok := draftOf(drafts, dependency.Draft)
			if !ok || on.Published.Done() || on.Decision == discussion.DecisionDiscarded {
				continue
			}
			return titleOf(on)
		}
	}
	return ""
}

// canArchive says whether a discussion can leave the list for the history, and
// why it cannot: what was approved goes to GitHub first.
func canArchive(drafts []discussion.Draft) (bool, string) {
	for _, draft := range drafts {
		if draft.PublishError != "" {
			return false, hintPublicationFailed
		}
	}
	for _, draft := range drafts {
		if draft.Decision == discussion.DecisionApproved && !draft.Published.Done() {
			return false, hintWaitingPublication
		}
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

// titleOf names a draft to the user: the title it has, or its id while it has
// none.
func titleOf(draft discussion.Draft) string {
	if draft.Title == "" {
		return draft.ID
	}
	return draft.Title
}
