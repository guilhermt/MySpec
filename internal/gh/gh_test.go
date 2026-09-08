package gh_test

import (
	"context"
	"errors"
	"slices"
	"strings"
	"testing"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/gh/ghtest"
)

// TestMain lets the test binary be the fake gh when a Runner starts it.
func TestMain(m *testing.M) { ghtest.Main(m) }

// runner is a Runner over a fake gh that answers replies.
func runner(t *testing.T, replies map[string]ghtest.Reply) (*gh.Runner, *ghtest.GH) {
	t.Helper()

	fake := ghtest.New(t, replies)
	return gh.New(gh.Deps{Binary: fake.Binary, Env: fake.Env}), fake
}

func TestRunReturnsTheTrimmedOutputOfGh(t *testing.T) {
	t.Parallel()
	r, fake := runner(t, map[string]ghtest.Reply{"auth": {Stdout: "  logged in  \n"}})

	got, err := r.Run(t.Context(), t.TempDir(), "auth", "status")
	if err != nil {
		t.Fatalf("Run(auth status) = %v, want nil", err)
	}
	if got != "logged in" {
		t.Errorf("Run(auth status) = %q, want %q", got, "logged in")
	}
	if calls := fake.Calls(t); len(calls) != 1 || calls[0].Args != "auth status" {
		t.Errorf("calls = %+v, want the one command line", calls)
	}
}

func TestRunReportsWhatGhSaidAboutAFailure(t *testing.T) {
	t.Parallel()
	r, _ := runner(t, map[string]ghtest.Reply{"pr": {Stderr: "could not resolve to a Repository", Exit: 1}})

	dir := t.TempDir()
	_, err := r.Run(t.Context(), dir, "pr", "view", "login-screen")
	var ghErr *gh.Error
	if !errors.As(err, &ghErr) {
		t.Fatalf("Run(pr view) error = %v, want *gh.Error", err)
	}
	if want := []string{"pr", "view", "login-screen"}; !slices.Equal(ghErr.Args, want) {
		t.Errorf("Args = %v, want %v", ghErr.Args, want)
	}
	if ghErr.Dir != dir {
		t.Errorf("Dir = %q, want %q", ghErr.Dir, dir)
	}
	if ghErr.ExitCode != 1 {
		t.Errorf("ExitCode = %d, want 1", ghErr.ExitCode)
	}
	if ghErr.Output != "could not resolve to a Repository" {
		t.Errorf("Output = %q, want what gh printed", ghErr.Output)
	}
	if !strings.Contains(ghErr.Error(), ghErr.Output) {
		t.Errorf("Error() = %q, want it to carry %q", ghErr.Error(), ghErr.Output)
	}
}

func TestRunFallsBackToStdoutWhenGhSaysNothingOnStderr(t *testing.T) {
	t.Parallel()
	r, _ := runner(t, map[string]ghtest.Reply{"pr": {Stdout: "something went wrong", Exit: 1}})

	_, err := r.Run(t.Context(), t.TempDir(), "pr", "view")
	var ghErr *gh.Error
	if !errors.As(err, &ghErr) {
		t.Fatalf("Run(pr view) error = %v, want *gh.Error", err)
	}
	if ghErr.Output != "something went wrong" {
		t.Errorf("Output = %q, want what gh wrote on stdout", ghErr.Output)
	}
}

func TestRunReportsACancelledContext(t *testing.T) {
	t.Parallel()
	r, _ := runner(t, map[string]ghtest.Reply{"auth": {}})

	ctx, cancel := context.WithCancel(t.Context())
	cancel()

	_, err := r.Run(ctx, t.TempDir(), "auth", "status")
	var ghErr *gh.Error
	if !errors.As(err, &ghErr) {
		t.Fatalf("Run(auth status) error = %v, want *gh.Error", err)
	}
	if !errors.Is(err, context.Canceled) {
		t.Errorf("Run(auth status) error = %v, want context.Canceled underneath", err)
	}
	if ghErr.ExitCode != -1 {
		t.Errorf("ExitCode = %d, want -1", ghErr.ExitCode)
	}
}

func TestRunFailsWithoutGhOnThePath(t *testing.T) {
	t.Setenv("PATH", t.TempDir())

	r := gh.New(gh.Deps{})
	_, err := r.Run(t.Context(), t.TempDir(), "auth", "status")
	if !errors.Is(err, gh.ErrNotFound) {
		t.Errorf("Run(auth status) error = %v, want ErrNotFound", err)
	}
}

func TestEveryCommandRunsWithGhLeftNoQuestionsToAsk(t *testing.T) {
	t.Parallel()
	r, fake := runner(t, map[string]ghtest.Reply{"auth": {}})

	if _, err := r.Run(t.Context(), t.TempDir(), "auth", "status"); err != nil {
		t.Fatalf("Run(auth status) = %v, want nil", err)
	}

	env := fake.Vars(t)
	want := []string{"GH_PROMPT_DISABLED=1", "GH_PAGER=cat", "GH_NO_UPDATE_NOTIFIER=1", "NO_COLOR=1"}
	for _, entry := range want {
		if !slices.Contains(env, entry) {
			t.Errorf("environment has no %s, want gh non-interactive and unpaginated", entry)
		}
	}
}
