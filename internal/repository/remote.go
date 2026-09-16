package repository

import (
	"regexp"
	"strings"
)

// The forms of a GitHub remote URL. Owners are letters, digits and hyphens;
// names add dots and underscores. The name is lazy so that a trailing .git is
// left out of it.
var (
	// scpRemote is the scp-like SSH form: git@github.com:owner/name.
	scpRemote = regexp.MustCompile(`^(?:[^@/\s]+@)?(?i:github\.com):([A-Za-z0-9-]+)/([A-Za-z0-9._-]+?)(?:\.git)?/?$`)
	// urlRemote is the URL form, over HTTPS or SSH, with an optional user and
	// port: https://github.com/owner/name, ssh://git@github.com:22/owner/name.
	urlRemote = regexp.MustCompile(`^(?i:https|ssh)://(?:[^@/\s]+@)?(?i:github\.com)(?::\d+)?/([A-Za-z0-9-]+)/([A-Za-z0-9._-]+?)(?:\.git)?/?$`)
)

// ParseRemote reads the GitHub repository out of the URL of a remote. It
// accepts the SSH forms, git@github.com:owner/name and
// ssh://git@github.com/owner/name, and HTTPS, https://github.com/owner/name,
// each with or without .git and a trailing slash. ok is false for any other
// host or form.
func ParseRemote(url string) (Identity, bool) {
	url = strings.TrimSpace(url)

	match := scpRemote.FindStringSubmatch(url)
	if match == nil {
		match = urlRemote.FindStringSubmatch(url)
	}
	if match == nil {
		return Identity{}, false
	}

	owner, name := match[1], match[2]
	if name == "." || name == ".." {
		return Identity{}, false
	}
	return Identity{Owner: owner, Name: name}, true
}
