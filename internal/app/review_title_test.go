package app

import (
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/attention"
	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/repository"
	"github.com/guilhermt/myspec/internal/reviewflow"
)

func TestReviewTitle(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		stored prreview.Review
		want   string
	}{
		{"with the title of the pull request", prreview.Review{Number: 2291, Title: "Migrate settings page to react-hook-form"}, "acme/web#2291 · Migrate settings page to react-hook-form"},
		{"without it", prreview.Review{Number: 2291}, "acme/web#2291"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			if got := reviewTitle("acme/web", test.stored); got != test.want {
				t.Errorf("reviewTitle() = %q, want %q", got, test.want)
			}
		})
	}
}

func TestTheSituationOfAReviewIsTitledByItsPullRequest(t *testing.T) {
	t.Parallel()
	migrate := prreview.Review{
		ID: "review-1", RepositoryID: "repo-1", Number: 2291, Title: "Migrate settings page to react-hook-form",
	}
	// The flow does not know this one yet: it has no state and no situation.
	unknown := prreview.Review{ID: "review-2", RepositoryID: "repo-1", Number: 2292, Title: "Drop the old router"}
	states := map[string]reviewflow.State{
		migrate.ID: {Review: migrate, Status: reviewflow.StatusReadyToPublish},
	}
	repositories := map[string]repository.Repository{"repo-1": {ID: "repo-1", Owner: "acme", Name: "web"}}

	gotStates, found := reviewStatesOf(
		[]prreview.Review{migrate, unknown},
		func(id string) (reviewflow.State, bool) { state, ok := states[id]; return state, ok },
		func(id string) (repository.Repository, bool) { repo, ok := repositories[id]; return repo, ok },
	)

	if len(gotStates) != 1 || gotStates[0].Review.ID != migrate.ID {
		t.Errorf("states = %+v, want only the state of %s", gotStates, migrate.ID)
	}
	want := []attention.Found{{
		TaskID: migrate.ID, Place: attention.Place{Kind: attention.PlaceReview},
		Kind: attention.KindReviewReport, Form: attention.FormPublish,
		Title: "acme/web#2291 · Migrate settings page to react-hook-form",
		Body:  "The review is ready to publish.",
	}}
	if diff := cmp.Diff(want, found); diff != "" {
		t.Errorf("situations mismatch (-want +got):\n%s", diff)
	}
}
