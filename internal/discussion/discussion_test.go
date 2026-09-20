package discussion_test

import (
	"errors"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/discussion"
)

func TestParseRefReadsAnIssueAndADraft(t *testing.T) {
	t.Parallel()

	cases := []struct {
		value string
		want  discussion.Ref
		ok    bool
	}{
		{"acme/web#42", discussion.Ref{Owner: "acme", Name: "web", Number: 42}, true},
		{" acme/web#42 ", discussion.Ref{Owner: "acme", Name: "web", Number: 42}, true},
		{"export-invoices", discussion.Ref{Draft: "export-invoices"}, true},
		{"acme/web#0", discussion.Ref{}, false},
		{"Export", discussion.Ref{}, false},
		{"-export", discussion.Ref{}, false},
		{"", discussion.Ref{}, false},
	}

	for _, c := range cases {
		t.Run(c.value, func(t *testing.T) {
			t.Parallel()

			got, ok := discussion.ParseRef(c.value)
			if ok != c.ok {
				t.Fatalf("ok = %v, want %v", ok, c.ok)
			}
			if diff := cmp.Diff(c.want, got); diff != "" {
				t.Errorf("ref (-want +got):\n%s", diff)
			}
		})
	}
}

func TestARefNamesWhatItPointsAt(t *testing.T) {
	t.Parallel()

	issue := discussion.Ref{Owner: "Acme", Name: "Web", Number: 42}
	if issue.String() != "Acme/Web#42" || issue.Key() != "acme/web#42" || issue.IsDraft() {
		t.Errorf("issue = %s, key = %s", issue, issue.Key())
	}

	draft := discussion.Ref{Draft: "export-invoices"}
	if draft.String() != "export-invoices" || draft.Key() != "draft:export-invoices" || !draft.IsDraft() {
		t.Errorf("draft = %s, key = %s", draft, draft.Key())
	}
}

func TestParseKindAndParseDecisionNarrowWhatTheyAreGiven(t *testing.T) {
	t.Parallel()

	if _, err := discussion.ParseKind("epic"); err != nil {
		t.Errorf("parse kind: %v", err)
	}
	if _, err := discussion.ParseKind("rewrite"); !errors.Is(err, discussion.ErrUnknownKind) {
		t.Errorf("error = %v, want ErrUnknownKind", err)
	}
	if _, err := discussion.ParseDecision(""); err != nil {
		t.Errorf("parse decision: %v", err)
	}
	if _, err := discussion.ParseDecision("maybe"); !errors.Is(err, discussion.ErrUnknownDecision) {
		t.Errorf("error = %v, want ErrUnknownDecision", err)
	}
}

func TestACardNamesItsIssue(t *testing.T) {
	t.Parallel()

	card := discussion.InputCard{Owner: "Acme", Name: "Web", Number: 12}
	if card.Reference() != "Acme/Web#12" || card.Key() != "acme/web#12" {
		t.Errorf("reference = %s, key = %s", card.Reference(), card.Key())
	}
}

func TestADraftSaysWhereItStandsAndWhatItPointsAt(t *testing.T) {
	t.Parallel()

	epic := discussion.Draft{ID: "epic", Kind: discussion.KindEpic}
	if epic.IsCard() || epic.Loose() {
		t.Error("an epic is a card")
	}

	loose := discussion.Draft{ID: "one", Kind: discussion.KindNew, Owner: "acme", Name: "web"}
	if !loose.Loose() || loose.InEpicDraft() || loose.Reference() != "" {
		t.Errorf("draft = %+v, want a loose card nobody published", loose)
	}
	if loose.Decided() {
		t.Error("a draft nobody decided is decided")
	}

	loose.Epic = "epic"
	if !loose.InEpicDraft() || loose.Loose() {
		t.Error("a card under an epic draft is loose")
	}
	loose.Epic = "acme/web#7"
	if loose.InEpicDraft() || !loose.Loose() {
		t.Error("a card under an issue is not loose")
	}

	loose.Published = discussion.Publication{Outcome: discussion.OutcomeCreated, Number: 31}
	if loose.Reference() != "acme/web#31" || !loose.Published.Started() || loose.Published.Done() {
		t.Errorf("reference = %q, want the issue it created", loose.Reference())
	}
	loose.Published.At = base
	if !loose.Published.Done() || !loose.Decided() {
		t.Error("a published draft is neither done nor decided")
	}

	update := discussion.Draft{
		ID:   "two",
		Kind: discussion.KindUpdate,
		Card: &discussion.InputCard{Owner: "acme", Name: "api", Number: 12},
		// The repository of an update is the one of its card.
		Owner: "acme",
		Name:  "api",
	}
	if update.Reference() != "acme/api#12" {
		t.Errorf("reference = %q, want the card it rewrites", update.Reference())
	}
}

func TestADiscussionNamesItsFolderAndTheArtifactsInIt(t *testing.T) {
	t.Parallel()

	dir := discussion.ArtifactsDir("/data", "acme", 7, "0123456789abcdef")
	if want := filepath.Join("/data", "discussions", "acme", "7", "01234567"); dir != want {
		t.Errorf("artifacts directory = %q, want %q", dir, want)
	}

	d := discussion.Discussion{ArtifactsDir: dir}
	if d.DocumentPath() != filepath.Join(dir, discussion.DocumentFile) {
		t.Errorf("document = %q", d.DocumentPath())
	}
	if d.DraftsPath() != filepath.Join(dir, discussion.DraftsFile) {
		t.Errorf("drafts = %q", d.DraftsPath())
	}
	if d.ContextPath() != filepath.Join(dir, discussion.ContextFile) {
		t.Errorf("context = %q", d.ContextPath())
	}
	if d.Archived() {
		t.Error("a discussion without an instant is archived")
	}

	d.ArchivedAt = time.Now()
	if !d.Archived() {
		t.Error("a discussion with an instant is not archived")
	}
}
