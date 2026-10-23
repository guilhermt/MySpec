package prreport_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/prreport"
)

const resolveName = "pr/review-1.md"

// put writes a file below dir, with the folders it needs.
func put(t *testing.T, dir, name, content string) {
	t.Helper()

	path := filepath.Join(dir, filepath.FromSlash(name))
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		t.Fatalf("create directory: %v", err)
	}
	writeFile(t, filepath.Dir(path), filepath.Base(path), content)
}

func TestResolveReadsTheReportAtTheAgreedPath(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	put(t, dir, resolveName, report("clean", "All good.\n"))
	put(t, dir, "other.md", "---\nstatus: clean\npass: 1\n---\nAnother.\n")

	got, err := prreport.Resolve(dir, resolveName, 1)
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if got.Resolution != prreport.ResolutionFound || !got.Report.Clean {
		t.Errorf("result = %+v, want the clean report found", got)
	}
}

func TestResolveSaysWhyTheReportAtTheAgreedPathCannotBeRead(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	put(t, dir, resolveName, report("pending", "Soon.\n"))

	got, err := prreport.Resolve(dir, resolveName, 1)
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	want := `The report can't be read: status "pending" is neither clean nor changes.`
	if got.Resolution != prreport.ResolutionUnreadable || got.Reason != want {
		t.Errorf("result = %+v, want unreadable with %q", got, want)
	}
}

func TestResolveCopiesTheOneReportOfThePassFoundElsewhere(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	content := "---\nstatus: clean\npass: 1\n---\nAll good.\n"
	put(t, dir, "reviews/final.md", content)

	got, err := prreport.Resolve(dir, resolveName, 1)
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if got.Resolution != prreport.ResolutionFound || !got.Report.Clean {
		t.Fatalf("result = %+v, want the clean report found", got)
	}
	for _, name := range []string{resolveName, "reviews/final.md"} {
		copied, readErr := os.ReadFile(filepath.Join(dir, filepath.FromSlash(name)))
		if readErr != nil || string(copied) != content {
			t.Errorf("%s = %q (%v), want the report", name, copied, readErr)
		}
	}
}

func TestResolveDoesNotTakeWhatIsNotTheReportOfThePass(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		file    string
		content string
	}{
		{"another pass", "a.md", "---\nstatus: clean\npass: 2\n---\nx\n"},
		{"no pass declared", "a.md", "---\nstatus: clean\n---\nx\n"},
		{"a step report", "a.md", "---\nstatus: clean\npass: 1\nstep: 3\n---\nx\n"},
		{"no status", "a.md", "---\npass: 1\n---\nx\n"},
		{"findings that contradict the status", "a.md", "---\nstatus: clean\npass: 1\n---\n## Findings\n### 1 T\nLocation: general\n\nx\n"},
		{"a report of a pass in its own file", "pr/review-2.md", "---\nstatus: clean\npass: 1\n---\nx\n"},
		{"the tech spec", "tech-spec.md", "---\nstatus: clean\npass: 1\n---\nx\n"},
		{"the draft", "pr/draft.md", "---\nstatus: clean\npass: 1\n---\nx\n"},
		{"a hidden file", ".a.md", "---\nstatus: clean\npass: 1\n---\nx\n"},
		{"a skipped folder", "step-reviews/a.md", "---\nstatus: clean\npass: 1\n---\nx\n"},
		{"too deep", "a/b/c/d/a.md", "---\nstatus: clean\npass: 1\n---\nx\n"},
		{"not Markdown", "a.txt", "---\nstatus: clean\npass: 1\n---\nx\n"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			dir := t.TempDir()
			put(t, dir, test.file, test.content)

			got, err := prreport.Resolve(dir, resolveName, 1)
			if err != nil {
				t.Fatalf("resolve: %v", err)
			}
			if got.Resolution != prreport.ResolutionMissing {
				t.Errorf("result = %+v, want missing", got)
			}
		})
	}
}

func TestResolveFindsAReportThreeFoldersDeep(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	put(t, dir, "a/b/c/r.md", "---\nstatus: clean\npass: 1\n---\nx\n")

	got, err := prreport.Resolve(dir, resolveName, 1)
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if got.Resolution != prreport.ResolutionFound {
		t.Errorf("result = %+v, want found", got)
	}
}

func TestResolveListsTheCandidatesWhenThereIsMoreThanOne(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	put(t, dir, "b.md", "---\nstatus: clean\npass: 1\n---\nx\n")
	put(t, dir, "a/a.md", "---\nstatus: clean\npass: 1\n---\nx\n")

	got, err := prreport.Resolve(dir, resolveName, 1)
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if got.Resolution != prreport.ResolutionAmbiguous {
		t.Fatalf("result = %+v, want ambiguous", got)
	}
	if diff := cmp.Diff([]string{"a/a.md", "b.md"}, got.Candidates); diff != "" {
		t.Errorf("candidates (-want +got):\n%s", diff)
	}
	if _, statErr := os.Stat(filepath.Join(dir, "pr", "review-1.md")); !os.IsNotExist(statErr) {
		t.Errorf("the agreed path exists (%v), want nothing copied", statErr)
	}
}

func TestAdoptReportCopiesTheCandidateAndKeepsTheOriginal(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	put(t, dir, "a.md", "report")

	if err := prreport.AdoptReport(dir, "a.md", resolveName); err != nil {
		t.Fatalf("adopt: %v", err)
	}
	for _, name := range []string{"a.md", resolveName} {
		if got, _ := os.ReadFile(filepath.Join(dir, filepath.FromSlash(name))); string(got) != "report" {
			t.Errorf("%s = %q, want the report", name, got)
		}
	}
}

func TestAdoptReportRefusesWhatLeavesTheFolderOrOverwrites(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	put(t, dir, "a.md", "report")
	put(t, dir, resolveName, "mine")

	tests := []struct{ name, candidate, target string }{
		{"a candidate outside", "../a.md", "pr/review-2.md"},
		{"a target outside", "a.md", "../review-2.md"},
		{"a target that exists", "a.md", resolveName},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			if err := prreport.AdoptReport(dir, test.candidate, test.target); err == nil {
				t.Error("adopt succeeded, want an error")
			}
		})
	}
	if got, _ := os.ReadFile(filepath.Join(dir, "pr", "review-1.md")); string(got) != "mine" {
		t.Errorf("the agreed path = %q, want it untouched", got)
	}
}
