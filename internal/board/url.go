package board

import (
	"net/url"
	"strconv"
	"strings"
)

// Locator is where a project lives on GitHub.
type Locator struct {
	Owner     string
	OwnerType OwnerType
	Number    int
}

// The segments of a project path: kind, login, "projects", number.
const projectSegments = 4

// ParseURL reads the URL of a GitHub project.
func ParseURL(raw string) (Locator, bool) {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || u.Scheme != "https" || !strings.EqualFold(u.Host, "github.com") {
		return Locator{}, false
	}
	segments := pathSegments(u.Path)
	if len(segments) < projectSegments || segments[2] != "projects" {
		return Locator{}, false
	}
	number, ok := positive(segments[3])
	if !ok || !validRest(segments[projectSegments:]) {
		return Locator{}, false
	}
	var ownerType OwnerType
	switch segments[0] {
	case "orgs":
		ownerType = OwnerOrganization
	case "users":
		ownerType = OwnerUser
	default:
		return Locator{}, false
	}
	return Locator{Owner: segments[1], OwnerType: ownerType, Number: number}, true
}

// pathSegments splits a path on "/", dropping the empty segments.
func pathSegments(path string) []string {
	var segments []string
	for s := range strings.SplitSeq(path, "/") {
		if s != "" {
			segments = append(segments, s)
		}
	}
	return segments
}

// validRest accepts what follows the project number: nothing, or views/<n>.
func validRest(rest []string) bool {
	switch len(rest) {
	case 0:
		return true
	case 2:
		_, ok := positive(rest[1])
		return rest[0] == "views" && ok
	default:
		return false
	}
}

// positive reads a positive int.
func positive(s string) (int, bool) {
	n, err := strconv.Atoi(s)
	return n, err == nil && n > 0
}
