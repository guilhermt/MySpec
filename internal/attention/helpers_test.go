package attention_test

import (
	"github.com/guilhermt/myspec/internal/attention"
	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
)

// The task every input is about, in a workspace with a repository api.
const (
	taskID    = "task-1"
	taskName  = "login-screen"
	workspace = "/home/u/code"
	apiPath   = workspace + "/api"
)

// summary is a session in a status, at rest or not.
func summary(status session.Status, idle bool) session.Summary {
	return session.Summary{TaskID: taskID, Status: status, Idle: idle}
}

// stageInput is the task in a planning stage with what its folder holds, and
// the session of the stage when one is given.
func stageInput(stage task.Stage, a task.Artifacts, sum ...session.Summary) attention.Input {
	in := attention.Input{
		Task:      task.Task{ID: taskID, Name: taskName, WorkspacePath: workspace, Stage: stage},
		Artifacts: a,
		Sessions:  map[session.Key]session.Summary{},
	}
	if len(sum) > 0 {
		in.Sessions[session.Key{TaskID: taskID, Stage: string(stage)}] = sum[0]
	}
	return in
}

// stepInput is the task in implementation with two steps of api: the first one
// committed and the second one in the state given, with the session of the
// second one when one is given.
func stepInput(second flow.StepState, sum ...session.Summary) attention.Input {
	second.Step = task.Step{Number: 2, File: "2-login-form.md", Title: "Login form", Repository: "api", RepoPath: apiPath}
	in := attention.Input{
		Task: task.Task{ID: taskID, Name: taskName, WorkspacePath: workspace, Stage: task.StageImplementation},
		Steps: []flow.StepState{
			{
				Step:   task.Step{Number: 1, File: "1-session-api.md", Title: "Session API", Repository: "api", RepoPath: apiPath},
				Status: flow.StepDone,
			},
			second,
		},
		Sessions: map[session.Key]session.Summary{},
	}
	if len(sum) > 0 {
		in.Sessions[session.Key{TaskID: taskID, Stage: session.StepStage(2)}] = sum[0]
	}
	return in
}

// repoInput is the task in the PR stage with the repositories given, in order.
func repoInput(repos ...flow.RepoState) attention.Input {
	return attention.Input{
		Task:     task.Task{ID: taskID, Name: taskName, WorkspacePath: workspace, Stage: task.StagePR},
		Repos:    repos,
		Sessions: map[session.Key]session.Summary{},
	}
}
