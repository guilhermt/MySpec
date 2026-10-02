package discussionflow

import (
	"slices"

	"github.com/guilhermt/myspec/internal/discussion"
)

// minEpicCards is how many approved cards an epic needs to be published.
const minEpicCards = 2

// HoldReason is why a draft does not go in the next run.
type HoldReason string

// The reasons a draft is held, in the order they are told; HoldNone is a draft
// that goes, is published, is undecided, is discarded or failed on its own.
const (
	HoldNone          HoldReason = ""
	HoldEpicDiscarded HoldReason = "epic_discarded" // a card of a discarded epic, decided or not
	HoldCards         HoldReason = "cards"          // the epic has cards still to decide
	HoldEpicShort     HoldReason = "epic_short"     // every card of the epic is decided, fewer than two approved
	HoldEpic          HoldReason = "epic"           // the epic of the card does not go for another reason
	HoldDraft         HoldReason = "draft"          // a draft it needs first does not go
)

// Hold is what keeps a draft out of the next run.
type Hold struct {
	Reason   HoldReason
	Title    string // HoldDraft: the draft it waits for, as titleOf names it
	Left     int    // HoldCards: the cards of the epic still to decide
	Approved int    // HoldEpicShort: the approved cards of the epic
	Cards    int    // HoldEpicShort: every card of the epic
}

// chain is the rule of what a discussion publishes, worked out once over its
// drafts: what the next run writes, in order, what holds each draft back, and
// which approved drafts won't publish because they reach a card of a
// discarded epic.
type chain struct {
	drafts []discussion.Draft
	run    []discussion.Draft // the drafts of the next run, in the order GitHub takes them
	cycle  bool               // the order broke a cycle by position
	holds  map[string]Hold
	wont   map[string]bool
}

// chainOf works the chain of a list of drafts out.
func chainOf(drafts []discussion.Draft) chain {
	c := chain{drafts: drafts}

	needs := map[string][]string{}
	for _, d := range drafts {
		if !d.Published.Done() {
			needs[d.ID] = c.needsBefore(d)
		}
	}
	closure := make(map[string][]string, len(needs))
	for id := range needs {
		closure[id] = reach(id, needs)
	}

	due := map[string]bool{}
	var targets []discussion.Draft
	for _, d := range drafts {
		if c.goes(d, closure[d.ID]) {
			due[d.ID] = true
			targets = append(targets, d)
		}
	}
	if len(targets) > 0 {
		c.run, c.cycle = orderTargets(targets)
	}

	for _, d := range drafts {
		if h := c.holdOf(d, needs[d.ID], due); h.Reason != HoldNone {
			if c.holds == nil {
				c.holds = map[string]Hold{}
			}
			c.holds[d.ID] = h
		}
		if d.Decision == discussion.DecisionApproved && !d.Published.Done() &&
			(c.root(d) || slices.ContainsFunc(closure[d.ID], func(id string) bool {
				x, ok := draftOf(drafts, id)
				return ok && c.root(x)
			})) {
			if c.wont == nil {
				c.wont = map[string]bool{}
			}
			c.wont[d.ID] = true
		}
	}
	return c
}

// reach is every draft a draft needs, directly or not, not counting itself. A
// cycle ends the search where it comes back.
func reach(id string, needs map[string][]string) []string {
	visited := map[string]bool{id: true}
	var found []string
	queue := slices.Clone(needs[id])
	for len(queue) > 0 {
		next := queue[0]
		queue = queue[1:]
		if visited[next] {
			continue
		}
		visited[next] = true
		found = append(found, next)
		queue = append(queue, needs[next]...)
	}
	return found
}

// due is what the next run writes, in the order GitHub takes it.
func (c chain) due() []discussion.Draft { return c.run }

// hold is what keeps a draft out of the next run; the zero Hold when nothing
// does.
func (c chain) hold(id string) Hold { return c.holds[id] }

// wontPublish says an approved draft reaches a card of a discarded epic, so
// that it does not go until the user decides otherwise.
func (c chain) wontPublish(id string) bool { return c.wont[id] }

// epicOf is the epic of a card when it is an epic draft of the discussion not
// on GitHub yet. A card whose epic is already there is published on its own,
// as a sub-issue.
func (c chain) epicOf(d discussion.Draft) (discussion.Draft, bool) {
	epic, ok := epicDraftOf(d, c.drafts)
	if !ok || epic.Kind != discussion.KindEpic || epic.Published.Done() {
		return discussion.Draft{}, false
	}
	return epic, true
}

// dependencies are the drafts a draft depends on that still have to be
// published: the ones of the discussion, kept, not published and not
// discarded.
func (c chain) dependencies(d discussion.Draft) []string {
	var ids []string
	for _, dependency := range d.Dependencies {
		if !dependency.IsDraft() || dependency.Dropped != discussion.DropNone {
			continue
		}
		on, ok := draftOf(c.drafts, dependency.Draft)
		if !ok || on.Published.Done() || on.Decision == discussion.DecisionDiscarded {
			continue
		}
		ids = append(ids, on.ID)
	}
	return ids
}

// needsBefore are the drafts that must be published before a draft: for a
// card, its epic and what it depends on; for an epic, what its approved cards
// depend on outside of the epic.
func (c chain) needsBefore(d discussion.Draft) []string {
	if d.IsCard() {
		var ids []string
		if epic, ok := c.epicOf(d); ok {
			ids = append(ids, epic.ID)
		}
		return append(ids, c.dependencies(d)...)
	}
	members := membersOf(d, c.drafts)
	var ids []string
	for _, member := range members {
		if member.Decision != discussion.DecisionApproved || member.Published.Done() {
			continue
		}
		for _, id := range c.dependencies(member) {
			inside := slices.ContainsFunc(members, func(m discussion.Draft) bool {
				return m.ID == id && m.Decision == discussion.DecisionApproved
			})
			if !inside && !slices.Contains(ids, id) {
				ids = append(ids, id)
			}
		}
	}
	return ids
}

// open is the gate of a draft: whether what it belongs to lets it go. A loose
// card has none. A card of an epic goes when the epic does. An epic goes when
// it is on GitHub already, or approved with every card decided and at least two
// of them approved.
func (c chain) open(d discussion.Draft) bool {
	if d.IsCard() {
		epic, ok := c.epicOf(d)
		if !ok {
			return true
		}
		return epic.Decision != discussion.DecisionDiscarded && c.open(epic)
	}
	if d.Published.Started() {
		return true
	}
	if d.Decision != discussion.DecisionApproved {
		return false
	}
	approved := 0
	for _, member := range membersOf(d, c.drafts) {
		if !member.Decided() {
			return false
		}
		if member.Decision == discussion.DecisionApproved {
			approved++
		}
	}
	return approved >= minEpicCards
}

// ok says a draft is no obstacle to what needs it: it is published, or it is
// approved, has not failed and goes through its own gate.
func (c chain) ok(id string) bool {
	x, found := draftOf(c.drafts, id)
	if !found {
		return false
	}
	return x.Published.Done() || (x.Decision == discussion.DecisionApproved && x.PublishError == "" && c.open(x))
}

// goes says a draft is written in the next run: approved, not on GitHub yet,
// not failed, through its gate, and with everything it needs able to go too.
func (c chain) goes(d discussion.Draft, closure []string) bool {
	return d.Decision == discussion.DecisionApproved && !d.Published.Done() && d.PublishError == "" &&
		c.open(d) && !slices.ContainsFunc(closure, func(id string) bool { return !c.ok(id) })
}

// root says a draft is a card that won't publish because its epic is
// discarded.
func (c chain) root(d discussion.Draft) bool {
	if !d.IsCard() || d.Published.Done() || d.Decision == discussion.DecisionDiscarded {
		return false
	}
	epic, ok := c.epicOf(d)
	return ok && epic.Decision == discussion.DecisionDiscarded
}

// holdOf is what keeps a draft out of the run, with needs the drafts that come
// before it and due the ones that go.
func (c chain) holdOf(d discussion.Draft, needs []string, due map[string]bool) Hold {
	if d.Published.Done() || due[d.ID] || d.PublishError != "" || d.Decision == discussion.DecisionDiscarded {
		return Hold{}
	}
	epic, inEpic := c.epicOf(d)
	if d.IsCard() && inEpic && epic.Decision == discussion.DecisionDiscarded {
		return Hold{Reason: HoldEpicDiscarded}
	}
	if d.Decision != discussion.DecisionApproved {
		return Hold{}
	}
	gate, gated := d, d.Kind == discussion.KindEpic
	if inEpic {
		gate, gated = epic, true
	}
	if gated && gate.Decision == discussion.DecisionApproved && !gate.Published.Started() {
		members := membersOf(gate, c.drafts)
		left, approved := 0, 0
		for _, member := range members {
			switch {
			case !member.Decided():
				left++
			case member.Decision == discussion.DecisionApproved:
				approved++
			}
		}
		if left > 0 {
			return Hold{Reason: HoldCards, Left: left}
		}
		if approved < minEpicCards {
			return Hold{Reason: HoldEpicShort, Approved: approved, Cards: len(members)}
		}
	}
	if inEpic && !due[epic.ID] {
		return Hold{Reason: HoldEpic}
	}
	for _, id := range needs {
		if !due[id] {
			on, _ := draftOf(c.drafts, id)
			return Hold{Reason: HoldDraft, Title: titleOf(on)}
		}
	}
	return Hold{}
}
