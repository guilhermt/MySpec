package bindings_test

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/workspace"
)

func TestFromWorkspace(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		in   *workspace.Workspace
		want *bindings.Workspace
	}{
		{name: "none", in: nil, want: nil},
		{
			name: "no repos",
			in:   &workspace.Workspace{Name: "code", Path: "/home/u/code"},
			want: &bindings.Workspace{Name: "code", Path: "/home/u/code", Repos: []bindings.Repo{}},
		},
		{
			name: "with repos",
			in: &workspace.Workspace{
				Name:  "code",
				Path:  "/home/u/code",
				Repos: []workspace.Repo{{Name: "api", Path: "/home/u/code/api"}},
			},
			want: &bindings.Workspace{
				Name:  "code",
				Path:  "/home/u/code",
				Repos: []bindings.Repo{{Name: "api", Path: "/home/u/code/api"}},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if diff := cmp.Diff(tt.want, bindings.FromWorkspace(tt.in)); diff != "" {
				t.Errorf("FromWorkspace() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestFromRecentsIsNeverNil(t *testing.T) {
	t.Parallel()

	got := bindings.FromRecents(nil)
	if got == nil {
		t.Fatal("FromRecents(nil) = nil, want an empty slice")
	}
	if len(got) != 0 {
		t.Errorf("len(FromRecents(nil)) = %d, want 0", len(got))
	}
}

func TestFromRecentsDropsTheTimestamp(t *testing.T) {
	t.Parallel()

	in := []workspace.Recent{
		{Name: "code", Path: "/home/u/code", LastOpenedAt: time.Now()},
		{Name: "work", Path: "/home/u/work", LastOpenedAt: time.Now()},
	}
	want := []bindings.Recent{
		{Name: "code", Path: "/home/u/code"},
		{Name: "work", Path: "/home/u/work"},
	}

	if diff := cmp.Diff(want, bindings.FromRecents(in)); diff != "" {
		t.Errorf("FromRecents() mismatch (-want +got):\n%s", diff)
	}
}

func TestFromNotice(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		in   *workspace.Notice
		want *bindings.Notice
	}{
		{name: "none", in: nil, want: nil},
		{
			name: "missing path",
			in:   &workspace.Notice{Path: "/gone", Reason: workspace.ReasonNotFound},
			want: &bindings.Notice{Path: "/gone", Reason: "not_found"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if diff := cmp.Diff(tt.want, bindings.FromNotice(tt.in)); diff != "" {
				t.Errorf("FromNotice() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
