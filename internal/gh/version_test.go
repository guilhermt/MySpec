package gh_test

import (
	"errors"
	"testing"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/gh/ghtest"
)

func TestParseVersion(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		out  string
		want gh.Version
		err  error
	}{
		{"real output", "gh version 2.102.0 (2026-09-30)\nhttps://github.com/cli/cli/releases/tag/v2.102.0\n", gh.Version{2, 102, 0}, nil},
		{"no date", "gh version 2.99.1", gh.Version{2, 99, 1}, nil},
		{"no version", "something else\n", gh.Version{}, gh.ErrVersionUnreadable},
		{"not numeric", "gh version two.one.zero", gh.Version{}, gh.ErrVersionUnreadable},
		{"empty", "", gh.Version{}, gh.ErrVersionUnreadable},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := gh.ParseVersion(tt.out)
			if !errors.Is(err, tt.err) || got != tt.want {
				t.Errorf("ParseVersion() = %+v, %v, want %+v, %v", got, err, tt.want, tt.err)
			}
		})
	}
}

func TestVersionLessAndString(t *testing.T) {
	t.Parallel()

	tests := []struct {
		a, b gh.Version
		less bool
	}{
		{gh.Version{2, 95, 0}, gh.Version{2, 99, 0}, true},
		{gh.Version{2, 99, 0}, gh.Version{2, 99, 0}, false},
		{gh.Version{2, 99, 1}, gh.Version{2, 99, 0}, false},
		{gh.Version{2, 99, 0}, gh.Version{2, 99, 1}, true},
		{gh.Version{1, 200, 9}, gh.Version{2, 0, 0}, true},
		{gh.Version{3, 0, 0}, gh.Version{2, 200, 9}, false},
	}
	for _, tt := range tests {
		if got := tt.a.Less(tt.b); got != tt.less {
			t.Errorf("%s.Less(%s) = %v, want %v", tt.a, tt.b, got, tt.less)
		}
	}
	if got := (gh.Version{2, 99, 0}).String(); got != "2.99.0" {
		t.Errorf("String() = %q, want 2.99.0", got)
	}
}

func TestVersionRunsGhVersion(t *testing.T) {
	t.Parallel()
	r, fake := runner(t, map[string]ghtest.Reply{"--version": {Stdout: "gh version 2.102.0 (2026-09-30)\nhttps://x\n"}})

	got, err := r.Version(t.Context())
	if err != nil {
		t.Fatalf("Version() = %v, want nil", err)
	}
	if want := (gh.Version{2, 102, 0}); got != want {
		t.Errorf("Version() = %+v, want %+v", got, want)
	}
	if calls := fake.Calls(t); len(calls) != 1 || calls[0].Args != "--version" {
		t.Errorf("calls = %+v, want gh --version", calls)
	}
}
