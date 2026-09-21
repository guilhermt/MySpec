package board_test

import (
	"strconv"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/board"
	"github.com/guilhermt/myspec/internal/task"
)

func TestContextIsTheCardWithEverythingAroundIt(t *testing.T) {
	t.Parallel()

	card := board.Card{
		Issue:     issue("acme", "web", 12, "Login screen", task.IssueOpen),
		Body:      "\n  Build the login screen.\n",
		Status:    "In progress",
		Fields:    []board.Field{{Name: "Priority", Value: "High"}, {Name: "Estimate", Value: "3"}},
		Assignees: []board.Assignee{{Login: "ana"}, {Login: "bia"}},
		Epic:      &board.Epic{Issue: issue("acme", "web", 3, "Accounts", task.IssueOpen)},
		Siblings: []board.Related{
			{Issue: issue("acme", "web", 13, "Logout", task.IssueOpen), Status: "Todo", OnBoard: true},
			{Issue: issue("acme", "api", 14, "Sessions", task.IssueClosed)},
		},
		Dependencies: []board.Dependency{
			{
				Related: board.Related{Issue: issue("acme", "api", 20, "Auth endpoint", task.IssueOpen), Status: "Review", OnBoard: true},
				PullRequests: []board.PullRequest{
					{Owner: "acme", Name: "api", Number: 21, State: board.PRMerged},
					{Owner: "acme", Name: "api", Number: 22, State: board.PROpen},
				},
			},
			{Related: board.Related{Issue: issue("other", "lib", 5, "Tokens", task.IssueClosed)}},
		},
	}

	want := `### Card: Login screen

- Issue: acme/web#12
- Link: https://github.com/acme/web/issues/12
- Status: In progress
- Priority: High
- Estimate: 3
- Assignees: ana, bia

Build the login screen.

### Epic: Accounts

- Issue: acme/web#3
- Link: https://github.com/acme/web/issues/3

_The epic has no description._

### Sibling cards

- acme/web#13 Logout · Todo
- acme/api#14 Sessions · Closed

### Dependencies

- acme/api#20 Auth endpoint · Open · Review · PR acme/api#21 (merged), PR acme/api#22 (open)
- other/lib#5 Tokens · Closed · No pull request

### Additional context

Mind the dark theme.`

	if diff := cmp.Diff(want, board.Context(card, "", "  Mind the dark theme.\n")); diff != "" {
		t.Errorf("Context() (-want +got):\n%s", diff)
	}
}

func TestContextOmitsTheSectionsWithNothing(t *testing.T) {
	t.Parallel()

	card := board.Card{Issue: issue("acme", "web", 12, "Login screen", task.IssueOpen), Epic: &board.Epic{
		Issue: issue("acme", "web", 3, "Accounts", task.IssueOpen),
		Body:  " The account epic. ",
	}}

	want := `### Card: Login screen

- Issue: acme/web#12
- Link: https://github.com/acme/web/issues/12

_The card has no description._

### Epic: Accounts

- Issue: acme/web#3
- Link: https://github.com/acme/web/issues/3

The account epic.`

	if diff := cmp.Diff(want, board.Context(card, "", " \n")); diff != "" {
		t.Errorf("Context() (-want +got):\n%s", diff)
	}
}

func TestContextCarriesTheDocumentOfTheDiscussionTheCardCameFrom(t *testing.T) {
	t.Parallel()

	card := board.Card{Issue: issue("acme", "web", 12, "Login screen", task.IssueOpen), Body: "Build the login screen."}

	want := `### Card: Login screen

- Issue: acme/web#12
- Link: https://github.com/acme/web/issues/12

Build the login screen.

### Discussion

What we agreed about accounts.

### Additional context

Mind the dark theme.`

	got := board.Context(card, "\nWhat we agreed about accounts.\n", "Mind the dark theme.")
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("Context() (-want +got):\n%s", diff)
	}
}

func TestDiscussionContextIsTheBoardWhatToDiscussAndEveryCard(t *testing.T) {
	t.Parallel()

	in := board.DiscussionContextInput{
		Title:      "Accounts",
		BoardTitle: "Roadmap",
		BoardURL:   "https://github.com/orgs/acme/projects/3",
		Repositories: []board.DiscussionRepository{
			{FullName: "acme/web", Path: "/home/dev/web"},
			{FullName: "acme/api"},
		},
		Text: "  What is missing in accounts?\n",
		Cards: []board.Card{
			{
				Issue:     issue("acme", "web", 12, "Login screen", task.IssueOpen),
				Body:      "Build the login screen.",
				Status:    "In progress",
				Fields:    []board.Field{{Name: "Priority", Value: "High"}},
				Assignees: []board.Assignee{{Login: "ana"}},
				Epic:      &board.Epic{Issue: issue("acme", "web", 3, "Accounts", task.IssueOpen), Body: "The account epic."},
				Siblings: []board.Related{
					{Issue: issue("acme", "web", 13, "Logout", task.IssueOpen), Status: "Todo", OnBoard: true},
				},
				Dependencies: []board.Dependency{
					{Related: board.Related{Issue: issue("acme", "api", 20, "Auth endpoint", task.IssueOpen), Status: "Review", OnBoard: true}},
				},
			},
			{Issue: issue("acme", "api", 14, "Sessions", task.IssueClosed)},
		},
	}

	want := `# Accounts

## Board

- Board: Roadmap
- Link: https://github.com/orgs/acme/projects/3
- Repositories:
  - acme/web: /home/dev/web
  - acme/api: Not cloned

## What to discuss

What is missing in accounts?

## Card: Login screen

- Issue: acme/web#12
- Link: https://github.com/acme/web/issues/12
- State: Open
- Status: In progress
- Priority: High
- Assignees: ana

Build the login screen.

### Epic: Accounts

- Issue: acme/web#3
- Link: https://github.com/acme/web/issues/3

The account epic.

### Sibling cards

- acme/web#13 Logout · Todo

### Dependencies

- acme/api#20 Auth endpoint · Open · Review · No pull request

## Card: Sessions

- Issue: acme/api#14
- Link: https://github.com/acme/api/issues/14
- State: Closed

_The card has no description._`

	if diff := cmp.Diff(want, board.DiscussionContext(in)); diff != "" {
		t.Errorf("DiscussionContext() (-want +got):\n%s", diff)
	}
}

func TestDiscussionContextWithoutCardsOrTextIsTheBoardAlone(t *testing.T) {
	t.Parallel()

	in := board.DiscussionContextInput{
		Title:        "Accounts",
		BoardTitle:   "Roadmap",
		BoardURL:     "https://github.com/orgs/acme/projects/3",
		Repositories: []board.DiscussionRepository{{FullName: "acme/web", Path: "/home/dev/web"}},
		Text:         " \n",
	}

	want := `# Accounts

## Board

- Board: Roadmap
- Link: https://github.com/orgs/acme/projects/3
- Repositories:
  - acme/web: /home/dev/web`

	if diff := cmp.Diff(want, board.DiscussionContext(in)); diff != "" {
		t.Errorf("DiscussionContext() (-want +got):\n%s", diff)
	}
}

func TestDiscussionContextWithoutATitleOpensAtTheBoard(t *testing.T) {
	t.Parallel()

	in := board.DiscussionContextInput{
		BoardTitle:   "Roadmap",
		BoardURL:     "https://github.com/orgs/acme/projects/3",
		Repositories: []board.DiscussionRepository{{FullName: "acme/web", Path: "/home/dev/web"}},
		Text:         "What is missing in accounts?",
	}

	want := `## Board

- Board: Roadmap
- Link: https://github.com/orgs/acme/projects/3
- Repositories:
  - acme/web: /home/dev/web

## What to discuss

What is missing in accounts?`

	if diff := cmp.Diff(want, board.DiscussionContext(in)); diff != "" {
		t.Errorf("DiscussionContext() (-want +got):\n%s", diff)
	}
}

func TestReviewContextIsTheCardAndItsEpicOnly(t *testing.T) {
	t.Parallel()

	card := board.Card{
		Issue:  issue("acme", "web", 12, "Login screen", task.IssueOpen),
		Body:   "Build the login screen.",
		Status: "In progress",
		Epic:   &board.Epic{Issue: issue("acme", "web", 3, "Accounts", task.IssueOpen), Body: "The account epic."},
		Siblings: []board.Related{
			{Issue: issue("acme", "web", 13, "Logout", task.IssueOpen), Status: "Todo", OnBoard: true},
		},
		Dependencies: []board.Dependency{
			{Related: board.Related{Issue: issue("other", "lib", 5, "Tokens", task.IssueClosed)}},
		},
	}

	want := `### Card: Login screen

- Issue: acme/web#12
- Link: https://github.com/acme/web/issues/12
- Status: In progress

Build the login screen.

### Epic: Accounts

- Issue: acme/web#3
- Link: https://github.com/acme/web/issues/3

The account epic.`

	if diff := cmp.Diff(want, board.ReviewContext(card)); diff != "" {
		t.Errorf("ReviewContext() (-want +got):\n%s", diff)
	}
}

func TestReviewContextOfACardWithoutAnEpicIsTheCard(t *testing.T) {
	t.Parallel()

	card := board.Card{Issue: issue("acme", "web", 12, "Login screen", task.IssueOpen)}

	want := `### Card: Login screen

- Issue: acme/web#12
- Link: https://github.com/acme/web/issues/12

_The card has no description._`

	if diff := cmp.Diff(want, board.ReviewContext(card)); diff != "" {
		t.Errorf("ReviewContext() (-want +got):\n%s", diff)
	}
}

func issue(owner, name string, number int, title string, state task.IssueState) board.Issue {
	return board.Issue{
		Owner:  owner,
		Name:   name,
		Number: number,
		Title:  title,
		URL:    "https://github.com/" + owner + "/" + name + "/issues/" + strconv.Itoa(number),
		State:  state,
	}
}
