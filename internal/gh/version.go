package gh

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// Version is a version of gh: major.minor.patch.
type Version struct{ Major, Minor, Patch int }

// MinAttachVersion is the oldest gh whose issue create and issue edit take --attach.
var MinAttachVersion = Version{2, 99, 0}

// ErrVersionUnreadable is a gh --version whose first line isn't "gh version X.Y.Z".
var ErrVersionUnreadable = errors.New("gh: the version can't be read")

var versionPattern = regexp.MustCompile(`^gh version (\d+)\.(\d+)\.(\d+)`)

// Less reports whether v is older than o.
func (v Version) Less(o Version) bool {
	if v.Major != o.Major {
		return v.Major < o.Major
	}
	if v.Minor != o.Minor {
		return v.Minor < o.Minor
	}
	return v.Patch < o.Patch
}

// String reads "2.99.0".
func (v Version) String() string {
	return fmt.Sprintf("%d.%d.%d", v.Major, v.Minor, v.Patch)
}

// ParseVersion reads the first line of gh --version, "gh version 2.102.0 (2026-09-30)".
func ParseVersion(out string) (Version, error) {
	line, _, _ := strings.Cut(strings.TrimSpace(out), "\n")
	m := versionPattern.FindStringSubmatch(strings.TrimSpace(line))
	if m == nil {
		return Version{}, fmt.Errorf("%w: %q", ErrVersionUnreadable, line)
	}
	var parts [3]int
	for i := range parts {
		n, err := strconv.Atoi(m[i+1])
		if err != nil {
			return Version{}, fmt.Errorf("%w: %q", ErrVersionUnreadable, line)
		}
		parts[i] = n
	}
	return Version{parts[0], parts[1], parts[2]}, nil
}

// Version runs gh --version.
func (r *Runner) Version(ctx context.Context) (Version, error) {
	out, err := r.Run(ctx, "", "--version")
	if err != nil {
		return Version{}, err
	}
	return ParseVersion(out)
}
