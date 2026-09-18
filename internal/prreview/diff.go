package prreview

import (
	"regexp"
	"strconv"
	"strings"
)

// The markers of a unified diff the reading acts on.
const (
	newFileMarker = "+++ "
	noNewline     = `\ No newline at end of file`
	devNull       = "/dev/null"
)

// hunkHeader opens a hunk and says where it starts on the new side and how
// many lines it has on each side; a count left out is 1.
var hunkHeader = regexp.MustCompile(`^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@`)

// RightLines are the lines of the new side of a unified diff, by file: the
// lines a review may comment on, which are the ones added and the ones kept. A file the diff only removes has no new side
// and is not there.
func RightLines(diff string) map[string]map[int]struct{} {
	side := newSide{lines: map[string]map[int]struct{}{}}
	for line := range strings.SplitSeq(strings.ReplaceAll(diff, "\r", ""), "\n") {
		side.read(line)
	}
	return side.lines
}

// newSide reads a unified diff line by line, following the hunk it is in.
type newSide struct {
	lines   map[string]map[int]struct{}
	file    string
	number  int // the next line of the new side
	oldLeft int // the lines of the hunk still to come on the old side
	newLeft int // the lines of the hunk still to come on the new side
}

// read takes one line. A hunk ends when the counts of its header are used up,
// so an added line that reads "+++ " is a line of the hunk, not a file header.
func (s *newSide) read(line string) {
	if s.oldLeft > 0 || s.newLeft > 0 {
		if s.readHunkLine(line) {
			return
		}
		s.oldLeft, s.newLeft = 0, 0
	}
	switch {
	case strings.HasPrefix(line, newFileMarker):
		s.file = newSideFile(line)
	case hunkHeader.MatchString(line):
		s.number, s.oldLeft, s.newLeft = hunkStart(line)
	}
}

// readHunkLine takes a line of the hunk being read, false when the line is not
// one and the hunk ended before its header said.
func (s *newSide) readHunkLine(line string) bool {
	switch {
	case strings.HasPrefix(line, "+"):
		s.newLeft--
		s.keep()
	case strings.HasPrefix(line, " "):
		s.oldLeft--
		s.newLeft--
		s.keep()
	case strings.HasPrefix(line, "-"):
		s.oldLeft--
	case strings.HasPrefix(line, noNewline):
	default:
		return false
	}
	return true
}

// keep records the next line of the new side, when the file has one.
func (s *newSide) keep() {
	if s.file != "" {
		add(s.lines, s.file, s.number)
	}
	s.number++
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

// hunkStart is the line the hunk starts at on the new side, and how many
// lines it has on the old side and on the new one.
func hunkStart(line string) (start, oldCount, newCount int) {
	match := hunkHeader.FindStringSubmatch(line)
	return atoi(match[2], 0), atoi(match[1], 1), atoi(match[3], 1)
}

// atoi is the number a header wrote, fallback when it wrote none.
func atoi(value string, fallback int) int {
	number, err := strconv.Atoi(value)
	if err != nil {
		return fallback
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
