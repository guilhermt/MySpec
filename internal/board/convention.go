package board

import (
	"regexp"
	"strings"

	"github.com/guilhermt/myspec/internal/task"
)

// Ref is a reference to an issue as a card body writes it, resolved against
// the board owner and the repository of the card.
type Ref struct {
	Owner  string
	Name   string
	Number int
}

// Key identifies the issue of the reference, as Issue.Key does.
func (r Ref) Key() string { return task.IssueKey(r.Owner, r.Name, r.Number) }

// Convention is what the body of a card says about its epic and its dependencies.
type Convention struct {
	Epic         *Ref  // the first reference of the first epic line that has one
	Dependencies []Ref // every reference of every dependency line, without repetition, in order
}

// conventionLine finds an epic or a dependency line: an optional list marker
// and bold, the label, an optional colon, then the references.
var conventionLine = regexp.MustCompile(`(?i)^(?:[-*+]\s+)?(?:\*\*|__)?\s*(épico|epico|epic|depende de|depends on)\s*(?:\*\*|__)?\s*:?\s*(?:\*\*|__)?\s*(.*)$`)

// The forms a reference takes, tried in order.
var (
	refURL       = regexp.MustCompile(`^https?://github\.com/([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)/issues/(\d+)$`)
	refFullName  = regexp.MustCompile(`^([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)#(\d+)$`)
	refName      = regexp.MustCompile(`^([A-Za-z0-9_.-]+)#(\d+)$`)
	refNumber    = regexp.MustCompile(`^#(\d+)$`)
	refSeparator = regexp.MustCompile(`[,;]`)
)

// refTrim is what surrounds a reference in prose and is not part of it.
const refTrim = ".;:)*_` \t"

// ReadConvention reads the epic and dependency lines of body.
func ReadConvention(body, boardOwner, cardOwner, cardName string) Convention {
	c := Convention{}
	seen := map[string]bool{}
	for line := range strings.SplitSeq(body, "\n") {
		m := conventionLine.FindStringSubmatch(strings.TrimSpace(line))
		if m == nil {
			continue
		}
		refs := readRefs(m[2], boardOwner, cardOwner, cardName)
		switch strings.ToLower(m[1]) {
		case "épico", "epico", "epic":
			if c.Epic == nil && len(refs) > 0 {
				c.Epic = &refs[0]
			}
		default:
			for _, r := range refs {
				if !seen[r.Key()] {
					seen[r.Key()] = true
					c.Dependencies = append(c.Dependencies, r)
				}
			}
		}
	}
	return c
}

// readRefs reads the references of the rest of a line, skipping the parts
// that are not one.
func readRefs(rest, boardOwner, cardOwner, cardName string) []Ref {
	var refs []Ref
	for _, part := range refSeparator.Split(rest, -1) {
		if r, ok := readRef(strings.Trim(part, refTrim), boardOwner, cardOwner, cardName); ok {
			refs = append(refs, r)
		}
	}
	return refs
}

// readRef reads one reference in any of its forms.
func readRef(part, boardOwner, cardOwner, cardName string) (Ref, bool) {
	if m := refURL.FindStringSubmatch(part); m != nil {
		return ref(m[1], m[2], m[3])
	}
	if m := refFullName.FindStringSubmatch(part); m != nil {
		return ref(m[1], m[2], m[3])
	}
	if m := refName.FindStringSubmatch(part); m != nil {
		return ref(boardOwner, m[1], m[2])
	}
	if m := refNumber.FindStringSubmatch(part); m != nil {
		return ref(cardOwner, cardName, m[1])
	}
	return Ref{}, false
}

// ref builds a reference, refusing a number that is not a positive int.
func ref(owner, name, number string) (Ref, bool) {
	n, ok := positive(number)
	return Ref{Owner: owner, Name: name, Number: n}, ok
}
