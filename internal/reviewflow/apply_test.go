package reviewflow_test

import (
	"strings"
	"testing"
)

func TestTheApplyModeRefusesEverythingUntilItsCycleIsWritten(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := decided(t, f)

	if err := f.service.Apply(t.Context(), id); err == nil ||
		!strings.Contains(err.Error(), "not implemented") {
		t.Errorf("Apply() = %v, want a refusal of the apply mode", err)
	}
	if err := f.service.Approve(t.Context(), id); err == nil ||
		!strings.Contains(err.Error(), "not implemented") {
		t.Errorf("Approve() = %v, want a refusal of the apply mode", err)
	}
}
