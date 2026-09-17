package board_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/board"
)

func TestReadConventionFindsTheEpicAndTheDependenciesOfABody(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		body string
		want board.Convention
	}{
		{
			name: "URL form",
			body: "Epic: https://github.com/acme/api/issues/7",
			want: board.Convention{Epic: &board.Ref{Owner: "acme", Name: "api", Number: 7}},
		},
		{
			name: "owner/name form",
			body: "Depends on other/lib#4",
			want: board.Convention{Dependencies: []board.Ref{{Owner: "other", Name: "lib", Number: 4}}},
		},
		{
			name: "name form takes the board owner",
			body: "Depends on: lib#4",
			want: board.Convention{Dependencies: []board.Ref{{Owner: "acme", Name: "lib", Number: 4}}},
		},
		{
			name: "number form takes the repository of the card",
			body: "Epic: #9",
			want: board.Convention{Epic: &board.Ref{Owner: "dev", Name: "web", Number: 9}},
		},
		{
			name: "list marker and accent",
			body: "Some text.\n\n- Épico: #9\n",
			want: board.Convention{Epic: &board.Ref{Owner: "dev", Name: "web", Number: 9}},
		},
		{
			name: "bold label",
			body: "**Epic:** acme/api#7",
			want: board.Convention{Epic: &board.Ref{Owner: "acme", Name: "api", Number: 7}},
		},
		{
			name: "URL with a trailing period",
			body: "Depende de https://github.com/acme/api/issues/388.",
			want: board.Convention{Dependencies: []board.Ref{{Owner: "acme", Name: "api", Number: 388}}},
		},
		{
			name: "semicolons with a trailing one",
			body: "* Depende de: #1; #2; api#3;",
			want: board.Convention{Dependencies: []board.Ref{
				{Owner: "dev", Name: "web", Number: 1},
				{Owner: "dev", Name: "web", Number: 2},
				{Owner: "acme", Name: "api", Number: 3},
			}},
		},
		{
			name: "prose starting with the word is ignored",
			body: "O épico #9 cobre isto.\nThe epic is #9.",
			want: board.Convention{},
		},
		{
			name: "an epic line without a reference gives way to the next",
			body: "Epic: to be defined\nEpic: #9, #10",
			want: board.Convention{Epic: &board.Ref{Owner: "dev", Name: "web", Number: 9}},
		},
		{
			name: "duplicates are removed across lines",
			body: "Depends on #1, dev/web#1, `#2`\nDepende de https://github.com/Dev/Web/issues/2, nothing",
			want: board.Convention{Dependencies: []board.Ref{
				{Owner: "dev", Name: "web", Number: 1},
				{Owner: "dev", Name: "web", Number: 2},
			}},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := board.ReadConvention(tt.body, "acme", "dev", "web")
			if diff := cmp.Diff(tt.want, got); diff != "" {
				t.Errorf("ReadConvention(%q) (-want +got):\n%s", tt.body, diff)
			}
		})
	}
}

func TestRefKeyIsTheIssueInLowerCase(t *testing.T) {
	t.Parallel()

	if got, want := (board.Ref{Owner: "Acme", Name: "API", Number: 7}).Key(), "acme/api#7"; got != want {
		t.Errorf("Key() = %q, want %q", got, want)
	}
}
