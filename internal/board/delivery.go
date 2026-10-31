package board

import (
	"fmt"
	"maps"
	"slices"
	"time"

	"github.com/guilhermt/myspec/internal/task"
)

// firstDelivery is the reading the first delivery leaves stored: the open
// cards just read, then every other card of stored as it was. It changes
// nothing of stored, which may be nil.
func firstDelivery(st structure, owner string, stored *Reading, open []itemCard, now time.Time) Reading {
	reading := Reading{
		ProjectID:     st.ProjectID,
		Title:         st.Title,
		Viewer:        st.Viewer,
		Statuses:      st.Statuses,
		HasStatus:     st.HasStatus,
		StatusFieldID: st.StatusFieldID,
		Module:        st.Module,
		Cards:         make([]Card, 0, len(open)),
	}
	var previous []Card
	if stored != nil {
		reading.StructureStamp = stored.StructureStamp
		reading.Index = maps.Clone(stored.Index)
		previous = stored.Cards
	}

	bases := make([]Card, len(open))
	openAt := make(map[string]int, len(open))
	for i, c := range open {
		bases[i] = baseCard(c, st, now)
		openAt[bases[i].Key()] = i
	}
	storedAt := make(map[string]int, len(previous))
	for i, c := range previous {
		storedAt[c.Key()] = i
	}
	d := delivery{bases: bases, openAt: openAt, stored: previous, storedAt: storedAt}

	conventions := conventionsOf(owner, bases)
	for i, c := range open {
		reading.Cards = append(reading.Cards, d.openCard(c.issueNode, conventions[i], bases[i]))
	}
	for _, c := range previous {
		if _, isOpen := openAt[c.Key()]; !isOpen {
			reading.Cards = append(reading.Cards, d.preserved(c))
		}
	}
	return reading
}

// delivery is what the cards of a first delivery are built from: the open
// cards just read and the cards stored, by key.
type delivery struct {
	bases    []Card // the open cards, without relations
	openAt   map[string]int
	stored   []Card
	storedAt map[string]int
}

// openCard is the open card base, of the issue n whose body says convention,
// with the relations the open cards and n confirm and the stored card keeps.
func (d delivery) openCard(n issueNode, convention Convention, base Card) Card {
	c := base
	c.Unconfirmed = true
	var old Card
	var hasOld bool
	if i, ok := d.storedAt[c.Key()]; ok {
		old, hasOld = d.stored[i], true
	}

	switch {
	case n.Parent != nil:
		c.Epic = &Epic{Issue: n.Parent.issue(), Body: n.Parent.Body}
	case convention.Epic != nil:
		if i, ok := d.openAt[convention.Epic.Key()]; ok {
			c.Epic = &Epic{Issue: d.bases[i].Issue, Body: d.bases[i].Body}
			break
		}
		c.EpicUnconfirmed = true
		if hasOld && old.Epic != nil && old.Epic.Key() == convention.Epic.Key() {
			epic := *old.Epic
			c.Epic = &epic
		}
	}

	if hasOld && c.Epic != nil && old.Epic != nil && old.Epic.Key() == c.Epic.Key() {
		c.Siblings = make([]Related, len(old.Siblings))
		for i, s := range old.Siblings {
			if j, ok := d.openAt[s.Key()]; ok {
				s = Related{Issue: d.bases[j].Issue, Status: d.bases[j].Status, OnBoard: true}
			}
			c.Siblings[i] = s
		}
	}

	for _, r := range dependencyRefs(n, convention) {
		c.Dependencies = append(c.Dependencies, d.dependency(r, n, old.Dependencies))
	}
	return c
}

// dependency is the dependency on r of the issue n, whose stored card had the
// dependencies before.
func (d delivery) dependency(r Ref, n issueNode, before []Dependency) Dependency {
	key := r.Key()
	if i, ok := d.openAt[key]; ok {
		c := d.bases[i]
		dep := Dependency{Related: Related{Issue: c.Issue, Status: c.Status, OnBoard: true}, PullRequests: c.PullRequests}
		dep.Satisfied = satisfied(dep)
		return dep
	}

	if i := slices.IndexFunc(n.BlockedBy.Nodes, func(b blockerNode) bool { return b.key() == key }); i >= 0 {
		blocker := n.BlockedBy.Nodes[i]
		dep := Dependency{Related: Related{Issue: blocker.issue()}, PullRequests: blocker.ClosedByPullRequestsReferences.list()}
		if j, ok := d.storedAt[key]; ok {
			dep.Status, dep.OnBoard = d.stored[j].Status, true
		}
		dep.Satisfied = satisfied(dep)
		return dep
	}

	var old *Dependency
	if i := slices.IndexFunc(before, func(o Dependency) bool { return o.Key() == key }); i >= 0 {
		old = &before[i]
		if old.Satisfied {
			return *old
		}
	}

	dep := Dependency{PullRequests: []PullRequest{}, Unconfirmed: true}
	switch j, onStored := d.storedAt[key]; {
	case old != nil:
		dep.Related = old.Related
	case onStored:
		c := d.stored[j]
		dep.Related = Related{Issue: c.Issue, Status: c.Status, OnBoard: true}
	default:
		dep.Issue = Issue{
			Owner:  r.Owner,
			Name:   r.Name,
			Number: r.Number,
			State:  task.IssueOpen,
			URL:    fmt.Sprintf("https://github.com/%s/%s/issues/%d", r.Owner, r.Name, r.Number),
		}
	}
	return dep
}

// preserved is the stored card c in a first delivery: as it was, waiting for
// the conclusion. A dependency not satisfied that is not an open card has no
// state the delivery confirms.
func (d delivery) preserved(c Card) Card {
	c.Unconfirmed = true
	deps := make([]Dependency, len(c.Dependencies))
	for i, dep := range c.Dependencies {
		if _, isOpen := d.openAt[dep.Key()]; !dep.Satisfied && !isOpen {
			dep.Unconfirmed = true
		}
		deps[i] = dep
	}
	c.Dependencies = deps
	return c
}
