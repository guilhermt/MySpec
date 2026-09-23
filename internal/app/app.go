// Package app composes the Wails application from the domain services. It is
// the only place, together with internal/bindings, that knows about Wails.
package app

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"

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
	"github.com/guilhermt/myspec/internal/platform/logging"
	"github.com/guilhermt/myspec/internal/platform/notify"
	"github.com/guilhermt/myspec/internal/platform/xdg"
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

// The process exit codes Run returns.
const (
	exitSuccess = 0
	exitFailure = 1
)

// startupTimeout bounds the database work done before the window opens.
const startupTimeout = 10 * time.Second

// callTimeout bounds the database work done while the app is running.
const callTimeout = 5 * time.Second

// shutdownTimeout is how long the sessions have to stop gracefully before
// their processes are killed.
const shutdownTimeout = 8 * time.Second

// What the app is called, to the user and to the system.
const (
	appName        = "MySpec" // the title of the window and the name the notifications carry
	appDescription = "Orchestrates a Claude Code development workflow"
	programName    = "myspec" // the Linux program and the lock of the single instance
)

// App holds the running application: the Wails handles and the domain services
// they are wired to.
type App struct {
	log            *slog.Logger
	repositories   *repository.Service
	theme          *theme.Service
	models         *models.Service
	reviewModes    *reviewmode.Service
	tasks          *task.Service
	boards         *board.Service
	sessions       *session.Service
	worktrees      *worktree.Service
	review         *review.Service
	flow           *flow.Service
	pulls          *pulls.Service
	prReviews      *prreview.Service
	reviewFlow     *reviewflow.Service
	discussions    *discussion.Service
	discussionFlow *discussionflow.Service
	attention      *attention.Service
	notifier       *notify.Notifier // nil when the desktop has no notification service
	player         *chime.Player    // nil when there is no notifier or the chime could not be installed

	mu     sync.Mutex
	wails  *application.App
	window *application.WebviewWindow

	publishMu sync.Mutex // keeps concurrent publishes from interleaving
}

// Run starts the application and returns the process exit code.
func Run(cfg Config) int {
	dirs := xdg.Resolve()
	if err := dirs.Ensure(); err != nil {
		return fail(nil, "prepare app directories", err)
	}

	log, closer, err := logging.New(logging.Options{
		Path:   dirs.LogPath(),
		Level:  logLevel(),
		Stderr: !production,
	})
	if err != nil {
		return fail(nil, "open log", err)
	}
	defer func() { _ = closer.Close() }()

	log.Info(
		"app starting",
		"version", cfg.Version,
		"args", cfg.Args,
		"data_dir", dirs.Data,
		"state_dir", dirs.State,
	)

	applyWebKitEnvironment()

	ctx, cancel := context.WithTimeout(context.Background(), startupTimeout)
	defer cancel()

	gitRunner := git.New(git.Deps{Log: log})
	identifier := repository.NewIdentifier(gitRunner)

	st, err := store.Open(ctx, dirs.DatabasePath(), log, upgrade.New(upgrade.Deps{
		Identify: identifier.Identify,
		DataDir:  dirs.Data,
		Log:      log,
	}))
	// Data the app cannot carry over leaves the database as the version before
	// left it, and opens the window on what the user has to resolve.
	var refused *upgrade.RefusedError
	if errors.As(err, &refused) {
		return runRefused(cfg, log, refused)
	}
	if err != nil {
		return fail(log, "open database", err)
	}
	defer func() { _ = st.Close() }()

	if err = prompts.Prepare(dirs.Data, log); err != nil {
		return fail(log, "prepare prompts", err)
	}

	bindings.RegisterEvents()

	a := &App{log: log}

	// Without the chime on disk the notifications are silent; they still show.
	chimePath, err := chime.Install(dirs.Data)
	if err != nil {
		log.Warn("install chime failed", "err", err)
	}
	a.notifier = a.startNotifications(chimePath)
	// A notifier that could not start is no notifier at all, not a nil one
	// behind the interface.
	var notifier attention.Notifier
	if a.notifier != nil {
		notifier = a.notifier
	}
	a.attention = attention.New(attention.Deps{
		Store:     st.Situations,
		Notifier:  notifier,
		Focused:   a.windowFocused,
		Log:       log,
		OnDue:     a.publish,
		OnStarted: a.emitSituationStarted,
	})

	themeSvc, err := theme.New(ctx, st.Settings, false, log, a.publish)
	if err != nil {
		return fail(log, "read settings", err)
	}
	modelsSvc, err := models.New(ctx, st.Settings, log, a.publish)
	if err != nil {
		return fail(log, "read model defaults", err)
	}
	reviewModesSvc, err := reviewmode.New(ctx, st.Settings, log, a.publish)
	if err != nil {
		return fail(log, "read review mode default", err)
	}
	sessions := session.New(session.Deps{
		Sessions: st.Sessions,
		Entries:  st.Entries,
		Launcher: claudeLauncher{log: log, effort: modelsSvc.ProcessEffort},
		RenderPrompt: func(stage prompts.Stage, vars prompts.Vars) (string, error) {
			return prompts.Render(dirs.Data, stage, vars)
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
	ghRunner := gh.New(gh.Deps{Log: log})
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
		DataDir:      dirs.Data,
		Log:          log,
		Repositories: repositories.Get,
		OnChange:     a.publish,
		OnArtifact:   a.onArtifact,
	})
	if err != nil {
		return fail(log, "watch artifacts", err)
	}
	boards := board.New(board.Deps{
		Store: st.Boards, GitHub: ghRunner, Repositories: repositories, Identify: identifier.Identify,
		Counts:    a.itemCounts,
		TaskCards: a.boardTaskCards,
		Log:       log, OnChange: a.publish, OnRead: a.onBoardRead,
	})
	worktrees := worktree.New(worktree.Deps{
		Git: gitRunner, Store: st.Worktrees, DataDir: dirs.Data, Log: log,
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
		return fail(log, "watch worktrees", err)
	}
	// The session and task callbacks reach the flow through the app, which
	// holds it before anything can run: no process starts before load.
	flowSvc := flow.New(flow.Deps{
		Tasks:        tasks,
		Sessions:     sessions,
		Worktrees:    worktrees,
		Repositories: repositories,
		Review:       reviews,
		GH:           ghRunner,
		Log:          log,
		RenderPrompt: func(stage prompts.Stage, vars prompts.Vars) (string, error) {
			return prompts.Render(dirs.Data, stage, vars)
		},
		OnChange: func(string) { a.publish() },
	})
	pullRequests := pulls.New(pulls.Deps{
		GitHub: ghRunner, Repositories: repositories.List, Settings: st.Settings,
		Log: log, OnChange: a.publish,
	})
	prReviews := prreview.New(prreview.Deps{
		Store: st.Reviews, DataDir: dirs.Data, Repositories: repositories.Get,
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
			return prompts.Render(dirs.Data, stage, vars)
		},
		OnChange: func(string) { a.publish() },
	})
	discussions := discussion.New(discussion.Deps{
		Store: st.Discussions, DataDir: dirs.Data, Log: log, OnChange: a.publish,
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

	if err := a.load(ctx); err != nil {
		return fail(log, "load tasks", err)
	}
	// The catalog of models comes from the CLI on the machine and must not hold
	// the window: it is read in the background and reaches the interface with
	// the state.
	go a.discoverModels(dirs.Data)
	a.watchSystemTheme()

	// The pull requests the app waits for are merged outside it, so it asks
	// GitHub about them on a timer of its own for as long as it runs.
	pollCtx, stopPoll := context.WithCancel(context.Background())
	defer stopPoll()
	go a.pollPRs(pollCtx)

	wails := application.New(
		a.options(cfg, repositories, boards, themeSvc, modelsSvc, reviewModesSvc, tasks, sessions, flowSvc, dirs.Data, log),
	)
	a.setWails(wails)
	a.openWindow(cfg, themeSvc.Effective())

	runErr := wails.Run()
	if runErr != nil {
		log.Error("run failed", "err", runErr)
	}
	log.Info("app stopped")
	if runErr != nil {
		return exitFailure
	}
	return exitSuccess
}

// options are the Wails application options, including the services the
// frontend binds to.
func (a *App) options(
	cfg Config,
	repositories *repository.Service,
	boards *board.Service,
	themeSvc *theme.Service,
	modelsSvc *models.Service,
	reviewModesSvc *reviewmode.Service,
	tasks *task.Service,
	sessions *session.Service,
	flowSvc *flow.Service,
	dataDir string,
	log *slog.Logger,
) application.Options {
	return application.Options{
		Name:        appName,
		Description: appDescription,
		Icon:        cfg.Icon,
		Services: []application.Service{
			application.NewService(bindings.NewStateService(a.state)),
			application.NewService(bindings.NewRepositoryService(repositories, a, log)),
			application.NewService(
				bindings.NewSettingsService(themeSvc, modelsSvc, reviewModesSvc, dataDir, log),
			),
			application.NewService(bindings.NewTaskService(
				tasks, sessions, flowSvc, modelsSvc, reviewModesSvc, repositories, boards, editor.Open,
				a.discussions.DocumentOfCard, a.hasConversation, log,
			)),
			application.NewService(bindings.NewBoardService(boards, a.discussions.DocumentOfCard, log)),
			application.NewService(bindings.NewReviewService(
				a.reviewFlow, a.prReviews, a.pulls, a.worktrees, editor.Open, log,
			)),
			application.NewService(bindings.NewDiscussionService(
				a.discussionFlow, a.discussions, repositories, log,
			)),
			application.NewService(bindings.NewAttentionService(a.attention)),
		},
		Assets: application.AssetOptions{Handler: application.AssetFileServerFS(cfg.Assets)},
		Linux:  application.LinuxOptions{ProgramName: programName},
		SingleInstance: &application.SingleInstanceOptions{
			UniqueID:               programName,
			OnSecondInstanceLaunch: a.onSecondInstance,
		},
		OnShutdown: a.shutdown,
		Logger:     log,
		LogLevel:   wailsLogLevel(),
	}
}

// load reads the repositories, the boards, the tasks and the reviews of pull
// requests, and hands the active items to the flows, which open the session
// each one is in and move on what finished while the app was closed. The
// situations and the worktrees failing to load only go to the log: the steps
// block on their own.
func (a *App) load(ctx context.Context) error {
	if err := a.repositories.Sync(ctx); err != nil {
		return fmt.Errorf("sync repositories: %w", err)
	}
	if err := a.boards.Sync(ctx); err != nil {
		return fmt.Errorf("sync boards: %w", err)
	}
	if err := a.tasks.Sync(ctx); err != nil {
		return fmt.Errorf("sync tasks: %w", err)
	}
	if err := a.pulls.Sync(ctx); err != nil {
		return fmt.Errorf("sync review filters: %w", err)
	}
	if err := a.prReviews.Sync(ctx); err != nil {
		return fmt.Errorf("sync reviews: %w", err)
	}
	if err := a.discussions.Sync(ctx); err != nil {
		return fmt.Errorf("sync discussions: %w", err)
	}
	ids := a.activeItemIDs()
	// The baseline of the situations starts before the flow opens the
	// sessions, so that what already waited on the user is found, not started.
	if err := a.attention.Sync(ctx, ids); err != nil {
		a.log.Error("sync situations failed", "err", err)
	}
	// The flow reads the registry of worktrees as it resumes the steps, so it
	// is loaded first.
	if err := a.worktrees.Sync(ctx, ids); err != nil {
		a.log.Error("sync worktrees failed", "err", err)
	}
	a.flow.Sync(ctx)
	a.reviewFlow.Sync(ctx)
	a.discussionFlow.Sync(ctx)
	// The first reading of the pull requests is what the Reviews view opens
	// on; it runs in the background and reaches the interface with the state.
	a.pulls.Refresh()
	return nil
}

// activeItemIDs are the ids of the items that run: the active tasks, the
// active reviews of pull requests and the active discussions.
func (a *App) activeItemIDs() []string {
	tasks := a.tasks.List()
	reviews := a.prReviews.List()
	discussions := a.discussions.List()
	ids := make([]string, 0, len(tasks)+len(reviews)+len(discussions))
	for _, t := range tasks {
		ids = append(ids, t.ID)
	}
	for _, r := range reviews {
		ids = append(ids, r.ID)
	}
	for _, d := range discussions {
		ids = append(ids, d.ID)
	}
	return ids
}

// itemCounts are how many items of a repository are active and archived: its
// tasks and the reviews of its pull requests together.
func (a *App) itemCounts(repositoryID string) (active, archived int) {
	activeTasks, archivedTasks := a.tasks.Counts(repositoryID)
	activeReviews, archivedReviews := a.prReviews.Counts(repositoryID)
	return activeTasks + activeReviews, archivedTasks + archivedReviews
}

// taskPullRequests are the pull requests the active tasks of the product own,
// which are reviewed in the task and never on their own.
func (a *App) taskPullRequests() []reviewflow.TaskPR {
	var prs []reviewflow.TaskPR
	for _, t := range a.tasks.List() {
		if t.Stage != task.StagePR {
			continue
		}
		run, ok := a.tasks.PRRun(t.ID)
		if !ok || run.PR.Number == 0 {
			continue
		}
		prs = append(prs, reviewflow.TaskPR{TaskID: t.ID, RepositoryID: t.RepositoryID, Number: run.PR.Number})
	}
	return prs
}

// hasConversation says whether an id names an item of another kind with a
// conversation of its own: a review of a pull request or a discussion, active
// or archived. It is what tells those conversations from the one of a task.
func (a *App) hasConversation(id string) bool {
	if _, ok := a.prReviews.Get(id); ok {
		return true
	}
	_, ok := a.discussions.Lookup(id)
	return ok
}

// onRepositoryPathChanged reloads the worktrees, whose clone moved with the
// repository.
func (a *App) onRepositoryPathChanged(string) {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := a.worktrees.Sync(ctx, a.activeItemIDs()); err != nil {
		a.log.Error("sync worktrees failed", "err", err)
	}
}

// shutdown stops the situations, every session, the notifications, the chime
// and the watchers while the window is still closing, so that no CLI process and
// no notification outlives the app.
func (a *App) shutdown() {
	ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()

	a.attention.Close()
	a.flow.Close()
	a.reviewFlow.Close()
	a.discussionFlow.Close()
	a.pulls.Close()
	a.sessions.Shutdown(ctx)
	// The notifications go with the app: one left behind would lead nowhere.
	if a.notifier != nil {
		a.notifier.Close()
	}
	// After the notifier, which is what rings it: a chime still playing is cut
	// off rather than waited for.
	if a.player != nil {
		a.player.Close()
	}
	if err := a.review.Close(); err != nil {
		a.log.Error("close review watcher failed", "err", err)
	}
	if err := a.tasks.Close(); err != nil {
		a.log.Error("close artifact watcher failed", "err", err)
	}
	a.log.Info("sessions stopped")
}

// setWails records the application handle for the callbacks that run after it
// exists.
func (a *App) setWails(wails *application.App) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.wails = wails
}

// handles returns the Wails handles, either of which is nil before it is built.
func (a *App) handles() (*application.App, *application.WebviewWindow) {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.wails, a.window
}

// fail reports a startup failure and returns the process exit code. It always
// writes to stderr because a production build does not log there, and the user
// running the binary from a terminal deserves to see why it gave up.
func fail(log *slog.Logger, step string, err error) int {
	if log != nil {
		log.Error("startup failed", "step", step, "err", err)
	}
	fmt.Fprintf(os.Stderr, "myspec: %s: %v\n", step, err)
	return exitFailure
}

// logLevel reads the app log level from MYSPEC_LOG_LEVEL.
func logLevel() slog.Level {
	switch strings.ToLower(os.Getenv("MYSPEC_LOG_LEVEL")) {
	case "debug":
		return slog.LevelDebug
	case "warn":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

// wailsLogLevel keeps the Wails system logger quiet in production.
func wailsLogLevel() slog.Level {
	if production {
		return slog.LevelWarn
	}
	return slog.LevelInfo
}
