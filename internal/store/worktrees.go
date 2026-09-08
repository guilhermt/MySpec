package store

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/guilhermt/myspec/internal/worktree"
)

// WorktreesRepo stores one worktree per repository a task touches. It
// implements worktree.Store.
type WorktreesRepo struct{ db *sql.DB }

// worktreeColumns is the column list every worktree query selects, in scan
// order.
const worktreeColumns = `task_id, repo_path, path, branch, base, created_at`

// ListByTasks returns the worktrees registered for the given tasks. An empty
// list of tasks asks the database nothing.
func (r *WorktreesRepo) ListByTasks(ctx context.Context, taskIDs []string) ([]worktree.Worktree, error) {
	if len(taskIDs) == 0 {
		return nil, nil
	}

	args := make([]any, len(taskIDs))
	for i, id := range taskIDs {
		args[i] = id
	}
	// The only thing built into the statement is one placeholder per task; the
	// ids themselves travel as arguments.
	//nolint:gosec // G202: the concatenated text is a placeholder list, not data
	query := `SELECT ` + worktreeColumns + ` FROM worktrees WHERE task_id IN (?` +
		strings.Repeat(", ?", len(taskIDs)-1) + `) ORDER BY task_id, repo_path`

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list worktrees: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var list []worktree.Worktree
	for rows.Next() {
		wt, scanErr := scanWorktree(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		list = append(list, wt)
	}
	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("list worktrees: %w", err)
	}
	return list, nil
}

// Insert stores a new worktree.
func (r *WorktreesRepo) Insert(ctx context.Context, wt worktree.Worktree) error {
	const stmt = `INSERT INTO worktrees (` + worktreeColumns + `) VALUES (?, ?, ?, ?, ?, ?)`

	_, err := r.db.ExecContext(ctx, stmt, wt.TaskID, wt.RepoPath, wt.Path, wt.Branch, wt.Base,
		formatTime(wt.CreatedAt))
	if err != nil {
		return fmt.Errorf("insert worktree %s: %w", wt.Path, err)
	}
	return nil
}

// Delete removes the worktree of a task in a repository. A missing row is not
// an error.
func (r *WorktreesRepo) Delete(ctx context.Context, taskID, repoPath string) error {
	const stmt = `DELETE FROM worktrees WHERE task_id = ? AND repo_path = ?`

	if _, err := r.db.ExecContext(ctx, stmt, taskID, repoPath); err != nil {
		return fmt.Errorf("delete worktree of task %s in %s: %w", taskID, repoPath, err)
	}
	return nil
}

func scanWorktree(row scanner) (worktree.Worktree, error) {
	var (
		wt        worktree.Worktree
		createdAt string
	)
	if err := row.Scan(&wt.TaskID, &wt.RepoPath, &wt.Path, &wt.Branch, &wt.Base, &createdAt); err != nil {
		return worktree.Worktree{}, fmt.Errorf("scan worktree: %w", err)
	}

	var err error
	if wt.CreatedAt, err = parseTime(createdAt, "worktree "+wt.Path); err != nil {
		return worktree.Worktree{}, err
	}
	return wt, nil
}
