package bindings

import (
	"cmp"
	"errors"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"
)

// HistoryWindow is how far back the state carries the History: the rest comes
// page by page from HistoryService.
const HistoryWindow = 90 * 24 * time.Hour

// HistoryPageSize is how many archived items a page of HistoryService holds.
const HistoryPageSize = 50

// WindowStart is the first moment the state carries archived items from: the
// start of a UTC day, so it moves once a day and the pages the frontend holds
// are not started over by every state, and whole seconds, so the RFC 3339
// times of the DTOs compare with it exactly.
func WindowStart(now time.Time) time.Time { return now.Add(-HistoryWindow).Truncate(24 * time.Hour) }

// errHistoryCursor is what a page asked for after a time that is not RFC 3339.
var errHistoryCursor = errors.New("bindings: invalid history cursor")

// numberQuery is a query that is a number, with or without the hash.
var numberQuery = regexp.MustCompile(`^#?\d+$`)

// historyEntry is one archived item of any kind, with what the order and the
// filters of the History read.
type historyEntry struct {
	archivedAt time.Time
	id         string
	task       *ArchivedTask
	review     *ArchivedReview
	discussion *ArchivedDiscussion
}

// historyEntries are the items of the three lists, newest first, ties broken
// by the greater id.
func historyEntries(tasks []ArchivedTask, reviews []ArchivedReview, discussions []ArchivedDiscussion) []historyEntry {
	entries := make([]historyEntry, 0, len(tasks)+len(reviews)+len(discussions))
	for i := range tasks {
		entries = append(entries, historyEntry{archivedAt: archivedTime(tasks[i].ArchivedAt), id: tasks[i].ID, task: &tasks[i]})
	}
	for i := range reviews {
		entries = append(entries, historyEntry{archivedAt: archivedTime(reviews[i].ArchivedAt), id: reviews[i].ID, review: &reviews[i]})
	}
	for i := range discussions {
		entries = append(entries, historyEntry{
			archivedAt: archivedTime(discussions[i].ArchivedAt), id: discussions[i].ID, discussion: &discussions[i],
		})
	}
	slices.SortFunc(entries, func(a, b historyEntry) int {
		return cmp.Or(b.archivedAt.Compare(a.archivedAt), strings.Compare(b.id, a.id))
	})
	return entries
}

// archivedTime is the instant of an RFC 3339 time of a DTO; the zero time when
// it does not parse.
func archivedTime(value string) time.Time {
	at, _ := time.Parse(time.RFC3339, value)
	return at
}

// matchesQuery says whether the name or the title of the item has the query,
// ignoring case; a query that is a number also matches the numbers of the
// pull request and the card of a task and of the pull request of a review.
func matchesQuery(entry historyEntry, query string) bool {
	q := strings.ToLower(strings.TrimSpace(query))
	if q == "" {
		return true
	}
	var title string
	var numbers []int
	switch {
	case entry.task != nil:
		title = entry.task.Name
		if entry.task.PR != nil {
			numbers = append(numbers, entry.task.PR.Number)
		}
		if entry.task.Card != nil {
			numbers = append(numbers, entry.task.Card.Number)
		}
	case entry.review != nil:
		title = entry.review.Title
		numbers = append(numbers, entry.review.Number)
	case entry.discussion != nil:
		title = entry.discussion.Title
	}
	if strings.Contains(strings.ToLower(title), q) {
		return true
	}
	if numberQuery.MatchString(q) {
		n, err := strconv.Atoi(strings.TrimPrefix(q, "#"))
		return err == nil && slices.Contains(numbers, n)
	}
	return false
}

// inRepository says whether the item belongs to the repository; "" matches all.
func inRepository(entry historyEntry, id string) bool {
	switch {
	case id == "":
		return true
	case entry.task != nil:
		return entry.task.RepositoryID == id
	case entry.review != nil:
		return entry.review.RepositoryID == id
	case entry.discussion != nil:
		return slices.Contains(entry.discussion.RepositoryIDs, id)
	}
	return false
}

// historyPage is the page of the entries the request asks for, with how many
// of them match its query and repository.
func historyPage(entries []historyEntry, request HistoryRequest) (HistoryPage, error) {
	before, err := time.Parse(time.RFC3339, request.Before)
	if err != nil {
		return HistoryPage{}, errHistoryCursor
	}
	matching := make([]historyEntry, 0, len(entries))
	for _, entry := range entries {
		if matchesQuery(entry, request.Query) && inRepository(entry, request.RepositoryID) {
			matching = append(matching, entry)
		}
	}
	page := HistoryPage{
		Tasks: []ArchivedTask{}, Reviews: []ArchivedReview{}, Discussions: []ArchivedDiscussion{},
		Matched: len(matching),
	}
	older := matching[:0:0]
	for _, entry := range matching {
		if entry.archivedAt.Before(before) || (entry.archivedAt.Equal(before) && entry.id < request.BeforeID) {
			older = append(older, entry)
		}
	}
	more := len(older) > HistoryPageSize
	if more {
		older = older[:HistoryPageSize]
	}
	for _, entry := range older {
		switch {
		case entry.task != nil:
			page.Tasks = append(page.Tasks, *entry.task)
		case entry.review != nil:
			page.Reviews = append(page.Reviews, *entry.review)
		case entry.discussion != nil:
			page.Discussions = append(page.Discussions, *entry.discussion)
		}
	}
	if more {
		last := older[len(older)-1]
		page.NextBefore, page.NextBeforeID = last.archivedAt.UTC().Format(time.RFC3339), last.id
	}
	return page, nil
}
