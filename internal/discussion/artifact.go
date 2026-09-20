package discussion

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/guilhermt/myspec/internal/frontmatter"
)

// The values the status of the drafts artifact is written with.
const (
	statusDrafts = "drafts" // the file has at least one draft
	statusNone   = "none"   // the discussion ended without a card
)

// The headings that close the metadata of a draft and open its two texts.
const (
	titleHeading = "### Title"
	bodyHeading  = "### Body"
)

// draftOpening opens a draft block, with whatever the agent wrote as its id.
var draftOpening = regexp.MustCompile(`^##\s+Draft:\s*(.*)$`)

// metadataLine is one field of a draft, between its heading and its title.
var metadataLine = regexp.MustCompile(`(?i)^-\s*(Kind|Card|Repository|Module|Epic|Depends on)\s*:\s*(.*)$`)

// repositoryName is a repository as a draft names it: owner/name.
var repositoryName = regexp.MustCompile(`^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$`)

// userIDPrefix is reserved for the epics the user groups cards into, so the
// agent never writes an id that collides with one.
const userIDPrefix = "user-"

// titleMaxLen is the longest title a draft takes.
const titleMaxLen = 256

// dependencySeparator separates the references of a Depends on line.
const dependencySeparator = ","

// ErrUnreadable is a drafts artifact the app cannot act on: the agent wrote it
// in a shape the product does not define.
var ErrUnreadable = errors.New("discussion: the drafts can't be read")

// ParsedDraft is one draft as the artifact has it, before the user edits or
// decides anything about it.
type ParsedDraft struct {
	ID           string
	Kind         Kind
	Card         *Ref // update: the issue it rewrites; nil otherwise
	Repository   string
	Module       string
	Epic         *Ref // nil without one
	Dependencies []Ref
	Title        string
	Body         string
}

// Artifact is the drafts of a discussion as the app reads them. A discussion
// that ended without a card has none.
type Artifact struct {
	Drafts []ParsedDraft
}

// ReadArtifact reads drafts.md. ok is false when the file is not there; a file
// that is there and cannot be read fails with ErrUnreadable.
func ReadArtifact(path string) (artifact Artifact, ok bool, err error) {
	content, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return Artifact{}, false, nil
		}
		return Artifact{}, false, fmt.Errorf("read drafts %s: %w", path, err)
	}

	artifact, err = ParseArtifact(string(content))
	if err != nil {
		return Artifact{}, false, fmt.Errorf("read drafts %s: %w", path, err)
	}
	return artifact, true, nil
}

// ParseArtifact reads the artifact from its text.
func ParseArtifact(content string) (Artifact, error) {
	fields, body := frontmatter.Split(content)
	if fields == nil {
		return Artifact{}, fmt.Errorf("%w: it has no front matter", ErrUnreadable)
	}
	status := strings.TrimSpace(fields["status"])
	if status != statusDrafts && status != statusNone {
		return Artifact{}, fmt.Errorf("%w: status %q is neither %s nor %s",
			ErrUnreadable, fields["status"], statusDrafts, statusNone)
	}

	blocks, err := splitBlocks(body)
	if err != nil {
		return Artifact{}, err
	}
	if status == statusNone && len(blocks) > 0 {
		return Artifact{}, fmt.Errorf("%w: it says there is no draft and has %d", ErrUnreadable, len(blocks))
	}
	if status == statusDrafts && len(blocks) == 0 {
		return Artifact{}, fmt.Errorf("%w: it says there are drafts and has none", ErrUnreadable)
	}

	drafts := make([]ParsedDraft, 0, len(blocks))
	for _, b := range blocks {
		draft, blockErr := parseBlock(b.id, b.lines)
		if blockErr != nil {
			return Artifact{}, blockErr
		}
		drafts = append(drafts, draft)
	}
	if len(drafts) == 0 {
		return Artifact{}, nil
	}
	return Artifact{Drafts: drafts}, nil
}

// block is one draft of the artifact, cut out of the body.
type block struct {
	id    string
	lines []string
}

// splitBlocks cuts the body at every draft heading. What comes before the
// first one is a note to the reader.
func splitBlocks(body string) ([]block, error) {
	var (
		blocks []block
		open   = false
	)
	for _, line := range strings.Split(strings.ReplaceAll(body, "\r", ""), "\n") {
		match := draftOpening.FindStringSubmatch(strings.TrimRight(line, " \t"))
		if match == nil {
			if open {
				blocks[len(blocks)-1].lines = append(blocks[len(blocks)-1].lines, line)
			}
			continue
		}

		id := strings.TrimSpace(match[1])
		if !refDraftID.MatchString(id) {
			return nil, fmt.Errorf("%w: %q is no draft id: lowercase letters, digits and hyphens", ErrUnreadable, id)
		}
		if strings.HasPrefix(id, userIDPrefix) {
			return nil, fmt.Errorf("%w: draft %s: the prefix %s is reserved", ErrUnreadable, id, userIDPrefix)
		}
		if hasID(blocks, id) {
			return nil, fmt.Errorf("%w: draft %s appears twice", ErrUnreadable, id)
		}
		blocks = append(blocks, block{id: id})
		open = true
	}
	return blocks, nil
}

// hasID reports whether a block of that id was read already.
func hasID(blocks []block, id string) bool {
	for _, b := range blocks {
		if b.id == id {
			return true
		}
	}
	return false
}

// parseBlock reads one draft: its metadata, its title and its body.
func parseBlock(id string, lines []string) (ParsedDraft, error) {
	fields, rest, err := parseMetadata(id, lines)
	if err != nil {
		return ParsedDraft{}, err
	}
	title, body, err := parseTexts(id, rest)
	if err != nil {
		return ParsedDraft{}, err
	}

	draft := ParsedDraft{ID: id, Title: title, Body: body}
	if err = readKind(&draft, fields); err != nil {
		return ParsedDraft{}, err
	}
	if err = readRefs(&draft, fields); err != nil {
		return ParsedDraft{}, err
	}
	draft.Module = strings.TrimSpace(fields["module"])
	return draft, nil
}

// parseMetadata reads the fields of a draft, up to the heading of its title.
func parseMetadata(id string, lines []string) (fields map[string]string, rest []string, err error) {
	fields = map[string]string{}
	for i, line := range lines {
		if strings.TrimRight(line, " \t") == titleHeading {
			return fields, lines[i+1:], nil
		}
		if strings.TrimSpace(line) == "" {
			continue
		}

		match := metadataLine.FindStringSubmatch(strings.TrimSpace(line))
		if match == nil {
			return nil, nil, fmt.Errorf("%w: draft %s: %q is neither a field nor %s", ErrUnreadable, id, line, titleHeading)
		}
		label := strings.ToLower(match[1])
		if _, seen := fields[label]; seen {
			return nil, nil, fmt.Errorf("%w: draft %s: it has two %s fields", ErrUnreadable, id, label)
		}
		fields[label] = match[2]
	}
	return nil, nil, fmt.Errorf("%w: draft %s: it has no %s", ErrUnreadable, id, titleHeading)
}

// parseTexts reads the title and the body of a draft, which the heading of the
// title opens.
func parseTexts(id string, lines []string) (title, body string, err error) {
	at := -1
	for i, line := range lines {
		if strings.TrimRight(line, " \t") == bodyHeading {
			at = i
			break
		}
	}
	if at < 0 {
		return "", "", fmt.Errorf("%w: draft %s: it has no %s", ErrUnreadable, id, bodyHeading)
	}

	for _, line := range lines[:at] {
		if title = strings.TrimSpace(line); title != "" {
			break
		}
	}
	if title == "" {
		return "", "", fmt.Errorf("%w: draft %s: it has no title", ErrUnreadable, id)
	}
	if utf8.RuneCountInString(title) > titleMaxLen {
		return "", "", fmt.Errorf("%w: draft %s: the title is longer than %d characters", ErrUnreadable, id, titleMaxLen)
	}

	body = strings.TrimSpace(strings.Join(lines[at+1:], "\n"))
	if body == "" {
		return "", "", fmt.Errorf("%w: draft %s: it has no body", ErrUnreadable, id)
	}
	return title, body, nil
}

// readKind reads the kind of a draft and refuses the fields that kind has no
// use for.
func readKind(draft *ParsedDraft, fields map[string]string) error {
	kind, err := ParseKind(strings.TrimSpace(fields["kind"]))
	if err != nil {
		return fmt.Errorf("%w: draft %s: %q is no kind", ErrUnreadable, draft.ID, fields["kind"])
	}
	draft.Kind = kind

	_, hasCard := fields["card"]
	_, hasRepository := fields["repository"]
	if kind == KindUpdate && hasRepository {
		return fmt.Errorf("%w: draft %s: an update takes the card, not a repository", ErrUnreadable, draft.ID)
	}
	if kind != KindUpdate && hasCard {
		return fmt.Errorf("%w: draft %s: a %s takes a repository, not a card", ErrUnreadable, draft.ID, kind)
	}
	if kind != KindEpic {
		return nil
	}
	for _, label := range []string{"module", "epic", "depends on"} {
		if value := strings.TrimSpace(fields[label]); value != "" {
			return fmt.Errorf("%w: draft %s: an epic takes no %s", ErrUnreadable, draft.ID, label)
		}
	}
	return nil
}

// readRefs reads what a draft points at: the card it rewrites, the repository
// of the issue, its epic and what it depends on.
func readRefs(draft *ParsedDraft, fields map[string]string) error {
	if draft.Kind == KindUpdate {
		card, ok := ParseRef(fields["card"])
		if !ok || card.IsDraft() {
			return fmt.Errorf("%w: draft %s: card %q is no issue", ErrUnreadable, draft.ID, fields["card"])
		}
		draft.Card = &card
	} else {
		draft.Repository = strings.TrimSpace(fields["repository"])
		if !repositoryName.MatchString(draft.Repository) {
			return fmt.Errorf("%w: draft %s: repository %q is no owner/name", ErrUnreadable, draft.ID, fields["repository"])
		}
	}

	if value := strings.TrimSpace(fields["epic"]); value != "" {
		epic, ok := ParseRef(value)
		if !ok {
			return fmt.Errorf("%w: draft %s: epic %q is no draft id and no issue", ErrUnreadable, draft.ID, value)
		}
		draft.Epic = &epic
	}
	return readDependencies(draft, fields["depends on"])
}

// readDependencies reads the references of a Depends on line.
func readDependencies(draft *ParsedDraft, value string) error {
	for _, part := range strings.Split(value, dependencySeparator) {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		ref, ok := ParseRef(part)
		if !ok {
			return fmt.Errorf("%w: draft %s: dependency %q is no draft id and no issue", ErrUnreadable, draft.ID, part)
		}
		if ref.Draft == draft.ID {
			return fmt.Errorf("%w: draft %s: it depends on itself", ErrUnreadable, draft.ID)
		}
		draft.Dependencies = append(draft.Dependencies, ref)
	}
	return nil
}
