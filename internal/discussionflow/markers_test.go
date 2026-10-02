package discussionflow_test

import (
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/board"
	"github.com/guilhermt/myspec/internal/discussion"
	"github.com/guilhermt/myspec/internal/discussionflow"
	"github.com/guilhermt/myspec/internal/session"
)

// waitMarkers waits for the flow to have recorded n markers of a type, which
// it does after the state the test waits on is already there.
func (f *fixture) waitMarkers(typ session.MarkerType, n int) []session.MarkerEntry {
	f.t.Helper()

	deadline := time.Now().Add(pollTimeout)
	for {
		got := f.sessions.markersOf(typ)
		if len(got) >= n {
			return got
		}
		if time.Now().After(deadline) {
			f.t.Fatalf("the flow recorded %d markers %s, want %d", len(got), typ, n)
		}
		time.Sleep(pollStep)
	}
}

// replace writes a file of the folder of a discussion in one step, so that an
// evaluation never finds it half written.
func (f *fixture) replace(id, name, content string) {
	f.t.Helper()

	stored, ok := f.discussions.Get(id)
	if !ok {
		f.t.Fatalf("discussion %s is not there", id)
	}
	path := filepath.Join(stored.ArtifactsDir, name)
	if err := os.WriteFile(path+".tmp", []byte(content), 0o600); err != nil {
		f.t.Fatalf("write %s: %v", name, err)
	}
	if err := os.Rename(path+".tmp", path); err != nil {
		f.t.Fatalf("replace %s: %v", name, err)
	}
}

func TestAStartRecordsTheEpicsOfItsCards(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	issue := func(owner, name string, number int) board.Issue {
		return board.Issue{Owner: owner, Name: name, Number: number, Title: "Card"}
	}
	epic := func(owner, name string, number int) *board.Epic {
		return &board.Epic{Issue: issue(owner, name, number)}
	}
	reading := f.boards.stored.Reading
	reading.Cards = append(reading.Cards,
		board.Card{Issue: issue("acme", "web", 13), Epic: epic("acme", "web", 1)},
		board.Card{Issue: issue("acme", "web", 14), Epic: epic("acme", "web", 1)},
		board.Card{Issue: issue("acme", "api", 5), Epic: epic("acme", "api", 2)},
	)

	id := f.start(cardKey, "acme/web#13", "acme/web#14", "acme/api#5")

	info := f.sessions.info(id)
	if diff := cmp.Diff([]string{"acme/web#1", "acme/api#2"}, info.Epics); diff != "" {
		t.Errorf("the epics of the start are wrong (-want +got):\n%s", diff)
	}
	if info.BoardTitle != "Roadmap" {
		t.Errorf("the board of the start is %q, want Roadmap", info.BoardTitle)
	}
}

func TestTheDocumentIsMarkedByItsStamp(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)

	f.replace(id, discussion.DocumentFile, "# Invoices\n\nThe understanding.\n")
	f.flow.Check(id)
	first := f.waitMarkers(session.MarkerDiscussionDocument, 1)
	f.flow.Check(id)
	f.flow.Check(id)

	f.replace(id, discussion.DocumentFile, "# Invoices\n\nThe understanding, written again.\n")
	f.flow.Check(id)
	both := f.waitMarkers(session.MarkerDiscussionDocument, 2)
	f.flow.Check(id)

	f.waitFor(id, func(s discussionflow.State) bool { return s.DocumentRevision == 2 })
	got := f.sessions.markersOf(session.MarkerDiscussionDocument)
	if len(got) != 2 {
		t.Fatalf("the document was marked %d times, want once per stamp: %v", len(got), got)
	}
	if first[0].Stamp == "" || both[1].Stamp == "" || first[0].Stamp == both[1].Stamp {
		t.Errorf("the stamps are %q and %q, want two different ones", first[0].Stamp, both[1].Stamp)
	}

	// The next run of the app finds the same file and marks it with the same
	// stamp, which the session knows.
	restarted := discussionflow.New(discussionflow.Deps{
		Discussions:  f.discussions,
		Sessions:     f.sessions,
		Boards:       f.boards,
		Repositories: f.repositories,
		GH:           f.gh,
		Now:          f.now,
		OnChange:     f.onChange,
	})
	t.Cleanup(restarted.Close)
	restarted.Sync(t.Context())
	got = f.waitMarkers(session.MarkerDiscussionDocument, 3)
	if got[2].Stamp != both[1].Stamp {
		t.Errorf("the restart marked the stamp %q, want %q", got[2].Stamp, both[1].Stamp)
	}
}

func TestAReadingMarksTheDrafts(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)

	f.record(id, draftsArtifact)
	written := f.waitMarkers(session.MarkerDraftsWritten, 1)
	if diff := cmp.Diff([]session.MarkerEntry{{Type: session.MarkerDraftsWritten, Round: 1, Count: 3}}, written); diff != "" {
		t.Errorf("the first reading marked the wrong thing (-want +got):\n%s", diff)
	}

	f.replace(id, discussion.DraftsFile, strings.Replace(draftsArtifact, "Export invoices as CSV", "Export invoices as XLSX", 1))
	f.flow.Check(id)
	revised := f.waitMarkers(session.MarkerDraftsRevised, 1)
	if len(revised) != 1 || revised[0].Round != 1 || revised[0].Changed != 1 || revised[0].Added != 0 || revised[0].Dropped != 0 {
		t.Fatalf("the revision marked %+v, want one changed draft of the round 1", revised)
	}
	wantBefore := session.DraftBefore{
		Title: "Export invoices as CSV", Kind: "new", Decision: "", Outcome: "", Changes: []string{"title"},
	}
	if i := slices.IndexFunc(revised[0].Before, func(b session.DraftBefore) bool { return b.Title == wantBefore.Title }); i < 0 {
		t.Errorf("the revision has no draft as it was before: %+v", revised[0].Before)
	} else if diff := cmp.Diff(wantBefore, revised[0].Before[i]); diff != "" {
		t.Errorf("the draft as it was before is wrong (-want +got):\n%s", diff)
	}
	if len(revised[0].Before) != 3 {
		t.Errorf("the revision lists %d drafts, want the 3 of the round", len(revised[0].Before))
	}

	// The same file again changes nothing.
	f.replace(id, discussion.DraftsFile, strings.Replace(draftsArtifact, "Export invoices as CSV", "Export invoices as XLSX", 1))
	f.flow.Check(id)

	// Once every draft is decided, a draft of a new id opens the round 2.
	for _, draftID := range []string{"invoices-epic", "export-invoices", "invoice-schema"} {
		f.decide(id, draftID, discussion.DecisionDiscarded)
	}
	f.replace(id, discussion.DraftsFile, looseCardsArtifact)
	f.flow.Check(id)
	got := f.waitMarkers(session.MarkerDraftsWritten, 2)
	if diff := cmp.Diff(session.MarkerEntry{Type: session.MarkerDraftsWritten, Round: 2, Count: 2}, got[1]); diff != "" {
		t.Errorf("the second round marked the wrong thing (-want +got):\n%s", diff)
	}
	if n := len(f.sessions.markersOf(session.MarkerDraftsRevised)); n != 1 {
		t.Errorf("the readings marked %d revisions, want the one that changed something", n)
	}
	if n := len(f.sessions.markersOf(session.MarkerDraftsWritten)); n != 2 {
		t.Errorf("the readings marked %d rounds written, want 2", n)
	}
}

func TestAReadingThatTakesOutEveryDraftMarksTheRevision(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, draftsArtifact)
	f.waitMarkers(session.MarkerDraftsWritten, 1)

	f.replace(id, discussion.DraftsFile, "---\nstatus: none\n---\n")
	f.flow.Check(id)

	revised := f.waitMarkers(session.MarkerDraftsRevised, 1)
	if revised[0].Round != 1 || revised[0].Dropped != 3 || revised[0].Changed != 0 || revised[0].Added != 0 {
		t.Errorf("the revision marked %+v, want the 3 drafts of the round 1 dropped", revised[0])
	}
	if len(revised[0].Before) != 3 || slices.ContainsFunc(revised[0].Before, func(b session.DraftBefore) bool { return !b.Dropped }) {
		t.Errorf("the revision lists %+v, want the 3 drafts of the round, each dropped", revised[0].Before)
	}
}

func TestUnreadableDraftsAreMarkedWithTheirReason(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)

	f.replace(id, discussion.DraftsFile, strings.Replace(draftsArtifact, "- Module: Billing", "- Module: Payroll", 1))
	f.sessions.idle(id)
	f.flow.Check(id)
	state := f.waitFor(id, func(s discussionflow.State) bool { return s.UnreadableDrafts != "" })
	marked := f.waitMarkers(session.MarkerDraftsUnreadable, 1)

	if marked[0].Reason != state.UnreadableDrafts {
		t.Errorf("the marker says %q, the state %q, want the same reason", marked[0].Reason, state.UnreadableDrafts)
	}
	if !strings.HasSuffix(marked[0].Reason, ".") || strings.Contains(marked[0].Reason, "discussion:") ||
		strings.Contains(marked[0].Reason, draftsPathOf(f, id)) {
		t.Errorf("the reason %q is not a sentence of the rule", marked[0].Reason)
	}

	// Looking at the same file again says nothing more.
	f.flow.Check(id)
	f.flow.Check(id)
	time.Sleep(10 * pollStep)
	if n := len(f.sessions.markersOf(session.MarkerDraftsUnreadable)); n != 1 {
		t.Errorf("the same unreadable file was marked %d times, want once", n)
	}
}

// draftsPathOf is the path of the drafts file of a discussion.
func draftsPathOf(f *fixture, id string) string {
	stored, _ := f.discussions.Get(id)
	return filepath.Join(stored.ArtifactsDir, discussion.DraftsFile)
}

func TestAPublicationMarksItsRound(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, looseCardsArtifact)
	f.approveQuietly(id, "invoice-report", "audit-log")
	f.flow.Check(id)
	f.waitPublished(id, "invoice-report")
	f.waitPublished(id, "audit-log")

	got := f.waitMarkers(session.MarkerDraftsPublished, 1)
	for _, marker := range got {
		if diff := cmp.Diff(session.MarkerEntry{Type: session.MarkerDraftsPublished, Round: 1}, marker); diff != "" {
			t.Errorf("the publication marked the wrong thing (-want +got):\n%s", diff)
		}
	}
}

func TestAFailedPublicationMarksItsRound(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)
	f.record(id, looseCardsArtifact)
	f.gh.failCreate("Invoice report", errGitHub)
	f.approveQuietly(id, "invoice-report")
	f.flow.Check(id)
	f.waitFailed(id, "invoice-report")

	got := f.waitMarkers(session.MarkerDraftsPublished, 1)
	if diff := cmp.Diff(session.MarkerEntry{Type: session.MarkerDraftsPublished, Round: 1}, got[0]); diff != "" {
		t.Errorf("the failure marked the wrong thing (-want +got):\n%s", diff)
	}
}
