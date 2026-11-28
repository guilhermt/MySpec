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

// stepDependingOn is a step file with line right below its title.
func stepDependingOn(title, line string) string {
	return "# " + title + "\n\n" + line + "\n\n## Scope\n\nDo it.\n"
}

// dependencies lists the effective dependencies of each step of plan, by number.
func dependencies(plan task.Plan) map[int][]int {
	out := make(map[int][]int, len(plan.Steps))
	for _, step := range plan.Steps {
		out[step.Number] = step.DependsOn
	}
	return out
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
		{Number: 2, File: "2-wire-the-ui.md", Title: "Wire the UI", DependsOn: []int{1}},
	}
	if diff := cmp.Diff(want, plan.Steps); diff != "" {
		t.Errorf("steps mismatch (-want +got):\n%s", diff)
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
	if diff := cmp.Diff(want, plan.Steps); diff != "" {
		t.Errorf("steps mismatch (-want +got):\n%s", diff)
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

func TestReadPlanReadsAPlanWithoutDependencyLinesAsAChain(t *testing.T) {
	t.Parallel()

	plan := readSteps(t, map[string]string{
		"1-one.md":   step("Step 1: One"),
		"2-two.md":   step("Step 2: Two"),
		"3-three.md": step("Step 3: Three"),
	})

	if !plan.Valid() {
		t.Fatalf("Valid() = false, want true; problems = %v", messages(plan))
	}
	want := map[int][]int{1: nil, 2: {1}, 3: {2}}
	if diff := cmp.Diff(want, dependencies(plan)); diff != "" {
		t.Errorf("dependencies mismatch (-want +got):\n%s", diff)
	}
}

func TestReadPlanOfASingleStepHasNoDependencies(t *testing.T) {
	t.Parallel()

	for name, content := range map[string]string{
		"without the line": step("Step 1: One"),
		"with the line":    stepDependingOn("Step 1: One", "Depends on: none"),
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			plan := readSteps(t, map[string]string{"1-one.md": content})

			if !plan.Valid() {
				t.Fatalf("Valid() = false, want true; problems = %v", messages(plan))
			}
			if got := plan.Steps[0].DependsOn; got != nil {
				t.Errorf("DependsOn = %v, want nil", got)
			}
		})
	}
}

func TestReadPlanReadsTheDeclaredGraph(t *testing.T) {
	t.Parallel()

	plan := readSteps(t, map[string]string{
		"1-one.md":   stepDependingOn("Step 1: One", "Depends on: none"),
		"2-two.md":   stepDependingOn("Step 2: Two", "Depends on: none"),
		"3-three.md": stepDependingOn("Step 3: Three", "Depends on: 1, 2"),
		"4-four.md":  stepDependingOn("Step 4: Four", "Depends on: 1"),
	})

	if !plan.Valid() {
		t.Fatalf("Valid() = false, want true; problems = %v", messages(plan))
	}
	want := map[int][]int{1: nil, 2: nil, 3: {1, 2}, 4: {1}}
	if diff := cmp.Diff(want, dependencies(plan)); diff != "" {
		t.Errorf("dependencies mismatch (-want +got):\n%s", diff)
	}
}

func TestReadPlanGivesAStepWithoutTheLineNoDependenciesInAGraph(t *testing.T) {
	t.Parallel()

	plan := readSteps(t, map[string]string{
		"1-one.md": stepDependingOn("Step 1: One", "Depends on: none"),
		"2-two.md": step("Step 2: Two"),
	})

	if !plan.Valid() {
		t.Fatalf("Valid() = false, want true; problems = %v", messages(plan))
	}
	want := map[int][]int{1: nil, 2: nil}
	if diff := cmp.Diff(want, dependencies(plan)); diff != "" {
		t.Errorf("dependencies mismatch (-want +got):\n%s", diff)
	}
}

func TestReadPlanReadsIndependentStepsWhenEveryFileSaysNone(t *testing.T) {
	t.Parallel()

	plan := readSteps(t, map[string]string{
		"1-one.md":   stepDependingOn("Step 1: One", "Depends on: none"),
		"2-two.md":   stepDependingOn("Step 2: Two", "Depends on: none"),
		"3-three.md": stepDependingOn("Step 3: Three", "Depends on: none"),
	})

	if !plan.Valid() {
		t.Fatalf("Valid() = false, want true; problems = %v", messages(plan))
	}
	want := map[int][]int{1: nil, 2: nil, 3: nil}
	if diff := cmp.Diff(want, dependencies(plan)); diff != "" {
		t.Errorf("dependencies mismatch (-want +got):\n%s", diff)
	}
}

func TestReadPlanAcceptsTheFormsOfTheDependencyLine(t *testing.T) {
	t.Parallel()

	tests := map[string]struct {
		line string
		want []int
	}{
		"bold with the colon inside":  {line: "**Depends on:** 1", want: []int{1}},
		"bold with the colon outside": {line: "**Depends on**: 1", want: []int{1}},
		"lowercase with a step word":  {line: "depends on: Step 1", want: []int{1}},
		"a steps word":                {line: "Depends on: steps 1, 2", want: []int{1, 2}},
		"none with a full stop":       {line: "Depends on: None.", want: nil},
		"extra spaces":                {line: "   Depends on:   1 ,   2  ", want: []int{1, 2}},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			plan := readSteps(t, map[string]string{
				"1-one.md":   step("Step 1: One"),
				"2-two.md":   step("Step 2: Two"),
				"3-three.md": stepDependingOn("Step 3: Three", tc.line),
			})

			if !plan.Valid() {
				t.Fatalf("Valid() = false, want true; problems = %v", messages(plan))
			}
			if diff := cmp.Diff(tc.want, plan.Steps[2].DependsOn); diff != "" {
				t.Errorf("DependsOn mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestReadPlanToleratesRepeatedRedundantAndForwardDependencies(t *testing.T) {
	t.Parallel()

	plan := readSteps(t, map[string]string{
		"1-one.md":   stepDependingOn("Step 1: One", "Depends on: 3"),
		"2-two.md":   stepDependingOn("Step 2: Two", "Depends on: none"),
		"3-three.md": stepDependingOn("Step 3: Three", "Depends on: 2, 2, 1"),
	})

	if len(plan.Problems) != 1 || !strings.Contains(plan.Problems[0].Message, "cycle") {
		t.Fatalf("problems = %v, want only the cycle of 1 and 3", messages(plan))
	}

	plan = readSteps(t, map[string]string{
		"1-one.md":   stepDependingOn("Step 1: One", "Depends on: 3"),
		"2-two.md":   stepDependingOn("Step 2: Two", "Depends on: none"),
		"3-three.md": stepDependingOn("Step 3: Three", "Depends on: 2, 2"),
		"4-four.md":  stepDependingOn("Step 4: Four", "Depends on: 3, 2, 1"),
	})

	if !plan.Valid() {
		t.Fatalf("Valid() = false, want true; problems = %v", messages(plan))
	}
	want := map[int][]int{1: {3}, 2: nil, 3: {2}, 4: {1, 2, 3}}
	if diff := cmp.Diff(want, dependencies(plan)); diff != "" {
		t.Errorf("dependencies mismatch (-want +got):\n%s", diff)
	}
}

func TestReadPlanDoesNotReadADependencyLineOutsideTheTitleRegion(t *testing.T) {
	t.Parallel()

	plan := readSteps(t, map[string]string{
		"1-one.md": step("Step 1: One"),
		"2-two.md": "# Step 2: Two\n\n## Scope\n\nDepends on: none\n",
	})

	if !plan.Valid() {
		t.Fatalf("Valid() = false, want true; problems = %v", messages(plan))
	}
	want := map[int][]int{1: nil, 2: {1}}
	if diff := cmp.Diff(want, dependencies(plan)); diff != "" {
		t.Errorf("dependencies mismatch (-want +got):\n%s", diff)
	}
}

func TestReadPlanReadsOnlyTheFirstDependencyLine(t *testing.T) {
	t.Parallel()

	plan := readSteps(t, map[string]string{
		"1-one.md": stepDependingOn("Step 1: One", "Depends on: none"),
		"2-two.md": stepDependingOn("Step 2: Two", "Depends on: 1\nDepends on: 7"),
	})

	if !plan.Valid() {
		t.Fatalf("Valid() = false, want true; problems = %v", messages(plan))
	}
	if diff := cmp.Diff([]int{1}, plan.Steps[1].DependsOn); diff != "" {
		t.Errorf("DependsOn mismatch (-want +got):\n%s", diff)
	}
}

func TestReadPlanRejectsADependencyLineItCannotRead(t *testing.T) {
	t.Parallel()

	for _, line := range []string{"Depends on: 1 and 3", "Depends on:", "Depends on: two"} {
		t.Run(line, func(t *testing.T) {
			t.Parallel()

			plan := readSteps(t, map[string]string{
				"1-one.md": step("Step 1: One"),
				"2-two.md": stepDependingOn("Step 2: Two", line),
			})

			wantProblem(t, plan, "2-two.md", "Depends on: none")
		})
	}
}

func TestReadPlanRejectsADependencyOnAStepThatIsNotInThePlan(t *testing.T) {
	t.Parallel()

	for _, line := range []string{"Depends on: 7", "Depends on: 0"} {
		t.Run(line, func(t *testing.T) {
			t.Parallel()

			plan := readSteps(t, map[string]string{
				"1-one.md":   stepDependingOn("Step 1: One", "Depends on: none"),
				"2-two.md":   stepDependingOn("Step 2: Two", line),
				"3-three.md": stepDependingOn("Step 3: Three", "Depends on: 1"),
			})

			wantProblem(t, plan, "2-two.md", "which is not in the plan")
			if want := strings.TrimPrefix(line, "Depends on: "); !strings.Contains(plan.Problems[0].Message, "step "+want) {
				t.Errorf("problem message = %q, want it to mention step %s", plan.Problems[0].Message, want)
			}
			if got := plan.Steps[1].DependsOn; got != nil {
				t.Errorf("DependsOn = %v, want the missing step left out", got)
			}
		})
	}
}

func TestReadPlanRejectsAStepThatDependsOnItself(t *testing.T) {
	t.Parallel()

	plan := readSteps(t, map[string]string{
		"1-one.md": stepDependingOn("Step 1: One", "Depends on: none"),
		"2-two.md": stepDependingOn("Step 2: Two", "Depends on: 1, 2"),
	})

	wantProblem(t, plan, "2-two.md", "itself")
	if diff := cmp.Diff([]int{1}, plan.Steps[1].DependsOn); diff != "" {
		t.Errorf("DependsOn mismatch (-want +got):\n%s", diff)
	}
}

func TestReadPlanRejectsACycle(t *testing.T) {
	t.Parallel()

	plan := readSteps(t, map[string]string{
		"1-one.md":   stepDependingOn("Step 1: One", "Depends on: none"),
		"2-two.md":   stepDependingOn("Step 2: Two", "Depends on: 4"),
		"3-three.md": stepDependingOn("Step 3: Three", "Depends on: 2"),
		"4-four.md":  stepDependingOn("Step 4: Four", "Depends on: 3"),
	})

	want := []string{": steps depend on each other in a cycle: 2 → 4 → 3 → 2; each step in it depends on the next"}
	if diff := cmp.Diff(want, messages(plan)); diff != "" {
		t.Errorf("problems mismatch (-want +got):\n%s", diff)
	}
}

func TestReadPlanReportsEachDisjointCycle(t *testing.T) {
	t.Parallel()

	plan := readSteps(t, map[string]string{
		"1-one.md":   stepDependingOn("Step 1: One", "Depends on: 2"),
		"2-two.md":   stepDependingOn("Step 2: Two", "Depends on: 1"),
		"3-three.md": stepDependingOn("Step 3: Three", "Depends on: 4"),
		"4-four.md":  stepDependingOn("Step 4: Four", "Depends on: 3"),
	})

	want := []string{
		": steps depend on each other in a cycle: 1 → 2 → 1; each step in it depends on the next",
		": steps depend on each other in a cycle: 3 → 4 → 3; each step in it depends on the next",
	}
	if diff := cmp.Diff(want, messages(plan)); diff != "" {
		t.Errorf("problems mismatch (-want +got):\n%s", diff)
	}
}

func TestReadPlanDoesNotReportADependencyOnAFileWithAnotherProblem(t *testing.T) {
	t.Parallel()

	tests := map[string]struct{ file, content, problem string }{
		"an empty file":   {file: "2-two.md", content: "", problem: "the file is empty"},
		"a missing title": {file: "2-two.md", content: "Just a paragraph.\n", problem: "missing the title heading"},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			plan := readSteps(t, map[string]string{
				"1-one.md": stepDependingOn("Step 1: One", "Depends on: 2"),
				tc.file:    tc.content,
			})

			wantProblem(t, plan, tc.file, tc.problem)
		})
	}
}

func TestReadPlanOrdersTheProblemsOfAGraphAndReadsThemTheSameEveryTime(t *testing.T) {
	t.Parallel()

	files := map[string]string{
		"1-one.md":   stepDependingOn("Step 1: One", "Depends on: 3, 9"),
		"3-three.md": "Depends on: nonsense\n",
		"4-four.md":  stepDependingOn("Step 4: Four", "Depends on: 1"),
		"5-five.md":  stepDependingOn("Step 5: Five", "Depends on: 5, 1"),
	}

	plan := readSteps(t, files)

	want := []string{
		"1-one.md: depends on step 9, which is not in the plan",
		`3-three.md: missing the title heading ("# Step N: Title")`,
		"5-five.md: depends on itself (step 5); remove 5 from its dependencies",
		": step numbers must be contiguous from 1; number 2 is missing",
	}
	if diff := cmp.Diff(want, messages(plan)); diff != "" {
		t.Errorf("problems mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff(plan, readSteps(t, files)); diff != "" {
		t.Errorf("a second read mismatch (-first +second):\n%s", diff)
	}
}

func TestReadPlanOrdersACycleAfterTheNumberingProblems(t *testing.T) {
	t.Parallel()

	plan := readSteps(t, map[string]string{
		"1-one.md":   stepDependingOn("Step 1: One", "Depends on: 3"),
		"3-three.md": stepDependingOn("Step 3: Three", "Depends on: 1, 8"),
	})

	want := []string{
		"3-three.md: depends on step 8, which is not in the plan",
		": step numbers must be contiguous from 1; number 2 is missing",
		": steps depend on each other in a cycle: 1 → 3 → 1; each step in it depends on the next",
	}
	if diff := cmp.Diff(want, messages(plan)); diff != "" {
		t.Errorf("problems mismatch (-want +got):\n%s", diff)
	}
}

func TestNextStep(t *testing.T) {
	t.Parallel()

	chain := []task.Step{{Number: 1}, {Number: 2, DependsOn: []int{1}}}
	graph := []task.Step{
		{Number: 1},
		{Number: 2},
		{Number: 3, DependsOn: []int{1, 2}},
		{Number: 4, DependsOn: []int{1}},
	}
	forward := []task.Step{{Number: 1, DependsOn: []int{2}}, {Number: 2}}
	cycle := []task.Step{
		{Number: 1},
		{Number: 2, DependsOn: []int{3}},
		{Number: 3, DependsOn: []int{2}},
	}

	tests := map[string]struct {
		steps []task.Step
		done  []int
		want  int
	}{
		"a chain with nothing done":      {steps: chain, want: 0},
		"a chain with the first done":    {steps: chain, done: []int{1}, want: 1},
		"a graph with nothing done":      {steps: graph, want: 0},
		"a graph with 1 done":            {steps: graph, done: []int{1}, want: 1},
		"a graph with 1 and 2 done":      {steps: graph, done: []int{1, 2}, want: 2},
		"a graph with 1, 2 and 3 done":   {steps: graph, done: []int{1, 2, 3}, want: 3},
		"a dependency on a later step":   {steps: forward, want: 1},
		"every step done":                {steps: graph, done: []int{1, 2, 3, 4}, want: -1},
		"no steps":                       {want: -1},
		"a cycle among the ones left":    {steps: cycle, done: []int{1}, want: 1},
		"a step ready beyond a cycle":    {steps: append(slices.Clone(cycle), task.Step{Number: 4}), done: []int{1}, want: 3},
		"a step ready before the others": {steps: graph, done: []int{2}, want: 0},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			done := func(number int) bool { return slices.Contains(tc.done, number) }
			if got := task.NextStep(tc.steps, done); got != tc.want {
				t.Errorf("NextStep() = %d, want %d", got, tc.want)
			}
		})
	}
}
