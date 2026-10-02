package bindings_test

import (
	"strings"
	"testing"

	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/board"
	"github.com/guilhermt/myspec/internal/discussion"
)

// epicDraft is an epic the agent wrote over the cards of dev/web.
func epicDraft(id, title string) discussion.ParsedDraft {
	return discussion.ParsedDraft{
		ID:         id,
		Kind:       discussion.KindEpic,
		Repository: "dev/web",
		Title:      title,
		Body:       "What the epic groups.",
	}
}

// inEpic points a draft at an epic draft of the discussion.
func inEpic(draft discussion.ParsedDraft, epicID string) discussion.ParsedDraft {
	draft.Epic = &discussion.Ref{Draft: epicID}
	return draft
}

func TestEditingAndDecidingTheDraftsOfADiscussionReachesTheState(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	repoID := f.register(t, t.TempDir())
	f.registerBoard(t, true, webCard(12))
	d := f.seedDiscussion(t,
		epicDraft("billing", "Billing"),
		inEpic(webDraft("export-invoices", "Export the invoices"), "billing"),
		inEpic(webDraft("email-invoices", "Email the invoices"), "billing"),
	)

	if err := f.discussionSvc.SetDraftText(d.ID, "export-invoices", "Export invoices", "As a CSV."); err != nil {
		t.Fatalf("SetDraftText() = %v, want nil", err)
	}
	if err := f.discussionSvc.SetDraftModule(d.ID, "export-invoices", "Billing"); err != nil {
		t.Fatalf("SetDraftModule() = %v, want nil", err)
	}
	if err := f.discussionSvc.SetDraftRepository(d.ID, "export-invoices", repoID); err != nil {
		t.Fatalf("SetDraftRepository() = %v, want nil", err)
	}
	for _, draftID := range []string{"billing", "export-invoices"} {
		if err := f.discussionSvc.DecideDraft(d.ID, draftID, "approved"); err != nil {
			t.Fatalf("DecideDraft(%s) = %v, want nil", draftID, err)
		}
	}

	got := f.discussionOf(t, d.ID)
	if got.Title != "Invoices" || got.Board != "Roadmap" || got.Status != "deciding" {
		t.Errorf("discussion = %+v, want the one of the board, still deciding", got)
	}
	card := f.draftOf(t, d.ID, "export-invoices")
	if card.Title != "Export invoices" || card.Body != "As a CSV." || card.Module != "Billing" {
		t.Errorf("draft = %+v, want what the user left on it", card)
	}
	if card.Repository != "dev/web" || card.RepositoryID != repoID {
		t.Errorf("draft = repository %q of %q, want the registered dev/web", card.Repository, card.RepositoryID)
	}
	if card.Decision != "approved" {
		t.Errorf("decision = %q, want approved", card.Decision)
	}
	epic := f.draftOf(t, d.ID, "billing")
	if epic.Hold.Reason != "cards" || epic.Hold.Left != 1 {
		t.Errorf("epic hold = %+v, want one that waits for the card left to decide", epic.Hold)
	}
}

func TestMistakesOfTheUserOnADraftGetTheirSentenceAndAreNotLogged(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())
	f.registerBoard(t, true)
	d := f.seedDiscussion(t, webDraft("export-invoices", "Export the invoices"))

	err := f.discussionSvc.DecideDraft(d.ID, "export-invoices", "maybe")
	if want := "Unknown decision."; err == nil || err.Error() != want {
		t.Errorf("DecideDraft(maybe) = %v, want %q", err, want)
	}
	err = f.discussionSvc.SetDraftText(d.ID, "export-invoices", "", "As a CSV.")
	if want := "Write the title and the body of the draft."; err == nil || err.Error() != want {
		t.Errorf("SetDraftText(no title) = %v, want %q", err, want)
	}
	if err = f.discussionSvc.SetDraftEpic(d.ID, "export-invoices", "not a reference"); err == nil ||
		err.Error() != "Use a draft of this discussion or owner/name#number." {
		t.Errorf("SetDraftEpic(not a reference) = %v, want the sentence about a reference", err)
	}
	if f.logged(t, "binding failed") {
		t.Error("a mistake of the user was logged, want nothing logged")
	}
}

func TestADraftIsRefusedARepositoryTheBoardDoesNotManage(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	repoID := f.register(t, t.TempDir())
	f.registerBoard(t, false)
	d := f.seedDiscussion(t, webDraft("export-invoices", "Export the invoices"))

	err := f.discussionSvc.SetDraftRepository(d.ID, "export-invoices", repoID)

	if want := "dev/web isn't managed by this board."; err == nil || err.Error() != want {
		t.Errorf("SetDraftRepository() = %v, want %q", err, want)
	}
	if f.logged(t, "binding failed") {
		t.Error("a mistake of the user was logged, want nothing logged")
	}
}

func TestGroupingDraftsIntoAnEpicPointsThemAtIt(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())
	f.registerBoard(t, true)
	d := f.seedDiscussion(t,
		webDraft("export-invoices", "Export the invoices"),
		webDraft("email-invoices", "Email the invoices"),
		webDraft("sms-invoices", "Text the invoices"),
	)

	epicID, err := f.discussionSvc.GroupIntoEpic(d.ID, []string{"export-invoices", "email-invoices"})
	if err != nil {
		t.Fatalf("GroupIntoEpic() = %v, want nil", err)
	}

	epic := f.draftOf(t, d.ID, epicID)
	if epic.Kind != "epic" || epic.Source != "user" {
		t.Errorf("epic = %+v, want an epic of the user", epic)
	}
	for _, draftID := range []string{"export-invoices", "email-invoices"} {
		card := f.draftOf(t, d.ID, draftID)
		if card.Epic == nil || card.Epic.Draft != epicID {
			t.Errorf("draft %s = epic %+v, want the epic just created", draftID, card.Epic)
		}
	}
	if _, err = f.discussionSvc.GroupIntoEpic(d.ID, []string{"sms-invoices"}); err == nil ||
		err.Error() != "Select at least two cards." {
		t.Errorf("GroupIntoEpic(one card) = %v, want the sentence about two cards", err)
	}
}

func TestArchivingADiscussionIsRefusedWhileADraftWaitsToBePublished(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())
	f.registerBoard(t, true)
	d := f.seedDiscussion(t,
		epicDraft("billing", "Billing"),
		inEpic(webDraft("export-invoices", "Export the invoices"), "billing"),
	)
	if err := f.discussionSvc.DecideDraft(d.ID, "export-invoices", "approved"); err != nil {
		t.Fatalf("DecideDraft() = %v, want nil", err)
	}

	err := f.discussionSvc.ArchiveDiscussion(d.ID)

	if want := "Approved drafts wait to be published."; err == nil || err.Error() != want {
		t.Errorf("ArchiveDiscussion() = %v, want %q", err, want)
	}
	if got := f.discussionOf(t, d.ID); got.CanArchive || got.ArchiveHint != "Approved drafts wait to be published." {
		t.Errorf("discussion = %+v, want one that cannot be archived yet", got)
	}
	if f.logged(t, "binding failed") {
		t.Error("a discussion that cannot be archived yet was logged, want nothing logged")
	}
}

func TestArchivingADiscussionMovesItToTheHistory(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())
	f.registerBoard(t, true)
	d := f.seedDiscussion(t, webDraft("export-invoices", "Export the invoices"))
	if err := f.discussionSvc.DecideDraft(d.ID, "export-invoices", "discarded"); err != nil {
		t.Fatalf("DecideDraft() = %v, want nil", err)
	}

	if err := f.discussionSvc.ArchiveDiscussion(d.ID); err != nil {
		t.Fatalf("ArchiveDiscussion() = %v, want nil", err)
	}

	state := f.state.GetState()
	if len(state.Discussions) != 0 {
		t.Errorf("discussions = %+v, want none left active", state.Discussions)
	}
	if len(state.DiscussionHistory) != 1 || state.DiscussionHistory[0].ID != d.ID {
		t.Fatalf("history = %+v, want the discussion just archived", state.DiscussionHistory)
	}
	if got := state.DiscussionHistory[0]; got.Title != "Invoices" || got.PublishedCount != 0 {
		t.Errorf("archived discussion = %+v, want the one that published nothing", got)
	}
	err := f.discussionSvc.DecideDraft(d.ID, "export-invoices", "approved")
	if want := "This discussion is archived."; err == nil || err.Error() != want {
		t.Errorf("DecideDraft() on an archived discussion = %v, want %q", err, want)
	}
}

func TestDeletingADiscussionTakesItOutOfTheState(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())
	f.registerBoard(t, true)
	d := f.seedDiscussion(t, webDraft("export-invoices", "Export the invoices"))

	if err := f.discussionSvc.DeleteDiscussion(d.ID); err != nil {
		t.Fatalf("DeleteDiscussion() = %v, want nil", err)
	}

	if discussions := f.state.GetState().Discussions; len(discussions) != 0 {
		t.Errorf("discussions = %+v, want none left", discussions)
	}
	err := f.discussionSvc.DeleteDiscussion(d.ID)
	if want := "This discussion no longer exists."; err == nil || err.Error() != want {
		t.Errorf("DeleteDiscussion() = %v, want %q", err, want)
	}
}

func TestStartingADiscussionIsRefusedBeforeItSaysAnything(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())
	f.registerBoard(t, true, webCard(12))

	req := bindings.StartDiscussionRequest{BoardID: testBoardID, Title: "Invoices", Text: "Bill them."}
	req.Model, req.Effort = "", "high"
	if _, err := f.discussionSvc.StartDiscussion(req); err == nil || err.Error() != "Choose a model." {
		t.Errorf("StartDiscussion(no model) = %v, want the sentence about the model", err)
	}

	req.Model, req.Effort = "claude-opus-5-5[1m]", "high"
	req.Title = ""
	if _, err := f.discussionSvc.StartDiscussion(req); err == nil || err.Error() != "Write a title." {
		t.Errorf("StartDiscussion(no title) = %v, want the sentence about the title", err)
	}

	req.Title, req.Text = "Invoices", ""
	_, err := f.discussionSvc.StartDiscussion(req)
	if want := "Write what to discuss or select at least one card."; err == nil || err.Error() != want {
		t.Errorf("StartDiscussion(nothing to discuss) = %v, want %q", err, want)
	}
	if discussions := f.state.GetState().Discussions; len(discussions) != 0 {
		t.Errorf("discussions = %+v, want none created", discussions)
	}
}

func TestTheContextOfADiscussionIsTheBoardWithTheSelectedCards(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())
	f.registerBoard(t, true, webCard(12))

	got, err := f.discussionSvc.DiscussionContext(bindings.DiscussionContextRequest{
		BoardID: testBoardID, Text: "The invoices of the month.", Cards: []string{"dev/web#12"},
	})
	if err != nil {
		t.Fatalf("DiscussionContext() = %v, want nil", err)
	}

	if !strings.HasPrefix(got, "## Board") {
		t.Errorf("context = %q, want it to open at the board: the dialog has no title yet", got)
	}
	for _, want := range []string{"Roadmap", "dev/web", "The invoices of the month.", "Add the login screen"} {
		if !strings.Contains(got, want) {
			t.Errorf("context = %q, want it to hold %q", got, want)
		}
	}
	_, err = f.discussionSvc.DiscussionContext(bindings.DiscussionContextRequest{
		BoardID: testBoardID, Cards: []string{"dev/web#7"},
	})
	if want := "This card isn't in the last reading of the board."; err == nil || err.Error() != want {
		t.Errorf("DiscussionContext(unknown card) = %v, want %q", err, want)
	}
}

func TestTheContextOfADiscussionOfABoardThatWasNeverReadSaysSo(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())
	b := board.Board{
		ID: "board-2", Owner: "acme", OwnerType: board.OwnerOrganization, Number: 4,
		Title: "Later", URL: "https://github.com/orgs/acme/projects/4", FinalStatuses: []string{},
	}
	if err := f.store.Boards.InsertBoard(t.Context(), b, nil); err != nil {
		t.Fatalf("InsertBoard() = %v, want nil", err)
	}
	f.load(t)

	_, err := f.discussionSvc.DiscussionContext(bindings.DiscussionContextRequest{
		BoardID: "board-2", Cards: []string{"dev/web#12"},
	})

	if want := "The board hasn't been read yet."; err == nil || err.Error() != want {
		t.Errorf("DiscussionContext() = %v, want %q", err, want)
	}
}

func TestReadingAnArtifactOfADiscussionReturnsWhatWasToBeDiscussed(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())
	f.registerBoard(t, true)
	d := f.seedDiscussion(t)

	content, err := f.discussionSvc.ReadDiscussionArtifact(d.ID, "context.md")
	if err != nil {
		t.Fatalf("ReadDiscussionArtifact() = %v, want nil", err)
	}
	if !strings.Contains(content, "# Invoices") {
		t.Errorf("content = %q, want the initial context of the discussion", content)
	}
	if _, err = f.discussionSvc.ReadDiscussionArtifact(d.ID, "secrets.txt"); err == nil ||
		err.Error() != "Unknown artifact." {
		t.Errorf("ReadDiscussionArtifact(secrets.txt) = %v, want an unknown artifact", err)
	}
}

func TestTheConversationOfADiscussionThatHasNotOpenedYetIsEmpty(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())
	f.registerBoard(t, true)
	d := f.seedDiscussion(t)

	transcript, err := f.tasks.GetTranscript(d.ID, "discussion")
	if err != nil {
		t.Fatalf("GetTranscript() = %v, want nil", err)
	}

	if transcript.TaskID != d.ID || len(transcript.Entries) != 0 || transcript.Entries == nil {
		t.Errorf("transcript = %+v, want an empty conversation of the discussion", transcript)
	}
}

func TestTheContextOfACardOpensWithTheDocumentOfTheDiscussionThatWroteIt(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())
	f.registerBoard(t, true, webCard(12))
	d := f.seedDiscussion(t, webDraft("export-invoices", "Export the invoices"))
	f.seedPublication(t, d, "export-invoices", 12)
	card := webCard(12)

	got, err := f.boardService.CardContext(testBoardID, "dev/web#12")
	if err != nil {
		t.Fatalf("CardContext() = %v, want nil", err)
	}

	if want := board.Context(card, discussionDocument, ""); got != want {
		t.Errorf("context = %q, want %q", got, want)
	}
}

func TestATaskCreatedFromACardStartsWithTheDocumentOfItsDiscussion(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())
	card := webCard(12)
	f.registerBoard(t, true, card)
	d := f.seedDiscussion(t, webDraft("export-invoices", "Export the invoices"))
	f.seedPublication(t, d, "export-invoices", 12)

	id, err := f.tasks.CreateTask(cardTask("12-add-the-login-screen", 12))
	if err != nil {
		t.Fatalf("CreateTask() = %v, want nil", err)
	}
	f.waitForStatus(t, id, "waiting")

	created, ok := f.taskSvc.Get(id)
	if !ok {
		t.Fatalf("task %s was not created", id)
	}
	if want := board.Context(card, discussionDocument, "Keep the form short."); created.InitialContext != want {
		t.Errorf("initial context = %q, want %q", created.InitialContext, want)
	}
}

func TestApprovingADraftWithoutATitleGetsItsSentence(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.register(t, t.TempDir())
	f.registerBoard(t, true)
	d := f.seedDiscussion(t,
		webDraft("export-invoices", "Export the invoices"),
		webDraft("email-invoices", "Email the invoices"),
	)
	epicID, err := f.discussionSvc.GroupIntoEpic(d.ID, []string{"export-invoices", "email-invoices"})
	if err != nil {
		t.Fatalf("GroupIntoEpic() = %v, want nil", err)
	}

	err = f.discussionSvc.DecideDraft(d.ID, epicID, "approved")

	if err == nil || err.Error() != "Name the draft to approve it." {
		t.Errorf("DecideDraft(untitled epic) = %v, want the sentence about the name", err)
	}
	if f.logged(t, "binding failed") {
		t.Error("a refusal the user can read was logged as a failure")
	}
}
