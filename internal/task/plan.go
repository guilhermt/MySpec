package task

import (
	"cmp"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"strings"
)

// Step is one step file of a plan.
type Step struct {
	Number int
	File   string // file name inside steps/
	Title  string
}

// PlanProblem is one reason a plan is not valid.
type PlanProblem struct {
	File    string // "" for a problem of the plan as a whole
	Message string
}

// Plan is the steps folder as read from disk.
type Plan struct {
	Present  bool // the folder exists and has at least one entry that is not hidden
	Steps    []Step
	Problems []PlanProblem
}

// Valid reports whether the plan is present and has no problem.
func (p Plan) Valid() bool {
	return p.Present && len(p.Problems) == 0
}

// stepFilePattern is the name a step file must have: the position, then a
// short description in lowercase words joined by hyphens.
var stepFilePattern = regexp.MustCompile(`^(\d+)-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$`)

// headingPattern matches a Markdown heading line of any level's first form.
var headingPattern = regexp.MustCompile(`^#\s+(.+?)\s*$`)

// stepTitlePattern strips the position from a heading like "Step 3: Wire it".
var stepTitlePattern = regexp.MustCompile(`^Step\s+\d+\s*:\s*(.+)$`)

// The problems a step file may carry, as the agent reads them.
const (
	notAFileProblem      = "unexpected directory; only step files belong here"
	badNameProblem       = "unexpected file name; step files are named <number>-<short-description>.md"
	zeroNumberProblem    = "step numbers start at 1"
	emptyFileProblem     = "the file is empty"
	missingTitleProblem  = `missing the title heading ("# Step N: Title")`
	unreadableDirProblem = "cannot read the steps folder: "
)

// ReadPlan reads the step files of dir. A missing folder is an absent plan,
// not an error.
func ReadPlan(dir string) Plan {
	entries, err := os.ReadDir(dir)
	switch {
	case errors.Is(err, os.ErrNotExist):
		return Plan{}
	case err != nil:
		return Plan{Present: true, Problems: []PlanProblem{{Message: unreadableDirProblem + err.Error()}}}
	}

	var plan Plan
	for _, entry := range entries {
		name := entry.Name()
		if strings.HasPrefix(name, ".") {
			continue
		}
		plan.Present = true

		if entry.IsDir() {
			plan.problem(name, notAFileProblem)
			continue
		}
		match := stepFilePattern.FindStringSubmatch(name)
		if match == nil {
			plan.problem(name, badNameProblem)
			continue
		}
		number, err := strconv.Atoi(match[1])
		if err != nil {
			plan.problem(name, badNameProblem)
			continue
		}
		if number == 0 {
			plan.problem(name, zeroNumberProblem)
			continue
		}

		content, err := os.ReadFile(filepath.Join(dir, name))
		if err != nil {
			plan.problem(name, "cannot read the file: "+err.Error())
			continue
		}
		if strings.TrimSpace(string(content)) == "" {
			plan.problem(name, emptyFileProblem)
			continue
		}

		step, problems := parseStep(name, number, string(content))
		plan.Steps = append(plan.Steps, step)
		plan.Problems = append(plan.Problems, problems...)
	}
	if !plan.Present {
		return Plan{}
	}

	slices.SortFunc(plan.Steps, func(a, b Step) int {
		if a.Number != b.Number {
			return a.Number - b.Number
		}
		return strings.Compare(a.File, b.File)
	})
	plan.Problems = append(plan.Problems, numberingProblems(plan.Steps)...)

	// A problem of the plan as a whole belongs after the files it is about.
	slices.SortStableFunc(plan.Problems, func(a, b PlanProblem) int {
		switch {
		case a.File == b.File:
			return 0
		case a.File == "":
			return 1
		case b.File == "":
			return -1
		}
		return strings.Compare(a.File, b.File)
	})
	return plan
}

// problem records one reason the plan is not valid.
func (p *Plan) problem(file, message string) {
	p.Problems = append(p.Problems, PlanProblem{File: file, Message: message})
}

// numberingProblems reports the repeated and the missing step numbers of
// steps, which must run from 1 without a gap.
func numberingProblems(steps []Step) []PlanProblem {
	if len(steps) == 0 {
		return nil
	}

	var problems []PlanProblem
	seen := make(map[int]int, len(steps))
	highest := 0
	for _, step := range steps {
		seen[step.Number]++
		highest = max(highest, step.Number)
	}
	for number := 1; number <= highest; number++ {
		switch count := seen[number]; {
		case count == 0:
			problems = append(problems, PlanProblem{
				Message: fmt.Sprintf("step numbers must be contiguous from 1; number %d is missing", number),
			})
		case count > 1:
			problems = append(problems, PlanProblem{
				Message: fmt.Sprintf("step number %d is used by more than one file", number),
			})
		}
	}
	return problems
}

// parseStep reads the title of one step file, skipping a metadata header the
// agent may have left at the top. A file with problems is still a step,
// carrying what could be read, so that the list shows what is there.
func parseStep(name string, number int, content string) (Step, []PlanProblem) {
	step := Step{Number: number, File: name}
	var problems []PlanProblem

	_, body := splitFrontMatter(content)
	title, found := headingTitle(body)
	if !found {
		problems = append(problems, PlanProblem{File: name, Message: missingTitleProblem})
	}
	step.Title = title
	return step, problems
}

// headingTitle is the first heading of body, without the "Step N:" prefix the
// template gives it.
func headingTitle(body string) (title string, found bool) {
	for line := range strings.Lines(body) {
		match := headingPattern.FindStringSubmatch(strings.TrimRight(line, "\n"))
		if match == nil {
			continue
		}
		if step := stepTitlePattern.FindStringSubmatch(match[1]); step != nil {
			return strings.TrimSpace(step[1]), true
		}
		return match[1], true
	}
	return "", false
}

// oneShotTitleSuffix closes the title the One-Shot prompt gives the document,
// which the step does not repeat.
const oneShotTitleSuffix = " — One-Shot"

// OneShotPlan is the plan of a One-Shot task: one step, the document itself.
// A document not written yet is an absent plan.
func OneShotPlan(path, name string) Plan {
	content, err := os.ReadFile(path)
	if err != nil || len(content) == 0 {
		return Plan{}
	}

	heading, _ := headingTitle(string(content))
	step := Step{
		Number: 1,
		File:   OneShotFile,
		Title:  cmp.Or(strings.TrimSpace(strings.TrimSuffix(heading, oneShotTitleSuffix)), name),
	}
	return Plan{Present: true, Steps: []Step{step}}
}
