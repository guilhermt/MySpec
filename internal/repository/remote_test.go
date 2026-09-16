package repository_test

import (
	"testing"

	"github.com/guilhermt/myspec/internal/repository"
)

func TestParseRemoteReadsTheRepositoryOfAGitHubURL(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		url  string
		want repository.Identity
	}{
		{"ssh with .git", "git@github.com:dev/web.git", repository.Identity{Owner: "dev", Name: "web"}},
		{"ssh without .git", "git@github.com:dev/web", repository.Identity{Owner: "dev", Name: "web"}},
		{"ssh url with a port", "ssh://git@github.com:22/dev/web.git", repository.Identity{Owner: "dev", Name: "web"}},
		{"ssh url without a user", "ssh://github.com/dev/web", repository.Identity{Owner: "dev", Name: "web"}},
		{"https with .git", "https://github.com/dev/web.git", repository.Identity{Owner: "dev", Name: "web"}},
		{"https without .git", "https://github.com/dev/web", repository.Identity{Owner: "dev", Name: "web"}},
		{"https with a trailing slash", "https://github.com/dev/web/", repository.Identity{Owner: "dev", Name: "web"}},
		{"https with .git and a trailing slash", "https://github.com/dev/web.git/", repository.Identity{Owner: "dev", Name: "web"}},
		{"https with a user", "https://token@github.com/dev/web.git", repository.Identity{Owner: "dev", Name: "web"}},
		{"a name with dots and underscores", "git@github.com:dev-team/my_site.io.git", repository.Identity{Owner: "dev-team", Name: "my_site.io"}},
		{"the host in capitals, keeping the case of the rest", "git@GitHub.COM:Dev/Web.git", repository.Identity{Owner: "Dev", Name: "Web"}},
		{"spaces around the url", "  https://github.com/dev/web.git\n", repository.Identity{Owner: "dev", Name: "web"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, ok := repository.ParseRemote(tt.url)
			if !ok {
				t.Fatalf("ParseRemote(%q) ok = false, want true", tt.url)
			}
			if got != tt.want {
				t.Errorf("ParseRemote(%q) = %+v, want %+v", tt.url, got, tt.want)
			}
		})
	}
}

func TestParseRemoteRefusesWhatIsNotAGitHubRepository(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		url  string
	}{
		{"another host", "git@gitlab.com:dev/web.git"},
		{"a host that starts like github.com", "https://github.com.evil.com/dev/web.git"},
		{"an ssh host that starts like github.com", "git@github.com.evil.com:dev/web.git"},
		{"a path with three segments", "https://github.com/dev/web/extra"},
		{"an empty name", "https://github.com/dev/"},
		{"a name that is ..", "https://github.com/dev/.."},
		{"a name that is .", "git@github.com:dev/."},
		{"plain http", "http://github.com/dev/web.git"},
		{"a local path", "/srv/git/web.git"},
		{"nothing", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got, ok := repository.ParseRemote(tt.url); ok {
				t.Errorf("ParseRemote(%q) = %+v, want it refused", tt.url, got)
			}
		})
	}
}
