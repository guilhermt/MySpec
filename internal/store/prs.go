package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/task"
)

// prColumns is the column list every PR run query selects, in scan order.
const prColumns = `task_id, status, block_reason, block_detail,
	pr_number, pr_url, pr_state, pr_checked_at, pr_base, reviewed_commit, reported_pass,
	close_result, trouble_baseline, trouble, checks, mergeable, created_at, updated_at`

// GetPRRun returns what the app recorded about the PR stage of a task. ok is
// false before the stage.
func (r *TasksRepo) GetPRRun(ctx context.Context, taskID string) (task.PRRun, bool, error) {
	const query = `SELECT ` + prColumns + ` FROM pr_runs WHERE task_id = ?`

	run, err := scanPRRun(r.db.QueryRowContext(ctx, query, taskID))
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return task.PRRun{}, false, nil
	case err != nil:
		return task.PRRun{}, false, err
	}
	return run, true, nil
}

// UpsertPRRun stores the state of the PR stage of a task, rewriting what was
// there.
func (r *TasksRepo) UpsertPRRun(ctx context.Context, run task.PRRun) error {
	const stmt = `INSERT INTO pr_runs (` + prColumns + `) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT (task_id) DO UPDATE SET
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
			trouble_baseline = excluded.trouble_baseline,
			trouble = excluded.trouble,
			checks = excluded.checks,
			mergeable = excluded.mergeable,
			updated_at = excluded.updated_at`

	var block task.PRBlock
	if run.Block != nil {
		block = *run.Block
	}
	closeResult, err := encodeCloseResult(run.Close)
	if err != nil {
		return fmt.Errorf("upsert pr run of task %s: %w", run.TaskID, err)
	}
	baseline, err := encodeTrouble(run.TroubleBaseline)
	if err != nil {
		return fmt.Errorf("upsert pr run of task %s: %w", run.TaskID, err)
	}
	trouble, err := encodeTrouble(run.Trouble)
	if err != nil {
		return fmt.Errorf("upsert pr run of task %s: %w", run.TaskID, err)
	}
	checks, err := encodeChecks(run.PR.Checks)
	if err != nil {
		return fmt.Errorf("upsert pr run of task %s: %w", run.TaskID, err)
	}
	_, err = r.db.ExecContext(ctx, stmt, run.TaskID, string(run.Status),
		nullString(string(block.Reason)), nullString(block.Detail),
		run.PR.Number, run.PR.URL, string(run.PR.State), nullTime(run.PR.CheckedAt), run.PR.Base,
		run.ReviewedCommit, run.ReportedPass, closeResult, baseline, trouble, checks, string(run.PR.Mergeable),
		formatTime(run.CreatedAt), formatTime(run.UpdatedAt))
	if err != nil {
		return fmt.Errorf("upsert pr run of task %s: %w", run.TaskID, err)
	}
	return nil
}

// DeletePRRun removes the PR stage of a task. A missing row is not an error.
func (r *TasksRepo) DeletePRRun(ctx context.Context, taskID string) error {
	const stmt = `DELETE FROM pr_runs WHERE task_id = ?`

	if _, err := r.db.ExecContext(ctx, stmt, taskID); err != nil {
		return fmt.Errorf("delete pr run of task %s: %w", taskID, err)
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
		baseline, trouble    string
		checks, mergeable    string
		createdAt, updatedAt string
	)
	err := row.Scan(&run.TaskID, &status, &reason, &detail,
		&run.PR.Number, &run.PR.URL, &state, &checkedAt, &run.PR.Base,
		&run.ReviewedCommit, &run.ReportedPass, &closeResult, &baseline, &trouble,
		&checks, &mergeable, &createdAt, &updatedAt)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return task.PRRun{}, err
	case err != nil:
		return task.PRRun{}, fmt.Errorf("scan pr run: %w", err)
	}

	subject := "pr run of task " + run.TaskID
	if run.Status, err = task.ParsePRStatus(status); err != nil {
		return task.PRRun{}, fmt.Errorf("read %s: %w", subject, err)
	}
	if run.Close, err = decodeCloseResult(closeResult); err != nil {
		return task.PRRun{}, fmt.Errorf("read %s: %w", subject, err)
	}
	if run.TroubleBaseline, err = decodeTrouble(baseline); err != nil {
		return task.PRRun{}, fmt.Errorf("read %s: %w", subject, err)
	}
	if run.Trouble, err = decodeTrouble(trouble); err != nil {
		return task.PRRun{}, fmt.Errorf("read %s: %w", subject, err)
	}
	if run.PR.Checks, err = decodeChecks(checks); err != nil {
		return task.PRRun{}, fmt.Errorf("read %s: %w", subject, err)
	}
	run.PR.Mergeable = gh.Mergeable(mergeable)
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
