package app

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/guilhermt/myspec/internal/attention"
	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/board"
	"github.com/guilhermt/myspec/internal/discussion"
	"github.com/guilhermt/myspec/internal/discussionflow"
	"github.com/guilhermt/myspec/internal/editor"
	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/platform/chime"
	"github.com/guilhermt/myspec/internal/platform/notify"
	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/pulls"
	"github.com/guilhermt/myspec/internal/repository"
	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/reviewflow"
	"github.com/guilhermt/myspec/internal/reviewmode"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/store"
	"github.com/guilhermt/myspec/internal/task"
	"github.com/guilhermt/myspec/internal/theme"
	"github.com/guilhermt/myspec/internal/upgrade"
	"github.com/guilhermt/myspec/internal/worktree"
)

// openTimeout bounds opening the database: the migrations and the upgrade of
// the data move files.
const openTimeout = time.Minute

// attemptDeps are what an attempt reaches outside its data directory with: the
// probe of the directory, the database, gh, the notifications of the desktop and
// what a ready app runs in the background. Run gives the real ones; the tests
// give fakes, so that a real attempt runs over a temporary directory without a
// desktop, a CLI or GitHub.
type attemptDeps struct {
	probe         func(dir string) error
	openStore     func(ctx context.Context, path string, log *slog.Logger, upgrade store.Upgrade) (*store.Store, error)
	ghBinary      string                                  // empty looks gh up on the PATH
	notifications func(chimePath string) *notify.Notifier // nil when the desktop has no notification service
	background    func()                                  // starts what a ready app runs for as long as it runs
}

// desktopDeps are the deps of the app the user runs.
func (a *App) desktopDeps() attemptDeps {
	return attemptDeps{
		probe:         store.Probe,
		openStore:     store.Open,
		notifications: a.startNotifications,
		background:    a.runInBackground,
	}
}

// withTimeout runs f with the time one call to the database has.
func withTimeout(ctx context.Context, f func(ctx context.Context) error) error {
	ctx, cancel := context.WithTimeout(ctx, callTimeout)
	defer cancel()
	return f(ctx)
}

// attempt is the work before the app is ready: it opens the data, builds the
// services, reads what the interface starts from, tests the clones, resumes the
// sessions and binds the services to the interface. When it fails it closes
// what it opened, so that the next attempt starts from nothing. A migration the
// app refuses is not a failure: the attempt ends with only the state bound, and
// the interface shows what to resolve.
func (a *App) attempt(ctx context.Context, p *progress) (err error) {
	var cleanup []func()
	var storeCloser func()
	defer func() {
		if err != nil {
			for i := len(cleanup) - 1; i >= 0; i-- {
				cleanup[i]()
			}
			return
		}
		// A started app closes its services in shutdown; the database is the
		// one thing that outlives it.
		if storeCloser != nil {
			a.mu.Lock()
			a.closers = append(a.closers, storeCloser)
			a.mu.Unlock()
		}
	}()

	p.begin(stepData)

	log := a.log
	if err = a.deps.probe(a.dirs.Data); err != nil {
		return fmt.Errorf("data directory: %w", err)
	}

	gitRunner := git.New(git.Deps{Log: log})
	identifier := repository.NewIdentifier(gitRunner)

	openCtx, cancelOpen := context.WithTimeout(ctx, openTimeout)
	st, err := a.deps.openStore(openCtx, a.dirs.DatabasePath(), log, upgrade.New(upgrade.Deps{
		Identify: identifier.Identify,
		DataDir:  a.dirs.Data,
		Log:      log,
	}))
	cancelOpen()
	// Data the app cannot carry over leaves the database as the version before
	// left it, and the interface opens on what the user has to resolve.
	var refused *upgrade.RefusedError
	if errors.As(err, &refused) {
		log.Warn("migration refused", "cases", len(refused.Cases))
		p.finish(stepData)
		a.services.Bind(bindings.Services{State: bindings.NewStateService(func() bindings.State {
			return bindings.RefusedState(refused, a.systemDark)
		})})
		return nil
	}
	// Data a newer version changed is neither read nor written, and the interface
	// opens on the same page.
	var newer *store.NewerError
	if errors.As(err, &newer) {
		log.Warn("data from a newer version", "data", newer.Data, "known", newer.Known)
		p.finish(stepData)
		a.services.Bind(bindings.Services{State: bindings.NewStateService(func() bindings.State {
			return bindings.NewerState(newer, a.systemDark)
		})})
		return nil
	}
	if err != nil {
		return fmt.Errorf("open database: %w", err)
	}
	storeCloser = func() { _ = st.Close() }
	cleanup = append(cleanup, storeCloser)

	if err = prompts.Prepare(a.dirs.Data, log); err != nil {
		return fmt.Errorf("prepare prompts: %w", err)
	}

	// Without the chime on disk the notifications are silent; they still show.
	chimePath, chimeErr := chime.Install(a.dirs.Data)
	if chimeErr != nil {
		log.Warn("install chime failed", "err", chimeErr)
	}
	a.notifier = a.deps.notifications(chimePath)
	// A notifier that could not start is no notifier at all, not a nil one
	// behind the interface.
	var notifier attention.Notifier
	if a.notifier != nil {
		notifier = a.notifier
		cleanup = append(cleanup, a.notifier.Close)
		if a.player != nil {
			cleanup = append(cleanup, a.player.Close)
		}
	}
	a.attention = attention.New(attention.Deps{
		Store:     st.Situations,
		Notifier:  notifier,
		Focused:   a.windowFocused,
		Log:       log,
		OnDue:     a.publish,
		OnStarted: a.emitSituationStarted,
	})

	var themeSvc *theme.Service
	if err = withTimeout(ctx, func(ctx context.Context) (err error) {
		themeSvc, err = theme.New(ctx, st.Settings, a.systemDark, log, a.publish)
		return err
	}); err != nil {
		return fmt.Errorf("read settings: %w", err)
	}
	var modelsSvc *models.Service
	if err = withTimeout(ctx, func(ctx context.Context) (err error) {
		modelsSvc, err = models.New(ctx, st.Settings, log, a.publish)
		return err
	}); err != nil {
		return fmt.Errorf("read model defaults: %w", err)
	}
	var reviewModesSvc *reviewmode.Service
	if err = withTimeout(ctx, func(ctx context.Context) (err error) {
		reviewModesSvc, err = reviewmode.New(ctx, st.Settings, log, a.publish)
		return err
	}); err != nil {
		return fmt.Errorf("read review mode default: %w", err)
	}
	sessions := session.New(session.Deps{
		Sessions: st.Sessions,
		Entries:  st.Entries,
		Launcher: claudeLauncher{log: log, effort: modelsSvc.ProcessEffort},
		RenderPrompt: func(stage prompts.Stage, vars prompts.Vars) (string, error) {
			return prompts.Render(a.dirs.Data, stage, vars)
		},
		Log: log,
		OnState: func(k session.Key) {
			a.publish()
			// The id of a session names an item: a task, a review or a
			// discussion, and only the one that owns it acts on the change.
			a.flow.Check(k.TaskID)
			a.reviewFlow.Check(k.TaskID)
			a.discussionFlow.Check(k.TaskID)
		},
		OnTranscript: a.emitTranscript,
	})
	if err = withTimeout(ctx, sessions.LoadConversations); err != nil {
		return fmt.Errorf("read sessions: %w", err)
	}
	ghRunner := gh.New(gh.Deps{Log: log, Binary: a.deps.ghBinary})
	repositories := repository.New(repository.Deps{
		Store:         st.Repositories,
		Settings:      st.Settings,
		Identify:      identifier.Identify,
		Clone:         ghRunner.Clone,
		Counts:        func(id string) (int, int) { return a.tasks.Counts(id) },
		Reviews:       func(id string) (int, int) { return a.prReviews.Counts(id) },
		Log:           log,
		OnChange:      a.publish,
		OnPathChanged: a.onRepositoryPathChanged,
	})
	tasks, err := task.New(task.Deps{
		Repo:         st.Tasks,
		DataDir:      a.dirs.Data,
		Log:          log,
		Repositories: repositories.Get,
		OnChange:     a.publish,
		OnArtifact:   a.onArtifact,
	})
	if err != nil {
		return fmt.Errorf("watch artifacts: %w", err)
	}
	cleanup = append(cleanup, func() { _ = tasks.Close() })
	boards := board.New(board.Deps{
		Store: st.Boards, GitHub: ghRunner, Repositories: repositories, Identify: identifier.Identify,
		Counts:    a.itemCounts,
		TaskCards: a.boardTaskCards,
		Log:       log, OnChange: a.publish, OnRead: a.onBoardRead,
	})
	worktrees := worktree.New(worktree.Deps{
		Git: gitRunner, Store: st.Worktrees, DataDir: a.dirs.Data, Log: log,
	})
	reviews, err := review.New(review.Deps{
		Worktrees: worktrees,
		Log:       log,
		OnChange: func(itemID string) {
			a.publish()
			a.flow.Check(itemID)
			a.reviewFlow.Check(itemID)
		},
	})
	if err != nil {
		return fmt.Errorf("watch worktrees: %w", err)
	}
	cleanup = append(cleanup, func() { _ = reviews.Close() })
	// The session and task callbacks reach the flow through the app, which
	// holds it before anything can run: no process starts before the reads.
	flowSvc := flow.New(flow.Deps{
		Tasks:        tasks,
		Sessions:     sessions,
		Worktrees:    worktrees,
		Repositories: repositories,
		Review:       reviews,
		GH:           ghRunner,
		Log:          log,
		RenderPrompt: func(stage prompts.Stage, vars prompts.Vars) (string, error) {
			return prompts.Render(a.dirs.Data, stage, vars)
		},
		OnChange: func(string) { a.publish() },
	})
	pullRequests := pulls.New(pulls.Deps{
		GitHub: ghRunner, Repositories: repositories.List, Settings: st.Settings,
		Log: log, OnChange: a.publish,
	})
	prReviews := prreview.New(prreview.Deps{
		Store: st.Reviews, DataDir: a.dirs.Data, Repositories: repositories.Get,
		Log: log, OnChange: a.publish,
	})
	reviewFlow := reviewflow.New(reviewflow.Deps{
		Reviews:      prReviews,
		Pulls:        pullRequests,
		Sessions:     sessions,
		Worktrees:    worktrees,
		Repositories: repositories,
		Boards:       boards,
		Watch:        reviews,
		GH:           ghRunner,
		Tasks:        a.taskPullRequests,
		Log:          log,
		RenderPrompt: func(stage prompts.Stage, vars prompts.Vars) (string, error) {
			return prompts.Render(a.dirs.Data, stage, vars)
		},
		OnChange: func(string) { a.publish() },
	})
	discussions := discussion.New(discussion.Deps{
		Store: st.Discussions, DataDir: a.dirs.Data, Log: log, OnChange: a.publish,
	})
	discussionFlow := discussionflow.New(discussionflow.Deps{
		Discussions:  discussions,
		Sessions:     sessions,
		Boards:       boards,
		Repositories: repositories,
		GH:           ghRunner,
		Log:          log,
		OnChange:     func(string) { a.publish() },
	})
	a.theme, a.repositories, a.tasks, a.sessions, a.flow = themeSvc, repositories, tasks, sessions, flowSvc
	a.worktrees, a.review, a.models = worktrees, reviews, modelsSvc
	a.reviewModes, a.boards = reviewModesSvc, boards
	a.pulls, a.prReviews, a.reviewFlow = pullRequests, prReviews, reviewFlow
	a.discussions, a.discussionFlow = discussions, discussionFlow

	if err = a.read(ctx); err != nil {
		return fmt.Errorf("load tasks: %w", err)
	}
	p.finish(stepData)

	if n := a.repositories.WithPath(); n > 0 {
		p.begin(stepClones)
		p.cloneCount(n)
		if err = a.repositories.CheckClones(ctx, p.checking); err != nil {
			return fmt.Errorf("check clones: %w", err)
		}
		p.finish(stepClones)
	}

	a.resume(ctx)

	a.services.Bind(a.bound(
		repositories, boards, themeSvc, modelsSvc, reviewModesSvc, ghRunner, tasks, sessions, flowSvc,
		a.dirs.Data, log,
	))
	a.markReady()
	a.deps.background()
	a.publish()
	return nil
}

// runInBackground starts what reads the machine and GitHub for as long as the
// app runs.
func (a *App) runInBackground() {
	// The catalog of models comes from the CLI on the machine and must not hold
	// the interface: it is read in the background and reaches it with the state.
	go a.discoverModels(a.pollCtx, a.dirs.Data)
	a.watchSystemTheme()
	// The pull requests the app waits for are merged outside it, so it asks
	// GitHub about them on a timer of its own for as long as it runs.
	go a.pollPRs(a.pollCtx)
}

// bound are the services the interface calls, built over the ones the attempt
// made.
func (a *App) bound(
	repositories *repository.Service,
	boards *board.Service,
	themeSvc *theme.Service,
	modelsSvc *models.Service,
	reviewModesSvc *reviewmode.Service,
	login bindings.GHLogin,
	tasks *task.Service,
	sessions *session.Service,
	flowSvc *flow.Service,
	dataDir string,
	log *slog.Logger,
) bindings.Services {
	return bindings.Services{
		State:      bindings.NewStateService(a.state),
		Repository: bindings.NewRepositoryService(repositories, a, log),
		Settings:   bindings.NewSettingsService(themeSvc, modelsSvc, reviewModesSvc, login, dataDir, log),
		Task: bindings.NewTaskService(
			tasks, sessions, flowSvc, modelsSvc, reviewModesSvc, repositories, boards, editor.Open,
			a.discussions.DocumentOfCard, a.hasConversation, log,
		),
		Board: bindings.NewBoardService(boards, a.discussions.DocumentOfCard, log),
		Review: bindings.NewReviewService(
			a.reviewFlow, a.prReviews, a.pulls, a.worktrees, editor.Open, log,
		),
		Discussion: bindings.NewDiscussionService(a.discussionFlow, a.discussions, repositories, log),
		Attention:  bindings.NewAttentionService(a.attention),
		History:    bindings.NewHistoryService(a.historySources(), log),
	}
}

// read loads the repositories, the boards, the tasks, the reviews of pull
// requests and the discussions, which is what the first state is made of.
func (a *App) read(ctx context.Context) error {
	reads := []struct {
		name string
		load func(ctx context.Context) error
	}{
		{"repositories", a.repositories.Load},
		{"boards", a.boards.Sync},
		{"tasks", a.tasks.Sync},
		{"review filters", a.pulls.Sync},
		{"reviews", a.prReviews.Sync},
		{"discussions", a.discussions.Sync},
	}
	for _, read := range reads {
		if err := withTimeout(ctx, read.load); err != nil {
			return fmt.Errorf("sync %s: %w", read.name, err)
		}
	}
	return nil
}

// resume hands the active items to the flows, which open the session each one
// is in and move on what finished while the app was closed. The situations and
// the worktrees failing to load only go to the log: the steps block on their
// own.
func (a *App) resume(ctx context.Context) {
	ids := a.activeItemIDs()
	// The baseline of the situations starts before the flow opens the
	// sessions, so that what already waited on the user is found, not started.
	if err := withTimeout(ctx, func(ctx context.Context) error { return a.attention.Sync(ctx, ids) }); err != nil {
		a.log.Error("sync situations failed", "err", err)
	}
	// The flow reads the registry of worktrees as it resumes the steps, so it
	// is loaded first.
	if err := withTimeout(ctx, func(ctx context.Context) error { return a.worktrees.Sync(ctx, ids) }); err != nil {
		a.log.Error("sync worktrees failed", "err", err)
	}
	for _, sync := range []func(context.Context){a.flow.Sync, a.reviewFlow.Sync, a.discussionFlow.Sync} {
		callCtx, cancel := context.WithTimeout(ctx, callTimeout)
		sync(callCtx)
		cancel()
	}
	// The first reading of the pull requests is what the Reviews view opens
	// on; it runs in the background and reaches the interface with the state.
	a.pulls.Refresh()
}

// markReady records that the services are bound and the app runs.
func (a *App) markReady() {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.ready = true
}

// isReady says whether the attempt ended with the services bound.
func (a *App) isReady() bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.ready
}
