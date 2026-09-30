package prreview

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/repository"
)

// dirPerm keeps the artifact folders private to the user.
const dirPerm = 0o700

// filePerm keeps an artifact the app writes private to the user.
const filePerm = 0o600

// Store persists the reviews, their passes and the findings of each pass.
type Store interface {
	ListActive(ctx context.Context) ([]Review, error)
	ListArchived(ctx context.Context) ([]Review, error)
	Insert(ctx context.Context, review Review) error
	Update(ctx context.Context, review Review) error
	UpdateArchived(ctx context.Context, id string, archivedAt, updatedAt time.Time) error
	Delete(ctx context.Context, id string) error
	Passes(ctx context.Context, reviewID string) ([]Pass, error)
	UpsertPass(ctx context.Context, pass Pass) error
	DeletePass(ctx context.Context, reviewID string, pass int) error
	// WritePass stores a pass with its findings, and the review it moves when
	// review is not nil, all or nothing.
	WritePass(ctx context.Context, pass Pass, review *Review) error
	UpdateFinding(ctx context.Context, reviewID string, pass int, finding Finding) error
	// UpdateFindingTitles rewrites the titles of the findings of a pass, by
	// number, and nothing else of them.
	UpdateFindingTitles(ctx context.Context, reviewID string, pass int, titles map[int]string) error
}

// Deps are what Service needs from the outside.
type Deps struct {
	Store   Store
	DataDir string
	// Repositories is the registered repository of an id. Without it, no
	// repository exists.
	Repositories func(id string) (repository.Repository, bool)
	Log          *slog.Logger
	Now          func() time.Time // defaults to time.Now
	NewID        func() string    // defaults to uuid.NewString
	OnChange     func()           // after any change to the list or a review; may be nil
}

// Service owns the reviews, active and archived, the passes of each one and
// the artifact folder they are written in.
type Service struct {
	store        Store
	dataDir      string
	repositories func(id string) (repository.Repository, bool)
	log          *slog.Logger
	now          func() time.Time
	newID        func() string
	onChange     func()

	mu       sync.Mutex
	reviews  []Review          // active, in creation order
	archived []Review          // by archived_at, newest first
	passes   map[string][]Pass // by review id, archived included, in pass order
}

// New builds a Service from deps.
func New(deps Deps) *Service {
	s := &Service{
		store:        deps.Store,
		dataDir:      deps.DataDir,
		repositories: deps.Repositories,
		log:          deps.Log,
		now:          deps.Now,
		newID:        deps.NewID,
		onChange:     deps.OnChange,
		passes:       map[string][]Pass{},
	}
	if s.log == nil {
		s.log = slog.New(slog.DiscardHandler)
	}
	if s.now == nil {
		s.now = time.Now
	}
	if s.newID == nil {
		s.newID = uuid.NewString
	}
	if s.repositories == nil {
		s.repositories = func(string) (repository.Repository, bool) { return repository.Repository{}, false }
	}
	return s
}

// Sync loads every review, archived ones included, with the passes of each
// one. It does not call OnChange.
func (s *Service) Sync(ctx context.Context) error {
	reviews, err := s.store.ListActive(ctx)
	if err != nil {
		return fmt.Errorf("list reviews: %w", err)
	}
	archived, err := s.store.ListArchived(ctx)
	if err != nil {
		return fmt.Errorf("list archived reviews: %w", err)
	}

	// The history shows the passes and the findings the active reviews show,
	// so both lists fill the map.
	loaded := slices.Concat(reviews, archived)
	passes := make(map[string][]Pass, len(loaded))
	for _, review := range loaded {
		of, passErr := s.store.Passes(ctx, review.ID)
		if passErr != nil {
			return fmt.Errorf("list passes of review %s: %w", review.ID, passErr)
		}
		passes[review.ID] = of
	}

	s.mu.Lock()
	s.reviews, s.archived, s.passes = reviews, archived, passes
	s.mu.Unlock()
	return nil
}

// List returns copies of the active reviews in creation order.
func (s *Service) List() []Review {
	s.mu.Lock()
	defer s.mu.Unlock()

	return slices.Clone(s.reviews)
}

// ListArchived returns copies of the archived reviews, the most recently
// archived first.
func (s *Service) ListArchived() []Review {
	s.mu.Lock()
	defer s.mu.Unlock()

	return slices.Clone(s.archived)
}

// Get returns an active review by id. A review in the history is not one of
// them; Lookup finds both.
func (s *Service) Get(id string) (Review, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if index := indexOf(s.reviews, id); index >= 0 {
		return s.reviews[index], true
	}
	return Review{}, false
}

// Lookup returns a loaded review by id, whether it is active or in the
// history.
func (s *Service) Lookup(id string) (Review, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if index := indexOf(s.reviews, id); index >= 0 {
		return s.reviews[index], true
	}
	if index := indexOf(s.archived, id); index >= 0 {
		return s.archived[index], true
	}
	return Review{}, false
}

// ActiveOf is the active review of a pull request, which there is at most one
// of.
func (s *Service) ActiveOf(repositoryID string, number int) (Review, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, review := range s.reviews {
		if review.RepositoryID == repositoryID && review.Number == number {
			return review, true
		}
	}
	return Review{}, false
}

// Counts is how many reviews a repository has, active and in the history.
func (s *Service) Counts(repositoryID string) (active, archived int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, review := range s.reviews {
		if review.RepositoryID == repositoryID {
			active++
		}
	}
	for _, review := range s.archived {
		if review.RepositoryID == repositoryID {
			archived++
		}
	}
	return active, archived
}

// Passes returns copies of the passes of a review, in order, each with its
// findings.
func (s *Service) Passes(id string) []Pass {
	s.mu.Lock()
	defer s.mu.Unlock()

	return clonePasses(s.passes[id])
}

// CreateParams is the pull request a review starts on.
type CreateParams struct {
	RepositoryID string
	Number       int
	Title        string
	Author       string
	URL          string
	HeadBranch   string
	BaseBranch   string
	HeadCommit   string
	Own          bool
	Mode         Mode
	Card         *Card
}

// Create validates, creates the artifact folder and persists the review.
func (s *Service) Create(ctx context.Context, p CreateParams) (Review, error) {
	mode, err := ParseMode(string(p.Mode))
	if err != nil {
		return Review{}, err
	}
	repo, ok := s.repositories(p.RepositoryID)
	if !ok {
		return Review{}, fmt.Errorf("create review of repository %s: %w", p.RepositoryID, ErrNotFound)
	}
	if active, exists := s.ActiveOf(p.RepositoryID, p.Number); exists {
		return Review{}, fmt.Errorf("create review of %s: %w", active.Reference(repo.FullName()), ErrActiveExists)
	}

	now := s.now().UTC()
	review := Review{
		ID:           s.newID(),
		RepositoryID: repo.ID,
		Number:       p.Number,
		Title:        p.Title,
		Author:       p.Author,
		URL:          p.URL,
		HeadBranch:   p.HeadBranch,
		BaseBranch:   p.BaseBranch,
		Own:          p.Own,
		Mode:         mode,
		Card:         cloneCard(p.Card),
		HeadCommit:   p.HeadCommit,
		PRState:      PROpen,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	review.ArtifactsDir = ArtifactsDir(s.dataDir, repo.Owner, repo.Name, review.Number, review.ID)

	// The folder is named after the review, so it is ours: a failed insert
	// takes it with it.
	if err = os.MkdirAll(review.ArtifactsDir, dirPerm); err != nil {
		return Review{}, fmt.Errorf("create artifacts directory %s: %w", review.ArtifactsDir, err)
	}
	if err = s.store.Insert(ctx, review); err != nil {
		if rmErr := os.RemoveAll(review.ArtifactsDir); rmErr != nil {
			s.log.Warn("remove artifacts directory failed", "path", review.ArtifactsDir, "error", rmErr)
		}
		return Review{}, err
	}

	s.mu.Lock()
	s.reviews = append(s.reviews, review)
	s.passes[review.ID] = nil
	s.mu.Unlock()

	s.log.Info("review created", "review", review.ID, "repository", repo.FullName(),
		"number", review.Number, "mode", string(review.Mode))
	s.changed()
	return review, nil
}

// Update rewrites an active review from what the cache holds, so that a change
// of one field never drops what another one recorded.
func (s *Service) Update(ctx context.Context, id string, mutate func(*Review)) (Review, error) {
	review, ok := s.Get(id)
	if !ok {
		return Review{}, fmt.Errorf("update review %s: %w", id, ErrNotFound)
	}

	review.UpdatedAt = s.now().UTC()
	mutate(&review)

	if err := s.store.Update(ctx, review); err != nil {
		return Review{}, err
	}
	s.save(review)
	s.changed()
	return review, nil
}

// AskPass records that the app asked the agent for a pass, with the
// instructions the user wrote for it.
func (s *Service) AskPass(ctx context.Context, id string, pass int, instructions string) (Review, error) {
	if _, ok := s.Get(id); !ok {
		return Review{}, fmt.Errorf("ask pass %d of review %s: %w", pass, id, ErrNotFound)
	}

	asked := Pass{
		ReviewID:     id,
		Number:       pass,
		Instructions: strings.TrimSpace(instructions),
		CreatedAt:    s.now().UTC(),
	}
	if err := s.store.UpsertPass(ctx, asked); err != nil {
		return Review{}, err
	}
	s.savePass(asked)

	review, err := s.Update(ctx, id, func(r *Review) { r.AskedPass = pass })
	if err != nil {
		return Review{}, err
	}
	s.log.Info("review pass asked", "review", id, "pass", pass)
	return review, nil
}

// UnaskPass undoes an AskPass whose message never reached the agent: the pass
// nothing was recorded for is dropped and the review goes back to the pass
// before it.
func (s *Service) UnaskPass(ctx context.Context, id string, pass int) error {
	review, ok := s.Get(id)
	if !ok {
		return fmt.Errorf("unask pass %d of review %s: %w", pass, id, ErrNotFound)
	}
	if recorded, found := s.pass(id, pass); found && recorded.Recorded {
		return nil
	}

	if err := s.store.DeletePass(ctx, id, pass); err != nil {
		return err
	}

	s.mu.Lock()
	s.passes[id] = slices.DeleteFunc(s.passes[id], func(p Pass) bool { return p.Number == pass })
	s.mu.Unlock()

	if _, err := s.Update(ctx, id, func(r *Review) { r.AskedPass = review.ReportedPass }); err != nil {
		return err
	}
	s.log.Info("review pass unasked", "review", id, "pass", pass)
	return nil
}

// Change is what recording a report did to the pass: nothing, only the
// titles of its findings, or a revision.
type Change int

// The changes RecordReport reports.
const (
	ChangeNone Change = iota
	ChangeTitles
	ChangeRevised
)

// RecordReport reconciles the report of a pass with what is stored and says
// what it changed: a report equal to the one recorded, and a pass already
// published, change nothing; one that differs only in the titles of its
// findings changes only them; the first report of a pass and any other that
// differs are a revision.
func (s *Service) RecordReport(ctx context.Context, id string, report Report, commit string) (Pass, Change, error) {
	if _, ok := s.Get(id); !ok {
		return Pass{}, ChangeNone, fmt.Errorf("record report of review %s: %w", id, ErrNotFound)
	}
	stored, ok := s.pass(id, report.Pass)
	if !ok {
		return Pass{}, ChangeNone, fmt.Errorf("record pass %d of review %s: %w", report.Pass, id, ErrNotFound)
	}
	if stored.Published() {
		return stored, ChangeNone, nil
	}

	if !stored.Recorded {
		return s.recordFirst(ctx, stored, report, commit)
	}
	if same(stored, report) {
		return stored, ChangeNone, nil
	}
	if sameExceptTitles(stored, report) {
		return s.retitle(ctx, stored, report)
	}
	return s.recordAgain(ctx, stored, report)
}

// recordFirst writes the first readable report of a pass, and moves the review
// to it.
func (s *Service) recordFirst(ctx context.Context, pass Pass, report Report, commit string) (Pass, Change, error) {
	pass.Recorded = true
	pass.Clean = report.Clean
	pass.Commit = commit
	pass.SummaryOriginal, pass.Summary = report.Summary, report.Summary
	pass.Revision = 1
	pass.RecordedAt = s.now().UTC()
	pass.Findings = fresh(report.Findings)

	if err := s.writePass(ctx, pass, func(r *Review) {
		r.ReportedPass, r.PassCommit = pass.Number, commit
	}); err != nil {
		return Pass{}, ChangeNone, err
	}

	s.log.Info("review report recorded", "review", pass.ReviewID, "pass", pass.Number,
		"clean", pass.Clean, "findings", len(pass.Findings))
	s.changed()
	return pass, ChangeRevised, nil
}

// retitle writes the titles of a report that says the same as the pass in
// everything else. It is no revision.
func (s *Service) retitle(ctx context.Context, pass Pass, report Report) (Pass, Change, error) {
	titles := make(map[int]string, len(report.Findings))
	pass.Findings = slices.Clone(pass.Findings)
	for i, parsed := range report.Findings {
		titles[parsed.Number] = parsed.Title
		pass.Findings[i].Title = parsed.Title
	}
	if err := s.store.UpdateFindingTitles(ctx, pass.ReviewID, pass.Number, titles); err != nil {
		return Pass{}, ChangeNone, err
	}
	s.savePass(pass)

	s.log.Info("review titles rewritten", "review", pass.ReviewID, "pass", pass.Number)
	s.changed()
	return pass, ChangeTitles, nil
}

// recordAgain reconciles a report the agent rewrote with what the user already
// did with it: an edited summary and the decisions of the findings that are
// still there survive.
func (s *Service) recordAgain(ctx context.Context, pass Pass, report Report) (Pass, Change, error) {
	if pass.SummaryOriginal != report.Summary {
		pass.Summary = report.Summary
		pass.SummaryOriginal = report.Summary
	}
	pass.Clean = report.Clean
	pass.Findings = inherit(pass.Findings, report.Findings)
	pass.Revision++

	if err := s.writePass(ctx, pass, nil); err != nil {
		return Pass{}, ChangeNone, err
	}

	s.log.Info("review report rewritten", "review", pass.ReviewID, "pass", pass.Number,
		"revision", pass.Revision, "findings", len(pass.Findings))
	s.changed()
	return pass, ChangeRevised, nil
}

// writePass persists a pass with its findings and, when advance is not nil,
// the review with what advance changes on it, in one write. The cache follows
// only once the store has all of it, so a failure leaves both as they were.
func (s *Service) writePass(ctx context.Context, pass Pass, advance func(*Review)) error {
	var review *Review
	if advance != nil {
		current, ok := s.Get(pass.ReviewID)
		if !ok {
			return fmt.Errorf("update review %s: %w", pass.ReviewID, ErrNotFound)
		}
		current.UpdatedAt = s.now().UTC()
		advance(&current)
		review = &current
	}

	if err := s.store.WritePass(ctx, pass, review); err != nil {
		return err
	}
	s.savePass(pass)
	if review != nil {
		s.save(*review)
	}
	return nil
}

// Decide records what the user decided about one finding of the pass being
// decided.
func (s *Service) Decide(ctx context.Context, id string, pass, number int, d Decision) error {
	decision, err := ParseDecision(string(d))
	if err != nil {
		return err
	}
	return s.updateFinding(ctx, id, pass, number, func(f *Finding) { f.Decision = decision })
}

// SetFindingText records the text the user left on one finding of the pass
// being decided, which is what a publication sends.
func (s *Service) SetFindingText(ctx context.Context, id string, pass, number int, text string) error {
	text = strings.TrimSpace(text)
	if text == "" {
		return fmt.Errorf("set text of finding %d of pass %d of review %s: %w", number, pass, id, ErrEmptyText)
	}
	return s.updateFinding(ctx, id, pass, number, func(f *Finding) { f.Text = text })
}

// updateFinding rewrites one finding of the pass being decided.
func (s *Service) updateFinding(ctx context.Context, id string, pass, number int, mutate func(*Finding)) error {
	stored, err := s.deciding(id, pass)
	if err != nil {
		return err
	}
	index := slices.IndexFunc(stored.Findings, func(f Finding) bool { return f.Number == number })
	if index < 0 {
		return fmt.Errorf("finding %d of pass %d of review %s: %w", number, pass, id, ErrNotFound)
	}

	finding := stored.Findings[index]
	mutate(&finding)
	if err = s.store.UpdateFinding(ctx, id, pass, finding); err != nil {
		return err
	}

	stored.Findings = slices.Clone(stored.Findings)
	stored.Findings[index] = finding
	s.savePass(stored)
	s.changed()
	return nil
}

// SetSummary records the summary the user left on the pass being decided,
// which is what a publication sends.
func (s *Service) SetSummary(ctx context.Context, id string, pass int, text string) error {
	stored, err := s.deciding(id, pass)
	if err != nil {
		return err
	}

	stored.Summary = strings.TrimSpace(text)
	if err = s.store.UpsertPass(ctx, stored); err != nil {
		return err
	}
	s.savePass(stored)
	s.changed()
	return nil
}

// deciding is the pass the user decides on: the last one recorded, before it
// is published.
func (s *Service) deciding(id string, pass int) (Pass, error) {
	review, ok := s.Get(id)
	if !ok {
		return Pass{}, fmt.Errorf("pass %d of review %s: %w", pass, id, ErrNotFound)
	}
	stored, ok := s.pass(id, pass)
	if !ok {
		return Pass{}, fmt.Errorf("pass %d of review %s: %w", pass, id, ErrNotFound)
	}
	if stored.Published() || !stored.Recorded || pass != review.ReportedPass {
		return Pass{}, fmt.Errorf("pass %d of review %s: %w", pass, id, ErrNotDeciding)
	}
	return stored, nil
}

// MarkPublished records the review the app sent to GitHub: the verdict,
// whether the summary went with it, where each finding went and the head it
// was sent against.
func (s *Service) MarkPublished(ctx context.Context, id string, pass int, verdict Verdict, summary bool,
	url, commit string, placements map[int]Placement,
) error {
	published, err := ParseVerdict(string(verdict))
	if err != nil {
		return err
	}
	stored, err := s.deciding(id, pass)
	if err != nil {
		return err
	}

	stored.Verdict = published
	stored.PublishedAt = s.now().UTC()
	stored.PublishedURL = url
	stored.SummaryPublished = summary
	stored.Findings = slices.Clone(stored.Findings)
	for i := range stored.Findings {
		stored.Findings[i].Placement = placements[stored.Findings[i].Number]
	}
	if err = s.writePass(ctx, stored, func(r *Review) {
		r.PublishedPass = pass
		r.PublishedCommit, r.HeadCommit = commit, commit
		r.PublishError = ""
	}); err != nil {
		return err
	}
	s.log.Info("review published", "review", id, "pass", pass, "verdict", string(published), "url", url)
	s.changed()
	return nil
}

// MarkChecks records the checks and the merge of the reading that let a pass
// start, and when it was made.
func (s *Service) MarkChecks(ctx context.Context, id string, pass int, checks gh.PRChecks, readAt time.Time) error {
	return s.markPass(ctx, id, pass, "checks", func(p *Pass) {
		p.Checks = slices.Clone(checks.Checks)
		p.Mergeable = checks.Mergeable
		p.ChecksReadAt = readAt.UTC()
	})
}

// MarkSent records that the approved findings of a pass went to the agent, in
// apply mode.
func (s *Service) MarkSent(ctx context.Context, id string, pass int) error {
	return s.markPass(ctx, id, pass, "sent", func(p *Pass) { p.SentAt = s.now().UTC() })
}

// markPass rewrites a stored pass with what mutate changes on it.
func (s *Service) markPass(ctx context.Context, id string, pass int, what string, mutate func(*Pass)) error {
	if _, ok := s.Get(id); !ok {
		return fmt.Errorf("mark %s of pass %d of review %s: %w", what, pass, id, ErrNotFound)
	}
	stored, ok := s.pass(id, pass)
	if !ok {
		return fmt.Errorf("mark %s of pass %d of review %s: %w", what, pass, id, ErrNotFound)
	}

	mutate(&stored)
	if err := s.store.UpsertPass(ctx, stored); err != nil {
		return err
	}
	s.savePass(stored)
	s.changed()
	return nil
}

// MarkApplied records that the fixes of the approved findings of a pass went
// up in a commit the app asked for. Marking a pass already applied changes
// nothing.
func (s *Service) MarkApplied(ctx context.Context, id string, pass int) error {
	if _, ok := s.Get(id); !ok {
		return fmt.Errorf("mark pass %d of review %s applied: %w", pass, id, ErrNotFound)
	}
	stored, ok := s.pass(id, pass)
	if !ok || !stored.Recorded {
		return fmt.Errorf("mark pass %d of review %s applied: %w", pass, id, ErrNotFound)
	}
	if stored.Applied {
		return nil
	}

	stored.Applied = true
	if err := s.store.UpsertPass(ctx, stored); err != nil {
		return err
	}
	s.savePass(stored)
	s.log.Info("review pass applied", "review", id, "pass", pass)
	s.changed()
	return nil
}

// Archive takes a review out of the active list and into the history, with
// how the pull request ended. There is no way back.
func (s *Service) Archive(ctx context.Context, id string, end End) (Review, error) {
	review, ok := s.Get(id)
	if !ok {
		return Review{}, fmt.Errorf("archive review %s: %w", id, ErrNotFound)
	}

	review.PRState = end.State
	review.MergedBy, review.MergedAt, review.ClosedAt = end.MergedBy, end.MergedAt, end.ClosedAt
	review.ArchivedAt = s.now().UTC()
	review.UpdatedAt = review.ArchivedAt
	if err := s.store.Update(ctx, review); err != nil {
		return Review{}, err
	}
	if err := s.store.UpdateArchived(ctx, review.ID, review.ArchivedAt, review.UpdatedAt); err != nil {
		return Review{}, err
	}

	s.mu.Lock()
	if index := indexOf(s.reviews, id); index >= 0 {
		s.reviews = slices.Delete(s.reviews, index, index+1)
	}
	s.archived = slices.Insert(s.archived, 0, review)
	s.mu.Unlock()

	s.log.Info("review archived", "review", id, "state", string(end.State))
	s.changed()
	return review, nil
}

// Delete removes the record of a review, active or in the history, and its
// artifact folder. The caller stops the session of the review first.
func (s *Service) Delete(ctx context.Context, id string) error {
	review, ok := s.Lookup(id)
	if !ok {
		return fmt.Errorf("delete review %s: %w", id, ErrNotFound)
	}

	if err := s.store.Delete(ctx, id); err != nil {
		return err
	}
	// The record is gone, so the folder must go too, but a folder the user has
	// open elsewhere is not worth failing the delete over.
	if err := os.RemoveAll(review.ArtifactsDir); err != nil {
		s.log.Warn("remove artifacts directory failed", "path", review.ArtifactsDir, "error", err)
	}

	s.mu.Lock()
	if index := indexOf(s.reviews, id); index >= 0 {
		s.reviews = slices.Delete(s.reviews, index, index+1)
	}
	if index := indexOf(s.archived, id); index >= 0 {
		s.archived = slices.Delete(s.archived, index, index+1)
	}
	delete(s.passes, id)
	s.mu.Unlock()

	s.log.Info("review deleted", "review", id, "number", review.Number)
	s.changed()
	return nil
}

// ReadArtifact reads one file of the artifact folder of a review: the context
// of the pull request, or the report of a pass.
func (s *Service) ReadArtifact(id, name string) (string, error) {
	review, ok := s.Lookup(id)
	if !ok {
		return "", fmt.Errorf("read artifact %s of review %s: %w", name, id, ErrNotFound)
	}
	if !artifactName(name) {
		return "", fmt.Errorf("read artifact %s of review %s: %w", name, id, ErrUnknownArtifact)
	}

	path := filepath.Join(review.ArtifactsDir, name)
	content, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("read artifact %s: %w", path, err)
	}
	return string(content), nil
}

// artifactName reports whether a name is an artifact of a review folder.
func artifactName(name string) bool {
	if name == ContextFile {
		return true
	}
	return reportFileName.MatchString(name)
}

// WriteContext rewrites the file that tells the agent which pull request it
// reviews.
func (s *Service) WriteContext(id, content string) error {
	review, ok := s.Get(id)
	if !ok {
		return fmt.Errorf("write context of review %s: %w", id, ErrNotFound)
	}

	if err := os.MkdirAll(review.ArtifactsDir, dirPerm); err != nil {
		return fmt.Errorf("create artifacts directory %s: %w", review.ArtifactsDir, err)
	}
	path := review.ContextPath()
	if err := os.WriteFile(path, []byte(content), filePerm); err != nil {
		return fmt.Errorf("write context %s: %w", path, err)
	}
	return nil
}

// pass is a stored pass of a review by number.
func (s *Service) pass(id string, number int) (Pass, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, stored := range s.passes[id] {
		if stored.Number == number {
			return clonePass(stored), true
		}
	}
	return Pass{}, false
}

// save replaces a review in the list it is in.
func (s *Service) save(review Review) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if index := indexOf(s.reviews, review.ID); index >= 0 {
		s.reviews[index] = review
	}
	if index := indexOf(s.archived, review.ID); index >= 0 {
		s.archived[index] = review
	}
}

// savePass replaces a pass in the cache, keeping the passes in order.
func (s *Service) savePass(pass Pass) {
	s.mu.Lock()
	defer s.mu.Unlock()

	passes := s.passes[pass.ReviewID]
	index := slices.IndexFunc(passes, func(p Pass) bool { return p.Number == pass.Number })
	if index >= 0 {
		passes[index] = pass
	} else {
		passes = append(passes, pass)
		slices.SortFunc(passes, func(a, b Pass) int { return a.Number - b.Number })
	}
	s.passes[pass.ReviewID] = passes
}

// changed runs the OnChange callback outside the mutex.
func (s *Service) changed() {
	if s.onChange != nil {
		s.onChange()
	}
}

// indexOf is the position of a review in a list, -1 when it is not there.
func indexOf(reviews []Review, id string) int {
	return slices.IndexFunc(reviews, func(r Review) bool { return r.ID == id })
}

// same reports whether a report says what the pass already recorded: the same
// summary, and the same findings in the same places with the same titles and
// words.
func same(pass Pass, report Report) bool {
	return sameFindings(pass, report, true)
}

// sameExceptTitles is same without the titles of the findings.
func sameExceptTitles(pass Pass, report Report) bool {
	return sameFindings(pass, report, false)
}

// sameFindings compares a report with a pass, the titles of the findings
// included when withTitles is set.
func sameFindings(pass Pass, report Report, withTitles bool) bool {
	if pass.SummaryOriginal != report.Summary || len(pass.Findings) != len(report.Findings) {
		return false
	}
	for i, finding := range pass.Findings {
		parsed := report.Findings[i]
		if finding.Number != parsed.Number || finding.Path != parsed.Path ||
			finding.Line != parsed.Line || finding.Original != parsed.Text {
			return false
		}
		if withTitles && finding.Title != parsed.Title {
			return false
		}
	}
	return true
}

// fresh are the findings of a report nobody decided anything about yet.
func fresh(parsed []ParsedFinding) []Finding {
	findings := make([]Finding, 0, len(parsed))
	for _, finding := range parsed {
		findings = append(findings, Finding{
			Number:   finding.Number,
			Title:    finding.Title,
			Path:     finding.Path,
			Line:     finding.Line,
			Original: finding.Text,
			Text:     finding.Text,
		})
	}
	return findings
}

// inherit are the findings of a rewritten report, each carrying what the user
// did with the finding that said the same thing in the same place.
func inherit(stored []Finding, parsed []ParsedFinding) []Finding {
	previous := map[Finding][]Finding{}
	for _, finding := range stored {
		key := Finding{Path: finding.Path, Line: finding.Line, Original: finding.Original}
		previous[key] = append(previous[key], finding)
	}

	findings := fresh(parsed)
	for i, finding := range findings {
		key := Finding{Path: finding.Path, Line: finding.Line, Original: finding.Original}
		matches := previous[key]
		if len(matches) == 0 {
			continue
		}
		findings[i].Text, findings[i].Decision = matches[0].Text, matches[0].Decision
		previous[key] = matches[1:]
	}
	return findings
}

// clonePasses copies the passes and the findings of each one, so that a change
// never reaches what a caller holds.
func clonePasses(passes []Pass) []Pass {
	cloned := make([]Pass, 0, len(passes))
	for _, pass := range passes {
		cloned = append(cloned, clonePass(pass))
	}
	return cloned
}

// clonePass copies a pass with its findings.
func clonePass(pass Pass) Pass {
	pass.Findings = slices.Clone(pass.Findings)
	pass.Checks = slices.Clone(pass.Checks)
	return pass
}

// cloneCard copies a card, so that what a caller holds never changes under it.
func cloneCard(c *Card) *Card {
	if c == nil {
		return nil
	}
	copied := *c
	return &copied
}
