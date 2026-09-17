package prreview

import (
	"fmt"
	"slices"
	"strings"
)

// otherHeading opens the findings that go in the body of a published review:
// the general ones, and the anchored ones GitHub would not take inline.
const otherHeading = "**Other findings**"

// continuation indents the lines of a finding after the first one, so that
// they stay inside its item of the list.
const continuation = "   "

// PublishedBody is the body of a published review: the summary of the pass,
// and the findings that have no line to sit on. The general ones come first,
// then the ones that had to leave the diff.
func PublishedBody(summary string, general, demoted []Finding) string {
	summary = strings.TrimSpace(summary)
	if len(general) == 0 && len(demoted) == 0 {
		return summary
	}

	var body strings.Builder
	if summary != "" {
		body.WriteString(summary)
		body.WriteString("\n\n")
	}
	body.WriteString(otherHeading)
	body.WriteString("\n\n")
	for i, finding := range slices.Concat(general, demoted) {
		fmt.Fprintf(&body, "%d. %s\n", i+1, item(finding))
	}
	return strings.TrimRight(body.String(), "\n")
}

// item is one finding as the body lists it: its location when it has one, and
// its text, indented to stay in the item.
func item(f Finding) string {
	text := strings.TrimSpace(f.Text)
	if f.Anchored() {
		text = fmt.Sprintf("`%s:%d` — %s", f.Path, f.Line, text)
	}
	lines := strings.Split(text, "\n")
	for i := 1; i < len(lines); i++ {
		if strings.TrimSpace(lines[i]) != "" {
			lines[i] = continuation + lines[i]
		}
	}
	return strings.Join(lines, "\n")
}
