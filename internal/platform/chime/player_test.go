package chime_test

import (
	"context"
	"errors"
	"slices"
	"strings"
	"syscall"
	"testing"
	"time"

	"github.com/guilhermt/myspec/internal/platform/chime"
)

func TestRingPlaysTheChimeWithTheFirstPlayerThatWorks(t *testing.T) {
	t.Parallel()

	commands, env, dir := players(t, "play", "play")
	f := newFixture(t, commands, env, dir, nil)

	f.player.Ring()

	f.waitLogged(t, "chime played")
	f.wantCalls(t, f.call("play"))
	for _, rec := range f.records(t) {
		if rec["level"] == "WARN" {
			t.Errorf("logged at WARN: %v", rec)
		}
	}
}

func TestAMissingOrFailingPlayerHandsOverToTheNext(t *testing.T) {
	t.Parallel()

	commands, env, dir := players(t, "fail", "play")
	f := newFixture(t, append([]chime.Command{missing(t)}, commands...), env, dir, nil)

	f.player.Ring()

	f.waitLogged(t, "chime played")
	f.wantCalls(t, f.call("fail"), f.call("play"))
	if failures := f.logged(t, "play chime failed"); len(failures) > 0 {
		t.Errorf("logged play chime failed: %v", failures)
	}
}

func TestWhenNoPlayerWorksTheReasonGoesToTheLog(t *testing.T) {
	t.Parallel()

	absent := missing(t)
	commands, env, dir := players(t, "fail")
	f := newFixture(t, append([]chime.Command{absent}, commands...), env, dir, nil)

	f.player.Ring()

	rec := f.waitLogged(t, "play chime failed")
	if rec["level"] != "WARN" {
		t.Errorf("level = %v, want WARN", rec["level"])
	}
	reason, _ := rec["err"].(string)
	for _, want := range []string{absent.Binary, "no audio sink"} {
		if !strings.Contains(reason, want) {
			t.Errorf("err = %q, want it to contain %q", reason, want)
		}
	}
}

func TestDoNotDisturbSilencesTheChime(t *testing.T) {
	t.Parallel()

	commands, env, dir := players(t, "play")
	f := newFixture(t, commands, env, dir, func(context.Context) bool { return true })

	f.player.Ring()

	rec := f.waitLogged(t, "chime silenced")
	if rec["level"] != "INFO" {
		t.Errorf("level = %v, want INFO", rec["level"])
	}
	f.wantCalls(t)
}

func TestTheDoNotDisturbCheckHasADeadlineOfItsOwn(t *testing.T) {
	t.Parallel()

	type deadline struct {
		remaining time.Duration
		set       bool
	}
	checked := make(chan deadline, 1)
	quiet := func(ctx context.Context) bool {
		at, set := ctx.Deadline()
		checked <- deadline{remaining: time.Until(at), set: set}
		<-ctx.Done()
		return false
	}
	commands, env, dir := players(t, "play")
	f := newFixture(t, commands, env, dir, quiet)

	f.player.Ring()

	f.waitCalls(t, f.call("play"))
	got := <-checked
	if !got.set {
		t.Fatal("the do-not-disturb check has no deadline")
	}
	if got.remaining <= 0 || got.remaining > 500*time.Millisecond {
		t.Errorf("the do-not-disturb check had %v, want more than 0 and at most 500ms", got.remaining)
	}
}

// Not parallel: it proves that a second run never happens, which takes time
// passing.
func TestARingWhileTheChimePlaysIsDropped(t *testing.T) {
	commands, env, dir := players(t, "hang")
	f := newFixture(t, commands, env, dir, nil)

	f.player.Ring()
	f.waitCalls(t, f.call("hang"))
	f.player.Ring()
	time.Sleep(200 * time.Millisecond)

	f.wantCalls(t, f.call("hang"))
	if len(f.logged(t, "chime dropped")) == 0 {
		t.Errorf("no chime dropped in the log:\n%s", f.logs.String())
	}
}

func TestCloseCutsOffAChimeStillPlaying(t *testing.T) {
	t.Parallel()

	commands, env, dir := players(t, "hang")
	f := newFixture(t, commands, env, dir, nil)

	f.player.Ring()
	pid := f.waitPid(t)

	closed := make(chan struct{})
	go func() {
		f.player.Close()
		close(closed)
	}()
	select {
	case <-closed:
	case <-time.After(pollTimeout):
		t.Fatal("Close did not return while the chime played")
	}

	if err := syscall.Kill(pid, 0); !errors.Is(err, syscall.ESRCH) {
		t.Errorf("Kill(%d, 0) = %v, want ESRCH: the player outlived Close", pid, err)
	}
	f.player.Ring()
	if got := f.recorded(t); !slices.Equal(got, []string{f.call("hang")}) {
		t.Errorf("a ring after Close ran a player: %v", got)
	}
	f.player.Close()
}
