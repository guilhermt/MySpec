package board

import (
	"context"
	"maps"
	"slices"
	"strings"
	"time"

	"github.com/guilhermt/myspec/internal/task"
)

const (
	// closedWindow is how far back closed issues are read.
	closedWindow = 14 * 24 * time.Hour
	// maxCards is the most issues one reading takes.
	maxCards = 2000
	// maxSuggestionItems is the most items the repository suggestion pages through.
	maxSuggestionItems = 5000
	// batchSize is how many issues one batch query reads.
	batchSize = 50
	// maxChangedClosed is the most closed cards a reading reads by key: past it,
	// the pages of the closed items cost less.
	maxChangedClosed = batchSize
	// readTimeout bounds a whole reading.
	readTimeout = 3 * time.Minute
)

// The item queries of a reading: the open issues, then the closed ones since a
// date.
const (
	openQuery   = "is:issue is:open"
	closedQuery = "is:issue is:closed closed:>="
)

// suggestionQuery is the item query of the repository suggestion.
const suggestionQuery = "is:issue"

// dateLayout is how the closed query writes its date.
const dateLayout = "2006-01-02"

// assembly is what assembling a card needs besides the card: the board, the
// reading it belongs to and the issues the batch read.
type assembly struct {
	structure structure
	reading   *Reading             // its cards carry what the items or the batch read of them
	onBoard   map[string]int       // by key: the position of a card in reading.Cards
	byEpic    map[string][]int     // by the key of a convention epic: the positions of its cards
	index     map[string]issueNode // by key: the issues the batch read
}

// newAssembly indexes reading, whose cards conventions follows one by one.
func newAssembly(st structure, reading *Reading, conventions []Convention, index map[string]issueNode) *assembly {
	a := &assembly{
		structure: st,
		reading:   reading,
		onBoard:   map[string]int{},
		byEpic:    map[string][]int{},
		index:     index,
	}
	for i, c := range reading.Cards {
		a.onBoard[c.Key()] = i
		if epic := conventions[i].Epic; epic != nil {
			a.byEpic[epic.Key()] = append(a.byEpic[epic.Key()], i)
		}
	}
	return a
}

// conventionsOf reads the convention of each card of a board at owner once, so
// the assembly parses no body twice.
func conventionsOf(owner string, cards []Card) []Convention {
	conventions := make([]Convention, len(cards))
	for i, c := range cards {
		conventions[i] = ReadConvention(c.Body, owner, c.Owner, c.Name)
	}
	return conventions
}

// readResult is what a reading found and what it took.
type readResult struct {
	reading       Reading
	extras        map[string]Card // by key: the extra cards, apart from the reading
	changedCards  int             // closed cards read by key
	changedIssues int             // issues of the index read again
	fullClosed    bool            // the closed cards were read page by page
}

// outcome is what a reading in the background came back with.
type outcome[T any] struct {
	value T
	err   error
}

// inBackground runs fn in a goroutine. The channel holds one answer, so a
// goroutine nobody waits for ends without leaking.
func inBackground[T any](fn func() (T, error)) <-chan outcome[T] {
	ch := make(chan outcome[T], 1)
	go func() {
		value, err := fn()
		ch <- outcome[T]{value: value, err: err}
	}()
	return ch
}

// read reads the board b. extra are keys of cards that must be read even
// when they fall outside the reading: the cards of active tasks. It returns
// them apart from the reading, by key. deliver is called with the first
// delivery, the reading with the open cards read and the other cards as they
// were stored, and how many cards at its start are open. It fails with a
// *Failure.
func (s *Service) read(ctx context.Context, b Board, extra []string, deliver func(Reading, int)) (readResult, error) {
	now := s.now()
	loc := locatorOf(b)
	stored := s.Stored(b.ID).Reading
	// The stored reading says what the closed cards and the index were read
	// under only when it carries the stamp of its structure.
	incremental := stored != nil && stored.StructureStamp != ""

	structureC := inBackground(func() (structure, error) { return s.readStructure(ctx, loc) })
	openC := inBackground(func() (pages, error) {
		items, truncated, err := s.readPages(ctx, loc, itemsQuery, openQuery)
		return pages{items: items, truncated: truncated}, err
	})
	closedQ := closedQuery + now.Add(-closedWindow).Format(dateLayout)
	closedC := inBackground(func() (pages, error) { return s.readClosed(ctx, loc, closedQ, incremental) })
	stampsC := inBackground(func() (map[string]issueNode, error) {
		if !incremental || len(stored.Index) == 0 {
			return nil, nil
		}
		refs := make([]Ref, 0, len(stored.Index))
		for _, key := range slices.Sorted(maps.Keys(stored.Index)) {
			if r, ok := parseKey(key); ok {
				refs = append(refs, r)
			}
		}
		return s.readStamps(ctx, refs)
	})

	structured := <-structureC
	if structured.err != nil {
		return readResult{}, structured.err
	}
	st := structured.value
	opened := <-openC
	if opened.err != nil {
		return readResult{}, opened.err
	}
	open := opened.value.items
	if opened.value.truncated {
		s.log.Warn("board reading truncated", "board", b.ID, "title", st.Title, "cards", maxCards)
	}

	if stored != nil || len(open) > 0 {
		deliver(firstDelivery(st, loc.Owner, stored, open, now), len(open))
	}

	closed := <-closedC
	if closed.err != nil {
		return readResult{}, closed.err
	}
	// What the stored reading kept holds only under the structure it was read
	// under.
	sameStructure := incremental && st.Stamp == stored.StructureStamp
	settled, err := s.settleClosed(ctx, loc, st, stored, closedQ, closed.value, incremental, sameStructure, open, now)
	if err != nil {
		return readResult{}, err
	}
	if settled.truncated {
		s.log.Warn("board reading truncated", "board", b.ID, "title", st.Title, "cards", maxCards)
	}

	bases := make([]Card, 0, len(open)+len(settled.cards))
	nodes := make([]issueNode, 0, cap(bases))
	for _, c := range open {
		bases = append(bases, baseCard(c, st, now))
		nodes = append(nodes, c.issueNode)
	}
	bases = append(bases, settled.cards...)
	nodes = append(nodes, settled.nodes...)
	onBoard := make(map[string]bool, len(bases))
	for _, c := range bases {
		onBoard[c.Key()] = true
	}

	reading := Reading{
		ProjectID:      st.ProjectID,
		Title:          st.Title,
		Viewer:         st.Viewer,
		Statuses:       st.Statuses,
		HasStatus:      st.HasStatus,
		StatusFieldID:  st.StatusFieldID,
		Module:         st.Module,
		Cards:          bases,
		StructureStamp: st.Stamp,
	}

	conventions := conventionsOf(loc.Owner, reading.Cards)
	var needs refSet
	for i, n := range nodes {
		if epic, _ := epicRef(n, conventions[i]); epic != nil {
			needs.add(*epic)
		}
		for _, dep := range dependencyRefs(n, conventions[i]) {
			if !onBoard[dep.Key()] {
				needs.add(dep)
			}
		}
	}
	// Only the issues the cards need are kept in the index.
	cardNeeds := maps.Clone(needs.seen)
	extraKeys := map[string]bool{}
	for _, key := range extra {
		if r, ok := parseKey(key); ok && !onBoard[r.Key()] {
			extraKeys[r.Key()] = true
			needs.add(r)
		}
	}

	stamps := <-stampsC
	if stamps.err != nil {
		return readResult{}, stamps.err
	}
	index := make(map[string]issueNode, len(needs.refs))
	kept := make(map[string]indexedIssue, len(needs.refs))
	var reread []Ref
	for _, r := range needs.refs {
		key := r.Key()
		if old, ok := stored.indexed(key); ok && sameStructure && !extraKeys[key] {
			if n, found := stamps.value[key]; found && indexStamp(n, st.ProjectID) == old.Stamp {
				index[key], kept[key] = old.issueNode, old
				continue
			}
		}
		reread = append(reread, r)
	}
	found, err := s.readBatch(ctx, reread)
	if err != nil {
		return readResult{}, err
	}
	for key, n := range found {
		index[key] = n
		if cardNeeds[key] {
			kept[key] = indexedOf(n, st.ProjectID)
		}
	}
	reading.Index = kept

	a := newAssembly(st, &reading, conventions, index)
	cards := make([]Card, len(nodes))
	for i, n := range nodes {
		cards[i] = a.assembleCard(reading.Cards[i], n, conventions[i])
	}
	reading.Cards = cards

	extras := map[string]Card{}
	for _, key := range extra {
		r, ok := parseKey(key)
		if !ok || onBoard[r.Key()] {
			continue
		}
		n, found := index[r.Key()]
		if !found {
			continue
		}
		c := baseCard(n.itemIn(st.ProjectID), st, now)
		if n.Parent != nil {
			c.Epic = &Epic{Issue: n.Parent.issue(), Body: n.Parent.Body}
		}
		extras[r.Key()] = c
	}
	return readResult{
		reading:       reading,
		extras:        extras,
		changedCards:  settled.changed,
		changedIssues: len(reread),
		fullClosed:    settled.full,
	}, nil
}

// indexed is the issue of key the reading kept in its index.
func (r *Reading) indexed(key string) (indexedIssue, bool) {
	if r == nil {
		return indexedIssue{}, false
	}
	n, ok := r.Index[key]
	return n, ok
}

// readClosed reads the closed items of the query q: their stamps when the stored
// reading can tell what changed, otherwise the complete items.
func (s *Service) readClosed(ctx context.Context, loc Locator, q string, minimal bool) (pages, error) {
	template := itemsQuery
	if minimal {
		template = stampsQuery
	}
	items, truncated, err := s.readPages(ctx, loc, template, q)
	return pages{items: items, truncated: truncated}, err
}

// closedCards are the closed cards of a reading, each with the issue its
// relations come from.
type closedCards struct {
	cards     []Card
	nodes     []issueNode
	changed   int  // read by key
	full      bool // read page by page
	truncated bool // the list went past maxCards
}

// settleClosed turns the closed items of the query q into cards. When
// listMinimal, the items are stamps: a card the stored reading holds with the
// same stamp is kept, and the others are read by key, or page by page when the
// structure changed or too many did. open are the open items.
func (s *Service) settleClosed(ctx context.Context, loc Locator, st structure, stored *Reading, q string, closed pages, listMinimal, sameStructure bool, open []itemCard, now time.Time) (closedCards, error) {
	openKeys := make(map[string]bool, len(open))
	for _, n := range open {
		openKeys[n.key()] = true
	}
	items, cut := limitClosed(closed.items, openKeys, maxCards-len(open))
	out := closedCards{truncated: closed.truncated || cut}

	unchanged := map[string]Card{}
	var changed []itemCard
	if listMinimal {
		storedAt := make(map[string]int, len(stored.Cards))
		for i, c := range stored.Cards {
			storedAt[c.Key()] = i
		}
		for _, item := range items {
			if i, ok := storedAt[item.key()]; ok && stored.Cards[i].Stamp != "" && stored.Cards[i].Stamp == cardStamp(item) {
				unchanged[item.key()] = unchangedCard(stored.Cards[i], now)
			} else {
				changed = append(changed, item)
			}
		}
		if !sameStructure || len(changed) > maxChangedClosed {
			full, truncated, err := s.readPages(ctx, loc, itemsQuery, q)
			if err != nil {
				return closedCards{}, err
			}
			items, cut = limitClosed(full, openKeys, maxCards-len(open))
			out.truncated = truncated || cut
			listMinimal = false
		}
	}

	if !listMinimal {
		out.full = true
		for _, item := range items {
			out.cards = append(out.cards, baseCard(item, st, now))
			out.nodes = append(out.nodes, item.issueNode)
		}
		return out, nil
	}

	refs := make([]Ref, len(changed))
	for i, item := range changed {
		owner, name := item.Repository.split()
		refs[i] = Ref{Owner: owner, Name: name, Number: item.Number}
	}
	found, err := s.readBatch(ctx, refs)
	if err != nil {
		return closedCards{}, err
	}
	out.changed = len(changed)
	for _, item := range items {
		if c, ok := unchanged[item.key()]; ok {
			out.cards = append(out.cards, c)
			out.nodes = append(out.nodes, item.issueNode)
		} else if n, ok := found[item.key()]; ok {
			out.cards = append(out.cards, baseCard(n.itemIn(st.ProjectID), st, now))
			out.nodes = append(out.nodes, n)
		}
	}
	return out, nil
}

// limitClosed is the closed items that are not open, up to room. cut reports a
// list that went past room.
func limitClosed(items []itemCard, openKeys map[string]bool, room int) (kept []itemCard, cut bool) {
	for _, n := range items {
		if openKeys[n.key()] {
			continue
		}
		if room == 0 {
			return kept, true
		}
		room--
		kept = append(kept, n)
	}
	return kept, false
}

// unchangedCard is the stored closed card c read again at now: its relations
// are assembled anew.
func unchangedCard(c Card, now time.Time) Card {
	c.Epic = nil
	c.Siblings = []Related{}
	c.Dependencies = []Dependency{}
	c.ReadAt = now
	c.Unconfirmed = false
	c.EpicUnconfirmed = false
	return c
}

// pages is the items one query matched.
type pages struct {
	items     []itemCard
	truncated bool // the list went past maxCards
}

// itemCard is an issue of the items with the values and the update time of its
// item.
type itemCard struct {
	issueNode
	values    fieldValuesNode
	updatedAt string // the update time of the item
}

// readPages pages through the items that match q with the query template, up
// to maxCards, skipping what is not an issue and repeats. truncated reports a
// list that went past maxCards.
func (s *Service) readPages(ctx context.Context, loc Locator, template, q string) (items []itemCard, truncated bool, err error) {
	seen := map[string]bool{}
	cursor := ""
	for {
		page, err := s.readItems(ctx, loc, template, q, cursor)
		if err != nil {
			return nil, false, err
		}
		for _, item := range page.Items {
			if item.Content == nil || item.Content.Typename != typeIssue || seen[item.Content.key()] {
				continue
			}
			if len(items) == maxCards {
				return items, true, nil
			}
			seen[item.Content.key()] = true
			items = append(items, itemCard{issueNode: item.Content.issueNode, values: item.FieldValues, updatedAt: item.UpdatedAt})
		}
		if !page.HasNextPage {
			return items, false, nil
		}
		cursor = page.EndCursor
	}
}

// baseCard is what an issue says of itself as a card of the board st: no
// epic, siblings or dependencies yet.
func baseCard(c itemCard, st structure, now time.Time) Card {
	n := c.issueNode
	fields, status := fieldsOf(c.values, st)
	assignees := n.Assignees.Nodes
	if assignees == nil {
		assignees = []Assignee{}
	}
	return Card{
		Issue:        n.issue(),
		Body:         n.Body,
		StatusID:     status.ID,
		Status:       status.Name,
		Assignees:    assignees,
		Fields:       fields,
		PullRequests: n.ClosedByPullRequestsReferences.list(),
		Siblings:     []Related{},
		Dependencies: []Dependency{},
		ReadAt:       now,
		Stamp:        cardStamp(c),
	}
}

// assembleCard completes base, the card of n whose body says convention, with
// its epic, its siblings and its dependencies.
func (a *assembly) assembleCard(base Card, n issueNode, convention Convention) Card {
	c := base
	parent, fromConvention := epicRef(n, convention)
	if parent != nil {
		if epic, ok := a.index[parent.Key()]; ok {
			c.Epic = &Epic{Issue: epic.issue(), Body: epic.Body}
			c.Siblings = a.siblings(c.Key(), parent.Key(), epic, fromConvention)
		}
	}
	for _, r := range dependencyRefs(n, convention) {
		if dep, ok := a.dependency(r.Key()); ok {
			c.Dependencies = append(c.Dependencies, dep)
		}
	}
	return c
}

// siblings are the other issues of epic: its sub-issues and, for an epic the
// convention names, the cards that name it too.
func (a *assembly) siblings(cardKey, epicKey string, epic issueNode, fromConvention bool) []Related {
	siblings := []Related{}
	seen := map[string]bool{cardKey: true}
	for _, sub := range epic.SubIssues.Nodes {
		if key := sub.key(); !seen[key] {
			seen[key] = true
			siblings = append(siblings, a.related(sub.issue()))
		}
	}
	if fromConvention {
		for _, i := range a.byEpic[epicKey] {
			if c := a.reading.Cards[i]; !seen[c.Key()] {
				seen[c.Key()] = true
				siblings = append(siblings, a.related(c.Issue))
			}
		}
	}
	return siblings
}

// related is issue next to a card, with its status when it is a card of the
// reading.
func (a *assembly) related(issue Issue) Related {
	if i, ok := a.onBoard[issue.Key()]; ok {
		return Related{Issue: issue, Status: a.reading.Cards[i].Status, OnBoard: true}
	}
	return Related{Issue: issue}
}

// dependency resolves the issue of key from the reading, or else from the
// batch with its status in this board.
func (a *assembly) dependency(key string) (Dependency, bool) {
	var d Dependency
	if n, found := a.index[key]; found {
		_, status := fieldsOf(n.itemIn(a.structure.ProjectID).values, a.structure)
		_, onBoard := a.onBoard[key]
		d = Dependency{Related: Related{Issue: n.issue(), Status: status.Name, OnBoard: onBoard}, PullRequests: n.ClosedByPullRequestsReferences.list()}
	} else if i, ok := a.onBoard[key]; ok {
		c := a.reading.Cards[i]
		d = Dependency{Related: Related{Issue: c.Issue, Status: c.Status, OnBoard: true}, PullRequests: c.PullRequests}
	} else {
		return Dependency{}, false
	}
	d.Satisfied = satisfied(d)
	return d, true
}

// satisfied tells whether d is closed or has a merged pull request.
func satisfied(d Dependency) bool {
	if d.State == task.IssueClosed {
		return true
	}
	return slices.ContainsFunc(d.PullRequests, func(pr PullRequest) bool { return pr.State == PRMerged })
}

// epicRef is the epic of an issue: its native parent, otherwise the epic of the
// convention, which fromConvention reports.
func epicRef(n issueNode, c Convention) (ref *Ref, fromConvention bool) {
	if n.Parent != nil {
		owner, name := n.Parent.Repository.split()
		return &Ref{Owner: owner, Name: name, Number: n.Parent.Number}, false
	}
	return c.Epic, c.Epic != nil
}

// dependencyRefs are the dependencies of an issue whose body says convention:
// the native ones in order, then those of the convention, without repetition.
func dependencyRefs(n issueNode, convention Convention) []Ref {
	var refs refSet
	for _, b := range n.BlockedBy.Nodes {
		owner, name := b.Repository.split()
		refs.add(Ref{Owner: owner, Name: name, Number: b.Number})
	}
	for _, r := range convention.Dependencies {
		refs.add(r)
	}
	return refs.refs
}

// refSet is a list of references without repetition, in first-seen order.
type refSet struct {
	refs []Ref
	seen map[string]bool
}

func (s *refSet) add(r Ref) {
	if s.seen == nil {
		s.seen = map[string]bool{}
	}
	if !s.seen[r.Key()] {
		s.seen[r.Key()] = true
		s.refs = append(s.refs, r)
	}
}

// parseKey reads a card key, owner/name#number.
func parseKey(key string) (Ref, bool) {
	fullName, number, ok := strings.Cut(key, "#")
	if !ok {
		return Ref{}, false
	}
	owner, name, ok := strings.Cut(fullName, "/")
	if !ok || owner == "" || name == "" {
		return Ref{}, false
	}
	return ref(owner, name, number)
}
