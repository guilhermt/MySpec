package app_test

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"syscall"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/app"
	"github.com/guilhermt/myspec/internal/bindings"
)

// settleTimeout is how long a test waits for the executor to move.
const settleTimeout = 5 * time.Second

// clock is a clock that moves one second at every reading.
func clock() func() time.Time {
	t := time.Date(2026, 10, 3, 12, 0, 0, 0, time.UTC)
	return func() time.Time {
		t = t.Add(time.Second)
		return t
	}
}

// waitFor reads the published startups until one satisfies ok.
func waitFor(t *testing.T, published <-chan bindings.Startup, ok func(bindings.Startup) bool) bindings.Startup {
	t.Helper()
	timeout := time.After(settleTimeout)
	for {
		select {
		case got := <-published:
			if ok(got) {
				return got
			}
		case <-timeout:
			t.Fatal("the startup did not reach the expected point")
		}
	}
}

func phaseIs(phase string) func(bindings.Startup) bool {
	return func(s bindings.Startup) bool { return s.Phase == phase }
}

func TestTheStepsFollowTheAttemptInOrder(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		attempt func(ctx context.Context, p *app.Progress) error
		want    []bindings.StartupStep
	}{
		{
			name: "no clone to test leaves the step of the data alone",
			attempt: func(_ context.Context, p *app.Progress) error {
				p.Begin("data")
				p.Finish("data")
				return nil
			},
			want: []bindings.StartupStep{
				{ID: "data", State: "done", StartedAt: "2026-10-03T12:00:01.000Z"},
			},
		},
		{
			name: "the step of the clones joins when it begins, with the count",
			attempt: func(_ context.Context, p *app.Progress) error {
				p.Begin("data")
				p.Finish("data")
				p.Begin("clones")
				p.CloneCount(3)
				p.Finish("clones")
				return nil
			},
			want: []bindings.StartupStep{
				{ID: "data", State: "done", StartedAt: "2026-10-03T12:00:01.000Z"},
				{ID: "clones", State: "done", StartedAt: "2026-10-03T12:00:02.000Z", Count: 3},
			},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			s, published := app.NewStartupForTest(test.attempt, clock(), time.Hour)

			s.Start()
			got := waitFor(t, published, phaseIs("ready"))

			if diff := cmp.Diff(test.want, got.Steps); diff != "" {
				t.Errorf("Steps mismatch (-want +got):\n%s", diff)
			}
			if !got.SystemDark {
				t.Error("SystemDark = false, want what the executor was given")
			}
		})
	}
}

func TestTheFirstStepIsTodoUntilTheAttemptBegins(t *testing.T) {
	t.Parallel()
	release := make(chan struct{})
	s, published := app.NewStartupForTest(func(ctx context.Context, _ *app.Progress) error {
		select {
		case <-release:
		case <-ctx.Done():
		}
		return nil
	}, clock(), time.Hour)

	s.Start()
	got := waitFor(t, published, phaseIs("starting"))
	close(release)

	want := []bindings.StartupStep{{ID: "data", State: "todo"}}
	if diff := cmp.Diff(want, got.Steps); diff != "" {
		t.Errorf("Steps mismatch (-want +got):\n%s", diff)
	}
}

func TestAClonePastTheSlowTimeNamesItsPath(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		slow       bool
		wantDetail string
	}{
		{name: "a test that runs too long names the path", slow: true, wantDetail: "/home/dev/web"},
		{name: "a test that ends in time names nothing", slow: false, wantDetail: ""},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			slowAfter := time.Hour
			if test.slow {
				slowAfter = time.Millisecond
			}
			release := make(chan struct{})
			s, published := app.NewStartupForTest(func(_ context.Context, p *app.Progress) error {
				p.Begin("data")
				p.Finish("data")
				p.Begin("clones")
				p.CloneCount(1)
				done := p.Checking("/home/dev/web")
				<-release
				done()
				p.Finish("clones")
				return nil
			}, clock(), slowAfter)

			s.Start()
			if test.slow {
				waitFor(t, published, func(got bindings.Startup) bool {
					return len(got.Steps) == 2 && got.Steps[1].Detail != ""
				})
			}
			close(release)
			got := waitFor(t, published, phaseIs("ready"))

			if detail := got.Steps[1].Detail; detail != test.wantDetail {
				t.Errorf("Detail = %q, want %q", detail, test.wantDetail)
			}
		})
	}
}

func TestAFailureIsClassifiedByItsCause(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		err  error
		want string
	}{
		{
			name: "permission denied",
			err:  fmt.Errorf("probe data directory: %w", &fs.PathError{Op: "open", Path: "/data", Err: syscall.EACCES}),
			want: "permission",
		},
		{
			name: "no space left",
			err:  fmt.Errorf("open database: %w", &fs.PathError{Op: "write", Path: "/data", Err: syscall.ENOSPC}),
			want: "disk_full",
		},
		{name: "anything else", err: errors.New("watch artifacts: too many open files"), want: "other"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			s, published := app.NewStartupForTest(func(context.Context, *app.Progress) error {
				return test.err
			}, clock(), time.Hour)

			s.Start()
			got := waitFor(t, published, phaseIs("failed"))

			want := &bindings.StartupFailure{
				Case:    test.want,
				Error:   test.err.Error(),
				DataDir: "/data",
				LogPath: "/state/myspec.log",
			}
			if diff := cmp.Diff(want, got.Failure); diff != "" {
				t.Errorf("Failure mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestTryAgainStartsFromTheFirstStepAndEndsReady(t *testing.T) {
	t.Parallel()
	calls := 0
	s, published := app.NewStartupForTest(func(_ context.Context, p *app.Progress) error {
		calls++
		p.Begin("data")
		if calls == 1 {
			return errors.New("open database: busy")
		}
		p.Finish("data")
		return nil
	}, clock(), time.Hour)

	s.Start()
	failed := waitFor(t, published, phaseIs("failed"))
	if failed.Failure == nil {
		t.Fatal("Failure = nil after a failed attempt")
	}

	s.TryAgain()
	got := waitFor(t, published, phaseIs("ready"))

	if got.Failure != nil {
		t.Errorf("Failure = %+v after a ready startup, want nil", got.Failure)
	}
	if calls != 2 {
		t.Errorf("attempts = %d, want 2", calls)
	}
	if len(got.Steps) != 1 || got.Steps[0].State != "done" {
		t.Errorf("Steps = %+v, want only the data, done", got.Steps)
	}
}

func TestTryAgainDoesNothingUnlessTheStartupFailed(t *testing.T) {
	t.Parallel()
	calls := 0
	s, published := app.NewStartupForTest(func(context.Context, *app.Progress) error {
		calls++
		return nil
	}, clock(), time.Hour)

	s.TryAgain()
	if calls != 0 {
		t.Fatalf("attempts = %d before the first start, want 0", calls)
	}
	s.Start()
	waitFor(t, published, phaseIs("ready"))
	s.TryAgain()

	if calls != 1 {
		t.Errorf("attempts = %d after a ready startup, want 1", calls)
	}
	if phase := s.Snapshot().Phase; phase != "ready" {
		t.Errorf("Phase = %q, want ready", phase)
	}
}

func TestCloseCancelsTheAttemptAndKeepsAnotherFromStarting(t *testing.T) {
	t.Parallel()
	begun := make(chan struct{})
	returned := make(chan struct{})
	calls := 0
	s, _ := app.NewStartupForTest(func(ctx context.Context, p *app.Progress) error {
		calls++
		p.Begin("data")
		close(begun)
		<-ctx.Done()
		close(returned)
		return ctx.Err()
	}, clock(), time.Hour)

	s.Start()
	<-begun
	s.Close()

	select {
	case <-returned:
	default:
		t.Fatal("Close returned before the attempt did")
	}
	s.Start()
	s.TryAgain()
	if calls != 1 {
		t.Errorf("attempts = %d after Close, want 1", calls)
	}
	if phase := s.Snapshot().Phase; phase == "failed" {
		t.Errorf("Phase = failed after the window closed, want the cancelled attempt not shown")
	}
}
