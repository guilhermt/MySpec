// Package upgrade carries the tasks of a database that still holds workspaces
// into registered repositories: it finds the repository of every task, refuses
// what it cannot carry, and moves the artifacts to the folder of each task.
// store runs it in the transaction of the migration that registers the
// repositories.
package upgrade

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/guilhermt/myspec/internal/repository"
	"github.com/guilhermt/myspec/internal/store"
	"github.com/guilhermt/myspec/internal/task"
)

// CaseKind is what keeps a task from being carried over.
type CaseKind string

// The cases that refuse the upgrade.
const (
	CaseRootTask     CaseKind = "root_task"     // an active task at the root of a workspace
	CaseNoOrigin     CaseKind = "no_origin"     // the clone of a task is gone or has no origin on GitHub
	CaseNameConflict CaseKind = "name_conflict" // two tasks share a name in one repository
)

// Entry is one task a case is about.
type Entry struct {
	Task      string // the name of the task
	Workspace string // the workspace it was created in
	Path      string // the clone it belongs to; "" for a task at the root
}

// Case is one reason the upgrade was refused.
type Case struct {
	Kind       CaseKind
	Repository string // no_origin: the path of the clone; name_conflict: owner/name; root_task: ""
	Detail     string // no_origin: why, in the words of repository.Refusal
	Entries    []Entry
}

// RefusedError is an upgrade that could not carry every task, with every case
// that kept it from doing so. Nothing was changed.
type RefusedError struct{ Cases []Case }

func (e *RefusedError) Error() string {
	return fmt.Sprintf("upgrade: refused, %d cases to resolve", len(e.Cases))
}

// Deps are what the upgrade needs from the outside.
type Deps struct {
	Identify func(ctx context.Context, path string) (repository.Identity, error)
	DataDir  string
	Log      *slog.Logger
	Now      func() time.Time // defaults to time.Now
	NewID    func() string    // defaults to uuid.NewString
}

// workspacesDirName is the folder a version with workspaces kept the artifacts
// of its tasks in, thrown away once the upgrade committed.
const workspacesDirName = "workspaces"

// dirPerm is the mode of the folders the upgrade creates on the way to the
// folder of a task, which only the user reads.
const dirPerm = 0o700

// New builds the upgrade store.Open runs.
func New(deps Deps) store.Upgrade {
	if deps.Log == nil {
		deps.Log = slog.New(slog.DiscardHandler)
	}
	if deps.Now == nil {
		deps.Now = time.Now
	}
	if deps.NewID == nil {
		deps.NewID = uuid.NewString
	}
	return func(ctx context.Context, legacy []store.LegacyTask) (store.UpgradePlan, error) {
		return (&run{deps: deps}).carry(ctx, legacy)
	}
}

// run is one pass of the upgrade, holding what it moved on disk so that it can
// be taken back.
type run struct {
	deps  Deps
	moved []move
}

// move is one rename the upgrade did.
type move struct{ from, to string }

// carried is a task the upgrade can carry over, with the repository its clone
// belongs to.
type carried struct {
	legacy   store.LegacyTask
	identity repository.Identity
}

// carry decides what becomes of every task of a version with workspaces.
func (r *run) carry(ctx context.Context, legacy []store.LegacyTask) (store.UpgradePlan, error) {
	roots, dropped, rest := split(legacy)

	tasks, noOrigin, err := r.identify(ctx, rest)
	if err != nil {
		return store.UpgradePlan{}, err
	}
	if cases := slices.Concat(roots, noOrigin, conflicts(tasks)); len(cases) > 0 {
		return store.UpgradePlan{}, &RefusedError{Cases: cases}
	}

	repositories, byRepository := r.register(tasks)
	upgraded, err := r.carryTasks(tasks, byRepository)
	if err != nil {
		return store.UpgradePlan{}, err
	}

	discarded := make([]string, len(dropped))
	folders := make([]string, len(dropped))
	for i, t := range dropped {
		discarded[i], folders[i] = t.ID, t.ArtifactsDir
	}

	r.deps.Log.Info("upgrade planned",
		"repositories", len(repositories), "tasks", len(upgraded), "discarded", len(discarded))

	return store.UpgradePlan{
		Repositories: repositories,
		Tasks:        upgraded,
		Discarded:    discarded,
		Undo:         r.undo,
		Done:         func() { r.cleanUp(folders) },
	}, nil
}

// split tells the tasks of the root of a workspace from the tasks of a clone.
// An active task at the root refuses the upgrade, because it has no single
// repository to belong to; an archived one is thrown away.
func split(legacy []store.LegacyTask) (roots []Case, discarded, rest []store.LegacyTask) {
	for _, t := range legacy {
		switch {
		case t.RepoPath != "":
			rest = append(rest, t)
		case t.ArchivedAt.IsZero():
			roots = append(roots, Case{Kind: CaseRootTask, Entries: entries([]store.LegacyTask{t})})
		default:
			discarded = append(discarded, t)
		}
	}
	return roots, discarded, rest
}

// identify reads the repository of every clone the tasks name, asking about
// each clone once. A clone the app refuses becomes a case; any other failure
// stops the upgrade, because it says nothing about the data.
func (r *run) identify(ctx context.Context, legacy []store.LegacyTask) ([]carried, []Case, error) {
	paths, byPath := group(legacy, func(t store.LegacyTask) string { return t.RepoPath })

	var cases []Case
	identities := make(map[string]repository.Identity, len(paths))
	for _, path := range paths {
		identity, err := r.deps.Identify(ctx, path)
		var refusal *repository.Refusal
		switch {
		case errors.As(err, &refusal):
			cases = append(cases, Case{
				Kind:       CaseNoOrigin,
				Repository: path,
				Detail:     refusal.Message(),
				Entries:    entries(byPath[path]),
			})
		case err != nil:
			return nil, nil, fmt.Errorf("identify %s: %w", path, err)
		default:
			identities[path] = identity
		}
	}

	tasks := make([]carried, 0, len(legacy))
	for _, t := range legacy {
		if identity, ok := identities[t.RepoPath]; ok {
			tasks = append(tasks, carried{legacy: t, identity: identity})
		}
	}
	return tasks, cases, nil
}

// conflicts are the tasks that share a name in one repository, which no
// repository can hold because a name is what its branch is called.
func conflicts(tasks []carried) []Case {
	// The key joins the repository and the name of the task on a byte neither
	// of them can hold, so that sorting it sorts by repository and then name.
	keys, byName := group(tasks, func(c carried) string {
		return strings.ToLower(c.identity.FullName()) + "\x00" + c.legacy.Name
	})

	var cases []Case
	for _, key := range keys {
		sharing := byName[key]
		if len(sharing) < 2 {
			continue
		}
		cases = append(cases, Case{
			Kind:       CaseNameConflict,
			Repository: sharing[0].identity.FullName(),
			Entries:    entries(legacyOf(sharing)),
		})
	}
	return cases
}

// register is one repository per identity, tied to the clone the latest task of
// that repository was working in.
func (r *run) register(tasks []carried) ([]repository.Repository, map[string]repository.Repository) {
	keys, byIdentity := group(tasks, func(c carried) string {
		return strings.ToLower(c.identity.FullName())
	})

	now := r.deps.Now().UTC()
	registered := make([]repository.Repository, 0, len(keys))
	byRepository := make(map[string]repository.Repository, len(keys))
	for _, key := range keys {
		latest := slices.MaxFunc(byIdentity[key], func(a, b carried) int {
			return recency(a.legacy, b.legacy)
		})
		repo := repository.Repository{
			ID:        r.deps.NewID(),
			Owner:     latest.identity.Owner,
			Name:      latest.identity.Name,
			Path:      latest.legacy.RepoPath,
			CreatedAt: now,
		}
		registered = append(registered, repo)
		byRepository[key] = repo
	}
	return registered, byRepository
}

// recency orders two tasks by how recently they were worked in: an active task
// comes after an archived one, active tasks by creation and archived ones by
// the instant they were archived.
func recency(a, b store.LegacyTask) int {
	activeA, activeB := a.ArchivedAt.IsZero(), b.ArchivedAt.IsZero()
	if activeA != activeB {
		if activeA {
			return 1
		}
		return -1
	}
	if activeA {
		return a.CreatedAt.Compare(b.CreatedAt)
	}
	return a.ArchivedAt.Compare(b.ArchivedAt)
}

// carryTasks ties every task to its repository and moves its artifacts to the
// folder it lives in from now on. A move that fails takes back the ones before
// it, so that a refused upgrade leaves the disk as it found it.
func (r *run) carryTasks(
	tasks []carried,
	byRepository map[string]repository.Repository,
) ([]store.UpgradedTask, error) {
	upgraded := make([]store.UpgradedTask, 0, len(tasks))
	for _, c := range tasks {
		repo := byRepository[strings.ToLower(c.identity.FullName())]
		dir := task.ArtifactsDir(r.deps.DataDir, repo.Owner, repo.Name, c.legacy.Name)
		if err := r.moveArtifacts(c.legacy, dir); err != nil {
			r.undo()
			return nil, err
		}
		upgraded = append(upgraded, store.UpgradedTask{
			ID:           c.legacy.ID,
			RepositoryID: repo.ID,
			ArtifactsDir: dir,
		})
	}
	return upgraded, nil
}

// moveArtifacts puts the folder of a task where it belongs now and renames the
// files of the PR stage, which no longer carry the slug of a repository.
func (r *run) moveArtifacts(legacy store.LegacyTask, dir string) error {
	if dir == legacy.ArtifactsDir {
		return r.renamePRFiles(dir)
	}
	if _, err := os.Lstat(dir); err == nil {
		return fmt.Errorf("artifacts of task %s: %s already exists", legacy.Name, dir)
	}
	switch _, err := os.Stat(legacy.ArtifactsDir); {
	case errors.Is(err, fs.ErrNotExist):
		return nil
	case err != nil:
		return fmt.Errorf("artifacts of task %s: %w", legacy.Name, err)
	}
	if err := os.MkdirAll(filepath.Dir(dir), dirPerm); err != nil {
		return fmt.Errorf("artifacts of task %s: %w", legacy.Name, err)
	}
	if err := r.rename(legacy.ArtifactsDir, dir); err != nil {
		return fmt.Errorf("artifacts of task %s: %w", legacy.Name, err)
	}
	return r.renamePRFiles(dir)
}

// legacyDraft is the name the draft of a pull request had while a task had one
// per repository: the slug of the repository before the file.
var legacyDraft = regexp.MustCompile(`^.+-draft\.md$`)

// legacyReview is the name a report of the PR review had, with the slug of the
// repository before the pass it reports on.
var legacyReview = regexp.MustCompile(`^.+-review-(\d+)\.md$`)

// renamePRFiles drops the slug of the repository from the draft and the reports
// of the PR stage of a task.
func (r *run) renamePRFiles(dir string) error {
	prDir := filepath.Join(dir, task.PRDirName)
	files, err := os.ReadDir(prDir)
	switch {
	case errors.Is(err, fs.ErrNotExist):
		return nil
	case err != nil:
		return fmt.Errorf("pr artifacts at %s: %w", prDir, err)
	}

	for _, file := range files {
		name := prFileName(file.Name())
		if name == "" {
			continue
		}
		to := filepath.Join(prDir, name)
		if _, err := os.Lstat(to); err == nil {
			return fmt.Errorf("pr artifacts at %s: %s already exists", prDir, to)
		}
		if err := r.rename(filepath.Join(prDir, file.Name()), to); err != nil {
			return fmt.Errorf("pr artifacts at %s: %w", prDir, err)
		}
	}
	return nil
}

// prFileName is what a file of the pr folder is called now, and "" for a file
// that is neither a draft nor a report of a pass.
func prFileName(name string) string {
	if legacyDraft.MatchString(name) {
		return task.DraftFile
	}
	match := legacyReview.FindStringSubmatch(name)
	if match == nil {
		return ""
	}
	pass, err := strconv.Atoi(match[1])
	if err != nil {
		return ""
	}
	return task.ReviewFile(pass)
}

// rename moves a file or a folder and records the move, so that undo can take
// it back. Everything the upgrade moves lives in the data directory, on one
// file system.
func (r *run) rename(from, to string) error {
	if err := os.Rename(from, to); err != nil {
		return err
	}
	r.moved = append(r.moved, move{from: from, to: to})
	return nil
}

// undo puts back everything the upgrade moved, the last move first: the files
// of a pr folder were renamed after the folder of the task moved, and they go
// back to their old names before the folder goes back to its old place. It runs
// when the migration does not commit.
func (r *run) undo() {
	for _, m := range slices.Backward(r.moved) {
		if err := os.Rename(m.to, m.from); err != nil {
			r.deps.Log.Warn("upgrade undo failed", "path", m.to, "error", err)
		}
	}
	r.moved = nil
}

// cleanUp throws away the artifacts of the tasks the upgrade discarded and the
// folder the workspaces kept them in. It runs once the migration committed.
func (r *run) cleanUp(folders []string) {
	for _, dir := range folders {
		r.remove(dir)
	}
	r.remove(filepath.Join(r.deps.DataDir, workspacesDirName))
}

// remove throws a folder away, reporting a failure to the log: the migration
// has committed, and what is left behind costs only disk.
func (r *run) remove(dir string) {
	if err := os.RemoveAll(dir); err != nil {
		r.deps.Log.Warn("upgrade cleanup failed", "path", dir, "error", err)
	}
}

// entries are the tasks of a case, as the screen of a refused migration lists
// them.
func entries(legacy []store.LegacyTask) []Entry {
	list := make([]Entry, len(legacy))
	for i, t := range legacy {
		list[i] = Entry{Task: t.Name, Workspace: t.WorkspacePath, Path: t.RepoPath}
	}
	return list
}

// legacyOf is the tasks behind what the upgrade carries.
func legacyOf(tasks []carried) []store.LegacyTask {
	list := make([]store.LegacyTask, len(tasks))
	for i, c := range tasks {
		list[i] = c.legacy
	}
	return list
}

// group buckets items by a key, returning the keys in order and what each one
// holds in the order the items came.
func group[T any](items []T, key func(T) string) ([]string, map[string][]T) {
	var keys []string
	byKey := make(map[string][]T, len(items))
	for _, item := range items {
		k := key(item)
		if _, ok := byKey[k]; !ok {
			keys = append(keys, k)
		}
		byKey[k] = append(byKey[k], item)
	}
	slices.Sort(keys)
	return keys, byKey
}
