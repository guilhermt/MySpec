package bindings

import (
	"time"

	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
	"github.com/guilhermt/myspec/internal/workspace"
)

// FromWorkspace converts the open workspace, keeping nil for none.
func FromWorkspace(ws *workspace.Workspace) *Workspace {
	if ws == nil {
		return nil
	}

	repos := make([]Repo, len(ws.Repos))
	for i, repo := range ws.Repos {
		repos[i] = Repo{Name: repo.Name, Path: repo.Path}
	}
	return &Workspace{Name: ws.Name, Path: ws.Path, Repos: repos}
}

// FromRecents converts the recent workspaces, always returning a slice so the
// frontend never sees null.
func FromRecents(recents []workspace.Recent) []Recent {
	converted := make([]Recent, len(recents))
	for i, rec := range recents {
		converted[i] = Recent{Name: rec.Name, Path: rec.Path}
	}
	return converted
}

// FromNotice converts the current notice, keeping nil for none.
func FromNotice(notice *workspace.Notice) *Notice {
	if notice == nil {
		return nil
	}
	return &Notice{Path: notice.Path, Reason: string(notice.Reason)}
}

// FromTasks converts the tasks of the open workspace, pairing each with the
// artifacts of its folder, the state of its steps and the summary of its
// session when there is one.
func FromTasks(
	tasks []task.Task,
	artifacts func(id string) task.Artifacts,
	steps func(id string) []flow.StepState,
	summaries map[string]session.Summary,
) []TaskSummary {
	converted := make([]TaskSummary, len(tasks))
	for i, t := range tasks {
		summary := summaries[t.ID]
		a := artifacts(t.ID)
		states := steps(t.ID)
		if summary.Status == "" {
			summary.Status = session.StatusWaiting
		}
		converted[i] = TaskSummary{
			ID:              t.ID,
			Name:            t.Name,
			RepoPath:        t.RepoPath,
			Dir:             t.Dir(),
			Stage:           string(t.Stage),
			Revisiting:      t.Revisiting,
			SessionStatus:   string(summary.Status),
			TurnRunning:     summary.TurnRunning,
			ProcessRunning:  summary.ProcessRunning,
			RetryAttempt:    summary.RetryAttempt,
			ContextPercent:  summary.ContextPercent,
			PendingCount:    summary.PendingCount,
			Corrections:     summary.Corrections,
			HasPRD:          a.PRD,
			HasTechSpec:     a.TechSpec,
			Steps:           fromSteps(states),
			CurrentStep:     currentStep(states),
			PlanProblems:    fromProblems(a.Plan.Problems),
			CanContinue:     t.Revisiting && a.Done(t.Stage) && summary.Idle,
			ArtifactVersion: t.ArtifactVersion,
			LastError:       summary.LastError,
			CreatedAt:       t.CreatedAt.Format(time.RFC3339),
			UpdatedAt:       t.UpdatedAt.Format(time.RFC3339),
		}
	}
	return converted
}

// fromSteps converts the steps of a plan with their state, always returning a
// slice so the frontend never sees null.
func fromSteps(states []flow.StepState) []Step {
	converted := make([]Step, len(states))
	for i, state := range states {
		converted[i] = Step{
			Number:       state.Step.Number,
			File:         state.Step.File,
			Title:        state.Step.Title,
			Repository:   state.Step.Repository,
			RepoPath:     state.Step.RepoPath,
			Status:       string(state.Status),
			Phase:        string(state.Phase),
			Block:        fromBlock(state.Block),
			WorktreePath: state.WorktreePath,

			Review:        fromReview(state.Review),
			CommitSHA:     state.CommitSHA,
			CommitSubject: state.CommitSubject,
			CommitFailed:  state.CommitFailed,
		}
	}
	return converted
}

// fromReview converts the last reading of the worktree of a step, keeping nil
// for a step with no reading to show.
func fromReview(snap *review.Snapshot) *Review {
	if snap == nil {
		return nil
	}
	files := make([]ReviewFile, len(snap.Files))
	for i, file := range snap.Files {
		files[i] = ReviewFile{Path: file.Path, Kind: string(file.Kind), Staged: file.Staged}
	}
	return &Review{
		Files:   files,
		Staged:  snap.Staged,
		Total:   snap.Total,
		Percent: snap.Percent(),
		Error:   snap.Err,
	}
}

// fromBlock converts why a step is blocked, keeping nil for a step that is not.
func fromBlock(block *task.StepBlock) *StepBlock {
	if block == nil {
		return nil
	}
	return &StepBlock{Reason: string(block.Reason), Detail: block.Detail, Files: block.Files}
}

// currentStep is the number of the step that runs or runs next: the first one
// that is not done. It is 0 for a task with no steps and for one whose steps
// are all committed.
func currentStep(states []flow.StepState) int {
	for _, state := range states {
		if state.Status != flow.StepDone {
			return state.Step.Number
		}
	}
	return 0
}

// fromProblems converts the reasons a plan is not valid, always returning a
// slice so the frontend never sees null.
func fromProblems(problems []task.PlanProblem) []PlanProblem {
	converted := make([]PlanProblem, len(problems))
	for i, problem := range problems {
		converted[i] = PlanProblem{File: problem.File, Message: problem.Message}
	}
	return converted
}

// FromTranscript converts a whole conversation, always returning slices so the
// frontend never sees null.
func FromTranscript(tr session.Transcript) Transcript {
	return Transcript{
		TaskID:    tr.TaskID,
		SessionID: tr.SessionID,
		Stage:     tr.Stage,
		Entries:   fromEntries(tr.Entries),
		Pending:   fromEntries(tr.Pending),
	}
}

// FromTranscriptEvent converts one change to a conversation.
func FromTranscriptEvent(ev session.TranscriptEvent) TranscriptEvent {
	converted := TranscriptEvent{
		TaskID:  ev.TaskID,
		Kind:    string(ev.Kind),
		EntryID: ev.EntryID,
		Text:    ev.Text,
	}
	if ev.Entry != nil {
		entry := FromEntry(*ev.Entry)
		converted.Entry = &entry
	}
	return converted
}

// fromEntries converts a list of entries.
func fromEntries(entries []session.Entry) []Entry {
	converted := make([]Entry, len(entries))
	for i, e := range entries {
		converted[i] = FromEntry(e)
	}
	return converted
}

// FromEntry converts one entry with the payload matching its kind.
func FromEntry(e session.Entry) Entry {
	converted := Entry{
		ID:        e.ID,
		Seq:       e.Seq,
		TurnID:    e.TurnID,
		Kind:      string(e.Kind),
		CreatedAt: e.CreatedAt.Format(time.RFC3339),
	}
	if e.User != nil {
		converted.User = &UserEntry{
			Text:    e.User.Text,
			Pending: e.User.Pending,
			Prompt:  e.User.Prompt,
			App:     e.User.App,
		}
	}
	if e.Assistant != nil {
		converted.Assistant = &AssistantEntry{
			MessageID:   e.Assistant.MessageID,
			BlockIndex:  e.Assistant.BlockIndex,
			Text:        e.Assistant.Text,
			Complete:    e.Assistant.Complete,
			Interrupted: e.Assistant.Interrupted,
		}
	}
	if e.Action != nil {
		converted.Action = &ActionEntry{
			ToolUseID: e.Action.ToolUseID,
			Tool:      e.Action.Tool,
			Label:     e.Action.Label,
			Target:    e.Action.Target,
			Status:    string(e.Action.Status),
		}
	}
	if e.Permission != nil {
		converted.Permission = fromPermission(e.Permission)
	}
	if e.Question != nil {
		converted.Question = fromQuestion(e.Question)
	}
	if e.Marker != nil {
		converted.Marker = &MarkerEntry{
			Type:      string(e.Marker.Type),
			PreTokens: e.Marker.PreTokens,
			Stage:     e.Marker.Stage,
			Step:      e.Marker.Step,
			Restarted: e.Marker.Restarted,
		}
	}
	if e.Error != nil {
		converted.Error = &ErrorEntry{
			Kind:      string(e.Error.Kind),
			Message:   e.Error.Message,
			Retryable: e.Error.Retryable,
		}
	}
	return converted
}

// fromPermission converts a permission request, with its raw JSON as a string.
func fromPermission(p *session.PermissionEntry) *PermissionEntry {
	answeredAt := ""
	if p.AnsweredAt != nil {
		answeredAt = p.AnsweredAt.Format(time.RFC3339)
	}
	return &PermissionEntry{
		RequestID:           p.RequestID,
		ToolUseID:           p.ToolUseID,
		Tool:                p.Tool,
		DisplayName:         p.DisplayName,
		Description:         p.Description,
		Input:               string(p.Input),
		Suggestions:         string(p.Suggestions),
		BlockedPath:         p.BlockedPath,
		DecisionReason:      p.DecisionReason,
		SuppressAlwaysAllow: p.SuppressAlwaysAllow,
		DefaultToNo:         p.DefaultToNo,
		Status:              string(p.Status),
		DenyMessage:         p.DenyMessage,
		AnsweredAt:          answeredAt,
	}
}

// fromQuestion converts a structured question, allocating the slices so the
// frontend never sees null.
func fromQuestion(q *session.QuestionEntry) *QuestionEntry {
	questions := make([]Question, len(q.Questions))
	for i, question := range q.Questions {
		options := make([]QuestionOption, len(question.Options))
		for j, option := range question.Options {
			options[j] = QuestionOption{Label: option.Label, Description: option.Description}
		}
		questions[i] = Question{
			Question:    question.Question,
			Header:      question.Header,
			Options:     options,
			MultiSelect: question.MultiSelect,
		}
	}
	return &QuestionEntry{
		RequestID: q.RequestID,
		ToolUseID: q.ToolUseID,
		Questions: questions,
		Answers:   q.Answers,
		Status:    string(q.Status),
	}
}
