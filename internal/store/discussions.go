package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/guilhermt/myspec/internal/discussion"
)

// DiscussionsRepo implements the store of discussion.
var _ discussion.Store = (*DiscussionsRepo)(nil)

// DiscussionsRepo stores the discussions, the cards they started from, the
// drafts of each one and the dependencies of a draft. It implements
// discussion.Store.
type DiscussionsRepo struct{ db *sql.DB }

// discussionColumns is the column list every discussion query selects, in scan
// order.
const discussionColumns = `id, board_id, board_title, title, text, initial_context, artifacts_dir,
	drafts_read, drafts_revision, archived_at, created_at, updated_at`

// discussionCardColumns is the column list every card query selects, in scan
// order.
const discussionCardColumns = `discussion_id, position, owner, name, number, title, url`

// draftColumns is the column list every draft query selects, in scan order.
const draftColumns = `discussion_id, draft_id, position, kind, source, owner, name,
	repository_original, card_number, card_title, card_url, title_original, title,
	body_original, body, module_original, module, epic_original, epic, decision, revision,
	warnings, publish_error, outcome, issue_number, issue_url, issue_node_id, item_id,
	status_set, module_set, parent_set, published_at, round, revised_reading, approval_cleared`

// dependencyColumns is the column list every dependency query selects, in scan
// order.
const dependencyColumns = `discussion_id, draft_id, position, ref, original, linked, dropped, detail`

// ListActive returns the discussions that were not archived, in creation
// order, each one with the cards it started from.
func (r *DiscussionsRepo) ListActive(ctx context.Context) ([]discussion.Discussion, error) {
	const query = `SELECT ` + discussionColumns + ` FROM discussions
		WHERE archived_at IS NULL ORDER BY created_at, id`

	return r.listDiscussions(ctx, query)
}

// ListArchived returns the archived discussions, the most recently archived
// first, each one with the cards it started from.
func (r *DiscussionsRepo) ListArchived(ctx context.Context) ([]discussion.Discussion, error) {
	const query = `SELECT ` + discussionColumns + ` FROM discussions
		WHERE archived_at IS NOT NULL ORDER BY archived_at DESC, id`

	return r.listDiscussions(ctx, query)
}

// listDiscussions runs a query of the discussion columns and fills the cards of
// what it read.
func (r *DiscussionsRepo) listDiscussions(ctx context.Context, query string) ([]discussion.Discussion, error) {
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("list discussions: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var list []discussion.Discussion
	for rows.Next() {
		d, scanErr := scanDiscussion(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		list = append(list, d)
	}
	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("list discussions: %w", err)
	}

	for i := range list {
		if list[i].Cards, err = r.cards(ctx, list[i].ID); err != nil {
			return nil, err
		}
	}
	return list, nil
}

// cards returns the cards a discussion started from, in order.
func (r *DiscussionsRepo) cards(ctx context.Context, discussionID string) ([]discussion.InputCard, error) {
	const query = `SELECT ` + discussionCardColumns + ` FROM discussion_cards
		WHERE discussion_id = ? ORDER BY position`

	rows, err := r.db.QueryContext(ctx, query, discussionID)
	if err != nil {
		return nil, fmt.Errorf("list cards of discussion %s: %w", discussionID, err)
	}
	defer func() { _ = rows.Close() }()

	var cards []discussion.InputCard
	for rows.Next() {
		var (
			card     discussion.InputCard
			id       string
			position int
		)
		if err = rows.Scan(&id, &position, &card.Owner, &card.Name, &card.Number,
			&card.Title, &card.URL); err != nil {
			return nil, fmt.Errorf("scan card of discussion %s: %w", discussionID, err)
		}
		cards = append(cards, card)
	}
	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("list cards of discussion %s: %w", discussionID, err)
	}
	return cards, nil
}

// Insert stores a new discussion with the cards it started from.
func (r *DiscussionsRepo) Insert(ctx context.Context, d discussion.Discussion) error {
	const stmt = `INSERT INTO discussions (` + discussionColumns + `)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin insert discussion %s: %w", d.ID, err)
	}
	defer func() { _ = tx.Rollback() }()

	_, err = tx.ExecContext(ctx, stmt, d.ID, d.BoardID, d.BoardTitle, d.Title, d.Text,
		d.InitialContext, d.ArtifactsDir, d.DraftsRead, d.DraftsRevision,
		nullTime(d.ArchivedAt), formatTime(d.CreatedAt), formatTime(d.UpdatedAt))
	if err != nil {
		return fmt.Errorf("insert discussion %s: %w", d.ID, err)
	}
	if err = insertCards(ctx, tx, d); err != nil {
		return err
	}
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("commit insert discussion %s: %w", d.ID, err)
	}
	return nil
}

// insertCards stores the cards a discussion started from, in order.
func insertCards(ctx context.Context, db execer, d discussion.Discussion) error {
	const stmt = `INSERT INTO discussion_cards (` + discussionCardColumns + `)
		VALUES (?, ?, ?, ?, ?, ?, ?)`

	for i, card := range d.Cards {
		_, err := db.ExecContext(ctx, stmt, d.ID, i, card.Owner, card.Name, card.Number,
			card.Title, card.URL)
		if err != nil {
			return fmt.Errorf("insert card %s of discussion %s: %w", card.Reference(), d.ID, err)
		}
	}
	return nil
}

// Update rewrites every mutable column of a discussion but the instant it was
// archived, which UpdateArchived writes. The cards it started from never
// change.
func (r *DiscussionsRepo) Update(ctx context.Context, d discussion.Discussion) error {
	return updateDiscussion(ctx, r.db, d)
}

// updateDiscussion runs Update on the database or inside a transaction.
func updateDiscussion(ctx context.Context, db execer, d discussion.Discussion) error {
	const stmt = `UPDATE discussions SET title = ?, drafts_read = ?, drafts_revision = ?,
		updated_at = ? WHERE id = ?`

	_, err := db.ExecContext(ctx, stmt, d.Title, d.DraftsRead, d.DraftsRevision,
		formatTime(d.UpdatedAt), d.ID)
	if err != nil {
		return fmt.Errorf("update discussion %s: %w", d.ID, err)
	}
	return nil
}

// UpdateArchived records the instant a discussion was archived.
func (r *DiscussionsRepo) UpdateArchived(ctx context.Context, id string, archivedAt, updatedAt time.Time) error {
	const stmt = `UPDATE discussions SET archived_at = ?, updated_at = ? WHERE id = ?`

	if _, err := r.db.ExecContext(ctx, stmt, formatTime(archivedAt), formatTime(updatedAt), id); err != nil {
		return fmt.Errorf("update archived of discussion %s: %w", id, err)
	}
	return nil
}

// Delete removes a discussion and, by cascade, its session, its transcript, its
// situations, the cards it started from, its drafts and their dependencies.
func (r *DiscussionsRepo) Delete(ctx context.Context, id string) error {
	const stmt = `DELETE FROM discussions WHERE id = ?`

	if _, err := r.db.ExecContext(ctx, stmt, id); err != nil {
		return fmt.Errorf("delete discussion %s: %w", id, err)
	}
	return nil
}

// Drafts returns the drafts of a discussion in order, each one with its
// dependencies.
func (r *DiscussionsRepo) Drafts(ctx context.Context, discussionID string) ([]discussion.Draft, error) {
	const query = `SELECT ` + draftColumns + ` FROM discussion_drafts
		WHERE discussion_id = ? ORDER BY position, draft_id`

	rows, err := r.db.QueryContext(ctx, query, discussionID)
	if err != nil {
		return nil, fmt.Errorf("list drafts of discussion %s: %w", discussionID, err)
	}
	defer func() { _ = rows.Close() }()

	var drafts []discussion.Draft
	for rows.Next() {
		draft, scanErr := scanDraft(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		drafts = append(drafts, draft)
	}
	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("list drafts of discussion %s: %w", discussionID, err)
	}

	dependencies, err := r.dependencies(ctx, discussionID)
	if err != nil {
		return nil, err
	}
	for i := range drafts {
		drafts[i].Dependencies = dependencies[drafts[i].ID]
	}
	return drafts, nil
}

// dependencies returns the dependencies of every draft of a discussion, by
// draft id, in order.
func (r *DiscussionsRepo) dependencies(ctx context.Context, discussionID string) (map[string][]discussion.Dependency, error) {
	const query = `SELECT ` + dependencyColumns + ` FROM discussion_dependencies
		WHERE discussion_id = ? ORDER BY draft_id, position`

	rows, err := r.db.QueryContext(ctx, query, discussionID)
	if err != nil {
		return nil, fmt.Errorf("list dependencies of discussion %s: %w", discussionID, err)
	}
	defer func() { _ = rows.Close() }()

	byDraft := map[string][]discussion.Dependency{}
	for rows.Next() {
		draftID, dependency, scanErr := scanDependency(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		byDraft[draftID] = append(byDraft[draftID], dependency)
	}
	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("list dependencies of discussion %s: %w", discussionID, err)
	}
	return byDraft, nil
}

// WriteDrafts rewrites the whole set of drafts of a discussion with their
// dependencies, and the discussion itself when it is not nil, in one
// transaction: what the reconciliation of a rewritten artifact decided is
// stored all or nothing.
func (r *DiscussionsRepo) WriteDrafts(ctx context.Context, discussionID string, drafts []discussion.Draft, d *discussion.Discussion) error {
	const clearDrafts = `DELETE FROM discussion_drafts WHERE discussion_id = ?`
	const clearDependencies = `DELETE FROM discussion_dependencies WHERE discussion_id = ?`

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin write drafts of discussion %s: %w", discussionID, err)
	}
	defer func() { _ = tx.Rollback() }()

	if _, err = tx.ExecContext(ctx, clearDependencies, discussionID); err != nil {
		return fmt.Errorf("clear dependencies of discussion %s: %w", discussionID, err)
	}
	if _, err = tx.ExecContext(ctx, clearDrafts, discussionID); err != nil {
		return fmt.Errorf("clear drafts of discussion %s: %w", discussionID, err)
	}
	for _, draft := range drafts {
		if err = insertDraft(ctx, tx, discussionID, draft); err != nil {
			return err
		}
		if err = insertDependencies(ctx, tx, discussionID, draft); err != nil {
			return err
		}
	}
	if d != nil {
		if err = updateDiscussion(ctx, tx, *d); err != nil {
			return err
		}
	}
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("commit write drafts of discussion %s: %w", discussionID, err)
	}
	return nil
}

// insertDraft stores one draft of a discussion, at the position it holds.
func insertDraft(ctx context.Context, db execer, discussionID string, draft discussion.Draft) error {
	const stmt = `INSERT INTO discussion_drafts (` + draftColumns + `)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
			?, ?, ?, ?, ?, ?, ?, ?)`

	warnings, err := encodeWarnings(draft.Warnings)
	if err != nil {
		return fmt.Errorf("insert draft %s of discussion %s: %w", draft.ID, discussionID, err)
	}
	number, title, url := cardOf(draft)
	_, err = db.ExecContext(ctx, stmt, discussionID, draft.ID, draft.Position, string(draft.Kind),
		string(draft.Source), draft.Owner, draft.Name, draft.RepositoryOriginal,
		number, title, url, draft.TitleOriginal, draft.Title, draft.BodyOriginal, draft.Body,
		draft.ModuleOriginal, draft.Module, draft.EpicOriginal, draft.Epic,
		string(draft.Decision), draft.Revision, warnings, draft.PublishError,
		string(draft.Published.Outcome), draft.Published.Number, draft.Published.URL,
		draft.Published.NodeID, draft.Published.ItemID, draft.Published.StatusSet,
		draft.Published.ModuleSet, draft.Published.ParentSet, nullTime(draft.Published.At),
		draft.Round, draft.RevisedReading, draft.ApprovalCleared)
	if err != nil {
		return fmt.Errorf("insert draft %s of discussion %s: %w", draft.ID, discussionID, err)
	}
	return nil
}

// insertDependencies stores the dependencies of a draft, in order.
func insertDependencies(ctx context.Context, db execer, discussionID string, draft discussion.Draft) error {
	const stmt = `INSERT INTO discussion_dependencies (` + dependencyColumns + `)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`

	for i, dependency := range draft.Dependencies {
		_, err := db.ExecContext(ctx, stmt, discussionID, draft.ID, i, dependency.String(),
			dependency.Original, dependency.Linked, string(dependency.Dropped), dependency.Detail)
		if err != nil {
			return fmt.Errorf("insert dependency %s of draft %s of discussion %s: %w",
				dependency.String(), draft.ID, discussionID, err)
		}
	}
	return nil
}

// UpdateDraft rewrites every mutable column of a draft and the whole set of its
// dependencies, in one transaction: a draft never keeps the dependencies of
// what it no longer says.
func (r *DiscussionsRepo) UpdateDraft(ctx context.Context, draft discussion.Draft) error {
	const stmt = `UPDATE discussion_drafts SET position = ?, kind = ?, source = ?, owner = ?,
		name = ?, repository_original = ?, card_number = ?, card_title = ?, card_url = ?,
		title_original = ?, title = ?, body_original = ?, body = ?, module_original = ?,
		module = ?, epic_original = ?, epic = ?, decision = ?, revision = ?, warnings = ?,
		publish_error = ?, outcome = ?, issue_number = ?, issue_url = ?, issue_node_id = ?,
		item_id = ?, status_set = ?, module_set = ?, parent_set = ?, published_at = ?,
		round = ?, revised_reading = ?, approval_cleared = ?
		WHERE discussion_id = ? AND draft_id = ?`
	const clearDependencies = `DELETE FROM discussion_dependencies
		WHERE discussion_id = ? AND draft_id = ?`

	warnings, err := encodeWarnings(draft.Warnings)
	if err != nil {
		return fmt.Errorf("update draft %s of discussion %s: %w", draft.ID, draft.DiscussionID, err)
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin update draft %s of discussion %s: %w", draft.ID, draft.DiscussionID, err)
	}
	defer func() { _ = tx.Rollback() }()

	number, title, url := cardOf(draft)
	_, err = tx.ExecContext(ctx, stmt, draft.Position, string(draft.Kind), string(draft.Source),
		draft.Owner, draft.Name, draft.RepositoryOriginal, number, title, url,
		draft.TitleOriginal, draft.Title, draft.BodyOriginal, draft.Body, draft.ModuleOriginal,
		draft.Module, draft.EpicOriginal, draft.Epic, string(draft.Decision), draft.Revision,
		warnings, draft.PublishError, string(draft.Published.Outcome), draft.Published.Number,
		draft.Published.URL, draft.Published.NodeID, draft.Published.ItemID,
		draft.Published.StatusSet, draft.Published.ModuleSet, draft.Published.ParentSet,
		nullTime(draft.Published.At), draft.Round, draft.RevisedReading, draft.ApprovalCleared,
		draft.DiscussionID, draft.ID)
	if err != nil {
		return fmt.Errorf("update draft %s of discussion %s: %w", draft.ID, draft.DiscussionID, err)
	}
	if _, err = tx.ExecContext(ctx, clearDependencies, draft.DiscussionID, draft.ID); err != nil {
		return fmt.Errorf("clear dependencies of draft %s of discussion %s: %w",
			draft.ID, draft.DiscussionID, err)
	}
	if err = insertDependencies(ctx, tx, draft.DiscussionID, draft); err != nil {
		return err
	}
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("commit update draft %s of discussion %s: %w", draft.ID, draft.DiscussionID, err)
	}
	return nil
}

// scanDiscussion reads a discussion row, without the cards it started from.
func scanDiscussion(row scanner) (discussion.Discussion, error) {
	var (
		d                    discussion.Discussion
		archivedAt           sql.NullString
		createdAt, updatedAt string
	)
	err := row.Scan(&d.ID, &d.BoardID, &d.BoardTitle, &d.Title, &d.Text, &d.InitialContext,
		&d.ArtifactsDir, &d.DraftsRead, &d.DraftsRevision, &archivedAt, &createdAt, &updatedAt)
	if err != nil {
		return discussion.Discussion{}, fmt.Errorf("scan discussion: %w", err)
	}

	subject := "discussion " + d.ID
	if archivedAt.Valid {
		if d.ArchivedAt, err = parseTime(archivedAt.String, subject); err != nil {
			return discussion.Discussion{}, err
		}
	}
	if d.CreatedAt, err = parseTime(createdAt, subject); err != nil {
		return discussion.Discussion{}, err
	}
	if d.UpdatedAt, err = parseTime(updatedAt, subject); err != nil {
		return discussion.Discussion{}, err
	}
	return d, nil
}

// scanDraft reads a draft row, without its dependencies. The enums are taken as
// stored: only the app writes these columns.
func scanDraft(row scanner) (discussion.Draft, error) {
	var (
		draft                  discussion.Draft
		kind, source, decision string
		outcome                string
		cardNumber             int
		cardTitle, cardURL     string
		warnings               string
		publishedAt            sql.NullString
		statusSet, moduleSet   bool
		parentSet              bool
		issueNumber            int
		issueURL, issueNode    string
		itemID                 string
	)
	err := row.Scan(&draft.DiscussionID, &draft.ID, &draft.Position, &kind, &source, &draft.Owner,
		&draft.Name, &draft.RepositoryOriginal, &cardNumber, &cardTitle, &cardURL,
		&draft.TitleOriginal, &draft.Title, &draft.BodyOriginal, &draft.Body,
		&draft.ModuleOriginal, &draft.Module, &draft.EpicOriginal, &draft.Epic, &decision,
		&draft.Revision, &warnings, &draft.PublishError, &outcome, &issueNumber, &issueURL,
		&issueNode, &itemID, &statusSet, &moduleSet, &parentSet, &publishedAt, &draft.Round,
		&draft.RevisedReading, &draft.ApprovalCleared)
	if err != nil {
		return discussion.Draft{}, fmt.Errorf("scan draft: %w", err)
	}
	draft.Kind = discussion.Kind(kind)
	draft.Source = discussion.Source(source)
	draft.Decision = discussion.Decision(decision)
	draft.Published = discussion.Publication{
		Outcome:   discussion.Outcome(outcome),
		Number:    issueNumber,
		URL:       issueURL,
		NodeID:    issueNode,
		ItemID:    itemID,
		StatusSet: statusSet,
		ModuleSet: moduleSet,
		ParentSet: parentSet,
	}
	if cardNumber != 0 {
		draft.Card = &discussion.InputCard{
			Owner:  draft.Owner,
			Name:   draft.Name,
			Number: cardNumber,
			Title:  cardTitle,
			URL:    cardURL,
		}
	}

	subject := fmt.Sprintf("draft %s of discussion %s", draft.ID, draft.DiscussionID)
	if draft.Warnings, err = decodeWarnings(warnings, subject); err != nil {
		return discussion.Draft{}, err
	}
	if publishedAt.Valid {
		if draft.Published.At, err = parseTime(publishedAt.String, subject); err != nil {
			return discussion.Draft{}, err
		}
	}
	return draft, nil
}

// scanDependency reads a dependency row, with the draft it belongs to.
func scanDependency(row scanner) (string, discussion.Dependency, error) {
	var (
		dependency   discussion.Dependency
		discussionID string
		draftID      string
		position     int
		ref, dropped string
	)
	err := row.Scan(&discussionID, &draftID, &position, &ref, &dependency.Original,
		&dependency.Linked, &dropped, &dependency.Detail)
	if err != nil {
		return "", discussion.Dependency{}, fmt.Errorf("scan dependency: %w", err)
	}

	parsed, ok := discussion.ParseRef(ref)
	if !ok {
		return "", discussion.Dependency{}, fmt.Errorf("read dependency %q of draft %s of discussion %s: %w",
			ref, draftID, discussionID, discussion.ErrInvalidRef)
	}
	dependency.Ref = parsed
	dependency.Dropped = discussion.Drop(dropped)
	return draftID, dependency, nil
}

// cardOf is the card an update draft rewrites, as its columns store it: the
// number is 0 when the draft has none.
func cardOf(draft discussion.Draft) (number int, title, url string) {
	if draft.Card == nil {
		return 0, "", ""
	}
	return draft.Card.Number, draft.Card.Title, draft.Card.URL
}

// encodeWarnings is the JSON of the warnings of a draft; none is an empty
// array.
func encodeWarnings(warnings []string) (string, error) {
	if warnings == nil {
		return "[]", nil
	}
	encoded, err := json.Marshal(warnings)
	if err != nil {
		return "", fmt.Errorf("encode warnings: %w", err)
	}
	return string(encoded), nil
}

// decodeWarnings reads the JSON back, nil when there is none; subject names the
// draft in the error.
func decodeWarnings(value, subject string) ([]string, error) {
	var warnings []string
	if err := json.Unmarshal([]byte(value), &warnings); err != nil {
		return nil, fmt.Errorf("decode warnings of %s: %w", subject, err)
	}
	if len(warnings) == 0 {
		return nil, nil
	}
	return warnings, nil
}
