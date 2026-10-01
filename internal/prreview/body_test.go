package prreview_test

import (
	"testing"

	"github.com/guilhermt/myspec/internal/prreport"
	"github.com/guilhermt/myspec/internal/prreview"
)

func TestTheBodyOfAReviewWithoutFindingsIsTheSummary(t *testing.T) {
	t.Parallel()

	got := prreview.PublishedBody("  The branch is ready.\n", nil, nil)
	if want := "The branch is ready."; got != want {
		t.Errorf("body = %q, want %q", got, want)
	}
}

func TestTheGeneralFindingsComeBeforeTheDemotedOnesInOneNumberedList(t *testing.T) {
	t.Parallel()

	general := []prreview.Finding{{Finding: prreport.Finding{Number: 3, Text: "The commits mix two changes."}}}
	demoted := []prreview.Finding{{Finding: prreport.Finding{Number: 1, Path: "internal/task/service.go", Line: 12, Text: "No test covers it."}}}

	got := prreview.PublishedBody("Two things stand out.", general, demoted)
	want := "Two things stand out.\n\n**Other findings**\n\n" +
		"1. The commits mix two changes.\n" +
		"2. `internal/task/service.go:12` — No test covers it."
	if got != want {
		t.Errorf("body = %q, want %q", got, want)
	}
}

func TestAFindingOfSeveralLinesStaysInsideItsItem(t *testing.T) {
	t.Parallel()

	general := []prreview.Finding{{Finding: prreport.Finding{Number: 1, Text: "It fails on empty input.\n\nThe second line explains why."}}}

	got := prreview.PublishedBody("", general, nil)
	want := "**Other findings**\n\n" +
		"1. It fails on empty input.\n\n   The second line explains why."
	if got != want {
		t.Errorf("body = %q, want %q", got, want)
	}
}

func TestABodyWithoutASummaryStartsAtTheFindings(t *testing.T) {
	t.Parallel()

	got := prreview.PublishedBody("   ", []prreview.Finding{{Finding: prreport.Finding{Number: 1, Text: "One thing."}}}, nil)
	if want := "**Other findings**\n\n1. One thing."; got != want {
		t.Errorf("body = %q, want %q", got, want)
	}
}

func TestAReviewWithNothingToSayHasAnEmptyBody(t *testing.T) {
	t.Parallel()

	if got := prreview.PublishedBody("", nil, nil); got != "" {
		t.Errorf("body = %q, want the empty string", got)
	}
}
