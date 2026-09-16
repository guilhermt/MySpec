package task_test

import (
	"errors"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/task"
)

func TestKeyIsTheIssueInLowerCase(t *testing.T) {
	t.Parallel()

	c := newCard(12)
	c.Epic = &task.CardEpic{Owner: "Dev", Name: "Web", Number: 3}

	if got, want := c.Key(), "dev/web#12"; got != want {
		t.Errorf("Card.Key() = %q, want %q", got, want)
	}
	if got, want := c.Epic.Key(), "dev/web#3"; got != want {
		t.Errorf("CardEpic.Key() = %q, want %q", got, want)
	}
	if got, want := c.Reference(), "Dev/Web#12"; got != want {
		t.Errorf("Reference() = %q, want %q", got, want)
	}
}

func TestMarkdownIsTheCardForThePrompt(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		body string
		want string
	}{
		{
			name: "with a body",
			body: "\n  A login screen.\n\n",
			want: "### Add login\n\n- Issue: Dev/Web#12\n- Link: https://github.com/Dev/Web/issues/12\n\nA login screen.",
		},
		{
			name: "without a body",
			body: " \n",
			want: "### Add login\n\n- Issue: Dev/Web#12\n- Link: https://github.com/Dev/Web/issues/12\n\n" +
				"_The card has no description._",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			c := newCard(12)
			c.Body = tt.body
			if diff := cmp.Diff(tt.want, c.Markdown()); diff != "" {
				t.Errorf("Markdown() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestEnsureClosingReferenceAppendsOnlyWhatIsMissing(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		body string
		want string
	}{
		{name: "closes with the number", body: "Adds login.\n\nCloses #12", want: "Adds login.\n\nCloses #12"},
		{name: "fixes with the repository", body: "fixes dev/web#12.", want: "fixes dev/web#12."},
		{name: "resolved with a colon", body: "Resolved: #12", want: "Resolved: #12"},
		{name: "another number", body: "Closes #123", want: "Closes #123\n\nCloses Dev/Web#12"},
		{name: "another repository", body: "Closes dev/api#12", want: "Closes dev/api#12\n\nCloses Dev/Web#12"},
		{name: "a mention", body: "Adds login.\n\nSee #12\n", want: "Adds login.\n\nSee #12\n\nCloses Dev/Web#12"},
		{name: "an empty body", body: "", want: "Closes Dev/Web#12"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if diff := cmp.Diff(tt.want, task.EnsureClosingReference(tt.body, newCard(12))); diff != "" {
				t.Errorf("EnsureClosingReference() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestCreateKeepsTheCardOfTheTask(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	card := newCard(12)
	card.Epic = &task.CardEpic{Owner: "Dev", Name: "Web", Number: 3, Title: "Auth"}

	created := f.createWithCard(t, "add-login", card)

	if diff := cmp.Diff(&card, created.Card); diff != "" {
		t.Errorf("Create() card mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff(&card, f.repo.get(t, created.ID).Card); diff != "" {
		t.Errorf("stored card mismatch (-want +got):\n%s", diff)
	}
	if f.logs.count(t, "task created") != 1 {
		t.Errorf("task created logged %d times, want 1", f.logs.count(t, "task created"))
	}
}

func TestCreateRefusesACardWithAnActiveTask(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.createWithCard(t, "add-login", newCard(12))

	other := newCard(12)
	other.Owner, other.Name = "dev", "web"
	_, err := f.service.Create(t.Context(), task.CreateParams{Name: "add-login-again", RepositoryID: repoID, Card: &other})

	var taken *task.CardTakenError
	if !errors.As(err, &taken) {
		t.Fatalf("Create() = %v, want a CardTakenError", err)
	}
	if diff := cmp.Diff(&task.CardTakenError{Number: 12, TaskName: "add-login"}, taken); diff != "" {
		t.Errorf("CardTakenError mismatch (-want +got):\n%s", diff)
	}
	if got := len(f.service.List()); got != 1 {
		t.Errorf("List() has %d tasks, want 1", got)
	}
}

func TestArchivingATaskFreesItsCard(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	first := f.createWithCard(t, "add-login", newCard(12))
	if _, err := f.service.Archive(t.Context(), first.ID); err != nil {
		t.Fatalf("Archive() = %v, want nil", err)
	}

	second := f.createWithCard(t, "add-login-again", newCard(12))

	want := map[string]task.CardTaskIDs{"dev/web#12": {Active: second.ID, Archived: first.ID}}
	if diff := cmp.Diff(want, f.service.CardTasks()); diff != "" {
		t.Errorf("CardTasks() mismatch (-want +got):\n%s", diff)
	}
}

func TestCreateFromACardNeedsNoContext(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.createWithCard(t, "add-login", newCard(12))

	if created.InitialContext != "" {
		t.Errorf("InitialContext = %q, want empty", created.InitialContext)
	}
}

func TestCardTasksKeepsTheMostRecentlyArchivedTask(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.create(t, "no-card")
	archived := make([]string, 0, 2)
	for _, name := range []string{"first", "second"} {
		created := f.createWithCard(t, name, newCard(12))
		if _, err := f.service.Archive(t.Context(), created.ID); err != nil {
			t.Fatalf("Archive() = %v, want nil", err)
		}
		archived = append(archived, created.ID)
	}

	want := map[string]task.CardTaskIDs{"dev/web#12": {Archived: archived[1]}}
	if diff := cmp.Diff(want, f.service.CardTasks()); diff != "" {
		t.Errorf("CardTasks() mismatch (-want +got):\n%s", diff)
	}
}

func TestUpdateCardsRewritesOnlyTheActiveTasksOfTheBoard(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	updated := f.createWithCard(t, "updated", newCard(12))
	missing := f.createWithCard(t, "missing", newCard(13))
	otherBoardCard := newCard(14)
	otherBoardCard.BoardID = "board-2"
	otherBoard := f.createWithCard(t, "other-board", otherBoardCard)
	archived := f.createWithCard(t, "archived", newCard(15))
	if _, err := f.service.Archive(t.Context(), archived.ID); err != nil {
		t.Fatalf("Archive() = %v, want nil", err)
	}
	before := f.changeCount()

	readAt := base.Add(time.Hour)
	epic := &task.CardEpic{Owner: "Dev", Name: "Web", Number: 3, Title: "Auth", URL: "https://github.com/Dev/Web/issues/3"}
	update := task.CardUpdate{
		Title: "Add login and logout", Body: "Both.", URL: "https://github.com/Dev/Web/issues/12",
		Status: "Done", State: task.IssueClosed, Epic: epic, ReadAt: readAt,
	}
	updates := map[string]task.CardUpdate{"dev/web#12": update, "dev/web#14": update, "dev/web#15": update}

	if err := f.service.UpdateCards(t.Context(), "board-1", updates); err != nil {
		t.Fatalf("UpdateCards() = %v, want nil", err)
	}

	want := newCard(12)
	want.Title, want.Body, want.Status, want.State, want.Epic, want.ReadAt = update.Title, update.Body, "Done", task.IssueClosed, epic, readAt
	got, _ := f.service.Get(updated.ID)
	if diff := cmp.Diff(&want, got.Card); diff != "" {
		t.Errorf("updated card mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff(&want, f.repo.get(t, updated.ID).Card); diff != "" {
		t.Errorf("stored card mismatch (-want +got):\n%s", diff)
	}
	for _, kept := range []task.Task{missing, otherBoard, archived} {
		if diff := cmp.Diff(kept.Card, f.repo.get(t, kept.ID).Card); diff != "" {
			t.Errorf("card of %s changed (-want +got):\n%s", kept.Name, diff)
		}
	}
	if got := f.changeCount() - before; got != 1 {
		t.Errorf("OnChange ran %d times, want 1", got)
	}

	if err := f.service.UpdateCards(t.Context(), "board-1", updates); err != nil {
		t.Fatalf("UpdateCards() again = %v, want nil", err)
	}
	if got := f.changeCount() - before; got != 1 {
		t.Errorf("OnChange ran %d times after the same reading, want 1", got)
	}
}

func TestUpdateCardsFailsWhenTheCardCannotBeStored(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.createWithCard(t, "add-login", newCard(12))
	f.repo.updateErr = errors.New("disk full")

	update := task.CardUpdate{Title: "Renamed", URL: created.Card.URL, State: task.IssueOpen, ReadAt: base}
	err := f.service.UpdateCards(t.Context(), "board-1", map[string]task.CardUpdate{"dev/web#12": update})
	if err == nil {
		t.Fatal("UpdateCards() = nil, want an error")
	}
	got, _ := f.service.Get(created.ID)
	if got.Card.Title != "Add login" {
		t.Errorf("card title = %q, want it unchanged", got.Card.Title)
	}
}
