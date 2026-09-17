package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/guilhermt/myspec/internal/prreview"
)

// ReviewsRepo implements the store of prreview.
var _ prreview.Store = (*ReviewsRepo)(nil)

// ReviewsRepo stores the reviews of pull requests, their passes and the
// findings of each pass. It implements prreview.Store.
type ReviewsRepo struct{ db *sql.DB }

// reviewColumns is the column list every review query selects, in scan order.
const reviewColumns = `id, repository_id, number, title, author, url, head_branch, base_branch,
	own, mode, phase, card, artifacts_dir, asked_pass, reported_pass, pass_commit,
	published_pass, published_commit, head_commit, pr_state, pr_checked_at, publish_error,
	archived_at, created_at, updated_at`

// passColumns is the column list every pass query selects, in scan order.
const passColumns = `review_id, pass, instructions, recorded, clean, commit_sha,
	summary_original, summary, revision, verdict, published_at, published_url, created_at`

// findingColumns is the column list every finding query selects, in scan order.
const findingColumns = `review_id, pass, number, path, line, original, text, decision, placement`

// ListActive returns the reviews that were not archived, in creation order.
func (r *ReviewsRepo) ListActive(ctx context.Context) ([]prreview.Review, error) {
	const query = `SELECT ` + reviewColumns + ` FROM reviews
		WHERE archived_at IS NULL ORDER BY created_at, id`

	return r.listReviews(ctx, query)
}

// ListArchived returns the archived reviews, the most recently archived first.
func (r *ReviewsRepo) ListArchived(ctx context.Context) ([]prreview.Review, error) {
	const query = `SELECT ` + reviewColumns + ` FROM reviews
		WHERE archived_at IS NOT NULL ORDER BY archived_at DESC, id`

	return r.listReviews(ctx, query)
}

// listReviews runs a query of the review columns.
func (r *ReviewsRepo) listReviews(ctx context.Context, query string) ([]prreview.Review, error) {
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("list reviews: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var list []prreview.Review
	for rows.Next() {
		review, scanErr := scanReview(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		list = append(list, review)
	}
	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("list reviews: %w", err)
	}
	return list, nil
}

// Insert stores a new review.
func (r *ReviewsRepo) Insert(ctx context.Context, review prreview.Review) error {
	const stmt = `INSERT INTO reviews (` + reviewColumns + `)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	card, err := encodeCard(review.Card)
	if err != nil {
		return fmt.Errorf("insert review %s: %w", review.ID, err)
	}
	_, err = r.db.ExecContext(ctx, stmt, review.ID, review.RepositoryID, review.Number, review.Title,
		review.Author, review.URL, review.HeadBranch, review.BaseBranch, review.Own,
		string(review.Mode), string(review.Phase), card, review.ArtifactsDir,
		review.AskedPass, review.ReportedPass, review.PassCommit,
		review.PublishedPass, review.PublishedCommit, review.HeadCommit,
		string(review.PRState), nullTime(review.PRCheckedAt), review.PublishError,
		nullTime(review.ArchivedAt), formatTime(review.CreatedAt), formatTime(review.UpdatedAt))
	if err != nil {
		return fmt.Errorf("insert review %s: %w", review.ID, err)
	}
	return nil
}

// Update rewrites every mutable column of a review but the instant it was
// archived, which UpdateArchived writes.
func (r *ReviewsRepo) Update(ctx context.Context, review prreview.Review) error {
	const stmt = `UPDATE reviews SET title = ?, author = ?, url = ?, head_branch = ?, base_branch = ?,
		own = ?, mode = ?, phase = ?, card = ?, asked_pass = ?, reported_pass = ?, pass_commit = ?,
		published_pass = ?, published_commit = ?, head_commit = ?, pr_state = ?, pr_checked_at = ?,
		publish_error = ?, updated_at = ?
		WHERE id = ?`

	card, err := encodeCard(review.Card)
	if err != nil {
		return fmt.Errorf("update review %s: %w", review.ID, err)
	}
	_, err = r.db.ExecContext(ctx, stmt, review.Title, review.Author, review.URL,
		review.HeadBranch, review.BaseBranch, review.Own, string(review.Mode), string(review.Phase),
		card, review.AskedPass, review.ReportedPass, review.PassCommit,
		review.PublishedPass, review.PublishedCommit, review.HeadCommit,
		string(review.PRState), nullTime(review.PRCheckedAt), review.PublishError,
		formatTime(review.UpdatedAt), review.ID)
	if err != nil {
		return fmt.Errorf("update review %s: %w", review.ID, err)
	}
	return nil
}

// UpdateArchived records the instant a review was archived.
func (r *ReviewsRepo) UpdateArchived(ctx context.Context, id string, archivedAt, updatedAt time.Time) error {
	const stmt = `UPDATE reviews SET archived_at = ?, updated_at = ? WHERE id = ?`

	if _, err := r.db.ExecContext(ctx, stmt, formatTime(archivedAt), formatTime(updatedAt), id); err != nil {
		return fmt.Errorf("update archived of review %s: %w", id, err)
	}
	return nil
}

// Delete removes a review and, by cascade, its session, its transcript, its
// worktree, its situations, its passes and their findings.
func (r *ReviewsRepo) Delete(ctx context.Context, id string) error {
	const stmt = `DELETE FROM reviews WHERE id = ?`

	if _, err := r.db.ExecContext(ctx, stmt, id); err != nil {
		return fmt.Errorf("delete review %s: %w", id, err)
	}
	return nil
}

// Passes returns the passes of a review in order, each with its findings by
// number.
func (r *ReviewsRepo) Passes(ctx context.Context, reviewID string) ([]prreview.Pass, error) {
	const query = `SELECT ` + passColumns + ` FROM review_passes WHERE review_id = ? ORDER BY pass`

	rows, err := r.db.QueryContext(ctx, query, reviewID)
	if err != nil {
		return nil, fmt.Errorf("list passes of review %s: %w", reviewID, err)
	}
	defer func() { _ = rows.Close() }()

	var passes []prreview.Pass
	for rows.Next() {
		pass, scanErr := scanPass(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		passes = append(passes, pass)
	}
	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("list passes of review %s: %w", reviewID, err)
	}

	findings, err := r.findings(ctx, reviewID)
	if err != nil {
		return nil, err
	}
	for i := range passes {
		passes[i].Findings = findings[passes[i].Number]
	}
	return passes, nil
}

// findings returns the findings of every pass of a review, by pass number.
func (r *ReviewsRepo) findings(ctx context.Context, reviewID string) (map[int][]prreview.Finding, error) {
	const query = `SELECT ` + findingColumns + ` FROM review_findings WHERE review_id = ?
		ORDER BY pass, number`

	rows, err := r.db.QueryContext(ctx, query, reviewID)
	if err != nil {
		return nil, fmt.Errorf("list findings of review %s: %w", reviewID, err)
	}
	defer func() { _ = rows.Close() }()

	byPass := map[int][]prreview.Finding{}
	for rows.Next() {
		pass, finding, scanErr := scanFinding(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		byPass[pass] = append(byPass[pass], finding)
	}
	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("list findings of review %s: %w", reviewID, err)
	}
	return byPass, nil
}

// UpsertPass stores a pass of a review, rewriting what was there. The findings
// are not part of it: ReplaceFindings writes them.
func (r *ReviewsRepo) UpsertPass(ctx context.Context, pass prreview.Pass) error {
	const stmt = `INSERT INTO review_passes (` + passColumns + `)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT (review_id, pass) DO UPDATE SET
			instructions = excluded.instructions,
			recorded = excluded.recorded,
			clean = excluded.clean,
			commit_sha = excluded.commit_sha,
			summary_original = excluded.summary_original,
			summary = excluded.summary,
			revision = excluded.revision,
			verdict = excluded.verdict,
			published_at = excluded.published_at,
			published_url = excluded.published_url`

	_, err := r.db.ExecContext(ctx, stmt, pass.ReviewID, pass.Number, pass.Instructions,
		pass.Recorded, pass.Clean, pass.Commit, pass.SummaryOriginal, pass.Summary, pass.Revision,
		string(pass.Verdict), nullTime(pass.PublishedAt), pass.PublishedURL,
		formatTime(pass.CreatedAt))
	if err != nil {
		return fmt.Errorf("upsert pass %d of review %s: %w", pass.Number, pass.ReviewID, err)
	}
	return nil
}

// DeletePass removes a pass of a review and, by cascade, its findings.
func (r *ReviewsRepo) DeletePass(ctx context.Context, reviewID string, pass int) error {
	const stmt = `DELETE FROM review_passes WHERE review_id = ? AND pass = ?`

	if _, err := r.db.ExecContext(ctx, stmt, reviewID, pass); err != nil {
		return fmt.Errorf("delete pass %d of review %s: %w", pass, reviewID, err)
	}
	return nil
}

// ReplaceFindings rewrites the findings of a pass with the ones given, in one
// transaction.
func (r *ReviewsRepo) ReplaceFindings(ctx context.Context, reviewID string, pass int, findings []prreview.Finding) error {
	const clearFindings = `DELETE FROM review_findings WHERE review_id = ? AND pass = ?`
	const stmt = `INSERT INTO review_findings (` + findingColumns + `)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin replace findings of pass %d of review %s: %w", pass, reviewID, err)
	}
	defer func() { _ = tx.Rollback() }()

	if _, err = tx.ExecContext(ctx, clearFindings, reviewID, pass); err != nil {
		return fmt.Errorf("clear findings of pass %d of review %s: %w", pass, reviewID, err)
	}
	for _, finding := range findings {
		_, err = tx.ExecContext(ctx, stmt, reviewID, pass, finding.Number, finding.Path, finding.Line,
			finding.Original, finding.Text, string(finding.Decision), string(finding.Placement))
		if err != nil {
			return fmt.Errorf("insert finding %d of pass %d of review %s: %w",
				finding.Number, pass, reviewID, err)
		}
	}
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("commit replace findings of pass %d of review %s: %w", pass, reviewID, err)
	}
	return nil
}

// UpdateFinding rewrites what the user and the publication decided about one
// finding of a pass.
func (r *ReviewsRepo) UpdateFinding(ctx context.Context, reviewID string, pass int, finding prreview.Finding) error {
	const stmt = `UPDATE review_findings SET text = ?, decision = ?, placement = ?
		WHERE review_id = ? AND pass = ? AND number = ?`

	_, err := r.db.ExecContext(ctx, stmt, finding.Text, string(finding.Decision),
		string(finding.Placement), reviewID, pass, finding.Number)
	if err != nil {
		return fmt.Errorf("update finding %d of pass %d of review %s: %w",
			finding.Number, pass, reviewID, err)
	}
	return nil
}

// scanReview reads a review row. The enums are taken as stored: only the app
// writes these columns.
func scanReview(row scanner) (prreview.Review, error) {
	var (
		review               prreview.Review
		mode, phase, state   string
		card                 string
		checkedAt            sql.NullString
		archivedAt           sql.NullString
		createdAt, updatedAt string
	)
	err := row.Scan(&review.ID, &review.RepositoryID, &review.Number, &review.Title, &review.Author,
		&review.URL, &review.HeadBranch, &review.BaseBranch, &review.Own, &mode, &phase, &card,
		&review.ArtifactsDir, &review.AskedPass, &review.ReportedPass, &review.PassCommit,
		&review.PublishedPass, &review.PublishedCommit, &review.HeadCommit, &state, &checkedAt,
		&review.PublishError, &archivedAt, &createdAt, &updatedAt)
	if err != nil {
		return prreview.Review{}, fmt.Errorf("scan review: %w", err)
	}

	review.Mode = prreview.Mode(mode)
	review.Phase = prreview.Phase(phase)
	review.PRState = prreview.PRState(state)

	subject := "review " + review.ID
	if review.Card, err = decodeCard(card); err != nil {
		return prreview.Review{}, fmt.Errorf("read %s: %w", subject, err)
	}
	if checkedAt.Valid {
		if review.PRCheckedAt, err = parseTime(checkedAt.String, subject); err != nil {
			return prreview.Review{}, err
		}
	}
	if archivedAt.Valid {
		if review.ArchivedAt, err = parseTime(archivedAt.String, subject); err != nil {
			return prreview.Review{}, err
		}
	}
	if review.CreatedAt, err = parseTime(createdAt, subject); err != nil {
		return prreview.Review{}, err
	}
	if review.UpdatedAt, err = parseTime(updatedAt, subject); err != nil {
		return prreview.Review{}, err
	}
	return review, nil
}

// scanPass reads a pass row, without its findings.
func scanPass(row scanner) (prreview.Pass, error) {
	var (
		pass        prreview.Pass
		verdict     string
		publishedAt sql.NullString
		createdAt   string
	)
	err := row.Scan(&pass.ReviewID, &pass.Number, &pass.Instructions, &pass.Recorded, &pass.Clean,
		&pass.Commit, &pass.SummaryOriginal, &pass.Summary, &pass.Revision, &verdict, &publishedAt,
		&pass.PublishedURL, &createdAt)
	if err != nil {
		return prreview.Pass{}, fmt.Errorf("scan pass: %w", err)
	}

	pass.Verdict = prreview.Verdict(verdict)

	subject := fmt.Sprintf("pass %d of review %s", pass.Number, pass.ReviewID)
	if publishedAt.Valid {
		if pass.PublishedAt, err = parseTime(publishedAt.String, subject); err != nil {
			return prreview.Pass{}, err
		}
	}
	if pass.CreatedAt, err = parseTime(createdAt, subject); err != nil {
		return prreview.Pass{}, err
	}
	return pass, nil
}

// scanFinding reads a finding row, with the pass it belongs to.
func scanFinding(row scanner) (int, prreview.Finding, error) {
	var (
		finding             prreview.Finding
		reviewID            string
		pass                int
		decision, placement string
	)
	err := row.Scan(&reviewID, &pass, &finding.Number, &finding.Path, &finding.Line,
		&finding.Original, &finding.Text, &decision, &placement)
	if err != nil {
		return 0, prreview.Finding{}, fmt.Errorf("scan finding: %w", err)
	}

	finding.Decision = prreview.Decision(decision)
	finding.Placement = prreview.Placement(placement)
	return pass, finding, nil
}

// encodeCard is the JSON of the card of a review, "" for none.
func encodeCard(card *prreview.Card) (string, error) {
	if card == nil {
		return "", nil
	}
	encoded, err := json.Marshal(card)
	if err != nil {
		return "", fmt.Errorf("encode card: %w", err)
	}
	return string(encoded), nil
}

// decodeCard reads the JSON back, nil for "".
func decodeCard(value string) (*prreview.Card, error) {
	if value == "" {
		return nil, nil
	}
	var card prreview.Card
	if err := json.Unmarshal([]byte(value), &card); err != nil {
		return nil, fmt.Errorf("decode card: %w", err)
	}
	return &card, nil
}
