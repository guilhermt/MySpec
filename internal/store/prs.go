package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/guilhermt/myspec/internal/task"
)

// prColumns is the column list every PR run query selects, in scan order.
const prColumns = `task_id, repo_path, status, block_reason, block_detail,
	pr_number, pr_url, pr_state, pr_checked_at, pr_base, reviewed_commit, reported_pass,
	close_result, created_at, updated_at`

// ListPRRuns returns what the app recorded about the PR stage of every
// repository of a task, by repository.
func (r *TasksRepo) ListPRRuns(ctx context.Context, taskID string) ([]task.PRRun, error) {
	const query = `SELECT ` + prColumns + ` FROM pr_runs WHERE task_id = ? ORDER BY repo_path`

	rows, err := r.db.QueryContext(ctx, query, taskID)
	if err != nil {
		return nil, fmt.Errorf("list pr runs of task %s: %w", taskID, err)
	}
	defer func() { _ = rows.Close() }()

	var runs []task.PRRun
	for rows.Next() {
		run, err := scanPRRun(rows)
		if err != nil {
			return nil, err
		}
		runs = append(runs, run)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list pr runs of task %s: %w", taskID, err)
	}
	return runs, nil
}

// UpsertPRRun stores the state of the PR stage of a repository, rewriting what
// was there.
func (r *TasksRepo) UpsertPRRun(ctx context.Context, run task.PRRun) error {
	const stmt = `INSERT INTO pr_runs (` + prColumns + `) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT (task_id, repo_path) DO UPDATE SET
			status = excluded.status,
			block_reason = excluded.block_reason,
			block_detail = excluded.block_detail,
			pr_number = excluded.pr_number,
			pr_url = excluded.pr_url,
			pr_state = excluded.pr_state,
			pr_checked_at = excluded.pr_checked_at,
			pr_base = excluded.pr_base,
			reviewed_commit = excluded.reviewed_commit,
			reported_pass = excluded.reported_pass,
			close_result = excluded.close_result,
			updated_at = excluded.updated_at`

	var block task.PRBlock
	if run.Block != nil {
		block = *run.Block
	}
	closeResult, err := encodeCloseResult(run.Close)
	if err != nil {
		return fmt.Errorf("upsert pr run of %s in task %s: %w", run.RepoPath, run.TaskID, err)
	}
	_, err = r.db.ExecContext(ctx, stmt, run.TaskID, run.RepoPath, string(run.Status),
		nullString(string(block.Reason)), nullString(block.Detail),
		run.PR.Number, run.PR.URL, string(run.PR.State), nullTime(run.PR.CheckedAt), run.PR.Base,
		run.ReviewedCommit, run.ReportedPass, closeResult,
		formatTime(run.CreatedAt), formatTime(run.UpdatedAt))
	if err != nil {
		return fmt.Errorf("upsert pr run of %s in task %s: %w", run.RepoPath, run.TaskID, err)
	}
	return nil
}

// DeletePRRuns removes the PR stage of every repository of a task. Missing
// rows are not an error.
func (r *TasksRepo) DeletePRRuns(ctx context.Context, taskID string) error {
	const stmt = `DELETE FROM pr_runs WHERE task_id = ?`

	if _, err := r.db.ExecContext(ctx, stmt, taskID); err != nil {
		return fmt.Errorf("delete pr runs of task %s: %w", taskID, err)
	}
	return nil
}

func scanPRRun(row scanner) (task.PRRun, error) {
	var (
		run                  task.PRRun
		status, state        string
		reason, detail       sql.NullString
		checkedAt            sql.NullString
		closeResult          string
		createdAt, updatedAt string
	)
	err := row.Scan(&run.TaskID, &run.RepoPath, &status, &reason, &detail,
		&run.PR.Number, &run.PR.URL, &state, &checkedAt, &run.PR.Base,
		&run.ReviewedCommit, &run.ReportedPass, &closeResult, &createdAt, &updatedAt)
	if err != nil {
		return task.PRRun{}, fmt.Errorf("scan pr run: %w", err)
	}

	subject := fmt.Sprintf("pr run of %s in task %s", run.RepoPath, run.TaskID)
	if run.Status, err = task.ParsePRStatus(status); err != nil {
		return task.PRRun{}, fmt.Errorf("read %s: %w", subject, err)
	}
	if run.Close, err = decodeCloseResult(closeResult); err != nil {
		return task.PRRun{}, fmt.Errorf("read %s: %w", subject, err)
	}
	if run.PR.State, err = task.ParsePRState(state); err != nil {
		return task.PRRun{}, fmt.Errorf("read %s: %w", subject, err)
	}
	if reason.Valid {
		parsed, parseErr := task.ParsePRBlockReason(reason.String)
		if parseErr != nil {
			return task.PRRun{}, fmt.Errorf("read %s: %w", subject, parseErr)
		}
		run.Block = &task.PRBlock{Reason: parsed, Detail: detail.String}
	}
	if checkedAt.Valid {
		if run.PR.CheckedAt, err = parseTime(checkedAt.String, subject); err != nil {
			return task.PRRun{}, err
		}
	}
	if run.CreatedAt, err = parseTime(createdAt, subject); err != nil {
		return task.PRRun{}, err
	}
	if run.UpdatedAt, err = parseTime(updatedAt, subject); err != nil {
		return task.PRRun{}, err
	}
	return run, nil
}

// encodeCloseResult is the JSON of a close result, "" for none.
func encodeCloseResult(result *task.CloseResult) (string, error) {
	if result == nil {
		return "", nil
	}
	encoded, err := json.Marshal(result)
	if err != nil {
		return "", fmt.Errorf("encode close result: %w", err)
	}
	return string(encoded), nil
}

// decodeCloseResult reads the JSON back, nil for "".
func decodeCloseResult(value string) (*task.CloseResult, error) {
	if value == "" {
		return nil, nil
	}
	var result task.CloseResult
	if err := json.Unmarshal([]byte(value), &result); err != nil {
		return nil, fmt.Errorf("decode close result: %w", err)
	}
	return &result, nil
}
