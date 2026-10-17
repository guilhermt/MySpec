package update_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/update"
)

func TestParseVersionReadsOnlyMajorMinorPatch(t *testing.T) {
	t.Parallel()

	tests := []struct {
		in   string
		want update.Version
		ok   bool
	}{
		{"0.4.0", update.Version{Major: 0, Minor: 4, Patch: 0}, true},
		{"10.0.12", update.Version{Major: 10, Minor: 0, Patch: 12}, true},
		{"dev", update.Version{}, false},
		{"v0.4.0", update.Version{}, false},
		{"0.4", update.Version{}, false},
		{"00.4.0", update.Version{}, false},
		{"0.4.0-rc.1", update.Version{}, false},
		{" 0.4.0", update.Version{}, false},
		{"", update.Version{}, false},
		{"99999999999999999999.0.0", update.Version{}, false},
	}
	for _, tt := range tests {
		t.Run(tt.in, func(t *testing.T) {
			t.Parallel()

			got, ok := update.ParseVersion(tt.in)
			if ok != tt.ok {
				t.Fatalf("ParseVersion(%q) ok = %v, want %v", tt.in, ok, tt.ok)
			}
			if diff := cmp.Diff(tt.want, got); diff != "" {
				t.Errorf("ParseVersion(%q) (-want +got):\n%s", tt.in, diff)
			}
		})
	}
}

func TestLessComparesNumberByNumber(t *testing.T) {
	t.Parallel()

	tests := []struct {
		a, b string
		want bool
	}{
		{"0.4.0", "0.4.1", true},
		{"0.4.1", "0.4.0", false},
		{"0.4.0", "0.5.0", true},
		{"0.5.0", "0.4.9", false},
		{"0.9.0", "0.10.0", true},
		{"0.4.0", "1.0.0", true},
		{"1.0.0", "0.99.99", false},
		{"0.4.0", "0.4.0", false},
	}
	for _, tt := range tests {
		t.Run(tt.a+" < "+tt.b, func(t *testing.T) {
			t.Parallel()

			if got := ver(t, tt.a).Less(ver(t, tt.b)); got != tt.want {
				t.Errorf("%s.Less(%s) = %v, want %v", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

func TestAVersionWritesItselfWithoutTheV(t *testing.T) {
	t.Parallel()

	if got := ver(t, "10.0.12").String(); got != "10.0.12" {
		t.Errorf("String() = %q, want 10.0.12", got)
	}
}
