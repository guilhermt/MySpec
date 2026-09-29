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

var (
	// findingsTitle is the line that opens the Findings section of a report,
	// with the level of its heading when it is one.
	findingsTitle = regexp.MustCompile(`(?i)^\s*(#{0,6})\s*(?:\d+[.)]\s*)?\*{0,2}findings\s*(?::\s*\*{0,2}|\*{0,2}\s*:?)`)
	// heading is a Markdown heading, with its level.
	heading = regexp.MustCompile(`^\s*(#{1,6})\s+\S`)
	// reportSection is a line that opens a section of the report in the format
	// the step_review prompt asks for: a bold section name, numbered or not.
	reportSection = regexp.MustCompile(`(?i)^\s*(?:\d+[.)]\s*)?\*\*\s*(?:what was reviewed|checks|findings|accepted divergences|contestations|decisions of the user)\s*:?\s*\*\*`)
	// findingItem is a line that starts one item of a list, with its indent.
	findingItem = regexp.MustCompile(`^(\s*)(?:\d+[.)]|[-*])\s+\S`)
)

// countFindings is how many findings the Findings section of the body of a
// report lists: 0 when it says "None.", one per sub-heading or per item of the
// outermost list, 1 when it says something that is not a list, and -1 when
// there is no such section.
func countFindings(body string) int {
	lines := strings.Split(body, "\n")
	start := slices.IndexFunc(lines, findingsTitle.MatchString)
	if start < 0 {
		return -1
	}
	title := findingsTitle.FindStringSubmatch(lines[start])
	section := findingsSection(lines[start+1:], len(title[1]))

	text := strings.TrimSpace(lines[start][len(title[0]):] + "\n" + strings.Join(section, "\n"))
	if text == "" || strings.EqualFold(strings.TrimSuffix(text, "."), "none") {
		return 0
	}
	if subheadings := countMatching(section, heading); subheadings > 0 {
		return subheadings
	}
	return max(outermostItems(section), 1)
}

// findingsSection is the lines of the Findings section, from the line after
// its title, whose heading level is level (0 when the title is no heading). It
// ends at a heading of the same level or above, or at the next section of the
// report; a numbered finding in bold and a deeper heading stay inside.
func findingsSection(lines []string, level int) []string {
	end := slices.IndexFunc(lines, func(line string) bool {
		if reportSection.MatchString(line) {
			return true
		}
		match := heading.FindStringSubmatch(line)
		return match != nil && (level == 0 || len(match[1]) <= level)
	})
	if end < 0 {
		return lines
	}
	return lines[:end]
}

// countMatching is how many lines match a pattern.
func countMatching(lines []string, pattern *regexp.Regexp) int {
	count := 0
	for _, line := range lines {
		if pattern.MatchString(line) {
			count++
		}
	}
	return count
}

// outermostItems is how many items the outermost list of lines has: the items
// with the smallest indent, so the sub-items of a finding count with it.
func outermostItems(lines []string) int {
	count, indent := 0, -1
	for _, line := range lines {
		match := findingItem.FindStringSubmatch(line)
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
