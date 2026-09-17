package board_test

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/board"
	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/repository"
	"github.com/guilhermt/myspec/internal/task"
)

func TestRefreshStoresTheReadingAndHandsTheCardsToOnRead(t *testing.T) {
	t.Parallel()
	f := newFixture(t, board.Stored{})

	login := with(issueNode("acme/web", 1), "body", "Build it.")
	login["assignees"] = nodes(node{"login": "ana", "avatarUrl": "https://avatars/ana"})
	login["closedByPullRequestsReferences"] = nodes(pr("acme/web", 7, "OPEN"))
	closed := with(issueNode("acme/web", 2), "state", "CLOSED")
	f.github.answer(structureMatch, "", structure("Roadmap v2"))
	f.github.answer(itemsMatch, openQ, itemsPage("", item(login,
		textValue("Title", "Issue 1"), statusValue(doing), selectValue("Priority", "High"), numberValue("Estimate", 2.5),
	)))
	f.github.answer(itemsMatch, closedQ, itemsPage("", item(closed, statusValue(done))))

	f.refresh(t)

	want := board.Reading{
		ProjectID: projectID,
		Title:     "Roadmap v2",
		Viewer:    "dev",
		Statuses:  []board.Option{todo, doing, done},
		HasStatus: true,
		Cards: []board.Card{
			{
				Issue:        cardIssue("acme/web", 1),
				Body:         "Build it.",
				StatusID:     doing.ID,
				Status:       doing.Name,
				Assignees:    []board.Assignee{{Login: "ana", AvatarURL: "https://avatars/ana"}},
				Fields:       []board.Field{{Name: "Priority", Value: "High"}, {Name: "Estimate", Value: "2.5"}},
				PullRequests: []board.PullRequest{{Owner: "acme", Name: "web", Number: 7, URL: "https://github.com/acme/web/pull/7", State: board.PROpen}},
				Siblings:     []board.Related{},
				Dependencies: []board.Dependency{},
				ReadAt:       base,
			},
			{
				Issue:        board.Issue{Owner: "acme", Name: "web", Number: 2, Title: "Issue 2", URL: issueURL("acme/web", 2), State: task.IssueClosed},
				StatusID:     done.ID,
				Status:       done.Name,
				Assignees:    []board.Assignee{},
				Fields:       []board.Field{},
				PullRequests: []board.PullRequest{},
				Siblings:     []board.Related{},
				Dependencies: []board.Dependency{},
				ReadAt:       base,
			},
		},
	}
	stored := f.service.Stored(boardID)
	if stored.Reading == nil {
		t.Fatal("Stored().Reading = nil, want the reading")
	}
	if diff := cmp.Diff(want, *stored.Reading); diff != "" {
		t.Errorf("Stored().Reading (-want +got):\n%s", diff)
	}
	if !stored.ReadAt.Equal(base) || stored.Failure != nil {
		t.Errorf("Stored() = read at %v with failure %v, want read at %v without one", stored.ReadAt, stored.Failure, base)
	}
	if got := f.store.get(boardID); got.Reading == nil || len(got.Reading.Cards) != 2 {
		t.Errorf("the store holds %+v, want the reading with 2 cards", got)
	}
	if b, _ := f.service.Get(boardID); b.Title != "Roadmap v2" {
		t.Errorf("Get().Title = %q, want the title the reading found", b.Title)
	}
	reads := f.reads.all()
	if len(reads) != 1 {
		t.Fatalf("OnRead was called %d times, want 1", len(reads))
	}
	if diff := cmp.Diff(map[string]board.Card{"acme/web#1": want.Cards[0], "acme/web#2": want.Cards[1]}, reads[0]); diff != "" {
		t.Errorf("OnRead cards (-want +got):\n%s", diff)
	}
	card, ok := f.service.Card(boardID, "Acme/Web#1")
	if !ok || card.Title != "Issue 1" {
		t.Errorf("Card(Acme/Web#1) = %q, %v, want the card", card.Title, ok)
	}
}

func TestTheReadingPagesThroughTheOpenIssuesThenTheOnesClosedInTheLastFourteenDays(t *testing.T) {
	t.Parallel()
	f := newFixture(t, board.Stored{})

	f.github.answer(structureMatch, "", structure("Roadmap"))
	f.github.answer(itemsMatch, openQ,
		itemsPage("cursor-1", item(issueNode("acme/web", 1)), node{"fieldValues": nodes(), "content": node{"__typename": "DraftIssue"}}),
		itemsPage("", item(issueNode("acme/web", 2)), item(issueNode("acme/web", 1))),
	)
	f.github.answer(itemsMatch, closedQ, itemsPage("", item(with(issueNode("acme/web", 3), "state", "CLOSED"))))

	f.refresh(t)

	calls := f.github.received(itemsMatch)
	got := make([]gh.Vars, 0, len(calls))
	for _, c := range calls {
		got = append(got, c.vars)
	}
	want := []gh.Vars{
		{"owner": "acme", "number": 3, "q": openQ},
		{"owner": "acme", "number": 3, "q": openQ, "cursor": "cursor-1"},
		{"owner": "acme", "number": 3, "q": closedQ},
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("items vars (-want +got):\n%s", diff)
	}
	cards := f.service.Stored(boardID).Reading.Cards
	keys := make([]string, 0, len(cards))
	for _, c := range cards {
		keys = append(keys, c.Key())
	}
	if diff := cmp.Diff([]string{"acme/web#1", "acme/web#2", "acme/web#3"}, keys); diff != "" {
		t.Errorf("cards (-want +got):\n%s", diff)
	}
}

func TestAFailedRefreshKeepsTheStoredReadingAndRecordsWhy(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		reply reply
		want  board.Failure
	}{
		{
			name:  "gh failed",
			reply: reply{err: &gh.Error{Args: []string{"api", "graphql"}, Output: "HTTP 502", Err: errors.New("exit status 1")}},
			want:  board.Failure{Reason: board.ReasonFailed, Detail: "HTTP 502"},
		},
		{
			name:  "missing scope",
			reply: reply{err: fmt.Errorf("%w: exit status 1", gh.ErrMissingScope)},
			want:  board.Failure{Reason: board.ReasonMissingScope},
		},
		{
			name: "board not found",
			reply: reply{
				resp: gh.Response{Errors: []gh.GraphQLError{{Type: "NOT_FOUND"}}},
				err:  &gh.Error{Err: errors.New("exit status 1")},
			},
			want: board.Failure{Reason: board.ReasonNotFound},
		},
		{
			name:  "project not found in partial data",
			reply: data(node{"viewer": node{"login": "dev"}, "owner": node{"projectV2": nil}}),
			want:  board.Failure{Reason: board.ReasonNotFound},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			previous := &board.Reading{ProjectID: projectID, Title: "Roadmap", Statuses: []board.Option{}, Cards: []board.Card{}}
			readAt := base.Add(-time.Hour)
			f := newFixture(t, board.Stored{Reading: previous, ReadAt: readAt})
			f.github.answer(structureMatch, "", tt.reply)

			f.refresh(t)

			want := board.Stored{Reading: previous, ReadAt: readAt, Failure: &tt.want, FailedAt: base}
			if diff := cmp.Diff(want, f.service.Stored(boardID)); diff != "" {
				t.Errorf("Stored() (-want +got):\n%s", diff)
			}
			if diff := cmp.Diff(want, f.store.get(boardID)); diff != "" {
				t.Errorf("the store holds (-want +got):\n%s", diff)
			}
			if reads := f.reads.all(); len(reads) != 0 {
				t.Errorf("OnRead was called %d times, want none", len(reads))
			}
		})
	}
}

func TestAReadingThatCannotBeSavedIsAFailure(t *testing.T) {
	t.Parallel()
	f := newFixture(t, board.Stored{})
	f.store.saveErr = errors.New("disk full")
	f.github.answer(structureMatch, "", structure("Roadmap"))
	f.github.answer(itemsMatch, openQ, itemsPage(""))
	f.github.answer(itemsMatch, closedQ, itemsPage(""))

	f.refresh(t)

	stored := f.service.Stored(boardID)
	if diff := cmp.Diff(&board.Failure{Reason: board.ReasonFailed, Detail: "disk full"}, stored.Failure); diff != "" {
		t.Errorf("Stored().Failure (-want +got):\n%s", diff)
	}
	if stored.Reading != nil {
		t.Errorf("Stored().Reading = %+v, want nil", stored.Reading)
	}
}

func TestAReadingThatRanOutOfTimeStillRecordsItsFailure(t *testing.T) {
	t.Parallel()
	f := newFixture(t, board.Stored{})
	f.github.answer(structureMatch, "", reply{err: &gh.Error{Args: []string{"api", "graphql"}, Err: context.DeadlineExceeded}})

	f.refresh(t)

	stored := f.service.Stored(boardID)
	if stored.Failure == nil || stored.Failure.Reason != board.ReasonFailed {
		t.Errorf("Stored().Failure = %+v, want the reading that ran out of time", stored.Failure)
	}
	if got := f.store.get(boardID); got.Failure == nil {
		t.Errorf("the store holds %+v, want the failure", got)
	}
	// The write has a deadline of its own, far shorter than a whole reading:
	// the reading's own deadline, spent or not, never bounds it.
	left := f.store.writes()
	if len(left) != 1 || left[0] > time.Minute {
		t.Errorf("the writes ran with %v left, want one bounded by the save timeout", left)
	}
}

func TestABoardRemovedWhileItsReadingRunsKeepsNothingOfIt(t *testing.T) {
	t.Parallel()
	f := newFixture(t, board.Stored{})
	f.github.gate = make(chan struct{})
	f.github.answer(structureMatch, "", structure("Roadmap"))
	f.github.answer(itemsMatch, openQ, itemsPage("", item(issueNode("acme/web", 1))))
	f.github.answer(itemsMatch, closedQ, itemsPage(""))

	f.service.Refresh(boardID)
	if err := f.service.Remove(t.Context(), boardID); err != nil {
		t.Fatalf("Remove() = %v, want nil", err)
	}
	close(f.github.gate)
	// The refresh, the removal and the reading that ended announce a change.
	waitChanges(t, f.changes, 3)

	if got := f.service.Stored(boardID); got.Reading != nil || got.Failure != nil {
		t.Errorf("Stored() = %+v, want nothing of the board removed", got)
	}
	if f.service.Reading(boardID) {
		t.Error("Reading() = true, want false for the board removed")
	}
	if got := f.store.get(boardID); got.Reading != nil || got.Failure != nil {
		t.Errorf("the store holds %+v, want nothing of the board removed", got)
	}
	if left := f.store.writes(); len(left) != 0 {
		t.Errorf("the store took %d writes, want none for the board removed", len(left))
	}
	if reads := f.reads.all(); len(reads) != 0 {
		t.Errorf("OnRead was called %d times, want none", len(reads))
	}
}

func TestARefreshWhileReadingDoesNothing(t *testing.T) {
	t.Parallel()
	f := newFixture(t, board.Stored{})
	f.github.gate = make(chan struct{})
	f.github.answer(structureMatch, "", structure("Roadmap"))
	f.github.answer(itemsMatch, openQ, itemsPage(""))
	f.github.answer(itemsMatch, closedQ, itemsPage(""))

	f.service.Refresh(boardID)
	if !f.service.Reading(boardID) {
		t.Fatal("Reading() = false right after Refresh, want true")
	}
	f.service.Refresh(boardID)
	f.service.Refresh("unknown")
	close(f.github.gate)
	waitReading(t, f.service, boardID)

	if got := len(f.github.received(structureMatch)); got != 1 {
		t.Errorf("the structure was read %d times, want 1", got)
	}
	if got := len(f.reads.all()); got != 1 {
		t.Errorf("OnRead was called %d times, want 1", got)
	}
}

func TestTheReadingAssemblesEpicsSiblingsAndDependencies(t *testing.T) {
	t.Parallel()
	f := newFixture(t, board.Stored{})

	// #1 has a native epic and a native dependency on the board, and names a
	// dependency outside it. #2 and api#20 name the same epic by convention.
	login := with(issueNode("acme/web", 1), "body", "Depends on acme/lib#30")
	login["parent"] = with(brief("acme/web", 10), "body", "The accounts epic.")
	login["blockedBy"] = nodes(with(brief("acme/api", 20), "closedByPullRequestsReferences", nodes()))
	logout := with(issueNode("acme/web", 2), "body", "Epic: #11\nDepende de #1")
	auth := with(issueNode("acme/api", 20), "body", "- Épico: web#11")
	auth["closedByPullRequestsReferences"] = nodes(pr("acme/api", 21, "OPEN"))
	signup := issueNode("acme/web", 3)

	accounts := with(issueNode("acme/web", 10), "body", "The accounts epic.")
	accounts["subIssues"] = nodes(brief("acme/web", 1), brief("acme/web", 3), brief("other/x", 5))
	library := issueNode("acme/lib", 30)
	library["projectItems"] = nodes(projectItem("project-other", statusValue(todo)), projectItem(projectID, statusValue(done)))
	sessions := issueNode("acme/web", 11)

	f.github.answer(structureMatch, "", structure("Roadmap"))
	f.github.answer(itemsMatch, openQ, itemsPage("",
		item(login), item(logout), item(auth, statusValue(doing)), item(signup),
	))
	f.github.answer(itemsMatch, closedQ, itemsPage(""))
	f.github.answer(batchMatch, "", batch(accounts, library, sessions))

	f.refresh(t)

	batches := f.github.received(batchMatch)
	if len(batches) != 1 {
		t.Fatalf("%d batch queries, want 1", len(batches))
	}
	for _, alias := range []string{
		`i0: repository(owner: "acme", name: "web") { issue(number: 10)`,
		`i1: repository(owner: "acme", name: "lib") { issue(number: 30)`,
		`i2: repository(owner: "acme", name: "web") { issue(number: 11)`,
	} {
		if !strings.Contains(batches[0].query, alias) {
			t.Errorf("the batch query lacks %q:\n%s", alias, batches[0].query)
		}
	}

	type relations struct {
		Epic         *board.Epic
		Siblings     []board.Related
		Dependencies []board.Dependency
	}
	accountsEpic := &board.Epic{Issue: cardIssue("acme/web", 10), Body: "The accounts epic."}
	sessionsEpic := &board.Epic{Issue: cardIssue("acme/web", 11)}
	authRelated := board.Related{Issue: cardIssue("acme/api", 20), Status: doing.Name, OnBoard: true}
	want := map[string]relations{
		"acme/web#1": {
			Epic:     accountsEpic,
			Siblings: []board.Related{{Issue: cardIssue("acme/web", 3), OnBoard: true}, {Issue: cardIssue("other/x", 5)}},
			Dependencies: []board.Dependency{
				{Related: authRelated, PullRequests: []board.PullRequest{{Owner: "acme", Name: "api", Number: 21, URL: "https://github.com/acme/api/pull/21", State: board.PROpen}}},
				{Related: board.Related{Issue: cardIssue("acme/lib", 30), Status: done.Name}, PullRequests: []board.PullRequest{}},
			},
		},
		"acme/web#2": {
			Epic:         sessionsEpic,
			Siblings:     []board.Related{authRelated},
			Dependencies: []board.Dependency{{Related: board.Related{Issue: cardIssue("acme/web", 1), OnBoard: true}, PullRequests: []board.PullRequest{}}},
		},
		"acme/api#20": {
			Epic:         sessionsEpic,
			Siblings:     []board.Related{{Issue: cardIssue("acme/web", 2), OnBoard: true}},
			Dependencies: []board.Dependency{},
		},
		"acme/web#3": {Siblings: []board.Related{}, Dependencies: []board.Dependency{}},
	}
	got := map[string]relations{}
	for _, c := range f.service.Stored(boardID).Reading.Cards {
		got[c.Key()] = relations{Epic: c.Epic, Siblings: c.Siblings, Dependencies: c.Dependencies}
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("relations by card (-want +got):\n%s", diff)
	}
}

func TestADependencyIsSatisfiedByAMergedPullRequest(t *testing.T) {
	t.Parallel()
	f := newFixture(t, board.Stored{})

	blocked := with(issueNode("acme/web", 1), "body", "Depends on #2, #3")
	merged := with(issueNode("acme/web", 2), "closedByPullRequestsReferences", nodes(pr("acme/web", 8, "CLOSED"), pr("acme/web", 9, "MERGED")))
	pending := with(issueNode("acme/web", 3), "closedByPullRequestsReferences", nodes(pr("acme/web", 10, "OPEN")))
	f.github.answer(structureMatch, "", structure("Roadmap"))
	f.github.answer(itemsMatch, openQ, itemsPage("", item(blocked), item(merged), item(pending)))
	f.github.answer(itemsMatch, closedQ, itemsPage(""))

	f.refresh(t)

	card, _ := f.service.Card(boardID, "acme/web#1")
	got := map[string]bool{}
	for _, d := range card.Dependencies {
		got[d.Key()] = d.Satisfied
	}
	if diff := cmp.Diff(map[string]bool{"acme/web#2": true, "acme/web#3": false}, got); diff != "" {
		t.Errorf("satisfied by dependency (-want +got):\n%s", diff)
	}
}

func TestTheExtraCardOfATaskIsHandedOverWithoutBeingACardOfTheReading(t *testing.T) {
	t.Parallel()
	f := newFixture(t, board.Stored{})
	f.taskCards = []string{"acme/web#1", "acme/web#99"}

	old := with(issueNode("acme/web", 99), "state", "CLOSED")
	old["parent"] = with(brief("acme/web", 10), "body", "The epic.")
	old["projectItems"] = nodes(projectItem(projectID, statusValue(done), selectValue("Priority", "Low")))
	f.github.answer(structureMatch, "", structure("Roadmap"))
	f.github.answer(itemsMatch, openQ, itemsPage("", item(issueNode("acme/web", 1))))
	f.github.answer(itemsMatch, closedQ, itemsPage(""))
	f.github.answer(batchMatch, "", batch(old))

	f.refresh(t)

	if cards := f.service.Stored(boardID).Reading.Cards; len(cards) != 1 {
		t.Errorf("the reading has %d cards, want only the one on the board", len(cards))
	}
	reads := f.reads.all()
	if len(reads) != 1 {
		t.Fatalf("OnRead was called %d times, want 1", len(reads))
	}
	want := board.Card{
		Issue:        board.Issue{Owner: "acme", Name: "web", Number: 99, Title: "Issue 99", URL: issueURL("acme/web", 99), State: task.IssueClosed},
		StatusID:     done.ID,
		Status:       done.Name,
		Assignees:    []board.Assignee{},
		Fields:       []board.Field{{Name: "Priority", Value: "Low"}},
		PullRequests: []board.PullRequest{},
		Epic:         &board.Epic{Issue: cardIssue("acme/web", 10), Body: "The epic."},
		Siblings:     []board.Related{},
		Dependencies: []board.Dependency{},
		ReadAt:       base,
	}
	if diff := cmp.Diff(want, reads[0]["acme/web#99"]); diff != "" {
		t.Errorf("OnRead extra card (-want +got):\n%s", diff)
	}
	if _, ok := reads[0]["acme/web#1"]; !ok {
		t.Error("OnRead lacks the card of the reading")
	}
}

func TestRefreshCardReplacesOneCardAndKeepsTheReadTime(t *testing.T) {
	t.Parallel()

	readAt := base.Add(-time.Hour)
	first := board.Card{Issue: cardIssue("acme/web", 1), Siblings: []board.Related{}, Dependencies: []board.Dependency{}, ReadAt: readAt}
	second := board.Card{Issue: cardIssue("acme/web", 2), Status: todo.Name, StatusID: todo.ID, PullRequests: []board.PullRequest{}, ReadAt: readAt}
	previous := &board.Reading{ProjectID: projectID, Title: "Roadmap", Statuses: []board.Option{todo, doing, done}, HasStatus: true, Cards: []board.Card{first, second}}
	f := newFixture(t, board.Stored{Reading: previous, ReadAt: readAt})

	fresh := with(issueNode("acme/web", 1), "title", "Login screen")
	fresh["body"] = "Depends on #2"
	fresh["projectItems"] = nodes(projectItem(projectID, statusValue(doing)))
	f.github.answer(structureMatch, "", structure("Roadmap"))
	f.github.answer(batchMatch, "", batch(fresh))

	if err := f.service.RefreshCard(t.Context(), boardID, "acme/web#1"); err != nil {
		t.Fatalf("RefreshCard() = %v, want nil", err)
	}

	want := board.Card{
		Issue:        board.Issue{Owner: "acme", Name: "web", Number: 1, Title: "Login screen", URL: issueURL("acme/web", 1), State: task.IssueOpen},
		Body:         "Depends on #2",
		StatusID:     doing.ID,
		Status:       doing.Name,
		Assignees:    []board.Assignee{},
		Fields:       []board.Field{},
		PullRequests: []board.PullRequest{},
		Siblings:     []board.Related{},
		Dependencies: []board.Dependency{{Related: board.Related{Issue: second.Issue, Status: todo.Name, OnBoard: true}, PullRequests: []board.PullRequest{}}},
		ReadAt:       base,
	}
	stored := f.service.Stored(boardID)
	if diff := cmp.Diff([]board.Card{want, second}, stored.Reading.Cards); diff != "" {
		t.Errorf("Stored().Reading.Cards (-want +got):\n%s", diff)
	}
	if !stored.ReadAt.Equal(readAt) || !f.store.get(boardID).ReadAt.Equal(readAt) {
		t.Errorf("the read time moved to %v, want %v", stored.ReadAt, readAt)
	}
	if got := len(f.github.received(batchMatch)); got != 1 {
		t.Errorf("%d batch queries, want 1: the dependency is on the board", got)
	}
	if diff := cmp.Diff([]map[string]board.Card{{"acme/web#1": want}}, f.reads.all()); diff != "" {
		t.Errorf("OnRead (-want +got):\n%s", diff)
	}
	if previous.Cards[0].Title != "Issue 1" {
		t.Error("RefreshCard changed the reading it replaced")
	}
}

func TestRefreshCardRefusesACardThatIsNotInTheReading(t *testing.T) {
	t.Parallel()
	previous := &board.Reading{ProjectID: projectID, Cards: []board.Card{{Issue: cardIssue("acme/web", 1)}}}
	f := newFixture(t, board.Stored{Reading: previous, ReadAt: base})

	if err := f.service.RefreshCard(t.Context(), boardID, "acme/web#2"); !errors.Is(err, board.ErrCardNotFound) {
		t.Errorf("RefreshCard(acme/web#2) = %v, want ErrCardNotFound", err)
	}
	if err := f.service.RefreshCard(t.Context(), "unknown", "acme/web#1"); !errors.Is(err, board.ErrNotFound) {
		t.Errorf("RefreshCard(unknown board) = %v, want ErrNotFound", err)
	}
	if calls := f.github.received(""); len(calls) != 0 {
		t.Errorf("%d queries, want none", len(calls))
	}
}

func TestRefreshCardFailsWithoutChangingTheReading(t *testing.T) {
	t.Parallel()
	previous := &board.Reading{ProjectID: projectID, Cards: []board.Card{{Issue: cardIssue("acme/web", 1)}}}
	f := newFixture(t, board.Stored{Reading: previous, ReadAt: base})
	f.github.answer(structureMatch, "", structure("Roadmap"))
	f.github.answer(batchMatch, "", reply{err: fmt.Errorf("%w: exit 4", gh.ErrNotAuthenticated)})

	err := f.service.RefreshCard(t.Context(), boardID, "acme/web#1")

	var failure *board.Failure
	if !errors.As(err, &failure) || failure.Reason != board.ReasonUnauthenticated {
		t.Errorf("RefreshCard() = %v, want a gh_unauthenticated failure", err)
	}
	if f.service.Stored(boardID).Reading != previous {
		t.Error("RefreshCard replaced the reading after a failure")
	}
}

func TestContextIsTheContextOfAStoredCard(t *testing.T) {
	t.Parallel()
	card := board.Card{Issue: cardIssue("acme/web", 1), Body: "Build it."}
	f := newFixture(t, board.Stored{Reading: &board.Reading{Cards: []board.Card{card}}, ReadAt: base})

	got, err := f.service.Context(boardID, "acme/web#1", "Mind the theme.")
	if err != nil {
		t.Fatalf("Context() = %v, want nil", err)
	}
	if want := board.Context(card, "Mind the theme."); got != want {
		t.Errorf("Context() = %q, want %q", got, want)
	}
	if _, err := f.service.Context(boardID, "acme/web#2", ""); !errors.Is(err, board.ErrCardNotFound) {
		t.Errorf("Context(acme/web#2) = %v, want ErrCardNotFound", err)
	}
}

func TestRefreshCardKeepsAReadingThatFinishedWhileTheCardWasRead(t *testing.T) {
	t.Parallel()

	readAt := base.Add(-time.Hour)
	previous := &board.Reading{ProjectID: projectID, Title: "Roadmap", Cards: []board.Card{
		{Issue: cardIssue("acme/web", 1)},
		{Issue: cardIssue("acme/web", 2)},
	}}
	f := newFixture(t, board.Stored{Reading: previous, ReadAt: readAt})

	entered, release := make(chan struct{}), make(chan struct{})
	fresh := with(issueNode("acme/web", 1), "title", "Login screen")
	cardBatch := batch(fresh)
	cardBatch.entered, cardBatch.release = entered, release
	f.github.answer(structureMatch, "", structure("Roadmap"))
	f.github.answer(batchMatch, "", cardBatch)
	f.github.answer(itemsMatch, openQ, itemsPage("",
		item(issueNode("acme/web", 1)), item(issueNode("acme/web", 2)), item(issueNode("acme/web", 3)),
	))
	f.github.answer(itemsMatch, closedQ, itemsPage(""))

	done := make(chan error, 1)
	go func() { done <- f.service.RefreshCard(t.Context(), boardID, "acme/web#1") }()
	<-entered
	f.refresh(t)
	close(release)
	if err := <-done; err != nil {
		t.Fatalf("RefreshCard() = %v, want nil", err)
	}

	for name, stored := range map[string]board.Stored{"service": f.service.Stored(boardID), "store": f.store.get(boardID)} {
		if !stored.ReadAt.Equal(base) {
			t.Errorf("the %s holds a reading read at %v, want the newer one read at %v", name, stored.ReadAt, base)
		}
		titles := make([]string, 0, len(stored.Reading.Cards))
		for _, c := range stored.Reading.Cards {
			titles = append(titles, c.Title)
		}
		if diff := cmp.Diff([]string{"Login screen", "Issue 2", "Issue 3"}, titles); diff != "" {
			t.Errorf("the %s holds cards (-want +got):\n%s", name, diff)
		}
	}
}

// otherURL is the URL of a board the fixture did not register.
const otherURL = "https://github.com/orgs/acme/projects/4"

func TestPreviewRefusesWhatItCannotRegister(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		url    string
		answer reply
		want   error
	}{
		{
			name: "an invalid URL",
			url:  "https://github.com/acme/web",
			want: &board.Refusal{Reason: board.RefusalInvalidURL},
		},
		{
			name:   "a registered board, whatever the case of its owner",
			url:    "https://github.com/orgs/ACME/projects/3/views/1",
			answer: structure("Roadmap on GitHub"),
			want:   &board.Refusal{Reason: board.RefusalRegistered, Title: "Roadmap"},
		},
		{
			name:   "a board that is not found",
			url:    otherURL,
			answer: data(node{"viewer": node{"login": "dev"}, "owner": node{"projectV2": nil}}),
			want:   &board.Failure{Reason: board.ReasonNotFound},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			f := newFixture(t, board.Stored{})
			f.github.answer(structureMatch, "", tt.answer)

			_, err := f.service.Preview(t.Context(), tt.url)

			if diff := cmp.Diff(tt.want, err); diff != "" {
				t.Errorf("Preview() error (-want +got):\n%s", diff)
			}
		})
	}
}

func TestPreviewPreMarksTheFinalStatusesAndSuggestsTheRepositories(t *testing.T) {
	t.Parallel()
	f := newFixture(t, board.Stored{})
	concluded := board.Option{ID: "opt-concluded", Name: " Concluído "}
	f.github.answer(structureMatch, "", structureWith("Platform", todo, done, concluded))
	f.github.answer(reposMatch, suggestQ,
		reposPage("page-2", "acme/web", "acme/docs", "Acme/Web", "acme/ops"),
		reposPage("", "acme/infra", "acme/docs", "acme/web"),
	)
	f.repos.items = []repository.Repository{
		{ID: "repo-web", Owner: "acme", Name: "web", Path: "/src/web"},
		{ID: "repo-ops", Owner: "acme", Name: "ops", BoardID: boardID},
	}
	f.repos.scan = []repository.Candidate{
		{Identity: repository.Identity{Owner: "acme", Name: "web"}, Path: "/src/web", Registered: true},
		{Identity: repository.Identity{Owner: "acme", Name: "docs"}, Path: "/src/z/docs"},
		{Identity: repository.Identity{Owner: "ACME", Name: "docs"}, Path: "/src/a/docs"},
	}

	got, err := f.service.Preview(t.Context(), otherURL)
	if err != nil {
		t.Fatalf("Preview() = %v, want nil", err)
	}

	want := board.Preview{
		Locator:   board.Locator{Owner: "acme", OwnerType: board.OwnerOrganization, Number: 4},
		URL:       "https://github.com/orgs/acme/projects/3",
		Title:     "Platform",
		HasStatus: true,
		Statuses: []board.StatusOption{
			{Option: todo},
			{Option: done, Final: true},
			{Option: concluded, Final: true},
		},
		Repositories: []board.RepositoryOption{
			{
				Identity: repository.Identity{Owner: "acme", Name: "docs"},
				Cards:    2,
				Checked:  true,
				Link:     board.LinkClone,
				Path:     "/src/a/docs",
				Clones:   []string{"/src/a/docs", "/src/z/docs"},
			},
			{
				Identity: repository.Identity{Owner: "acme", Name: "infra"},
				Cards:    1,
				Checked:  true,
				Link:     board.LinkUncloned,
				Clones:   []string{},
			},
			{
				Identity:     repository.Identity{Owner: "acme", Name: "ops"},
				Cards:        1,
				Link:         board.LinkOtherBoard,
				RepositoryID: "repo-ops",
				Clones:       []string{},
				OtherBoard:   "Roadmap",
			},
			{
				Identity:     repository.Identity{Owner: "acme", Name: "web"},
				Cards:        3,
				Checked:      true,
				Link:         board.LinkRegistered,
				RepositoryID: "repo-web",
				Path:         "/src/web",
				Clones:       []string{},
			},
		},
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("Preview() (-want +got):\n%s", diff)
	}
	if calls := f.github.received(reposMatch); len(calls) != 2 || calls[1].vars["cursor"] != "page-2" {
		t.Errorf("the suggestion made the calls %+v, want two pages", calls)
	}
}

func TestPreviewEditChecksTheRepositoriesOfTheBoardNextToTheSuggestions(t *testing.T) {
	t.Parallel()
	f := newFixture(t, board.Stored{})
	// The board holds a status the project no longer offers.
	f.store.boards[0].FinalStatuses = []string{done.ID, "opt-gone"}
	if err := f.service.Sync(t.Context()); err != nil {
		t.Fatalf("Sync() = %v, want nil", err)
	}
	f.github.answer(structureMatch, "", structureWith("Roadmap v2", todo, done, doing))
	f.github.answer(reposMatch, suggestQ, reposPage("", "acme/web", "acme/docs"))
	f.repos.items = []repository.Repository{
		{ID: "repo-web", Owner: "acme", Name: "web", Path: "/src/web", BoardID: boardID},
		{ID: "repo-api", Owner: "acme", Name: "api", BoardID: boardID},
		{ID: "repo-free", Owner: "acme", Name: "free", Path: "/src/free"},
	}
	f.repos.scan = []repository.Candidate{
		{Identity: repository.Identity{Owner: "acme", Name: "docs"}, Path: "/src/docs"},
	}

	got, err := f.service.PreviewEdit(t.Context(), boardID)
	if err != nil {
		t.Fatalf("PreviewEdit() = %v, want nil", err)
	}

	want := board.Preview{
		Locator:   board.Locator{Owner: "acme", OwnerType: board.OwnerOrganization, Number: 3},
		URL:       "https://github.com/orgs/acme/projects/3",
		Title:     "Roadmap v2",
		HasStatus: true,
		Statuses: []board.StatusOption{
			{Option: todo},
			{Option: done, Final: true},
			{Option: doing},
		},
		Repositories: []board.RepositoryOption{
			{
				Identity:     repository.Identity{Owner: "acme", Name: "api"},
				Checked:      true,
				Link:         board.LinkRegistered,
				RepositoryID: "repo-api",
				Clones:       []string{},
			},
			{
				Identity: repository.Identity{Owner: "acme", Name: "docs"},
				Cards:    1,
				Link:     board.LinkClone,
				Path:     "/src/docs",
				Clones:   []string{"/src/docs"},
			},
			{
				Identity:     repository.Identity{Owner: "acme", Name: "web"},
				Cards:        1,
				Checked:      true,
				Link:         board.LinkRegistered,
				RepositoryID: "repo-web",
				Path:         "/src/web",
				Clones:       []string{},
			},
		},
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("PreviewEdit() (-want +got):\n%s", diff)
	}
}

func TestCheckRepositoryAnswersWithTheRepositoryAsGitHubNamesIt(t *testing.T) {
	t.Parallel()
	f := newFixture(t, board.Stored{})
	f.github.answer(repoMatch, "", data(node{"repository": node{"nameWithOwner": "Acme/Web"}}))
	f.repos.scan = []repository.Candidate{
		{Identity: repository.Identity{Owner: "acme", Name: "web"}, Path: "/src/web"},
	}

	got, err := f.service.CheckRepository(t.Context(), boardID, " acme/web ")
	if err != nil {
		t.Fatalf("CheckRepository() = %v, want nil", err)
	}

	want := board.RepositoryOption{
		Identity: repository.Identity{Owner: "Acme", Name: "Web"},
		Checked:  true,
		Link:     board.LinkClone,
		Path:     "/src/web",
		Clones:   []string{"/src/web"},
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("CheckRepository() (-want +got):\n%s", diff)
	}
}

func TestCheckRepositoryRefusesWhatItCannotTieToTheBoard(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		typed  string
		answer reply
		want   error
	}{
		{
			name:  "a name without an owner",
			typed: "web",
			want:  &board.Refusal{Reason: board.RefusalInvalidRepository},
		},
		{
			name:  "a name with one part too many",
			typed: "acme/web/api",
			want:  &board.Refusal{Reason: board.RefusalInvalidRepository},
		},
		{
			name:   "a repository GitHub does not know",
			typed:  "acme/gone",
			answer: reply{resp: gh.Response{Errors: []gh.GraphQLError{{Type: "NOT_FOUND"}}}, err: &gh.Error{Err: errors.New("exit status 1")}},
			want:   &board.Refusal{Reason: board.RefusalUnknownRepository, Repository: "acme/gone"},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			f := newFixture(t, board.Stored{})
			f.github.answer(repoMatch, "", tt.answer)

			_, err := f.service.CheckRepository(t.Context(), boardID, tt.typed)

			if diff := cmp.Diff(tt.want, err); diff != "" {
				t.Errorf("CheckRepository() error (-want +got):\n%s", diff)
			}
		})
	}
}

func TestAddRepositoryTiesOneMoreRepositoryToTheBoard(t *testing.T) {
	t.Parallel()
	f := newFixture(t, board.Stored{})
	f.repos.items = []repository.Repository{{ID: "repo-web", Owner: "acme", Name: "web"}}
	f.clones["/src/web"] = repository.Identity{Owner: "acme", Name: "web"}

	choice := board.RepositoryChoice{Owner: "acme", Name: "web", Path: "/src/web"}
	if err := f.service.AddRepository(t.Context(), boardID, choice); err != nil {
		t.Fatalf("AddRepository() = %v, want nil", err)
	}

	if diff := cmp.Diff([]board.Link{{RepositoryID: "repo-web", Path: "/src/web"}}, f.store.links); diff != "" {
		t.Errorf("the links stored (-want +got):\n%s", diff)
	}
	if len(f.store.releases) != 0 {
		t.Errorf("the releases stored = %+v, want none", f.store.releases)
	}
	if got := f.repos.synced(); got != 1 {
		t.Errorf("Sync was called %d times, want 1", got)
	}
}

func TestAddRegistersTheBoardWithItsRepositoriesAndReadsIt(t *testing.T) {
	t.Parallel()
	f := newFixture(t, board.Stored{})
	f.github.answer(structureMatch, "", structure("Platform"))
	f.github.answer(itemsMatch, openQ, itemsPage("", item(issueNode("acme/web", 1), statusValue(todo))))
	f.github.answer(itemsMatch, closedQ, itemsPage(""))
	f.repos.items = []repository.Repository{{ID: "repo-api", Owner: "acme", Name: "api"}}
	f.clones["/src/web"] = repository.Identity{Owner: "Acme", Name: "Web"}
	f.clones["/src/api"] = repository.Identity{Owner: "acme", Name: "api"}

	got, err := f.service.Add(t.Context(), otherURL, board.SaveParams{
		FinalStatuses: []string{done.ID, "opt-gone"},
		Repositories: []board.RepositoryChoice{
			{Owner: "acme", Name: "web", Path: "/src/web/"},
			{Owner: "acme", Name: "infra"},
			{Owner: "acme", Name: "api", Path: "/src/api"},
		},
	})
	if err != nil {
		t.Fatalf("Add() = %v, want nil", err)
	}
	waitReading(t, f.service, got.ID)

	want := board.Board{
		ID:            "id-3",
		Owner:         "acme",
		OwnerType:     board.OwnerOrganization,
		Number:        4,
		Title:         "Platform",
		URL:           "https://github.com/orgs/acme/projects/3",
		FinalStatuses: []string{done.ID},
		CreatedAt:     base,
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("Add() (-want +got):\n%s", diff)
	}
	wantLinks := []board.Link{
		{NewID: "id-1", Owner: "acme", Name: "web", Path: "/src/web", CreatedAt: base},
		{NewID: "id-2", Owner: "acme", Name: "infra", CreatedAt: base},
		{RepositoryID: "repo-api", Path: "/src/api"},
	}
	if diff := cmp.Diff(wantLinks, f.store.links); diff != "" {
		t.Errorf("the links stored (-want +got):\n%s", diff)
	}
	if boards := f.service.List(); len(boards) != 2 || boards[0].ID != "id-3" {
		t.Errorf("List() = %+v, want Platform before Roadmap", boards)
	}
	if stored := f.service.Stored(got.ID); stored.Reading == nil || len(stored.Reading.Cards) != 1 {
		t.Errorf("Stored() = %+v, want the reading of the new board", stored)
	}
}

func TestAddRefusesAClonePathOfAnotherRepository(t *testing.T) {
	t.Parallel()
	f := newFixture(t, board.Stored{})
	f.github.answer(structureMatch, "", structure("Platform"))
	f.clones["/src/web"] = repository.Identity{Owner: "acme", Name: "api"}

	_, err := f.service.Add(t.Context(), otherURL, board.SaveParams{
		Repositories: []board.RepositoryChoice{{Owner: "acme", Name: "web", Path: "/src/web"}},
	})

	want := &repository.Refusal{Reason: repository.ReasonOtherRepository, Path: "/src/web", Other: "acme/api", Repository: "acme/web"}
	if diff := cmp.Diff(error(want), err); diff != "" {
		t.Errorf("Add() error (-want +got):\n%s", diff)
	}
	if boards := f.service.List(); len(boards) != 1 {
		t.Errorf("List() = %+v, want only the board registered before", boards)
	}
}

func TestUpdateReleasesTheRepositoriesLeftOut(t *testing.T) {
	t.Parallel()
	f := newFixture(t, board.Stored{})
	f.github.answer(structureMatch, "", structure("Roadmap v2"))
	f.repos.items = []repository.Repository{
		{ID: "repo-web", Owner: "acme", Name: "web", Path: "/src/web", BoardID: boardID},
		{ID: "repo-api", Owner: "acme", Name: "api", BoardID: boardID},
		{ID: "repo-docs", Owner: "acme", Name: "docs", BoardID: boardID},
	}
	f.tasks["repo-docs"] = 1

	err := f.service.Update(t.Context(), boardID, board.SaveParams{
		FinalStatuses: []string{done.ID},
		Repositories:  []board.RepositoryChoice{{Owner: "ACME", Name: "web", Path: "/src/other"}},
	})
	if err != nil {
		t.Fatalf("Update() = %v, want nil", err)
	}

	wantReleases := []board.Release{
		{RepositoryID: "repo-api", Remove: true},
		{RepositoryID: "repo-docs"},
	}
	if diff := cmp.Diff(wantReleases, f.store.releases); diff != "" {
		t.Errorf("the releases stored (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff([]board.Link{{RepositoryID: "repo-web"}}, f.store.links); diff != "" {
		t.Errorf("the links stored (-want +got):\n%s", diff)
	}
	if b, _ := f.service.Get(boardID); b.Title != "Roadmap v2" || !slices.Equal(b.FinalStatuses, []string{done.ID}) {
		t.Errorf("Get() = %+v, want the new title and final statuses", b)
	}
}

func TestRemoveReleasesEveryRepositoryOfTheBoard(t *testing.T) {
	t.Parallel()
	f := newFixture(t, board.Stored{})
	f.repos.items = []repository.Repository{
		{ID: "repo-web", Owner: "acme", Name: "web", Path: "/src/web", BoardID: boardID},
		{ID: "repo-api", Owner: "acme", Name: "api", BoardID: boardID},
		{ID: "repo-free", Owner: "acme", Name: "free"},
	}

	toNoBoard, removed, err := f.service.RemovalPreview(boardID)
	if err != nil || toNoBoard != 1 || removed != 1 {
		t.Errorf("RemovalPreview() = %d, %d, %v, want 1, 1, nil", toNoBoard, removed, err)
	}
	if err := f.service.Remove(t.Context(), boardID); err != nil {
		t.Fatalf("Remove() = %v, want nil", err)
	}

	wantReleases := []board.Release{
		{RepositoryID: "repo-web"},
		{RepositoryID: "repo-api", Remove: true},
	}
	if diff := cmp.Diff(wantReleases, f.store.releases); diff != "" {
		t.Errorf("the releases stored (-want +got):\n%s", diff)
	}
	if _, ok := f.service.Get(boardID); ok {
		t.Error("Get() found the board removed")
	}
	if boards, _ := f.store.ListBoards(t.Context()); len(boards) != 0 {
		t.Errorf("the store holds %+v, want no board", boards)
	}
}
