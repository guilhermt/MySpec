package bindings

import (
	"slices"
	"strings"
	"time"

	"github.com/guilhermt/myspec/internal/attention"
	"github.com/guilhermt/myspec/internal/board"
	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/pulls"
	"github.com/guilhermt/myspec/internal/repository"
	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/reviewflow"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
	"github.com/guilhermt/myspec/internal/theme"
	"github.com/guilhermt/myspec/internal/upgrade"
)

// FromRepositories converts the registered repositories, with what the last
// check found about each clone, whether a clone of it runs and how many tasks
// and reviews it holds. It always returns a slice so the frontend never sees
// null.
func FromRepositories(
	list []repository.Repository,
	missing func(id string) bool,
	counts func(id string) (int, int),
	reviews func(id string) (int, int),
	cloning func(id string) (bool, string),
) []Repository {
	converted := make([]Repository, len(list))
	for i, repo := range list {
		active, archived := counts(repo.ID)
		activeReviews, archivedReviews := reviews(repo.ID)
		running, cloneError := cloning(repo.ID)
		converted[i] = Repository{
			ID:            repo.ID,
			Owner:         repo.Owner,
			Name:          repo.Name,
			FullName:      repo.FullName(),
			Path:          repo.Path,
			Missing:       repo.Cloned() && missing(repo.ID),
			ActiveTasks:   active,
			ArchivedTasks: archived,
			Cloned:        repo.Cloned(),
			BoardID:       repo.BoardID,
			Cloning:       running,
			CloneError:    cloneError,

			ReviewInstructions: repo.ReviewInstructions,
			ActiveReviews:      activeReviews,
			ArchivedReviews:    archivedReviews,
		}
	}
	return converted
}

// FromCandidates converts the clones a scan found. It always returns a slice so
// the frontend never sees null.
func FromCandidates(list []repository.Candidate) []RepositoryCandidate {
	converted := make([]RepositoryCandidate, len(list))
	for i, candidate := range list {
		converted[i] = RepositoryCandidate{
			Owner:      candidate.Identity.Owner,
			Name:       candidate.Identity.Name,
			FullName:   candidate.Identity.FullName(),
			Path:       candidate.Path,
			Registered: candidate.Registered,
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
		Boards:        []Board{},
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
			Card:               fromTaskCard(t.Card),
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
			Card:            fromTaskCard(t.Card),
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

// FromReviewLeftover converts what deleting a review left on disk, keeping nil
// when git removed everything.
func FromReviewLeftover(left reviewflow.Leftover) DeleteResult {
	if left.WorktreePath == "" {
		return DeleteResult{}
	}
	return DeleteResult{Leftover: &Leftover{Path: left.WorktreePath}}
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

// What Start task does for a card, as BoardCard.Action names it.
const (
	actionStart        = "start"
	actionClone        = "clone"
	actionCloneMissing = "clone_missing"
	actionAddToBoard   = "add_to_board"
	actionOtherBoard   = "other_board"
	actionHasTask      = "has_task"
	actionClosed       = "closed"
)

// FromBoards converts the registered boards with their stored readings, the
// repositories each one manages and, for every card, the tasks created from it
// and what Start task does for it. The slices are always allocated so the
// frontend never sees null.
func FromBoards(
	boards []board.Board,
	stored func(id string) board.Stored,
	reading func(id string) bool,
	repositories []repository.Repository,
	missing func(id string) bool,
	cardTasks map[string]task.CardTaskIDs,
) []Board {
	boardsByID := make(map[string]board.Board, len(boards))
	for _, b := range boards {
		boardsByID[b.ID] = b
	}
	repositoriesByKey := make(map[string]repository.Repository, len(repositories))
	for _, repo := range repositories {
		repositoriesByKey[strings.ToLower(repo.FullName())] = repo
	}

	converted := make([]Board, len(boards))
	for i, b := range boards {
		s := stored(b.ID)
		repositoryIDs := []string{}
		for _, repo := range repositories {
			if repo.BoardID == b.ID {
				repositoryIDs = append(repositoryIDs, repo.ID)
			}
		}
		converted[i] = Board{
			ID:            b.ID,
			Owner:         b.Owner,
			OwnerType:     string(b.OwnerType),
			Number:        b.Number,
			Title:         b.Title,
			URL:           b.URL,
			Statuses:      []BoardStatus{},
			RepositoryIDs: repositoryIDs,
			Reading:       reading(b.ID),
			Failure:       fromBoardFailure(s.Failure, s.FailedAt),
			Cards:         []BoardCard{},
		}
		if s.Reading == nil {
			continue
		}
		converted[i].ReadAt = s.ReadAt.Format(time.RFC3339)
		converted[i].HasStatus = s.Reading.HasStatus
		converted[i].Viewer = s.Reading.Viewer
		converted[i].Statuses = fromStatusOptions(s.Reading.Statuses, b.FinalStatuses)
		cards := make([]BoardCard, len(s.Reading.Cards))
		for j, card := range s.Reading.Cards {
			cards[j] = fromBoardCard(b, card, repositoriesByKey, boardsByID, missing, cardTasks)
		}
		converted[i].Cards = cards
	}
	return converted
}

// fromBoardFailure converts why the last reading of a board failed, keeping nil
// for one that did not.
func fromBoardFailure(f *board.Failure, failedAt time.Time) *BoardFailure {
	if f == nil {
		return nil
	}
	return &BoardFailure{Reason: string(f.Reason), Message: f.Message(), FailedAt: failedAt.Format(time.RFC3339)}
}

// fromStatusOptions converts the options of the Status field of a board, final
// by the ids in finals.
func fromStatusOptions(options []board.Option, finals []string) []BoardStatus {
	converted := make([]BoardStatus, len(options))
	for i, o := range options {
		converted[i] = BoardStatus{ID: o.ID, Name: o.Name, Final: slices.Contains(finals, o.ID)}
	}
	return converted
}

// fromBoardCard converts one card of the board b, with its registered
// repository, the tasks created from it and what Start task does for it.
func fromBoardCard(
	b board.Board,
	card board.Card,
	repositoriesByKey map[string]repository.Repository,
	boardsByID map[string]board.Board,
	missing func(id string) bool,
	cardTasks map[string]task.CardTaskIDs,
) BoardCard {
	ids := cardTasks[card.Key()]
	repo, registered := repositoriesByKey[strings.ToLower(card.FullName())]
	converted := BoardCard{
		CardIssue:      fromCardIssue(card.Issue),
		Body:           card.Body,
		StatusID:       card.StatusID,
		Status:         card.Status,
		Final:          card.State == task.IssueClosed || slices.Contains(b.FinalStatuses, card.StatusID),
		Assignees:      fromAssignees(card.Assignees),
		Fields:         fromFields(card.Fields),
		PullRequests:   fromCardPullRequests(card.PullRequests),
		Siblings:       fromRelated(card.Siblings),
		Dependencies:   fromDependencies(card.Dependencies),
		ReadAt:         card.ReadAt.Format(time.RFC3339),
		SuggestedName:  board.SuggestName(card.Number, card.Title),
		ActiveTaskID:   ids.Active,
		ArchivedTaskID: ids.Archived,
	}
	if card.Epic != nil {
		epic := fromCardIssue(card.Epic.Issue)
		converted.Epic, converted.EpicBody = &epic, card.Epic.Body
	}
	if registered {
		converted.RepositoryID = repo.ID
	}
	converted.Action, converted.OtherBoard = cardAction(
		b, card, ids.Active, repo, registered, registered && missing(repo.ID), boardsByID,
	)
	return converted
}

// cardAction is what Start task does for a card of the board b, and the title
// of the board its repository belongs to when that is another one. The first
// that applies wins: a task of the card, the issue closed, the repository out
// of the board, no clone, the clone missing.
func cardAction(
	b board.Board,
	card board.Card,
	activeTaskID string,
	repo repository.Repository,
	registered, missing bool,
	boardsByID map[string]board.Board,
) (action, otherBoard string) {
	switch {
	case activeTaskID != "":
		return actionHasTask, ""
	case card.State == task.IssueClosed:
		return actionClosed, ""
	case !registered || repo.BoardID == "":
		return actionAddToBoard, ""
	case repo.BoardID != b.ID:
		return actionOtherBoard, boardsByID[repo.BoardID].Title
	case !repo.Cloned():
		return actionClone, ""
	case missing:
		return actionCloneMissing, ""
	default:
		return actionStart, ""
	}
}

// fromCardIssue converts an issue a board shows.
func fromCardIssue(i board.Issue) CardIssue {
	return CardIssue{
		Key:        i.Key(),
		Repository: i.FullName(),
		Number:     i.Number,
		Title:      i.Title,
		URL:        i.URL,
		State:      string(i.State),
	}
}

// fromAssignees converts the assignees of a card, always returning a slice so
// the frontend never sees null.
func fromAssignees(assignees []board.Assignee) []CardAssignee {
	converted := make([]CardAssignee, len(assignees))
	for i, a := range assignees {
		converted[i] = CardAssignee{Login: a.Login, AvatarURL: a.AvatarURL}
	}
	return converted
}

// fromFields converts the board fields of a card, always returning a slice so
// the frontend never sees null.
func fromFields(fields []board.Field) []CardField {
	converted := make([]CardField, len(fields))
	for i, f := range fields {
		converted[i] = CardField{Name: f.Name, Value: f.Value}
	}
	return converted
}

// fromCardPullRequests converts the pull requests linked to an issue, always
// returning a slice so the frontend never sees null.
func fromCardPullRequests(prs []board.PullRequest) []CardPullRequest {
	converted := make([]CardPullRequest, len(prs))
	for i, pr := range prs {
		converted[i] = CardPullRequest{
			Repository: pr.Owner + "/" + pr.Name,
			Number:     pr.Number,
			URL:        pr.URL,
			State:      string(pr.State),
		}
	}
	return converted
}

// fromRelated converts the issues next to a card, always returning a slice so
// the frontend never sees null.
func fromRelated(related []board.Related) []CardRelated {
	converted := make([]CardRelated, len(related))
	for i, r := range related {
		converted[i] = fromOneRelated(r)
	}
	return converted
}

// fromOneRelated converts one issue next to a card.
func fromOneRelated(r board.Related) CardRelated {
	return CardRelated{CardIssue: fromCardIssue(r.Issue), Status: r.Status, OnBoard: r.OnBoard}
}

// fromDependencies converts the issues a card depends on, always returning
// slices so the frontend never sees null.
func fromDependencies(dependencies []board.Dependency) []CardDependency {
	converted := make([]CardDependency, len(dependencies))
	for i, d := range dependencies {
		converted[i] = CardDependency{
			CardRelated:  fromOneRelated(d.Related),
			PullRequests: fromCardPullRequests(d.PullRequests),
			Satisfied:    d.Satisfied,
		}
	}
	return converted
}

// fromTaskCard converts the card a task was created from, keeping nil for a
// task without one.
func fromTaskCard(c *task.Card) *TaskCard {
	if c == nil {
		return nil
	}
	converted := &TaskCard{
		BoardID:    c.BoardID,
		Key:        c.Key(),
		Repository: c.Owner + "/" + c.Name,
		Number:     c.Number,
		Title:      c.Title,
		URL:        c.URL,
		Status:     c.Status,
		State:      string(c.State),
	}
	if e := c.Epic; e != nil {
		converted.Epic = &CardIssue{
			Key:        e.Key(),
			Repository: e.Owner + "/" + e.Name,
			Number:     e.Number,
			Title:      e.Title,
			URL:        e.URL,
		}
	}
	return converted
}

// FromBoardPreview converts what registering or editing a board shows before
// saving. The slices are always allocated so the frontend never sees null.
func FromBoardPreview(p board.Preview) BoardPreview {
	statuses := make([]BoardStatus, len(p.Statuses))
	for i, o := range p.Statuses {
		statuses[i] = BoardStatus{ID: o.ID, Name: o.Name, Final: o.Final}
	}
	repositories := make([]BoardRepositoryOption, len(p.Repositories))
	for i, o := range p.Repositories {
		repositories[i] = FromBoardRepositoryOption(o)
	}
	return BoardPreview{
		URL:          p.URL,
		Owner:        p.Owner,
		OwnerType:    string(p.OwnerType),
		Number:       p.Number,
		Title:        p.Title,
		HasStatus:    p.HasStatus,
		Statuses:     statuses,
		Repositories: repositories,
	}
}

// FromBoardRepositoryOption converts a repository the board dialog offers,
// allocating the clones so the frontend never sees null.
func FromBoardRepositoryOption(o board.RepositoryOption) BoardRepositoryOption {
	clones := make([]string, len(o.Clones))
	copy(clones, o.Clones)
	return BoardRepositoryOption{
		Owner:        o.Identity.Owner,
		Name:         o.Identity.Name,
		FullName:     o.Identity.FullName(),
		Cards:        o.Cards,
		Checked:      o.Checked,
		Link:         string(o.Link),
		RepositoryID: o.RepositoryID,
		Path:         o.Path,
		Clones:       clones,
		OtherBoard:   o.OtherBoard,
	}
}

// saveParamsOf converts what the user chose in the board dialog.
func saveParamsOf(req SaveBoardRequest) board.SaveParams {
	choices := make([]board.RepositoryChoice, len(req.Repositories))
	for i, c := range req.Repositories {
		choices[i] = repositoryChoiceOf(c)
	}
	finals := make([]string, len(req.FinalStatuses))
	copy(finals, req.FinalStatuses)
	return board.SaveParams{FinalStatuses: finals, Repositories: choices}
}

// repositoryChoiceOf converts a repository the user checked.
func repositoryChoiceOf(c BoardRepositoryChoice) board.RepositoryChoice {
	return board.RepositoryChoice{Owner: c.Owner, Name: c.Name, Path: c.Path}
}

// What the button of a pull request of the Reviews view does, as
// PullRequestRow.Action names it.
const (
	actionReview     = "review"
	actionOpenReview = "open_review"
	actionOpenTask   = "open_task"
	actionFork       = "fork"
)

// FromReviewCenter converts the last reading of the open pull requests of every
// registered repository into the Reviews view: every row with what the app
// knows about it, the repositories the reading failed for, and the authors and
// the labels the filters offer. repos are the converted repositories, taskPRs
// the pull requests the active tasks of the product own, reviews the active
// review of a pull request and cardOf the card one is linked to. The slices are
// always allocated so the frontend never sees null.
func FromReviewCenter(
	readings []pulls.RepositoryReading,
	reading bool,
	readAt time.Time,
	viewer string,
	filters pulls.Filters,
	repos []Repository,
	taskPRs []reviewflow.TaskPR,
	reviews func(repositoryID string, number int) (prreview.Review, bool),
	cardOf func(owner, name string, number int) (string, board.Card, bool),
) ReviewCenter {
	byID := make(map[string]Repository, len(repos))
	for _, repo := range repos {
		byID[repo.ID] = repo
	}
	center := ReviewCenter{
		PullRequests: []PullRequestRow{},
		Failures:     []PullsFailure{},
		Filters:      FromReviewFilters(filters),
		Authors:      []string{},
		Labels:       []string{},
		Reading:      reading,
	}
	if !readAt.IsZero() {
		center.ReadAt = readAt.Format(time.RFC3339)
	}
	sorted := make([]pullRow, 0, len(readings))
	for _, one := range readings {
		repo := byID[one.RepositoryID]
		if one.Failure != nil {
			center.Failures = append(center.Failures, PullsFailure{
				RepositoryID: one.RepositoryID,
				Repository:   repo.FullName,
				Message:      one.Failure.Message(),
			})
		}
		for _, pr := range one.PullRequests {
			row := fromPullRequestRow(pr, repo, viewer, filters, taskPRs, reviews, cardOf)
			if row.Pending && !row.Filtered {
				center.PendingCount++
			}
			center.Authors = addName(center.Authors, pr.Author)
			for _, label := range pr.Labels {
				center.Labels = addName(center.Labels, label.Name)
			}
			sorted = append(sorted, pullRow{row: row, updated: pr.UpdatedAt})
		}
	}
	sortNames(center.Authors)
	sortNames(center.Labels)
	center.PullRequests = orderedRows(sorted)
	return center
}

// pullRow is a row of the Reviews view next to the moment the pull request was
// last updated, which orders the rows before the times become text.
type pullRow struct {
	row     PullRequestRow
	updated time.Time
}

// orderedRows is the rows as the view lists them: the pending ones first, and
// then the most recently updated.
func orderedRows(rows []pullRow) []PullRequestRow {
	slices.SortStableFunc(rows, func(a, b pullRow) int {
		if a.row.Pending != b.row.Pending {
			if a.row.Pending {
				return -1
			}
			return 1
		}
		return b.updated.Compare(a.updated)
	})
	converted := make([]PullRequestRow, len(rows))
	for i, one := range rows {
		converted[i] = one.row
	}
	return converted
}

// fromPullRequestRow converts one open pull request with what the app knows
// about it: whose it is, whether it waits for the user, whether the filters
// hide it and what its button does.
func fromPullRequestRow(
	pr pulls.PullRequest,
	repo Repository,
	viewer string,
	filters pulls.Filters,
	taskPRs []reviewflow.TaskPR,
	reviews func(repositoryID string, number int) (prreview.Review, bool),
	cardOf func(owner, name string, number int) (string, board.Card, bool),
) PullRequestRow {
	labels := make([]PullLabel, len(pr.Labels))
	for i, label := range pr.Labels {
		labels[i] = PullLabel{Name: label.Name, Color: label.Color}
	}
	row := PullRequestRow{
		Key:          pr.Key(),
		RepositoryID: repo.ID,
		Repository:   repo.FullName,
		BoardID:      repo.BoardID,
		Number:       pr.Number,
		Title:        pr.Title,
		URL:          pr.URL,
		Author:       pr.Author,
		Labels:       labels,
		Draft:        pr.Draft,
		Own:          strings.EqualFold(pr.Author, viewer),
		Card:         fromPullCard(pr, cardOf),
		Reviewed:     pr.Reviewed,
		NewCommits:   pr.NewCommits(),
		TaskID:       taskOfPullRequest(taskPRs, repo.ID, pr.Number),
		UpdatedAt:    pr.UpdatedAt.Format(time.RFC3339),
	}
	if review, ok := reviews(repo.ID, pr.Number); ok {
		row.ReviewID = review.ID
	}
	row.Pending = pulls.Pending(pr, viewer, row.TaskID != "")
	row.Filtered = !filters.Match(pr, repo.ID, repo.BoardID, row.Pending)
	row.Action = rowAction(row, pr, repo)
	return row
}

// rowAction is what the button of a row does: a pull request the product
// already has an item for opens it, and one the app cannot review says why.
func rowAction(row PullRequestRow, pr pulls.PullRequest, repo Repository) string {
	switch {
	case row.TaskID != "":
		return actionOpenTask
	case row.ReviewID != "":
		return actionOpenReview
	case pr.Fork:
		return actionFork
	case !repo.Cloned:
		return actionClone
	case repo.Missing:
		return actionCloneMissing
	default:
		return actionReview
	}
}

// taskOfPullRequest is the task of the product that owns a pull request; ""
// when it belongs to none.
func taskOfPullRequest(taskPRs []reviewflow.TaskPR, repositoryID string, number int) string {
	for _, one := range taskPRs {
		if one.RepositoryID == repositoryID && one.Number == number {
			return one.TaskID
		}
	}
	return ""
}

// fromPullCard converts the card a pull request is linked to, keeping nil for
// one that is linked to none.
func fromPullCard(
	pr pulls.PullRequest, cardOf func(owner, name string, number int) (string, board.Card, bool),
) *PullCard {
	boardID, card, ok := cardOf(pr.Owner, pr.Name, pr.Number)
	if !ok {
		return nil
	}
	return &PullCard{
		BoardID: boardID,
		Number:  card.Number,
		Title:   card.Title,
		URL:     card.URL,
		Status:  card.Status,
	}
}

// FromReviewFilters converts the filters of the Reviews view, allocating every
// list so the frontend never sees null.
func FromReviewFilters(f pulls.Filters) ReviewFilters {
	return ReviewFilters{
		BoardID:        f.BoardID,
		RepositoryID:   f.RepositoryID,
		AuthorsInclude: names(f.AuthorsInclude),
		AuthorsExclude: names(f.AuthorsExclude),
		LabelsInclude:  names(f.LabelsInclude),
		LabelsExclude:  names(f.LabelsExclude),
		PendingOnly:    f.PendingOnly,
	}
}

// filtersOf converts the filters the frontend sent.
func filtersOf(f ReviewFilters) pulls.Filters {
	return pulls.Filters{
		BoardID:        f.BoardID,
		RepositoryID:   f.RepositoryID,
		AuthorsInclude: names(f.AuthorsInclude),
		AuthorsExclude: names(f.AuthorsExclude),
		LabelsInclude:  names(f.LabelsInclude),
		LabelsExclude:  names(f.LabelsExclude),
		PendingOnly:    f.PendingOnly,
	}
}

// names is a copy of a list of names that is never nil.
func names(list []string) []string {
	copied := make([]string, len(list))
	copy(copied, list)
	return copied
}

// addName adds a name to a list it is not already in, ignoring case.
func addName(list []string, value string) []string {
	if value == "" || slices.ContainsFunc(list, func(w string) bool { return strings.EqualFold(value, w) }) {
		return list
	}
	return append(list, value)
}

// sortNames orders a list of names alphabetically, ignoring case.
func sortNames(list []string) {
	slices.SortFunc(list, func(a, b string) int {
		return strings.Compare(strings.ToLower(a), strings.ToLower(b))
	})
}

// FromReviews converts the active reviews with the situations each one waits on
// the user for, by review id, and the converted repositories. A nil map of
// situations counts as none for every review. The slices are always allocated
// so the frontend never sees null.
func FromReviews(
	states []reviewflow.State, situations map[string][]attention.Situation, repos []Repository,
) []ReviewSummary {
	byID := make(map[string]Repository, len(repos))
	for _, repo := range repos {
		byID[repo.ID] = repo
	}
	converted := make([]ReviewSummary, len(states))
	for i, state := range states {
		stored := state.Review
		summary := state.Session
		if summary.Status == "" {
			summary.Status = session.StatusWaiting
		}
		sessionStage := ""
		if state.SessionOpen {
			sessionStage = session.ReviewStage
		}
		converted[i] = ReviewSummary{
			ID:               stored.ID,
			RepositoryID:     stored.RepositoryID,
			Repository:       byID[stored.RepositoryID].FullName,
			Number:           stored.Number,
			Title:            stored.Title,
			Author:           stored.Author,
			URL:              stored.URL,
			HeadBranch:       stored.HeadBranch,
			BaseBranch:       stored.BaseBranch,
			Own:              stored.Own,
			Mode:             string(stored.Mode),
			Status:           string(state.Status),
			Card:             fromReviewCard(stored.Card),
			WorktreePath:     state.WorktreePath,
			Passes:           fromPasses(state.Passes),
			StalePass:        state.StalePass,
			CheckError:       state.CheckError,
			PublishError:     stored.PublishError,
			UnreadableReport: state.UnreadableReport,
			CommitFailed:     state.CommitFailed,
			Review:           fromReview(state.Watch),
			Verdicts:         verdictsOf(stored),
			CanPublish:       canPublish(state),
			CanApply:         state.Status == reviewflow.StatusReadyToApply,
			CanApprove:       state.Status == reviewflow.StatusReadyToApprove,
			CanReviewAgain:   canReviewAgain(state),

			SessionStage:   sessionStage,
			SessionStatus:  string(summary.Status),
			SessionModel:   string(summary.Choice.Model),
			SessionEffort:  string(summary.Choice.Effort),
			TurnRunning:    summary.TurnRunning,
			ProcessRunning: summary.ProcessRunning,
			RetryAttempt:   summary.RetryAttempt,
			ContextPercent: summary.ContextPercent,
			PendingCount:   summary.PendingCount,
			LastError:      summary.LastError,
			Situations:     fromSituations(situations[stored.ID]),
			CreatedAt:      stored.CreatedAt.Format(time.RFC3339),
		}
	}
	return converted
}

// verdictsOf are the verdicts a review can be published with: a pull request of
// the user's own can only be commented on.
func verdictsOf(stored prreview.Review) []string {
	if stored.Own {
		return []string{string(prreview.VerdictComment)}
	}
	converted := make([]string, len(prreview.Verdicts))
	for i, verdict := range prreview.Verdicts {
		converted[i] = string(verdict)
	}
	return converted
}

// canPublish reports whether the review is the user's to publish now: a
// publication that failed can be tried again as long as nothing is undecided.
func canPublish(state reviewflow.State) bool {
	switch state.Status {
	case reviewflow.StatusReadyToPublish:
		return true
	case reviewflow.StatusPublishFailed:
		return lastRecordedPass(state.Passes).Decided()
	default:
		return false
	}
}

// canReviewAgain reports whether another pass can be asked for: the report of
// the pass the app asked for is in, the conversation is not working, and the
// agent is neither fixing the findings nor committing them. Changes waiting for
// the user's review do not hold a pass back, as on the pull request of a task.
func canReviewAgain(state reviewflow.State) bool {
	if state.Review.AskedPass != state.Review.ReportedPass {
		return false
	}
	if !state.Session.Idle && state.Session.Status != session.StatusPaused {
		return false
	}
	switch state.Status {
	case reviewflow.StatusApplying, reviewflow.StatusCommitting:
		return false
	default:
		return true
	}
}

// lastRecordedPass is the pass whose report was recorded last, the zero value
// when no report was recorded yet.
func lastRecordedPass(passes []prreview.Pass) prreview.Pass {
	for _, pass := range slices.Backward(passes) {
		if pass.Recorded {
			return pass
		}
	}
	return prreview.Pass{}
}

// FromArchivedReviews converts the reviews of the history, each with its passes
// and the repository it belongs to. The slices are always allocated so the
// frontend never sees null.
func FromArchivedReviews(
	list []prreview.Review, passes func(id string) []prreview.Pass, repos []Repository,
) []ArchivedReview {
	byID := make(map[string]Repository, len(repos))
	for _, repo := range repos {
		byID[repo.ID] = repo
	}
	converted := make([]ArchivedReview, len(list))
	for i, stored := range list {
		converted[i] = ArchivedReview{
			ID:           stored.ID,
			RepositoryID: stored.RepositoryID,
			Repository:   byID[stored.RepositoryID].FullName,
			Number:       stored.Number,
			Title:        stored.Title,
			Author:       stored.Author,
			URL:          stored.URL,
			Mode:         string(stored.Mode),
			Outcome:      string(stored.PRState),
			Card:         fromReviewCard(stored.Card),
			Passes:       fromPasses(passes(stored.ID)),
			CreatedAt:    stored.CreatedAt.Format(time.RFC3339),
			ArchivedAt:   stored.ArchivedAt.Format(time.RFC3339),
		}
	}
	return converted
}

// fromReviewCard converts the card the pull request under review is linked to,
// keeping nil for one that is linked to none.
func fromReviewCard(c *prreview.Card) *PullCard {
	if c == nil {
		return nil
	}
	return &PullCard{BoardID: c.BoardID, Number: c.Number, Title: c.Title, URL: c.URL, Status: c.Status}
}

// fromPasses converts the passes of a review, always returning a slice so the
// frontend never sees null.
func fromPasses(passes []prreview.Pass) []ReviewPass {
	converted := make([]ReviewPass, len(passes))
	for i, pass := range passes {
		converted[i] = ReviewPass{
			Pass:         pass.Number,
			File:         prreview.ReportFile(pass.Number),
			Recorded:     pass.Recorded,
			Clean:        pass.Clean,
			Instructions: pass.Instructions,
			Summary:      pass.Summary,
			Findings:     fromFindings(pass.Findings),
			Revision:     pass.Revision,
			Edited:       edited(pass),
			Published:    pass.Published(),
			Verdict:      string(pass.Verdict),
			PublishedURL: pass.PublishedURL,
		}
		if pass.Published() {
			converted[i].PublishedAt = pass.PublishedAt.Format(time.RFC3339)
		}
	}
	return converted
}

// edited tells whether the user left the summary or the text of a finding
// different from what the report has.
func edited(pass prreview.Pass) bool {
	if pass.Summary != pass.SummaryOriginal {
		return true
	}
	for _, finding := range pass.Findings {
		if finding.Text != finding.Original {
			return true
		}
	}
	return false
}

// fromFindings converts the findings of a pass, always returning a slice so the
// frontend never sees null.
func fromFindings(findings []prreview.Finding) []ReviewFinding {
	converted := make([]ReviewFinding, len(findings))
	for i, finding := range findings {
		converted[i] = ReviewFinding{
			Number:    finding.Number,
			Path:      finding.Path,
			Line:      finding.Line,
			Text:      finding.Text,
			Decision:  string(finding.Decision),
			Placement: string(finding.Placement),
		}
	}
	return converted
}
