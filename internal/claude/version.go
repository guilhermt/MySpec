package claude

import (
	"context"
	"errors"
	"fmt"
	"os/exec"
	"regexp"
	"strconv"
)

// MinVersion is the oldest Claude Code the app supports: the version the app
// was verified with, which has everything it uses of the CLI (the fixed and
// per-session flags, --permission-mode auto and --effort among them, the
// stream-json protocol with the interrupt and list_models control requests,
// the permission responses and `claude auth status`). It rises whenever the
// app starts using a feature of the CLI that earlier versions lack.
const MinVersion = "2.1.291"

// ErrVersionUnreadable reports an output of --version the app does not understand.
var ErrVersionUnreadable = errors.New("claude: unreadable version")

// Version is a version of the CLI, compared number by number.
type Version struct {
	Major, Minor, Patch int
}

// versionPattern is the major.minor.patch that opens the output of --version.
var versionPattern = regexp.MustCompile(`^\s*(\d+)\.(\d+)\.(\d+)`)

// maxOutputShown is how much of an unreadable output the error carries.
const maxOutputShown = 200

// ParseVersion reads the major.minor.patch that opens s, as `claude --version`
// prints it ("2.1.291 (Claude Code)"); anything after the patch is ignored.
// It wraps ErrVersionUnreadable when s does not open with one.
func ParseVersion(s string) (Version, error) {
	m := versionPattern.FindStringSubmatch(s)
	if m == nil {
		return Version{}, fmt.Errorf("%w: %q", ErrVersionUnreadable, s)
	}

	var parts [3]int
	for i := range parts {
		n, err := strconv.Atoi(m[i+1])
		if err != nil {
			return Version{}, fmt.Errorf("%w: %q", ErrVersionUnreadable, s)
		}
		parts[i] = n
	}
	return Version{Major: parts[0], Minor: parts[1], Patch: parts[2]}, nil
}

// MustParseVersion is ParseVersion for a constant of the app; it panics on a bad one.
func MustParseVersion(s string) Version {
	v, err := ParseVersion(s)
	if err != nil {
		panic(err)
	}
	return v
}

// Less reports whether v is older than other.
func (v Version) Less(other Version) bool {
	if v.Major != other.Major {
		return v.Major < other.Major
	}
	if v.Minor != other.Minor {
		return v.Minor < other.Minor
	}
	return v.Patch < other.Patch
}

// String writes v as major.minor.patch.
func (v Version) String() string {
	return fmt.Sprintf("%d.%d.%d", v.Major, v.Minor, v.Patch)
}

// ReadVersion runs `claude --version` and parses what it prints. The caller
// owns the timeout.
func ReadVersion(ctx context.Context, binary string) (Version, error) {
	out, err := exec.CommandContext(ctx, binary, "--version").Output()
	if err != nil {
		return Version{}, fmt.Errorf("claude --version: %w", err)
	}

	v, err := ParseVersion(string(out))
	if err != nil {
		shown := string(out)
		if len(shown) > maxOutputShown {
			shown = shown[:maxOutputShown]
		}
		return Version{}, fmt.Errorf("claude --version: %w: %q", ErrVersionUnreadable, shown)
	}
	return v, nil
}
