package review_test

import (
	"testing"

	"github.com/guilhermt/myspec/internal/review"
)

func TestPercentOnlyReaches100WhenEveryFileIsStaged(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name    string
		snap    review.Snapshot
		percent int
		ready   bool
		empty   bool
	}{
		{"nothing to review", review.Snapshot{}, 0, false, true},
		{"nothing staged yet", review.Snapshot{Total: 4}, 0, false, false},
		{"two of three", review.Snapshot{Staged: 2, Total: 3}, 66, false, false},
		{"all but one of a hundred", review.Snapshot{Staged: 99, Total: 100}, 99, false, false},
		{"every file staged", review.Snapshot{Staged: 3, Total: 3}, 100, true, false},
		{"unreadable", review.Snapshot{Err: "git failed"}, 0, false, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := tc.snap.Percent(); got != tc.percent {
				t.Errorf("Percent() = %d, want %d", got, tc.percent)
			}
			if got := tc.snap.Ready(); got != tc.ready {
				t.Errorf("Ready() = %t, want %t", got, tc.ready)
			}
			if got := tc.snap.Empty(); got != tc.empty {
				t.Errorf("Empty() = %t, want %t", got, tc.empty)
			}
		})
	}
}
