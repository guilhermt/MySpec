package board_test

import (
	"testing"

	"github.com/guilhermt/myspec/internal/board"
)

func TestParseURLReadsTheLocatorOfAProject(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		raw  string
		want board.Locator
		ok   bool
	}{
		{"organization", "https://github.com/orgs/acme/projects/3", board.Locator{Owner: "acme", OwnerType: board.OwnerOrganization, Number: 3}, true},
		{"user", "https://github.com/users/dev/projects/12", board.Locator{Owner: "dev", OwnerType: board.OwnerUser, Number: 12}, true},
		{"view, spaces, query and fragment", "  https://GitHub.com/orgs/acme/projects/3/views/2?filterQuery=x#top ", board.Locator{Owner: "acme", OwnerType: board.OwnerOrganization, Number: 3}, true},
		{"trailing and doubled slashes", "https://github.com//orgs/acme/projects/3/", board.Locator{Owner: "acme", OwnerType: board.OwnerOrganization, Number: 3}, true},
		{"http", "http://github.com/orgs/acme/projects/3", board.Locator{}, false},
		{"another host", "https://gitlab.com/orgs/acme/projects/3", board.Locator{}, false},
		{"a repository", "https://github.com/acme/web", board.Locator{}, false},
		{"a repository project", "https://github.com/acme/web/projects/3", board.Locator{}, false},
		{"zero", "https://github.com/orgs/acme/projects/0", board.Locator{}, false},
		{"not a number", "https://github.com/orgs/acme/projects/x", board.Locator{}, false},
		{"another segment", "https://github.com/orgs/acme/projects/3/settings", board.Locator{}, false},
		{"a view without a number", "https://github.com/orgs/acme/projects/3/views/new", board.Locator{}, false},
		{"not a URL", "://nope", board.Locator{}, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got, ok := board.ParseURL(tt.raw)
			if got != tt.want || ok != tt.ok {
				t.Errorf("ParseURL(%q) = %+v, %v, want %+v, %v", tt.raw, got, ok, tt.want, tt.ok)
			}
		})
	}
}
