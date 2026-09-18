package pulls_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/pulls"
)

// filtered is the pull request the filter tests match, of acme/alpha.
var filtered = pulls.PullRequest{
	Owner: "acme", Name: "alpha", Number: 42,
	Author: "Mariana",
	Labels: []pulls.Label{{Name: "backend"}, {Name: "chore"}},
}

func TestAFilterKeepsThePullRequestsItNames(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		filters pulls.Filters
		pending bool
		want    bool
	}{
		{name: "the zero value keeps everything", want: true},
		{name: "the board it belongs to", filters: pulls.Filters{BoardID: "board-1"}, want: true},
		{name: "another board", filters: pulls.Filters{BoardID: "board-2"}},
		{name: "no board, while it has one", filters: pulls.Filters{BoardID: pulls.NoBoard}},
		{name: "its repository", filters: pulls.Filters{RepositoryID: alphaID}, want: true},
		{name: "another repository", filters: pulls.Filters{RepositoryID: betaID}},
		{name: "its author, in another case", filters: pulls.Filters{AuthorsInclude: []string{"mariana"}}, want: true},
		{name: "another author only", filters: pulls.Filters{AuthorsInclude: []string{"dependabot"}}},
		{name: "its author excluded", filters: pulls.Filters{AuthorsExclude: []string{"mariana"}}},
		{name: "another author excluded", filters: pulls.Filters{AuthorsExclude: []string{"dependabot"}}, want: true},
		{name: "one of its labels", filters: pulls.Filters{LabelsInclude: []string{"Backend", "docs"}}, want: true},
		{name: "a label it has not", filters: pulls.Filters{LabelsInclude: []string{"docs"}}},
		{name: "one of its labels excluded", filters: pulls.Filters{LabelsExclude: []string{"chore"}}},
		{name: "a label it has not excluded", filters: pulls.Filters{LabelsExclude: []string{"docs"}}, want: true},
		{name: "pending only, while pending", filters: pulls.Filters{PendingOnly: true}, pending: true, want: true},
		{name: "pending only, while not pending", filters: pulls.Filters{PendingOnly: true}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()

			if got := c.filters.Match(filtered, alphaID, "board-1", c.pending); got != c.want {
				t.Errorf("Match() = %v, want %v", got, c.want)
			}
		})
	}
}

func TestAPullRequestWithoutABoardPassesTheNoBoardFilter(t *testing.T) {
	t.Parallel()

	f := pulls.Filters{BoardID: pulls.NoBoard}
	if !f.Match(filtered, alphaID, "", false) {
		t.Errorf("Match() = false, want true for a repository on no board")
	}
}

func TestAPullRequestWithoutALabelPassesOnlyAnEmptyIncludeList(t *testing.T) {
	t.Parallel()

	bare := pulls.PullRequest{Author: "mariana"}
	if !(pulls.Filters{}).Match(bare, alphaID, "", false) {
		t.Errorf("Match() = false, want true with no filter")
	}
	if (pulls.Filters{LabelsInclude: []string{"backend"}}).Match(bare, alphaID, "", false) {
		t.Errorf("Match() = true, want false: it has no label to include")
	}
	if !(pulls.Filters{LabelsExclude: []string{"backend"}}).Match(bare, alphaID, "", false) {
		t.Errorf("Match() = false, want true: it has no label to exclude")
	}
}

func TestAPullRequestIsPendingUntilTheUserReviewsItsLastCommit(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name   string
		pr     pulls.PullRequest
		taskPR bool
		want   bool
	}{
		{name: "never reviewed", pr: pulls.PullRequest{Author: "mariana", HeadCommit: "aaa"}, want: true},
		{
			name: "reviewed at its tip",
			pr:   pulls.PullRequest{Author: "mariana", HeadCommit: "aaa", Reviewed: true, ReviewedCommit: "aaa"},
		},
		{
			name: "reviewed before its tip",
			pr:   pulls.PullRequest{Author: "mariana", HeadCommit: "bbb", Reviewed: true, ReviewedCommit: "aaa"},
			want: true,
		},
		{name: "written by the user", pr: pulls.PullRequest{Author: "GuilhermT", HeadCommit: "aaa"}},
		{name: "of a task of the app", pr: pulls.PullRequest{Author: "mariana", HeadCommit: "aaa"}, taskPR: true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()

			if got := pulls.Pending(c.pr, "guilhermt", c.taskPR); got != c.want {
				t.Errorf("Pending() = %v, want %v", got, c.want)
			}
		})
	}
}

func TestStoredFiltersAreSortedWithoutBlanksAndWithoutRepeats(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	err := f.service.SetFilters(t.Context(), pulls.Filters{
		AuthorsExclude: []string{" renovate ", "dependabot", "Dependabot", ""},
	})
	if err != nil {
		t.Fatalf("SetFilters() = %v, want nil", err)
	}

	want := pulls.Filters{
		AuthorsInclude: []string{},
		AuthorsExclude: []string{"dependabot", "renovate"},
		LabelsInclude:  []string{},
		LabelsExclude:  []string{},
	}
	if diff := cmp.Diff(want, f.service.Filters()); diff != "" {
		t.Errorf("Filters() (-want +got):\n%s", diff)
	}
}
