package task

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"strings"
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

	fields, _, _ := splitFrontMatter(string(content))
	status := strings.TrimSpace(fields["status"])
	if status != cleanStatus && status != changesStatus {
		return ReviewReport{}, false
	}
	if !headerAgrees(fields["pass"], pass) || !headerAgrees(fields["step"], number) {
		return ReviewReport{}, false
	}
	return ReviewReport{Pass: pass, File: filepath.Base(path), Clean: status == cleanStatus}, true
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
