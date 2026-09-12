package dnd_test

import (
	"context"
	"os/exec"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/platform/dnd"
)

// answerTimeout is how long the tests give the daemons to answer, and
// answerBound how long On may take at most once that runs out.
const (
	answerTimeout = 100 * time.Millisecond
	answerBound   = 2 * time.Second
)

func TestOnReportsWhatTheDaemonsSay(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		shell   string // the behaviour of the fake shell; empty: not installed
		replies map[string]reply
		want    bool
	}{
		{name: "omarchy shell on", shell: "on", want: true},
		{name: "omarchy shell off, no other daemon", shell: "off", want: false},
		{name: "KDE Plasma inhibited", replies: map[string]reply{kdeKey: {value: true}}, want: true},
		{name: "dunst paused", replies: map[string]reply{dunstKey: {value: true}}, want: true},
		{name: "swaync in do-not-disturb", replies: map[string]reply{swayncKey: {body: []any{true}}}, want: true},
		{
			name:  "every daemon off",
			shell: "off",
			replies: map[string]reply{
				kdeKey:    {value: false},
				dunstKey:  {value: false},
				swayncKey: {body: []any{false}},
			},
			want: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			detector := newDetector(t, tt.shell, &fakeBus{replies: tt.replies})
			if got := detector.On(t.Context()); got != tt.want {
				t.Errorf("On() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestADaemonThatIsMissingOrMisbehavesSaysNothing(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		shell   string // the behaviour of the fake shell; empty: not installed
		replies map[string]reply
		want    bool
	}{
		{name: "omarchy shell not installed"},
		{name: "omarchy shell fails", shell: "fail"},
		{name: "omarchy shell answers garbage", shell: "garbled"},
		{name: "KDE Plasma answers a number", replies: map[string]reply{kdeKey: {value: uint32(1)}}},
		{name: "dunst not running", replies: map[string]reply{dunstKey: {err: errServiceUnknown}}},
		{name: "swaync answers nothing", replies: map[string]reply{swayncKey: {body: []any{}}}},
		{name: "swaync answers a string", replies: map[string]reply{swayncKey: {body: []any{"on"}}}},
		{
			name:    "a later daemon still counts",
			shell:   "fail",
			replies: map[string]reply{swayncKey: {body: []any{true}}},
			want:    true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			detector := newDetector(t, tt.shell, &fakeBus{replies: tt.replies})
			if got := detector.On(t.Context()); got != tt.want {
				t.Errorf("On() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestTheFirstDaemonThatSaysOnEndsTheQuestion(t *testing.T) {
	t.Parallel()

	bus := &fakeBus{replies: map[string]reply{
		kdeKey:    {value: true},
		dunstKey:  {value: true},
		swayncKey: {body: []any{true}},
	}}
	detector := newDetector(t, "on", bus)

	if !detector.On(t.Context()) {
		t.Error("On() = false, want true")
	}
	if got := bus.recorded(); len(got) > 0 {
		t.Errorf("the bus was read after the shell said on: %v", got)
	}
}

func TestADaemonThatDoesNotAnswerInTimeSaysNothing(t *testing.T) {
	t.Parallel()

	t.Run("omarchy shell hangs", func(t *testing.T) {
		t.Parallel()

		bus := &fakeBus{replies: map[string]reply{swayncKey: {body: []any{true}}}}
		detector := newDetector(t, "hang", bus)
		ctx, cancel := context.WithTimeout(t.Context(), answerTimeout)
		defer cancel()

		start := time.Now()
		if detector.On(ctx) {
			t.Error("On() = true, want false")
		}
		if took := time.Since(start); took > answerBound {
			t.Errorf("On() took %v, want at most %v", took, answerBound)
		}
		if got := bus.recorded(); len(got) > 0 {
			t.Errorf("the bus was read after the time ran out: %v", got)
		}
	})

	t.Run("KDE Plasma does not answer", func(t *testing.T) {
		t.Parallel()

		bus := &fakeBus{replies: map[string]reply{kdeKey: {block: true}}}
		detector := newDetector(t, "", bus)
		ctx, cancel := context.WithTimeout(t.Context(), answerTimeout)
		defer cancel()

		if detector.On(ctx) {
			t.Error("On() = true, want false")
		}
		if diff := cmp.Diff([]string{kdeKey}, bus.recorded()); diff != "" {
			t.Errorf("bus reads mismatch (-want +got):\n%s", diff)
		}
	})
}

func TestWithoutABusOnlyTheShellIsAsked(t *testing.T) {
	t.Parallel()

	for _, tt := range []struct {
		shell string
		want  bool
	}{
		{shell: "on", want: true},
		{shell: "off", want: false},
	} {
		t.Run(tt.shell, func(t *testing.T) {
			t.Parallel()

			detector := newDetector(t, tt.shell, nil)
			if got := detector.On(t.Context()); got != tt.want {
				t.Errorf("On() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestWithoutOmarchyShellOnPathTheShellSaysNothing(t *testing.T) {
	if _, err := exec.LookPath("omarchy-shell"); err == nil {
		t.Skip("omarchy-shell is on PATH; the answer depends on this machine")
	}
	t.Parallel()

	if dnd.New(dnd.Deps{}).On(t.Context()) {
		t.Error("On() = true, want false")
	}
}
