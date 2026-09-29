package task

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"strings"

	"github.com/guilhermt/myspec/internal/frontmatter"
)

// StepReviewsDirName is the folder of the reports of the agent review of the
// steps, inside the task folder.
const StepReviewsDirName = "step-reviews"

// changesStatus is the verdict of a pass of the agent review of a step that
// found something to change; cleanStatus is the other one.
const changesStatus = "changes"

// stepReportFilePattern is the name a report of a step may have: the number of
// the step and the number of the pass. The separators are excluded so that a
// name coming from the outside can never be a path.
var stepReportFilePattern = regexp.MustCompile(`^(\d+)-review-(\d+)\.md$`)

// StepReviewsDir is the folder the agent review of the steps fills, one report
// per pass of each step.
func (t Task) StepReviewsDir() string {
	return filepath.Join(t.ArtifactsDir, StepReviewsDirName)
}

// StepReportFile is the name of the report of one pass of the agent review of
// a step inside the step-reviews folder.
func StepReportFile(number, pass int) string {
	return fmt.Sprintf("%d-review-%d.md", number, pass)
}

// StepReportPath is the report of one pass of the agent review of a step.
func (t Task) StepReportPath(number, pass int) string {
	return filepath.Join(t.StepReviewsDir(), StepReportFile(number, pass))
}

// ReadStepReports reads the step-reviews folder: the reports of every step, by
// step number, each list by pass ascending. A missing folder holds no report,
// and is not an error.
func ReadStepReports(dir string) map[int][]ReviewReport {
	found := map[int][]ReviewReport{}

	entries, err := os.ReadDir(dir)
	if err != nil {
		// A folder that cannot be read holds no report anyone can act on, and
		// the loop is derived from what is there.
		return found
	}

	for _, entry := range entries {
		name := entry.Name()
		if entry.IsDir() || strings.HasPrefix(name, ".") {
			continue
		}
		number, pass, ok := parseStepReportName(name)
		if !ok {
			continue
		}
		if report, ok := readStepReport(filepath.Join(dir, name), number, pass); ok {
			found[number] = append(found[number], report)
		}
	}

	for number, reports := range found {
		slices.SortFunc(reports, func(a, b ReviewReport) int { return a.Pass - b.Pass })
		found[number] = reports
	}
	return found
}

// parseStepReportName reads the step and the pass off the name of a report.
// Both count from one.
func parseStepReportName(name string) (number, pass int, ok bool) {
	match := stepReportFilePattern.FindStringSubmatch(name)
	if match == nil {
		return 0, 0, false
	}
	number, numberErr := strconv.Atoi(match[1])
	pass, passErr := strconv.Atoi(match[2])
	if numberErr != nil || passErr != nil || number <= 0 || pass <= 0 {
		return 0, 0, false
	}
	return number, pass, true
}

// readStepReport reads one report of the agent review of a step. A report
// whose verdict is not clean or changes, or whose header disagrees with its
// name, is not a pass that happened.
func readStepReport(path string, number, pass int) (ReviewReport, bool) {
	content, err := os.ReadFile(path)
	if err != nil {
		return ReviewReport{}, false
	}

	fields, body := frontmatter.Split(string(content))
	status := strings.TrimSpace(fields["status"])
	if status != cleanStatus && status != changesStatus {
		return ReviewReport{}, false
	}
	if !headerAgrees(fields["pass"], pass) || !headerAgrees(fields["step"], number) {
		return ReviewReport{}, false
	}
	return ReviewReport{
		Pass: pass, File: filepath.Base(path), Clean: status == cleanStatus, Findings: countFindings(body),
	}, true
}

// sectionNames are the sections of a report in the format the step_review
// prompt asks for.
const sectionNames = `what was reviewed|checks|findings|accepted divergences|contestations|decisions of the user`

var (
	// findingsHeading is a heading that opens the Findings section, with its
	// level: the heading holds only the name, so "### Findings of pass 1" is
	// no title.
	findingsHeading = regexp.MustCompile(`(?i)^\s*(#{1,6})\s+(?:\d+[.)]\s*)?(?:\*\*)?\s*findings\s*:?\s*(?:\*\*)?\s*:?\s*$`)
	// findingsBold is a bold line that opens the Findings section, numbered or
	// not: the bold name alone on its line, or followed by a colon, inside the
	// bold or after it, and the text of the section that goes on. "**Findings**
	// of pass 1 were addressed." has no colon after the name and is no title.
	findingsBold = regexp.MustCompile(`(?i)^\s*(?:\d+[.)]\s*)?\*\*\s*findings\s*(?::\s*\*\*(.*)|\*\*\s*(?::(.*))?)$`)
	// heading is a Markdown heading, with its level.
	heading = regexp.MustCompile(`^\s*(#{1,6})\s+\S`)
	// reportSection is a bold line that opens a section of the report: the
	// bold name alone on its line, or followed by a colon and its text. A
	// finding that starts with one of the names in bold, as in "**Checks** are
	// not run", has no colon after it and is no section.
	reportSection = regexp.MustCompile(`(?i)^\s*(?:\d+[.)]\s*)?\*\*\s*(?:` + sectionNames +
		`)\s*(?::\s*\*\*.*|\*\*\s*(?::.*)?)$`)
	// sectionHeading is a heading that holds only the name of a section of
	// the report.
	sectionHeading = regexp.MustCompile(`(?i)^\s*#{1,6}\s+(?:\d+[.)]\s*)?(?:\*\*)?\s*(?:` + sectionNames +
		`)\s*:?\s*(?:\*\*)?\s*:?\s*$`)
	// fence is the line that opens or closes a fenced code block.
	fence = regexp.MustCompile("^\\s*```")
	// findingItem is a line that starts one item of a list, with its indent.
	findingItem = regexp.MustCompile(`^(\s*)(?:\d+[.)]|[-*])\s+\S`)
)

// countFindings is how many findings the Findings section of the body of a
// report lists: 0 when it is empty or says "None.", one per heading of the
// shallowest level in it, else one per item of the outermost list, else 1 for
// text that is no list, and -1 when there is no such section.
//
// The title is a heading that holds only the name or a bold line with the name
// alone or followed by a colon; prose that starts with the word is no title.
// Under a heading title, the section ends at a heading of the same level or
// above, or at the bold line of another section of the report. Under a bold
// title, the headings stay inside it, and it ends at the bold line of another
// section of the report or at a heading that is only the name of one, as
// "## Accepted divergences". The lines of a fenced
// code block neither open nor end the section, and never count.
func countFindings(body string) int {
	lines := markFences(strings.Split(body, "\n"))
	start, level, rest := findingsTitleOf(lines)
	if start < 0 {
		return -1
	}
	section := findingsSection(lines[start+1:], level)

	texts := []string{rest}
	for _, line := range section {
		texts = append(texts, line.text)
	}
	text := strings.TrimSpace(strings.Join(texts, "\n"))
	if text == "" || strings.EqualFold(strings.TrimSuffix(text, "."), "none") {
		return 0
	}
	if headings := shallowestHeadings(section); headings > 0 {
		return headings
	}
	return max(outermostItems(section), 1)
}

// reportLine is a line of a report and whether it sits inside a fenced code
// block, the fences included.
type reportLine struct {
	text   string
	fenced bool
}

// markFences marks the lines of the fenced code blocks of lines.
func markFences(lines []string) []reportLine {
	marked := make([]reportLine, len(lines))
	inside := false
	for i, line := range lines {
		isFence := fence.MatchString(line)
		marked[i] = reportLine{text: line, fenced: inside || isFence}
		if isFence {
			inside = !inside
		}
	}
	return marked
}

// findingsTitleOf finds the line that opens the Findings section: its index
// (-1 when there is none), the level of its heading (0 for a bold title) and
// the text after the title on the same line, which only a bold title has.
func findingsTitleOf(lines []reportLine) (index, level int, rest string) {
	for i, line := range lines {
		if line.fenced {
			continue
		}
		if match := findingsHeading.FindStringSubmatch(line.text); match != nil {
			return i, len(match[1]), ""
		}
		if match := findingsBold.FindStringSubmatch(line.text); match != nil {
			return i, 0, match[1] + match[2]
		}
	}
	return -1, 0, ""
}

// findingsSection is the lines of the Findings section, from the line after
// its title, whose heading level is level (0 for a bold title).
func findingsSection(lines []reportLine, level int) []reportLine {
	end := slices.IndexFunc(lines, func(line reportLine) bool {
		if line.fenced {
			return false
		}
		if reportSection.MatchString(line.text) {
			return true
		}
		if level == 0 {
			return sectionHeading.MatchString(line.text)
		}
		match := heading.FindStringSubmatch(line.text)
		return match != nil && len(match[1]) <= level
	})
	if end < 0 {
		return lines
	}
	return lines[:end]
}

// shallowestHeadings is how many headings of the shallowest level lines hold
// outside the fenced code blocks, so the sub-headings of a finding count with
// it.
func shallowestHeadings(lines []reportLine) int {
	count, level := 0, 0
	for _, line := range lines {
		if line.fenced {
			continue
		}
		match := heading.FindStringSubmatch(line.text)
		switch {
		case match == nil:
		case level == 0 || len(match[1]) < level:
			count, level = 1, len(match[1])
		case len(match[1]) == level:
			count++
		default:
		}
	}
	return count
}

// outermostItems is how many items the outermost list of lines has outside
// the fenced code blocks: the items with the smallest indent, so the sub-items
// of a finding count with it.
func outermostItems(lines []reportLine) int {
	count, indent := 0, -1
	for _, line := range lines {
		if line.fenced {
			continue
		}
		match := findingItem.FindStringSubmatch(line.text)
		switch {
		case match == nil:
		case indent < 0 || len(match[1]) < indent:
			count, indent = 1, len(match[1])
		case len(match[1]) == indent:
			count++
		default:
		}
	}
	return count
}

// headerAgrees reports whether a number of the header, when there is one, is
// the one the name of the file carries.
func headerAgrees(declared string, want int) bool {
	declared = strings.TrimSpace(declared)
	if declared == "" {
		return true
	}
	got, err := strconv.Atoi(declared)
	return err == nil && got == want
}
