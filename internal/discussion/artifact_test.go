package discussion_test

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/discussion"
)

// fullArtifact has one draft of every kind, with every field a draft takes.
const fullArtifact = `---
status: drafts
---

## Draft: invoices-epic
- Kind: epic
- Repository: acme/web

### Title
Invoices

### Body
The invoices of the customer.

## Draft: export-invoices
- Kind: new
- Repository: acme/web
- Module: Billing
- Epic: invoices-epic
- Depends on: invoice-schema, acme/api#42

### Title
Export invoices as CSV

### Body
The user exports the invoices.

- One
- Two

## Draft: invoice-schema
- Kind: update
- Card: acme/api#12

### Title
Invoice schema

### Body
The schema of an invoice.
`

func TestParseArtifactReadsEveryFieldOfEveryDraft(t *testing.T) {
	t.Parallel()

	got, err := discussion.ParseArtifact(fullArtifact)
	if err != nil {
		t.Fatalf("parse artifact: %v", err)
	}

	want := discussion.Artifact{Drafts: []discussion.ParsedDraft{
		{
			ID:         "invoices-epic",
			Kind:       discussion.KindEpic,
			Repository: "acme/web",
			Title:      "Invoices",
			Body:       "The invoices of the customer.",
		},
		{
			ID:         "export-invoices",
			Kind:       discussion.KindNew,
			Repository: "acme/web",
			Module:     "Billing",
			Epic:       &discussion.Ref{Draft: "invoices-epic"},
			Dependencies: []discussion.Ref{
				{Draft: "invoice-schema"},
				{Owner: "acme", Name: "api", Number: 42},
			},
			Title: "Export invoices as CSV",
			Body:  "The user exports the invoices.\n\n- One\n- Two",
		},
		{
			ID:    "invoice-schema",
			Kind:  discussion.KindUpdate,
			Card:  &discussion.Ref{Owner: "acme", Name: "api", Number: 12},
			Title: "Invoice schema",
			Body:  "The schema of an invoice.",
		},
	}}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("parsed artifact (-want +got):\n%s", diff)
	}
}

func TestParseArtifactReadsAFileWithoutDrafts(t *testing.T) {
	t.Parallel()

	got, err := discussion.ParseArtifact("---\nstatus: none\n---\n\nNothing to write.\n")
	if err != nil {
		t.Fatalf("parse artifact: %v", err)
	}
	if len(got.Drafts) != 0 {
		t.Errorf("drafts = %d, want none", len(got.Drafts))
	}
}

func TestParseArtifactRefusesWhatItCannotAct(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		content string
		reason  string // the part of the message that says why; "" asks for none
	}{
		{"without front matter", `## Draft: one
- Kind: new
- Repository: acme/web

### Title
One

### Body
One.
`, "no front matter"},
		{"with an unknown status", "---\nstatus: ready\n---\n", ""},
		{"saying there are no drafts and having one", `---
status: none
---

## Draft: one
- Kind: new
- Repository: acme/web

### Title
One

### Body
One.
`, "says there is no draft"},
		{"saying there are drafts and having none", "---\nstatus: drafts\n---\n\nNothing.\n", ""},
		{"with an id that is no id", `---
status: drafts
---

## Draft: Export Invoices
- Kind: new
- Repository: acme/web

### Title
One

### Body
One.
`, "is no draft id"},
		{"with an id reserved for the user", `---
status: drafts
---

## Draft: user-epic-1
- Kind: new
- Repository: acme/web

### Title
One

### Body
One.
`, "is reserved"},
		{"with the same id twice", `---
status: drafts
---

## Draft: one
- Kind: new
- Repository: acme/web

### Title
One

### Body
One.

## Draft: one
- Kind: new
- Repository: acme/web

### Title
Two

### Body
Two.
`, ""},
		{"with a line that is no field", `---
status: drafts
---

## Draft: one
- Kind: new
Something else

### Title
One

### Body
One.
`, ""},
		{"with the same field twice", `---
status: drafts
---

## Draft: one
- Kind: new
- Repository: acme/web
- Repository: acme/api

### Title
One

### Body
One.
`, ""},
		{"without a kind", "---\nstatus: drafts\n---\n\n## Draft: one\n- Repository: acme/web\n\n### Title\nOne\n\n### Body\nOne.\n", ""},
		{"with a kind that is no kind", "---\nstatus: drafts\n---\n\n## Draft: one\n- Kind: rewrite\n\n### Title\nOne\n\n### Body\nOne.\n", ""},
		{"updating without a card", "---\nstatus: drafts\n---\n\n## Draft: one\n- Kind: update\n\n### Title\nOne\n\n### Body\nOne.\n", ""},
		{"updating with a repository", `---
status: drafts
---

## Draft: one
- Kind: update
- Card: acme/web#1
- Repository: acme/web

### Title
One

### Body
One.
`, ""},
		{"creating with a card", `---
status: drafts
---

## Draft: one
- Kind: new
- Card: acme/web#1

### Title
One

### Body
One.
`, ""},
		{"creating without a repository", "---\nstatus: drafts\n---\n\n## Draft: one\n- Kind: new\n\n### Title\nOne\n\n### Body\nOne.\n", ""},
		{"with a repository that is no owner/name", `---
status: drafts
---

## Draft: one
- Kind: new
- Repository: web

### Title
One

### Body
One.
`, ""},
		{"updating a card that is a draft id", `---
status: drafts
---

## Draft: one
- Kind: update
- Card: another

### Title
One

### Body
One.
`, ""},
		{"with an epic on an epic", `---
status: drafts
---

## Draft: one
- Kind: epic
- Repository: acme/web
- Epic: acme/web#3

### Title
One

### Body
One.
`, ""},
		{"with a module on an epic", `---
status: drafts
---

## Draft: one
- Kind: epic
- Repository: acme/web
- Module: Billing

### Title
One

### Body
One.
`, ""},
		{"with a dependency on an epic", `---
status: drafts
---

## Draft: one
- Kind: epic
- Repository: acme/web
- Depends on: two

### Title
One

### Body
One.
`, ""},
		{"with an epic that is no reference", `---
status: drafts
---

## Draft: one
- Kind: new
- Repository: acme/web
- Epic: Invoices Epic

### Title
One

### Body
One.
`, ""},
		{"with a dependency that is no reference", `---
status: drafts
---

## Draft: one
- Kind: new
- Repository: acme/web
- Depends on: acme/web#x

### Title
One

### Body
One.
`, ""},
		{"depending on itself", `---
status: drafts
---

## Draft: one
- Kind: new
- Repository: acme/web
- Depends on: one

### Title
One

### Body
One.
`, ""},
		{"without the title heading", "---\nstatus: drafts\n---\n\n## Draft: one\n- Kind: new\n- Repository: acme/web\n\n### Body\nOne.\n", ""},
		{"without the body heading", "---\nstatus: drafts\n---\n\n## Draft: one\n- Kind: new\n- Repository: acme/web\n\n### Title\nOne\n", ""},
		{"with an empty title", `---
status: drafts
---

## Draft: one
- Kind: new
- Repository: acme/web

### Title

### Body
One.
`, ""},
		{"with an empty body", `---
status: drafts
---

## Draft: one
- Kind: new
- Repository: acme/web

### Title
One

### Body

`, ""},
		{"with a title longer than the longest", `---
status: drafts
---

## Draft: one
- Kind: new
- Repository: acme/web

### Title
` + strings.Repeat("a", 257) + `

### Body
One.
`, ""},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()

			_, err := discussion.ParseArtifact(c.content)
			if !errors.Is(err, discussion.ErrUnreadable) {
				t.Fatalf("error = %v, want ErrUnreadable", err)
			}
			if c.reason != "" && !strings.Contains(err.Error(), c.reason) {
				t.Errorf("error %q does not say %q", err, c.reason)
			}
		})
	}
}

func TestParseArtifactTakesTheBodyUpToTheNextDraft(t *testing.T) {
	t.Parallel()

	got, err := discussion.ParseArtifact(`---
status: drafts
---

## Draft: one
- Kind: new
- Repository: acme/web

### Title
One

### Body
The body, with a heading of its own.

## Context
What it is for.

## Draft: two
- Kind: new
- Repository: acme/web

### Title
Two

### Body
Two.
`)
	if err != nil {
		t.Fatalf("parse artifact: %v", err)
	}

	want := "The body, with a heading of its own.\n\n## Context\nWhat it is for."
	if got.Drafts[0].Body != want {
		t.Errorf("body = %q, want %q", got.Drafts[0].Body, want)
	}
	if len(got.Drafts) != 2 {
		t.Errorf("drafts = %d, want 2", len(got.Drafts))
	}
}

func TestReadArtifactTellsAFileThatIsNotThereFromOneItCannotRead(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	path := filepath.Join(dir, discussion.DraftsFile)

	if _, ok, err := discussion.ReadArtifact(path); ok || err != nil {
		t.Fatalf("read of a missing file: ok = %v, err = %v", ok, err)
	}

	if err := os.WriteFile(path, []byte("no front matter"), 0o600); err != nil {
		t.Fatalf("write drafts: %v", err)
	}
	if _, _, err := discussion.ReadArtifact(path); !errors.Is(err, discussion.ErrUnreadable) {
		t.Fatalf("error = %v, want ErrUnreadable", err)
	}

	if err := os.WriteFile(path, []byte(fullArtifact), 0o600); err != nil {
		t.Fatalf("write drafts: %v", err)
	}
	artifact, ok, err := discussion.ReadArtifact(path)
	if err != nil || !ok {
		t.Fatalf("read drafts: ok = %v, err = %v", ok, err)
	}
	if len(artifact.Drafts) != 3 {
		t.Errorf("drafts = %d, want 3", len(artifact.Drafts))
	}
}
