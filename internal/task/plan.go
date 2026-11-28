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

	"github.com/guilhermt/myspec/internal/frontmatter"
)

// Step is one step file of a plan.
type Step struct {
	Number int
	File   string // file name inside steps/
	Title  string
	// DependsOn are the steps this one waits for, by number, ascending and
	// without repeats: the ones its file declares in a graph, the previous one
	// in a chain. A number the plan has no step file for, and the step's own,
	// are left out.
	DependsOn []int
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

// dependencyPattern matches one dependency of a "Depends on:" line: a step
// number, with or without a "step" word before it.
var dependencyPattern = regexp.MustCompile(`(?i)^(?:steps?\s+)?(\d+)$`)

// dependsOnLabel is the label of the line that declares what a step waits for.
const dependsOnLabel = "Depends on"

// The problems a step file may carry, as the agent reads them.
const (
	notAFileProblem      = "unexpected directory; only step files belong here"
	badNameProblem       = "unexpected file name; step files are named <number>-<short-description>.md"
	zeroNumberProblem    = "step numbers start at 1"
	emptyFileProblem     = "the file is empty"
	missingTitleProblem  = `missing the title heading ("# Step N: Title")`
	unreadableDirProblem = "cannot read the steps folder: "

	unreadableDependenciesProblem = `cannot read the dependencies %q; write "Depends on: none", or the numbers of the steps it depends on separated by commas, as in "Depends on: 1, 3"`
)

// ReadPlan reads the step files of dir. A missing folder is an absent plan,
// not an error.
func ReadPlan(dir string) Plan {
	// The folder is looked at first: on Windows, reading a file as a folder
	// finds an empty folder rather than an error.
	info, err := os.Stat(dir)
	switch {
	case errors.Is(err, os.ErrNotExist):
		return Plan{}
	case err != nil:
		return unreadablePlan(err.Error())
	case !info.IsDir():
		return unreadablePlan(dir + " is not a folder")
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return unreadablePlan(err.Error())
	}

	var plan Plan
	known := make(map[int]bool)
	graph := false
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

		known[number] = true

		content, err := os.ReadFile(filepath.Join(dir, name))
		if err != nil {
			plan.problem(name, "cannot read the file: "+err.Error())
			continue
		}
		if strings.TrimSpace(string(content)) == "" {
			plan.problem(name, emptyFileProblem)
			continue
		}

		step, declared, problems := parseStep(name, number, string(content))
		graph = graph || declared
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
	plan.Problems = append(plan.Problems, resolveDependencies(plan.Steps, known, graph)...)

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

// unreadablePlan is a plan whose folder could not be read, with why.
func unreadablePlan(why string) Plan {
	return Plan{Present: true, Problems: []PlanProblem{{Message: unreadableDirProblem + why}}}
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

// resolveDependencies sets the effective dependencies of steps, in place, and
// reports what is wrong with them. Without a "Depends on:" line in any file
// the plan is a chain, each step depending on the previous one. With one, each
// step depends on what its file declares, and the declarations are validated.
func resolveDependencies(steps []Step, known map[int]bool, graph bool) []PlanProblem {
	if !graph {
		for i := 1; i < len(steps); i++ {
			if steps[i-1].Number != steps[i].Number {
				steps[i].DependsOn = []int{steps[i-1].Number}
			}
		}
		return nil
	}

	var problems []PlanProblem
	for i := range steps {
		step := &steps[i]
		var kept []int
		for _, number := range step.DependsOn {
			switch {
			case number == step.Number:
				problems = append(problems, PlanProblem{
					File:    step.File,
					Message: fmt.Sprintf("depends on itself (step %d); remove %d from its dependencies", number, number),
				})
			case !known[number]:
				problems = append(problems, PlanProblem{
					File:    step.File,
					Message: fmt.Sprintf("depends on step %d, which is not in the plan", number),
				})
			default:
				kept = append(kept, number)
			}
		}
		step.DependsOn = kept
	}
	return append(problems, cycleProblems(steps)...)
}

// cycleProblems reports the cycles among the dependencies of steps, each once.
// A depth-first search finds them: every edge back to a step still on the
// stack closes one cycle, and removing those edges leaves no cycle.
func cycleProblems(steps []Step) []PlanProblem {
	edges := make(map[int][]int, len(steps))
	var numbers []int
	for _, step := range steps {
		if _, seen := edges[step.Number]; !seen {
			numbers = append(numbers, step.Number)
		}
		edges[step.Number] = append(edges[step.Number], step.DependsOn...)
	}
	for number, to := range edges {
		slices.Sort(to)
		edges[number] = slices.Compact(to)
	}

	const (
		unvisited = iota
		onStack
		finished
	)
	state := make(map[int]int, len(edges))
	var stack []int
	var problems []PlanProblem

	var visit func(number int)
	visit = func(number int) {
		state[number] = onStack
		stack = append(stack, number)
		for _, next := range edges[number] {
			switch state[next] {
			case unvisited:
				visit(next)
			case onStack:
				from := slices.Index(stack, next)
				problems = append(problems, cycleProblem(stack[from:]))
			}
		}
		stack = stack[:len(stack)-1]
		state[number] = finished
	}
	for _, number := range numbers {
		if state[number] == unvisited {
			visit(number)
		}
	}
	return problems
}

// cycleProblem is the problem of the steps of one cycle, each depending on the
// next, written from the lowest number and closed on it.
func cycleProblem(cycle []int) PlanProblem {
	lowest := slices.Index(cycle, slices.Min(cycle))
	ordered := append(slices.Clone(cycle[lowest:]), cycle[:lowest]...)
	ordered = append(ordered, ordered[0])

	parts := make([]string, len(ordered))
	for i, number := range ordered {
		parts[i] = strconv.Itoa(number)
	}
	return PlanProblem{Message: fmt.Sprintf(
		"steps depend on each other in a cycle: %s; each step in it depends on the next",
		strings.Join(parts, " → "),
	)}
}

// NextStep is the index in steps of the step that runs or runs next: the
// lowest-numbered one not done whose dependencies are all done. Steps that
// are left and all wait on one another, which only an invalid plan has, give
// the lowest-numbered one not done, so that a plan never passes for finished
// while a step is left. It is -1 when every step is done.
func NextStep(steps []Step, done func(number int) bool) int {
	firstLeft := -1
	for i, step := range steps {
		if done(step.Number) {
			continue
		}
		if firstLeft < 0 {
			firstLeft = i
		}
		if allDone(step.DependsOn, done) {
			return i
		}
	}
	return firstLeft
}

// allDone reports whether every step in numbers is done.
func allDone(numbers []int, done func(number int) bool) bool {
	return !slices.ContainsFunc(numbers, func(number int) bool { return !done(number) })
}

// parseStep reads the title and the dependencies of one step file, skipping a
// metadata header the agent may have left at the top. declared reports whether
// the file has a "Depends on:" line, readable or not. A file with problems is
// still a step, carrying what could be read, so that the list shows what is
// there.
func parseStep(name string, number int, content string) (step Step, declared bool, problems []PlanProblem) {
	step = Step{Number: number, File: name}

	_, body := frontmatter.Split(content)
	title, found := headingTitle(body)
	if !found {
		problems = append(problems, PlanProblem{File: name, Message: missingTitleProblem})
	}
	step.Title = title

	numbers, value, declared, ok := declaredDependencies(body)
	if declared && !ok {
		problems = append(problems, PlanProblem{File: name, Message: fmt.Sprintf(unreadableDependenciesProblem, value)})
	}
	step.DependsOn = numbers
	return step, declared, problems
}

// declaredDependencies reads the "Depends on:" line right below the title of
// a step file. found reports whether the file has the line at all; ok is false
// when the line is there but its value cannot be read, and value is then what
// it says.
func declaredDependencies(body string) (numbers []int, value string, found, ok bool) {
	afterTitle := false
	for line := range strings.Lines(body) {
		line = strings.TrimRight(line, "\r\n")
		if !afterTitle {
			afterTitle = headingPattern.MatchString(line)
			continue
		}
		if strings.HasPrefix(strings.TrimSpace(line), "#") {
			break
		}

		plain := strings.NewReplacer("**", "", "__", "").Replace(strings.TrimSpace(line))
		label, rest, isLabel := strings.Cut(plain, ":")
		if !isLabel || !strings.EqualFold(strings.TrimSpace(label), dependsOnLabel) {
			continue
		}
		value = strings.TrimSuffix(strings.TrimSpace(rest), ".")
		numbers, ok = parseDependencies(value)
		return numbers, value, true, ok
	}
	return nil, "", false, false
}

// parseDependencies reads the value of a "Depends on:" line: "none", or step
// numbers separated by commas. It is ascending and without repeats.
func parseDependencies(value string) (numbers []int, ok bool) {
	if strings.EqualFold(value, "none") {
		return nil, true
	}
	if value == "" {
		return nil, false
	}
	for piece := range strings.SplitSeq(value, ",") {
		match := dependencyPattern.FindStringSubmatch(strings.TrimSpace(piece))
		if match == nil {
			return nil, false
		}
		number, err := strconv.Atoi(match[1])
		if err != nil {
			return nil, false
		}
		numbers = append(numbers, number)
	}
	slices.Sort(numbers)
	return slices.Compact(numbers), true
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
