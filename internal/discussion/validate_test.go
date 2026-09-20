package discussion_test

import (
	"errors"
	"strings"
	"testing"

	"github.com/guilhermt/myspec/internal/discussion"
)

// boardCatalog is the board the artifacts of the tests are checked against.
func boardCatalog() discussion.Catalog {
	return discussion.Catalog{
		Repositories: []string{"acme/web", "acme/api"},
		Cards: map[string]discussion.InputCard{
			"acme/api#12": {Owner: "acme", Name: "api", Number: 12, Title: "Invoices"},
		},
		HasModule:     true,
		ModuleOptions: []string{"Billing", "Reports"},
	}
}

// parse reads an artifact the test wrote, which the parser must accept.
func parse(t *testing.T, content string) discussion.Artifact {
	t.Helper()

	artifact, err := discussion.ParseArtifact(content)
	if err != nil {
		t.Fatalf("parse artifact: %v", err)
	}
	return artifact
}

// draftOf writes one draft of the artifact of a test.
func draftOf(id string, fields ...string) string {
	var b strings.Builder
	b.WriteString("\n## Draft: " + id + "\n")
	for _, field := range fields {
		b.WriteString("- " + field + "\n")
	}
	b.WriteString("\n### Title\n" + id + "\n\n### Body\nThe body of " + id + ".\n")
	return b.String()
}

// artifactOf writes an artifact out of its drafts.
func artifactOf(drafts ...string) string {
	return "---\nstatus: drafts\n---\n" + strings.Join(drafts, "")
}

func TestValidateAcceptsAnArtifactTheBoardAnswersFor(t *testing.T) {
	t.Parallel()

	artifact := parse(t, artifactOf(
		draftOf("epic", "Kind: epic", "Repository: ACME/Web"),
		draftOf("one", "Kind: new", "Repository: acme/web", "Module: billing", "Epic: epic", "Depends on: two"),
		draftOf("two", "Kind: update", "Card: acme/api#12"),
	))

	if err := discussion.Validate(artifact, boardCatalog()); err != nil {
		t.Fatalf("validate: %v", err)
	}
	if got := artifact.Drafts[1].Module; got != "Billing" {
		t.Errorf("module = %q, want the name the board has", got)
	}
}

func TestValidateRefusesWhatTheBoardDoesNotAnswerFor(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		content string
		reason  string
	}{
		{
			"a repository the board does not manage",
			artifactOf(draftOf("one", "Kind: new", "Repository: other/web")),
			"other/web",
		},
		{
			"a card that is not on the board",
			artifactOf(draftOf("one", "Kind: update", "Card: acme/api#99")),
			"acme/api#99",
		},
		{
			"a module that is no option",
			artifactOf(draftOf("one", "Kind: new", "Repository: acme/web", "Module: Payments")),
			"module field",
		},
		{
			"an epic that is no draft of the artifact",
			artifactOf(draftOf("one", "Kind: new", "Repository: acme/web", "Epic: missing")),
			"missing",
		},
		{
			"an epic that is another card",
			artifactOf(
				draftOf("one", "Kind: new", "Repository: acme/web", "Epic: two"),
				draftOf("two", "Kind: new", "Repository: acme/web"),
			),
			"two",
		},
		{
			"a dependency that is no draft of the artifact",
			artifactOf(draftOf("one", "Kind: new", "Repository: acme/web", "Depends on: missing")),
			"missing",
		},
		{
			"a dependency that is an epic",
			artifactOf(
				draftOf("one", "Kind: new", "Repository: acme/web", "Depends on: two"),
				draftOf("two", "Kind: epic", "Repository: acme/web"),
			),
			"two",
		},
		{
			"the same dependency twice",
			artifactOf(draftOf("one", "Kind: new", "Repository: acme/web", "Depends on: acme/api#12, ACME/API#12")),
			"twice",
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()

			err := discussion.Validate(parse(t, c.content), boardCatalog())
			if !errors.Is(err, discussion.ErrUnreadable) {
				t.Fatalf("error = %v, want ErrUnreadable", err)
			}
			if !strings.Contains(err.Error(), "draft one") {
				t.Errorf("error %q does not name the draft", err)
			}
			if !strings.Contains(err.Error(), c.reason) {
				t.Errorf("error %q does not say %q", err, c.reason)
			}
		})
	}
}

func TestValidateRefusesAModuleOnABoardWithoutTheField(t *testing.T) {
	t.Parallel()

	catalog := boardCatalog()
	catalog.HasModule, catalog.ModuleOptions = false, nil

	artifact := parse(t, artifactOf(draftOf("one", "Kind: new", "Repository: acme/web", "Module: Billing")))
	if err := discussion.Validate(artifact, catalog); !errors.Is(err, discussion.ErrUnreadable) {
		t.Errorf("error = %v, want ErrUnreadable", err)
	}
}
