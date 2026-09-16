package flow

import (
	"fmt"
	"strings"

	"github.com/guilhermt/myspec/internal/task"
)

// planProblemSubject names a problem of the plan as a whole, which no file
// answers for.
const planProblemSubject = "(plan)"

// correctionInstructions close the correction message: what the agent has to
// do about the problems above it.
const correctionInstructions = "Rewrite the files in place so that every problem above is fixed, " +
	"in a single response, keeping the numbering contiguous from 1. Do not ask for confirmation."

// correctionMessage is what the app tells the plan agent when the step files
// are not a valid plan.
func correctionMessage(stepsDir string, problems []task.PlanProblem) string {
	var b strings.Builder
	fmt.Fprintf(&b, "The step files in `%s` do not form a valid plan yet:\n\n", stepsDir)

	for _, problem := range problems {
		subject := planProblemSubject
		if problem.File != "" {
			subject = "`" + problem.File + "`"
		}
		fmt.Fprintf(&b, "- %s: %s\n", subject, problem.Message)
	}

	b.WriteString("\n")
	b.WriteString(correctionInstructions)
	return b.String()
}
