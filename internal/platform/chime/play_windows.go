package chime

import (
	"context"
	"errors"
	"fmt"
	"unsafe"

	"golang.org/x/sys/windows"
)

// The flags of PlaySoundW: the sound is a file, played without waiting for
// it, and a file that cannot be played plays nothing rather than the default
// sound of Windows.
const (
	sndAsync     = 0x0001
	sndNoDefault = 0x0002
	sndFilename  = 0x00020000
)

var playSound = windows.NewLazySystemDLL("winmm.dll").NewProc("PlaySoundW")

// play plays the chime through Windows, on the default output at the volume
// of the system. PlaySoundW returns as soon as the sound starts, and a new
// sound replaces one still playing, so the chime never overlaps itself.
func (p *Player) play(ctx context.Context) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	path, err := windows.UTF16PtrFromString(p.path)
	if err != nil {
		return fmt.Errorf("PlaySound %s: %w", p.path, err)
	}

	ok, _, lastErr := playSound.Call(uintptr(unsafe.Pointer(path)), 0, sndFilename|sndAsync|sndNoDefault)
	if ok == 0 {
		if lastErr == nil {
			lastErr = errors.New("PlaySound failed")
		}
		return fmt.Errorf("PlaySound %s: %w", p.path, lastErr)
	}
	p.log.Debug("chime played", "player", "PlaySound")
	return nil
}

// stop cuts off a chime still playing.
func (p *Player) stop() {
	_, _, _ = playSound.Call(0, 0, 0)
}
