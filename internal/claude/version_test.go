package claude_test

import (
	"errors"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/claude"
	"github.com/guilhermt/myspec/internal/claude/claudetest"
)

func TestParseVersionReadsWhatOpensTheOutput(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		in      string
		want    claude.Version
		wantErr bool
	}{
		{"as the CLI prints it", "2.1.291 (Claude Code)\n", claude.Version{Major: 2, Minor: 1, Patch: 291}, false},
		{"with leading spaces", "  2.1.300", claude.Version{Major: 2, Minor: 1, Patch: 300}, false},
		{"with a suffix", "2.1.292-beta.1 (Claude Code)", claude.Version{Major: 2, Minor: 1, Patch: 292}, false},
		{"empty", "", claude.Version{}, true},
		{"words", "Claude Code", claude.Version{}, true},
		{"two numbers", "2.1", claude.Version{}, true},
		{"with a v", "v2.1.291", claude.Version{}, true},
		{"overflowing", "99999999999999999999.1.1", claude.Version{}, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, err := claude.ParseVersion(tc.in)
			if tc.wantErr {
				if !errors.Is(err, claude.ErrVersionUnreadable) {
					t.Fatalf("ParseVersion(%q) = %v, want ErrVersionUnreadable", tc.in, err)
				}
				return
			}
			if err != nil {
				t.Fatalf("ParseVersion(%q) = %v, want nil", tc.in, err)
			}
			if diff := cmp.Diff(tc.want, got); diff != "" {
				t.Errorf("ParseVersion(%q) mismatch (-want +got):\n%s", tc.in, diff)
			}
		})
	}
}

func TestVersionLessComparesNumberByNumber(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		a, b string
		want bool
	}{
		{"older major", "1.9.9", "2.0.0", true},
		{"newer major", "3.0.0", "2.9.9", false},
		{"older minor", "2.0.14", "2.1.0", true},
		{"newer minor", "2.2.0", "2.1.291", false},
		{"older patch", "2.1.290", "2.1.291", true},
		{"newer patch", "2.1.292", "2.1.291", false},
		{"more than one digit", "2.1.300", "2.1.291", false},
		{"minor of two digits", "2.10.0", "2.9.9", false},
		{"equal", "2.1.291", "2.1.291", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := claude.MustParseVersion(tc.a).Less(claude.MustParseVersion(tc.b)); got != tc.want {
				t.Errorf("%s.Less(%s) = %v, want %v", tc.a, tc.b, got, tc.want)
			}
		})
	}
}

func TestVersionStringWritesMajorMinorPatch(t *testing.T) {
	t.Parallel()

	if got := claude.MustParseVersion("2.1.291").String(); got != "2.1.291" {
		t.Errorf("String() = %q, want 2.1.291", got)
	}
}

func TestReadVersionReadsTheFake(t *testing.T) {
	binary := fakeBinary(t)

	got, err := claude.ReadVersion(t.Context(), binary)
	if err != nil {
		t.Fatalf("ReadVersion() = %v, want nil", err)
	}
	if want := claude.MustParseVersion(claude.MinVersion); got != want {
		t.Errorf("ReadVersion() = %v, want %v", got, want)
	}
}

func TestReadVersionReadsWhatTheCLIPrints(t *testing.T) {
	binary := fakeBinary(t)
	t.Setenv(claudetest.EnvVersion, "2.0.14 (Claude Code)")

	got, err := claude.ReadVersion(t.Context(), binary)
	if err != nil {
		t.Fatalf("ReadVersion() = %v, want nil", err)
	}
	if want := (claude.Version{Major: 2, Minor: 0, Patch: 14}); got != want {
		t.Errorf("ReadVersion() = %v, want %v", got, want)
	}
}

func TestReadVersionReportsAnOutputItDoesNotUnderstand(t *testing.T) {
	binary := fakeBinary(t)
	t.Setenv(claudetest.EnvVersion, "nonsense")

	_, err := claude.ReadVersion(t.Context(), binary)
	if !errors.Is(err, claude.ErrVersionUnreadable) {
		t.Errorf("ReadVersion() = %v, want ErrVersionUnreadable", err)
	}
}

func TestReadVersionFailsWithoutTheBinary(t *testing.T) {
	t.Parallel()

	_, err := claude.ReadVersion(t.Context(), "/nonexistent/claude")
	if err == nil {
		t.Fatal("ReadVersion() = nil, want an error")
	}
	if errors.Is(err, claude.ErrVersionUnreadable) {
		t.Errorf("ReadVersion() = %v, want a failure to run told apart from an unreadable output", err)
	}
}
