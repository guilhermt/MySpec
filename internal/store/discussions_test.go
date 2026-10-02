package store_test

import (
	"strconv"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/discussion"
	"github.com/guilhermt/myspec/internal/store"
)

// newDiscussion builds a discussion of a board with the cards it started from,
// ready to insert.
func newDiscussion(id, boardID string, created time.Time, cards ...discussion.InputCard) discussion.Discussion {
	return discussion.Discussion{
		ID:             id,
		BoardID:        boardID,
		BoardTitle:     "Roadmap",
		Title:          "The board of the week",
		Text:           "what the user wrote",
		InitialContext: "context of " + id,
		ArtifactsDir:   "/data/discussions/dev/1/" + id,
		Cards:          cards,
		CreatedAt:      created,
		UpdatedAt:      created,
	}
}

// newInputCard builds a card of the board a discussion started from.
func newInputCard(number int, title string) discussion.InputCard {
	return discussion.InputCard{
		Owner:  "dev",
		Name:   "web",
		Number: number,
		Title:  title,
		URL:    "https://github.com/dev/web/issues/" + strconv.Itoa(number),
	}
}

// newDraft builds a card the agent wrote, ready to write.
func newDraft(discussionID, id string, position int, dependencies ...discussion.Dependency) discussion.Draft {
	title := "Read the boards of the user"
	body := "The user picks a board and the app reads its cards."
	return discussion.Draft{
		DiscussionID:       discussionID,
		ID:                 id,
		Position:           position,
		Kind:               discussion.KindNew,
		Source:             discussion.SourceAgent,
		Owner:              "dev",
		Name:               "web",
		RepositoryOriginal: "dev/web",
		TitleOriginal:      title,
		Title:              title,
		BodyOriginal:       body,
		Body:               body,
		ModuleOriginal:     "Boards",
		Module:             "Boards",
		Dependencies:       dependencies,
		Revision:           1,
	}
}

// newDependency builds a dependency on another draft of the discussion.
func newDependency(draftID string) discussion.Dependency {
	return discussion.Dependency{Ref: discussion.Ref{Draft: draftID}, Original: true}
}

// insertDiscussion stores a discussion, failing the test on error.
func insertDiscussion(t *testing.T, s *store.Store, d discussion.Discussion) {
	t.Helper()

	if err := s.Discussions.Insert(t.Context(), d); err != nil {
		t.Fatalf("Insert(%s) = %v, want nil", d.ID, err)
	}
}

// listActiveDiscussions reads the active discussions, failing the test on
// error.
func listActiveDiscussions(t *testing.T, s *store.Store) []discussion.Discussion {
	t.Helper()

	list, err := s.Discussions.ListActive(t.Context())
	if err != nil {
		t.Fatalf("ListActive() = %v, want nil", err)
	}
	return list
}

// draftsOf reads the drafts of a discussion, failing the test on error.
func draftsOf(t *testing.T, s *store.Store, discussionID string) []discussion.Draft {
	t.Helper()

	drafts, err := s.Discussions.Drafts(t.Context(), discussionID)
	if err != nil {
		t.Fatalf("Drafts(%s) = %v, want nil", discussionID, err)
	}
	return drafts
}

// seedDrafts stores the drafts of a discussion, failing the test on error.
func seedDrafts(t *testing.T, s *store.Store, discussionID string, drafts ...discussion.Draft) {
	t.Helper()

	if err := s.Discussions.WriteDrafts(t.Context(), discussionID, drafts, nil); err != nil {
		t.Fatalf("WriteDrafts(%s) = %v, want nil", discussionID, err)
	}
}

func TestDiscussionsInsertAndListActiveWithTheirCards(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	want := newDiscussion("discussion-1", "board-1", fixedTime,
		newInputCard(7, "Read the boards"), newInputCard(3, "Write the cards"))
	insertDiscussion(t, s, want)

	if diff := cmp.Diff([]discussion.Discussion{want}, listActiveDiscussions(t, s)); diff != "" {
		t.Errorf("ListActive() mismatch (-want +got):\n%s", diff)
	}
}

func TestDiscussionsListActiveIsInCreationOrder(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	later := fixedTime.Add(time.Hour)
	first := newDiscussion("discussion-1", "board-1", fixedTime)
	second := newDiscussion("discussion-2", "board-2", later)
	for _, d := range []discussion.Discussion{second, first} {
		insertDiscussion(t, s, d)
	}

	want := []discussion.Discussion{first, second}
	if diff := cmp.Diff(want, listActiveDiscussions(t, s)); diff != "" {
		t.Errorf("ListActive() mismatch (-want +got):\n%s", diff)
	}
}

func TestAnArchivedDiscussionLeavesTheActiveOnesAndComesBackNewestFirst(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	older := newDiscussion("discussion-1", "board-1", fixedTime)
	newer := newDiscussion("discussion-2", "board-1", fixedTime)
	active := newDiscussion("discussion-3", "board-1", fixedTime)
	for _, d := range []discussion.Discussion{older, newer, active} {
		insertDiscussion(t, s, d)
	}

	archived := fixedTime.Add(time.Hour)
	for i, d := range []discussion.Discussion{older, newer} {
		at := archived.Add(time.Duration(i) * time.Hour)
		if err := s.Discussions.UpdateArchived(t.Context(), d.ID, at, at); err != nil {
			t.Fatalf("UpdateArchived(%s) = %v, want nil", d.ID, err)
		}
	}

	if diff := cmp.Diff([]discussion.Discussion{active}, listActiveDiscussions(t, s)); diff != "" {
		t.Errorf("ListActive() mismatch (-want +got):\n%s", diff)
	}

	older.ArchivedAt, older.UpdatedAt = archived, archived
	newer.ArchivedAt, newer.UpdatedAt = archived.Add(time.Hour), archived.Add(time.Hour)
	got, err := s.Discussions.ListArchived(t.Context())
	if err != nil {
		t.Fatalf("ListArchived() = %v, want nil", err)
	}
	if diff := cmp.Diff([]discussion.Discussion{newer, older}, got); diff != "" {
		t.Errorf("ListArchived() mismatch (-want +got):\n%s", diff)
	}
}

func TestUpdateRewritesTheMutableColumnsOfADiscussionAndLeavesItArchived(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	want := newDiscussion("discussion-1", "board-1", fixedTime, newInputCard(7, "Read the boards"))
	insertDiscussion(t, s, want)

	archived := fixedTime.Add(time.Hour)
	if err := s.Discussions.UpdateArchived(t.Context(), want.ID, archived, archived); err != nil {
		t.Fatalf("UpdateArchived() = %v, want nil", err)
	}

	read := fixedTime.Add(2 * time.Hour)
	want.Title = "The board of the week, renamed"
	want.DraftsRead = true
	want.DraftsRevision = 2
	want.UpdatedAt = read
	if err := s.Discussions.Update(t.Context(), want); err != nil {
		t.Fatalf("Update() = %v, want nil", err)
	}

	// Update writes no archived_at: the discussion the archive put away stays
	// away.
	want.ArchivedAt = archived
	got, err := s.Discussions.ListArchived(t.Context())
	if err != nil {
		t.Fatalf("ListArchived() = %v, want nil", err)
	}
	if diff := cmp.Diff([]discussion.Discussion{want}, got); diff != "" {
		t.Errorf("ListArchived() mismatch (-want +got):\n%s", diff)
	}
}

func TestTheDraftsOfADiscussionComeInOrderWithTheirDependencies(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	d := newDiscussion("discussion-1", "board-1", fixedTime)
	insertDiscussion(t, s, d)

	epic := newDraft(d.ID, "the-epic", 0)
	epic.Kind = discussion.KindEpic
	first := newDraft(d.ID, "read-the-boards", 1)
	first.Epic, first.EpicOriginal = epic.ID, epic.ID
	second := newDraft(d.ID, "write-the-cards", 2,
		newDependency(first.ID),
		discussion.Dependency{Ref: discussion.Ref{Owner: "dev", Name: "api", Number: 9}},
	)
	seedDrafts(t, s, d.ID, second, epic, first)

	want := []discussion.Draft{epic, first, second}
	if diff := cmp.Diff(want, draftsOf(t, s, d.ID)); diff != "" {
		t.Errorf("Drafts() mismatch (-want +got):\n%s", diff)
	}
}

func TestADraftOfAnUpdateKeepsTheCardItRewrites(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	d := newDiscussion("discussion-1", "board-1", fixedTime)
	insertDiscussion(t, s, d)

	want := newDraft(d.ID, "rewrite-the-card", 0)
	want.Kind = discussion.KindUpdate
	card := newInputCard(7, "Read the boards")
	want.Card = &card
	want.Warnings = []string{"the module is not one of the board"}
	seedDrafts(t, s, d.ID, want)

	if diff := cmp.Diff([]discussion.Draft{want}, draftsOf(t, s, d.ID)); diff != "" {
		t.Errorf("Drafts() mismatch (-want +got):\n%s", diff)
	}
}

func TestWriteDraftsRewritesTheWholeSetOfDraftsAndTheirDependencies(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	d := newDiscussion("discussion-1", "board-1", fixedTime)
	insertDiscussion(t, s, d)

	first := newDraft(d.ID, "read-the-boards", 0)
	second := newDraft(d.ID, "write-the-cards", 1, newDependency(first.ID))
	seedDrafts(t, s, d.ID, first, second)

	rewritten := newDraft(d.ID, "write-the-cards", 0)
	rewritten.Revision = 2
	seedDrafts(t, s, d.ID, rewritten)

	if diff := cmp.Diff([]discussion.Draft{rewritten}, draftsOf(t, s, d.ID)); diff != "" {
		t.Errorf("Drafts() mismatch (-want +got):\n%s", diff)
	}
}

func TestWriteDraftsMovesTheDiscussionWithTheDrafts(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	d := newDiscussion("discussion-1", "board-1", fixedTime)
	insertDiscussion(t, s, d)

	draft := newDraft(d.ID, "read-the-boards", 0)
	d.DraftsRead = true
	d.DraftsRevision = 1
	d.UpdatedAt = fixedTime.Add(time.Minute)
	if err := s.Discussions.WriteDrafts(t.Context(), d.ID, []discussion.Draft{draft}, &d); err != nil {
		t.Fatalf("WriteDrafts() = %v, want nil", err)
	}

	if diff := cmp.Diff([]discussion.Draft{draft}, draftsOf(t, s, d.ID)); diff != "" {
		t.Errorf("Drafts() mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff([]discussion.Discussion{d}, listActiveDiscussions(t, s)); diff != "" {
		t.Errorf("ListActive() mismatch (-want +got):\n%s", diff)
	}
}

func TestAFailedWriteDraftsLeavesTheDraftsAndTheDiscussionAsTheyWere(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	d := newDiscussion("discussion-1", "board-1", fixedTime)
	insertDiscussion(t, s, d)
	draft := newDraft(d.ID, "read-the-boards", 0, newDependency("write-the-cards"))
	seedDrafts(t, s, d.ID, draft)

	// Two drafts with the same id break the write after the first one is
	// stored and before the discussion is.
	moved := d
	moved.DraftsRevision = 2
	twice := []discussion.Draft{newDraft(d.ID, "one", 0), newDraft(d.ID, "one", 1)}
	if err := s.Discussions.WriteDrafts(t.Context(), d.ID, twice, &moved); err == nil {
		t.Fatal("WriteDrafts() = nil, want the duplicated draft refused")
	}

	if diff := cmp.Diff([]discussion.Draft{draft}, draftsOf(t, s, d.ID)); diff != "" {
		t.Errorf("Drafts() mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff([]discussion.Discussion{d}, listActiveDiscussions(t, s)); diff != "" {
		t.Errorf("ListActive() mismatch (-want +got):\n%s", diff)
	}
}

func TestUpdateDraftWritesWhatTheUserLeftAndWhatWasPublished(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	d := newDiscussion("discussion-1", "board-1", fixedTime)
	insertDiscussion(t, s, d)
	first := newDraft(d.ID, "read-the-boards", 0, newDependency("write-the-cards"))
	second := newDraft(d.ID, "write-the-cards", 1)
	second.Round, second.RevisedReading, second.ApprovalCleared = 2, 3, true
	seedDrafts(t, s, d.ID, first, second)

	published := fixedTime.Add(time.Hour)
	first.Position = 2
	first.Owner, first.Name = "dev", "api"
	first.Title = "as the user left it"
	first.Body = "as the user wrote it"
	first.Module = "Cards"
	first.Epic = "dev/web#42"
	first.Decision = discussion.DecisionApproved
	first.Revision = 3
	first.Round, first.RevisedReading, first.ApprovalCleared = 2, 3, true
	first.Warnings = []string{"the epic is not on the board"}
	first.PublishError = "gh: not authenticated"
	first.Dependencies = []discussion.Dependency{{
		Ref:      discussion.Ref{Owner: "dev", Name: "api", Number: 9},
		Original: false,
		Linked:   true,
		Dropped:  discussion.DropUnavailable,
		Detail:   "gh: not found on GitHub",
	}}
	first.Published = discussion.Publication{
		Outcome:   discussion.OutcomeCreated,
		Number:    12,
		URL:       "https://github.com/dev/api/issues/12",
		NodeID:    "I_node",
		ItemID:    "PVTI_item",
		StatusSet: true,
		ModuleSet: true,
		ParentSet: true,
		At:        published,
	}
	if err := s.Discussions.UpdateDraft(t.Context(), first); err != nil {
		t.Fatalf("UpdateDraft() = %v, want nil", err)
	}

	want := []discussion.Draft{second, first}
	if diff := cmp.Diff(want, draftsOf(t, s, d.ID)); diff != "" {
		t.Errorf("Drafts() mismatch (-want +got):\n%s", diff)
	}
}

func TestDeletingADiscussionTakesItsCardsDraftsAndDependencies(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	d := newDiscussion("discussion-1", "board-1", fixedTime, newInputCard(7, "Read the boards"))
	insertDiscussion(t, s, d)
	seedDrafts(t, s, d.ID, newDraft(d.ID, "read-the-boards", 0, newDependency("write-the-cards")))

	if err := s.Discussions.Delete(t.Context(), d.ID); err != nil {
		t.Fatalf("Delete() = %v, want nil", err)
	}
	if err := s.Discussions.Delete(t.Context(), "discussion-missing"); err != nil {
		t.Fatalf("Delete(missing) = %v, want nil", err)
	}

	if got := listActiveDiscussions(t, s); len(got) != 0 {
		t.Errorf("ListActive() = %v, want nothing left", got)
	}
	if got := draftsOf(t, s, d.ID); len(got) != 0 {
		t.Errorf("Drafts() = %v, want the drafts gone with the discussion", got)
	}
}
