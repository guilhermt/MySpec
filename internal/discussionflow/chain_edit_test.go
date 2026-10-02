package discussionflow_test

import (
	"slices"
	"strings"
	"testing"

	"github.com/guilhermt/myspec/internal/discussion"
	"github.com/guilhermt/myspec/internal/discussionflow"
)

// heldArtifact holds what the cases of the invariant start from: an epic of
// three cards, two cards of their own that depend on drafts still to decide,
// and the drafts they wait for.
const heldArtifact = `---
status: drafts
---

## Draft: epic
- Kind: epic
- Repository: acme/web

### Title
The epic

### Body
The epic.

## Draft: in-one
- Kind: new
- Repository: acme/web
- Epic: epic

### Title
In one

### Body
Card one.

## Draft: in-two
- Kind: new
- Repository: acme/web
- Epic: epic

### Title
In two

### Body
Card two.

## Draft: in-three
- Kind: new
- Repository: acme/web
- Epic: epic

### Title
In three

### Body
Card three.

## Draft: held-a
- Kind: new
- Repository: acme/web
- Depends on: gate

### Title
Held A

### Body
A card that waits.

## Draft: held-b
- Kind: new
- Repository: acme/web
- Depends on: gate

### Title
Held B

### Body
Another card that waits.

## Draft: gate
- Kind: new
- Repository: acme/web

### Title
Gate

### Body
What they wait for.
`

func TestNoEditPutsADraftInTheRun(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		approve []string
		// edit is the change of the user, or the rewrite of the agent.
		edit func(t *testing.T, f *fixture, id string)
	}{
		{
			name:    "a card to decide leaves an epic whose other cards are approved",
			approve: []string{"epic", "in-one", "in-two"},
			edit: func(t *testing.T, f *fixture, id string) {
				t.Helper()
				if err := f.flow.SetDraftEpic(t.Context(), id, "in-three", ""); err != nil {
					t.Fatalf("take the card out of the epic: %v", err)
				}
			},
		},
		{
			name:    "a card of its own loses the dependency on a draft to decide",
			approve: []string{"held-a"},
			edit: func(t *testing.T, f *fixture, id string) {
				t.Helper()
				if err := f.flow.RemoveDraftDependency(t.Context(), id, "held-a", "gate"); err != nil {
					t.Fatalf("remove the dependency: %v", err)
				}
			},
		},
		{
			name:    "a card of its own held by a dependency changes its repository",
			approve: []string{"held-a"},
			edit: func(t *testing.T, f *fixture, id string) {
				t.Helper()
				if err := f.flow.SetDraftRepository(t.Context(), id, "held-a", "acme", "api"); err != nil {
					t.Fatalf("set the repository: %v", err)
				}
			},
		},
		{
			name:    "a card of its own held by a dependency gains another",
			approve: []string{"held-a"},
			edit: func(t *testing.T, f *fixture, id string) {
				t.Helper()
				if err := f.flow.AddDraftDependency(t.Context(), id, "held-a", "in-three"); err != nil {
					t.Fatalf("add the dependency: %v", err)
				}
			},
		},
		{
			name:    "two cards of their own held by a dependency are grouped",
			approve: []string{"held-a", "held-b"},
			edit: func(t *testing.T, f *fixture, id string) {
				t.Helper()
				if _, err := f.flow.GroupIntoEpic(t.Context(), id, []string{"held-a", "held-b"}); err != nil {
					t.Fatalf("group into an epic: %v", err)
				}
			},
		},
		{
			name:    "the agent rewrites the artifact without the epic of an approved card",
			approve: []string{"epic", "in-one", "in-two"},
			edit: func(t *testing.T, f *fixture, id string) {
				t.Helper()
				rewritten := strings.Replace(heldArtifact, "- Epic: epic\n\n### Title\nIn two", "\n### Title\nIn two", 1)
				f.write(id, discussion.DraftsFile, rewritten)
				f.flow.Check(id)
				f.waitFor(id, func(s discussionflow.State) bool {
					return f.draftIn(s, "in-two").Epic == ""
				})
			},
		},
	}

	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			id := f.start(cardKey)
			f.record(id, heldArtifact)
			f.approveQuietly(id, tt.approve...)

			before := discussionflow.ChainOf(f.discussions.Drafts(id), false).Due
			if len(before) != 0 {
				t.Fatalf("the scenario starts with %v in the run, want none", before)
			}

			tt.edit(t, f, id)

			after := discussionflow.ChainOf(f.discussions.Drafts(id), false).Due
			for _, draftID := range after {
				if !slices.Contains(before, draftID) {
					t.Errorf("the edit put %s in the run: %v", draftID, after)
				}
			}
			f.flow.Check(id)
			f.waitFor(id, func(s discussionflow.State) bool { return !s.Publishing })
			if got := countPrefix(f.gh.made(), "createIssue:"); got != 0 {
				t.Errorf("the edit wrote on GitHub: %v", f.gh.made())
			}
		})
	}
}

// countPrefix is how many calls start with a prefix.
func countPrefix(calls []string, prefix string) int {
	total := 0
	for _, call := range calls {
		if strings.HasPrefix(call, prefix) {
			total++
		}
	}
	return total
}
