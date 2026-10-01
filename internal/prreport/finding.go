package prreport

import (
	"errors"
	"fmt"
	"slices"
)

// Decision is what the user decided about a finding.
type Decision string

// The decisions of a finding; DecisionNone is a finding still to decide.
const (
	DecisionNone      Decision = ""
	DecisionApproved  Decision = "approved"
	DecisionDiscarded Decision = "discarded"
)

// The ways a finding refuses a change.
var (
	ErrUnknownDecision = errors.New("prreport: unknown decision")
	ErrEmptyText       = errors.New("prreport: the text of a finding is required")
)

// decisions lists the decisions a finding is stored with, the undecided one
// included.
var decisions = []Decision{DecisionNone, DecisionApproved, DecisionDiscarded}

// ParseDecision narrows a stored or received string to a decision. The empty
// string is a finding still to decide.
func ParseDecision(value string) (Decision, error) {
	if !slices.Contains(decisions, Decision(value)) {
		return "", fmt.Errorf("parse decision %q: %w", value, ErrUnknownDecision)
	}
	return Decision(value), nil
}

// Finding is one numbered finding of a pass, with what the user did with it.
type Finding struct {
	Number   int
	Title    string // as the report has it; "" when it has none
	Path     string // the file it is anchored to; "" for a general finding
	Line     int    // the line of the new side of the diff; 0 for a general finding
	Original string // as the report has it
	Text     string // as the user left it
	Decision Decision
}

// Anchored reports whether the finding points at a line of the pull request.
func (f Finding) Anchored() bool { return f.Path != "" && f.Line > 0 }

// place is where a finding points, which is what tells two findings apart when
// a report is rewritten.
type place struct {
	path     string
	line     int
	original string
}

// Fresh are the findings of a report nobody decided anything about yet.
func Fresh(parsed []ParsedFinding) []Finding {
	findings := make([]Finding, 0, len(parsed))
	for _, finding := range parsed {
		findings = append(findings, Finding{
			Number:   finding.Number,
			Title:    finding.Title,
			Path:     finding.Path,
			Line:     finding.Line,
			Original: finding.Text,
			Text:     finding.Text,
		})
	}
	return findings
}

// Inherit are the findings of a rewritten report, each carrying the text and
// the decision of the stored finding that said the same thing in the same
// place: the same path, line and original text. The title is the new one.
func Inherit(stored []Finding, parsed []ParsedFinding) []Finding {
	previous := map[place][]Finding{}
	for _, finding := range stored {
		key := place{finding.Path, finding.Line, finding.Original}
		previous[key] = append(previous[key], finding)
	}

	findings := Fresh(parsed)
	for i, finding := range findings {
		key := place{finding.Path, finding.Line, finding.Original}
		matches := previous[key]
		if len(matches) == 0 {
			continue
		}
		findings[i].Text, findings[i].Decision = matches[0].Text, matches[0].Decision
		previous[key] = matches[1:]
	}
	return findings
}

// Same reports whether a report says what was recorded: the same summary, and
// the same findings by number, title, path, line and original text.
func Same(summary string, stored []Finding, report Report) bool {
	if summary != report.Summary || len(stored) != len(report.Findings) {
		return false
	}
	for i, finding := range stored {
		parsed := report.Findings[i]
		if finding.Number != parsed.Number || finding.Title != parsed.Title ||
			finding.Path != parsed.Path || finding.Line != parsed.Line ||
			finding.Original != parsed.Text {
			return false
		}
	}
	return true
}

// Counts is how many findings the user approved and how many they discarded.
func Counts(findings []Finding) (approved, discarded int) {
	for _, finding := range findings {
		switch finding.Decision {
		case DecisionApproved:
			approved++
		case DecisionDiscarded:
			discarded++
		case DecisionNone:
		}
	}
	return approved, discarded
}
