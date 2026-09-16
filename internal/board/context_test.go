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

	if diff := cmp.Diff(want, board.Context(card, "  Mind the dark theme.\n")); diff != "" {
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

	if diff := cmp.Diff(want, board.Context(card, " \n")); diff != "" {
		t.Errorf("Context() (-want +got):\n%s", diff)
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
