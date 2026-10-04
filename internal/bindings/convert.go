package bindings

import (
	"cmp"
	"crypto/sha256"
	"fmt"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/guilhermt/myspec/internal/attention"
	"github.com/guilhermt/myspec/internal/board"
	"github.com/guilhermt/myspec/internal/discussion"
	"github.com/guilhermt/myspec/internal/discussionflow"
	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/prreport"
	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/pulls"
	"github.com/guilhermt/myspec/internal/repository"
	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/reviewflow"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
	"github.com/guilhermt/myspec/internal/theme"
	"github.com/guilhermt/myspec/internal/upgrade"
	"github.com/guilhermt/myspec/internal/worktree"
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
// systemDark is what the desktop asked for before the window opened.
func RefusedState(refused *upgrade.RefusedError, systemDark bool) State {
	return State{
		Migration:     FromMigration(refused),
		Repositories:  []Repository{},
		Boards:        []Board{},
		Theme:         string(theme.System),
		SystemDark:    systemDark,
		ModelDefaults: []StageModel{},
		ModelFactory:  FromModelSet(models.Factory()),
		ModelCatalog:  ModelCatalog{Models: []CatalogModel{}},
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

// FromCatalog converts the catalog and why there is none, when there is none.
func FromCatalog(catalog models.Catalog, failure models.CatalogFailure) ModelCatalog {
	converted := make([]CatalogModel, len(catalog.Models))
	for i, m := range catalog.Models {
		efforts := make([]string, len(m.Efforts))
		for j, e := range m.Efforts {
			efforts[j] = string(e)
		}
		converted[i] = CatalogModel{Name: string(m.Name), Efforts: efforts}
	}
	return ModelCatalog{Models: converted, Failure: string(failure)}
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
		EditedAt:     formatEditedAt(p.EditedAt),
		Lines:        p.Lines,
		DefaultLines: p.DefaultLines,
	}
}

// FromListed converts the list of prompts, never nil.
func FromListed(listed []prompts.Listed) []PromptListing {
	converted := make([]PromptListing, len(listed))
	for i, l := range listed {
		converted[i] = PromptListing{Stage: string(l.Stage), Modified: l.Modified, EditedAt: formatEditedAt(l.EditedAt)}
	}
	return converted
}

// formatEditedAt is the time of an edit as RFC 3339, "" for the zero time.
func formatEditedAt(at time.Time) string {
	if at.IsZero() {
		return ""
	}
	return at.Format(time.RFC3339)
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
	worktrees func(id string) (worktree.Worktree, bool),
	conversations func(id string) []session.Conversation,
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
		var wt worktree.Worktree
		if found, ok := worktrees(t.ID); ok {
			wt = found
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
			RetryMax:           summary.RetryMax,
			RetryAt:            timeOrEmpty(summary.RetryAt),
			RetryReason:        summary.RetryReason,
			TurnFailed:         summary.TurnFailed,
			TurnStartedAt:      turnStart(summary),
			PausedAt:           pausedAt(summary),
			ActionLabel:        summary.ActionLabel,
			ActionTarget:       summary.ActionTarget,
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
			Conversations:      fromConversations(conversations(t.ID)),
			Branch:             wt.Branch,
			BaseBranch:         wt.Base,
			WorktreePath:       wt.Path,
			CanContinue:        t.Revisiting && a.Done(t.Stage) && summary.Idle,
			ArtifactVersion:    t.ArtifactVersion,
			LastError:          summary.LastError,
			CreatedAt:          t.CreatedAt.Format(time.RFC3339),
			UpdatedAt:          t.UpdatedAt.Format(time.RFC3339),
		}
	}
	return converted
}

// fromConversations converts the sessions of a task, never nil.
func fromConversations(list []session.Conversation) []TaskConversation {
	out := make([]TaskConversation, len(list))
	for i, c := range list {
		out[i] = TaskConversation{Stage: c.Stage, StartedAt: c.StartedAt.Format(time.RFC3339)}
	}
	return out
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

		Draft:            fromPRDraft(pr.Draft),
		Reports:          fromReports(pr.Reports, pr.Passes, pr.PR.URL),
		CurrentPass:      currentPassNumber(pr.Pass),
		UnreadableReport: pr.Unreadable,
		Review:           fromReview(pr.Review),
		CommitFailed:     pr.CommitFailed,

		PRNumber:     pr.PR.Number,
		PRURL:        pr.PR.URL,
		PRState:      string(pr.PR.State),
		CheckedAt:    checkedAt,
		PRBase:       pr.PR.Base,
		CheckError:   pr.CheckError,
		Trouble:      fromTrouble(pr.Trouble),
		Checks:       fromChecks(pr.PR.Checks),
		Mergeable:    string(pr.PR.Mergeable),
		MergedBy:     pr.PR.MergedBy,
		MergedAt:     timeOrEmpty(pr.PR.MergedAt),
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
		RetryMax:       summary.RetryMax,
		RetryAt:        timeOrEmpty(summary.RetryAt),
		RetryReason:    summary.RetryReason,
		TurnFailed:     summary.TurnFailed,
		TurnStartedAt:  turnStart(summary),
		PausedAt:       pausedAt(summary),
		ActionLabel:    summary.ActionLabel,
		ActionTarget:   summary.ActionTarget,
		ContextPercent: summary.ContextPercent,
		PendingCount:   summary.PendingCount,
		LastError:      summary.LastError,
	}
}

// fromTrouble converts what went wrong with a pull request, never with a nil
// list.
func fromTrouble(t gh.Trouble) PRTrouble {
	failed := make([]string, len(t.FailedChecks))
	copy(failed, t.FailedChecks)
	return PRTrouble{FailedChecks: failed, Conflict: t.Conflict}
}

// fromChecks converts the checks of the last reading, never nil.
func fromChecks(checks []gh.Check) []PRCheck {
	converted := make([]PRCheck, 0, len(checks))
	for _, c := range checks {
		converted = append(converted, PRCheck{
			Name:        c.Name,
			State:       string(c.State),
			Conclusion:  c.Conclusion,
			StartedAt:   timeOrEmpty(c.StartedAt),
			CompletedAt: timeOrEmpty(c.CompletedAt),
			URL:         c.URL,
		})
	}
	return converted
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

// ArchivedSources are where FromArchived reads an archived task from.
type ArchivedSources struct {
	Artifacts    func(id string) task.Artifacts
	PRRun        func(id string) (task.PRRun, bool)
	PRPasses     func(id string) []task.PRPass
	StepRuns     func(id string) []task.StepRun
	Repositories func(id string) (repository.Repository, bool)
}

// FromArchived converts the tasks of the history, each with the artifacts of
// its folder, its repository, the closing and the pull request it left behind.
// The slices are always allocated so the frontend never sees null.
func FromArchived(tasks []task.Task, sources ArchivedSources) []ArchivedTask {
	converted := make([]ArchivedTask, len(tasks))
	for i, t := range tasks {
		a := sources.Artifacts(t.ID)
		fullName := ""
		if repo, ok := sources.Repositories(t.RepositoryID); ok {
			fullName = repo.FullName()
		}
		var pr *ArchivedPR
		var closing *CloseResult
		run, hasRun := sources.PRRun(t.ID)
		if hasRun {
			closing = fromCloseResult(run.Close)
			if run.PR.Number > 0 {
				pr = &ArchivedPR{
					Number:   run.PR.Number,
					URL:      run.PR.URL,
					State:    string(run.PR.State),
					Base:     run.PR.Base,
					MergedBy: run.PR.MergedBy,
					MergedAt: timeOrEmpty(run.PR.MergedAt),
				}
			}
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
			Steps:           fromArchivedSteps(a.Plan.Steps, a.StepReports, sources.StepRuns(t.ID)),
			PR:              pr,
			ArtifactVersion: t.ArtifactVersion,
			CreatedAt:       t.CreatedAt.Format(time.RFC3339),
			ArchivedAt:      t.ArchivedAt.Format(time.RFC3339),
			Close:           closing,
			HasPRDraft:      a.PR.Draft.Present,
			PRReports:       fromArchivedPRReports(a.PR.Reports, sources.PRPasses(t.ID)),
		}
	}
	return converted
}

// fromArchivedSteps converts the steps of the plan of an archived task, with
// the reports of their agent review and the commit each one produced, which the
// history renders and never runs.
func fromArchivedSteps(
	steps []task.Step, reports map[int][]task.ReviewReport, runs []task.StepRun,
) []ArchivedStep {
	commits := make(map[int]string, len(runs))
	for _, run := range runs {
		commits[run.Number] = run.CommitSHA
	}
	converted := make([]ArchivedStep, len(steps))
	for i, step := range steps {
		converted[i] = ArchivedStep{
			Number:    step.Number,
			File:      step.File,
			Title:     step.Title,
			Reports:   fromStepReports(reports[step.Number]),
			CommitSHA: commits[step.Number],
		}
	}
	return converted
}

// fromArchivedPRReports converts the reports of the review of the pull request
// of an archived task, without their text. A pass the app recorded is
// structured and counts its findings; one that is only text does not.
func fromArchivedPRReports(reports []task.ReviewReport, passes []task.PRPass) []ArchivedPRReport {
	recorded := make(map[int]task.PRPass, len(passes))
	for _, pass := range passes {
		if pass.Recorded {
			recorded[pass.Pass] = pass
		}
	}
	converted := make([]ArchivedPRReport, len(reports))
	for i, report := range reports {
		converted[i] = ArchivedPRReport{Pass: report.Pass, File: report.File, Clean: report.Clean, Findings: -1}
		if pass, ok := recorded[report.Pass]; ok {
			converted[i].Structured = true
			converted[i].Findings = len(pass.Findings)
		}
	}
	return converted
}

// FromDeletePreview converts what deleting a task would destroy, keeping nil
// for what it has none of.
func FromDeletePreview(preview flow.DeletePreview) DeletePreview {
	converted := DeletePreview{}
	if wt := preview.Worktree; wt != nil {
		converted.Worktree = &WorktreePreview{
			Path:  wt.Path,
			Dirty: wt.Dirty,
			Files: wt.Files,
			Error: wt.Error,
		}
	}
	if branch := preview.Branch; branch != nil {
		converted.Branch = &BranchPreview{Name: branch.Name, Merged: branch.Merged, Ahead: branch.Ahead, Error: branch.Error}
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
	left := result.Leftover
	converted := &Leftover{RepoPath: left.RepoPath}
	if left.Path != "" {
		converted.Worktree = &LeftoverWorktree{
			Path: left.Path, Kept: left.PathKept, Error: left.PathError, Registered: left.PathRegistered,
		}
	}
	if left.Branch != "" {
		converted.Branch = &LeftoverBranch{Name: left.Branch, Kept: left.BranchKept, Error: left.BranchError}
	}
	return DeleteResult{Leftover: converted}
}

// FromReviewLeftover converts what deleting a review left on disk, keeping nil
// when git removed everything.
func FromReviewLeftover(left reviewflow.Leftover) DeleteResult {
	if left.WorktreePath == "" {
		return DeleteResult{}
	}
	return DeleteResult{Leftover: &Leftover{
		RepoPath: left.RepoPath,
		Worktree: &LeftoverWorktree{Path: left.WorktreePath, Kept: true, Error: left.Error, Registered: left.Registered},
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

// fromPRDraft converts the pull request draft of a task, keeping nil until one
// is written.
func fromPRDraft(draft *task.Draft) *PRDraft {
	if draft == nil {
		return nil
	}
	return &PRDraft{Title: draft.Title, Body: draft.Body, File: task.DraftFile}
}

// currentPassNumber is the number of the current structured pass, 0 when there
// is none.
func currentPassNumber(pass *task.PRPass) int {
	if pass == nil {
		return 0
	}
	return pass.Pass
}

// fromReports converts the passes of a review, one per number that has a report
// file or a recorded row, in ascending order. It always returns a slice so the
// frontend never sees null.
func fromReports(reports []task.ReviewReport, passes []task.PRPass, prURL string) []PRReport {
	byNumber := make(map[int]*PRReport, len(reports)+len(passes))
	for _, report := range reports {
		byNumber[report.Pass] = &PRReport{
			Pass: report.Pass, File: report.File, Clean: report.Clean, Findings: []ReviewFinding{},
		}
	}
	for _, pass := range passes {
		converted, ok := byNumber[pass.Pass]
		if !ok {
			converted = &PRReport{Pass: pass.Pass}
			byNumber[pass.Pass] = converted
		}
		if pass.Recorded {
			converted.Clean = pass.Clean
		}
		converted.Structured = true
		converted.Recorded = pass.Recorded
		converted.Findings = fromPRFindings(pass.Findings, prURL)
		converted.Revision = pass.Revision
		converted.Edited = editedPRPass(pass)
		converted.RecordedAt = timeOrEmpty(pass.RecordedAt)
		converted.SentAt = timeOrEmpty(pass.SentAt)
	}
	converted := make([]PRReport, 0, len(byNumber))
	for _, report := range byNumber {
		converted = append(converted, *report)
	}
	slices.SortFunc(converted, func(a, b PRReport) int { return cmp.Compare(a.Pass, b.Pass) })
	return converted
}

// editedPRPass tells whether the user decided a finding of the pass or changed
// its text.
func editedPRPass(pass task.PRPass) bool {
	return slices.ContainsFunc(pass.Findings, func(f prreport.Finding) bool {
		return f.Decision != prreport.DecisionNone || f.Text != f.Original
	})
}

// fromPRFindings converts the findings of a pass of a task, always returning a
// slice so the frontend never sees null.
func fromPRFindings(findings []prreport.Finding, prURL string) []ReviewFinding {
	converted := make([]ReviewFinding, len(findings))
	for i, finding := range findings {
		converted[i] = ReviewFinding{
			Number:   finding.Number,
			Title:    finding.Title,
			Path:     finding.Path,
			Line:     finding.Line,
			LineURL:  lineURL(prURL, finding),
			Text:     finding.Text,
			Decision: string(finding.Decision),
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
			Status:       string(state.Status),
			Phase:        string(state.Phase),
			Block:        fromBlock(state.Block),
			WorktreePath: state.WorktreePath,

			Review:        fromReview(state.Review),
			CommitSHA:     state.CommitSHA,
			CommitSubject: state.CommitSubject,
			CommittedAt:   timeOrEmpty(state.CommittedAt),
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
		converted[i] = StepReport{
			Pass: report.Pass, File: report.File, Clean: report.Clean, Findings: report.Findings,
		}
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
		RetryMax:       summary.RetryMax,
		RetryAt:        timeOrEmpty(summary.RetryAt),
		RetryReason:    summary.RetryReason,
		TurnFailed:     summary.TurnFailed,
		TurnStartedAt:  turnStart(summary),
		PausedAt:       pausedAt(summary),
		ActionLabel:    summary.ActionLabel,
		ActionTarget:   summary.ActionTarget,
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
		files[i] = ReviewFile{Path: file.Path, Kind: string(file.Kind), Staged: file.Staged, Partial: file.Partial}
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

// fromAction converts a tool call, with "" and -1 for what is unknown.
func fromAction(a *session.ActionEntry) *ActionEntry {
	converted := &ActionEntry{
		ToolUseID:       a.ToolUseID,
		Tool:            a.Tool,
		Label:           a.Label,
		Target:          a.Target,
		Status:          string(a.Status),
		Description:     a.Description,
		CommandLines:    a.CommandLines,
		ExitCode:        -1,
		ParentToolUseID: a.ParentToolUseID,
		OutputLines:     a.OutputLines,
		OutputTail:      a.OutputTail,
		OutputTruncated: a.OutputTruncated,
		InterruptedBy:   a.InterruptedBy,
	}
	// The times of an action keep their fractions: a command of 8.2s reads 8.2s, not 8s.
	if a.StartedAt != nil {
		converted.StartedAt = a.StartedAt.Format(time.RFC3339Nano)
	}
	if a.FinishedAt != nil {
		converted.FinishedAt = a.FinishedAt.Format(time.RFC3339Nano)
	}
	if a.ExitCode != nil {
		converted.ExitCode = *a.ExitCode
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

			Sent:      e.User.Sent,
			AppKind:   string(e.User.AppKind),
			AppPass:   e.User.AppPass,
			AppRound:  e.User.AppRound,
			AppRounds: e.User.AppRounds,
			AppCount:  e.User.AppCount,
		}
	}
	if e.Assistant != nil {
		converted.Assistant = &AssistantEntry{
			MessageID:       e.Assistant.MessageID,
			BlockIndex:      e.Assistant.BlockIndex,
			Text:            e.Assistant.Text,
			Complete:        e.Assistant.Complete,
			Interrupted:     e.Assistant.Interrupted,
			InterruptedBy:   e.Assistant.InterruptedBy,
			ParentToolUseID: e.Assistant.ParentToolUseID,
		}
	}
	if e.Action != nil {
		converted.Action = fromAction(e.Action)
	}
	if e.Permission != nil {
		converted.Permission = fromPermission(e.Permission)
	}
	if e.Question != nil {
		converted.Question = fromQuestion(e.Question)
	}
	if e.Marker != nil {
		converted.Marker = &MarkerEntry{
			Type:          string(e.Marker.Type),
			PreTokens:     e.Marker.PreTokens,
			Stage:         e.Marker.Stage,
			Step:          e.Marker.Step,
			Pass:          e.Marker.Pass,
			Clean:         e.Marker.Clean,
			Findings:      -1,
			Restarted:     e.Marker.Restarted,
			Percent:       e.Marker.Percent,
			Attempts:      e.Marker.Attempts,
			Reason:        e.Marker.Reason,
			InterruptedBy: e.Marker.InterruptedBy,
			SHA:           e.Marker.SHA,
			Subject:       e.Marker.Subject,
			Pushed:        e.Marker.Pushed,
			Number:        e.Marker.Number,
			Base:          e.Marker.Base,
			Passed:        e.Marker.Passed,
			Total:         e.Marker.Total,
			Failed:        names(e.Marker.Failed),
			Conflict:      e.Marker.Conflict,
			Title:         e.Marker.Title,
			Files:         e.Marker.Files,
			Problems:      fromMarkerProblems(e.Marker.Problems),
			Model:         e.Marker.Model,
			Effort:        e.Marker.Effort,
			Mode:          e.Marker.Mode,
			Approved:      e.Marker.Approved,
			Discarded:     e.Marker.Discarded,
			Verdict:       e.Marker.Verdict,
			Inline:        e.Marker.Inline,
			Body:          e.Marker.Body,
			Summary:       e.Marker.Summary,
			Minimal:       e.Marker.Minimal,
			URL:           e.Marker.URL,
			Commits:       fromMarkerCommits(e.Marker.Commits),
			Count:         e.Marker.Count,
			Board:         e.Marker.Board,
			Epics:         names(e.Marker.Epics),
			Round:         e.Marker.Round,
			First:         e.Marker.First,
			Changed:       e.Marker.Changed,
			Added:         e.Marker.Added,
			Dropped:       e.Marker.Dropped,
			Before:        fromDraftBefore(e.Marker.Before),
		}
		if e.Marker.Findings != nil {
			converted.Marker.Findings = *e.Marker.Findings
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
	answeredAt := ""
	if q.AnsweredAt != nil {
		answeredAt = timeOrEmpty(*q.AnsweredAt)
	}
	return &QuestionEntry{
		RequestID:  q.RequestID,
		ToolUseID:  q.ToolUseID,
		Questions:  questions,
		Answers:    q.Answers,
		Status:     string(q.Status),
		AnsweredAt: answeredAt,
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
// repositories each one manages and, for every card, the tasks created from it,
// the discussion that wrote it and what Start task does for it. The slices are always allocated so the
// frontend never sees null.
func FromBoards(
	boards []board.Board,
	stored func(id string) board.Stored,
	reading func(id string) bool,
	repositories []repository.Repository,
	missing func(id string) bool,
	cardTasks map[string]task.CardTaskIDs,
	writers map[string]discussion.Writer,
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
			NewCardStatus: b.NewCardStatus,
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
			cards[j] = fromBoardCard(b, card, repositoriesByKey, boardsByID, missing, cardTasks, writers)
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
	writers map[string]discussion.Writer,
) BoardCard {
	ids := cardTasks[card.Key()]
	repo, registered := repositoriesByKey[strings.ToLower(card.FullName())]
	converted := BoardCard{
		CardIssue:        fromCardIssue(card.Issue),
		Body:             card.Body,
		StatusID:         card.StatusID,
		Status:           card.Status,
		Final:            card.State == task.IssueClosed || slices.Contains(b.FinalStatuses, card.StatusID),
		Assignees:        fromAssignees(card.Assignees),
		Fields:           fromFields(card.Fields),
		PullRequests:     fromCardPullRequests(card.PullRequests),
		Siblings:         fromRelated(card.Siblings),
		Dependencies:     fromDependencies(card.Dependencies),
		ReadAt:           card.ReadAt.Format(time.RFC3339),
		SuggestedName:    board.SuggestName(card.Number, card.Title),
		ActiveTaskID:     ids.Active,
		ArchivedTaskID:   ids.Archived,
		ArchivedTaskName: ids.ArchivedName,
	}
	if card.Epic != nil {
		epic := fromCardIssue(card.Epic.Issue)
		converted.Epic, converted.EpicBody = &epic, card.Epic.Body
	}
	if writer, ok := writers[card.Key()]; ok {
		converted.WrittenBy = &WritingDiscussion{ID: writer.ID, Title: writer.Title, Archived: writer.Archived}
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
		URL:           p.URL,
		Owner:         p.Owner,
		OwnerType:     string(p.OwnerType),
		Number:        p.Number,
		Title:         p.Title,
		HasStatus:     p.HasStatus,
		Statuses:      statuses,
		NewCardStatus: p.NewCardStatus,
		Repositories:  repositories,

		GoneStatuses:      append([]string{}, p.GoneStatuses...),
		NewStatusIDs:      append([]string{}, p.NewStatusIDs...),
		NewCardStatusGone: p.NewCardStatusGone,
	}
}

// FromRemoval converts what removing a board does to its repositories. The
// slices are always allocated so the frontend never sees null.
func FromRemoval(r board.Removal) BoardRemoval {
	return BoardRemoval{
		ToNoBoard:      len(r.ToNoBoard),
		Removed:        len(r.Removed),
		ToNoBoardNames: append([]string{}, r.ToNoBoard...),
		RemovedNames:   append([]string{}, r.Removed...),
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
		Release:      string(o.Release),
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
	return board.SaveParams{
		FinalStatuses: finals,
		NewCardStatus: req.NewCardStatus,
		Repositories:  choices,
	}
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
				FailedAt:     timeOrEmpty(one.Failure.FailedAt),
			})
		}
		for _, pr := range one.PullRequests {
			row := fromPullRequestRow(pr, repo, viewer, filters, taskPRs, reviews, cardOf)
			if row.Pending && !row.Filtered && row.ReviewID == "" {
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
		Key:            pr.Key(),
		RepositoryID:   repo.ID,
		Repository:     repo.FullName,
		BoardID:        repo.BoardID,
		Number:         pr.Number,
		Title:          pr.Title,
		URL:            pr.URL,
		Author:         pr.Author,
		Labels:         labels,
		Draft:          pr.Draft,
		Own:            strings.EqualFold(pr.Author, viewer),
		Card:           fromPullCard(pr, cardOf),
		Reviewed:       pr.Reviewed,
		NewCommits:     pr.NewCommits(),
		TaskID:         taskOfPullRequest(taskPRs, repo.ID, pr.Number),
		UpdatedAt:      pr.UpdatedAt.Format(time.RFC3339),
		HeadBranch:     pr.HeadBranch,
		BaseBranch:     pr.BaseBranch,
		Body:           pr.Body,
		Checks:         fromChecks(pr.Checks.Checks),
		Mergeable:      string(pr.Checks.Mergeable),
		NewCommitCount: pr.NewCommitCount,
	}
	if pr.YourReview != nil {
		row.YourReview = &PullReview{State: pr.YourReview.State, At: timeOrEmpty(pr.YourReview.At)}
	}
	if review, ok := reviews(repo.ID, pr.Number); ok {
		row.ReviewID = review.ID
	}
	row.Pending = pulls.Pending(pr, viewer, row.TaskID != "")
	row.Filtered = !filters.Match(pr, repo.ID, repo.BoardID)
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
		BoardName:      f.BoardName,
		RepositoryName: f.RepositoryName,
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
		BoardName:      f.BoardName,
		RepositoryName: f.RepositoryName,
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
			Passes:           fromPasses(state.Passes, stored.URL),
			StalePass:        state.StalePass,
			CheckError:       state.CheckError,
			CheckErrorAt:     timeOrEmpty(state.CheckErrorAt),
			Checks:           fromChecks(state.Checks.Checks),
			Mergeable:        string(state.Checks.Mergeable),
			CheckedAt:        timeOrEmpty(state.CheckedAt),
			NewCommits:       state.NewCommits,
			StaleCommits:     state.StaleCommits,
			Trouble:          fromTrouble(stored.Trouble),
			PublishError:     stored.PublishError,
			PassBlocked:      state.PassBlocked,
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
			RetryMax:       summary.RetryMax,
			RetryAt:        timeOrEmpty(summary.RetryAt),
			RetryReason:    summary.RetryReason,
			TurnFailed:     summary.TurnFailed,
			TurnStartedAt:  turnStart(summary),
			PausedAt:       pausedAt(summary),
			ActionLabel:    summary.ActionLabel,
			ActionTarget:   summary.ActionTarget,
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
	if state.Status == reviewflow.StatusPassBlocked {
		return true
	}
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
			BaseBranch:   stored.BaseBranch,
			Card:         fromReviewCard(stored.Card),
			Passes:       fromPasses(passes(stored.ID), stored.URL),
			MergedBy:     stored.MergedBy,
			MergedAt:     timeOrEmpty(stored.MergedAt),
			ClosedAt:     timeOrEmpty(stored.ClosedAt),
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
func fromPasses(passes []prreview.Pass, prURL string) []ReviewPass {
	converted := make([]ReviewPass, len(passes))
	for i, pass := range passes {
		converted[i] = ReviewPass{
			Pass:         pass.Number,
			File:         prreview.ReportFile(pass.Number),
			Recorded:     pass.Recorded,
			Clean:        pass.Clean,
			Instructions: pass.Instructions,
			Summary:      pass.Summary,
			Findings:     fromFindings(pass.Findings, prURL),
			Revision:     pass.Revision,
			Edited:       edited(pass),
			Published:    pass.Published(),
			Verdict:      string(pass.Verdict),
			PublishedURL: pass.PublishedURL,

			Checks:           fromChecks(pass.Checks),
			Mergeable:        string(pass.Mergeable),
			ChecksReadAt:     timeOrEmpty(pass.ChecksReadAt),
			RecordedAt:       timeOrEmpty(pass.RecordedAt),
			SentAt:           timeOrEmpty(pass.SentAt),
			Sent:             !pass.SentAt.IsZero() || pass.Applied,
			SummaryPublished: pass.SummaryPublished,
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
func fromFindings(findings []prreview.Finding, prURL string) []ReviewFinding {
	converted := make([]ReviewFinding, len(findings))
	for i, finding := range findings {
		converted[i] = ReviewFinding{
			Number:    finding.Number,
			Title:     finding.Title,
			Path:      finding.Path,
			Line:      finding.Line,
			LineURL:   lineURL(prURL, finding.Finding),
			Text:      finding.Text,
			Decision:  string(finding.Decision),
			Placement: string(finding.Placement),
		}
	}
	return converted
}

// lineURL is the line of an anchored finding in Files changed on GitHub: the
// anchor of a file there is the SHA-256 of its path, and R the line of the new
// side. "" for a general finding.
func lineURL(prURL string, f prreport.Finding) string {
	if !f.Anchored() {
		return ""
	}
	return fmt.Sprintf("%s/files#diff-%xR%d", prURL, sha256.Sum256([]byte(f.Path)), f.Line)
}

// FromDiscussions converts the active discussions with the situations each one
// waits on the user for, by discussion id, the board each one belongs to and
// its last reading, and the converted repositories. A nil map of situations
// counts as none for every discussion. The slices are always allocated so the
// frontend never sees null.
func FromDiscussions(
	states []discussionflow.State,
	situations map[string][]attention.Situation,
	boards func(id string) (board.Board, bool),
	stored func(id string) board.Stored,
	repos []Repository,
	missing func(id string) bool,
) []DiscussionSummary {
	converted := make([]DiscussionSummary, len(states))
	for i, state := range states {
		d := state.Discussion
		reading := stored(d.BoardID).Reading
		byKey := repositoriesOfBoard(repos, d.BoardID)
		summary := state.Session
		if summary.Status == "" {
			summary.Status = session.StatusWaiting
		}
		sessionStage := ""
		if state.SessionOpen {
			sessionStage = session.DiscussionStage
		}
		drafts := make([]discussion.Draft, len(state.Drafts))
		for j, draft := range state.Drafts {
			drafts[j] = draft.Draft
		}
		converted[i] = DiscussionSummary{
			ID:               d.ID,
			BoardID:          d.BoardID,
			Board:            boardTitleOf(d, boards),
			Title:            d.Title,
			Text:             d.Text,
			Status:           string(state.Status),
			Cards:            fromDiscussionCards(d.Cards),
			Drafts:           fromDrafts(state.Drafts, drafts, d.DraftsRevision, reading, byKey),
			Round:            state.Round,
			Publishing:       state.Publishing,
			DraftsRead:       d.DraftsRead,
			DraftsRevision:   d.DraftsRevision,
			UnreadableDrafts: state.UnreadableDrafts,
			HasDocument:      state.HasDocument,
			DocumentRevision: state.DocumentRevision,
			ModuleField:      moduleFieldName(reading),
			ModuleOptions:    moduleOptionNames(reading),
			Repositories:     fromDiscussionRepositories(repos, d.BoardID, missing),
			CanArchive:       state.CanArchive,
			ArchiveHint:      state.ArchiveHint,

			SessionStage:   sessionStage,
			SessionStatus:  string(summary.Status),
			SessionModel:   string(summary.Choice.Model),
			SessionEffort:  string(summary.Choice.Effort),
			TurnRunning:    summary.TurnRunning,
			ProcessRunning: summary.ProcessRunning,
			RetryAttempt:   summary.RetryAttempt,
			RetryMax:       summary.RetryMax,
			RetryAt:        timeOrEmpty(summary.RetryAt),
			RetryReason:    summary.RetryReason,
			TurnFailed:     summary.TurnFailed,
			TurnStartedAt:  turnStart(summary),
			PausedAt:       pausedAt(summary),
			ActionLabel:    summary.ActionLabel,
			ActionTarget:   summary.ActionTarget,
			ContextPercent: summary.ContextPercent,
			PendingCount:   summary.PendingCount,
			LastError:      summary.LastError,
			Situations:     fromSituations(situations[d.ID]),
			CreatedAt:      d.CreatedAt.Format(time.RFC3339),
		}
	}
	return converted
}

// FromArchivedDiscussions converts the discussions of the history, each with
// the drafts it produced and the registered repositories it touched. The
// slices are always allocated so the frontend never sees null.
func FromArchivedDiscussions(
	list []discussion.Discussion, drafts func(id string) []discussion.Draft, repos []Repository,
) []ArchivedDiscussion {
	converted := make([]ArchivedDiscussion, len(list))
	for i, d := range list {
		stored := drafts(d.ID)
		byKey := repositoriesOfBoard(repos, d.BoardID)
		states := make([]discussionflow.DraftState, len(stored))
		for j, draft := range stored {
			states[j] = discussionflow.DraftState{Draft: draft}
		}
		published := 0
		for _, draft := range stored {
			if draft.Published.Done() {
				published++
			}
		}
		converted[i] = ArchivedDiscussion{
			ID:             d.ID,
			BoardID:        d.BoardID,
			Board:          d.BoardTitle,
			Title:          d.Title,
			Text:           d.Text,
			Cards:          fromDiscussionCards(d.Cards),
			Drafts:         fromDrafts(states, stored, 0, nil, byKey),
			PublishedCount: published,
			RepositoryIDs:  repositoryIDsOf(d, stored, repositoriesByFullName(repos)),
			CreatedAt:      d.CreatedAt.Format(time.RFC3339),
			ArchivedAt:     d.ArchivedAt.Format(time.RFC3339),
		}
	}
	return converted
}

// boardTitleOf names the board of a discussion: as it is now, or as the
// discussion recorded it when the board is no longer registered.
func boardTitleOf(d discussion.Discussion, boards func(id string) (board.Board, bool)) string {
	if b, ok := boards(d.BoardID); ok {
		return b.Title
	}
	return d.BoardTitle
}

// repositoriesOfBoard are the converted repositories of a board, by
// owner/name in lower case.
func repositoriesOfBoard(repos []Repository, boardID string) map[string]Repository {
	byKey := make(map[string]Repository)
	for _, repo := range repos {
		if repo.BoardID == boardID {
			byKey[strings.ToLower(repo.FullName)] = repo
		}
	}
	return byKey
}

// repositoriesByFullName are every registered repository by owner/name in
// lower case, whatever board it belongs to.
func repositoriesByFullName(repos []Repository) map[string]Repository {
	byKey := make(map[string]Repository, len(repos))
	for _, repo := range repos {
		byKey[strings.ToLower(repo.FullName)] = repo
	}
	return byKey
}

// fromDiscussionRepositories converts the repositories a new card of a
// discussion can be created in: the registered repositories of its board, in
// the order they come in. A board that was removed has none.
func fromDiscussionRepositories(repos []Repository, boardID string, missing func(id string) bool) []DiscussionRepository {
	converted := []DiscussionRepository{}
	for _, repo := range repos {
		if repo.BoardID != boardID {
			continue
		}
		converted = append(converted, DiscussionRepository{
			ID:       repo.ID,
			FullName: repo.FullName,
			Cloned:   repo.Cloned,
			Missing:  repo.Cloned && missing(repo.ID),
		})
	}
	return converted
}

// repositoryIDsOf are the registered repositories an archived discussion
// touched: the ones of the cards it started from and the ones its drafts were
// published in, each one once. They are looked up by identity, so a discussion
// of a board that was removed keeps the repositories the history filters by.
func repositoryIDsOf(d discussion.Discussion, drafts []discussion.Draft, byKey map[string]Repository) []string {
	ids := []string{}
	add := func(fullName string) {
		repo, ok := byKey[strings.ToLower(fullName)]
		if !ok || slices.Contains(ids, repo.ID) {
			return
		}
		ids = append(ids, repo.ID)
	}
	for _, card := range d.Cards {
		add(card.Owner + "/" + card.Name)
	}
	for _, draft := range drafts {
		if draft.Published.Done() {
			add(draft.FullName())
		}
	}
	return ids
}

// moduleFieldName is the name of the module field of the board; "" without a
// reading or without one.
func moduleFieldName(reading *board.Reading) string {
	if reading == nil || reading.Module == nil {
		return ""
	}
	return reading.Module.Name
}

// moduleOptionNames are the options of the module field of the board, always
// allocated so the frontend never sees null.
func moduleOptionNames(reading *board.Reading) []string {
	if reading == nil || reading.Module == nil {
		return []string{}
	}
	names := make([]string, len(reading.Module.Options))
	for i, o := range reading.Module.Options {
		names[i] = o.Name
	}
	return names
}

// fromDrafts converts the drafts of a discussion, in position order, always
// returning a slice so the frontend never sees null.
func fromDrafts(
	states []discussionflow.DraftState,
	drafts []discussion.Draft,
	draftsRevision int,
	reading *board.Reading,
	byKey map[string]Repository,
) []Draft {
	converted := make([]Draft, len(states))
	for i, state := range states {
		converted[i] = fromDraft(state, drafts, draftsRevision, reading, byKey)
	}
	return converted
}

// fromDraft converts one draft with what can be done to it now, the card an
// update changes as the stored reading has it, and the registered repository
// its issue goes to.
func fromDraft(
	state discussionflow.DraftState,
	drafts []discussion.Draft,
	draftsRevision int,
	reading *board.Reading,
	byKey map[string]Repository,
) Draft {
	d := state.Draft
	warnings := make([]string, len(d.Warnings))
	copy(warnings, d.Warnings)
	converted := Draft{
		ID:           d.ID,
		Position:     d.Position,
		Kind:         string(d.Kind),
		Source:       string(d.Source),
		Repository:   d.FullName(),
		RepositoryID: byKey[strings.ToLower(d.FullName())].ID,
		Card:         fromDraftCard(d.Card),
		Title:        d.Title,
		Body:         d.Body,
		Module:       d.Module,
		Epic:         draftRefOf(d.Epic, drafts, reading),
		Dependencies: fromDraftDependencies(d.Dependencies, drafts, reading),
		Current:      fromDraftCurrent(d, reading),
		Decision:     string(d.Decision),
		Revision:     d.Revision,
		Warnings:     warnings,
		Outcome:      string(d.Published.Outcome),
		Number:       d.Published.Number,
		URL:          d.Published.URL,
		Published:    d.Published.Done(),
		Publishing:   state.Publishing,
		PublishError: d.PublishError,
		Hold:         fromHold(state.Hold),

		Round:            d.Round,
		Revised:          d.RevisedReading > 0 && d.RevisedReading == draftsRevision,
		ApprovalCleared:  d.ApprovalCleared,
		ApprovePublishes: names(state.ApprovePublishes),
		DiscardPublishes: names(state.DiscardPublishes),
		ApproveHold:      fromHold(state.ApproveHold),
	}
	if d.Published.Done() {
		converted.PublishedAt = d.Published.At.Format(time.RFC3339)
	}
	return converted
}

// fromHold converts what keeps a draft out of the next publication.
func fromHold(h discussionflow.Hold) DraftHold {
	return DraftHold{Reason: string(h.Reason), Title: h.Title, Left: h.Left, Approved: h.Approved, Cards: h.Cards}
}

// fromDraftCard converts the card an update draft changes, keeping nil for a
// draft that changes none.
func fromDraftCard(c *discussion.InputCard) *DiscussionCard {
	if c == nil {
		return nil
	}
	converted := fromDiscussionCard(*c)
	return &converted
}

// fromDiscussionCards converts the cards a discussion started from, always
// returning a slice so the frontend never sees null.
func fromDiscussionCards(cards []discussion.InputCard) []DiscussionCard {
	converted := make([]DiscussionCard, len(cards))
	for i, card := range cards {
		converted[i] = fromDiscussionCard(card)
	}
	return converted
}

// fromDiscussionCard converts one card of the board a discussion holds.
func fromDiscussionCard(c discussion.InputCard) DiscussionCard {
	return DiscussionCard{
		Key:        c.Key(),
		Repository: c.Owner + "/" + c.Name,
		Number:     c.Number,
		Title:      c.Title,
		URL:        c.URL,
	}
}

// fromDraftDependencies converts the dependencies of a draft, always returning
// a slice so the frontend never sees null.
func fromDraftDependencies(
	dependencies []discussion.Dependency, drafts []discussion.Draft, reading *board.Reading,
) []DraftDependency {
	converted := make([]DraftDependency, len(dependencies))
	for i, dependency := range dependencies {
		converted[i] = DraftDependency{
			DraftRef: refOf(dependency.Ref, drafts, reading),
			Linked:   dependency.Linked,
			Dropped:  string(dependency.Dropped),
			Detail:   dependency.Detail,
		}
	}
	return converted
}

// draftRefOf converts what a draft points at, as the draft writes it, keeping
// nil for one that points at nothing.
func draftRefOf(value string, drafts []discussion.Draft, reading *board.Reading) *DraftRef {
	ref, ok := discussion.ParseRef(value)
	if !ok {
		return nil
	}
	converted := refOf(ref, drafts, reading)
	return &converted
}

// refOf converts a reference: a draft of the discussion by its title, or an
// issue with what the stored reading knows about it.
func refOf(ref discussion.Ref, drafts []discussion.Draft, reading *board.Reading) DraftRef {
	if ref.IsDraft() {
		converted := DraftRef{Draft: ref.Draft}
		i := slices.IndexFunc(drafts, func(d discussion.Draft) bool { return d.ID == ref.Draft })
		if i >= 0 {
			converted.Title = drafts[i].Title
		}
		return converted
	}
	converted := DraftRef{Key: ref.Key(), Reference: ref.String()}
	if card, ok := cardOfReading(reading, ref.Key()); ok {
		converted.Title, converted.URL = card.Title, card.URL
	}
	return converted
}

// issueRefOf converts an issue the stored reading names next to a card.
func issueRefOf(issue board.Issue) DraftRef {
	return DraftRef{
		Key:       issue.Key(),
		Reference: issue.FullName() + "#" + strconv.Itoa(issue.Number),
		Title:     issue.Title,
		URL:       issue.URL,
	}
}

// fromDraftCurrent converts the card an update draft changes, as the stored
// reading has it, keeping nil for every other draft and for a card that left
// the reading.
func fromDraftCurrent(d discussion.Draft, reading *board.Reading) *DraftCurrent {
	if d.Kind != discussion.KindUpdate || d.Card == nil {
		return nil
	}
	card, ok := cardOfReading(reading, d.Card.Key())
	if !ok {
		return nil
	}
	current := DraftCurrent{
		Title:        card.Title,
		Body:         card.Body,
		Module:       moduleValueOf(card, reading),
		Status:       card.Status,
		Dependencies: []DraftRef{},
		ReadAt:       card.ReadAt.Format(time.RFC3339),
	}
	if card.Epic != nil {
		epic := issueRefOf(card.Epic.Issue)
		current.Epic = &epic
	}
	for _, dependency := range card.Dependencies {
		current.Dependencies = append(current.Dependencies, issueRefOf(dependency.Issue))
	}
	return &current
}

// moduleValueOf is the module of a card of the reading: the value of the field
// the board names as its module field.
func moduleValueOf(card board.Card, reading *board.Reading) string {
	if reading == nil || reading.Module == nil {
		return ""
	}
	i := slices.IndexFunc(card.Fields, func(f board.Field) bool { return f.Name == reading.Module.Name })
	if i < 0 {
		return ""
	}
	return card.Fields[i].Value
}

// cardOfReading is the card of the stored reading of key.
func cardOfReading(reading *board.Reading, key string) (board.Card, bool) {
	if reading == nil {
		return board.Card{}, false
	}
	i := slices.IndexFunc(reading.Cards, func(c board.Card) bool { return c.Key() == key })
	if i < 0 {
		return board.Card{}, false
	}
	return reading.Cards[i], true
}

// pausedAt is when a session was paused, "" when it is not or the time is
// unknown.
func pausedAt(summary session.Summary) string {
	return timeOrEmpty(summary.PausedAt)
}

// timeOrEmpty writes an instant as RFC 3339, "" for the zero time.
func timeOrEmpty(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.Format(time.RFC3339)
}

// turnStart is when the turn of a session started, "" without one.
func turnStart(summary session.Summary) string {
	if summary.TurnStartedAt.IsZero() {
		return ""
	}
	return summary.TurnStartedAt.Format(time.RFC3339)
}

// fromMarkerCommits converts the commits of a new_commits marker; never nil.
func fromMarkerCommits(commits []session.MarkerCommit) []MarkerCommit {
	out := make([]MarkerCommit, 0, len(commits))
	for _, commit := range commits {
		out = append(out, MarkerCommit{SHA: commit.SHA, Subject: commit.Subject, Author: commit.Author})
	}
	return out
}

// fromDraftBefore converts the drafts of a drafts_revised marker; never nil.
func fromDraftBefore(before []session.DraftBefore) []DraftBefore {
	out := make([]DraftBefore, 0, len(before))
	for _, b := range before {
		out = append(out, DraftBefore{
			Title:           b.Title,
			Kind:            b.Kind,
			Decision:        b.Decision,
			Outcome:         b.Outcome,
			Reference:       b.Reference,
			Changes:         names(b.Changes),
			Dropped:         b.Dropped,
			Added:           b.Added,
			ApprovalCleared: b.ApprovalCleared,
		})
	}
	return out
}

// fromMarkerProblems converts the problems of a plan_invalid marker; never nil.
func fromMarkerProblems(problems []session.PlanProblem) []PlanProblem {
	out := make([]PlanProblem, 0, len(problems))
	for _, p := range problems {
		out = append(out, PlanProblem{File: p.File, Message: p.Message})
	}
	return out
}

// FromHistorySummary counts the whole History and finds its oldest item.
func FromHistorySummary(
	tasks []task.Task, reviews []prreview.Review, discussions []discussion.Discussion, start time.Time,
) HistorySummary {
	summary := HistorySummary{
		Tasks: len(tasks), Reviews: len(reviews), Discussions: len(discussions),
		WindowStart: start.UTC().Format(time.RFC3339),
	}
	var oldest time.Time
	note := func(at time.Time) {
		if oldest.IsZero() || at.Before(oldest) {
			oldest = at
		}
	}
	for _, t := range tasks {
		note(t.ArchivedAt)
	}
	for _, r := range reviews {
		note(r.ArchivedAt)
	}
	for _, d := range discussions {
		note(d.ArchivedAt)
	}
	summary.Oldest = timeOrEmpty(oldest)
	return summary
}

// ArchivedDiscussionRepositories counts, for each repository, the archived
// discussions that touched it, by the same rules as the repositories of an
// archived discussion.
func ArchivedDiscussionRepositories(
	list []discussion.Discussion, drafts func(id string) []discussion.Draft, repos []Repository,
) map[string]int {
	counts := map[string]int{}
	byKey := repositoriesByFullName(repos)
	for _, d := range list {
		for _, id := range repositoryIDsOf(d, drafts(d.ID), byKey) {
			counts[id]++
		}
	}
	return counts
}
