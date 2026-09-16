package task_test

import (
	"errors"
	"path/filepath"
	"slices"
	"testing"

	"github.com/guilhermt/myspec/internal/task"
)

func TestStagesListEveryStageOfEitherMode(t *testing.T) {
	t.Parallel()

	want := []task.Stage{
		task.StagePRD, task.StageTechSpec, task.StagePlan, task.StageOneShot, task.StageImplementation, task.StagePR,
	}
	if !slices.Equal(task.Stages, want) {
		t.Errorf("Stages = %v, want %v", task.Stages, want)
	}
}

func TestParseStage(t *testing.T) {
	t.Parallel()

	for _, stage := range task.Stages {
		got, err := task.ParseStage(string(stage))
		if err != nil {
			t.Errorf("ParseStage(%q) = %v, want nil", stage, err)
		}
		if got != stage {
			t.Errorf("ParseStage(%q) = %q, want %q", stage, got, stage)
		}
	}

	for _, value := range []string{"", "prd_done", "PRD", "review"} {
		if _, err := task.ParseStage(value); !errors.Is(err, task.ErrUnknownStage) {
			t.Errorf("ParseStage(%q) = %v, want ErrUnknownStage", value, err)
		}
	}
}

func TestStageHasSession(t *testing.T) {
	t.Parallel()

	tests := map[task.Stage]bool{
		task.StagePRD:            true,
		task.StageTechSpec:       true,
		task.StagePlan:           true,
		task.StageOneShot:        true,
		task.StageImplementation: false,
		task.StagePR:             false,
		"nonsense":               false,
	}

	for stage, want := range tests {
		if got := stage.HasSession(); got != want {
			t.Errorf("%q.HasSession() = %t, want %t", stage, got, want)
		}
	}
}

func TestArtifactPaths(t *testing.T) {
	t.Parallel()

	tk := task.Task{ArtifactsDir: filepath.Join("/data", "tasks", "add-login")}

	tests := map[string]string{
		tk.PRDPath():      filepath.Join(tk.ArtifactsDir, "PRD.md"),
		tk.TechSpecPath(): filepath.Join(tk.ArtifactsDir, "tech-spec.md"),
		tk.OneShotPath():  filepath.Join(tk.ArtifactsDir, "one-shot.md"),
		tk.StepsDir():     filepath.Join(tk.ArtifactsDir, "steps"),
	}
	for got, want := range tests {
		if got != want {
			t.Errorf("path = %q, want %q", got, want)
		}
	}
}

func TestStepPathIsTheStepFileOrTheOneShotDocument(t *testing.T) {
	t.Parallel()

	dir := filepath.Join("/data", "tasks", "add-login")
	step := task.Step{Number: 1, File: "1-add-the-store.md"}

	tests := map[string]struct {
		mode task.Mode
		want string
	}{
		"structured": {mode: task.ModeStructured, want: filepath.Join(dir, "steps", "1-add-the-store.md")},
		"no mode":    {mode: "", want: filepath.Join(dir, "steps", "1-add-the-store.md")},
		"one-shot":   {mode: task.ModeOneShot, want: filepath.Join(dir, "one-shot.md")},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			tk := task.Task{Mode: tc.mode, ArtifactsDir: dir}
			if got := tk.StepPath(step); got != tc.want {
				t.Errorf("StepPath() = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestArtifactsDone(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		artifacts task.Artifacts
		want      map[task.Stage]bool
	}{
		{
			name:      "nothing written",
			artifacts: task.Artifacts{},
			want: map[task.Stage]bool{
				task.StagePRD: false, task.StageTechSpec: false,
				task.StagePlan: false, task.StageOneShot: false, task.StageImplementation: true,
			},
		},
		{
			name:      "the One-Shot document written",
			artifacts: task.Artifacts{OneShot: true, Plan: task.Plan{Present: true}},
			want: map[task.Stage]bool{
				task.StagePRD: false, task.StageOneShot: true, task.StageImplementation: true,
			},
		},
		{
			name:      "PRD and tech spec written",
			artifacts: task.Artifacts{PRD: true, TechSpec: true},
			want: map[task.Stage]bool{
				task.StagePRD: true, task.StageTechSpec: true, task.StagePlan: false,
			},
		},
		{
			name:      "the plan is there but broken",
			artifacts: task.Artifacts{Plan: task.Plan{Present: true, Problems: []task.PlanProblem{{Message: "broken"}}}},
			want:      map[task.Stage]bool{task.StagePlan: false},
		},
		{
			name:      "the plan is valid",
			artifacts: task.Artifacts{Plan: task.Plan{Present: true}},
			want:      map[task.Stage]bool{task.StagePlan: true},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			for stage, want := range test.want {
				if got := test.artifacts.Done(stage); got != want {
					t.Errorf("Done(%q) = %t, want %t", stage, got, want)
				}
			}
			if test.artifacts.Done("nonsense") {
				t.Error(`Done("nonsense") = true, want false`)
			}
		})
	}
}

func TestArtifactsHas(t *testing.T) {
	t.Parallel()

	artifacts := task.Artifacts{
		PRD:  true,
		Plan: task.Plan{Present: true, Problems: []task.PlanProblem{{Message: "broken"}}},
	}

	tests := map[task.ArtifactKind]bool{
		task.ArtifactPRD:      true,
		task.ArtifactTechSpec: false,
		task.ArtifactOneShot:  false,
		task.ArtifactPlan:     true, // present even though it is not valid
		"nonsense":            false,
	}
	for kind, want := range tests {
		if got := artifacts.Has(kind); got != want {
			t.Errorf("Has(%q) = %t, want %t", kind, got, want)
		}
	}

	if !(task.Artifacts{OneShot: true}).Has(task.ArtifactOneShot) {
		t.Error("Has(one_shot) = false, want true for a written One-Shot document")
	}
}
