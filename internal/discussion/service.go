package discussion

import (
	"context"
	"fmt"
	"log/slog"
	"maps"
	"os"
	"path/filepath"
	"reflect"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
)

// dirPerm keeps the artifact folders private to the user.
const dirPerm = 0o700

// filePerm keeps an artifact the app writes private to the user.
const filePerm = 0o600

// userEpicPrefix opens the id of an epic the user grouped cards into.
const userEpicPrefix = "user-epic-"

// minEpicCards is how many cards an epic needs to be worth one.
const minEpicCards = 2

// Store persists the discussions, the cards they started from and the drafts
// of each one.
type Store interface {
	ListActive(ctx context.Context) ([]Discussion, error)
	ListArchived(ctx context.Context) ([]Discussion, error)
	Insert(ctx context.Context, d Discussion) error
	Update(ctx context.Context, d Discussion) error
	UpdateArchived(ctx context.Context, id string, archivedAt, updatedAt time.Time) error
	Delete(ctx context.Context, id string) error
	Drafts(ctx context.Context, discussionID string) ([]Draft, error)
	// WriteDrafts stores the drafts of a discussion, and the discussion itself
	// when it is not nil, all or nothing.
	WriteDrafts(ctx context.Context, discussionID string, drafts []Draft, d *Discussion) error
	UpdateDraft(ctx context.Context, draft Draft) error
}

// Deps are what Service needs from the outside.
type Deps struct {
	Store    Store
	DataDir  string
	Log      *slog.Logger
	Now      func() time.Time // defaults to time.Now
	NewID    func() string    // defaults to uuid.NewString
	OnChange func()           // after any change to the list or a discussion; may be nil
}

// Service owns the discussions, active and archived, the drafts of each one
// and the artifact folder they are written in.
type Service struct {
	store    Store
	dataDir  string
	log      *slog.Logger
	now      func() time.Time
	newID    func() string
	onChange func()

	mu          sync.Mutex
	discussions []Discussion       // active, in creation order
	archived    []Discussion       // by archived_at, newest first
	drafts      map[string][]Draft // by discussion id, archived included, in position order
}

// New builds a Service from deps.
func New(deps Deps) *Service {
	s := &Service{
		store:    deps.Store,
		dataDir:  deps.DataDir,
		log:      deps.Log,
		now:      deps.Now,
		newID:    deps.NewID,
		onChange: deps.OnChange,
		drafts:   map[string][]Draft{},
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
	return s
}

// Sync loads every discussion, archived ones included, with the drafts of each
// one. It does not call OnChange.
func (s *Service) Sync(ctx context.Context) error {
	active, err := s.store.ListActive(ctx)
	if err != nil {
		return fmt.Errorf("list discussions: %w", err)
	}
	archived, err := s.store.ListArchived(ctx)
	if err != nil {
		return fmt.Errorf("list archived discussions: %w", err)
	}

	// The history shows the drafts the active discussions show, so both lists
	// fill the map.
	loaded := slices.Concat(active, archived)
	drafts := make(map[string][]Draft, len(loaded))
	for _, d := range loaded {
		of, draftErr := s.store.Drafts(ctx, d.ID)
		if draftErr != nil {
			return fmt.Errorf("list drafts of discussion %s: %w", d.ID, draftErr)
		}
		drafts[d.ID] = of
	}

	s.mu.Lock()
	s.discussions, s.archived, s.drafts = active, archived, drafts
	s.mu.Unlock()
	return nil
}

// List returns copies of the active discussions in creation order.
func (s *Service) List() []Discussion {
	s.mu.Lock()
	defer s.mu.Unlock()

	return cloneAll(s.discussions)
}

// ListArchived returns copies of the archived discussions, the most recently
// archived first.
func (s *Service) ListArchived() []Discussion {
	s.mu.Lock()
	defer s.mu.Unlock()

	return cloneAll(s.archived)
}

// Get returns an active discussion by id. One in the history is not one of
// them; Lookup finds both.
func (s *Service) Get(id string) (Discussion, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if index := indexOf(s.discussions, id); index >= 0 {
		return cloneDiscussion(s.discussions[index]), true
	}
	return Discussion{}, false
}

// Lookup returns a loaded discussion by id, whether it is active or in the
// history.
func (s *Service) Lookup(id string) (Discussion, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if index := indexOf(s.discussions, id); index >= 0 {
		return cloneDiscussion(s.discussions[index]), true
	}
	if index := indexOf(s.archived, id); index >= 0 {
		return cloneDiscussion(s.archived[index]), true
	}
	return Discussion{}, false
}

// Drafts returns copies of the drafts of a discussion, in position order.
func (s *Service) Drafts(id string) []Draft {
	s.mu.Lock()
	defer s.mu.Unlock()

	return cloneDrafts(s.drafts[id])
}

// CreateParams is the board and the demand a discussion starts from.
type CreateParams struct {
	BoardID        string
	BoardTitle     string
	BoardOwner     string
	BoardNumber    int
	Title          string
	Text           string
	InitialContext string
	Cards          []InputCard
}

// Create validates, creates the artifact folder with the initial context in it
// and persists the discussion.
func (s *Service) Create(ctx context.Context, p CreateParams) (Discussion, error) {
	title := strings.TrimSpace(p.Title)
	if title == "" {
		return Discussion{}, fmt.Errorf("create discussion: %w", ErrEmptyTitle)
	}
	if utf8.RuneCountInString(title) > TitleMaxLen {
		return Discussion{}, fmt.Errorf("create discussion: %w", ErrTitleTooLong)
	}
	text := strings.TrimSpace(p.Text)
	if text == "" && len(p.Cards) == 0 {
		return Discussion{}, fmt.Errorf("create discussion: %w", ErrNothingToDiscuss)
	}

	now := s.now().UTC()
	d := Discussion{
		ID:             s.newID(),
		BoardID:        p.BoardID,
		BoardTitle:     p.BoardTitle,
		Title:          title,
		Text:           text,
		InitialContext: p.InitialContext,
		Cards:          slices.Clone(p.Cards),
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	d.ArtifactsDir = ArtifactsDir(s.dataDir, p.BoardOwner, p.BoardNumber, d.ID)

	// The folder is named after the discussion, so it is ours: a failed insert
	// takes it with it.
	if err := os.MkdirAll(d.ArtifactsDir, dirPerm); err != nil {
		return Discussion{}, fmt.Errorf("create artifacts directory %s: %w", d.ArtifactsDir, err)
	}
	if err := s.writeContext(d); err != nil {
		s.remove(d.ArtifactsDir)
		return Discussion{}, err
	}
	if err := s.store.Insert(ctx, d); err != nil {
		s.remove(d.ArtifactsDir)
		return Discussion{}, err
	}

	s.mu.Lock()
	s.discussions = append(s.discussions, d)
	s.drafts[d.ID] = nil
	s.mu.Unlock()

	s.log.Info("discussion created", "discussion", d.ID, "board", d.BoardID, "cards", len(d.Cards))
	s.changed()
	return d, nil
}

// writeContext writes the file that tells the agent what is to be discussed.
func (s *Service) writeContext(d Discussion) error {
	path := d.ContextPath()
	if err := os.WriteFile(path, []byte(d.InitialContext), filePerm); err != nil {
		return fmt.Errorf("write context %s: %w", path, err)
	}
	return nil
}

// RecordDrafts reconciles the drafts of the artifact with what is stored: what
// the agent did not change keeps the edits and the decisions it had, what it
// changed is replaced, and a published draft never moves. changed says whether
// anything moved.
func (s *Service) RecordDrafts(ctx context.Context, id string, a Artifact) (bool, error) {
	d, ok := s.Get(id)
	if !ok {
		return false, fmt.Errorf("record drafts of discussion %s: %w", id, ErrNotFound)
	}

	stored := s.Drafts(id)
	drafts := reconcile(id, stored, a)
	changed := !equalDrafts(stored, drafts)
	if !changed && d.DraftsRead {
		return false, nil
	}

	d.UpdatedAt = s.now().UTC()
	d.DraftsRead = true
	if changed {
		d.DraftsRevision++
	}
	if err := s.store.WriteDrafts(ctx, id, drafts, &d); err != nil {
		return false, err
	}

	s.mu.Lock()
	s.drafts[id] = drafts
	s.mu.Unlock()
	s.save(d)

	if changed {
		s.log.Info("discussion drafts recorded", "discussion", id,
			"drafts", len(drafts), "revision", d.DraftsRevision)
	}
	s.changed()
	return changed, nil
}

// SetDraftText records the title and the body the user left on a draft, which
// is what a publication sends.
func (s *Service) SetDraftText(ctx context.Context, id, draftID, title, body string) error {
	title, body = strings.TrimSpace(title), strings.TrimSpace(body)
	if title == "" || body == "" {
		return fmt.Errorf("set text of draft %s of discussion %s: %w", draftID, id, ErrEmptyText)
	}
	return s.editDraft(ctx, id, draftID, func(d *Draft) error {
		d.Title, d.Body = title, body
		return nil
	})
}

// SetDraftRepository records the repository a new card or an epic is created
// in. An update goes to the repository of its card, and takes none.
func (s *Service) SetDraftRepository(ctx context.Context, id, draftID, owner, name string) error {
	return s.editDraft(ctx, id, draftID, func(d *Draft) error {
		if d.Kind == KindUpdate {
			return fmt.Errorf("set repository of draft %s of discussion %s: %w", draftID, id, ErrInvalidRef)
		}
		d.Owner, d.Name = owner, name
		return nil
	})
}

// SetDraftModule records the module of a card; "" is a card with none.
func (s *Service) SetDraftModule(ctx context.Context, id, draftID, module string) error {
	return s.editDraft(ctx, id, draftID, func(d *Draft) error {
		if !d.IsCard() {
			return fmt.Errorf("set module of draft %s of discussion %s: %w", draftID, id, ErrInvalidRef)
		}
		d.Module = strings.TrimSpace(module)
		return nil
	})
}

// SetDraftEpic records the epic of a card: an epic draft of the discussion, an
// issue that exists, or "" for none.
func (s *Service) SetDraftEpic(ctx context.Context, id, draftID, value string) error {
	return s.editDraft(ctx, id, draftID, func(d *Draft) error {
		if !d.IsCard() {
			return fmt.Errorf("set epic of draft %s of discussion %s: %w", draftID, id, ErrInvalidRef)
		}
		if strings.TrimSpace(value) == "" {
			d.Epic = ""
			return nil
		}

		ref, ok := ParseRef(value)
		if !ok {
			return fmt.Errorf("set epic %q of draft %s of discussion %s: %w", value, draftID, id, ErrInvalidRef)
		}
		if ref.IsDraft() {
			epic, found := s.draft(id, ref.Draft)
			if !found || epic.Kind != KindEpic {
				return fmt.Errorf("set epic %s of draft %s of discussion %s: %w", ref, draftID, id, ErrNotEpic)
			}
		}
		d.Epic = ref.String()
		return nil
	})
}

// AddDraftDependency records that a card can only start after another card:
// one of the discussion, or an issue that exists.
func (s *Service) AddDraftDependency(ctx context.Context, id, draftID, value string) error {
	return s.editDraft(ctx, id, draftID, func(d *Draft) error {
		if !d.IsCard() {
			return fmt.Errorf("add dependency to draft %s of discussion %s: %w", draftID, id, ErrInvalidRef)
		}
		ref, ok := ParseRef(value)
		if !ok || ref.Draft == draftID {
			return fmt.Errorf("add dependency %q to draft %s of discussion %s: %w", value, draftID, id, ErrInvalidRef)
		}
		if slices.ContainsFunc(d.Dependencies, func(dep Dependency) bool { return dep.Key() == ref.Key() }) {
			return fmt.Errorf("add dependency %s to draft %s of discussion %s: %w", ref, draftID, id, ErrInvalidRef)
		}
		if ref.IsDraft() {
			on, found := s.draft(id, ref.Draft)
			if !found || !on.IsCard() {
				return fmt.Errorf("add dependency %s to draft %s of discussion %s: %w", ref, draftID, id, ErrInvalidRef)
			}
		}

		d.Dependencies = append(d.Dependencies, Dependency{Ref: ref, Original: false})
		return nil
	})
}

// RemoveDraftDependency drops a dependency of a card. One GitHub already has
// is refused: the relation is out there.
func (s *Service) RemoveDraftDependency(ctx context.Context, id, draftID, value string) error {
	return s.editDraft(ctx, id, draftID, func(d *Draft) error {
		ref, ok := ParseRef(value)
		if !ok {
			return fmt.Errorf("remove dependency %q of draft %s of discussion %s: %w", value, draftID, id, ErrInvalidRef)
		}
		index := slices.IndexFunc(d.Dependencies, func(dep Dependency) bool { return dep.Key() == ref.Key() })
		if index < 0 {
			return fmt.Errorf("remove dependency %s of draft %s of discussion %s: %w", ref, draftID, id, ErrInvalidRef)
		}
		if d.Dependencies[index].Linked {
			return fmt.Errorf("remove dependency %s of draft %s of discussion %s: %w",
				ref, draftID, id, ErrDependencyLinked)
		}

		d.Dependencies = slices.Delete(d.Dependencies, index, index+1)
		return nil
	})
}

// Decide records what the user decided about one draft.
func (s *Service) Decide(ctx context.Context, id, draftID string, decision Decision) error {
	decided, err := ParseDecision(string(decision))
	if err != nil {
		return err
	}
	return s.editDraft(ctx, id, draftID, func(d *Draft) error {
		d.Decision = decided
		return nil
	})
}

// GroupIntoEpic creates an epic of the user over the given cards and points
// every one of them at it. The epic is written by the user: it starts without
// a title and without a body.
func (s *Service) GroupIntoEpic(ctx context.Context, id string, draftIDs []string) (Draft, error) {
	d, err := s.editable(id)
	if err != nil {
		return Draft{}, err
	}

	drafts := s.Drafts(id)
	members, err := epicMembers(id, drafts, draftIDs)
	if err != nil {
		return Draft{}, err
	}

	owner, name := commonRepository(drafts, members)
	epic := Draft{
		DiscussionID: d.ID,
		ID:           nextUserEpicID(drafts),
		Kind:         KindEpic,
		Source:       SourceUser,
		Owner:        owner,
		Name:         name,
		Revision:     1,
	}
	for i := range drafts {
		if members[drafts[i].ID] {
			drafts[i].Epic = epic.ID
		}
	}
	epic.Position = len(drafts)
	drafts = append(drafts, epic)

	if err = s.store.WriteDrafts(ctx, id, drafts, nil); err != nil {
		return Draft{}, err
	}

	s.mu.Lock()
	s.drafts[id] = drafts
	s.mu.Unlock()

	s.log.Info("discussion drafts grouped", "discussion", id, "draft", epic.ID, "cards", len(members))
	s.changed()
	return epic, nil
}

// epicMembers is the set of cards an epic groups, refusing what cannot be one.
func epicMembers(id string, drafts []Draft, draftIDs []string) (map[string]bool, error) {
	members := map[string]bool{}
	for _, draftID := range draftIDs {
		index := slices.IndexFunc(drafts, func(d Draft) bool { return d.ID == draftID })
		if index < 0 || !drafts[index].IsCard() {
			return nil, fmt.Errorf("group draft %s of discussion %s: %w", draftID, id, ErrDraftNotFound)
		}
		if drafts[index].Published.Started() {
			return nil, fmt.Errorf("group draft %s of discussion %s: %w", draftID, id, ErrPublished)
		}
		members[draftID] = true
	}
	if len(members) < minEpicCards {
		return nil, fmt.Errorf("group %d drafts of discussion %s: %w", len(members), id, ErrTooFewCards)
	}
	return members, nil
}

// commonRepository is the repository most of the cards of an epic are in, ties
// going to the first one by owner/name.
func commonRepository(drafts []Draft, members map[string]bool) (owner, name string) {
	counts := map[string]int{}
	for _, draft := range drafts {
		if members[draft.ID] {
			counts[draft.FullName()]++
		}
	}

	fullNames := slices.Sorted(maps.Keys(counts))
	best := fullNames[0]
	for _, fullName := range fullNames {
		if counts[fullName] > counts[best] {
			best = fullName
		}
	}
	owner, name, _ = strings.Cut(best, "/")
	return owner, name
}

// nextUserEpicID is the id of the next epic of the user, which never collides
// with an id of the agent.
func nextUserEpicID(drafts []Draft) string {
	count := 0
	for _, draft := range drafts {
		if strings.HasPrefix(draft.ID, userEpicPrefix) {
			count++
		}
	}
	return userEpicPrefix + strconv.Itoa(count+1)
}

// RecordPublication records what one step of a publication did on GitHub. A
// published draft is read only to the user, never to the publication.
func (s *Service) RecordPublication(ctx context.Context, id, draftID string, mutate func(*Draft)) error {
	return s.writeDraft(ctx, id, draftID, false, func(d *Draft) error {
		mutate(d)
		return nil
	})
}

// SetPublishError records why the publication of a draft failed; "" clears it.
func (s *Service) SetPublishError(ctx context.Context, id, draftID, reason string) error {
	return s.writeDraft(ctx, id, draftID, false, func(d *Draft) error {
		d.PublishError = reason
		return nil
	})
}

// ClearPublishErrors forgets the failures of the given drafts, which is what a
// retry starts from.
func (s *Service) ClearPublishErrors(ctx context.Context, id string, draftIDs []string) error {
	if _, ok := s.Lookup(id); !ok {
		return fmt.Errorf("clear publish errors of discussion %s: %w", id, ErrNotFound)
	}

	drafts := s.Drafts(id)
	cleared := false
	for i := range drafts {
		if slices.Contains(draftIDs, drafts[i].ID) && drafts[i].PublishError != "" {
			drafts[i].PublishError = ""
			cleared = true
		}
	}
	if !cleared {
		return nil
	}

	if err := s.store.WriteDrafts(ctx, id, drafts, nil); err != nil {
		return err
	}

	s.mu.Lock()
	s.drafts[id] = drafts
	s.mu.Unlock()
	s.changed()
	return nil
}

// Archive takes a discussion out of the active list and into the history.
// There is no way back.
func (s *Service) Archive(ctx context.Context, id string) (Discussion, error) {
	d, ok := s.Get(id)
	if !ok {
		return Discussion{}, fmt.Errorf("archive discussion %s: %w", id, ErrNotFound)
	}

	d.ArchivedAt = s.now().UTC()
	d.UpdatedAt = d.ArchivedAt
	if err := s.store.UpdateArchived(ctx, d.ID, d.ArchivedAt, d.UpdatedAt); err != nil {
		return Discussion{}, err
	}

	s.mu.Lock()
	if index := indexOf(s.discussions, id); index >= 0 {
		s.discussions = slices.Delete(s.discussions, index, index+1)
	}
	s.archived = slices.Insert(s.archived, 0, d)
	s.mu.Unlock()

	s.changed()
	return d, nil
}

// Delete removes the record of a discussion, active or in the history, and its
// artifact folder. The caller stops the session of the discussion first.
func (s *Service) Delete(ctx context.Context, id string) error {
	d, ok := s.Lookup(id)
	if !ok {
		return fmt.Errorf("delete discussion %s: %w", id, ErrNotFound)
	}

	if err := s.store.Delete(ctx, id); err != nil {
		return err
	}
	// The record is gone, so the folder must go too, but a folder the user has
	// open elsewhere is not worth failing the delete over.
	s.remove(d.ArtifactsDir)

	s.mu.Lock()
	if index := indexOf(s.discussions, id); index >= 0 {
		s.discussions = slices.Delete(s.discussions, index, index+1)
	}
	if index := indexOf(s.archived, id); index >= 0 {
		s.archived = slices.Delete(s.archived, index, index+1)
	}
	delete(s.drafts, id)
	s.mu.Unlock()

	s.changed()
	return nil
}

// ReadArtifact reads one file of the artifact folder of a discussion: what was
// to be discussed, the understanding the agent reached, or the drafts.
func (s *Service) ReadArtifact(id, name string) (string, error) {
	d, ok := s.Lookup(id)
	if !ok {
		return "", fmt.Errorf("read artifact %s of discussion %s: %w", name, id, ErrNotFound)
	}
	if name != ContextFile && name != DocumentFile && name != DraftsFile {
		return "", fmt.Errorf("read artifact %s of discussion %s: %w", name, id, ErrUnknownArtifact)
	}

	path := filepath.Join(d.ArtifactsDir, name)
	content, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("read artifact %s: %w", path, err)
	}
	return string(content), nil
}

// DocumentOfCard is the understanding of the discussion that wrote a card,
// which is what a task created from it reads. The most recent publication of
// the issue wins.
func (s *Service) DocumentOfCard(owner, name string, number int) (string, bool) {
	s.mu.Lock()
	var (
		best  Discussion
		at    time.Time
		found bool
	)
	for _, d := range slices.Concat(s.discussions, s.archived) {
		if !publishes(s.drafts[d.ID], owner, name, number) {
			continue
		}
		when := latestPublication(s.drafts[d.ID], owner, name, number)
		if !found || when.After(at) || (when.Equal(at) && d.CreatedAt.After(best.CreatedAt)) {
			best, at, found = d, when, true
		}
	}
	s.mu.Unlock()

	if !found {
		return "", false
	}
	content, err := os.ReadFile(best.DocumentPath())
	if err != nil {
		return "", false
	}
	return string(content), true
}

// publishes reports whether one of the drafts wrote the issue.
func publishes(drafts []Draft, owner, name string, number int) bool {
	return slices.ContainsFunc(drafts, func(d Draft) bool { return wrote(d, owner, name, number) })
}

// latestPublication is when the last draft that wrote the issue finished. A
// publication still running has none.
func latestPublication(drafts []Draft, owner, name string, number int) time.Time {
	var at time.Time
	for _, draft := range drafts {
		if wrote(draft, owner, name, number) && draft.Published.At.After(at) {
			at = draft.Published.At
		}
	}
	return at
}

// wrote reports whether a draft created or updated the issue.
func wrote(d Draft, owner, name string, number int) bool {
	return d.Published.Outcome != OutcomeNone && d.Published.Number == number &&
		strings.EqualFold(d.Owner, owner) && strings.EqualFold(d.Name, name)
}

// editDraft rewrites one draft of an active discussion with what the user
// changed on it. A published draft and an archived discussion are refused.
func (s *Service) editDraft(ctx context.Context, id, draftID string, mutate func(*Draft) error) error {
	if _, err := s.editable(id); err != nil {
		return err
	}
	return s.writeDraft(ctx, id, draftID, true, mutate)
}

// writeDraft rewrites one draft of a discussion, whatever became of it: one
// reading of the draft decides the refusal and takes the change.
// refusePublished is an edit of the user, which a published draft refuses.
func (s *Service) writeDraft(ctx context.Context, id, draftID string, refusePublished bool,
	mutate func(*Draft) error,
) error {
	if _, ok := s.Lookup(id); !ok {
		return fmt.Errorf("write draft %s of discussion %s: %w", draftID, id, ErrNotFound)
	}
	draft, ok := s.draft(id, draftID)
	if !ok {
		return fmt.Errorf("write draft %s of discussion %s: %w", draftID, id, ErrDraftNotFound)
	}
	if refusePublished && draft.Published.Started() {
		return fmt.Errorf("write draft %s of discussion %s: %w", draftID, id, ErrPublished)
	}

	if err := mutate(&draft); err != nil {
		return err
	}
	if err := s.store.UpdateDraft(ctx, draft); err != nil {
		return err
	}
	s.saveDraft(draft)
	s.changed()
	return nil
}

// editable is the discussion an edit of the user may reach: one that is
// loaded and not archived.
func (s *Service) editable(id string) (Discussion, error) {
	d, ok := s.Lookup(id)
	if !ok {
		return Discussion{}, fmt.Errorf("edit discussion %s: %w", id, ErrNotFound)
	}
	if d.Archived() {
		return Discussion{}, fmt.Errorf("edit discussion %s: %w", id, ErrArchived)
	}
	return d, nil
}

// draft is a stored draft of a discussion by id.
func (s *Service) draft(id, draftID string) (Draft, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, draft := range s.drafts[id] {
		if draft.ID == draftID {
			return cloneDraft(draft), true
		}
	}
	return Draft{}, false
}

// save replaces a discussion in the list it is in.
func (s *Service) save(d Discussion) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if index := indexOf(s.discussions, d.ID); index >= 0 {
		s.discussions[index] = d
	}
	if index := indexOf(s.archived, d.ID); index >= 0 {
		s.archived[index] = d
	}
}

// saveDraft replaces a draft in the cache, in the place it already has.
func (s *Service) saveDraft(draft Draft) {
	s.mu.Lock()
	defer s.mu.Unlock()

	drafts := s.drafts[draft.DiscussionID]
	if index := slices.IndexFunc(drafts, func(d Draft) bool { return d.ID == draft.ID }); index >= 0 {
		drafts[index] = draft
	}
}

// remove drops an artifact folder, which is never worth failing an operation
// over.
func (s *Service) remove(path string) {
	if err := os.RemoveAll(path); err != nil {
		s.log.Warn("remove artifacts directory failed", "path", path, "error", err)
	}
}

// changed runs the OnChange callback outside the mutex.
func (s *Service) changed() {
	if s.onChange != nil {
		s.onChange()
	}
}

// indexOf is the position of a discussion in a list, -1 when it is not there.
func indexOf(discussions []Discussion, id string) int {
	return slices.IndexFunc(discussions, func(d Discussion) bool { return d.ID == id })
}

// equalDrafts reports whether two lists of drafts say the same thing.
func equalDrafts(a, b []Draft) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if !reflect.DeepEqual(a[i], b[i]) {
			return false
		}
	}
	return true
}

// cloneAll copies a list of discussions with the cards of each one.
func cloneAll(discussions []Discussion) []Discussion {
	cloned := make([]Discussion, 0, len(discussions))
	for _, d := range discussions {
		cloned = append(cloned, cloneDiscussion(d))
	}
	return cloned
}

// cloneDiscussion copies a discussion with its cards, so that a change never
// reaches what a caller holds.
func cloneDiscussion(d Discussion) Discussion {
	d.Cards = slices.Clone(d.Cards)
	return d
}

// cloneDrafts copies the drafts and what each one carries.
func cloneDrafts(drafts []Draft) []Draft {
	cloned := make([]Draft, 0, len(drafts))
	for _, draft := range drafts {
		cloned = append(cloned, cloneDraft(draft))
	}
	return cloned
}

// cloneDraft copies a draft with its card, its dependencies and its warnings.
func cloneDraft(draft Draft) Draft {
	draft.Dependencies = slices.Clone(draft.Dependencies)
	draft.Warnings = slices.Clone(draft.Warnings)
	if draft.Card != nil {
		card := *draft.Card
		draft.Card = &card
	}
	return draft
}
