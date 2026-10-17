package update

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// Version is a MAJOR.MINOR.PATCH version, compared number by number.
type Version struct{ Major, Minor, Patch int }

// versionPattern is MAJOR.MINOR.PATCH with no leading zeros, prefix or suffix.
var versionPattern = regexp.MustCompile(`^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$`)

// ParseVersion reads s as MAJOR.MINOR.PATCH, exactly; ok is false for anything
// else, such as dev, v0.4.0 or 0.4.0-rc.1.
func ParseVersion(s string) (Version, bool) {
	m := versionPattern.FindStringSubmatch(s)
	if m == nil {
		return Version{}, false
	}
	var n [3]int
	for i := range n {
		v, err := strconv.Atoi(m[i+1])
		if err != nil { // a number too large for an int is not a version
			return Version{}, false
		}
		n[i] = v
	}
	return Version{Major: n[0], Minor: n[1], Patch: n[2]}, true
}

// parseTag reads a tag as the releases have it, vMAJOR.MINOR.PATCH, exactly.
func parseTag(tag string) (Version, bool) {
	rest, ok := strings.CutPrefix(tag, "v")
	if !ok {
		return Version{}, false
	}
	return ParseVersion(rest)
}

// Less reports whether v is older than other.
func (v Version) Less(other Version) bool {
	return v.compare(other) < 0
}

// compare is -1, 0 or 1 as v is older than, equal to or newer than other.
func (v Version) compare(other Version) int {
	for _, pair := range [3][2]int{{v.Major, other.Major}, {v.Minor, other.Minor}, {v.Patch, other.Patch}} {
		switch {
		case pair[0] < pair[1]:
			return -1
		case pair[0] > pair[1]:
			return 1
		}
	}
	return 0
}

// String writes v as MAJOR.MINOR.PATCH, without the v.
func (v Version) String() string {
	return fmt.Sprintf("%d.%d.%d", v.Major, v.Minor, v.Patch)
}
