package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/guilhermt/myspec/internal/repository"
)

// LegacyTask is a task as a version with workspaces stored it: what an Upgrade
// needs to find its repository.
type LegacyTask struct {
	ID            string
	Name          string
	WorkspacePath string
	RepoPath      string // "" for a task created at the root of its workspace
	ArtifactsDir  string
	CreatedAt     time.Time
	ArchivedAt    time.Time // zero for a task that was not archived
}

// UpgradedTask is a task an Upgrade carried over: its repository and the folder
// its artifacts live in from now on.
type UpgradedTask struct {
	ID           string
	RepositoryID string
	ArtifactsDir string
}

// UpgradePlan is what an Upgrade decided: the repositories to register, the
// tasks to tie to them and the archived tasks to throw away. Undo takes back what
// the upgrade did outside the database, and runs when the migration does not
// commit; Done runs once it committed. Neither is ever nil.
type UpgradePlan struct {
	Repositories []repository.Repository
	Tasks        []UpgradedTask
	Discarded    []string // ids of the tasks to delete
	Undo         func()
	Done         func()
}

// Upgrade carries the tasks of a version with workspaces into registered
// repositories. It runs inside the transaction of migration 0012 and refuses
// with an error when it cannot carry every task; nothing is written then.
type Upgrade func(ctx context.Context, legacy []LegacyTask) (UpgradePlan, error)

// errUpgradeMissing is a database with tasks of a workspace opened without an
// upgrade to carry them.
var errUpgradeMissing = errors.New("store: the tasks of a workspace need an upgrade")

// repositoriesVersion is the migration whose transaction runs the upgrade.
const repositoriesVersion = 12

// noPlan is the plan of a migration that has nothing to carry over.
func noPlan() UpgradePlan {
	return UpgradePlan{Undo: func() {}, Done: func() {}}
}

// upgradeTasks runs the upgrade over the tasks a version with workspaces left
// behind and applies what it decided. A database without them needs no upgrade.
func upgradeTasks(ctx context.Context, tx *sql.Tx, upgrade Upgrade) (UpgradePlan, error) {
	legacy, err := readLegacyTasks(ctx, tx)
	if err != nil {
		return noPlan(), err
	}
	if len(legacy) == 0 {
		return noPlan(), nil
	}
	if upgrade == nil {
		return noPlan(), errUpgradeMissing
	}

	// An upgrade that fails takes back what it did outside the database, so
	// its error travels as it came.
	plan, err := upgrade(ctx, legacy)
	if err != nil {
		return noPlan(), err
	}
	if err := applyPlan(ctx, tx, plan); err != nil {
		plan.Undo()
		return noPlan(), err
	}
	return plan, nil
}

// readLegacyTasks reads every task of the database as the upgrade sees it.
func readLegacyTasks(ctx context.Context, tx *sql.Tx) ([]LegacyTask, error) {
	const query = `SELECT id, name, workspace_path, repo_path, artifacts_dir, created_at, archived_at
		FROM tasks ORDER BY created_at, id`

	rows, err := tx.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("read the tasks to upgrade: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var legacy []LegacyTask
	for rows.Next() {
		t, scanErr := scanLegacyTask(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		legacy = append(legacy, t)
	}
	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("read the tasks to upgrade: %w", err)
	}
	return legacy, nil
}

func scanLegacyTask(row scanner) (LegacyTask, error) {
	var (
		t          LegacyTask
		repoPath   sql.NullString
		createdAt  string
		archivedAt sql.NullString
	)
	if err := row.Scan(&t.ID, &t.Name, &t.WorkspacePath, &repoPath, &t.ArtifactsDir,
		&createdAt, &archivedAt); err != nil {
		return LegacyTask{}, fmt.Errorf("scan the task to upgrade: %w", err)
	}
	t.RepoPath = repoPath.String

	var err error
	if t.CreatedAt, err = parseTime(createdAt, "task "+t.ID); err != nil {
		return LegacyTask{}, err
	}
	if archivedAt.Valid {
		if t.ArchivedAt, err = parseTime(archivedAt.String, "task "+t.ID); err != nil {
			return LegacyTask{}, err
		}
	}
	return t, nil
}

// applyPlan writes what the upgrade decided: the repositories it registered,
// the tasks it tied to them and the tasks it threw away.
func applyPlan(ctx context.Context, tx *sql.Tx, plan UpgradePlan) error {
	const register = `INSERT INTO repositories (id, owner, name, path, created_at) VALUES (?, ?, ?, ?, ?)`
	for _, repo := range plan.Repositories {
		if _, err := tx.ExecContext(ctx, register, repo.ID, repo.Owner, repo.Name, repo.Path,
			formatTime(repo.CreatedAt)); err != nil {
			return fmt.Errorf("register repository %s: %w", repo.FullName(), err)
		}
	}

	const tie = `UPDATE tasks SET repository_id = ?, artifacts_dir = ? WHERE id = ?`
	for _, t := range plan.Tasks {
		if _, err := tx.ExecContext(ctx, tie, t.RepositoryID, t.ArtifactsDir, t.ID); err != nil {
			return fmt.Errorf("tie task %s to its repository: %w", t.ID, err)
		}
	}

	// Deleting a task takes its sessions, entries, steps, worktrees, PR runs
	// and situations with it.
	const discard = `DELETE FROM tasks WHERE id = ?`
	for _, id := range plan.Discarded {
		if _, err := tx.ExecContext(ctx, discard, id); err != nil {
			return fmt.Errorf("discard task %s: %w", id, err)
		}
	}
	return nil
}
