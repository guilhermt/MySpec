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

// PRDirName is the folder of the PR artifacts inside the task folder.
const PRDirName = "pr"

// DraftFile is the name of the draft of the pull request inside the pr folder.
const DraftFile = "draft.md"

// reviewFilePattern is the name a report of the PR review may have: its pass.
var reviewFilePattern = regexp.MustCompile(`^review-(\d+)\.md$`)

// ReviewFile is the name of the report of one pass of the PR review.
func ReviewFile(pass int) string { return fmt.Sprintf("review-%d.md", pass) }

// PRDir is the folder the PR stage fills: one draft and one report per pass.
func (t Task) PRDir() string {
	return filepath.Join(t.ArtifactsDir, PRDirName)
}

// DraftPath is the draft of the pull request of the task.
func (t Task) DraftPath() string {
	return filepath.Join(t.PRDir(), DraftFile)
}

// ReviewPath is the report of one pass of the PR review.
func (t Task) ReviewPath(pass int) string {
	return filepath.Join(t.PRDir(), ReviewFile(pass))
}

// cleanStatus is the verdict of a review pass that found nothing to change.
const cleanStatus = "clean"

// Draft is the pull request draft of a task.
type Draft struct {
	Present bool
	Title   string
	Body    string
}

// ReviewReport is one pass of the PR review.
type ReviewReport struct {
	Pass  int
	File  string // file name inside pr/
	Clean bool   // the pass closed with nothing to change
	// Findings is how many findings the report lists; -1 when unknown, as for
	// every pass of the pull request review.
	Findings int
}

// PRArtifacts is what the pr folder holds.
type PRArtifacts struct {
	Draft   Draft
	Reports []ReviewReport // by pass, ascending
}

// ReadPRArtifacts reads the pr folder. A missing or unreadable folder holds no
// artifact.
func ReadPRArtifacts(dir string) PRArtifacts {
	var found PRArtifacts

	entries, err := os.ReadDir(dir)
	if err != nil {
		// A folder that cannot be read holds no artifact anyone can act on,
		// and the stage is derived from what is there.
		return found
	}

	for _, entry := range entries {
		name := entry.Name()
		if entry.IsDir() || strings.HasPrefix(name, ".") {
			continue
		}

		if name == DraftFile {
			if draft, ok := readDraft(filepath.Join(dir, name)); ok {
				found.Draft = draft
			}
			continue
		}

		match := reviewFilePattern.FindStringSubmatch(name)
		if match == nil {
			continue
		}
		pass, err := strconv.Atoi(match[1])
		if err != nil || pass <= 0 {
			continue
		}
		if report, ok := readReport(filepath.Join(dir, name), pass); ok {
			found.Reports = append(found.Reports, report)
		}
	}

	slices.SortFunc(found.Reports, func(a, b ReviewReport) int {
		if a.Pass != b.Pass {
			return a.Pass - b.Pass
		}
		return strings.Compare(a.File, b.File)
	})
	return found
}

// readDraft reads one draft file. A file without a title, or with nothing
// under the header, is half written and is no draft.
func readDraft(path string) (Draft, bool) {
	content, err := os.ReadFile(path)
	if err != nil {
		return Draft{}, false
	}

	fields, body := frontmatter.Split(string(content))
	title := strings.TrimSpace(fields["title"])
	body = strings.TrimSpace(body)
	if title == "" || body == "" {
		return Draft{}, false
	}
	return Draft{Present: true, Title: title, Body: body}, true
}

// readReport reads one review report. A report without a verdict, or whose
// header disagrees with its name, is not a pass that happened.
func readReport(path string, pass int) (ReviewReport, bool) {
	content, err := os.ReadFile(path)
	if err != nil {
		return ReviewReport{}, false
	}

	fields, _ := frontmatter.Split(string(content))
	status := strings.TrimSpace(fields["status"])
	if status == "" {
		return ReviewReport{}, false
	}
	if declared := strings.TrimSpace(fields["pass"]); declared != "" {
		number, err := strconv.Atoi(declared)
		if err != nil || number != pass {
			return ReviewReport{}, false
		}
	}
	return ReviewReport{Pass: pass, File: filepath.Base(path), Clean: status == cleanStatus, Findings: -1}, true
}

// filePerm keeps an artifact the app writes private to the user.
const filePerm = 0o600

// WriteDraft rewrites the draft with the text the user approved, keeping the
// header fields the app owns.
func WriteDraft(path, repository, base, title, body string) error {
	if err := os.MkdirAll(filepath.Dir(path), dirPerm); err != nil {
		return fmt.Errorf("create pr directory %s: %w", filepath.Dir(path), err)
	}

	var content strings.Builder
	content.WriteString(frontmatter.Fence + "\n")
	content.WriteString("repository: " + repository + "\n")
	content.WriteString("base: " + base + "\n")
	content.WriteString("title: " + oneLine(title) + "\n")
	content.WriteString(frontmatter.Fence + "\n\n")
	content.WriteString(strings.TrimSpace(body) + "\n")

	if err := os.WriteFile(path, []byte(content.String()), filePerm); err != nil {
		return fmt.Errorf("write draft %s: %w", path, err)
	}
	return nil
}

// oneLine flattens a header value, which lives on a line of its own.
func oneLine(value string) string {
	value = strings.ReplaceAll(value, "\r", "")
	return strings.TrimSpace(strings.ReplaceAll(value, "\n", " "))
}

// prArtifactName reports whether a name is a PR artifact of the pr folder.
func prArtifactName(name string) bool {
	return name == DraftFile || reviewFilePattern.MatchString(name)
}
