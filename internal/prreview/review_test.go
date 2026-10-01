package prreview_test

import (
	"errors"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/prreport"
	"github.com/guilhermt/myspec/internal/prreview"
)

func TestTheArtifactsOfAReviewLiveUnderTheRepositoryAndThePullRequest(t *testing.T) {
	t.Parallel()

	dir := prreview.ArtifactsDir("/data", "dev", "web", 42, "0123456789abcdef")
	want := filepath.Join("/data", "reviews", "dev", "web", "pr-42-01234567")
	if dir != want {
		t.Errorf("artifacts dir = %q, want %q", dir, want)
	}

	review := prreview.Review{Number: 42, ArtifactsDir: dir}
	if got := review.ReportPath(2); got != filepath.Join(want, "review-2.md") {
		t.Errorf("report path = %q", got)
	}
	if got := review.ContextPath(); got != filepath.Join(want, "context.md") {
		t.Errorf("context path = %q", got)
	}
	if got := review.Reference("dev/web"); got != "dev/web#42" {
		t.Errorf("reference = %q, want dev/web#42", got)
	}
}

func TestAReviewIsArchivedOnceItHasTheInstantItLeftTheList(t *testing.T) {
	t.Parallel()

	if (prreview.Review{}).Archived() {
		t.Error("a review with no instant is archived")
	}
	if !(prreview.Review{ArchivedAt: base}).Archived() {
		t.Error("a review with an instant is not archived")
	}
}

func TestAPassIsDecidedOnceEveryFindingHasADecision(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		pass prreview.Pass
		want bool
	}{
		{"with no finding", prreview.Pass{}, true},
		{
			"with one still to decide",
			prreview.Pass{Findings: []prreview.Finding{
				{Finding: prreport.Finding{Number: 1, Decision: prreview.DecisionApproved}},
				{Finding: prreport.Finding{Number: 2}},
			}},
			false,
		},
		{
			"with every one decided",
			prreview.Pass{Findings: []prreview.Finding{
				{Finding: prreport.Finding{Number: 1, Decision: prreview.DecisionApproved}},
				{Finding: prreport.Finding{Number: 2, Decision: prreview.DecisionDiscarded}},
			}},
			true,
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()

			if got := c.pass.Decided(); got != c.want {
				t.Errorf("decided = %v, want %v", got, c.want)
			}
		})
	}
}

func TestTheApprovedFindingsAreTheOnesTheUserKept(t *testing.T) {
	t.Parallel()

	pass := prreview.Pass{Findings: []prreview.Finding{
		{Finding: prreport.Finding{Number: 1, Decision: prreview.DecisionApproved}},
		{Finding: prreport.Finding{Number: 2, Decision: prreview.DecisionDiscarded}},
		{Finding: prreport.Finding{Number: 3, Decision: prreview.DecisionApproved}},
	}}

	want := []prreview.Finding{
		{Finding: prreport.Finding{Number: 1, Decision: prreview.DecisionApproved}},
		{Finding: prreport.Finding{Number: 3, Decision: prreview.DecisionApproved}},
	}
	if diff := cmp.Diff(want, pass.Approved()); diff != "" {
		t.Errorf("approved (-want +got):\n%s", diff)
	}
}

func TestAPassIsPublishedOnceItHasTheInstantItWasSent(t *testing.T) {
	t.Parallel()

	if (prreview.Pass{}).Published() {
		t.Error("a pass with no instant is published")
	}
	if !(prreview.Pass{PublishedAt: time.Now()}).Published() {
		t.Error("a pass with an instant is not published")
	}
}

func TestOnlyAFindingWithAFileAndALineIsAnchored(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		finding prreview.Finding
		want    bool
	}{
		{"general", prreview.Finding{}, false},
		{"with a file and no line", prreview.Finding{Finding: prreport.Finding{Path: "main.go"}}, false},
		{"with a line and no file", prreview.Finding{Finding: prreport.Finding{Line: 12}}, false},
		{"with both", prreview.Finding{Finding: prreport.Finding{Path: "main.go", Line: 12}}, true},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()

			if got := c.finding.Anchored(); got != c.want {
				t.Errorf("anchored = %v, want %v", got, c.want)
			}
		})
	}
}

func TestAStoredValueThatIsNotOneOfTheProductIsRefused(t *testing.T) {
	t.Parallel()

	if _, err := prreview.ParseMode("publish"); err != nil {
		t.Errorf("parse mode publish: %v", err)
	}
	if _, err := prreview.ParseMode(""); !errors.Is(err, prreview.ErrUnknownMode) {
		t.Errorf("error = %v, want ErrUnknownMode", err)
	}
	if _, err := prreview.ParseVerdict("approve"); err != nil {
		t.Errorf("parse verdict approve: %v", err)
	}
	if _, err := prreview.ParseVerdict("merge"); !errors.Is(err, prreview.ErrUnknownVerdict) {
		t.Errorf("error = %v, want ErrUnknownVerdict", err)
	}
	if got, err := prreview.ParseDecision(""); err != nil || got != prreview.DecisionNone {
		t.Errorf("parse decision of an undecided finding = %q, %v", got, err)
	}
	if _, err := prreview.ParseDecision("maybe"); !errors.Is(err, prreport.ErrUnknownDecision) {
		t.Errorf("error = %v, want ErrUnknownDecision", err)
	}
}
