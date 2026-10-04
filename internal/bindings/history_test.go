package bindings_test

import (
	"fmt"
	"log/slog"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/discussion"
	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/task"
)

// historyBase is an instant of whole seconds the fixtures of the History count from.
var historyBase = time.Date(2026, time.September, 1, 12, 0, 0, 0, time.UTC)

func historyTime(minutes int) string {
	return historyBase.Add(time.Duration(minutes) * time.Minute).Format(time.RFC3339)
}

func newHistoryService(
	tasks []bindings.ArchivedTask, reviews []bindings.ArchivedReview, discussions []bindings.ArchivedDiscussion,
) *bindings.HistoryService {
	return bindings.NewHistoryService(bindings.HistorySources{
		Tasks:       func() []bindings.ArchivedTask { return tasks },
		Reviews:     func() []bindings.ArchivedReview { return reviews },
		Discussions: func() []bindings.ArchivedDiscussion { return discussions },
	}, slog.New(slog.DiscardHandler))
}

func ids(page bindings.HistoryPage) []string {
	out := make([]string, 0, len(page.Tasks)+len(page.Reviews)+len(page.Discussions))
	for _, t := range page.Tasks {
		out = append(out, t.ID)
	}
	for _, r := range page.Reviews {
		out = append(out, r.ID)
	}
	for _, d := range page.Discussions {
		out = append(out, d.ID)
	}
	return out
}

func TestWindowStartIsTheLocalMidnightNinetyDaysBack(t *testing.T) {
	t.Parallel()
	saoPaulo := time.FixedZone("BRT", -3*60*60)
	tokyo := time.FixedZone("JST", 9*60*60)

	tests := []struct {
		name string
		now  time.Time
		want time.Time
	}{
		{
			"in UTC",
			time.Date(2026, time.October, 3, 10, 30, 15, 750_000_000, time.UTC),
			time.Date(2026, time.July, 5, 0, 0, 0, 0, time.UTC),
		},
		{
			"behind UTC, early in the local day",
			time.Date(2026, time.October, 3, 1, 30, 0, 0, saoPaulo),
			time.Date(2026, time.July, 5, 0, 0, 0, 0, saoPaulo),
		},
		{
			"behind UTC, late in the local day, when UTC is already on the next",
			time.Date(2026, time.October, 3, 22, 30, 0, 0, saoPaulo),
			time.Date(2026, time.July, 5, 0, 0, 0, 0, saoPaulo),
		},
		{
			"ahead of UTC, early in the local day, when UTC is still on the day before",
			time.Date(2026, time.October, 3, 2, 0, 0, 0, tokyo),
			time.Date(2026, time.July, 5, 0, 0, 0, 0, tokyo),
		},
		{
			"across the start of the year",
			time.Date(2026, time.February, 15, 12, 0, 0, 0, saoPaulo),
			time.Date(2025, time.November, 17, 0, 0, 0, 0, saoPaulo),
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			if got := bindings.WindowStart(test.now); !got.Equal(test.want) {
				t.Errorf("WindowStart(%s) = %s, want %s", test.now, got, test.want)
			}
		})
	}
}

func TestFromHistorySummaryCountsTheWholeHistoryAndFindsTheOldest(t *testing.T) {
	t.Parallel()
	start := historyBase

	tests := []struct {
		name        string
		tasks       []task.Task
		reviews     []prreview.Review
		discussions []discussion.Discussion
		want        bindings.HistorySummary
	}{
		{
			name: "nothing",
			want: bindings.HistorySummary{WindowStart: start.Format(time.RFC3339)},
		},
		{
			name:        "every kind",
			tasks:       []task.Task{{ArchivedAt: historyBase.Add(-time.Hour)}, {ArchivedAt: historyBase}},
			reviews:     []prreview.Review{{ArchivedAt: historyBase.Add(-48 * time.Hour)}},
			discussions: []discussion.Discussion{{ArchivedAt: historyBase.Add(-2 * time.Hour)}},
			want: bindings.HistorySummary{
				Tasks: 2, Reviews: 1, Discussions: 1,
				Oldest:      historyBase.Add(-48 * time.Hour).Format(time.RFC3339),
				WindowStart: start.Format(time.RFC3339),
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := bindings.FromHistorySummary(tt.tasks, tt.reviews, tt.discussions, start)

			if diff := cmp.Diff(tt.want, got); diff != "" {
				t.Errorf("FromHistorySummary() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestListArchivedPagesTheHistoryByDate(t *testing.T) {
	t.Parallel()
	tasks := make([]bindings.ArchivedTask, 0, 120)
	for i := range 120 { // newest first, as the services keep them
		tasks = append(tasks, bindings.ArchivedTask{ID: fmt.Sprintf("t-%03d", 119-i), ArchivedAt: historyTime(119 - i)})
	}
	service := newHistoryService(tasks, nil, nil)

	request := bindings.HistoryRequest{Before: historyTime(1000)}
	var sizes []int
	var cursors []string
	for range 5 {
		page, err := service.ListArchived(request)
		if err != nil {
			t.Fatalf("ListArchived() error = %v", err)
		}
		if page.Matched != 120 {
			t.Errorf("Matched = %d, want 120", page.Matched)
		}
		sizes = append(sizes, len(page.Tasks))
		cursors = append(cursors, page.NextBefore+"|"+page.NextBeforeID)
		if page.NextBefore == "" {
			break
		}
		request.Before, request.BeforeID = page.NextBefore, page.NextBeforeID
	}

	if diff := cmp.Diff([]int{50, 50, 20}, sizes); diff != "" {
		t.Errorf("page sizes mismatch (-want +got):\n%s", diff)
	}
	wantCursors := []string{historyTime(70) + "|t-070", historyTime(20) + "|t-020", "|"}
	if diff := cmp.Diff(wantCursors, cursors); diff != "" {
		t.Errorf("cursors mismatch (-want +got):\n%s", diff)
	}
}

func TestListArchivedBreaksATieOfTimeByTheId(t *testing.T) {
	t.Parallel()
	at := historyTime(0)
	service := newHistoryService(
		[]bindings.ArchivedTask{{ID: "b", ArchivedAt: at}, {ID: "a", ArchivedAt: at}},
		[]bindings.ArchivedReview{{ID: "c", ArchivedAt: at}},
		nil,
	)

	page, err := service.ListArchived(bindings.HistoryRequest{Before: at, BeforeID: "c"})
	if err != nil {
		t.Fatalf("ListArchived() error = %v", err)
	}

	if diff := cmp.Diff([]string{"b", "a"}, ids(page)); diff != "" {
		t.Errorf("items after the cursor mismatch (-want +got):\n%s", diff)
	}
}

func TestListArchivedSearchesTheWholeHistory(t *testing.T) {
	t.Parallel()
	service := newHistoryService(
		[]bindings.ArchivedTask{
			{ID: "t-1", Name: "Rate limit", ArchivedAt: historyTime(5), PR: &bindings.ArchivedPR{Number: 1279}},
			{ID: "t-2", Name: "Other", ArchivedAt: historyTime(4), Card: &bindings.TaskCard{Number: 1279}},
			{ID: "t-3", Name: "Nothing", ArchivedAt: historyTime(3), PR: &bindings.ArchivedPR{Number: 12790}},
		},
		[]bindings.ArchivedReview{{ID: "r-1", Title: "Cache the TOKEN lookup", Number: 1279, ArchivedAt: historyTime(2)}},
		[]bindings.ArchivedDiscussion{{ID: "d-1", Title: "Token rotation", ArchivedAt: historyTime(1)}},
	)
	before := historyTime(1000)

	tests := []struct {
		query string
		want  []string
	}{
		{"#1279", []string{"t-1", "t-2", "r-1"}},
		{"1279", []string{"t-1", "t-2", "r-1"}},
		{"  rate LIMIT ", []string{"t-1"}},
		{"token", []string{"r-1", "d-1"}},
		{"", []string{"t-1", "t-2", "t-3", "r-1", "d-1"}},
		{"absent", []string{}},
	}
	for _, tt := range tests {
		t.Run(tt.query, func(t *testing.T) {
			t.Parallel()

			page, err := service.ListArchived(bindings.HistoryRequest{Before: before, Query: tt.query})
			if err != nil {
				t.Fatalf("ListArchived() error = %v", err)
			}

			if diff := cmp.Diff(tt.want, ids(page)); diff != "" {
				t.Errorf("items mismatch (-want +got):\n%s", diff)
			}
			if page.Matched != len(tt.want) {
				t.Errorf("Matched = %d, want %d", page.Matched, len(tt.want))
			}
		})
	}
}

func TestListArchivedCountsTheItemsBeforeTheCursorToo(t *testing.T) {
	t.Parallel()
	service := newHistoryService(
		[]bindings.ArchivedTask{{ID: "new", Name: "Cache", ArchivedAt: historyTime(10)}, {ID: "old", Name: "Cache", ArchivedAt: historyTime(1)}},
		nil, nil,
	)

	page, err := service.ListArchived(bindings.HistoryRequest{Before: historyTime(5), Query: "cache"})
	if err != nil {
		t.Fatalf("ListArchived() error = %v", err)
	}

	if diff := cmp.Diff([]string{"old"}, ids(page)); diff != "" {
		t.Errorf("items mismatch (-want +got):\n%s", diff)
	}
	if page.Matched != 2 {
		t.Errorf("Matched = %d, want 2, the window included", page.Matched)
	}
}

func TestListArchivedFiltersByRepository(t *testing.T) {
	t.Parallel()
	service := newHistoryService(
		[]bindings.ArchivedTask{{ID: "t-1", RepositoryID: "r-1", ArchivedAt: historyTime(3)}, {ID: "t-2", RepositoryID: "r-2", ArchivedAt: historyTime(2)}},
		[]bindings.ArchivedReview{{ID: "rv-1", RepositoryID: "r-2", ArchivedAt: historyTime(1)}},
		[]bindings.ArchivedDiscussion{{ID: "d-1", RepositoryIDs: []string{"r-1", "r-2"}, ArchivedAt: historyTime(0)}},
	)

	page, err := service.ListArchived(bindings.HistoryRequest{Before: historyTime(1000), RepositoryID: "r-2"})
	if err != nil {
		t.Fatalf("ListArchived() error = %v", err)
	}

	if diff := cmp.Diff([]string{"t-2", "rv-1", "d-1"}, ids(page)); diff != "" {
		t.Errorf("items mismatch (-want +got):\n%s", diff)
	}
}

func TestListArchivedRefusesACursorThatIsNotATime(t *testing.T) {
	t.Parallel()
	service := newHistoryService(nil, nil, nil)

	_, err := service.ListArchived(bindings.HistoryRequest{Before: "yesterday"})

	if err == nil {
		t.Error("ListArchived() error = nil, want the invalid cursor")
	}
}

func TestListArchivedNeverReturnsNilLists(t *testing.T) {
	t.Parallel()
	service := newHistoryService(nil, nil, nil)

	page, err := service.ListArchived(bindings.HistoryRequest{Before: historyTime(0)})
	if err != nil {
		t.Fatalf("ListArchived() error = %v", err)
	}

	if page.Tasks == nil || page.Reviews == nil || page.Discussions == nil {
		t.Errorf("page = %+v, want every list allocated", page)
	}
}

func TestGetArchivedFindsAnItemOfAnyKindById(t *testing.T) {
	t.Parallel()
	service := newHistoryService(
		[]bindings.ArchivedTask{{ID: "t-1"}}, []bindings.ArchivedReview{{ID: "r-1"}}, []bindings.ArchivedDiscussion{{ID: "d-1"}},
	)

	tests := []struct {
		id                     string
		task, review, discussn bool
	}{
		{"t-1", true, false, false},
		{"r-1", false, true, false},
		{"d-1", false, false, true},
		{"nope", false, false, false},
	}
	for _, tt := range tests {
		t.Run(tt.id, func(t *testing.T) {
			t.Parallel()

			got, err := service.GetArchived(tt.id)
			if err != nil {
				t.Fatalf("GetArchived() error = %v", err)
			}

			if (got.Task != nil) != tt.task || (got.Review != nil) != tt.review || (got.Discussion != nil) != tt.discussn {
				t.Errorf("GetArchived(%q) = %+v, want task %v review %v discussion %v", tt.id, got, tt.task, tt.review, tt.discussn)
			}
		})
	}
}

func TestArchivedDiscussionRepositoriesCountsEachRepositoryOfEachDiscussion(t *testing.T) {
	t.Parallel()
	repos := []bindings.Repository{{ID: "r-1", FullName: "acme/web"}, {ID: "r-2", FullName: "acme/api"}}
	list := []discussion.Discussion{
		{ID: "d-1", Cards: []discussion.InputCard{{Owner: "acme", Name: "web"}}},
		{ID: "d-2", Cards: []discussion.InputCard{{Owner: "acme", Name: "web"}, {Owner: "acme", Name: "web"}}},
		{ID: "d-3"},
	}

	got := bindings.ArchivedDiscussionRepositories(list, func(string) []discussion.Draft { return nil }, repos)

	if diff := cmp.Diff(map[string]int{"r-1": 2}, got); diff != "" {
		t.Errorf("counts mismatch (-want +got):\n%s", diff)
	}
}
