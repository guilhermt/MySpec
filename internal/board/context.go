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
	notCloned        = "Not cloned"
	contextSeparator = " · "
	cardHeading      = "### "
	sectionHeading   = "## "
	stateOpenLabel   = "Open"
	stateClosedLabel = "Closed"
)

// Context is the initial context of a task created from a card: the card, its
// epic, its siblings and its dependencies, the document of the discussion the
// card came from, then what the user added.
func Context(card Card, discussion, additional string) string {
	sections := cardSections(card, cardHeading, false)
	if document := strings.TrimSpace(discussion); document != "" {
		sections = append(sections, cardHeading+"Discussion\n\n"+document)
	}
	if extra := strings.TrimSpace(additional); extra != "" {
		sections = append(sections, cardHeading+"Additional context\n\n"+extra)
	}
	return strings.Join(sections, "\n\n")
}

// DiscussionRepository is a repository of the board as the context of a
// discussion lists it.
type DiscussionRepository struct {
	FullName string
	Path     string // "" for a repository without a clone
}

// DiscussionContextInput is what the initial context of a discussion is made
// of.
type DiscussionContextInput struct {
	Title        string
	BoardTitle   string
	BoardURL     string
	Repositories []DiscussionRepository
	Text         string // what the user wrote; "" for none
	Cards        []Card
}

// DiscussionContext is the initial context of a discussion: the board with its
// repositories, what the user wrote, and every selected card with its epic,
// its siblings and its dependencies.
func DiscussionContext(in DiscussionContextInput) string {
	sections := []string{"# " + in.Title, boardSection(in)}
	if text := strings.TrimSpace(in.Text); text != "" {
		sections = append(sections, sectionHeading+"What to discuss\n\n"+text)
	}
	for _, card := range in.Cards {
		sections = append(sections, cardSections(card, sectionHeading, true)...)
	}
	return strings.Join(sections, "\n\n")
}

// boardSection is the board with its link and its repositories.
func boardSection(in DiscussionContextInput) string {
	lines := []string{
		sectionHeading + "Board",
		"",
		"- Board: " + in.BoardTitle,
		"- Link: " + in.BoardURL,
	}
	if len(in.Repositories) > 0 {
		lines = append(lines, "- Repositories:")
		for _, r := range in.Repositories {
			path := r.Path
			if path == "" {
				path = notCloned
			}
			lines = append(lines, "  - "+r.FullName+": "+path)
		}
	}
	return strings.Join(lines, "\n")
}

// cardSections is a card with its epic, its siblings and its dependencies: the
// card under prefix, everything around it one level below.
func cardSections(card Card, prefix string, withState bool) []string {
	below := prefix
	if prefix == sectionHeading {
		below = cardHeading
	}
	sections := []string{cardSection(card, prefix, withState)}
	if card.Epic != nil {
		sections = append(sections, epicSection(*card.Epic, below))
	}
	if len(card.Siblings) > 0 {
		sections = append(sections, siblingsSection(card.Siblings, below))
	}
	if len(card.Dependencies) > 0 {
		sections = append(sections, dependenciesSection(card.Dependencies, below))
	}
	return sections
}

// ReviewContext is the context of the review of a pull request linked to a
// card: the card and its epic. What the review needs of a card is what the
// card itself says; the siblings and the dependencies belong to planning.
func ReviewContext(card Card) string {
	sections := []string{cardSection(card, cardHeading, false)}
	if card.Epic != nil {
		sections = append(sections, epicSection(*card.Epic, cardHeading))
	}
	return strings.Join(sections, "\n\n")
}

// cardSection is the card with its state, status, fields, assignees and body.
func cardSection(card Card, prefix string, withState bool) string {
	lines := []string{
		prefix + "Card: " + card.Title,
		"",
		"- Issue: " + reference(card.Issue),
		"- Link: " + card.URL,
	}
	if withState {
		lines = append(lines, "- State: "+stateLabel(card.State))
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
func epicSection(epic Epic, prefix string) string {
	return prefix + "Epic: " + epic.Title + "\n\n- Issue: " + reference(epic.Issue) + "\n- Link: " + epic.URL +
		"\n\n" + bodyOr(epic.Body, emptyEpicBody)
}

// siblingsSection lists the other cards of the epic with their status.
func siblingsSection(siblings []Related, prefix string) string {
	items := make([]string, len(siblings))
	for i, s := range siblings {
		status := s.Status
		if status == "" {
			status = stateLabel(s.State)
		}
		items[i] = "- " + joinParts(reference(s.Issue)+" "+s.Title, status)
	}
	return prefix + "Sibling cards\n\n" + strings.Join(items, "\n")
}

// dependenciesSection lists the dependencies with their state, status and
// pull requests.
func dependenciesSection(dependencies []Dependency, prefix string) string {
	items := make([]string, len(dependencies))
	for i, d := range dependencies {
		items[i] = "- " + joinParts(reference(d.Issue)+" "+d.Title, stateLabel(d.State), d.Status,
			pullRequests(d.PullRequests))
	}
	return prefix + "Dependencies\n\n" + strings.Join(items, "\n")
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
