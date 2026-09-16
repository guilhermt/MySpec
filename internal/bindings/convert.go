package bindings

import (
	"time"

	"github.com/guilhermt/myspec/internal/attention"
	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/repository"
	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
	"github.com/guilhermt/myspec/internal/theme"
	"github.com/guilhermt/myspec/internal/upgrade"
)

// FromRepositories converts the registered repositories, with what the last
// check found about each clone and how many tasks it holds. It always returns a
// slice so the frontend never sees null.
func FromRepositories(
	list []repository.Repository,
	missing func(id string) bool,
	counts func(id string) (int, int),
) []Repository {
	converted := make([]Repository, len(list))
	for i, repo := range list {
		active, archived := counts(repo.ID)
		converted[i] = Repository{
			ID:            repo.ID,
			Owner:         repo.Owner,
			Name:          repo.Name,
			FullName:      repo.FullName(),
			Path:          repo.Path,
			Missing:       missing(repo.ID),
			ActiveTasks:   active,
			ArchivedTasks: archived,
		}
	}
	return converted
}

// FromMigration converts the cases a refused migration listed, so that the
// screen can say what to resolve and where.
func FromMigration(refused *upgrade.RefusedError) *Migration {
	cases := make([]MigrationCase, len(refused.Cases))
	for i, c := range refused.Cases {
		tasks := make([]MigrationTask, len(c.Entries))
		for j, entry := range c.Entries {
			tasks[j] = MigrationTask{Name: entry.Task, Workspace: entry.Workspace, Path: entry.Path}
		}
		cases[i] = MigrationCase{
			Kind:       string(c.Kind),
			Repository: c.Repository,
			Detail:     c.Detail,
			Tasks:      tasks,
		}
	}
	return &Migration{Cases: cases}
}

// RefusedState is the whole state of an app whose data could not be migrated:
// the cases to resolve and nothing of the product, which never opened.
func RefusedState(refused *upgrade.RefusedError) State {
	return State{
		Migration:     FromMigration(refused),
		Repositories:  []Repository{},
		Theme:         string(theme.System),
		ModelDefaults: []StageModel{},
		Tasks:         []TaskSummary{},
		History:       []ArchivedTask{},
	}
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

// FromTasks converts the active tasks, pairing each with the artifacts of its
// folder, the state of its steps, its pull request, its repository, the summary
// of its session when there is one and the situations it waits on the user for,
// by task id. A nil map of situations counts as none for every task.
func FromTasks(
	tasks []task.Task,
	artifacts func(id string) task.Artifacts,
	steps func(id string) []flow.StepState,
	prs func(id string) (flow.PullRequest, bool),
	repositories func(id string) (repository.Repository, bool),
	summaries map[session.Key]session.Summary,
	situations map[string][]attention.Situation,
) []TaskSummary {
	converted := make([]TaskSummary, len(tasks))
	for i, t := range tasks {
		a := artifacts(t.ID)
		states := steps(t.ID)
		pr, hasPR := prs(t.ID)
		var prPointer *flow.PullRequest
		if hasPR {
			prPointer = &pr
		}
		fullName := ""
		if repo, ok := repositories(t.RepositoryID); ok {
			fullName = repo.FullName()
		}
		summary := summaries[taskSessionKey(t, states)]
		if summary.Status == "" {
			summary.Status = session.StatusWaiting
		}
		converted[i] = TaskSummary{
			ID:                 t.ID,
			Name:               t.Name,
			RepositoryID:       t.RepositoryID,
			Repository:         fullName,
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
			PR:                 fromPullRequest(prPointer),
			PlanProblems:       fromProblems(a.Plan.Problems),
			Situations:         fromSituations(situations[t.ID]),
			Models:             fromStageModels(flow.StageModels(t, states, prPointer)),
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
// PR stage has none of its own — its conversations belong to the pull request —
// and its fields stay empty.
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

// fromPullRequest converts the PR stage of a task with its conversation,
// keeping nil for a task that is not in it.
func fromPullRequest(pr *flow.PullRequest) *PullRequest {
	if pr == nil {
		return nil
	}
	summary := pr.Session
	checkedAt := ""
	if !pr.PR.CheckedAt.IsZero() {
		checkedAt = pr.PR.CheckedAt.Format(time.RFC3339)
	}
	return &PullRequest{
		Status:       string(pr.Status),
		Block:        fromPRBlock(pr.Block),
		WorktreePath: pr.WorktreePath,
		Branch:       pr.Branch,
		BaseBranch:   pr.BaseBranch,

		Draft:        fromDraft(pr.Draft),
		Reports:      fromReports(pr.Reports),
		Review:       fromReview(pr.Review),
		CommitFailed: pr.CommitFailed,

		PRNumber:     pr.PR.Number,
		PRURL:        pr.PR.URL,
		PRState:      string(pr.PR.State),
		CheckedAt:    checkedAt,
		PRBase:       pr.PR.Base,
		CheckError:   pr.CheckError,
		CanClose:     pr.CanClose,
		CloneMissing: pr.CloneMissing,
		Close:        fromCloseResult(pr.Close),

		SessionStage:   pr.SessionStage,
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

// fromCloseResult converts what closing a task did, keeping nil for a task that
// is not closed.
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

// fromCloseStep converts one part of the closing of a task.
func fromCloseStep(step task.CloseStep) CloseStep {
	return CloseStep{Outcome: string(step.Outcome), Reason: step.Reason, Detail: step.Detail}
}

// FromArchived converts the tasks of the history, each with the artifacts of
// its folder, its repository and the pull request it left behind. The slices
// are always allocated so the frontend never sees null.
func FromArchived(
	tasks []task.Task,
	artifacts func(id string) task.Artifacts,
	prRun func(id string) (task.PRRun, bool),
	repositories func(id string) (repository.Repository, bool),
) []ArchivedTask {
	converted := make([]ArchivedTask, len(tasks))
	for i, t := range tasks {
		a := artifacts(t.ID)
		fullName := ""
		if repo, ok := repositories(t.RepositoryID); ok {
			fullName = repo.FullName()
		}
		var pr *ArchivedPR
		if run, ok := prRun(t.ID); ok && run.PR.Number > 0 {
			pr = &ArchivedPR{Number: run.PR.Number, URL: run.PR.URL, State: string(run.PR.State)}
		}
		converted[i] = ArchivedTask{
			ID:              t.ID,
			Name:            t.Name,
			RepositoryID:    t.RepositoryID,
			Repository:      fullName,
			Mode:            string(t.Mode),
			HasPRD:          a.PRD,
			HasTechSpec:     a.TechSpec,
			HasOneShot:      a.OneShot,
			Steps:           fromArchivedSteps(a.Plan.Steps, a.StepReports),
			PR:              pr,
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
			Number:  step.Number,
			File:    step.File,
			Title:   step.Title,
			Reports: fromStepReports(reports[step.Number]),
		}
	}
	return converted
}

// FromDeletePreview converts what deleting a task would destroy, keeping nil
// for what it has none of.
func FromDeletePreview(preview flow.DeletePreview) DeletePreview {
	converted := DeletePreview{SessionRunning: preview.SessionRunning}
	if wt := preview.Worktree; wt != nil {
		converted.Worktree = &WorktreePreview{
			Path:  wt.Path,
			Dirty: wt.Dirty,
			Files: wt.Files,
			Error: wt.Error,
		}
	}
	if branch := preview.Branch; branch != nil {
		converted.Branch = &BranchPreview{Name: branch.Name, Merged: branch.Merged, Error: branch.Error}
	}
	if pr := preview.PR; pr != nil {
		converted.PR = &PRPreview{Number: pr.Number, URL: pr.URL, State: string(pr.State)}
	}
	return converted
}

// FromDeleteResult converts what a deletion left on disk, keeping nil when git
// removed everything.
func FromDeleteResult(result flow.DeleteResult) DeleteResult {
	if result.Leftover == nil {
		return DeleteResult{}
	}
	return DeleteResult{Leftover: &Leftover{
		Path:   result.Leftover.Path,
		Branch: result.Leftover.Branch,
		Error:  result.Leftover.Error,
	}}
}

// fromPRBlock converts why the pull request of a task cannot go on, keeping nil
// for one that can.
func fromPRBlock(block *task.PRBlock) *PRBlock {
	if block == nil {
		return nil
	}
	return &PRBlock{Reason: string(block.Reason), Detail: block.Detail}
}

// fromDraft converts the draft of a task, keeping nil until one is written.
func fromDraft(draft *task.Draft) *PRDraft {
	if draft == nil {
		return nil
	}
	return &PRDraft{Title: draft.Title, Body: draft.Body, File: task.DraftFile}
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
	return Place{Kind: string(p.Kind), Stage: string(p.Stage), Step: p.Step}
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
