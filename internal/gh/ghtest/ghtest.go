// Package ghtest builds the fake gh the tests of the gh-driven packages run
// against: a process that answers what a test wrote down, instead of talking
// to GitHub.
//
// The fake is the test binary itself, re-executed. A script written to disk
// would do the same job, but writing an executable while other tests fork is
// what exec refuses with "text file busy", and the tests here run in
// parallel. A package that uses the fake declares it in one line:
//
//	func TestMain(m *testing.M) { ghtest.Main(m) }
package ghtest

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

// homeVar names the directory the fake gh answers from. Its presence is also
// what tells a test binary that it was re-executed to be gh.
const homeVar = "GHTEST_HOME"

// The files the fake keeps in its directory: what it was asked, the
// environment and the standard input of the last run, and one answer per
// subcommand.
const (
	callsFile = "calls"
	envFile   = "env"
	stdinFile = "stdin"
)

// filePerm is what the fake and New write with: nothing here is executable.
const filePerm = 0o600

// noReplyExit is what the fake exits with for a subcommand nobody prepared,
// which is a test asking for something it did not set up.
const noReplyExit = 127

// Reply is what the fake gh answers with for one subcommand.
type Reply struct {
	Stdout string
	Stderr string
	Exit   int
}

// Call is one run of the fake gh: where it ran and the command line it got.
type Call struct {
	Dir  string
	Args string
}

// GH is a fake gh, ready to be handed to a Runner.
type GH struct {
	Binary string   // for gh.Deps.Binary
	Env    []string // for gh.Deps.Env: what points the fake at its answers

	dir string
}

// Main runs the tests of a package that uses the fake gh, or the fake itself
// when the process is the one a Runner started.
func Main(m *testing.M) {
	if home := os.Getenv(homeVar); home != "" {
		os.Exit(answer(home, os.Args[1:]))
	}
	os.Exit(m.Run())
}

// New prepares a fake gh whose answers are replies, keyed by the gh
// subcommand they belong to — "auth", "pr" — or by the subcommand and what
// follows it — "api rate_limit" — which tells two runs of the same subcommand
// apart. The more specific key wins.
func New(t *testing.T, replies map[string]Reply) *GH {
	t.Helper()

	dir := t.TempDir()
	for name, reply := range replies {
		write(t, filepath.Join(dir, name+".out"), reply.Stdout)
		write(t, filepath.Join(dir, name+".err"), reply.Stderr)
		write(t, filepath.Join(dir, name+".code"), strconv.Itoa(reply.Exit))
	}
	return &GH{
		Binary: os.Args[0],
		Env:    append(os.Environ(), homeVar+"="+dir),
		dir:    dir,
	}
}

// Calls are the runs of the fake, in order.
func (g *GH) Calls(t *testing.T) []Call {
	t.Helper()

	content, err := os.ReadFile(filepath.Join(g.dir, callsFile))
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		t.Fatalf("ReadFile(%s) = %v, want nil", callsFile, err)
	}

	var calls []Call
	for _, line := range lines(string(content)) {
		dir, args, found := strings.Cut(line, "\t")
		if !found {
			continue
		}
		calls = append(calls, Call{Dir: dir, Args: args})
	}
	return calls
}

// Vars is the environment of the last run of the fake.
func (g *GH) Vars(t *testing.T) []string {
	t.Helper()

	content, err := os.ReadFile(filepath.Join(g.dir, envFile))
	if err != nil {
		t.Fatalf("ReadFile(%s) = %v, want nil", envFile, err)
	}
	return lines(string(content))
}

// Stdin is what the last run of the fake was fed on its standard input.
func (g *GH) Stdin(t *testing.T) string {
	t.Helper()

	content, err := os.ReadFile(filepath.Join(g.dir, stdinFile))
	if err != nil {
		if os.IsNotExist(err) {
			return ""
		}
		t.Fatalf("ReadFile(%s) = %v, want nil", stdinFile, err)
	}
	return string(content)
}

// answer is the fake gh: it writes down what it was asked and replies with
// the files New left in home.
func answer(home string, args []string) int {
	record(home, args)
	if len(args) == 0 {
		return noReplyExit
	}

	name := replyName(home, args)
	//nolint:gosec // G703: home and the subcommand are the test's own, not user input
	code, err := os.ReadFile(filepath.Join(home, name+".code"))
	if err != nil {
		fmt.Fprintf(os.Stderr, "ghtest: no reply for gh %s\n", strings.Join(args, " "))
		return noReplyExit
	}
	copyTo(os.Stdout, filepath.Join(home, name+".out"))
	copyTo(os.Stderr, filepath.Join(home, name+".err"))

	exit, err := strconv.Atoi(strings.TrimSpace(string(code)))
	if err != nil {
		fmt.Fprintf(os.Stderr, "ghtest: %v\n", err)
		return noReplyExit
	}
	return exit
}

// replyName is the key of the reply this run answers with: the subcommand and
// what follows it when the test wrote one, the subcommand alone otherwise.
func replyName(home string, args []string) string {
	if len(args) > 1 {
		specific := args[0] + " " + args[1]
		//nolint:gosec // G703: home and the subcommand are the test's own, not user input
		if _, err := os.Stat(filepath.Join(home, specific+".code")); err == nil {
			return specific
		}
	}
	return args[0]
}

// record appends the run to the calls of the fake and leaves its environment
// behind, for a test to read either of them afterwards.
func record(home string, args []string) {
	dir, err := os.Getwd()
	if err != nil {
		dir = ""
	}
	//nolint:gosec // G703: home is the directory New made for this run
	calls, err := os.OpenFile(filepath.Join(home, callsFile), os.O_APPEND|os.O_CREATE|os.O_WRONLY, filePerm)
	if err == nil {
		fmt.Fprintf(calls, "%s\t%s\n", dir, strings.Join(args, " "))
		_ = calls.Close()
	}
	//nolint:gosec // G703: home is the directory New made for this run
	_ = os.WriteFile(filepath.Join(home, envFile), []byte(strings.Join(os.Environ(), "\n")), filePerm)
	stdin, err := io.ReadAll(os.Stdin)
	if err != nil {
		stdin = nil
	}
	//nolint:gosec // G703: home is the directory New made for this run
	_ = os.WriteFile(filepath.Join(home, stdinFile), stdin, filePerm)
}

// copyTo writes the content of path to out, which is empty when the file is
// not there.
func copyTo(out *os.File, path string) {
	//nolint:gosec // G703: path is built from the directory New made for this run
	if content, err := os.ReadFile(path); err == nil {
		_, _ = out.Write(content)
	}
}

// lines are the non-empty lines of content.
func lines(content string) []string {
	trimmed := strings.TrimSpace(content)
	if trimmed == "" {
		return nil
	}
	return strings.Split(trimmed, "\n")
}

// write puts content in path, failing the test when it cannot.
func write(t *testing.T, path, content string) {
	t.Helper()

	if err := os.WriteFile(path, []byte(content), filePerm); err != nil {
		t.Fatalf("WriteFile(%s) = %v, want nil", path, err)
	}
}
