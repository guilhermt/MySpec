package prreview

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/guilhermt/myspec/internal/frontmatter"
)

// The values the status of a report is written with.
const (
	statusClean   = "clean"   // the pass found nothing to change
	statusChanges = "changes" // the pass has findings
)

// findingsHeading opens the section of the findings in a report.
const findingsHeading = "## Findings"

// generalLocation is the location of a finding that points at no line.
const generalLocation = "general"

// reportFileName is the name a report of a pass may have: review-<pass>.md.
var reportFileName = regexp.MustCompile(`^review-\d+\.md$`)

// findingHeading opens one finding, with its number and, after it, the
// title of what is wrong: "### 1 · Title", "### 1. Title", "### 1 - Title",
// "### 1: Title", "### 1 **Title**". The title may be missing.
var findingHeading = regexp.MustCompile(`^###\s+(\d+)\b\s*(?:[·.:\-–—]\s*)?(.*)$`)

// locationLine is the first line of a finding, which says where it points.
var locationLine = regexp.MustCompile(`^Location:\s*(.+)$`)

// ErrUnreadable is a report the app cannot act on: the agent wrote it in a
// shape the product does not define.
var ErrUnreadable = errors.New("prreview: the report can't be read")

// ParsedFinding is one finding as the report has it, before the user decides
// anything about it.
type ParsedFinding struct {
	Number int
	Title  string // "" when the report writes none
	Path   string // "" for a general finding
	Line   int    // 0 for a general finding
	Text   string
}

// Report is a review report as the app reads it.
type Report struct {
	Pass     int
	Clean    bool
	Summary  string
	Findings []ParsedFinding
}

// ReadReport reads the report of a pass. ok is false when the file is not
// there; a file that is there and cannot be read fails with ErrUnreadable.
func ReadReport(path string, pass int) (report Report, ok bool, err error) {
	content, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return Report{}, false, nil
		}
		return Report{}, false, fmt.Errorf("read report %s: %w", path, err)
	}

	report, err = ParseReport(string(content), pass)
	if err != nil {
		return Report{}, false, fmt.Errorf("read report %s: %w", path, err)
	}
	return report, true, nil
}

// ParseReport reads the report of a pass from its text. The pass is the one
// the file name declares, which the header must agree with.
func ParseReport(content string, pass int) (Report, error) {
	fields, body := frontmatter.Split(content)
	if fields == nil {
		return Report{}, fmt.Errorf("%w: it has no front matter", ErrUnreadable)
	}

	clean, err := parseStatus(fields["status"])
	if err != nil {
		return Report{}, err
	}
	if err = checkPass(fields["pass"], pass); err != nil {
		return Report{}, err
	}

	summary, rest := splitFindings(body)
	findings, err := parseFindings(rest)
	if err != nil {
		return Report{}, err
	}
	if clean && len(findings) > 0 {
		return Report{}, fmt.Errorf("%w: it is clean and has findings", ErrUnreadable)
	}
	if !clean && len(findings) == 0 {
		return Report{}, fmt.Errorf("%w: it asks for changes and has no finding", ErrUnreadable)
	}
	return Report{Pass: pass, Clean: clean, Summary: summary, Findings: findings}, nil
}

// Reason is why a report can't be read, as the user reads it: the rule it
// breaks, without the path of the file or the prefix of the package, with a
// capital and a full stop. An error that is not about the format of the
// report reads as the app's generic sentence.
func Reason(err error) string {
	const generic = "The report can't be read."
	if !errors.Is(err, ErrUnreadable) {
		return generic
	}
	_, rule, found := strings.Cut(err.Error(), ErrUnreadable.Error()+": ")
	if !found || strings.TrimSpace(rule) == "" {
		return generic
	}
	return "The report can't be read: " + strings.TrimSpace(rule) + "."
}

// parseStatus reads the verdict of the header.
func parseStatus(value string) (clean bool, err error) {
	switch strings.TrimSpace(value) {
	case statusClean:
		return true, nil
	case statusChanges:
		return false, nil
	default:
		return false, fmt.Errorf("%w: status %q is neither %s nor %s",
			ErrUnreadable, value, statusClean, statusChanges)
	}
}

// checkPass refuses a header that names a pass other than the one the file
// name names. A header without one is the file name's.
func checkPass(value string, pass int) error {
	declared := strings.TrimSpace(value)
	if declared == "" {
		return nil
	}
	number, err := strconv.Atoi(declared)
	if err != nil || number != pass {
		return fmt.Errorf("%w: it declares pass %q, and it is pass %d", ErrUnreadable, value, pass)
	}
	return nil
}

// splitFindings cuts the body at the heading of the findings. A body without
// one is all summary.
func splitFindings(body string) (summary string, findings []string) {
	lines := strings.Split(strings.ReplaceAll(body, "\r", ""), "\n")
	for i, line := range lines {
		if strings.TrimRight(line, " \t") == findingsHeading {
			return strings.TrimSpace(strings.Join(lines[:i], "\n")), lines[i+1:]
		}
	}
	return strings.TrimSpace(body), nil
}

// parseFindings reads the findings of the section, each opened by its number.
// What comes before the first one is a note to the reader.
func parseFindings(lines []string) ([]ParsedFinding, error) {
	var (
		findings []ParsedFinding
		current  []string
		open     = false
		number   = 0
		title    = ""
	)
	flush := func() error {
		if !open {
			return nil
		}
		finding, err := parseFinding(number, title, current)
		if err != nil {
			return err
		}
		findings = append(findings, finding)
		return nil
	}

	for _, line := range lines {
		match := findingHeading.FindStringSubmatch(line)
		if match == nil {
			current = append(current, line)
			continue
		}
		if err := flush(); err != nil {
			return nil, err
		}

		next, err := strconv.Atoi(match[1])
		if err != nil || next <= 0 {
			return nil, fmt.Errorf("%w: finding %q has no usable number", ErrUnreadable, line)
		}
		if hasNumber(findings, next) {
			return nil, fmt.Errorf("%w: finding %d appears twice", ErrUnreadable, next)
		}
		open, number, title, current = true, next, findingTitle(match[2]), nil
	}
	if err := flush(); err != nil {
		return nil, err
	}
	return findings, nil
}

// findingTitle cleans the title a heading carries: trimmed, and without the
// pair of ** that wraps all of it. Inline code stays as it is.
func findingTitle(raw string) string {
	title := strings.TrimSpace(raw)
	if strings.HasPrefix(title, "**") && strings.HasSuffix(title, "**") && len(title) > 4 {
		title = strings.TrimSpace(title[2 : len(title)-2])
	}
	return title
}

// hasNumber reports whether a finding of that number was read already.
func hasNumber(findings []ParsedFinding, number int) bool {
	for _, finding := range findings {
		if finding.Number == number {
			return true
		}
	}
	return false
}

// parseFinding reads the body of one finding: where it points, and what it
// says.
func parseFinding(number int, title string, lines []string) (ParsedFinding, error) {
	index := -1
	for i, line := range lines {
		if strings.TrimSpace(line) != "" {
			index = i
			break
		}
	}
	if index < 0 {
		return ParsedFinding{}, fmt.Errorf("%w: finding %d is empty", ErrUnreadable, number)
	}

	match := locationLine.FindStringSubmatch(strings.TrimSpace(lines[index]))
	if match == nil {
		return ParsedFinding{}, fmt.Errorf("%w: finding %d does not open with its location",
			ErrUnreadable, number)
	}
	path, line, err := parseLocation(number, match[1])
	if err != nil {
		return ParsedFinding{}, err
	}

	text := strings.TrimSpace(strings.Join(lines[index+1:], "\n"))
	if text == "" {
		return ParsedFinding{}, fmt.Errorf("%w: finding %d says nothing", ErrUnreadable, number)
	}
	return ParsedFinding{Number: number, Title: title, Path: path, Line: line, Text: text}, nil
}

// parseLocation reads the location of a finding: a line of a file of the pull
// request, or the pull request as a whole.
func parseLocation(number int, value string) (path string, line int, err error) {
	value = strings.TrimSpace(strings.Trim(strings.TrimSpace(value), "`"))
	if strings.EqualFold(value, generalLocation) {
		return "", 0, nil
	}

	at := strings.LastIndex(value, ":")
	if at < 0 {
		return "", 0, fmt.Errorf("%w: finding %d points at %q, which is no location",
			ErrUnreadable, number, value)
	}
	line, err = strconv.Atoi(strings.TrimSpace(value[at+1:]))
	if err != nil || line <= 0 {
		return "", 0, fmt.Errorf("%w: finding %d points at %q, which has no line",
			ErrUnreadable, number, value)
	}
	path = filepath.Clean(strings.TrimSpace(value[:at]))
	if path == "." || filepath.IsAbs(path) || path == ".." || strings.HasPrefix(path, ".."+string(filepath.Separator)) {
		return "", 0, fmt.Errorf("%w: finding %d points at %q, which is outside the pull request",
			ErrUnreadable, number, value)
	}
	return path, line, nil
}
