package task_test

import (
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/task"
)

// step is a well-formed step file.
func step(title string) string {
	return "# " + title + "\n\n## Scope\n\nDo it.\n"
}

// writeSteps fills a fresh steps folder with the given files and reads it.
func readSteps(t *testing.T, files map[string]string) task.Plan {
	t.Helper()

	dir := filepath.Join(t.TempDir(), "steps")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatalf("create steps folder: %v", err)
	}
	for name, content := range files {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0o600); err != nil {
			t.Fatalf("write %s: %v", name, err)
		}
	}
	return task.ReadPlan(dir)
}

// messages lists the problems of a plan as "file: message" pairs, in order.
func messages(plan task.Plan) []string {
	out := make([]string, len(plan.Problems))
	for i, problem := range plan.Problems {
		out[i] = problem.File + ": " + problem.Message
	}
	return out
}

// wantProblem fails unless exactly one problem, on file, mentions substring.
func wantProblem(t *testing.T, plan task.Plan, file, substring string) {
	t.Helper()

	if len(plan.Problems) != 1 {
		t.Fatalf("problems = %v, want exactly one", messages(plan))
	}
	problem := plan.Problems[0]
	if problem.File != file {
		t.Errorf("problem file = %q, want %q", problem.File, file)
	}
	if !strings.Contains(problem.Message, substring) {
		t.Errorf("problem message = %q, want it to mention %q", problem.Message, substring)
	}
}

func TestReadPlanOfAMissingFolder(t *testing.T) {
	t.Parallel()

	plan := task.ReadPlan(filepath.Join(t.TempDir(), "steps"))

	if plan.Present {
		t.Error("Present = true, want false for a folder that is not there")
	}
	if plan.Valid() {
		t.Error("Valid() = true, want false")
	}
}

func TestReadPlanOfAFolderItCannotRead(t *testing.T) {
	t.Parallel()

	path := filepath.Join(t.TempDir(), "steps")
	if err := os.WriteFile(path, []byte("not a folder"), 0o600); err != nil {
		t.Fatalf("write file: %v", err)
	}

	plan := task.ReadPlan(path)

	if !plan.Present {
		t.Error("Present = false, want true so that the problem is shown")
	}
	wantProblem(t, plan, "", "cannot read the steps folder")
}

func TestReadPlanOfAnEmptyFolder(t *testing.T) {
	t.Parallel()

	plan := readSteps(t, nil)

	if plan.Present {
		t.Error("Present = true, want false for an empty folder")
	}
	if len(plan.Problems) != 0 {
		t.Errorf("problems = %v, want none", messages(plan))
	}
}

func TestReadPlanIgnoresHiddenEntries(t *testing.T) {
	t.Parallel()

	plan := readSteps(t, map[string]string{".DS_Store": "junk", ".keep": ""})

	if plan.Present {
		t.Error("Present = true, want false when only hidden entries are there")
	}
}

func TestReadPlanReadsAValidPlan(t *testing.T) {
	t.Parallel()

	plan := readSteps(t, map[string]string{
		"1-add-the-store.md": step("Step 1: Add the store"),
		"2-wire-the-ui.md":   step("Step 2: Wire the UI"),
	})

	if !plan.Valid() {
		t.Fatalf("Valid() = false, want true; problems = %v", messages(plan))
	}
	want := []task.Step{
		{Number: 1, File: "1-add-the-store.md", Title: "Add the store"},
		{Number: 2, File: "2-wire-the-ui.md", Title: "Wire the UI"},
	}
	if !slices.Equal(plan.Steps, want) {
		t.Errorf("steps = %+v, want %+v", plan.Steps, want)
	}
}

func TestReadPlanRejectsADirectory(t *testing.T) {
	t.Parallel()

	dir := filepath.Join(t.TempDir(), "steps")
	if err := os.MkdirAll(filepath.Join(dir, "drafts"), 0o700); err != nil {
		t.Fatalf("create folder: %v", err)
	}

	plan := task.ReadPlan(dir)

	wantProblem(t, plan, "drafts", "unexpected directory")
}

func TestReadPlanRejectsAName(t *testing.T) {
	t.Parallel()

	tests := []string{"notes.md", "1_add_the_store.md", "1-Add-The-Store.md", "1-add-the-store.txt", "-add.md"}

	for _, name := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			plan := readSteps(t, map[string]string{name: step("Step 1: Add")})

			wantProblem(t, plan, name, "unexpected file name")
		})
	}
}

func TestReadPlanRejectsStepZero(t *testing.T) {
	t.Parallel()

	plan := readSteps(t, map[string]string{"0-add-the-store.md": step("Step 0: Add")})

	wantProblem(t, plan, "0-add-the-store.md", "step numbers start at 1")
}

func TestReadPlanRejectsAnEmptyFile(t *testing.T) {
	t.Parallel()

	plan := readSteps(t, map[string]string{"1-add-the-store.md": "   \n\n"})

	wantProblem(t, plan, "1-add-the-store.md", "the file is empty")
	if len(plan.Steps) != 0 {
		t.Errorf("steps = %+v, want none for an empty file", plan.Steps)
	}
}

func TestAStepFileWithoutAHeaderIsAValidStep(t *testing.T) {
	t.Parallel()

	plan := readSteps(t, map[string]string{"1-add-the-store.md": "# Step 1: Add the store\n"})

	if !plan.Valid() {
		t.Fatalf("Valid() = false, want true; problems = %v", messages(plan))
	}
	if got := plan.Steps[0].Title; got != "Add the store" {
		t.Errorf("Title = %q, want %q", got, "Add the store")
	}
}

func TestAStepFileWithAHeaderIsReadForItsTitleAlone(t *testing.T) {
	t.Parallel()

	plan := readSteps(t, map[string]string{
		"1-add-the-store.md": "---\nrepository: api\nowner: me\n---\n\n# Step 1: Add the store\n",
	})

	if !plan.Valid() {
		t.Fatalf("Valid() = false, want true; problems = %v", messages(plan))
	}
	want := []task.Step{{Number: 1, File: "1-add-the-store.md", Title: "Add the store"}}
	if !slices.Equal(plan.Steps, want) {
		t.Errorf("steps = %+v, want %+v", plan.Steps, want)
	}
}

func TestReadPlanRejectsAFileWithoutTitle(t *testing.T) {
	t.Parallel()

	plan := readSteps(t, map[string]string{"1-add-the-store.md": "Just a paragraph.\n"})

	wantProblem(t, plan, "1-add-the-store.md", "missing the title heading")
}

func TestReadPlanRejectsRepeatedNumbers(t *testing.T) {
	t.Parallel()

	plan := readSteps(t, map[string]string{
		"1-add-the-store.md": step("Step 1: Add the store"),
		"1-wire-the-ui.md":   step("Step 1: Wire the UI"),
	})

	wantProblem(t, plan, "", "step number 1 is used by more than one file")
}

func TestReadPlanRejectsAGapInTheNumbers(t *testing.T) {
	t.Parallel()

	plan := readSteps(t, map[string]string{
		"2-wire-the-ui.md":  step("Step 2: Wire the UI"),
		"5-ship-it.md":      step("Step 5: Ship it"),
		"9-nine-lives.md":   step("Step 9: Nine lives"),
		".hidden-draft.md":  "junk",
		"10-ten-pin-it.md":  step("Step 10: Ten pin it"),
		"11-eleven-ways.md": step("Step 11: Eleven ways"),
	})

	want := []string{
		": step numbers must be contiguous from 1; number 1 is missing",
		": step numbers must be contiguous from 1; number 3 is missing",
		": step numbers must be contiguous from 1; number 4 is missing",
		": step numbers must be contiguous from 1; number 6 is missing",
		": step numbers must be contiguous from 1; number 7 is missing",
		": step numbers must be contiguous from 1; number 8 is missing",
	}
	if got := messages(plan); !slices.Equal(got, want) {
		t.Errorf("problems = %v, want %v", got, want)
	}
}

func TestReadPlanReadsATitleWithoutTheStepPrefix(t *testing.T) {
	t.Parallel()

	plan := readSteps(t, map[string]string{"1-add-the-store.md": step("Add the store")})

	if !plan.Valid() {
		t.Fatalf("Valid() = false, want true; problems = %v", messages(plan))
	}
	if got := plan.Steps[0].Title; got != "Add the store" {
		t.Errorf("Title = %q, want %q", got, "Add the store")
	}
}

func TestReadPlanReadsWindowsLineEndings(t *testing.T) {
	t.Parallel()

	plan := readSteps(t, map[string]string{
		"1-add-the-store.md": "# Step 1: Add the store\r\n",
	})

	if !plan.Valid() {
		t.Fatalf("Valid() = false, want true; problems = %v", messages(plan))
	}
	if got := plan.Steps[0].Title; got != "Add the store" {
		t.Errorf("Title = %q, want %q", got, "Add the store")
	}
}

func TestReadPlanOrdersProblemsByFileWithThePlanLast(t *testing.T) {
	t.Parallel()

	plan := readSteps(t, map[string]string{
		"2-wire-the-ui.md":   "no heading here\n",
		"3-add-the-store.md": "still no heading\n",
	})

	want := []string{
		`2-wire-the-ui.md: missing the title heading ("# Step N: Title")`,
		`3-add-the-store.md: missing the title heading ("# Step N: Title")`,
		": step numbers must be contiguous from 1; number 1 is missing",
	}
	if got := messages(plan); !slices.Equal(got, want) {
		t.Errorf("problems = %v, want %v", got, want)
	}
}

// readOneShot writes a One-Shot document into a fresh folder and reads it as
// the plan of the task add-login.
func readOneShot(t *testing.T, content string) task.Plan {
	t.Helper()

	path := filepath.Join(t.TempDir(), task.OneShotFile)
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
	return task.OneShotPlan(path, "add-login")
}

func TestOneShotPlanOfADocumentNotWrittenIsAbsent(t *testing.T) {
	t.Parallel()

	missing := task.OneShotPlan(filepath.Join(t.TempDir(), task.OneShotFile), "add-login")
	if diff := cmp.Diff(task.Plan{}, missing); diff != "" {
		t.Errorf("plan of a missing document mismatch (-want +got):\n%s", diff)
	}

	// An agent creating the file empty has not written it yet.
	if diff := cmp.Diff(task.Plan{}, readOneShot(t, "")); diff != "" {
		t.Errorf("plan of an empty document mismatch (-want +got):\n%s", diff)
	}
}

func TestOneShotPlanIsTheDocumentAsOneStep(t *testing.T) {
	t.Parallel()

	plan := readOneShot(t, "# Add the login — One-Shot\n\nThis document is the complete guide.\n")

	want := task.Plan{
		Present: true,
		Steps:   []task.Step{{Number: 1, File: task.OneShotFile, Title: "Add the login"}},
	}
	if diff := cmp.Diff(want, plan); diff != "" {
		t.Errorf("OneShotPlan() mismatch (-want +got):\n%s", diff)
	}
	if !plan.Valid() {
		t.Error("Valid() = false, want the plan of a written document valid")
	}
}

func TestOneShotPlanTitlesTheStepAfterTheDocument(t *testing.T) {
	t.Parallel()

	tests := map[string]struct{ content, want string }{
		"a heading with the suffix":    {content: "# Add the login — One-Shot\n", want: "Add the login"},
		"a heading without the suffix": {content: "# Add the login\n", want: "Add the login"},
		"no heading":                   {content: "Just a paragraph.\n", want: "add-login"},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			plan := readOneShot(t, tc.content)
			if len(plan.Steps) != 1 {
				t.Fatalf("steps = %+v, want one", plan.Steps)
			}
			if got := plan.Steps[0].Title; got != tc.want {
				t.Errorf("Title = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestReadPlanKeepsAStepWithProblems(t *testing.T) {
	t.Parallel()

	plan := readSteps(t, map[string]string{"2-add-the-store.md": step("Step 2: Add the store")})

	if len(plan.Steps) != 1 {
		t.Fatalf("steps = %+v, want the step to be listed anyway", plan.Steps)
	}
	if got := plan.Steps[0].Title; got != "Add the store" {
		t.Errorf("Title = %q, want %q", got, "Add the store")
	}
}
