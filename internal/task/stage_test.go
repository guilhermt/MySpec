package task_test

import (
	"errors"
	"path/filepath"
	"slices"
	"testing"

	"github.com/guilhermt/myspec/internal/task"
)

func TestStagesAreTheWorkflowOrder(t *testing.T) {
	t.Parallel()

	want := []task.Stage{task.StagePRD, task.StageTechSpec, task.StagePlan, task.StageImplementation}
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

func TestStageIndex(t *testing.T) {
	t.Parallel()

	if got := task.StagePlan.Index(); got != 2 {
		t.Errorf("StagePlan.Index() = %d, want 2", got)
	}
	if got := task.Stage("nonsense").Index(); got != -1 {
		t.Errorf("Index() of an unknown stage = %d, want -1", got)
	}
}

func TestStageNext(t *testing.T) {
	t.Parallel()

	tests := []struct {
		stage task.Stage
		next  task.Stage
		ok    bool
	}{
		{task.StagePRD, task.StageTechSpec, true},
		{task.StageTechSpec, task.StagePlan, true},
		{task.StagePlan, task.StageImplementation, true},
		{task.StageImplementation, "", false},
		{"nonsense", "", false},
	}

	for _, test := range tests {
		next, ok := test.stage.Next()
		if next != test.next || ok != test.ok {
			t.Errorf("%q.Next() = %q, %t, want %q, %t", test.stage, next, ok, test.next, test.ok)
		}
	}
}

func TestStageHasSession(t *testing.T) {
	t.Parallel()

	tests := map[task.Stage]bool{
		task.StagePRD:            true,
		task.StageTechSpec:       true,
		task.StagePlan:           true,
		task.StageImplementation: false,
		"nonsense":               false,
	}

	for stage, want := range tests {
		if got := stage.HasSession(); got != want {
			t.Errorf("%q.HasSession() = %t, want %t", stage, got, want)
		}
	}
}

func TestStageFrom(t *testing.T) {
	t.Parallel()

	want := []task.Stage{task.StageTechSpec, task.StagePlan, task.StageImplementation}
	if got := task.StageTechSpec.From(); !slices.Equal(got, want) {
		t.Errorf("StageTechSpec.From() = %v, want %v", got, want)
	}
	if got := task.Stage("nonsense").From(); got != nil {
		t.Errorf("From() of an unknown stage = %v, want nil", got)
	}
}

func TestArtifactPaths(t *testing.T) {
	t.Parallel()

	tk := task.Task{ArtifactsDir: filepath.Join("/data", "tasks", "add-login")}

	tests := map[string]string{
		tk.PRDPath():      filepath.Join(tk.ArtifactsDir, "PRD.md"),
		tk.TechSpecPath(): filepath.Join(tk.ArtifactsDir, "tech-spec.md"),
		tk.StepsDir():     filepath.Join(tk.ArtifactsDir, "steps"),
	}
	for got, want := range tests {
		if got != want {
			t.Errorf("path = %q, want %q", got, want)
		}
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
				task.StagePlan: false, task.StageImplementation: true,
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
		task.ArtifactPlan:     true, // present even though it is not valid
		"nonsense":            false,
	}
	for kind, want := range tests {
		if got := artifacts.Has(kind); got != want {
			t.Errorf("Has(%q) = %t, want %t", kind, got, want)
		}
	}
}

func TestRepositoriesOfARootTaskAreTheWorkspaceOnes(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.repos = []string{
		filepath.Join(f.workspace, "web"),
		filepath.Join(f.workspace, "api"),
		filepath.Join(f.workspace, "libs", "ui"),
	}
	created := f.create(t, "add-login", "")

	want := []task.Repository{
		{Rel: "api", Path: filepath.Join(f.workspace, "api")},
		{Rel: filepath.Join("libs", "ui"), Path: filepath.Join(f.workspace, "libs", "ui")},
		{Rel: "web", Path: filepath.Join(f.workspace, "web")},
	}
	if got := f.service.Repositories(created); !slices.Equal(got, want) {
		t.Errorf("Repositories() = %+v, want %+v", got, want)
	}
}

func TestRepositoriesOfARepositoryTaskAreItsOwn(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", f.repos[0])

	want := []task.Repository{{Rel: "api", Path: f.repos[0]}}
	if got := f.service.Repositories(created); !slices.Equal(got, want) {
		t.Errorf("Repositories() = %+v, want %+v", got, want)
	}
}

func TestRepositoriesDropsWhatIsOutsideTheWorkspace(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	outside := filepath.Join(filepath.Dir(f.workspace), "elsewhere")
	f.repos = []string{filepath.Join(f.workspace, "api"), outside}
	created := f.create(t, "add-login", "")

	want := []task.Repository{{Rel: "api", Path: filepath.Join(f.workspace, "api")}}
	if got := f.service.Repositories(created); !slices.Equal(got, want) {
		t.Errorf("Repositories() = %+v, want %+v", got, want)
	}
	if f.logs.count(t, "repository outside the workspace") != 1 {
		t.Error("the dropped repository was not logged")
	}
}
