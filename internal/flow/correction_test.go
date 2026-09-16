package flow

import (
	"testing"

	"github.com/guilhermt/myspec/internal/task"
)

func TestCorrectionMessage(t *testing.T) {
	t.Parallel()

	problems := []task.PlanProblem{
		{File: "1-first.md", Message: `missing the title heading ("# Step N: Title")`},
		{File: "3-third.md", Message: "the file is empty"},
		{Message: "step numbers must be contiguous from 1; number 2 is missing"},
	}

	want := "The step files in `/data/task-1/steps` do not form a valid plan yet:\n" +
		"\n" +
		"- `1-first.md`: missing the title heading (\"# Step N: Title\")\n" +
		"- `3-third.md`: the file is empty\n" +
		"- (plan): step numbers must be contiguous from 1; number 2 is missing\n" +
		"\n" +
		"Rewrite the files in place so that every problem above is fixed, in a single response, " +
		"keeping the numbering contiguous from 1. Do not ask for confirmation."

	got := correctionMessage("/data/task-1/steps", problems)
	if got != want {
		t.Errorf("correctionMessage() =\n%s\n\nwant\n%s", got, want)
	}
}
