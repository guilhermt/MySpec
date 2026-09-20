package discussion

import (
	"fmt"
	"slices"
	"strings"
	"unicode"

	"golang.org/x/text/unicode/norm"
)

// Catalog is what an artifact is checked against: the board as the app holds
// it.
type Catalog struct {
	Repositories  []string             // owner/name managed by the board
	Cards         map[string]InputCard // by task.IssueKey: the cards of the stored reading
	HasModule     bool
	ModuleOptions []string // the names of the options of the module field
}

// Validate checks every draft against the board: the repository it writes to,
// the card it rewrites, the module it takes and what it points at. It fails
// with ErrUnreadable, because a draft the board does not answer for is one the
// app cannot act on. The canonical name of a module option replaces the one
// the draft wrote.
func Validate(a Artifact, c Catalog) error {
	for i := range a.Drafts {
		draft := &a.Drafts[i]
		if err := validateRepository(draft, c); err != nil {
			return err
		}
		if err := validateModule(draft, c); err != nil {
			return err
		}
		if err := validateLinks(draft, a); err != nil {
			return err
		}
	}
	return nil
}

// validateRepository checks that the draft writes to a repository of the
// board: the one it names, or the one of the card it rewrites.
func validateRepository(draft *ParsedDraft, c Catalog) error {
	if draft.Kind != KindUpdate {
		if !hasRepository(c.Repositories, draft.Repository) {
			return fmt.Errorf("%w: draft %s: the board doesn't manage %s", ErrUnreadable, draft.ID, draft.Repository)
		}
		return nil
	}

	card, ok := c.Cards[draft.Card.Key()]
	if !ok {
		return fmt.Errorf("%w: draft %s: %s is no card of the board", ErrUnreadable, draft.ID, draft.Card)
	}
	if !hasRepository(c.Repositories, card.Owner+"/"+card.Name) {
		return fmt.Errorf("%w: draft %s: the board doesn't manage %s/%s", ErrUnreadable, draft.ID, card.Owner, card.Name)
	}
	return nil
}

// hasRepository reports whether the board manages a repository, as GitHub
// compares the two.
func hasRepository(repositories []string, fullName string) bool {
	return slices.ContainsFunc(repositories, func(r string) bool { return strings.EqualFold(r, fullName) })
}

// validateModule checks the module of a draft against the field of the board,
// and rewrites it with the name the option has there.
func validateModule(draft *ParsedDraft, c Catalog) error {
	if draft.Module == "" {
		return nil
	}
	if !c.HasModule {
		return fmt.Errorf("%w: draft %s: the board has no module field", ErrUnreadable, draft.ID)
	}

	folded := fold(draft.Module)
	for _, option := range c.ModuleOptions {
		if strings.EqualFold(fold(strings.TrimSpace(option)), folded) {
			draft.Module = option
			return nil
		}
	}
	return fmt.Errorf("%w: draft %s: %s is no option of the module field", ErrUnreadable, draft.ID, draft.Module)
}

// validateLinks checks what a draft points at inside the artifact: an epic is
// an epic draft, a dependency is a card draft, and no dependency is named
// twice.
func validateLinks(draft *ParsedDraft, a Artifact) error {
	if draft.Epic != nil && draft.Epic.IsDraft() {
		epic, ok := findDraft(a, draft.Epic.Draft)
		if !ok || epic.Kind != KindEpic {
			return fmt.Errorf("%w: draft %s: %s is no epic of the discussion", ErrUnreadable, draft.ID, draft.Epic)
		}
	}

	seen := map[string]bool{}
	for _, dependency := range draft.Dependencies {
		if seen[dependency.Key()] {
			return fmt.Errorf("%w: draft %s: it depends on %s twice", ErrUnreadable, draft.ID, dependency)
		}
		seen[dependency.Key()] = true

		if !dependency.IsDraft() {
			continue
		}
		on, ok := findDraft(a, dependency.Draft)
		if !ok || on.Kind == KindEpic {
			return fmt.Errorf("%w: draft %s: %s is no card of the discussion", ErrUnreadable, draft.ID, dependency)
		}
	}
	return nil
}

// findDraft is a draft of the artifact by id.
func findDraft(a Artifact, id string) (ParsedDraft, bool) {
	index := slices.IndexFunc(a.Drafts, func(d ParsedDraft) bool { return d.ID == id })
	if index < 0 {
		return ParsedDraft{}, false
	}
	return a.Drafts[index], true
}

// fold is s in lower case without accents, so that a module written with an
// accent finds the option that has it.
func fold(s string) string {
	var b strings.Builder
	for _, r := range norm.NFD.String(strings.ToLower(strings.TrimSpace(s))) {
		if !unicode.Is(unicode.Mn, r) {
			b.WriteRune(r)
		}
	}
	return b.String()
}
