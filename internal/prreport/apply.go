package prreport

import (
	"fmt"
	"strconv"
	"strings"
)

// applyIntro opens the message that sends the approved findings to the agent.
const applyIntro = "The user decided on the findings of pass %d. Implement only the ones below, and only that: " +
	"no drive-by changes, no refactoring nobody asked for. Do not commit, do not run `git add` and do not push: " +
	"the user reviews the changes in the app. When you are done, say in a few lines what you changed."

// discardedIntro opens the section of the findings the user discarded.
const discardedIntro = "The user decided not to act on these. " +
	"Do not report them again in a later pass unless the code they point at changes."

// ApplyMessage is what the app says to the agent when the user sends the
// findings of a pass they approved: the approved ones in the format of the
// report, with the text as the user left it, and the discarded ones, so that
// the agent does not report them again.
func ApplyMessage(pass int, findings []Finding) string {
	var approved, discarded []Finding
	for _, finding := range findings {
		switch finding.Decision {
		case DecisionApproved:
			approved = append(approved, finding)
		case DecisionDiscarded:
			discarded = append(discarded, finding)
		case DecisionNone:
		}
	}

	var b strings.Builder
	fmt.Fprintf(&b, applyIntro, pass)
	b.WriteString("\n\n## Approved findings\n\n")
	for _, finding := range approved {
		b.WriteString("### " + numberAndTitle(finding) + "\n")
		b.WriteString("Location: " + location(finding) + "\n\n")
		b.WriteString(strings.TrimSpace(finding.Text) + "\n\n")
	}

	if len(discarded) == 0 {
		return strings.TrimSuffix(b.String(), "\n\n")
	}
	b.WriteString("## Discarded findings\n\n" + discardedIntro + "\n\n")
	lines := make([]string, 0, len(discarded))
	for _, finding := range discarded {
		lines = append(lines, "- "+numberAndTitle(finding)+" · "+location(finding))
	}
	return b.String() + strings.Join(lines, "\n")
}

// numberAndTitle is the number of a finding followed by its title, when it
// has one.
func numberAndTitle(finding Finding) string {
	if finding.Title == "" {
		return strconv.Itoa(finding.Number)
	}
	return strconv.Itoa(finding.Number) + " · " + finding.Title
}

// location is where a finding points, as the report writes it.
func location(finding Finding) string {
	if finding.Anchored() {
		return fmt.Sprintf("%s:%d", finding.Path, finding.Line)
	}
	return generalLocation
}
