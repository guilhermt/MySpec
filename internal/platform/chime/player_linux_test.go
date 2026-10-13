package chime_test

import (
	"errors"
	"slices"
	"syscall"
	"testing"
	"time"
)

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
