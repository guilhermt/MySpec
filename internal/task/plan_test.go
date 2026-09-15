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

// planRepos are the repositories the step files of these tests may name.
func planRepos() []task.Repository {
	return []task.Repository{
		{Rel: "api", Path: "/workspace/api"},
		{Rel: "web", Path: "/workspace/web"},
	}
}

// step is a well-formed step file.
func step(repository, title string) string {
	return "---\nrepository: " + repository + "\n---\n\n# " + title + "\n\n## Scope\n\nDo it.\n"
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
	return task.ReadPlan(dir, planRepos())
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

	plan := task.ReadPlan(filepath.Join(t.TempDir(), "steps"), planRepos())

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

	plan := task.ReadPlan(path, planRepos())

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
		"1-add-the-store.md": step("api", "Step 1: Add the store"),
		"2-wire-the-ui.md":   step("web", "Step 2: Wire the UI"),
	})

	if !plan.Valid() {
		t.Fatalf("Valid() = false, want true; problems = %v", messages(plan))
	}
	want := []task.Step{
		{Number: 1, File: "1-add-the-store.md", Title: "Add the store", Repository: "api", RepoPath: "/workspace/api"},
		{Number: 2, File: "2-wire-the-ui.md", Title: "Wire the UI", Repository: "web", RepoPath: "/workspace/web"},
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

	plan := task.ReadPlan(dir, planRepos())

	wantProblem(t, plan, "drafts", "unexpected directory")
}

func TestReadPlanRejectsAName(t *testing.T) {
	t.Parallel()

	tests := []string{"notes.md", "1_add_the_store.md", "1-Add-The-Store.md", "1-add-the-store.txt", "-add.md"}

	for _, name := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			plan := readSteps(t, map[string]string{name: step("api", "Step 1: Add")})

			wantProblem(t, plan, name, "unexpected file name")
		})
	}
}

func TestReadPlanRejectsStepZero(t *testing.T) {
	t.Parallel()

	plan := readSteps(t, map[string]string{"0-add-the-store.md": step("api", "Step 0: Add")})

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

func TestReadPlanRejectsAFileWithoutHeader(t *testing.T) {
	t.Parallel()

	plan := readSteps(t, map[string]string{"1-add-the-store.md": "# Step 1: Add the store\n"})

	wantProblem(t, plan, "1-add-the-store.md", "missing the metadata header")
}

func TestReadPlanRejectsAHeaderWithoutRepository(t *testing.T) {
	t.Parallel()

	plan := readSteps(t, map[string]string{
		"1-add-the-store.md": "---\nowner: me\n---\n\n# Step 1: Add the store\n",
	})

	wantProblem(t, plan, "1-add-the-store.md", `has no "repository" field`)
}

func TestReadPlanRejectsARepositoryOutsideTheTask(t *testing.T) {
	t.Parallel()

	plan := readSteps(t, map[string]string{
		"1-add-the-store.md": step("infra", "Step 1: Add the store"),
	})

	wantProblem(t, plan, "1-add-the-store.md", `repository "infra" is not one of the repositories`)
	if got := plan.Steps[0].RepoPath; got != "" {
		t.Errorf("RepoPath = %q, want it empty for an unknown repository", got)
	}
}

func TestReadPlanRejectsAFileWithoutTitle(t *testing.T) {
	t.Parallel()

	plan := readSteps(t, map[string]string{
		"1-add-the-store.md": "---\nrepository: api\n---\n\nJust a paragraph.\n",
	})

	wantProblem(t, plan, "1-add-the-store.md", "missing the title heading")
}

func TestReadPlanRejectsRepeatedNumbers(t *testing.T) {
	t.Parallel()

	plan := readSteps(t, map[string]string{
		"1-add-the-store.md": step("api", "Step 1: Add the store"),
		"1-wire-the-ui.md":   step("web", "Step 1: Wire the UI"),
	})

	wantProblem(t, plan, "", "step number 1 is used by more than one file")
}

func TestReadPlanRejectsAGapInTheNumbers(t *testing.T) {
	t.Parallel()

	plan := readSteps(t, map[string]string{
		"2-wire-the-ui.md":  step("web", "Step 2: Wire the UI"),
		"5-ship-it.md":      step("api", "Step 5: Ship it"),
		"9-nine-lives.md":   step("api", "Step 9: Nine lives"),
		".hidden-draft.md":  "junk",
		"10-ten-pin-it.md":  step("api", "Step 10: Ten pin it"),
		"11-eleven-ways.md": step("api", "Step 11: Eleven ways"),
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

func TestReadPlanReadsAQuotedRepository(t *testing.T) {
	t.Parallel()

	tests := map[string]string{
		"quotes":    `"api"`,
		"apostroph": `'api'`,
		"backticks": "`api`",
	}

	for name, value := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			plan := readSteps(t, map[string]string{"1-add-the-store.md": step(value, "Step 1: Add the store")})

			if !plan.Valid() {
				t.Fatalf("Valid() = false, want true; problems = %v", messages(plan))
			}
			if got := plan.Steps[0].Repository; got != "api" {
				t.Errorf("Repository = %q, want %q", got, "api")
			}
		})
	}
}

func TestReadPlanReadsATitleWithoutTheStepPrefix(t *testing.T) {
	t.Parallel()

	plan := readSteps(t, map[string]string{"1-add-the-store.md": step("api", "Add the store")})

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
		"1-add-the-store.md": "---\r\nrepository: api\r\n---\r\n\r\n# Step 1: Add the store\r\n",
	})

	if !plan.Valid() {
		t.Fatalf("Valid() = false, want true; problems = %v", messages(plan))
	}
	if got := plan.Steps[0].Title; got != "Add the store" {
		t.Errorf("Title = %q, want %q", got, "Add the store")
	}
}

func TestReadPlanReadsAnEmptyHeader(t *testing.T) {
	t.Parallel()

	plan := readSteps(t, map[string]string{"1-add-the-store.md": "---\n---\n\n# Step 1: Add the store\n"})

	wantProblem(t, plan, "1-add-the-store.md", `has no "repository" field`)
}

func TestReadPlanOrdersProblemsByFileWithThePlanLast(t *testing.T) {
	t.Parallel()

	plan := readSteps(t, map[string]string{
		"2-wire-the-ui.md":   "---\nrepository: nope\n---\n\n# Step 2: Wire the UI\n",
		"3-add-the-store.md": "---\nrepository: api\n---\n\nno heading here\n",
	})

	want := []string{
		`2-wire-the-ui.md: repository "nope" is not one of the repositories of this task`,
		`3-add-the-store.md: missing the title heading ("# Step N: Title")`,
		": step numbers must be contiguous from 1; number 1 is missing",
	}
	if got := messages(plan); !slices.Equal(got, want) {
		t.Errorf("problems = %v, want %v", got, want)
	}
}

// readOneShot writes a One-Shot document into a fresh folder and reads it as
// the plan of the task add-login.
func readOneShot(t *testing.T, content string, repos []task.Repository) task.Plan {
	t.Helper()

	path := filepath.Join(t.TempDir(), task.OneShotFile)
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
	return task.OneShotPlan(path, "add-login", repos)
}

func TestOneShotPlanOfADocumentNotWrittenIsAbsent(t *testing.T) {
	t.Parallel()

	missing := task.OneShotPlan(filepath.Join(t.TempDir(), task.OneShotFile), "add-login", planRepos())
	if diff := cmp.Diff(task.Plan{}, missing); diff != "" {
		t.Errorf("plan of a missing document mismatch (-want +got):\n%s", diff)
	}

	// An agent creating the file empty has not written it yet.
	if diff := cmp.Diff(task.Plan{}, readOneShot(t, "", planRepos())); diff != "" {
		t.Errorf("plan of an empty document mismatch (-want +got):\n%s", diff)
	}
}

func TestOneShotPlanIsOneStepInTheRepositoryOfTheTask(t *testing.T) {
	t.Parallel()

	plan := readOneShot(t, "# Add the login — One-Shot\n\nThis document is the complete guide.\n", planRepos()[:1])

	want := task.Plan{
		Present: true,
		Steps: []task.Step{{
			Number: 1, File: task.OneShotFile, Title: "Add the login", Repository: "api", RepoPath: "/workspace/api",
		}},
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

			plan := readOneShot(t, tc.content, planRepos()[:1])
			if len(plan.Steps) != 1 {
				t.Fatalf("steps = %+v, want one", plan.Steps)
			}
			if got := plan.Steps[0].Title; got != tc.want {
				t.Errorf("Title = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestOneShotPlanOfATaskWithoutARepository(t *testing.T) {
	t.Parallel()

	plan := readOneShot(t, "# Add the login — One-Shot\n", nil)

	want := task.Plan{
		Present: true,
		Steps:   []task.Step{{Number: 1, File: task.OneShotFile, Title: "Add the login"}},
	}
	if diff := cmp.Diff(want, plan); diff != "" {
		t.Errorf("OneShotPlan() mismatch (-want +got):\n%s", diff)
	}
}

func TestReadPlanKeepsAStepWithProblems(t *testing.T) {
	t.Parallel()

	plan := readSteps(t, map[string]string{
		"1-add-the-store.md": "---\nrepository: nope\n---\n\n# Step 1: Add the store\n",
	})

	if len(plan.Steps) != 1 {
		t.Fatalf("steps = %+v, want the step to be listed anyway", plan.Steps)
	}
	if got := plan.Steps[0].Title; got != "Add the store" {
		t.Errorf("Title = %q, want %q", got, "Add the store")
	}
}
