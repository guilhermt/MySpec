package board

import (
	"strconv"
	"strings"

	"github.com/guilhermt/myspec/internal/task"
)

// The text that stands in for what a card or an epic does not say.
const (
	emptyCardBody    = "_The card has no description._"
	emptyEpicBody    = "_The epic has no description._"
	noPullRequest    = "No pull request"
	contextSeparator = " · "
	stateOpenLabel   = "Open"
	stateClosedLabel = "Closed"
)

// Context is the initial context of a task created from a card: the card, its
// epic, its siblings and its dependencies, then what the user added.
func Context(card Card, additional string) string {
	sections := []string{cardSection(card)}
	if card.Epic != nil {
		sections = append(sections, epicSection(*card.Epic))
	}
	if len(card.Siblings) > 0 {
		sections = append(sections, siblingsSection(card.Siblings))
	}
	if len(card.Dependencies) > 0 {
		sections = append(sections, dependenciesSection(card.Dependencies))
	}
	if extra := strings.TrimSpace(additional); extra != "" {
		sections = append(sections, "### Additional context\n\n"+extra)
	}
	return strings.Join(sections, "\n\n")
}

// cardSection is the card with its status, fields, assignees and body.
func cardSection(card Card) string {
	lines := []string{
		"### Card: " + card.Title,
		"",
		"- Issue: " + reference(card.Issue),
		"- Link: " + card.URL,
	}
	if card.Status != "" {
		lines = append(lines, "- Status: "+card.Status)
	}
	for _, f := range card.Fields {
		lines = append(lines, "- "+f.Name+": "+f.Value)
	}
	if len(card.Assignees) > 0 {
		logins := make([]string, len(card.Assignees))
		for i, a := range card.Assignees {
			logins[i] = a.Login
		}
		lines = append(lines, "- Assignees: "+strings.Join(logins, ", "))
	}
	lines = append(lines, "", bodyOr(card.Body, emptyCardBody))
	return strings.Join(lines, "\n")
}

// epicSection is the epic with its body.
func epicSection(epic Epic) string {
	return "### Epic: " + epic.Title + "\n\n- Issue: " + reference(epic.Issue) + "\n- Link: " + epic.URL +
		"\n\n" + bodyOr(epic.Body, emptyEpicBody)
}

// siblingsSection lists the other cards of the epic with their status.
func siblingsSection(siblings []Related) string {
	items := make([]string, len(siblings))
	for i, s := range siblings {
		status := s.Status
		if status == "" {
			status = stateLabel(s.State)
		}
		items[i] = "- " + joinParts(reference(s.Issue)+" "+s.Title, status)
	}
	return "### Sibling cards\n\n" + strings.Join(items, "\n")
}

// dependenciesSection lists the dependencies with their state, status and
// pull requests.
func dependenciesSection(dependencies []Dependency) string {
	items := make([]string, len(dependencies))
	for i, d := range dependencies {
		items[i] = "- " + joinParts(reference(d.Issue)+" "+d.Title, stateLabel(d.State), d.Status,
			pullRequests(d.PullRequests))
	}
	return "### Dependencies\n\n" + strings.Join(items, "\n")
}

// pullRequests names the pull requests of a dependency with their state.
func pullRequests(prs []PullRequest) string {
	if len(prs) == 0 {
		return noPullRequest
	}
	names := make([]string, len(prs))
	for i, pr := range prs {
		names[i] = "PR " + pr.Owner + "/" + pr.Name + "#" + strconv.Itoa(pr.Number) + " (" + string(pr.State) + ")"
	}
	return strings.Join(names, ", ")
}

// reference is an issue as owner/name#number.
func reference(i Issue) string { return i.FullName() + "#" + strconv.Itoa(i.Number) }

// stateLabel is the state of an issue in words.
func stateLabel(state task.IssueState) string {
	if state == task.IssueClosed {
		return stateClosedLabel
	}
	return stateOpenLabel
}

// bodyOr is body trimmed, or empty when there is none.
func bodyOr(body, empty string) string {
	if trimmed := strings.TrimSpace(body); trimmed != "" {
		return trimmed
	}
	return empty
}

// joinParts joins the parts of a line, skipping the empty ones.
func joinParts(parts ...string) string {
	kept := make([]string, 0, len(parts))
	for _, p := range parts {
		if p != "" {
			kept = append(kept, p)
		}
	}
	return strings.Join(kept, contextSeparator)
}
