package prreport_test

import (
	"errors"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/prreport"
)

func TestADecisionIsOneOfTheProduct(t *testing.T) {
	t.Parallel()

	cases := []struct {
		value   string
		want    prreport.Decision
		wantErr error
	}{
		{"", prreport.DecisionNone, nil},
		{"approved", prreport.DecisionApproved, nil},
		{"discarded", prreport.DecisionDiscarded, nil},
		{"maybe", "", prreport.ErrUnknownDecision},
	}

	for _, c := range cases {
		t.Run(c.value, func(t *testing.T) {
			t.Parallel()

			got, err := prreport.ParseDecision(c.value)
			if !errors.Is(err, c.wantErr) || got != c.want {
				t.Errorf("ParseDecision(%q) = %q, %v; want %q, %v", c.value, got, err, c.want, c.wantErr)
			}
		})
	}
}

func TestOnlyAFindingWithAFileAndALineIsAnchored(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		finding prreport.Finding
		want    bool
	}{
		{"general", prreport.Finding{}, false},
		{"with a file and no line", prreport.Finding{Path: "main.go"}, false},
		{"with a line and no file", prreport.Finding{Line: 12}, false},
		{"with both", prreport.Finding{Path: "main.go", Line: 12}, true},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()

			if got := c.finding.Anchored(); got != c.want {
				t.Errorf("Anchored() = %v, want %v", got, c.want)
			}
		})
	}
}

func TestFreshFindingsAreTheReportWithNothingDecided(t *testing.T) {
	t.Parallel()

	got := prreport.Fresh([]prreport.ParsedFinding{
		{Number: 1, Title: "No test", Path: "main.go", Line: 12, Text: "No test."},
		{Number: 2, Text: "Mixed commits."},
	})

	want := []prreport.Finding{
		{Number: 1, Title: "No test", Path: "main.go", Line: 12, Original: "No test.", Text: "No test."},
		{Number: 2, Original: "Mixed commits.", Text: "Mixed commits."},
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("fresh (-want +got):\n%s", diff)
	}
}

func TestARewrittenReportInheritsWhatTheUserDidWithTheSameFinding(t *testing.T) {
	t.Parallel()

	stored := func(number int, line int, original, text string, d prreport.Decision) prreport.Finding {
		return prreport.Finding{
			Number: number, Title: "Old", Path: "main.go", Line: line,
			Original: original, Text: text, Decision: d,
		}
	}
	parsed := func(number, line int, text string) prreport.ParsedFinding {
		return prreport.ParsedFinding{Number: number, Title: "New", Path: "main.go", Line: line, Text: text}
	}
	result := func(number, line int, original, text string, d prreport.Decision) prreport.Finding {
		finding := stored(number, line, original, text, d)
		finding.Title = "New"
		return finding
	}

	cases := []struct {
		name   string
		stored []prreport.Finding
		parsed []prreport.ParsedFinding
		want   []prreport.Finding
	}{
		{
			"the same finding keeps text and decision, with the new title",
			[]prreport.Finding{stored(1, 12, "No test.", "No test, edited.", prreport.DecisionApproved)},
			[]prreport.ParsedFinding{parsed(1, 12, "No test.")},
			[]prreport.Finding{result(1, 12, "No test.", "No test, edited.", prreport.DecisionApproved)},
		},
		{
			"a finding that moved to another line is still to decide",
			[]prreport.Finding{stored(1, 12, "No test.", "No test.", prreport.DecisionDiscarded)},
			[]prreport.ParsedFinding{parsed(1, 14, "No test.")},
			[]prreport.Finding{result(1, 14, "No test.", "No test.", prreport.DecisionNone)},
		},
		{
			"two equal findings in the same place inherit in order",
			[]prreport.Finding{
				stored(1, 12, "Same.", "First.", prreport.DecisionApproved),
				stored(2, 12, "Same.", "Second.", prreport.DecisionDiscarded),
			},
			[]prreport.ParsedFinding{parsed(1, 12, "Same."), parsed(2, 12, "Same.")},
			[]prreport.Finding{
				result(1, 12, "Same.", "First.", prreport.DecisionApproved),
				result(2, 12, "Same.", "Second.", prreport.DecisionDiscarded),
			},
		},
		{
			"a new finding is still to decide",
			[]prreport.Finding{stored(1, 12, "No test.", "No test.", prreport.DecisionApproved)},
			[]prreport.ParsedFinding{parsed(1, 12, "No test."), parsed(2, 40, "A name.")},
			[]prreport.Finding{
				result(1, 12, "No test.", "No test.", prreport.DecisionApproved),
				result(2, 40, "A name.", "A name.", prreport.DecisionNone),
			},
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()

			if diff := cmp.Diff(c.want, prreport.Inherit(c.stored, c.parsed)); diff != "" {
				t.Errorf("inherit (-want +got):\n%s", diff)
			}
		})
	}
}

func TestAReportIsTheSameWhenSummaryAndFindingsAreTheSame(t *testing.T) {
	t.Parallel()

	stored := []prreport.Finding{
		{Number: 1, Title: "T", Path: "main.go", Line: 12, Original: "No test.", Text: "edited"},
	}
	report := func(mutate func(*prreport.Report)) prreport.Report {
		r := prreport.Report{
			Summary: "S",
			Findings: []prreport.ParsedFinding{
				{Number: 1, Title: "T", Path: "main.go", Line: 12, Text: "No test."},
			},
		}
		mutate(&r)
		return r
	}

	cases := []struct {
		name   string
		report prreport.Report
		want   bool
	}{
		{"the same", report(func(*prreport.Report) {}), true},
		{"another summary", report(func(r *prreport.Report) { r.Summary = "Other" }), false},
		{"another number", report(func(r *prreport.Report) { r.Findings[0].Number = 2 }), false},
		{"another title", report(func(r *prreport.Report) { r.Findings[0].Title = "Other" }), false},
		{"another path", report(func(r *prreport.Report) { r.Findings[0].Path = "other.go" }), false},
		{"another line", report(func(r *prreport.Report) { r.Findings[0].Line = 13 }), false},
		{"another text", report(func(r *prreport.Report) { r.Findings[0].Text = "Other." }), false},
		{"another count", report(func(r *prreport.Report) { r.Findings = nil }), false},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()

			if got := prreport.Same("S", stored, c.report); got != c.want {
				t.Errorf("Same() = %v, want %v", got, c.want)
			}
		})
	}
}

func TestCountsSayHowManyFindingsWereApprovedAndDiscarded(t *testing.T) {
	t.Parallel()

	approved, discarded := prreport.Counts([]prreport.Finding{
		{Decision: prreport.DecisionApproved},
		{Decision: prreport.DecisionDiscarded},
		{Decision: prreport.DecisionNone},
		{Decision: prreport.DecisionApproved},
	})
	if approved != 2 || discarded != 1 {
		t.Errorf("Counts() = %d, %d; want 2, 1", approved, discarded)
	}
}
