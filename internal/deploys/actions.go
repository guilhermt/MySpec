package deploys

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/repository"
)

// Kind is an action of the app on an environment.
type Kind string

// The actions.
const (
	KindDeploy Kind = "deploy"
	KindMerge  Kind = "merge"
)

// Phase is where an action is.
type Phase string

// The phases of an action.
const (
	PhaseCreating   Phase = "creating"    // the pull request of the deploy is being created
	PhaseMerging    Phase = "merging"     // the merge is being made
	PhaseWaitingRun Phase = "waiting_run" // merged; the run of the merge commit hasn't shown up
	PhaseRunning    Phase = "running"     // that run is queued or running
	PhaseFailed     Phase = "failed"      // creating or merging failed; Failure says why
)

// Action is an action of the app on one promotion, from the previous branch to
// the branch of the environment.
type Action struct {
	Kind     Kind
	Phase    Phase
	Failure  string    // PhaseFailed: what GitHub said, as gh.APIMessage reads it
	PR       int       // merge: the number of the pull request
	MergeSHA string    // the merge commit, from PhaseWaitingRun on
	RunID    int64     // the run of the merge commit, from PhaseRunning on
	MergedAt time.Time // when the merge answered; the wait for the run counts from it

	// environment and workflowID are the name and the workflow of the
	// environment when the action began: the run of a merge is read, and the
	// notice of its end names the environment, even when the configuration
	// changes meanwhile.
	environment string
	workflowID  int64
}

// The ways an action is refused before it starts.
var (
	ErrBusy             = errors.New("deploys: an action is running on this environment")
	ErrNothingToDeploy  = errors.New("deploys: nothing to deploy")
	ErrNoDeployPR       = errors.New("deploys: no deploy pull request to merge")
	ErrNotRead          = errors.New("deploys: the repository has not been read")
	ErrNoEnvironment    = errors.New("deploys: no such environment")
	ErrFirstEnvironment = errors.New("deploys: the first environment receives the pull requests of the tasks")
)

const (
	// actionTimeout bounds each call of an action to GitHub.
	actionTimeout = time.Minute
	// runPollInterval is how often the runs in progress are read again.
	runPollInterval = 10 * time.Second
	// runWaitLimit is how long a merged action waits for the run of its merge
	// commit to show up.
	runWaitLimit = 5 * time.Minute
)

// The REST methods the actions use.
const (
	methodPost = "POST"
	methodPut  = "PUT"
)

// actionKey is the pair of branches an action promotes between. The key uses
// the branches, not the position: an action survives a change of the
// configuration and reappears at the position that has the same pair.
type actionKey struct {
	RepositoryID string
	From         string
	To           string
}

// Finished is a deploy run that ended, started by a merge the app made.
type Finished struct {
	RepositoryID string
	FullName     string // owner/name
	Environment  string // the name of the environment when the merge was made
	Branch       string
	Position     int // in the configuration now; -1 when the environment is gone
	Succeeded    bool
	Duration     time.Duration // from StartedAt to UpdatedAt of the run
	RunID        int64
	RunURL       string
}

// begun is an action that was accepted, with what its goroutine needs.
type begun struct {
	key         actionKey
	owner, name string
	environment string
	pr          int
}

// Deploy creates the pull request that promotes the previous branch of the
// environment at position into its branch, in the background. The action
// shows in the Overview until it ends.
func (s *Service) Deploy(repositoryID string, position int) error {
	b, err := s.begin(repositoryID, position, KindDeploy)
	if err != nil {
		return err
	}
	go s.runDeploy(b)
	return nil
}

// Merge merges the open pull request of deploy of the environment at position,
// in the background, and then follows the run the merge starts.
func (s *Service) Merge(repositoryID string, position int) error {
	b, err := s.begin(repositoryID, position, KindMerge)
	if err != nil {
		return err
	}
	go s.runMerge(b)
	return nil
}

// begin checks that kind is available at position and records the action.
func (s *Service) begin(repositoryID string, position int, kind Kind) (begun, error) {
	repos := s.repositories()

	s.mu.Lock()
	var m managed
	found := false
	for _, candidate := range s.managedLocked(repos) {
		if candidate.repo.ID == repositoryID {
			m, found = candidate, true
		}
	}
	if !found || position < 0 || position >= len(m.envs) {
		s.mu.Unlock()
		return begun{}, ErrNoEnvironment
	}
	if position == 0 {
		s.mu.Unlock()
		return begun{}, ErrFirstEnvironment
	}

	key := actionKey{RepositoryID: repositoryID, From: m.envs[position-1].Branch, To: m.envs[position].Branch}
	if action := s.actions[key]; action != nil && action.Phase != PhaseFailed {
		s.mu.Unlock()
		return begun{}, ErrBusy
	}
	if reading, ok := s.readings[repositoryID]; !ok || len(reading.Environments) == 0 {
		s.mu.Unlock()
		return begun{}, ErrNotRead
	}

	view := s.viewLocked(repositoryID, m.envs, position)
	b := begun{key: key, owner: m.repo.Owner, name: m.repo.Name, environment: m.envs[position].Name}
	action := &Action{Kind: kind, environment: b.environment, workflowID: m.envs[position].WorkflowID}
	switch kind {
	case KindDeploy:
		if view.Available != AvailableDeploy {
			s.mu.Unlock()
			return begun{}, ErrNothingToDeploy
		}
		action.Phase = PhaseCreating
	case KindMerge:
		if view.Available != AvailableMerge {
			s.mu.Unlock()
			return begun{}, ErrNoDeployPR
		}
		b.pr = s.environmentReadingLocked(repositoryID, m.envs, position).Promotion.DeployPR.Number
		action.Phase, action.PR = PhaseMerging, b.pr
	}
	s.actions[key] = action
	s.mu.Unlock()

	s.changed()
	return b, nil
}

// pullsEndpoint is the endpoint of the pull requests of owner/name.
func pullsEndpoint(owner, name string) string {
	return repoEndpoint(owner, name) + "/pulls"
}

// repoEndpoint is the endpoint of owner/name, its segments escaped.
func repoEndpoint(owner, name string) string {
	return fmt.Sprintf("repos/%s/%s", url.PathEscape(owner), url.PathEscape(name))
}

// runDeploy reads the repository again, so that the list of pull requests is
// the one of the moment, and creates the pull request of deploy.
func (s *Service) runDeploy(b begun) {
	ctx, cancel := context.WithTimeout(s.ctx, actionTimeout)
	defer cancel()

	m, ok := s.managedRepository(b.key.RepositoryID)
	if !ok {
		s.dropAction(b.key)
		return
	}
	if err := s.readOne(ctx, m); err != nil {
		s.failAction(b, failureMessage(err), err)
		return
	}

	s.mu.Lock()
	position := positionOf(m.envs, b.key.To)
	var promotion *Promotion
	if position > 0 {
		if env := s.environmentReadingLocked(b.key.RepositoryID, m.envs, position); env != nil {
			promotion = env.Promotion
		}
	}
	s.mu.Unlock()
	// A pull request opened meanwhile, or nothing left to deploy: the new
	// state says what there is.
	if promotion == nil || promotion.DeployPR != nil || promotion.Commits == 0 {
		s.dropAction(b.key)
		return
	}

	body, err := json.Marshal(map[string]string{
		"title": "Deploy to " + b.environment,
		"head":  b.key.From,
		"base":  b.key.To,
		"body":  deployBody(*promotion),
	})
	if err != nil {
		s.failAction(b, "encode the pull request: "+err.Error(), err)
		return
	}
	if _, err := s.github.REST(ctx, methodPost, pullsEndpoint(b.owner, b.name), string(body)); err != nil {
		s.failAction(b, gh.APIMessage(err), err)
		return
	}
	s.log.Info("deploy pull request created", "repository", b.owner+"/"+b.name, "from", b.key.From, "to", b.key.To)

	// The action stays until the repository is read again, so the cell never
	// shows the old state in between.
	_ = s.readOne(ctx, m)
	s.dropAction(b.key)
}

// runMerge merges the pull request of the action and keeps it waiting for the
// run of the merge commit.
func (s *Service) runMerge(b begun) {
	ctx, cancel := context.WithTimeout(s.ctx, actionTimeout)
	defer cancel()

	endpoint := fmt.Sprintf("%s/%d/merge", pullsEndpoint(b.owner, b.name), b.pr)
	out, err := s.github.REST(ctx, methodPut, endpoint, `{"merge_method":"merge"}`)
	if err != nil {
		s.failAction(b, gh.APIMessage(err), err)
		return
	}
	var merged struct {
		SHA string `json:"sha"`
	}
	err = json.Unmarshal([]byte(out), &merged)
	if err == nil && merged.SHA == "" {
		err = errors.New("no sha in the answer")
	}
	if err != nil {
		s.failAction(b, "GitHub merged the pull request but didn't say the merge commit.", fmt.Errorf("decode the merge answer: %w", err))
		return
	}

	s.mu.Lock()
	if action := s.actions[b.key]; action != nil {
		action.Phase, action.MergeSHA, action.MergedAt = PhaseWaitingRun, merged.SHA, s.now()
	}
	s.mu.Unlock()
	s.log.Info("deploy merged", "repository", b.owner+"/"+b.name, "from", b.key.From, "to", b.key.To, "pull_request", b.pr)
	s.changed()

	if m, ok := s.managedRepository(b.key.RepositoryID); ok {
		_ = s.readOne(ctx, m)
		s.changed()
	}
}

// managedRepository is the managed repository of id now.
func (s *Service) managedRepository(id string) (managed, bool) {
	repos := s.repositories()

	s.mu.Lock()
	defer s.mu.Unlock()

	for _, m := range s.managedLocked(repos) {
		if m.repo.ID == id {
			return m, true
		}
	}
	return managed{}, false
}

// failureMessage is what the user reads of a failed reading.
func failureMessage(err error) string {
	var failure *Failure
	if errors.As(err, &failure) {
		return failure.Message()
	}
	return FailureOf(err).Message()
}

// failAction puts the action of b in the failed phase, with message. Nothing
// is said when the service is closed: the call only failed because of that.
func (s *Service) failAction(b begun, message string, cause error) {
	if s.ctx.Err() != nil {
		return
	}
	s.mu.Lock()
	if action := s.actions[b.key]; action != nil {
		action.Phase, action.Failure = PhaseFailed, message
	}
	s.mu.Unlock()
	s.log.Warn("deploy action failed", "repository", b.owner+"/"+b.name, "from", b.key.From, "to", b.key.To, "error", cause)
	s.changed()
}

// dropAction forgets the action of key.
func (s *Service) dropAction(key actionKey) {
	s.mu.Lock()
	delete(s.actions, key)
	s.mu.Unlock()
	s.changed()
}

// deployBody is the description of the pull request of a deploy: the pull
// requests that enter it.
func deployBody(p Promotion) string {
	var b strings.Builder
	if len(p.PullRequests) == 0 {
		b.WriteString("No pull requests in this deploy.")
	} else {
		b.WriteString("Pull requests in this deploy:\n")
		for _, pr := range p.PullRequests {
			fmt.Fprintf(&b, "\n- #%d %s", pr.Number, pr.Title)
		}
	}
	if p.Partial {
		fmt.Fprintf(&b, "\n\nRead from the first %d commits of %d.", compareLimit, p.Ahead)
	}
	return b.String()
}

// clearFailedActionsLocked drops the failed actions of a repository that no
// longer hold: the pair is gone from the configuration, or the environment
// doesn't offer that action anymore. Callers hold the mutex.
func (s *Service) clearFailedActionsLocked(repositoryID string) {
	envs := s.environmentsLocked(repositoryID)
	for key, action := range s.actions {
		if key.RepositoryID != repositoryID || action.Phase != PhaseFailed {
			continue
		}
		position := positionOf(envs, key.To)
		if position < 1 || envs[position-1].Branch != key.From {
			delete(s.actions, key)
			continue
		}
		available := s.viewLocked(repositoryID, envs, position).Available
		if (action.Kind == KindDeploy && available != AvailableDeploy) || (action.Kind == KindMerge && available != AvailableMerge) {
			delete(s.actions, key)
		}
	}
}

// runWatch is an environment whose runs the fast loop reads.
type runWatch struct {
	repositoryID string
	owner, name  string
	workflowID   int64
	branch       string
}

// watch is the fast loop: every runPollInterval it reads again the runs in
// progress, until Close.
func (s *Service) watch() {
	ticker := time.NewTicker(runPollInterval)
	defer ticker.Stop()
	for {
		select {
		case <-s.ctx.Done():
			return
		case <-ticker.C:
			s.tick(s.ctx)
		}
	}
}

// tick reads again the runs of the environments with a run in progress and of
// the actions that wait for a run, and moves the actions forward: a merge finds
// its run, a run that ended calls OnFinished. It does nothing when there is
// nothing to look at.
func (s *Service) tick(ctx context.Context) {
	repos := s.repositories()

	s.mu.Lock()
	watches := s.watchesLocked(repos)
	s.mu.Unlock()
	if len(watches) == 0 {
		return
	}

	runs := s.readWatched(ctx, watches)
	if ctx.Err() != nil {
		return
	}
	missing := s.readMissing(ctx, repos, runs)
	if ctx.Err() != nil {
		return
	}

	finished, changed := s.applyRuns(repos, runs, missing)
	for _, f := range finished {
		s.log.Info("deploy finished", "repository", f.FullName, "environment", f.Environment, "succeeded", f.Succeeded, "run", f.RunID)
		if s.onFinished != nil {
			s.onFinished(f)
		}
		s.RefreshRepository(f.RepositoryID)
	}
	if changed {
		s.changed()
	}
}

// watchesLocked are the environments to look at: the configured ones whose
// last run is active and the ones the actions in progress wait for. Callers
// hold the mutex.
func (s *Service) watchesLocked(repos []repository.Repository) []runWatch {
	var watches []runWatch
	add := func(w runWatch) {
		if !slices.Contains(watches, w) {
			watches = append(watches, w)
		}
	}
	for _, m := range s.managedLocked(repos) {
		for j, env := range m.envs {
			if r := s.environmentReadingLocked(m.repo.ID, m.envs, j); r != nil && r.LastRun != nil && r.LastRun.Active() {
				add(runWatch{repositoryID: m.repo.ID, owner: m.repo.Owner, name: m.repo.Name, workflowID: env.WorkflowID, branch: env.Branch})
			}
		}
	}
	for key, action := range s.actions {
		if action.Phase != PhaseWaitingRun && action.Phase != PhaseRunning {
			continue
		}
		if repo, ok := repositoryOf(repos, key.RepositoryID); ok {
			add(runWatch{repositoryID: key.RepositoryID, owner: repo.Owner, name: repo.Name, workflowID: action.workflowID, branch: key.To})
		}
	}
	return watches
}

// readWatched reads the runs of watches, at most restConcurrency calls at once.
// A read that failed is left out of the result.
func (s *Service) readWatched(ctx context.Context, watches []runWatch) map[runWatch][]Run {
	var (
		wg   sync.WaitGroup
		mu   sync.Mutex
		runs = make(map[runWatch][]Run, len(watches))
		sem  = make(chan struct{}, restConcurrency)
	)
	for _, w := range watches {
		wg.Add(1)
		sem <- struct{}{}
		go func() {
			defer wg.Done()
			defer func() { <-sem }()
			read, err := readRuns(ctx, s.github, w.owner, w.name, w.workflowID, w.branch)
			if err != nil {
				if ctx.Err() == nil {
					s.log.Warn("deploy runs reading failed", "repository", w.owner+"/"+w.name, "branch", w.branch, "error", err)
				}
				return
			}
			mu.Lock()
			runs[w] = read
			mu.Unlock()
		}()
	}
	wg.Wait()
	return runs
}

// readMissing reads by id the runs of the actions in progress that the page of
// runs read left out: a run that ended skipped, was deleted or fell off the
// page. A run that no longer counts or exists maps to nil; a read that failed
// is left out of the result.
func (s *Service) readMissing(ctx context.Context, repos []repository.Repository, runs map[runWatch][]Run) map[int64]*Run {
	type lookup struct {
		owner, name string
		id          int64
	}
	var lookups []lookup
	s.mu.Lock()
	for key, action := range s.actions {
		if action.Phase != PhaseRunning {
			continue
		}
		repo, ok := repositoryOf(repos, key.RepositoryID)
		if !ok {
			continue
		}
		read, ok := runs[runWatch{repositoryID: key.RepositoryID, owner: repo.Owner, name: repo.Name, workflowID: action.workflowID, branch: key.To}]
		if !ok || slices.ContainsFunc(read, func(r Run) bool { return r.ID == action.RunID }) {
			continue
		}
		lookups = append(lookups, lookup{owner: repo.Owner, name: repo.Name, id: action.RunID})
	}
	s.mu.Unlock()

	missing := make(map[int64]*Run, len(lookups))
	for _, l := range lookups {
		run, err := readRun(ctx, s.github, l.owner, l.name, l.id)
		if err != nil {
			if ctx.Err() == nil {
				s.log.Warn("deploy run reading failed", "repository", l.owner+"/"+l.name, "run", l.id, "error", err)
			}
			continue
		}
		missing[l.id] = run
	}
	return missing
}

// applyRuns keeps the runs read in the readings and moves the actions that
// wait for a run forward. missing is the runs of actions in progress read by
// id, nil for the ones gone. It returns the runs that ended, started by a
// merge, and whether anything changed.
func (s *Service) applyRuns(repos []repository.Repository, runs map[runWatch][]Run, missing map[int64]*Run) ([]Finished, bool) {
	now := s.now()

	s.mu.Lock()
	defer s.mu.Unlock()

	changed := false
	for w, read := range runs {
		rr, ok := s.readings[w.repositoryID]
		if !ok {
			continue
		}
		envs := s.environmentsLocked(w.repositoryID)
		cloned := false
		for j, env := range envs {
			if env.Branch != w.branch || env.WorkflowID != w.workflowID || s.environmentReadingLocked(w.repositoryID, envs, j) == nil {
				continue
			}
			if !cloned {
				rr.Environments, cloned = slices.Clone(rr.Environments), true
			}
			last, completed := lastRuns(read)
			if completed == nil {
				completed = rr.Environments[j].LastCompleted
			}
			if !sameRun(rr.Environments[j].LastRun, last) || !sameRun(rr.Environments[j].LastCompleted, completed) {
				changed = true
			}
			rr.Environments[j].LastRun, rr.Environments[j].LastCompleted = last, completed
		}
		if cloned {
			s.readings[w.repositoryID] = rr
		}
	}

	var finished []Finished
	for key, action := range s.actions {
		repo, ok := repositoryOf(repos, key.RepositoryID)
		if !ok {
			continue
		}
		read := runs[runWatch{repositoryID: key.RepositoryID, owner: repo.Owner, name: repo.Name, workflowID: action.workflowID, branch: key.To}]

		if action.Phase == PhaseWaitingRun {
			if i := slices.IndexFunc(read, func(r Run) bool { return r.HeadSHA == action.MergeSHA }); i >= 0 {
				action.Phase, action.RunID = PhaseRunning, read[i].ID
				changed = true
			} else if now.Sub(action.MergedAt) > runWaitLimit {
				// The merge was made and no run began: the cell follows the reading.
				s.log.Warn("deploy run not found", "repository", repo.FullName(), "from", key.From, "to", key.To, "merge", action.MergeSHA)
				delete(s.actions, key)
				changed = true
				continue
			}
		}
		if action.Phase != PhaseRunning {
			continue
		}
		var run Run
		if i := slices.IndexFunc(read, func(r Run) bool { return r.ID == action.RunID }); i >= 0 {
			run = read[i]
		} else if found, ok := missing[action.RunID]; !ok {
			continue
		} else if found == nil {
			// The run ended skipped or is gone: the cell follows the reading.
			s.log.Warn("deploy run gone", "repository", repo.FullName(), "to", key.To, "run", action.RunID)
			delete(s.actions, key)
			changed = true
			continue
		} else {
			run = *found
		}
		if run.Active() {
			continue
		}
		finished = append(finished, Finished{
			RepositoryID: key.RepositoryID,
			FullName:     repo.FullName(),
			Environment:  action.environment,
			Branch:       key.To,
			Position:     positionOf(s.environmentsLocked(key.RepositoryID), key.To),
			Succeeded:    run.Status == RunSucceeded,
			Duration:     run.UpdatedAt.Sub(run.StartedAt),
			RunID:        run.ID,
			RunURL:       run.URL,
		})
		delete(s.actions, key)
		changed = true
	}
	return finished, changed
}

// sameRun reports whether a and b are the same run in the same status.
func sameRun(a, b *Run) bool {
	if a == nil || b == nil {
		return a == b
	}
	return a.ID == b.ID && a.Status == b.Status
}

// repositoryOf is the repository of id among repos.
func repositoryOf(repos []repository.Repository, id string) (repository.Repository, bool) {
	i := slices.IndexFunc(repos, func(r repository.Repository) bool { return r.ID == id })
	if i < 0 {
		return repository.Repository{}, false
	}
	return repos[i], true
}
