package prreview_test

import (
	"errors"
	"path/filepath"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/prreview"
)

// report wraps a body in the header the agent writes.
func report(status, body string) string {
	return "---\nstatus: " + status + "\n---\n\n" + body
}

func TestAReportWithFindingsIsReadWithEachOneWhereItPoints(t *testing.T) {
	t.Parallel()

	content := report("changes", `The branch is close, two things stand out.

## Findings

### 1 Missing test
Location: `+"`internal/task/service.go:120`"+`

The new branch has no test.

It fails silently.

### 3
Location: general

The commits mix two changes.
`)

	got, err := prreview.ParseReport(content, 2)
	if err != nil {
		t.Fatalf("parse report: %v", err)
	}

	want := prreview.Report{
		Pass:    2,
		Summary: "The branch is close, two things stand out.",
		Findings: []prreview.ParsedFinding{
			{
				Number: 1,
				Path:   filepath.Join("internal", "task", "service.go"),
				Line:   120,
				Text:   "The new branch has no test.\n\nIt fails silently.",
			},
			{Number: 3, Text: "The commits mix two changes."},
		},
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("report (-want +got):\n%s", diff)
	}
}

func TestACleanReportIsAllSummary(t *testing.T) {
	t.Parallel()

	got, err := prreview.ParseReport(report("clean", "Nothing to change.\n"), 1)
	if err != nil {
		t.Fatalf("parse report: %v", err)
	}

	want := prreview.Report{Pass: 1, Clean: true, Summary: "Nothing to change."}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("report (-want +got):\n%s", diff)
	}
}

func TestAReportThatDeclaresItsOwnPassIsReadWhenItAgrees(t *testing.T) {
	t.Parallel()

	content := "---\nstatus: clean\npass: 3\n---\n\nAll good.\n"
	got, err := prreview.ParseReport(content, 3)
	if err != nil {
		t.Fatalf("parse report: %v", err)
	}
	if got.Pass != 3 {
		t.Errorf("pass = %d, want 3", got.Pass)
	}
}

func TestAReportTheProductCannotActOnIsUnreadable(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		content string
	}{
		{"without front matter", "Nothing to change.\n"},
		{"with an unclosed front matter", "---\nstatus: clean\n\nNothing to change.\n"},
		{"without a status", "---\npass: 1\n---\n\nNothing to change.\n"},
		{"with a status of its own", report("looks-good", "Nothing to change.\n")},
		{"declaring another pass", "---\nstatus: clean\npass: 2\n---\n\nAll good.\n"},
		{"declaring a pass that is no number", "---\nstatus: clean\npass: two\n---\n\nAll good.\n"},
		{"clean with a finding", report("clean", "Fine.\n\n## Findings\n\n### 1\nLocation: general\n\nA thing.\n")},
		{"asking for changes with no finding", report("changes", "Something is off.\n")},
		{"asking for changes with an empty findings section", report("changes", "Off.\n\n## Findings\n")},
		{"with a finding numbered zero", report("changes", "## Findings\n\n### 0\nLocation: general\n\nA thing.\n")},
		{
			"with the same number twice",
			report("changes", "## Findings\n\n### 1\nLocation: general\n\nOne.\n\n### 1\nLocation: general\n\nTwo.\n"),
		},
		{"with a finding that says where it is not", report("changes", "## Findings\n\n### 1\n\nA thing.\n")},
		{"with a location that is no location", report("changes", "## Findings\n\n### 1\nLocation: somewhere\n\nA thing.\n")},
		{"with a line that is no number", report("changes", "## Findings\n\n### 1\nLocation: main.go:top\n\nA thing.\n")},
		{"with a line of zero", report("changes", "## Findings\n\n### 1\nLocation: main.go:0\n\nA thing.\n")},
		{"with a path out of the pull request", report("changes", "## Findings\n\n### 1\nLocation: ../secrets.txt:2\n\nA thing.\n")},
		{"with an absolute path", report("changes", "## Findings\n\n### 1\nLocation: /etc/passwd:2\n\nA thing.\n")},
		{"with a finding that says nothing", report("changes", "## Findings\n\n### 1\nLocation: main.go:2\n")},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()

			if _, err := prreview.ParseReport(c.content, 1); !errors.Is(err, prreview.ErrUnreadable) {
				t.Errorf("error = %v, want ErrUnreadable", err)
			}
		})
	}
}

func TestALocationInBackticksPointsAtTheSameLine(t *testing.T) {
	t.Parallel()

	content := report("changes", "## Findings\n\n### 1\nLocation: `main.go:12`\n\nA thing.\n")
	got, err := prreview.ParseReport(content, 1)
	if err != nil {
		t.Fatalf("parse report: %v", err)
	}

	want := []prreview.ParsedFinding{{Number: 1, Path: "main.go", Line: 12, Text: "A thing."}}
	if diff := cmp.Diff(want, got.Findings); diff != "" {
		t.Errorf("findings (-want +got):\n%s", diff)
	}
}

func TestAReportThatIsNotThereIsNoPass(t *testing.T) {
	t.Parallel()

	_, ok, err := prreview.ReadReport(filepath.Join(t.TempDir(), "review-1.md"), 1)
	if err != nil {
		t.Fatalf("read report: %v", err)
	}
	if ok {
		t.Error("ok = true, want false for a report that is not there")
	}
}

func TestAReportOnDiskIsReadFromItsFile(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	writeFile(t, dir, "review-1.md", report("clean", "Nothing to change.\n"))

	got, ok, err := prreview.ReadReport(filepath.Join(dir, "review-1.md"), 1)
	if err != nil {
		t.Fatalf("read report: %v", err)
	}
	if !ok {
		t.Fatal("ok = false, want true")
	}
	if !got.Clean || got.Summary != "Nothing to change." {
		t.Errorf("report = %+v, want a clean one with the summary", got)
	}
}

func TestAReportOnDiskTheProductCannotActOnIsUnreadable(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	writeFile(t, dir, "review-1.md", "no front matter here\n")

	if _, _, err := prreview.ReadReport(filepath.Join(dir, "review-1.md"), 1); !errors.Is(err, prreview.ErrUnreadable) {
		t.Errorf("error = %v, want ErrUnreadable", err)
	}
}
