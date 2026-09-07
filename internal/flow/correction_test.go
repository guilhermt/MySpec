package flow

import (
	"strings"
	"testing"

	"github.com/guilhermt/myspec/internal/task"
)

func TestCorrectionMessage(t *testing.T) {
	t.Parallel()

	problems := []task.PlanProblem{
		{File: "1-first.md", Message: `repository "cli" is not one of the repositories of this task`},
		{File: "3-third.md", Message: `missing the title heading ("# Step N: Title")`},
		{Message: "step numbers must be contiguous from 1; number 2 is missing"},
	}
	repositories := []task.Repository{{Rel: "api", Path: "/w/api"}, {Rel: "web", Path: "/w/web"}}

	want := "The step files in `/data/task-1/steps` do not form a valid plan yet:\n" +
		"\n" +
		"- `1-first.md`: repository \"cli\" is not one of the repositories of this task\n" +
		"- `3-third.md`: missing the title heading (\"# Step N: Title\")\n" +
		"- (plan): step numbers must be contiguous from 1; number 2 is missing\n" +
		"\n" +
		"Valid values for `repository`: `api`, `web`.\n" +
		"\n" +
		"Rewrite the files in place so that every problem above is fixed, in a single response, " +
		"keeping the numbering contiguous from 1. Every file starts with the metadata header:\n" +
		"\n" +
		"---\n" +
		"repository: <one of the values above>\n" +
		"---\n" +
		"\n" +
		"Do not ask for confirmation."

	got := correctionMessage("/data/task-1/steps", problems, repositories)
	if got != want {
		t.Errorf("correctionMessage() =\n%s\n\nwant\n%s", got, want)
	}
}

func TestCorrectionMessageOfARepositoryTask(t *testing.T) {
	t.Parallel()

	problems := []task.PlanProblem{{File: "1-first.md", Message: `the metadata header has no "repository" field`}}
	got := correctionMessage("/data/task-1/steps", problems, []task.Repository{{Rel: "api", Path: "/w/api"}})

	want := "Valid values for `repository`: `api`.\n"
	if !strings.Contains(got, want) {
		t.Errorf("correctionMessage() =\n%s\n\nwant a line with %s", got, want)
	}
}
