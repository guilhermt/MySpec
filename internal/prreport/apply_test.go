package prreport_test

import (
	"strings"
	"testing"

	"github.com/guilhermt/myspec/internal/prreport"
)

const applyIntro = "The user decided on the findings of pass 2. Implement only the ones below, and only that: " +
	"no drive-by changes, no refactoring nobody asked for. Do not commit, do not run `git add` and do not " +
	"push: the user reviews the changes in the app. When you are done, say in a few lines what you changed."

const discardedIntro = "## Discarded findings\n\nThe user decided not to act on these. Do not report them " +
	"again in a later pass unless the code they point at changes."

func TestApplyMessageSendsTheApprovedFindingsAndTheDiscardedOnes(t *testing.T) {
	t.Parallel()

	approved := prreport.DecisionApproved
	discarded := prreport.DecisionDiscarded

	cases := []struct {
		name     string
		findings []prreport.Finding
		want     string
	}{
		{
			"approved ones with and without a title, anchored and general",
			[]prreport.Finding{
				{Number: 1, Title: "No test", Path: "main.go", Line: 12, Text: "No test.", Decision: approved},
				{Number: 2, Text: "Mixed commits.", Decision: approved},
			},
			applyIntro + "\n\n## Approved findings\n\n" +
				"### 1 · No test\nLocation: main.go:12\n\nNo test.\n\n" +
				"### 2\nLocation: general\n\nMixed commits.",
		},
		{
			"discarded ones with and without a title",
			[]prreport.Finding{
				{Number: 1, Text: "Fix it.", Decision: approved},
				{Number: 3, Title: "Vague", Text: "x", Decision: discarded},
				{Number: 4, Path: "docs/rate-limits.md", Line: 12, Text: "y", Decision: discarded},
			},
			applyIntro + "\n\n## Approved findings\n\n### 1\nLocation: general\n\nFix it.\n\n" +
				discardedIntro + "\n\n- 3 · Vague · general\n- 4 · docs/rate-limits.md:12",
		},
		{
			"without discarded ones the section leaves",
			[]prreport.Finding{{Number: 1, Text: "Fix it.", Decision: approved}},
			applyIntro + "\n\n## Approved findings\n\n### 1\nLocation: general\n\nFix it.",
		},
		{
			"the ones to decide are absent and the text is trimmed",
			[]prreport.Finding{
				{Number: 1, Text: "  Fix it.\n\n", Decision: approved},
				{Number: 2, Text: "Undecided."},
			},
			applyIntro + "\n\n## Approved findings\n\n### 1\nLocation: general\n\nFix it.",
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()

			got := prreport.ApplyMessage(2, c.findings)
			if got != c.want {
				t.Errorf("ApplyMessage() =\n%s\n\nwant:\n%s", got, c.want)
			}
			if strings.HasSuffix(got, "\n") {
				t.Errorf("the message ends with a newline")
			}
		})
	}
}
