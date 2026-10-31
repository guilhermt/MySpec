package board_test

import (
	"encoding/json"
	"errors"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/board"
)

// The times the world updates its issues at.
const (
	timeOne = "2026-09-10T10:00:00Z"
	timeTwo = "2026-09-12T10:00:00Z"
)

// entry is an issue of the board in the world, with its item.
type entry struct {
	content node
	values  []node
	at      string // when its item was updated
}

// world is what GitHub holds of the board, which the tests change between two
// readings. It answers the complete queries and the queries of stamps alike.
type world struct {
	structure reply
	open      []entry
	closed    []entry
	outside   []node          // issues in no item of the board
	hidden    map[string]bool // keys the batches do not find
	closedErr error           // what the closed items answer instead of their list
}

// closedEntry is a closed issue, done, updated at timeOne.
func closedEntry(fullName string, number int) entry {
	content := with(with(issueNode(fullName, number), "state", "CLOSED"), "updatedAt", timeOne)
	return entry{content: content, values: []node{statusValue(done)}, at: timeOne}
}

// newWorld is a board with an open card that has an epic and a dependency
// outside the reading, and three closed cards, one of them of the same epic.
func newWorld() *world {
	one := with(with(issueNode("acme/web", 1), "body", "Epic: acme/web#10\nDepends on: acme/web#20"), "updatedAt", timeOne)
	two := closedEntry("acme/web", 2)
	two.content["closedByPullRequestsReferences"] = nodes(pr("acme/web", 7, "OPEN"))
	three := closedEntry("acme/web", 3)
	three.content["body"] = "Epic: acme/web#10"
	epic := with(with(issueNode("acme/web", 10), "body", "Epic body"), "updatedAt", timeOne)
	epic["subIssues"] = nodes(with(brief("acme/web", 1), "updatedAt", timeOne), with(brief("acme/web", 3), "updatedAt", timeOne))
	dependency := onItem(with(issueNode("acme/web", 20), "updatedAt", timeOne), timeOne, todo)
	return &world{
		structure: structure("Roadmap"),
		open:      []entry{{content: one, values: []node{statusValue(doing)}, at: timeOne}},
		closed:    []entry{two, three, closedEntry("acme/web", 4)},
		outside:   []node{epic, dependency},
		hidden:    map[string]bool{},
	}
}

// onItem is the issue n with its item in the board, updated at at.
func onItem(n node, at string, status board.Option) node {
	return with(n, "projectItems", nodes(node{"project": node{"id": projectID}, "updatedAt": at, "fieldValues": nodes(statusValue(status))}))
}

// nodeKey is the key of the issue node n.
func nodeKey(n node) string {
	return strings.ToLower(n["repository"].(node)["nameWithOwner"].(string)) + "#" + strconv.Itoa(n["number"].(int))
}

// issue is the issue of key as the batch reads it.
func (w *world) issue(key string) (node, bool) {
	if w.hidden[key] {
		return nil, false
	}
	for _, e := range slices.Concat(w.open, w.closed) {
		if nodeKey(e.content) == key {
			return with(e.content, "projectItems", nodes(node{"project": node{"id": projectID}, "updatedAt": e.at, "fieldValues": nodes(e.values...)})), true
		}
	}
	for _, n := range w.outside {
		if nodeKey(n) == key {
			return n, true
		}
	}
	return nil, false
}

// list answers the items of entries, complete or as stamps.
func (w *world) list(entries []entry, stamps bool) reply {
	items := make([]node, len(entries))
	for i, e := range entries {
		if stamps {
			items[i] = node{"updatedAt": e.at, "content": stampContent(e.content)}
		} else {
			items[i] = with(item(e.content, e.values...), "updatedAt", e.at)
		}
	}
	return itemsPage("", items...)
}

// stampContent is the issue as the query of the stamps of the items reads it.
func stampContent(c node) node {
	var parent any
	if p, ok := c["parent"].(node); ok {
		parent = node{"number": p["number"], "repository": p["repository"]}
	}
	blocked := c["blockedBy"].(node)["nodes"].([]node)
	blockers := make([]node, 0, len(blocked))
	for _, b := range blocked {
		blockers = append(blockers, node{"number": b["number"], "repository": b["repository"]})
	}
	return node{
		"__typename": "Issue", "number": c["number"], "updatedAt": c["updatedAt"], "repository": c["repository"],
		"parent": parent, "blockedBy": nodes(blockers...), "closedByPullRequestsReferences": stampPRs(c),
	}
}

func stampPRs(c node) node {
	linked := c["closedByPullRequestsReferences"].(node)["nodes"].([]node)
	prs := make([]node, 0, len(linked))
	for _, p := range linked {
		prs = append(prs, node{"number": p["number"], "state": p["state"], "repository": p["repository"]})
	}
	return nodes(prs...)
}

// stampIssue is the issue n as the batch of stamps reads it.
func stampIssue(n node) node {
	listed := n["subIssues"].(node)["nodes"].([]node)
	subs := make([]node, 0, len(listed))
	for _, sub := range listed {
		subs = append(subs, node{"number": sub["number"], "updatedAt": sub["updatedAt"], "repository": sub["repository"]})
	}
	held := n["projectItems"].(node)["nodes"].([]node)
	items := make([]node, 0, len(held))
	for _, it := range held {
		items = append(items, node{"updatedAt": it["updatedAt"], "project": it["project"]})
	}
	return node{
		"number": n["number"], "updatedAt": n["updatedAt"], "repository": n["repository"],
		"subIssues": nodes(subs...), "closedByPullRequestsReferences": stampPRs(n), "projectItems": nodes(items...),
	}
}

var batchAlias = regexp.MustCompile(`(i\d+): repository\(owner: "([^"]+)", name: "([^"]+)"\) \{ issue\(number: (\d+)\)`)

// batchReply answers a batch query from the world, with the stamps of the
// issues when stamps.
func (w *world) batchReply(stamps bool) func(string) reply {
	return func(query string) reply {
		answer := node{}
		for _, m := range batchAlias.FindAllStringSubmatch(query, -1) {
			n, ok := w.issue(strings.ToLower(m[2]+"/"+m[3]) + "#" + m[4])
			switch {
			case !ok:
				answer[m[1]] = node{"issue": nil}
			case stamps:
				answer[m[1]] = node{"issue": stampIssue(n)}
			default:
				answer[m[1]] = node{"issue": n}
			}
		}
		return data(answer)
	}
}

// install makes the fake GitHub answer from the world, forgetting the calls so
// far. The stamps of the closed items answer before their complete pages.
func (w *world) install(f *fixture) {
	g := f.github
	g.reset()
	g.answer(structureMatch, "", w.structure)
	g.answer(itemsMatch, openQ, w.list(w.open, false))
	if w.closedErr != nil {
		g.answer(stampsMatch, closedQ, reply{err: w.closedErr})
		g.answer(itemsMatch, closedQ, reply{err: w.closedErr})
	} else {
		g.answer(stampsMatch, closedQ, w.list(w.closed, true))
		g.answer(itemsMatch, closedQ, w.list(w.closed, false))
	}
	g.answerWith(batchMatch, "", w.batchReply(false))
	g.answerWith(stampBatchMatch, "", w.batchReply(true))
}

// readTwice reads the board in the world, lets change alter the world and
// reads it again.
func readTwice(t *testing.T, w *world, change func(*world), extra ...string) *fixture {
	t.Helper()

	f := newFixture(t, board.Stored{})
	f.taskCards = extra
	w.install(f)
	f.refresh(t)
	if failure := f.service.Stored(boardID).Failure; failure != nil {
		t.Fatalf("the first reading failed: %v", failure)
	}
	change(w)
	w.install(f)
	f.refresh(t)
	return f
}

// fullClosedPages is how many pages of the closed items the fake GitHub gave
// in full.
func fullClosedPages(f *fixture) int {
	n := 0
	for _, c := range f.github.received(itemsMatch) {
		if c.vars["q"] == closedQ && !strings.Contains(c.query, stampsMatch) {
			n++
		}
	}
	return n
}

// batched are the keys the batches matching match asked for, in order.
func batched(f *fixture, match string) []string {
	var keys []string
	for _, c := range f.github.received(match) {
		for _, m := range batchAlias.FindAllStringSubmatch(c.query, -1) {
			keys = append(keys, strings.ToLower(m[2]+"/"+m[3])+"#"+m[4])
		}
	}
	return keys
}

// card is the card of key in the stored reading.
func card(t *testing.T, f *fixture, key string) board.Card {
	t.Helper()

	reading := f.service.Stored(boardID).Reading
	for _, c := range reading.Cards {
		if c.Key() == key {
			return c
		}
	}
	t.Fatalf("the stored reading has no card %s: %v", key, keysOf(reading.Cards))
	return board.Card{}
}

// readLog is the attributes the last "board read" record has.
func readLog(t *testing.T, f *fixture) (changedCards, changedIssues int, fullClosed bool) {
	t.Helper()

	record := f.logs.last("board read")
	if record == nil {
		t.Fatal("no \"board read\" record")
	}
	cards, _ := record["changed_cards"].(float64)
	issues, _ := record["changed_issues"].(float64)
	full, _ := record["full_closed"].(bool)
	return int(cards), int(issues), full
}

// asJSON is the reading as the store keeps it.
func asJSON(t *testing.T, r *board.Reading) string {
	t.Helper()

	raw, err := json.Marshal(r)
	if err != nil {
		t.Fatal(err)
	}
	return string(raw)
}

func TestAReadingWithNothingChangedReadsNoCardInFull(t *testing.T) {
	t.Parallel()

	w := newWorld()
	f := newFixture(t, board.Stored{})
	w.install(f)
	f.refresh(t)
	first := asJSON(t, f.service.Stored(boardID).Reading)

	w.install(f)
	f.refresh(t)

	if got := f.github.received(batchMatch); len(got) != 0 {
		t.Errorf("%d complete batches, want none", len(got))
	}
	if got := fullClosedPages(f); got != 0 {
		t.Errorf("%d complete pages of the closed items, want none", got)
	}
	if got := len(f.github.received(stampsMatch)); got != 1 {
		t.Errorf("%d queries of closed stamps, want 1", got)
	}
	if diff := cmp.Diff([]string{"acme/web#10", "acme/web#20"}, batched(f, stampBatchMatch)); diff != "" {
		t.Errorf("issues of the index whose stamps were read (-want +got):\n%s", diff)
	}
	if got := asJSON(t, f.service.Stored(boardID).Reading); got != first {
		t.Errorf("the reading changed with nothing changed:\nfirst: %s\nthen:  %s", first, got)
	}
	if cards, issues, full := readLog(t, f); cards != 0 || issues != 0 || full {
		t.Errorf("board read = changed_cards %d, changed_issues %d, full_closed %v, want 0, 0, false", cards, issues, full)
	}
}

func TestTheFirstReadingOfABoardReadsTheClosedCardsPageByPage(t *testing.T) {
	t.Parallel()

	w := newWorld()
	f := newFixture(t, board.Stored{})
	w.install(f)
	f.refresh(t)

	if got := len(f.github.received(stampsMatch)); got != 0 {
		t.Errorf("%d queries of closed stamps, want none", got)
	}
	if got := fullClosedPages(f); got != 1 {
		t.Errorf("%d complete pages of the closed items, want 1", got)
	}
	stored := f.service.Stored(boardID).Reading
	if stored.StructureStamp == "" || len(stored.Index) != 2 {
		t.Errorf("stored structure stamp %q with %d indexed issues, want the stamp and 2 issues", stored.StructureStamp, len(stored.Index))
	}
	for _, c := range stored.Cards {
		if c.Stamp == "" {
			t.Errorf("card %s has no stamp", c.Key())
		}
	}
	if _, _, full := readLog(t, f); !full {
		t.Error("board read full_closed = false, want true")
	}
}

func TestAStoredReadingWithoutStampsReadsEverythingInFull(t *testing.T) {
	t.Parallel()

	w := newWorld()
	stored := board.Stored{
		Reading: &board.Reading{ProjectID: projectID, Title: "Roadmap", Cards: []board.Card{storedCard("acme/web", 2, done), storedCard("acme/web", 3, done)}},
		ReadAt:  base.Add(-time.Hour),
	}
	f := newFixture(t, stored)
	w.install(f)
	f.refresh(t)

	if got := len(f.github.received(stampsMatch)) + len(f.github.received(stampBatchMatch)); got != 0 {
		t.Errorf("%d queries of stamps, want none", got)
	}
	if got := fullClosedPages(f); got != 1 {
		t.Errorf("%d complete pages of the closed items, want 1", got)
	}
	if _, _, full := readLog(t, f); !full {
		t.Error("board read full_closed = false, want true")
	}
}

// changes are the rows of the table of what a stamp covers: each one changes
// something on GitHub and expects the reading to show it.
func TestEveryChangeTheStampsCoverAppearsInTheReading(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name   string
		change func(*world)
		check  func(t *testing.T, f *fixture)
	}{
		{
			name: "the title, the body, the state and the assignees",
			change: func(w *world) {
				w.closed[0].content = with(with(w.closed[0].content, "title", "Renamed"), "updatedAt", timeTwo)
			},
			check: func(t *testing.T, f *fixture) {
				t.Helper()
				if got := card(t, f, "acme/web#2").Title; got != "Renamed" {
					t.Errorf("title = %q, want Renamed", got)
				}
				wantRead(t, f, []string{"acme/web#2"}, 1, 0)
			},
		},
		{
			name: "the repository, a transfer or a rename",
			change: func(w *world) {
				w.closed[2].content = with(issueNode("acme/api", 4), "state", "CLOSED")
			},
			check: func(t *testing.T, f *fixture) {
				t.Helper()
				keys := keysOf(f.service.Stored(boardID).Reading.Cards)
				if !slices.Contains(keys, "acme/api#4") || slices.Contains(keys, "acme/web#4") {
					t.Errorf("cards = %v, want the issue under its new repository only", keys)
				}
				wantRead(t, f, []string{"acme/api#4"}, 1, 0)
			},
		},
		{
			name: "the status and the other fields",
			change: func(w *world) {
				w.closed[0].values, w.closed[0].at = []node{statusValue(doing), numberValue("Estimate", 3)}, timeTwo
			},
			check: func(t *testing.T, f *fixture) {
				t.Helper()
				c := card(t, f, "acme/web#2")
				if c.Status != doing.Name || len(c.Fields) != 1 || c.Fields[0].Value != "3" {
					t.Errorf("status %q and fields %v, want In progress and Estimate 3", c.Status, c.Fields)
				}
				wantRead(t, f, []string{"acme/web#2"}, 1, 0)
			},
		},
		{
			name: "leaving the board or the window of closed cards",
			change: func(w *world) {
				w.closed = w.closed[:2]
			},
			check: func(t *testing.T, f *fixture) {
				t.Helper()
				if keys := keysOf(f.service.Stored(boardID).Reading.Cards); slices.Contains(keys, "acme/web#4") {
					t.Errorf("cards = %v, want the card that left gone", keys)
				}
				wantRead(t, f, nil, 0, 0)
			},
		},
		{
			name: "a new closed card",
			change: func(w *world) {
				w.closed = append(w.closed, closedEntry("acme/web", 5))
			},
			check: func(t *testing.T, f *fixture) {
				t.Helper()
				card(t, f, "acme/web#5")
				wantRead(t, f, []string{"acme/web#5"}, 1, 0)
			},
		},
		{
			name: "a closed card the batch does not find",
			change: func(w *world) {
				w.closed[0].content = with(w.closed[0].content, "updatedAt", timeTwo)
				w.hidden["acme/web#2"] = true
			},
			check: func(t *testing.T, f *fixture) {
				t.Helper()
				if keys := keysOf(f.service.Stored(boardID).Reading.Cards); slices.Contains(keys, "acme/web#2") {
					t.Errorf("cards = %v, want the card the batch did not return left out", keys)
				}
			},
		},
		{
			name: "the pull requests and their state",
			change: func(w *world) {
				w.closed[0].content["closedByPullRequestsReferences"] = nodes(pr("acme/web", 7, "MERGED"))
			},
			check: func(t *testing.T, f *fixture) {
				t.Helper()
				prs := card(t, f, "acme/web#2").PullRequests
				if len(prs) != 1 || prs[0].State != board.PRMerged {
					t.Errorf("pull requests = %+v, want the merged one", prs)
				}
				wantRead(t, f, []string{"acme/web#2"}, 1, 0)
			},
		},
		{
			name: "the native epic and dependencies of a card",
			change: func(w *world) {
				w.closed[2].content["parent"] = with(brief("acme/web", 10), "body", "Epic body")
				w.closed[2].content["blockedBy"] = nodes(with(brief("acme/web", 20), "closedByPullRequestsReferences", nodes()))
			},
			check: func(t *testing.T, f *fixture) {
				t.Helper()
				c := card(t, f, "acme/web#4")
				if c.Epic == nil || c.Epic.Key() != "acme/web#10" || len(c.Dependencies) != 1 || c.Dependencies[0].Key() != "acme/web#20" {
					t.Errorf("epic %+v and dependencies %+v, want #10 and #20", c.Epic, c.Dependencies)
				}
				if len(f.github.received(batchMatch)) != 0 {
					t.Error("a complete batch was read, want the relations from the list and the index")
				}
				wantRead(t, f, nil, 0, 0)
			},
		},
		{
			name: "the epic and the dependencies of the convention",
			change: func(w *world) {
				w.closed[0].content = with(with(w.closed[0].content, "body", "Epic: acme/web#10\nDepends on: acme/web#20"), "updatedAt", timeTwo)
			},
			check: func(t *testing.T, f *fixture) {
				t.Helper()
				c := card(t, f, "acme/web#2")
				if c.Epic == nil || c.Epic.Key() != "acme/web#10" || len(c.Dependencies) != 1 {
					t.Errorf("epic %+v and dependencies %+v, want #10 and one dependency", c.Epic, c.Dependencies)
				}
				wantRead(t, f, []string{"acme/web#2"}, 1, 0)
			},
		},
		{
			name: "the title and the body of the epic",
			change: func(w *world) {
				w.outside[0] = with(with(with(w.outside[0], "title", "Epic v2"), "body", "New body"), "updatedAt", timeTwo)
			},
			check: func(t *testing.T, f *fixture) {
				t.Helper()
				for _, key := range []string{"acme/web#1", "acme/web#3"} {
					if e := card(t, f, key).Epic; e == nil || e.Title != "Epic v2" || e.Body != "New body" {
						t.Errorf("epic of %s = %+v, want the new title and body", key, e)
					}
				}
				wantRead(t, f, []string{"acme/web#10"}, 0, 1)
			},
		},
		{
			name: "a new sub-issue of the epic",
			change: func(w *world) {
				subs := w.outside[0]["subIssues"].(node)["nodes"].([]node)
				w.outside[0] = with(w.outside[0], "subIssues", nodes(append(slices.Clone(subs), with(brief("acme/web", 11), "updatedAt", timeOne))...))
			},
			check: func(t *testing.T, f *fixture) {
				t.Helper()
				siblings := card(t, f, "acme/web#1").Siblings
				if !slices.ContainsFunc(siblings, func(r board.Related) bool { return r.Key() == "acme/web#11" }) {
					t.Errorf("siblings = %+v, want the new sub-issue", siblings)
				}
				wantRead(t, f, []string{"acme/web#10"}, 0, 1)
			},
		},
		{
			name: "the status of a sibling",
			change: func(w *world) {
				w.closed[1].values, w.closed[1].at = []node{statusValue(doing)}, timeTwo
			},
			check: func(t *testing.T, f *fixture) {
				t.Helper()
				siblings := card(t, f, "acme/web#1").Siblings
				if len(siblings) != 1 || siblings[0].Status != doing.Name {
					t.Errorf("siblings = %+v, want #3 In progress", siblings)
				}
				wantRead(t, f, []string{"acme/web#3"}, 1, 0)
			},
		},
		{
			name: "the state of a dependency outside the reading",
			change: func(w *world) {
				w.outside[1] = with(with(w.outside[1], "state", "CLOSED"), "updatedAt", timeTwo)
			},
			check: func(t *testing.T, f *fixture) {
				t.Helper()
				deps := card(t, f, "acme/web#1").Dependencies
				if len(deps) != 1 || !deps[0].Satisfied {
					t.Errorf("dependencies = %+v, want #20 satisfied", deps)
				}
				wantRead(t, f, []string{"acme/web#20"}, 0, 1)
			},
		},
		{
			name: "the pull requests of a dependency outside the reading",
			change: func(w *world) {
				w.outside[1]["closedByPullRequestsReferences"] = nodes(pr("acme/web", 9, "MERGED"))
			},
			check: func(t *testing.T, f *fixture) {
				t.Helper()
				deps := card(t, f, "acme/web#1").Dependencies
				if len(deps) != 1 || !deps[0].Satisfied {
					t.Errorf("dependencies = %+v, want #20 satisfied by the merged pull request", deps)
				}
				wantRead(t, f, []string{"acme/web#20"}, 0, 1)
			},
		},
		{
			name: "the status of a dependency outside the reading",
			change: func(w *world) {
				w.outside[1] = onItem(w.outside[1], timeTwo, doing)
			},
			check: func(t *testing.T, f *fixture) {
				t.Helper()
				deps := card(t, f, "acme/web#1").Dependencies
				if len(deps) != 1 || deps[0].Status != doing.Name {
					t.Errorf("dependencies = %+v, want #20 In progress", deps)
				}
				wantRead(t, f, []string{"acme/web#20"}, 0, 1)
			},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			f := readTwice(t, newWorld(), tc.change)
			if _, _, full := readLog(t, f); full {
				t.Error("board read full_closed = true, want the closed cards read by key")
			}
			if failure := f.service.Stored(boardID).Failure; failure != nil {
				t.Fatalf("the reading failed: %v", failure)
			}
			tc.check(t, f)
		})
	}
}

// wantRead checks which issues the complete batches read, in order, how many
// closed cards were read by key and how many issues of the index again.
func wantRead(t *testing.T, f *fixture, batch []string, changedCards, changedIssues int) {
	t.Helper()

	gotCards, gotIssues, _ := readLog(t, f)
	if gotCards != changedCards || gotIssues != changedIssues {
		t.Errorf("board read = changed_cards %d, changed_issues %d, want %d and %d", gotCards, gotIssues, changedCards, changedIssues)
	}
	if got := batched(f, batchMatch); !slices.Equal(got, batch) {
		t.Errorf("issues the complete batches read = %v, want %v", got, batch)
	}
}

func TestADifferentStructureReadsTheClosedCardsAndTheIndexAgain(t *testing.T) {
	t.Parallel()

	shipped := board.Option{ID: done.ID, Name: "Shipped"}
	f := readTwice(t, newWorld(), func(w *world) {
		w.structure = structureWith("Roadmap", todo, doing, shipped)
		for i := range w.closed {
			w.closed[i].values = []node{statusValue(shipped)}
		}
	})

	if got := card(t, f, "acme/web#2").Status; got != "Shipped" {
		t.Errorf("status of a closed card = %q, want the option renamed", got)
	}
	if got := fullClosedPages(f); got != 1 {
		t.Errorf("%d complete pages of the closed items, want 1", got)
	}
	cards, issues, full := readLog(t, f)
	if cards != 0 || issues != 2 || !full {
		t.Errorf("board read = changed_cards %d, changed_issues %d, full_closed %v, want 0, 2, true", cards, issues, full)
	}
	if diff := cmp.Diff([]string{"acme/web#10", "acme/web#20"}, batched(f, batchMatch)); diff != "" {
		t.Errorf("issues of the index read again (-want +got):\n%s", diff)
	}
}

func TestTheClosedCardsAreReadByKeyUpToMaxChangedClosed(t *testing.T) {
	t.Parallel()

	const limit = 50 // maxChangedClosed
	for _, tc := range []struct {
		name    string
		changed int
		full    bool
	}{
		{"at the limit", limit, false},
		{"past the limit", limit + 1, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			w := newWorld()
			w.closed = nil
			for i := range limit + 10 {
				w.closed = append(w.closed, closedEntry("acme/web", 100+i))
			}
			f := readTwice(t, w, func(w *world) {
				for i := range tc.changed {
					w.closed[i].content = with(w.closed[i].content, "title", "Changed "+strconv.Itoa(i))
					w.closed[i].content["updatedAt"] = timeTwo
				}
			})

			cards, _, full := readLog(t, f)
			if full != tc.full {
				t.Errorf("full_closed = %v, want %v", full, tc.full)
			}
			if wantCards := map[bool]int{false: tc.changed, true: 0}[tc.full]; cards != wantCards {
				t.Errorf("changed_cards = %d, want %d", cards, wantCards)
			}
			if got := fullClosedPages(f); (got == 1) != tc.full {
				t.Errorf("%d complete pages of the closed items, want %v", got, tc.full)
			}
			if got := card(t, f, "acme/web#100").Title; got != "Changed 0" {
				t.Errorf("title of the first changed card = %q, want Changed 0", got)
			}
		})
	}
}

func TestTheExtraCardsAreReadInFullEvenWhenTheirStampsMatch(t *testing.T) {
	t.Parallel()

	f := readTwice(t, newWorld(), func(*world) {}, "acme/web#10")

	if _, issues, _ := readLog(t, f); issues != 1 {
		t.Errorf("changed_issues = %d, want 1: the epic of a task, read in full", issues)
	}
	if diff := cmp.Diff([]string{"acme/web#10"}, batched(f, batchMatch)); diff != "" {
		t.Errorf("issues read in full (-want +got):\n%s", diff)
	}
	reads := f.reads.all()
	if _, ok := reads[len(reads)-1]["acme/web#10"]; !ok {
		t.Error("OnRead did not hear of the extra card")
	}
}

func TestAReadingAfterAFailedConclusionConfirmsTheCards(t *testing.T) {
	t.Parallel()

	w := newWorld()
	f := newFixture(t, board.Stored{})
	w.install(f)
	f.refresh(t)
	first := f.service.Stored(boardID).Reading

	w.closedErr = errors.New("boom")
	w.install(f)
	f.refresh(t)
	delivered := f.service.Stored(boardID)
	if delivered.Failure == nil || !card(t, f, "acme/web#2").Unconfirmed {
		t.Fatalf("Stored() = failure %v, want the failed conclusion after a delivery", delivered.Failure)
	}
	if delivered.Reading.StructureStamp != first.StructureStamp || len(delivered.Reading.Index) != len(first.Index) {
		t.Error("the delivery changed the structure stamp or the index, want them kept until the conclusion")
	}

	w.closedErr = nil
	w.install(f)
	f.refresh(t)

	if failure := f.service.Stored(boardID).Failure; failure != nil {
		t.Fatalf("Stored().Failure = %v, want none", failure)
	}
	for _, c := range f.service.Stored(boardID).Reading.Cards {
		if c.Unconfirmed {
			t.Errorf("card %s is unconfirmed after the conclusion", c.Key())
		}
	}
	if got := fullClosedPages(f); got != 0 {
		t.Errorf("%d complete pages of the closed items, want none", got)
	}
	if got := asJSON(t, f.service.Stored(boardID).Reading); got != asJSON(t, first) {
		t.Errorf("the reading differs from the first one:\nfirst: %s\nthen:  %s", asJSON(t, first), got)
	}
}
