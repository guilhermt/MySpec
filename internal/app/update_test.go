package app_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/app"
	"github.com/guilhermt/myspec/internal/session"
)

func TestWorkingOfKeepsOnlyTheSessionsThatWorkByItemAndStage(t *testing.T) {
	t.Parallel()
	summaries := map[session.Key]session.Summary{
		{TaskID: "b", Stage: "prd"}:    {Status: session.StatusWorking},
		{TaskID: "a", Stage: "step:3"}: {Status: session.StatusWorking},
		{TaskID: "a", Stage: "prd"}:    {Status: session.StatusWorking},
		{TaskID: "c", Stage: "prd"}:    {Status: session.StatusWaiting},
	}

	got := app.WorkingOf(summaries)

	want := []session.Key{{TaskID: "a", Stage: "prd"}, {TaskID: "a", Stage: "step:3"}, {TaskID: "b", Stage: "prd"}}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("WorkingOf() mismatch (-want +got):\n%s", diff)
	}
}

func TestWorkingOfNothingWorkingIsNil(t *testing.T) {
	t.Parallel()

	for name, summaries := range map[string]map[session.Key]session.Summary{
		"empty":       {},
		"all waiting": {{TaskID: "a", Stage: "prd"}: {Status: session.StatusWaiting}},
		"nil input":   nil,
	} {
		if got := app.WorkingOf(summaries); got != nil {
			t.Errorf("%s: WorkingOf() = %v, want nil", name, got)
		}
	}
}
