package store

import (
	"context"
	"fmt"

	"github.com/guilhermt/myspec/internal/prreport"
	"github.com/guilhermt/myspec/internal/task"
)

// prPassColumns is the column list every pr pass query selects, in scan order.
//
//nolint:gosec // G101: "pass" is the review pass, not a credential
const prPassColumns = `task_id, pass, asked_at, recorded, clean, summary_original, revision, recorded_at, sent_at`

// prFindingColumns is the column list every pr finding query selects, in scan order.
const prFindingColumns = `task_id, pass, number, title, path, line, original, text, decision`

// ListPRPasses returns the structured passes of the review of the pull request
// of a task in order, each with its findings by number.
func (r *TasksRepo) ListPRPasses(ctx context.Context, taskID string) ([]task.PRPass, error) {
	const query = `SELECT ` + prPassColumns + ` FROM pr_passes WHERE task_id = ? ORDER BY pass`

	rows, err := r.db.QueryContext(ctx, query, taskID)
	if err != nil {
		return nil, fmt.Errorf("list pr passes of task %s: %w", taskID, err)
	}
	defer func() { _ = rows.Close() }()

	var passes []task.PRPass
	for rows.Next() {
		pass, scanErr := scanPRPass(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		passes = append(passes, pass)
	}
	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("list pr passes of task %s: %w", taskID, err)
	}

	findings, err := r.prFindings(ctx, taskID)
	if err != nil {
		return nil, err
	}
	for i := range passes {
		passes[i].Findings = findings[passes[i].Pass]
	}
	return passes, nil
}

// prFindings returns the findings of every structured pass of a task, by pass
// number.
func (r *TasksRepo) prFindings(ctx context.Context, taskID string) (map[int][]prreport.Finding, error) {
	const query = `SELECT ` + prFindingColumns + ` FROM pr_findings WHERE task_id = ? ORDER BY pass, number`

	rows, err := r.db.QueryContext(ctx, query, taskID)
	if err != nil {
		return nil, fmt.Errorf("list pr findings of task %s: %w", taskID, err)
	}
	defer func() { _ = rows.Close() }()

	byPass := map[int][]prreport.Finding{}
	for rows.Next() {
		pass, finding, scanErr := scanPRFinding(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		byPass[pass] = append(byPass[pass], finding)
	}
	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("list pr findings of task %s: %w", taskID, err)
	}
	return byPass, nil
}

// WritePRPass stores a structured pass with its findings, rewriting what was
// there, in one transaction.
func (r *TasksRepo) WritePRPass(ctx context.Context, pass task.PRPass) error {
	const upsert = `INSERT INTO pr_passes (` + prPassColumns + `) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT (task_id, pass) DO UPDATE SET
			asked_at = excluded.asked_at,
			recorded = excluded.recorded,
			clean = excluded.clean,
			summary_original = excluded.summary_original,
			revision = excluded.revision,
			recorded_at = excluded.recorded_at,
			sent_at = excluded.sent_at`
	const clearFindings = `DELETE FROM pr_findings WHERE task_id = ? AND pass = ?`
	const insertFinding = `INSERT INTO pr_findings (` + prFindingColumns + `) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin write pr pass %d of task %s: %w", pass.Pass, pass.TaskID, err)
	}
	defer func() { _ = tx.Rollback() }()

	_, err = tx.ExecContext(ctx, upsert, pass.TaskID, pass.Pass, formatTime(pass.AskedAt), pass.Recorded,
		pass.Clean, pass.SummaryOriginal, pass.Revision, formatTimeOrEmpty(pass.RecordedAt),
		formatTimeOrEmpty(pass.SentAt))
	if err != nil {
		return fmt.Errorf("upsert pr pass %d of task %s: %w", pass.Pass, pass.TaskID, err)
	}
	if _, err = tx.ExecContext(ctx, clearFindings, pass.TaskID, pass.Pass); err != nil {
		return fmt.Errorf("clear pr findings of pass %d of task %s: %w", pass.Pass, pass.TaskID, err)
	}
	for _, finding := range pass.Findings {
		_, err = tx.ExecContext(ctx, insertFinding, pass.TaskID, pass.Pass, finding.Number, finding.Title,
			finding.Path, finding.Line, finding.Original, finding.Text, string(finding.Decision))
		if err != nil {
			return fmt.Errorf("insert pr finding %d of pass %d of task %s: %w",
				finding.Number, pass.Pass, pass.TaskID, err)
		}
	}
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("commit write pr pass %d of task %s: %w", pass.Pass, pass.TaskID, err)
	}
	return nil
}

// UpdatePRFinding rewrites what the user decided and wrote about one finding of
// a structured pass.
func (r *TasksRepo) UpdatePRFinding(ctx context.Context, taskID string, pass int, finding prreport.Finding) error {
	const stmt = `UPDATE pr_findings SET text = ?, decision = ? WHERE task_id = ? AND pass = ? AND number = ?`

	_, err := r.db.ExecContext(ctx, stmt, finding.Text, string(finding.Decision), taskID, pass, finding.Number)
	if err != nil {
		return fmt.Errorf("update pr finding %d of pass %d of task %s: %w", finding.Number, pass, taskID, err)
	}
	return nil
}

// DeletePRPass removes a structured pass and, by cascade, its findings.
func (r *TasksRepo) DeletePRPass(ctx context.Context, taskID string, pass int) error {
	const stmt = `DELETE FROM pr_passes WHERE task_id = ? AND pass = ?`

	if _, err := r.db.ExecContext(ctx, stmt, taskID, pass); err != nil {
		return fmt.Errorf("delete pr pass %d of task %s: %w", pass, taskID, err)
	}
	return nil
}

// scanPRPass reads a pr pass row, without its findings.
func scanPRPass(row scanner) (task.PRPass, error) {
	var (
		pass                        task.PRPass
		askedAt, recordedAt, sentAt string
	)
	err := row.Scan(&pass.TaskID, &pass.Pass, &askedAt, &pass.Recorded, &pass.Clean, &pass.SummaryOriginal,
		&pass.Revision, &recordedAt, &sentAt)
	if err != nil {
		return task.PRPass{}, fmt.Errorf("scan pr pass: %w", err)
	}

	subject := fmt.Sprintf("pr pass %d of task %s", pass.Pass, pass.TaskID)
	if pass.AskedAt, err = parseTime(askedAt, subject); err != nil {
		return task.PRPass{}, err
	}
	if pass.RecordedAt, err = parseTimeOrEmpty(recordedAt, subject); err != nil {
		return task.PRPass{}, err
	}
	if pass.SentAt, err = parseTimeOrEmpty(sentAt, subject); err != nil {
		return task.PRPass{}, err
	}
	return pass, nil
}

// scanPRFinding reads a pr finding row and the pass it belongs to.
func scanPRFinding(row scanner) (int, prreport.Finding, error) {
	var (
		taskID   string
		pass     int
		decision string
		finding  prreport.Finding
	)
	err := row.Scan(&taskID, &pass, &finding.Number, &finding.Title, &finding.Path, &finding.Line,
		&finding.Original, &finding.Text, &decision)
	if err != nil {
		return 0, prreport.Finding{}, fmt.Errorf("scan pr finding: %w", err)
	}
	if finding.Decision, err = prreport.ParseDecision(decision); err != nil {
		return 0, prreport.Finding{}, fmt.Errorf("read pr finding %d of pass %d of task %s: %w",
			finding.Number, pass, taskID, err)
	}
	return pass, finding, nil
}
