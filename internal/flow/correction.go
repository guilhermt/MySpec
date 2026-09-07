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
	"in a single response, keeping the numbering contiguous from 1. " +
	"Every file starts with the metadata header:\n\n" +
	"---\nrepository: <one of the values above>\n---\n\n" +
	"Do not ask for confirmation."

// correctionMessage is what the app tells the plan agent when the step files
// are not a valid plan.
func correctionMessage(stepsDir string, problems []task.PlanProblem, repos []task.Repository) string {
	var b strings.Builder
	fmt.Fprintf(&b, "The step files in `%s` do not form a valid plan yet:\n\n", stepsDir)

	for _, problem := range problems {
		subject := planProblemSubject
		if problem.File != "" {
			subject = "`" + problem.File + "`"
		}
		fmt.Fprintf(&b, "- %s: %s\n", subject, problem.Message)
	}

	values := make([]string, len(repos))
	for i, repo := range repos {
		values[i] = "`" + repo.Rel + "`"
	}
	fmt.Fprintf(&b, "\nValid values for `repository`: %s.\n\n", strings.Join(values, ", "))

	b.WriteString(correctionInstructions)
	return b.String()
}
