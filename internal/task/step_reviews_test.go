package task_test

import (
	"os"
	"path/filepath"
	"strconv"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/task"
)

// stepReportFile is one pass of the agent review of a step, as the reviewer
// writes it.
func stepReportFile(number, pass int, status, body string) string {
	return "---\nstep: " + strconv.Itoa(number) + "\npass: " + strconv.Itoa(pass) +
		"\nstatus: " + status + "\n---\n\n" + body
}

// writeStepReport puts a file inside the step-reviews folder of a task.
func writeStepReport(t *testing.T, tk task.Task, name, content string) {
	t.Helper()

	if err := os.MkdirAll(tk.StepReviewsDir(), 0o700); err != nil {
		t.Fatalf("create step-reviews directory: %v", err)
	}
	writeFile(t, filepath.Join(tk.StepReviewsDir(), name), content)
}

func TestStepReportPaths(t *testing.T) {
	t.Parallel()

	tk := task.Task{ArtifactsDir: "/data/tasks/add-login"}
	dir := filepath.Join("/data/tasks/add-login", "step-reviews")

	if got := tk.StepReviewsDir(); got != dir {
		t.Errorf("StepReviewsDir() = %q, want %q", got, dir)
	}
	if got := task.StepReportFile(3, 2); got != "3-review-2.md" {
		t.Errorf("StepReportFile(3, 2) = %q, want %q", got, "3-review-2.md")
	}
	if got, want := tk.StepReportPath(3, 2), filepath.Join(dir, "3-review-2.md"); got != want {
		t.Errorf("StepReportPath(3, 2) = %q, want %q", got, want)
	}
}

func TestReadStepReportsOfAMissingFolder(t *testing.T) {
	t.Parallel()

	got := task.ReadStepReports(filepath.Join(t.TempDir(), "step-reviews"))
	if got == nil {
		t.Fatal("ReadStepReports() = nil, want an empty map")
	}
	if len(got) != 0 {
		t.Errorf("ReadStepReports() = %v, want no report", got)
	}
}

func TestReadStepReportsReadsTheReportsOfEveryStep(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	writeFile(t, filepath.Join(dir, "1-review-2.md"), stepReportFile(1, 2, "clean", "Nothing to change.\n"))
	writeFile(t, filepath.Join(dir, "1-review-1.md"), stepReportFile(1, 1, "changes", "1. A test fails.\n"))
	writeFile(t, filepath.Join(dir, "3-review-1.md"), stepReportFile(3, 1, "changes", "1. A name misleads.\n"))

	want := map[int][]task.ReviewReport{
		1: {{Pass: 1, File: "1-review-1.md", Findings: -1}, {Pass: 2, File: "1-review-2.md", Clean: true, Findings: -1}},
		3: {{Pass: 1, File: "3-review-1.md", Findings: -1}},
	}
	if diff := cmp.Diff(want, task.ReadStepReports(dir)); diff != "" {
		t.Errorf("ReadStepReports() mismatch (-want +got):\n%s", diff)
	}
}

func TestReadStepReportsCountsTheFindings(t *testing.T) {
	t.Parallel()

	const reviewed = "1. **What was reviewed**: the store.\n2. **Checks**: `task check` passes.\n"
	const rest = "4. **Accepted divergences**: None.\n5. **Contestations**: None.\n6. **Decisions of the user**: None.\n"
	tests := map[string]struct {
		body string
		want int
	}{
		"numbered findings in the format of the prompt": {
			body: reviewed + "3. **Findings**:\n   1. `store.go:12` leaks a handle; close it.\n" +
				"   2. `store_test.go` misses the empty case; add it.\n" + rest,
			want: 2,
		},
		"None. on the line of the title": {
			body: reviewed + "3. **Findings**: None.\n" + rest,
			want: 0,
		},
		"none without the dot": {
			body: reviewed + "3. **Findings**: none\n" + rest,
			want: 0,
		},
		"an empty section": {
			body: reviewed + "3. **Findings**:\n\n" + rest,
			want: 0,
		},
		"titles in ##": {
			body: "## What was reviewed\n\nThe store.\n\n## Findings\n\n- A handle leaks.\n- A case is missing.\n" +
				"* A name misleads.\n\n## Accepted divergences\n\nNone.\n",
			want: 3,
		},
		"None. under a ## title": {
			body: "## Findings\n\nNone.\n\n## Contestations\n\n- One.\n",
			want: 0,
		},
		"text that is not a list": {
			body: "## Findings\n\nThe handle of the store leaks.\n",
			want: 1,
		},
		"no Findings section": {
			body: reviewed + rest,
			want: -1,
		},
		"the colon inside the bold and None.": {
			body: reviewed + "3. **Findings:** None.\n" + rest,
			want: 0,
		},
		"numbered findings in bold, the file first, under a ## title": {
			body: "## Checks\n\nNone.\n\n## Findings\n\n" +
				"1. **`frontend/src/features/chat/`** — `actions.ts` and its table tests do not exist. Implement them.\n" +
				"2. **`frontend/src/features/task/request.ts`** — the new functions are not added. Add them with tests.\n" +
				"3. **`frontend/src/features/task/place.ts`** — missing. Create it with its tests.\n" +
				"4. Once complete, run `task check` in full.\n\n## Accepted divergences\n\nNone.\n",
			want: 4,
		},
		"findings with the path and the line, under a ## title": {
			body: "## Findings\n\n" +
				"1. `frontend/src/store/actions.ts:426` — `sendMessage` has no caller left outside its tests. Remove it.\n" +
				"2. `frontend/src/store/actions.test.ts` — the new store API has no tests of its own. Add them.\n\n" +
				"## Accepted divergences\n\n- `TaskComposer` is a new file. Sound.\n- The chips are wired. Sound.\n\n" +
				"## Contestations\n\nNone.\n",
			want: 2,
		},
		"sub-items of a finding count with it": {
			body: "## Findings\n\n1. **`output.go:39`: the report keeps its frame.**\n   - The text is framed.\n" +
				"   - **Fix:** read the structured result.\n2. **`events.go:417`: rate matches generate.**\n" +
				"   - **Fix:** match the words.\n\n## Accepted divergences\n\nNone.\n",
			want: 2,
		},
		"sub-headings deeper than the title": {
			body: "## Findings\n\n### 1. The handle leaks\n\n- `store.go:12`\n- Close it.\n\n" +
				"### 2. A case is missing\n\nAdd it.\n\n## Accepted divergences\n\n- One.\n",
			want: 2,
		},
		"numbered findings in bold in the format of the prompt": {
			body: reviewed + "3. **Findings**:\n1. **`store.go:12`**: leaks a handle; close it.\n" +
				"2. **`store_test.go`**: misses the empty case; add it.\n" + rest,
			want: 2,
		},
		"a heading ends a section whose title is no heading": {
			body: reviewed + "3. **Findings**:\n- One.\n\n## Notes\n\n- Not a finding.\n",
			want: 1,
		},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			dir := t.TempDir()
			writeFile(t, filepath.Join(dir, "1-review-1.md"), stepReportFile(1, 1, "changes", tc.body))

			reports := task.ReadStepReports(dir)[1]
			if len(reports) != 1 {
				t.Fatalf("ReadStepReports() = %v, want one report", reports)
			}
			if got := reports[0].Findings; got != tc.want {
				t.Errorf("Findings = %d, want %d", got, tc.want)
			}
		})
	}
}

func TestReadStepReportsRefusesWhatIsNotAReport(t *testing.T) {
	t.Parallel()

	const body = "Nothing to change.\n"
	tests := map[string]struct {
		name    string
		content string
		folder  bool
	}{
		"no status":                   {name: "1-review-1.md", content: "---\nstep: 1\npass: 1\n---\n\n" + body},
		"a status that is no verdict": {name: "1-review-1.md", content: stepReportFile(1, 1, "done", body)},
		"a pass the name disagrees":   {name: "1-review-2.md", content: stepReportFile(1, 3, "clean", body)},
		"a step the name disagrees":   {name: "1-review-1.md", content: stepReportFile(2, 1, "clean", body)},
		"a file that is not a report": {name: "notes.md", content: stepReportFile(1, 1, "clean", body)},
		"pass zero":                   {name: "1-review-0.md", content: stepReportFile(1, 0, "clean", body)},
		"step zero":                   {name: "0-review-1.md", content: stepReportFile(0, 1, "clean", body)},
		"a hidden file":               {name: ".1-review-1.md", content: stepReportFile(1, 1, "clean", body)},
		"a folder":                    {name: "1-review-1.md", folder: true},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			dir := t.TempDir()
			path := filepath.Join(dir, tc.name)
			if tc.folder {
				if err := os.Mkdir(path, 0o700); err != nil {
					t.Fatalf("create %s: %v", path, err)
				}
			} else {
				writeFile(t, path, tc.content)
			}

			if got := task.ReadStepReports(dir); len(got) != 0 {
				t.Errorf("ReadStepReports() = %v, want no report", got)
			}
		})
	}
}

func TestInspectReadsTheStepReviewsFolder(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")
	if cached, _ := f.service.Artifacts(created.ID); cached.StepReports == nil {
		t.Error("Artifacts().StepReports = nil, want an empty map for a new task")
	}
	writeStepReport(t, created, "2-review-1.md", stepReportFile(2, 1, "clean", "Nothing to change.\n"))

	got, err := f.service.Inspect(created.ID)
	if err != nil {
		t.Fatalf("Inspect() = %v, want nil", err)
	}

	if !got.Has(task.ArtifactStepReview) {
		t.Errorf("Has(ArtifactStepReview) = false, want the report found: %+v", got.StepReports)
	}
	want := map[int][]task.ReviewReport{2: {{Pass: 1, File: "2-review-1.md", Clean: true, Findings: -1}}}
	if diff := cmp.Diff(want, got.StepReports); diff != "" {
		t.Errorf("StepReports mismatch (-want +got):\n%s", diff)
	}
}

func TestWatcherReportsTheStepReviewsFolder(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")

	writeStepReport(t, created, "1-review-1.md", stepReportFile(1, 1, "changes", "1. A test fails.\n"))
	waitFor(t, "the report to be reported", func() bool {
		calls := f.artifactCalls()
		if len(calls) == 0 {
			return false
		}
		_, ok := calls[len(calls)-1].change(task.ArtifactStepReview)
		return ok
	})

	if cached, _ := f.service.Artifacts(created.ID); !cached.Has(task.ArtifactStepReview) {
		t.Error("Has(ArtifactStepReview) = false, want the cache to follow the folder")
	}
}

func TestReadArtifactReturnsAStepReport(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")
	report := stepReportFile(1, 1, "clean", "Nothing to change.\n")
	writeStepReport(t, created, "1-review-1.md", report)

	got, err := f.service.ReadArtifact(created.ID, "step-reviews/1-review-1.md")
	if err != nil {
		t.Fatalf("ReadArtifact() = %v, want nil", err)
	}
	if got != report {
		t.Errorf("ReadArtifact() = %q, want %q", got, report)
	}
}

func TestReadArtifactRefusesAnythingButTheStepReports(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")

	names := map[string]string{
		"a path through the folder":   "step-reviews/../PRD.md",
		"a nested path":               "step-reviews/nested/1-review-1.md",
		"a file that is not a report": "step-reviews/notes.md",
		"the folder itself":           task.StepReviewsDirName,
	}

	for name, artifact := range names {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			_, err := f.service.ReadArtifact(created.ID, artifact)
			wantErrIs(t, err, task.ErrNotFound)
		})
	}
}

func TestRemoveArtifactsFromTheImplementationThrowsAwayTheStepReviews(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")
	writeStepReport(t, created, "1-review-1.md", stepReportFile(1, 1, "clean", "Nothing to change.\n"))

	if err := f.service.RemoveArtifacts(t.Context(), created.ID, task.StageImplementation); err != nil {
		t.Fatalf("RemoveArtifacts() = %v, want nil", err)
	}

	if exists(created.StepReviewsDir()) {
		t.Error("the step-reviews folder is still there, want it thrown away")
	}
	if cached, _ := f.service.Artifacts(created.ID); cached.Has(task.ArtifactStepReview) {
		t.Error("Has(ArtifactStepReview) = true, want the cache to follow the folder")
	}
}

func TestClearStepReviewForgetsTheReviewOfOneStep(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")
	writeStepReport(t, created, "1-review-1.md", stepReportFile(1, 1, "changes", "1. A test fails.\n"))
	writeStepReport(t, created, "1-review-2.md", stepReportFile(1, 2, "changes", "1. A test fails.\n"))
	writeStepReport(t, created, "12-review-1.md", stepReportFile(12, 1, "clean", "Nothing to change.\n"))

	const start = "1111111111111111111111111111111111111111"
	if _, err := f.service.SetStepStarted(t.Context(), created.ID, 1, start); err != nil {
		t.Fatalf("SetStepStarted() = %v, want nil", err)
	}
	if _, err := f.service.SetStepPass(t.Context(), created.ID, 1, 2); err != nil {
		t.Fatalf("SetStepPass() = %v, want nil", err)
	}
	if _, err := f.service.SetStepReported(t.Context(), created.ID, 1, 1); err != nil {
		t.Fatalf("SetStepReported() = %v, want nil", err)
	}
	if _, err := f.service.SetStepFallback(t.Context(), created.ID, 1, task.FallbackTakenOver); err != nil {
		t.Fatalf("SetStepFallback() = %v, want nil", err)
	}
	before, _ := f.service.Get(created.ID)

	if err := f.service.ClearStepReview(t.Context(), created.ID, 1); err != nil {
		t.Fatalf("ClearStepReview() = %v, want nil", err)
	}

	if exists(created.StepReportPath(1, 1)) || exists(created.StepReportPath(1, 2)) {
		t.Error("a report of step 1 is still there, want them thrown away")
	}
	if !exists(created.StepReportPath(12, 1)) {
		t.Error("the report of step 12 is gone, want the other steps left alone")
	}

	// The run forgets how far the loop got, and keeps where the step stands.
	want := []task.StepRun{{
		TaskID: created.ID, Number: 1, Status: task.StepStarted,
		CreatedAt: base, UpdatedAt: base, StartCommit: start,
	}}
	if diff := cmp.Diff(want, f.service.StepRuns(created.ID)); diff != "" {
		t.Errorf("StepRuns() mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff(want, f.repo.stepRuns(created.ID)); diff != "" {
		t.Errorf("stored runs mismatch (-want +got):\n%s", diff)
	}

	after, _ := f.service.Get(created.ID)
	if after.ArtifactVersion <= before.ArtifactVersion {
		t.Errorf("ArtifactVersion = %d, want it past %d", after.ArtifactVersion, before.ArtifactVersion)
	}
	cached, _ := f.service.Artifacts(created.ID)
	wantReports := map[int][]task.ReviewReport{12: {{Pass: 1, File: "12-review-1.md", Clean: true, Findings: -1}}}
	if diff := cmp.Diff(wantReports, cached.StepReports); diff != "" {
		t.Errorf("StepReports mismatch (-want +got):\n%s", diff)
	}

	wantErrIs(t, f.service.ClearStepReview(t.Context(), "nope", 1), task.ErrNotFound)
}
