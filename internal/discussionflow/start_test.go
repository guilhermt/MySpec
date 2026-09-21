package discussionflow_test

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/board"
	"github.com/guilhermt/myspec/internal/discussion"
	"github.com/guilhermt/myspec/internal/discussionflow"
	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/session"
)

func TestStartingADiscussionWritesTheInitialContextAndOpensTheConversation(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(cardKey)

	stored, ok := f.discussions.Get(id)
	if !ok {
		t.Fatalf("the discussion %s is not there", id)
	}
	content, err := os.ReadFile(stored.ContextPath())
	if err != nil {
		t.Fatalf("read context: %v", err)
	}
	for _, want := range []string{
		"# Invoices", "## Board", "- Board: Roadmap",
		"  - acme/api: " + filepath.Join(f.dataDir, "api"),
		"## What to discuss", "Export invoices", "## Card: Invoices", "- Issue: acme/web#12",
	} {
		if !strings.Contains(string(content), want) {
			t.Errorf("the initial context says nothing about %q:\n%s", want, content)
		}
	}

	info := f.sessions.info(id)
	if diff := cmp.Diff(session.TaskInfo{
		ID:             id,
		Name:           "Invoices",
		Dir:            stored.ArtifactsDir,
		ArtifactsDir:   stored.ArtifactsDir,
		Stage:          session.DiscussionStage,
		Prompt:         prompts.StageDiscussion,
		InitialContext: stored.InitialContext,
		DocumentPath:   stored.DocumentPath(),
		DraftsPath:     stored.DraftsPath(),
		Board: strings.Join([]string{
			"- Board: Roadmap",
			"- Repositories managed by the board: acme/api, acme/web",
			"- Module field: `Módulo`, with the options: Billing, Auth",
			"- Status for new cards: A Fazer",
		}, "\n"),
		ExtraDirs: []string{filepath.Join(f.dataDir, "api"), filepath.Join(f.dataDir, "web")},
	}, info); diff != "" {
		t.Errorf("the conversation of the discussion opened with the wrong task (-want +got):\n%s", diff)
	}
}

func TestTheContextOfADiscussionIsBuiltFromTheBoardWithoutCreatingAnything(t *testing.T) {
	t.Parallel()

	f := newFixture(t)

	text, err := f.flow.Context(boardID, "Invoices", "Export invoices", []string{cardKey})
	if err != nil {
		t.Fatalf("build the context of a discussion: %v", err)
	}

	for _, want := range []string{
		"# Invoices", "## Board", "- Board: Roadmap",
		"  - acme/api: " + filepath.Join(f.dataDir, "api"),
		"## What to discuss", "Export invoices", "## Card: Invoices", "- Issue: acme/web#12",
	} {
		if !strings.Contains(text, want) {
			t.Errorf("the context says nothing about %q:\n%s", want, text)
		}
	}
	if list := f.discussions.List(); len(list) != 0 {
		t.Errorf("the context created %d discussions", len(list))
	}
}

func TestTheContextOfADiscussionIsRefusedForACardThatIsNotOnTheBoard(t *testing.T) {
	t.Parallel()

	f := newFixture(t)

	_, err := f.flow.Context(boardID, "Invoices", "", []string{"acme/web#99"})
	if !errors.Is(err, board.ErrCardNotFound) {
		t.Fatalf("build the context of a discussion: got %v, want %v", err, board.ErrCardNotFound)
	}
}

func TestABoardWithoutAModuleFieldTellsTheAgentThatDraftsTakeNone(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.boards.stored.Reading.Module = nil
	f.boards.board.NewCardStatus = ""

	id := f.start()

	want := strings.Join([]string{
		"- Board: Roadmap",
		"- Repositories managed by the board: acme/api, acme/web",
		"- Module field: none. Drafts have no module.",
		"- Status for new cards: none.",
	}, "\n")
	if got := f.sessions.info(id).Board; got != want {
		t.Errorf("the board section is wrong:\n%s", got)
	}
}

func TestADiscussionIsUndoneWhenItsConversationCannotStart(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.sessions.startErr = errSession

	_, err := f.flow.Start(t.Context(), discussionflow.StartParams{BoardID: boardID, Title: "Invoices", Text: "Export"})
	if !errors.Is(err, errSession) {
		t.Fatalf("start discussion: got %v, want %v", err, errSession)
	}
	if list := f.discussions.List(); len(list) != 0 {
		t.Errorf("the discussion stayed: %d in the list", len(list))
	}
	if _, err = os.Stat(filepath.Join(f.dataDir, "discussions")); err == nil {
		entries, readErr := os.ReadDir(filepath.Join(f.dataDir, "discussions", "acme", "7"))
		if readErr == nil && len(entries) > 0 {
			t.Errorf("the artifacts of the discussion stayed: %d folders", len(entries))
		}
	}
}

func TestStartingADiscussionIsRefusedForACardOfARepositoryTheBoardDoesNotManage(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.boards.stored.Reading.Cards = append(f.boards.stored.Reading.Cards, board.Card{
		Issue: board.Issue{Owner: "acme", Name: "mobile", Number: 3, Title: "Outside"},
	})

	_, err := f.flow.Start(t.Context(), discussionflow.StartParams{
		BoardID: boardID, Title: "Invoices", Cards: []string{"acme/mobile#3"},
	})

	var refusal *board.Refusal
	if !errors.As(err, &refusal) || refusal.Reason != board.RefusalNotManaged {
		t.Fatalf("start discussion: got %v, want a not_managed refusal", err)
	}
	if refusal.Repository != "acme/mobile" {
		t.Errorf("the refusal names %q, want acme/mobile", refusal.Repository)
	}
}

func TestStartingADiscussionOverCardsIsRefusedBeforeTheBoardIsRead(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.boards.stored = board.Stored{}

	_, err := f.flow.Start(t.Context(), discussionflow.StartParams{
		BoardID: boardID, Title: "Invoices", Cards: []string{cardKey},
	})
	if !errors.Is(err, discussionflow.ErrNoReading) {
		t.Fatalf("start discussion: got %v, want %v", err, discussionflow.ErrNoReading)
	}
}

func TestStartingADiscussionOnABoardThatIsGoneIsRefused(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.boards.found = false

	_, err := f.flow.Start(t.Context(), discussionflow.StartParams{BoardID: boardID, Title: "Invoices", Text: "Go"})
	if !errors.Is(err, board.ErrNotFound) {
		t.Fatalf("start discussion: got %v, want %v", err, board.ErrNotFound)
	}
}

func TestStartingADiscussionOnACardThatIsNotOnTheBoardIsRefused(t *testing.T) {
	t.Parallel()

	f := newFixture(t)

	_, err := f.flow.Start(t.Context(), discussionflow.StartParams{
		BoardID: boardID, Title: "Invoices", Cards: []string{"acme/web#99"},
	})
	if !errors.Is(err, board.ErrCardNotFound) {
		t.Fatalf("start discussion: got %v, want %v", err, board.ErrCardNotFound)
	}
}

func TestAnEmptyDiscussionIsRefused(t *testing.T) {
	t.Parallel()

	f := newFixture(t)

	_, err := f.flow.Start(t.Context(), discussionflow.StartParams{BoardID: boardID, Title: "Invoices"})
	if !errors.Is(err, discussion.ErrNothingToDiscuss) {
		t.Fatalf("start discussion: got %v, want %v", err, discussion.ErrNothingToDiscuss)
	}
}
