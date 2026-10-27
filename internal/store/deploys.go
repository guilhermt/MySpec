package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/guilhermt/myspec/internal/deploys"
)

// DeploysRepo stores the deploys configuration of each board: whether they are
// on and the environments of each managed repository.
type DeploysRepo struct{ db *sql.DB }

// ListDeployConfigs returns the configuration of every board with one, by board
// id. A board lists only the repositories that are still its own.
func (r *DeploysRepo) ListDeployConfigs(ctx context.Context) ([]deploys.BoardConfig, error) {
	const boards = `SELECT board_id, enabled FROM board_deploys ORDER BY board_id`
	const repos = `SELECT d.board_id, d.repository_id, d.environments
		FROM deploy_repositories d
		JOIN repositories r ON r.id = d.repository_id AND r.board_id = d.board_id
		ORDER BY d.board_id, d.repository_id`

	rows, err := r.db.QueryContext(ctx, boards)
	if err != nil {
		return nil, fmt.Errorf("list deploys of boards: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var configs []deploys.BoardConfig
	index := map[string]int{}
	for rows.Next() {
		c := deploys.BoardConfig{Repositories: []deploys.RepositoryConfig{}}
		if err = rows.Scan(&c.BoardID, &c.Enabled); err != nil {
			return nil, fmt.Errorf("scan deploys of board: %w", err)
		}
		index[c.BoardID] = len(configs)
		configs = append(configs, c)
	}
	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("list deploys of boards: %w", err)
	}
	if len(configs) == 0 {
		return nil, nil
	}

	repoRows, err := r.db.QueryContext(ctx, repos)
	if err != nil {
		return nil, fmt.Errorf("list deploy repositories: %w", err)
	}
	defer func() { _ = repoRows.Close() }()

	for repoRows.Next() {
		var boardID, repositoryID, encoded string
		if err = repoRows.Scan(&boardID, &repositoryID, &encoded); err != nil {
			return nil, fmt.Errorf("scan deploy repository: %w", err)
		}
		rc := deploys.RepositoryConfig{RepositoryID: repositoryID}
		if err = json.Unmarshal([]byte(encoded), &rc.Environments); err != nil {
			return nil, fmt.Errorf("decode environments of repository %s: %w", repositoryID, err)
		}
		i, ok := index[boardID]
		if !ok {
			continue
		}
		configs[i].Repositories = append(configs[i].Repositories, rc)
	}
	if err = repoRows.Err(); err != nil {
		return nil, fmt.Errorf("list deploy repositories: %w", err)
	}
	return configs, nil
}

// SaveDeployConfig stores the configuration of a board, replacing the whole
// list of its repositories, in one transaction.
func (r *DeploysRepo) SaveDeployConfig(ctx context.Context, c deploys.BoardConfig) error {
	const board = `INSERT INTO board_deploys (board_id, enabled) VALUES (?, ?)
		ON CONFLICT (board_id) DO UPDATE SET enabled = excluded.enabled`
	const wipe = `DELETE FROM deploy_repositories WHERE board_id = ?`
	const insert = `INSERT INTO deploy_repositories (repository_id, board_id, environments) VALUES (?, ?, ?)`

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin save deploys of board %s: %w", c.BoardID, err)
	}
	defer func() { _ = tx.Rollback() }()

	if _, err = tx.ExecContext(ctx, board, c.BoardID, c.Enabled); err != nil {
		return fmt.Errorf("save deploys of board %s: %w", c.BoardID, err)
	}
	if _, err = tx.ExecContext(ctx, wipe, c.BoardID); err != nil {
		return fmt.Errorf("save deploys of board %s: %w", c.BoardID, err)
	}
	for _, repo := range c.Repositories {
		encoded, encodeErr := json.Marshal(repo.Environments)
		if encodeErr != nil {
			return fmt.Errorf("encode environments of repository %s: %w", repo.RepositoryID, encodeErr)
		}
		if _, err = tx.ExecContext(ctx, insert, repo.RepositoryID, c.BoardID, string(encoded)); err != nil {
			return fmt.Errorf("save deploys of board %s: %w", c.BoardID, err)
		}
	}
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("commit save deploys of board %s: %w", c.BoardID, err)
	}
	return nil
}
