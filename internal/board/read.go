package board

import (
	"context"
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

// read reads the board b. extra are keys of cards that must be read even
// when they fall outside the reading: the cards of active tasks. It returns
// them apart from the reading, by key. It fails with a *Failure.
func (s *Service) read(ctx context.Context, b Board, extra []string) (Reading, map[string]Card, error) {
	now := s.now()
	loc := locatorOf(b)
	st, err := s.readStructure(ctx, loc)
	if err != nil {
		return Reading{}, nil, err
	}

	nodes, err := s.readAllItems(ctx, loc, b.ID, st.Title, now)
	if err != nil {
		return Reading{}, nil, err
	}

	reading := Reading{
		ProjectID:     st.ProjectID,
		Title:         st.Title,
		Viewer:        st.Viewer,
		Statuses:      st.Statuses,
		HasStatus:     st.HasStatus,
		StatusFieldID: st.StatusFieldID,
		Module:        st.Module,
		Cards:         make([]Card, 0, len(nodes)),
	}
	onBoard := map[string]bool{}
	for _, n := range nodes {
		reading.Cards = append(reading.Cards, baseCard(n.issueNode, n.values, st, now))
		onBoard[n.key()] = true
	}

	conventions := conventionsOf(loc.Owner, reading.Cards)
	var needs refSet
	for i, n := range nodes {
		if epic, _ := epicRef(n.issueNode, conventions[i]); epic != nil {
			needs.add(*epic)
		}
		for _, dep := range dependencyRefs(n.issueNode, conventions[i]) {
			if !onBoard[dep.Key()] {
				needs.add(dep)
			}
		}
	}
	for _, key := range extra {
		if r, ok := parseKey(key); ok && !onBoard[r.Key()] {
			needs.add(r)
		}
	}

	index, err := s.readBatch(ctx, needs.refs)
	if err != nil {
		return Reading{}, nil, err
	}

	a := newAssembly(st, &reading, conventions, index)
	cards := make([]Card, len(nodes))
	for i, n := range nodes {
		cards[i] = a.assembleCard(reading.Cards[i], n.issueNode, conventions[i])
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
		c := baseCard(n, n.valuesIn(st.ProjectID), st, now)
		if n.Parent != nil {
			c.Epic = &Epic{Issue: n.Parent.issue(), Body: n.Parent.Body}
		}
		extras[r.Key()] = c
	}
	return reading, extras, nil
}

// itemCard is an issue of the items with the values of its item.
type itemCard struct {
	issueNode
	values fieldValuesNode
}

// readAllItems pages through the open issues, then the ones closed in the
// closed window, up to maxCards, skipping what is not an issue and repeats.
// boardID and title name the board in the log.
func (s *Service) readAllItems(ctx context.Context, loc Locator, boardID, title string, now time.Time) ([]itemCard, error) {
	queries := []string{openQuery, closedQuery + now.Add(-closedWindow).Format(dateLayout)}
	var cards []itemCard
	seen := map[string]bool{}
	for _, q := range queries {
		cursor := ""
		for {
			page, err := s.readItems(ctx, loc, q, cursor)
			if err != nil {
				return nil, err
			}
			for _, item := range page.Items {
				if item.Content == nil || item.Content.Typename != typeIssue || seen[item.Content.key()] {
					continue
				}
				if len(cards) == maxCards {
					s.log.Warn("board reading truncated", "board", boardID, "title", title, "cards", maxCards)
					return cards, nil
				}
				seen[item.Content.key()] = true
				cards = append(cards, itemCard{issueNode: item.Content.issueNode, values: item.FieldValues})
			}
			if !page.HasNextPage {
				break
			}
			cursor = page.EndCursor
		}
	}
	return cards, nil
}

// baseCard is what an issue says of itself as a card of the board st: no
// epic, siblings or dependencies yet.
func baseCard(n issueNode, values fieldValuesNode, st structure, now time.Time) Card {
	fields, status := fieldsOf(values, st)
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
		c := a.reading.Cards[i]
		return Related{Issue: c.Issue, Status: c.Status, OnBoard: true}
	}
	return Related{Issue: issue}
}

// dependency resolves the issue of key from the reading, or else from the
// batch with its status in this board.
func (a *assembly) dependency(key string) (Dependency, bool) {
	var d Dependency
	if i, ok := a.onBoard[key]; ok {
		c := a.reading.Cards[i]
		d = Dependency{Related: Related{Issue: c.Issue, Status: c.Status, OnBoard: true}, PullRequests: c.PullRequests}
	} else if n, found := a.index[key]; found {
		_, status := fieldsOf(n.valuesIn(a.structure.ProjectID), a.structure)
		d = Dependency{Related: Related{Issue: n.issue(), Status: status.Name}, PullRequests: n.ClosedByPullRequestsReferences.list()}
	} else {
		return Dependency{}, false
	}
	d.Satisfied = d.State == task.IssueClosed
	for _, pr := range d.PullRequests {
		d.Satisfied = d.Satisfied || pr.State == PRMerged
	}
	return d, true
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
