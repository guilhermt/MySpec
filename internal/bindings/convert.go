package bindings

import (
	"path/filepath"
	"time"

	"github.com/guilhermt/myspec/internal/attention"
	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/prompts"
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

// FromModelSet converts the choice of every stage, in the order the settings
// list them.
func FromModelSet(set models.Set) []StageModel {
	converted := make([]StageModel, len(models.Stages))
	for i, stage := range models.Stages {
		c := set[stage]
		converted[i] = StageModel{
			Stage:  string(stage),
			Model:  string(c.Model),
			Effort: string(c.Effort),
		}
	}
	return converted
}

// fromStageModels converts the models of the stages of a task, always
// returning a slice so the frontend never sees null.
func fromStageModels(states []flow.StageModelState) []TaskStageModel {
	converted := make([]TaskStageModel, len(states))
	for i, state := range states {
		converted[i] = TaskStageModel{
			Stage:    string(state.Stage),
			Model:    string(state.Choice.Model),
			Effort:   string(state.Choice.Effort),
			Editable: state.Editable,
			Live:     state.Live,
		}
	}
	return converted
}

// FromPrompt converts a prompt, allocating the placeholders so the frontend
// never sees null.
func FromPrompt(p prompts.Prompt) Prompt {
	placeholders := make([]string, len(p.Placeholders))
	copy(placeholders, p.Placeholders)
	return Prompt{
		Stage:        string(p.Stage),
		Text:         p.Text,
		Modified:     p.Modified,
		Placeholders: placeholders,
	}
}

// FromTasks converts the tasks of the open workspace, pairing each with the
// artifacts of its folder, the state of its steps, the summary of its session
// when there is one and the situations it waits on the user for, by task id. A
// nil map of situations counts as none for every task.
func FromTasks(
	tasks []task.Task,
	artifacts func(id string) task.Artifacts,
	steps func(id string) []flow.StepState,
	repos func(id string) []flow.RepoState,
	summaries map[session.Key]session.Summary,
	situations map[string][]attention.Situation,
) []TaskSummary {
	converted := make([]TaskSummary, len(tasks))
	for i, t := range tasks {
		a := artifacts(t.ID)
		states := steps(t.ID)
		repoStates := repos(t.ID)
		summary := summaries[taskSessionKey(t, states)]
		if summary.Status == "" {
			summary.Status = session.StatusWaiting
		}
		converted[i] = TaskSummary{
			ID:                 t.ID,
			Name:               t.Name,
			RepoPath:           t.RepoPath,
			Dir:                t.Dir(),
			Mode:               string(t.Mode),
			Stage:              string(t.Stage),
			Revisiting:         t.Revisiting,
			ReviewMode:         string(t.ReviewModes.Default()),
			ReviewModeEditable: flow.ReviewModeEditable(t, states),
			SessionStatus:      string(summary.Status),
			SessionModel:       string(summary.Choice.Model),
			SessionEffort:      string(summary.Choice.Effort),
			TurnRunning:        summary.TurnRunning,
			ProcessRunning:     summary.ProcessRunning,
			RetryAttempt:       summary.RetryAttempt,
			ContextPercent:     summary.ContextPercent,
			PendingCount:       summary.PendingCount,
			Corrections:        summary.Corrections,
			HasPRD:             a.PRD,
			HasTechSpec:        a.TechSpec,
			HasOneShot:         a.OneShot,
			Steps:              fromSteps(states),
			CurrentStep:        currentStep(states),
			Repos:              fromRepos(repoStates),
			PlanProblems:       fromProblems(a.Plan.Problems),
			Situations:         fromSituations(situations[t.ID]),
			Models:             fromStageModels(flow.StageModels(t, states, repoStates)),
			CanContinue:        t.Revisiting && a.Done(t.Stage) && summary.Idle,
			ArtifactVersion:    t.ArtifactVersion,
			LastError:          summary.LastError,
			CreatedAt:          t.CreatedAt.Format(time.RFC3339),
			UpdatedAt:          t.UpdatedAt.Format(time.RFC3339),
		}
	}
	return converted
}

// taskSessionKey is the session the task screen shows: the one of the stage
// the task is in, which in the implementation stage is the step that runs. The
// PR stage has none of its own — every conversation there belongs to a
// repository — and its fields stay empty.
func taskSessionKey(t task.Task, states []flow.StepState) session.Key {
	switch t.Stage {
	case task.StagePR:
		return session.Key{TaskID: t.ID}
	case task.StageImplementation:
		number := currentStep(states)
		if number == 0 {
			return session.Key{TaskID: t.ID}
		}
		return session.Key{TaskID: t.ID, Stage: session.StepStage(number)}
	default:
		return session.Key{TaskID: t.ID, Stage: string(t.Stage)}
	}
}

// fromRepos converts the repositories of a task in the PR stage, each with the
// session of its own, always returning a slice so the frontend never sees null.
func fromRepos(states []flow.RepoState) []RepoPR {
	converted := make([]RepoPR, len(states))
	for i, state := range states {
		summary := state.Session
		checkedAt := ""
		if !state.PR.CheckedAt.IsZero() {
			checkedAt = state.PR.CheckedAt.Format(time.RFC3339)
		}
		converted[i] = RepoPR{
			Repository:   state.Repository,
			RepoPath:     state.RepoPath,
			Slug:         state.Slug,
			Status:       string(state.Status),
			Block:        fromPRBlock(state.Block),
			WorktreePath: state.WorktreePath,
			Branch:       state.Branch,
			BaseBranch:   state.BaseBranch,

			Draft:        fromDraft(state.Draft, state.Slug),
			Reports:      fromReports(state.Reports),
			Review:       fromReview(state.Review),
			CommitFailed: state.CommitFailed,

			PRNumber:   state.PR.Number,
			PRURL:      state.PR.URL,
			PRState:    string(state.PR.State),
			CheckedAt:  checkedAt,
			PRBase:     state.PR.Base,
			CheckError: state.CheckError,
			CanClose:   state.CanClose,
			Close:      fromCloseResult(state.Close),

			SessionStage:   state.SessionStage,
			SessionStatus:  string(summary.Status),
			SessionModel:   string(summary.Choice.Model),
			SessionEffort:  string(summary.Choice.Effort),
			TurnRunning:    summary.TurnRunning,
			ProcessRunning: summary.ProcessRunning,
			RetryAttempt:   summary.RetryAttempt,
			ContextPercent: summary.ContextPercent,
			PendingCount:   summary.PendingCount,
			LastError:      summary.LastError,
		}
	}
	return converted
}

// fromCloseResult converts what closing a repository did, keeping nil for a
// repository that is not closed.
func fromCloseResult(result *task.CloseResult) *CloseResult {
	if result == nil {
		return nil
	}
	return &CloseResult{
		Worktree:     fromCloseStep(result.Worktree),
		Branch:       fromCloseStep(result.Branch),
		Base:         fromCloseStep(result.Base),
		WorktreePath: result.WorktreePath,
		BranchName:   result.BranchName,
		BaseBranch:   result.BaseBranch,
		BaseCommits:  result.BaseCommits,
		ClosedAt:     result.ClosedAt.Format(time.RFC3339),
	}
}

// fromCloseStep converts one part of the closing of a repository.
func fromCloseStep(step task.CloseStep) CloseStep {
	return CloseStep{Outcome: string(step.Outcome), Reason: step.Reason, Detail: step.Detail}
}

// FromArchived converts the tasks of the history, each with the artifacts of
// its folder and the pull requests it left behind. The slices are always
// allocated so the frontend never sees null.
func FromArchived(
	tasks []task.Task,
	artifacts func(id string) task.Artifacts,
	prRuns func(id string) []task.PRRun,
) []ArchivedTask {
	converted := make([]ArchivedTask, len(tasks))
	for i, t := range tasks {
		a := artifacts(t.ID)
		converted[i] = ArchivedTask{
			ID:              t.ID,
			Name:            t.Name,
			RepoPath:        t.RepoPath,
			Mode:            string(t.Mode),
			HasPRD:          a.PRD,
			HasTechSpec:     a.TechSpec,
			HasOneShot:      a.OneShot,
			Steps:           fromArchivedSteps(a.Plan.Steps, a.StepReports),
			Repos:           fromArchivedRepos(t, prRuns(t.ID)),
			ArtifactVersion: t.ArtifactVersion,
			CreatedAt:       t.CreatedAt.Format(time.RFC3339),
			ArchivedAt:      t.ArchivedAt.Format(time.RFC3339),
		}
	}
	return converted
}

// fromArchivedSteps converts the steps of the plan of an archived task, with
// the reports of their agent review, which the history renders and never runs.
func fromArchivedSteps(steps []task.Step, reports map[int][]task.ReviewReport) []ArchivedStep {
	converted := make([]ArchivedStep, len(steps))
	for i, step := range steps {
		converted[i] = ArchivedStep{
			Number:     step.Number,
			File:       step.File,
			Title:      step.Title,
			Repository: step.Repository,
			Reports:    fromStepReports(reports[step.Number]),
		}
	}
	return converted
}

// fromArchivedRepos converts the repositories an archived task touched, with
// the pull request of each one when there was one.
func fromArchivedRepos(t task.Task, runs []task.PRRun) []ArchivedRepo {
	converted := make([]ArchivedRepo, len(runs))
	for i, run := range runs {
		converted[i] = ArchivedRepo{
			Repository: relOf(t, run.RepoPath),
			RepoPath:   run.RepoPath,
			PRNumber:   run.PR.Number,
			PRURL:      run.PR.URL,
			PRState:    string(run.PR.State),
		}
	}
	return converted
}

// relOf is the repository as the steps name it: its path relative to the
// workspace of the task. The history builds its own, because reading a task
// nothing runs for any more is no business of the flow.
func relOf(t task.Task, repoPath string) string {
	rel, err := filepath.Rel(t.WorkspacePath, repoPath)
	if err != nil {
		return repoPath
	}
	return rel
}

// FromDeletePreview converts what deleting a task would destroy, allocating the
// slices so the frontend never sees null.
func FromDeletePreview(preview flow.DeletePreview) DeletePreview {
	worktrees := make([]WorktreePreview, len(preview.Worktrees))
	for i, wt := range preview.Worktrees {
		worktrees[i] = WorktreePreview{
			Repository: wt.Repository,
			RepoPath:   wt.RepoPath,
			Path:       wt.Path,
			Dirty:      wt.Dirty,
			Files:      wt.Files,
			Error:      wt.Error,
		}
	}
	branches := make([]BranchPreview, len(preview.Branches))
	for i, branch := range preview.Branches {
		branches[i] = BranchPreview{
			Repository: branch.Repository,
			RepoPath:   branch.RepoPath,
			Name:       branch.Name,
			Merged:     branch.Merged,
			Error:      branch.Error,
		}
	}
	prs := make([]PRPreview, len(preview.PRs))
	for i, pr := range preview.PRs {
		prs[i] = PRPreview{
			Repository: pr.Repository,
			RepoPath:   pr.RepoPath,
			Number:     pr.Number,
			URL:        pr.URL,
			State:      string(pr.State),
		}
	}
	return DeletePreview{
		SessionRunning: preview.SessionRunning,
		Worktrees:      worktrees,
		Branches:       branches,
		PRs:            prs,
	}
}

// FromDeleteResult converts what a deletion left on disk, always returning a
// slice so the frontend never sees null.
func FromDeleteResult(result flow.DeleteResult) DeleteResult {
	leftovers := make([]Leftover, len(result.Leftovers))
	for i, left := range result.Leftovers {
		leftovers[i] = Leftover{
			Repository: left.Repository,
			RepoPath:   left.RepoPath,
			Path:       left.Path,
			Branch:     left.Branch,
			Error:      left.Error,
		}
	}
	return DeleteResult{Leftovers: leftovers}
}

// fromPRBlock converts why the pull request of a repository cannot go on,
// keeping nil for one that can.
func fromPRBlock(block *task.PRBlock) *PRBlock {
	if block == nil {
		return nil
	}
	return &PRBlock{Reason: string(block.Reason), Detail: block.Detail}
}

// fromDraft converts the draft of a repository, keeping nil until one is
// written.
func fromDraft(draft *task.Draft, slug string) *PRDraft {
	if draft == nil {
		return nil
	}
	return &PRDraft{Title: draft.Title, Body: draft.Body, File: task.DraftFile(slug)}
}

// fromReports converts the passes of a review, always returning a slice so the
// frontend never sees null.
func fromReports(reports []task.ReviewReport) []PRReport {
	converted := make([]PRReport, len(reports))
	for i, report := range reports {
		converted[i] = PRReport{Pass: report.Pass, File: report.File, Clean: report.Clean}
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

			Model:         string(state.Choice.Model),
			Effort:        string(state.Choice.Effort),
			Adjusted:      state.Adjusted,
			ModelEditable: state.ModelEditable(),

			ReviewMode:         string(state.ReviewMode),
			ReviewModeAdjusted: state.ModeAdjusted,
			ReviewModeEditable: state.ModeEditable(),
			ReviewFallback:     string(state.Fallback),
			ReviewPass:         state.ReviewPass,
			ReviewRound:        state.ReviewRound,
			ReportMissing:      state.ReportMissing,
			Reports:            fromStepReports(state.Reports),
			Reviewer:           fromStepReviewer(state.ReviewerStage, state.Reviewer),
		}
	}
	return converted
}

// fromStepReports converts the passes of the agent review of a step, always
// returning a slice so the frontend never sees null.
func fromStepReports(reports []task.ReviewReport) []StepReport {
	converted := make([]StepReport, len(reports))
	for i, report := range reports {
		converted[i] = StepReport{Pass: report.Pass, File: report.File, Clean: report.Clean}
	}
	return converted
}

// fromStepReviewer converts the conversation that reviews a step, keeping nil
// for a step that has none open.
func fromStepReviewer(stage string, summary session.Summary) *StepReviewer {
	if stage == "" {
		return nil
	}
	return &StepReviewer{
		SessionStage:   stage,
		SessionStatus:  string(summary.Status),
		SessionModel:   string(summary.Choice.Model),
		SessionEffort:  string(summary.Choice.Effort),
		TurnRunning:    summary.TurnRunning,
		ProcessRunning: summary.ProcessRunning,
		RetryAttempt:   summary.RetryAttempt,
		ContextPercent: summary.ContextPercent,
		PendingCount:   summary.PendingCount,
		LastError:      summary.LastError,
	}
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

// FromSituation converts one situation.
func FromSituation(s attention.Situation) Situation {
	return Situation{
		ID:        s.ID,
		TaskID:    s.TaskID,
		Kind:      string(s.Kind),
		Group:     string(s.Kind.Group()),
		Form:      string(s.Form),
		Percent:   s.Percent,
		Place:     FromPlace(s.Place),
		StartedAt: s.StartedAt.Format(time.RFC3339),
	}
}

// FromPlace converts where a situation is.
func FromPlace(p attention.Place) Place {
	return Place{
		Kind:       string(p.Kind),
		Stage:      string(p.Stage),
		Step:       p.Step,
		RepoPath:   p.RepoPath,
		Repository: p.Repository,
	}
}

// FromStarted converts a situation that just started.
func FromStarted(started attention.Started) SituationStarted {
	return SituationStarted{Situation: FromSituation(started.Situation), Focused: started.Focused}
}

// fromSituations converts the situations of a task, always returning a slice
// so the frontend never sees null.
func fromSituations(list []attention.Situation) []Situation {
	converted := make([]Situation, len(list))
	for i, s := range list {
		converted[i] = FromSituation(s)
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
		Stage:   ev.Stage,
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
			Pass:      e.Marker.Pass,
			Clean:     e.Marker.Clean,
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
