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
	"github.com/guilhermt/myspec/internal/repository"
	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
	"github.com/guilhermt/myspec/internal/theme"
	"github.com/guilhermt/myspec/internal/upgrade"
)

// FromRepositories converts the registered repositories, with what the last
// check found about each clone, whether a clone of it runs and how many tasks
// it holds. It always returns a slice so the frontend never sees null.
func FromRepositories(
	list []repository.Repository,
	missing func(id string) bool,
	counts func(id string) (int, int),
	cloning func(id string) (bool, string),
) []Repository {
	converted := make([]Repository, len(list))
	for i, repo := range list {
		active, archived := counts(repo.ID)
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
