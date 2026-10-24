package selfcontext_test

import (
	"strings"
	"time"

	"github.com/guilhermt/myspec/internal/session"
)

// readAt is the moment the states of the tests are read, in a zone of its own.
var readAt = time.Date(2026, time.October, 23, 14, 5, 0, 0, time.FixedZone("test", -3*3600))

// openedAt is when the divergences of the tests opened.
var openedAt = time.Date(2026, time.October, 23, 13, 40, 0, 0, time.FixedZone("test", -3*3600))

// local writes a time as the state does, in the zone of the machine.
func local(t time.Time) string { return t.Local().Format("2006-01-02 15:04 -07:00") }

// stateOf is the text a state is expected to have: the lines in their tags.
func stateOf(lines ...string) string {
	return "<myspec-state>\n" + strings.Join(lines, "\n") + "\n</myspec-state>"
}

// headerOf is the first line of a state of an item.
func headerOf(item string) string {
	return "The state of this " + item + " in MySpec, read at " + local(readAt) + ". It replaces every earlier state."
}

// open is a summary of a session in a status.
func open(taskID, stage string, status session.Status) (session.Key, session.Summary) {
	return session.Key{TaskID: taskID, Stage: stage}, session.Summary{TaskID: taskID, Stage: stage, Status: status}
}

// containsLine says whether the text has the fragment.
func containsLine(text, fragment string) bool { return strings.Contains(text, fragment) }
