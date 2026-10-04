package app

import (
	"testing"

	"github.com/guilhermt/myspec/internal/prreview"
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
