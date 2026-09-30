package pulls

import (
	"slices"
	"strings"
)

// NoBoard stands for the repositories that belong to no board.
const NoBoard = "__none__"

// filtersSetting is the settings key that remembers the filters, as the JSON
// of Filters.
const filtersSetting = "review_filters"

// Filters is what the Reviews view shows. The zero value shows everything.
type Filters struct {
	BoardID        string   `json:"boardId"`      // "" for any; NoBoard for the repositories without one
	RepositoryID   string   `json:"repositoryId"` // "" for any
	AuthorsInclude []string `json:"authorsInclude"`
	AuthorsExclude []string `json:"authorsExclude"`
	LabelsInclude  []string `json:"labelsInclude"`
	LabelsExclude  []string `json:"labelsExclude"`
	// BoardName and RepositoryName are the names of the board or the repository
	// when it was chosen, which the chip of one that left shows; Match never
	// reads them.
	BoardName      string `json:"boardName"`
	RepositoryName string `json:"repositoryName"`
}

// Match reports whether a pull request passes the filters. boardID is the
// board of its repository, "" when it belongs to none.
func (f Filters) Match(pr PullRequest, repositoryID, boardID string) bool {
	switch {
	case f.RepositoryID != "" && f.RepositoryID != repositoryID:
		return false
	case f.BoardID == NoBoard && boardID != "":
		return false
	case f.BoardID != "" && f.BoardID != NoBoard && f.BoardID != boardID:
		return false
	}
	if !matchOne(pr.Author, f.AuthorsInclude, f.AuthorsExclude) {
		return false
	}
	names := make([]string, len(pr.Labels))
	for i, l := range pr.Labels {
		names[i] = l.Name
	}
	return matchAny(names, f.LabelsInclude, f.LabelsExclude)
}

// Pending reports whether a pull request waits for the review of the user.
// viewer is the account of gh; taskPR says the pull request belongs to a task
// of the app, which is reviewed in the task.
func Pending(pr PullRequest, viewer string, taskPR bool) bool {
	if taskPR || strings.EqualFold(pr.Author, viewer) {
		return false
	}
	return !pr.Reviewed || pr.NewCommits()
}

// matchOne reports whether value passes an include and an exclude list.
func matchOne(value string, include, exclude []string) bool {
	return matchAny([]string{value}, include, exclude)
}

// matchAny reports whether values pass an include and an exclude list: at
// least one of them is included, when the include list has anything, and none
// of them is excluded. Case is ignored.
func matchAny(values, include, exclude []string) bool {
	has := func(list []string) bool {
		return slices.ContainsFunc(values, func(v string) bool {
			return slices.ContainsFunc(list, func(w string) bool { return strings.EqualFold(v, w) })
		})
	}
	if len(include) > 0 && !has(include) {
		return false
	}
	return !has(exclude)
}

// normalized is the filters as they are stored: every list sorted, without
// blanks, without repeats and never nil.
func (f Filters) normalized() Filters {
	f.AuthorsInclude = normalizeList(f.AuthorsInclude)
	f.AuthorsExclude = normalizeList(f.AuthorsExclude)
	f.LabelsInclude = normalizeList(f.LabelsInclude)
	f.LabelsExclude = normalizeList(f.LabelsExclude)
	return f
}

// normalizeList trims the values, drops the blanks and the repeats, ignoring
// case, and sorts what is left; never nil.
func normalizeList(values []string) []string {
	list := []string{}
	for _, v := range values {
		v = strings.TrimSpace(v)
		if v == "" || slices.ContainsFunc(list, func(w string) bool { return strings.EqualFold(v, w) }) {
			continue
		}
		list = append(list, v)
	}
	slices.SortFunc(list, func(a, b string) int {
		return strings.Compare(strings.ToLower(a), strings.ToLower(b))
	})
	return list
}

// clone is a copy that shares no list with f.
func (f Filters) clone() Filters {
	f.AuthorsInclude = slices.Clone(f.AuthorsInclude)
	f.AuthorsExclude = slices.Clone(f.AuthorsExclude)
	f.LabelsInclude = slices.Clone(f.LabelsInclude)
	f.LabelsExclude = slices.Clone(f.LabelsExclude)
	return f
}
