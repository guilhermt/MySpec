package prreview

import (
	"regexp"
	"strconv"
	"strings"
)

// The markers of a unified diff the reading acts on.
const (
	newFileMarker = "+++ "
	oldFileMarker = "--- "
	noNewline     = `\ No newline at end of file`
	devNull       = "/dev/null"
)

// hunkHeader opens a hunk and says where it starts on the new side.
var hunkHeader = regexp.MustCompile(`^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@`)

// RightLines are the lines of the new side of a unified diff, by file: the
// lines a review may comment on, which are the ones added and the ones kept. A file the diff only removes has no new side
// and is not there.
func RightLines(diff string) map[string]map[int]struct{} {
	lines := map[string]map[int]struct{}{}
	file, number, inHunk := "", 0, false

	for line := range strings.SplitSeq(strings.ReplaceAll(diff, "\r", ""), "\n") {
		switch {
		case strings.HasPrefix(line, newFileMarker):
			file, inHunk = newSideFile(line), false
		case strings.HasPrefix(line, oldFileMarker), strings.HasPrefix(line, noNewline):
		case hunkHeader.MatchString(line):
			number, inHunk = hunkStart(line), file != ""
		case !inHunk:
		case strings.HasPrefix(line, "+"), strings.HasPrefix(line, " "):
			add(lines, file, number)
			number++
		case strings.HasPrefix(line, "-"):
		default:
			inHunk = false
		}
	}
	return lines
}

// newSideFile is the path of the new side of a block, "" when the block only
// removes the file.
func newSideFile(line string) string {
	path, _, _ := strings.Cut(strings.TrimPrefix(line, newFileMarker), "\t")
	path = strings.TrimSpace(path)
	if path == devNull {
		return ""
	}
	return strings.TrimPrefix(path, "b/")
}

// hunkStart is the line the hunk starts at on the new side.
func hunkStart(line string) int {
	number, err := strconv.Atoi(hunkHeader.FindStringSubmatch(line)[1])
	if err != nil {
		return 0
	}
	return number
}

// add records one line of the new side of a file.
func add(lines map[string]map[int]struct{}, file string, number int) {
	if lines[file] == nil {
		lines[file] = map[int]struct{}{}
	}
	lines[file][number] = struct{}{}
}
