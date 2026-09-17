package store

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/guilhermt/myspec/internal/repository"
)

// RepositoriesRepo stores the registered repositories. It implements
// repository.Store.
type RepositoriesRepo struct{ db *sql.DB }

// repositoryColumns is the column list every repository query selects, in scan
// order.
const repositoryColumns = `id, owner, name, path, board_id, review_instructions, created_at`

// List returns the registered repositories, in alphabetical order of
// owner/name.
func (r *RepositoriesRepo) List(ctx context.Context) ([]repository.Repository, error) {
	const query = `SELECT ` + repositoryColumns + ` FROM repositories
		ORDER BY owner COLLATE NOCASE, name COLLATE NOCASE, id`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("list repositories: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var list []repository.Repository
	for rows.Next() {
		repo, scanErr := scanRepository(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		list = append(list, repo)
	}
	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("list repositories: %w", err)
	}
	return list, nil
}

// Insert registers a new repository.
func (r *RepositoriesRepo) Insert(ctx context.Context, repo repository.Repository) error {
	const stmt = `INSERT INTO repositories (` + repositoryColumns + `) VALUES (?, ?, ?, ?, ?, ?, ?)`

	_, err := r.db.ExecContext(ctx, stmt, repo.ID, repo.Owner, repo.Name, repo.Path,
		nullString(repo.BoardID), repo.ReviewInstructions, formatTime(repo.CreatedAt))
	if err != nil {
		return fmt.Errorf("insert repository %s: %w", repo.FullName(), err)
	}
	return nil
}

// UpdatePath points a repository at another clone. The worktrees of its tasks
// follow it, because git runs them in the clone the repository has now.
func (r *RepositoriesRepo) UpdatePath(ctx context.Context, id, path string) error {
	const stmt = `UPDATE repositories SET path = ? WHERE id = ?`
	const worktrees = `UPDATE worktrees SET repo_path = ?
		WHERE item_id IN (SELECT id FROM tasks WHERE repository_id = ?)`

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin update repository path %s: %w", id, err)
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.ExecContext(ctx, stmt, path, id); err != nil {
		return fmt.Errorf("update repository path %s: %w", id, err)
	}
	if _, err := tx.ExecContext(ctx, worktrees, path, id); err != nil {
		return fmt.Errorf("update worktrees of repository %s: %w", id, err)
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit update repository path %s: %w", id, err)
	}
	return nil
}

// UpdateBoard sets the board that manages a repository, none with "".
func (r *RepositoriesRepo) UpdateBoard(ctx context.Context, id, boardID string) error {
	const stmt = `UPDATE repositories SET board_id = ? WHERE id = ?`

	if _, err := r.db.ExecContext(ctx, stmt, nullString(boardID), id); err != nil {
		return fmt.Errorf("update repository board %s: %w", id, err)
	}
	return nil
}

// UpdateReviewInstructions rewrites what goes into every review of a pull
// request of a repository.
func (r *RepositoriesRepo) UpdateReviewInstructions(ctx context.Context, id, text string) error {
	const stmt = `UPDATE repositories SET review_instructions = ? WHERE id = ?`

	if _, err := r.db.ExecContext(ctx, stmt, text, id); err != nil {
		return fmt.Errorf("update repository review instructions %s: %w", id, err)
	}
	return nil
}

// Delete removes a repository. A missing row is not an error.
func (r *RepositoriesRepo) Delete(ctx context.Context, id string) error {
	const stmt = `DELETE FROM repositories WHERE id = ?`

	if _, err := r.db.ExecContext(ctx, stmt, id); err != nil {
		return fmt.Errorf("delete repository %s: %w", id, err)
	}
	return nil
}

func scanRepository(row scanner) (repository.Repository, error) {
	var (
		repo      repository.Repository
		boardID   sql.NullString
		createdAt string
	)
	err := row.Scan(&repo.ID, &repo.Owner, &repo.Name, &repo.Path, &boardID,
		&repo.ReviewInstructions, &createdAt)
	if err != nil {
		return repository.Repository{}, fmt.Errorf("scan repository: %w", err)
	}

	repo.BoardID = boardID.String
	if repo.CreatedAt, err = parseTime(createdAt, "repository "+repo.ID); err != nil {
		return repository.Repository{}, err
	}
	return repo, nil
}
