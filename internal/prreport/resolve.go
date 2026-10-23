package prreport

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	pathpkg "path"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"strings"

	"github.com/guilhermt/myspec/internal/frontmatter"
)

// Resolution is how the report of a pass was found.
type Resolution int

// The ways the report of a pass is found, or not.
const (
	ResolutionFound      Resolution = iota // the report is at the agreed path, or was copied there
	ResolutionMissing                      // no file is the report of the pass
	ResolutionUnreadable                   // the report is at the agreed path and can't be read
	ResolutionAmbiguous                    // more than one file may be the report of the pass
)

// Result is what Resolve found. Report is set with ResolutionFound, Reason
// with ResolutionUnreadable, and Candidates with ResolutionAmbiguous.
type Result struct {
	Resolution Resolution
	Report     Report
	Reason     string
	Candidates []string // relative to the folder searched, with slashes, sorted
}

const (
	// maxCandidateDepth is how many folders below the one searched a
	// candidate may sit.
	maxCandidateDepth = 3

	filePerm = 0o600
	dirPerm  = 0o700
)

var (
	// skippedDirs are the folders of the artifacts that hold no report of a
	// pass of the pull request.
	skippedDirs = []string{"images", "steps", "step-reviews"}
	// skippedFiles are the artifacts that are not a report, relative to the
	// folder searched.
	skippedFiles = []string{
		"PRD.md", "tech-spec.md", "one-shot.md", "context.md", "pr/draft.md", "discussion.md", "drafts.md",
	}
	// passReportName is the name of a report of a pass of the pull request
	// review, which is already where the app looks for it.
	passReportName = regexp.MustCompile(`^review-\d+\.md$`)
	// stepReportName is the name of a report of a pass of the agent review of
	// a step inside the step-reviews folder, which is already where the app
	// looks for it.
	stepReportName = regexp.MustCompile(`^step-reviews/\d+-review-\d+\.md$`)
)

// Resolve finds the report of pass in the artifacts folder dir: the file at
// name, relative to dir, read with ParseReport; and, when it is not there, the
// one other Markdown file of dir that is unambiguously the report of the pass,
// which it copies to name first.
func Resolve(dir, name string, pass int) (Result, error) {
	path := filepath.Join(dir, filepath.FromSlash(name))
	report, ok, err := ReadReport(path, pass)
	switch {
	case errors.Is(err, ErrUnreadable):
		return Result{Resolution: ResolutionUnreadable, Reason: Reason(err)}, nil
	case err != nil:
		return Result{}, err
	case ok:
		return Result{Resolution: ResolutionFound, Report: report}, nil
	}

	candidates, err := FindCandidates(dir, func(fields map[string]string, content string) bool {
		if _, hasStep := fields["step"]; hasStep || !Declares(fields["pass"], pass) {
			return false
		}
		_, parseErr := ParseReport(content, pass)
		return parseErr == nil
	})
	if err != nil {
		return Result{}, err
	}

	switch len(candidates) {
	case 0:
		return Result{Resolution: ResolutionMissing}, nil
	case 1:
		if err = AdoptReport(dir, candidates[0], name); err != nil {
			return Result{}, err
		}
		report, _, err = ReadReport(path, pass)
		if err != nil {
			return Result{}, err
		}
		return Result{Resolution: ResolutionFound, Report: report}, nil
	default:
		return Result{Resolution: ResolutionAmbiguous, Candidates: candidates}, nil
	}
}

// FindCandidates lists the Markdown files of dir, down to three folders deep,
// that have a front matter and that match accepts, relative to dir with
// slashes and sorted. The folders and files that are other artifacts, the
// reports already where the app looks for them and hidden files are not
// candidates.
func FindCandidates(dir string, match func(fields map[string]string, content string) bool) ([]string, error) {
	return findCandidates(dir, skippedDirs, match)
}

// FindStepCandidates is FindCandidates for the reports of the agent review of
// a step: it also searches the step-reviews folder, where the step reviewer
// writes, and leaves out only the reports already at their agreed names there.
func FindStepCandidates(dir string, match func(fields map[string]string, content string) bool) ([]string, error) {
	dirs := slices.DeleteFunc(slices.Clone(skippedDirs), func(d string) bool { return d == "step-reviews" })
	return findCandidates(dir, dirs, match)
}

func findCandidates(dir string, skipDirs []string, match func(fields map[string]string, content string) bool) ([]string, error) {
	var found []string
	err := filepath.WalkDir(dir, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			if path == dir {
				return err
			}
			// A folder or a file that can't be read holds no candidate.
			return nil
		}
		rel, err := filepath.Rel(dir, path)
		if err != nil {
			return fmt.Errorf("relate %s to %s: %w", path, dir, err)
		}
		rel = filepath.ToSlash(rel)
		base := entry.Name()

		if entry.IsDir() {
			if rel == "." {
				return nil
			}
			if strings.HasPrefix(base, ".") || slices.Contains(skipDirs, base) ||
				strings.Count(rel, "/") >= maxCandidateDepth {
				return filepath.SkipDir
			}
			return nil
		}
		if !entry.Type().IsRegular() || !strings.HasSuffix(base, ".md") || strings.HasPrefix(base, ".") ||
			slices.Contains(skippedFiles, rel) || passReportName.MatchString(base) || stepReportName.MatchString(rel) {
			return nil
		}

		//nolint:gosec // path comes from this walk of dir, which does not follow symbolic links, and only regular files get here
		content, err := os.ReadFile(path)
		if err != nil {
			return nil //nolint:nilerr // a file that can't be read is no candidate
		}
		fields, _ := frontmatter.Split(string(content))
		if fields == nil || fields["status"] == "" || !match(fields, string(content)) {
			return nil
		}
		found = append(found, rel)
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("search %s for reports: %w", dir, err)
	}

	slices.Sort(found)
	return found, nil
}

// AdoptReport copies the candidate, a path relative to dir, to name, also
// relative to dir, without touching the original. Both must stay inside dir,
// and name must not exist yet.
func AdoptReport(dir, candidate, name string) error {
	if !filepath.IsLocal(filepath.FromSlash(candidate)) || !filepath.IsLocal(filepath.FromSlash(name)) {
		return fmt.Errorf("adopt report %s as %s: the path leaves %s", candidate, name, dir)
	}
	content, err := os.ReadFile(filepath.Join(dir, filepath.FromSlash(candidate)))
	if err != nil {
		return fmt.Errorf("read report %s: %w", candidate, err)
	}

	target := filepath.Join(dir, filepath.FromSlash(name))
	if err = os.MkdirAll(filepath.Dir(target), dirPerm); err != nil {
		return fmt.Errorf("create directory %s: %w", pathpkg.Dir(name), err)
	}
	// O_EXCL keeps a report that is already there: the agreed path wins.
	file, err := os.OpenFile(target, os.O_WRONLY|os.O_CREATE|os.O_EXCL, filePerm)
	if err != nil {
		return fmt.Errorf("create report %s: %w", name, err)
	}
	if _, err = file.Write(content); err != nil {
		_ = file.Close()
		return fmt.Errorf("write report %s: %w", name, err)
	}
	if err = file.Close(); err != nil {
		return fmt.Errorf("close report %s: %w", name, err)
	}
	return nil
}

// Declares reports whether a number of a header names want.
func Declares(value string, want int) bool {
	declared, err := strconv.Atoi(strings.TrimSpace(value))
	return err == nil && declared == want
}
