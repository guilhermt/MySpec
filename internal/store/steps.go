package store

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/guilhermt/myspec/internal/task"
)

// stepColumns is the column list every step query selects, in scan order.
const stepColumns = `task_id, number, status, block_reason, block_detail, block_files,
	created_at, updated_at, start_commit, commit_sha, commit_subject`

// ListStepRuns returns what the app recorded about the steps of a task, by
// number.
func (r *TasksRepo) ListStepRuns(ctx context.Context, taskID string) ([]task.StepRun, error) {
	const query = `SELECT ` + stepColumns + ` FROM steps WHERE task_id = ? ORDER BY number`

	rows, err := r.db.QueryContext(ctx, query, taskID)
	if err != nil {
		return nil, fmt.Errorf("list steps of task %s: %w", taskID, err)
	}
	defer func() { _ = rows.Close() }()

	var runs []task.StepRun
	for rows.Next() {
		run, err := scanStepRun(rows)
		if err != nil {
			return nil, err
		}
		runs = append(runs, run)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list steps of task %s: %w", taskID, err)
	}
	return runs, nil
}

// UpsertStepRun stores the state of a step, rewriting what was there.
func (r *TasksRepo) UpsertStepRun(ctx context.Context, run task.StepRun) error {
	const stmt = `INSERT INTO steps (` + stepColumns + `) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT (task_id, number) DO UPDATE SET
			status = excluded.status,
			block_reason = excluded.block_reason,
			block_detail = excluded.block_detail,
			block_files = excluded.block_files,
			updated_at = excluded.updated_at,
			start_commit = excluded.start_commit,
			commit_sha = excluded.commit_sha,
			commit_subject = excluded.commit_subject`

	var block task.StepBlock
	if run.Block != nil {
		block = *run.Block
	}
	_, err := r.db.ExecContext(ctx, stmt, run.TaskID, run.Number, string(run.Status),
		nullString(string(block.Reason)), nullString(block.Detail), block.Files,
		formatTime(run.CreatedAt), formatTime(run.UpdatedAt),
		run.StartCommit, run.CommitSHA, run.CommitSubject)
	if err != nil {
		return fmt.Errorf("upsert step %d of task %s: %w", run.Number, run.TaskID, err)
	}
	return nil
}

// DeleteStepRuns removes every step of a task. Missing steps are not an error.
func (r *TasksRepo) DeleteStepRuns(ctx context.Context, taskID string) error {
	const stmt = `DELETE FROM steps WHERE task_id = ?`

	if _, err := r.db.ExecContext(ctx, stmt, taskID); err != nil {
		return fmt.Errorf("delete steps of task %s: %w", taskID, err)
	}
	return nil
}

func scanStepRun(row scanner) (task.StepRun, error) {
	var (
		run                  task.StepRun
		status               string
		reason, detail       sql.NullString
		files                int
		createdAt, updatedAt string
	)
	err := row.Scan(&run.TaskID, &run.Number, &status, &reason, &detail, &files, &createdAt, &updatedAt,
		&run.StartCommit, &run.CommitSHA, &run.CommitSubject)
	if err != nil {
		return task.StepRun{}, fmt.Errorf("scan step: %w", err)
	}

	subject := fmt.Sprintf("step %d of task %s", run.Number, run.TaskID)
	if run.Status, err = task.ParseStepStatus(status); err != nil {
		return task.StepRun{}, fmt.Errorf("read %s: %w", subject, err)
	}
	if reason.Valid {
		parsed, parseErr := task.ParseBlockReason(reason.String)
		if parseErr != nil {
			return task.StepRun{}, fmt.Errorf("read %s: %w", subject, parseErr)
		}
		run.Block = &task.StepBlock{Reason: parsed, Detail: detail.String, Files: files}
	}
	if run.CreatedAt, err = parseTime(createdAt, subject); err != nil {
		return task.StepRun{}, err
	}
	if run.UpdatedAt, err = parseTime(updatedAt, subject); err != nil {
		return task.StepRun{}, err
	}
	return run, nil
}
