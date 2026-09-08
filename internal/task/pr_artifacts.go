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

// PRDirName is the folder of the PR artifacts inside the task folder.
const PRDirName = "pr"

// rootSlug stands for a repository that is the workspace root itself.
const rootSlug = "_root"

// slugSeparator replaces every path separator, so that the slug of a nested
// repository is still one file name.
const slugSeparator = "__"

// Slug is the file-name form of a repository path relative to the workspace:
// "." becomes "_root" and every separator becomes "__".
func Slug(rel string) string {
	if rel == "." || rel == "" {
		return rootSlug
	}
	rel = filepath.ToSlash(rel)
	return strings.ReplaceAll(rel, "/", slugSeparator)
}

// PRDir is the folder the PR stage fills, one draft and one report per pass
// for each repository of the task.
func (t Task) PRDir() string {
	return filepath.Join(t.ArtifactsDir, PRDirName)
}

// DraftPath is the draft of the pull request of a repository.
func (t Task) DraftPath(slug string) string {
	return filepath.Join(t.PRDir(), DraftFile(slug))
}

// DraftFile is the name of the draft of a repository inside the pr folder.
func DraftFile(slug string) string {
	return slug + "-draft.md"
}

// ReviewPath is the report of one pass of the PR review of a repository.
func (t Task) ReviewPath(slug string, pass int) string {
	return filepath.Join(t.PRDir(), fmt.Sprintf("%s-review-%d.md", slug, pass))
}

// The names a PR artifact may have. The separators are excluded so that a
// name coming from the outside can never be a path.
var (
	draftFilePattern  = regexp.MustCompile(`^([^/\\]+)-draft\.md$`)
	reviewFilePattern = regexp.MustCompile(`^([^/\\]+)-review-(\d+)\.md$`)
)

// cleanStatus is the verdict of a review pass that found nothing to change.
const cleanStatus = "clean"

// Draft is the pull request draft of one repository.
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
}

// RepoArtifacts is what the pr folder holds for one repository.
type RepoArtifacts struct {
	Draft   Draft
	Reports []ReviewReport // by pass, ascending
}

// ReadPRArtifacts reads the pr folder against the slugs of the repositories a
// task touches. A missing folder is no artifact, not an error.
func ReadPRArtifacts(dir string, slugs []string) map[string]RepoArtifacts {
	found := map[string]RepoArtifacts{}

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

		if match := draftFilePattern.FindStringSubmatch(name); match != nil {
			slug := match[1]
			if !slices.Contains(slugs, slug) {
				continue
			}
			if draft, ok := readDraft(filepath.Join(dir, name)); ok {
				artifacts := found[slug]
				artifacts.Draft = draft
				found[slug] = artifacts
			}
			continue
		}

		match := reviewFilePattern.FindStringSubmatch(name)
		if match == nil {
			continue
		}
		slug := match[1]
		if !slices.Contains(slugs, slug) {
			continue
		}
		pass, err := strconv.Atoi(match[2])
		if err != nil || pass <= 0 {
			continue
		}
		if report, ok := readReport(filepath.Join(dir, name), pass); ok {
			artifacts := found[slug]
			artifacts.Reports = append(artifacts.Reports, report)
			found[slug] = artifacts
		}
	}

	for slug, artifacts := range found {
		slices.SortFunc(artifacts.Reports, func(a, b ReviewReport) int {
			if a.Pass != b.Pass {
				return a.Pass - b.Pass
			}
			return strings.Compare(a.File, b.File)
		})
		found[slug] = artifacts
	}
	return found
}

// readDraft reads one draft file. A file without a title, or with nothing
// under the header, is half written and is no draft.
func readDraft(path string) (Draft, bool) {
	content, err := os.ReadFile(path)
	if err != nil {
		return Draft{}, false
	}

	fields, body, _ := splitFrontMatter(string(content))
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

	fields, _, _ := splitFrontMatter(string(content))
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
	return ReviewReport{Pass: pass, File: filepath.Base(path), Clean: status == cleanStatus}, true
}

// filePerm keeps an artifact the app writes private to the user.
const filePerm = 0o600

// WriteDraft rewrites the draft of a repository with the text the user
// approved, keeping the header fields the app owns.
func WriteDraft(path, repository, base, title, body string) error {
	if err := os.MkdirAll(filepath.Dir(path), dirPerm); err != nil {
		return fmt.Errorf("create pr directory %s: %w", filepath.Dir(path), err)
	}

	var content strings.Builder
	content.WriteString(frontMatterFence + "\n")
	content.WriteString("repository: " + repository + "\n")
	content.WriteString("base: " + base + "\n")
	content.WriteString("title: " + oneLine(title) + "\n")
	content.WriteString(frontMatterFence + "\n\n")
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
	return draftFilePattern.MatchString(name) || reviewFilePattern.MatchString(name)
}
