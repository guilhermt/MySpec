package selfcontext_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"slices"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/divergence"
	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/selfcontext"
)

// uiLabels is frontend/src/test/ui-labels.json, which the TypeScript test of
// the same file keeps equal to the labels of the interface.
type uiLabels struct {
	Stages       map[string]string `json:"stages"`
	Modes        map[string]string `json:"modes"`
	ReviewModes  map[string]string `json:"reviewModes"`
	StepStatuses map[string]string `json:"stepStatuses"`
	PRStatuses   map[string]string `json:"prStatuses"`
	Troubles     []struct {
		Trouble gh.Trouble `json:"trouble"`
		Base    string     `json:"base"`
		Label   string     `json:"label"`
	} `json:"troubles"`
	Voices      map[string]string `json:"voices"`
	Divergences []struct {
		Stage    string           `json:"stage"`
		Kind     divergence.Kind  `json:"kind"`
		Facts    divergence.Facts `json:"facts"`
		Expected string           `json:"expected"`
		Found    string           `json:"found"`
		Actions  []string         `json:"actions"`
	} `json:"divergences"`
}

func loadLabels(t *testing.T) uiLabels {
	t.Helper()
	b, err := os.ReadFile(filepath.Join("..", "..", "frontend", "src", "test", "ui-labels.json"))
	if err != nil {
		t.Fatal(err)
	}
	var labels uiLabels
	if err := json.Unmarshal(b, &labels); err != nil {
		t.Fatal(err)
	}
	return labels
}

func TestTheLabelsMatchTheInterface(t *testing.T) {
	t.Parallel()

	labels := loadLabels(t)

	groups := []struct {
		name  string
		cases map[string]string
		label func(string) string
	}{
		{"stages", labels.Stages, selfcontext.StageLabel},
		{"modes", labels.Modes, selfcontext.ModeLabel},
		{"review modes", labels.ReviewModes, selfcontext.ReviewModeLabel},
		{"step statuses", labels.StepStatuses, selfcontext.StepStatusLabel},
		{"pull request statuses", labels.PRStatuses, func(s string) string { return selfcontext.PRStatusLabel(s, gh.Trouble{}, "") }},
		{"voices", labels.Voices, selfcontext.VoiceOf},
	}
	for _, g := range groups {
		t.Run(g.name, func(t *testing.T) {
			t.Parallel()
			for key, want := range g.cases {
				t.Run(key, func(t *testing.T) {
					t.Parallel()
					if got := g.label(key); got != want {
						t.Errorf("label of %s = %q, want %q", key, got, want)
					}
				})
			}
		})
	}

	t.Run("troubles", func(t *testing.T) {
		t.Parallel()
		for _, c := range labels.Troubles {
			t.Run(c.Label, func(t *testing.T) {
				t.Parallel()
				if got := selfcontext.TroubleText(c.Trouble, c.Base); got != c.Label {
					t.Errorf("trouble text = %q, want %q", got, c.Label)
				}
			})
		}
	})

	t.Run("divergences", func(t *testing.T) {
		t.Parallel()
		for i, c := range labels.Divergences {
			t.Run(string(c.Kind)+"/"+c.Stage+"/"+string(rune('a'+i)), func(t *testing.T) {
				t.Parallel()
				d := divergence.Divergence{Stage: c.Stage, Kind: c.Kind, Facts: c.Facts}
				expected, found := selfcontext.DivergenceText(d)
				if expected != c.Expected || found != c.Found {
					t.Errorf("text = (%q, %q), want (%q, %q)", expected, found, c.Expected, c.Found)
				}
				actions, does := selfcontext.DivergenceActions(d)
				if diff := cmp.Diff(c.Actions, actions); diff != "" {
					t.Errorf("actions (-want +got):\n%s", diff)
				}
				if slices.Contains(does, "") {
					t.Errorf("an action says nothing of what it does: %q", does)
				}
			})
		}
	})
}

func TestTheStatusesOfTheFixtureAreTheOnesOfTheTables(t *testing.T) {
	t.Parallel()

	labels := loadLabels(t)

	keys := func(m map[string]string) []string {
		out := make([]string, 0, len(m))
		for k := range m {
			out = append(out, k)
		}
		slices.Sort(out)
		return out
	}
	t.Run("step statuses", func(t *testing.T) {
		t.Parallel()
		if diff := cmp.Diff(selfcontext.StepStatuses(), keys(labels.StepStatuses)); diff != "" {
			t.Errorf("statuses (-go +fixture):\n%s", diff)
		}
	})
	t.Run("pull request statuses", func(t *testing.T) {
		t.Parallel()
		if diff := cmp.Diff(selfcontext.PRStatuses(), keys(labels.PRStatuses)); diff != "" {
			t.Errorf("statuses (-go +fixture):\n%s", diff)
		}
	})
}

func TestAStatusWithoutALabelReadsAsItself(t *testing.T) {
	t.Parallel()

	if got := selfcontext.StepStatusLabel("brand_new"); got != "brand_new" {
		t.Errorf("label = %q, want the status itself", got)
	}
	if got := selfcontext.PRStatusLabel("brand_new", gh.Trouble{}, ""); got != "brand_new" {
		t.Errorf("label = %q, want the status itself", got)
	}
}

func TestAPullRequestInTroubleReadsAsWhatWentWrong(t *testing.T) {
	t.Parallel()

	trouble := gh.Trouble{FailedChecks: []string{"lint"}, Conflict: true}

	if got, want := selfcontext.PRStatusLabel("trouble", trouble, "origin/dev"), "Checks failed: lint · conflict with dev"; got != want {
		t.Errorf("label = %q, want %q", got, want)
	}
}

func TestTheStatusesOfAReviewAndOfADiscussionHaveTheirWords(t *testing.T) {
	t.Parallel()

	tests := []struct{ got, want string }{
		{selfcontext.ReviewStatusLabel("awaiting_decision"), "Decide findings"},
		{selfcontext.ReviewStatusLabel("in_review"), "Review changes"},
		{selfcontext.ReviewStatusLabel("pass_blocked"), "Pass blocked"},
		{selfcontext.ReviewStatusLabel("diverged"), "Not as expected"},
		{selfcontext.ReviewStatusLabel("brand_new"), "brand_new"},
		{selfcontext.DiscussionStatusLabel("deciding"), "Decide drafts"},
		{selfcontext.DiscussionStatusLabel("epic_cant_publish"), "Epic can't publish"},
		{selfcontext.DiscussionStatusLabel(""), "Discussing"},
	}
	for _, tt := range tests {
		if tt.got != tt.want {
			t.Errorf("label = %q, want %q", tt.got, tt.want)
		}
	}
}

func TestAConversationIsNamedByItsVoiceAndWhatItIsAbout(t *testing.T) {
	t.Parallel()

	tests := map[string]string{
		"step:3":        "Implementer of step 3",
		"step_review:3": "Reviewer of step 3",
		"pr_review":     "Reviewer of the pull request",
		"pr_fix":        "Implementer of the pull request",
		"prd":           "PRD agent",
		"discussion":    "Discussion agent",
		"unknown":       "unknown",
	}
	for stage, want := range tests {
		if got := selfcontext.ConversationName(stage); got != want {
			t.Errorf("name of %s = %q, want %q", stage, got, want)
		}
	}
}

func TestADivergenceSaysWhatEachActionDoes(t *testing.T) {
	t.Parallel()

	d := divergence.Divergence{
		Stage: "pr_fix",
		Kind:  divergence.KindCommitMissing,
		Facts: divergence.Facts{Branch: "feature/login", Commit: "abc1234"},
	}

	labels, does := selfcontext.DivergenceActions(d)

	wantDoes := []string{
		"sends the commit request to Implementer of the pull request again",
		"reads git, the files and GitHub again, and the flow goes on if things are now as expected",
	}
	if diff := cmp.Diff([]string{"Ask the implementer again", "Check again"}, labels); diff != "" {
		t.Errorf("labels (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff(wantDoes, does); diff != "" {
		t.Errorf("does (-want +got):\n%s", diff)
	}
}
