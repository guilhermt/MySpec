package toast

import (
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestToastXML(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		id    uint32
		title string
		body  string
		want  string
	}{
		{
			name:  "a step ready for review",
			id:    7,
			title: "add-login",
			body:  "Step 4 is ready for your review. 7 files changed.",
			want:  `<toast launch="7"><visual><binding template="ToastGeneric"><text>add-login</text><text>Step 4 is ready for your review. 7 files changed.</text></binding></visual><audio silent="true"></audio></toast>`,
		},
		{
			name:  "markup in the texts is escaped",
			id:    4294967295,
			title: `a <b> & "c"`,
			body:  "x < y",
			want:  `<toast launch="4294967295"><visual><binding template="ToastGeneric"><text>a &lt;b&gt; &amp; &#34;c&#34;</text><text>x &lt; y</text></binding></visual><audio silent="true"></audio></toast>`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := toastXML(tt.id, tt.title, tt.body)
			if err != nil {
				t.Fatalf("toastXML() = %v, want nil", err)
			}
			if diff := cmp.Diff(tt.want, got); diff != "" {
				t.Errorf("toastXML() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestParseLaunch(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		args   string
		wantID uint32
		wantOK bool
	}{
		{name: "an id", args: "7", wantID: 7, wantOK: true},
		{name: "the largest id", args: "4294967295", wantID: 4294967295, wantOK: true},
		{name: "past the largest id", args: "4294967296"},
		{name: "negative", args: "-1"},
		{name: "empty", args: ""},
		{name: "not a number", args: "myspec"},
		{name: "with a space", args: " 7"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			id, ok := parseLaunch(tt.args)
			if id != tt.wantID || ok != tt.wantOK {
				t.Errorf("parseLaunch(%q) = %d, %v, want %d, %v", tt.args, id, ok, tt.wantID, tt.wantOK)
			}
		})
	}
}

func TestConditionsAndSilenced(t *testing.T) {
	t.Parallel()

	on := Conditions{Mode: ModeUnrestricted, Banner: true, AppSound: true, Sounds: true}
	tests := []struct {
		name         string
		reading      reading
		mode         Mode
		want         Conditions
		wantSilenced bool
	}{
		{name: "nothing in the registry", mode: ModeUnrestricted, want: on},
		{
			name:    "everything on",
			reading: reading{showBanner: 1, hasShowBanner: true, soundFile: "ms-winsoundevent:Notification.Default", hasSoundFile: true, allowSound: 1, hasAllowSound: true},
			mode:    ModeUnrestricted,
			want:    on,
		},
		{
			name:         "banners off",
			reading:      reading{hasShowBanner: true},
			mode:         ModeUnrestricted,
			want:         Conditions{Mode: ModeUnrestricted, Banner: false, AppSound: true, Sounds: true},
			wantSilenced: true,
		},
		{
			name:         "sound of the app off",
			reading:      reading{hasSoundFile: true},
			mode:         ModeUnrestricted,
			want:         Conditions{Mode: ModeUnrestricted, Banner: true, AppSound: false, Sounds: true},
			wantSilenced: true,
		},
		{
			name:         "every sound off",
			reading:      reading{hasAllowSound: true},
			mode:         ModeUnrestricted,
			want:         Conditions{Mode: ModeUnrestricted, Banner: true, AppSound: true, Sounds: false},
			wantSilenced: true,
		},
		{
			name:         "priority only",
			mode:         ModePriorityOnly,
			want:         Conditions{Mode: ModePriorityOnly, Banner: true, AppSound: true, Sounds: true},
			wantSilenced: true,
		},
		{
			name:         "alarms only",
			mode:         ModeAlarmsOnly,
			want:         Conditions{Mode: ModeAlarmsOnly, Banner: true, AppSound: true, Sounds: true},
			wantSilenced: true,
		},
		{
			name: "a mode Windows does not report",
			mode: ModeUnknown,
			want: Conditions{Mode: ModeUnknown, Banner: true, AppSound: true, Sounds: true},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := tt.reading.conditions(tt.mode)
			if diff := cmp.Diff(tt.want, got); diff != "" {
				t.Errorf("conditions(%v) mismatch (-want +got):\n%s", tt.mode, diff)
			}
			if got.Silenced() != tt.wantSilenced {
				t.Errorf("Silenced() = %v, want %v", got.Silenced(), tt.wantSilenced)
			}
		})
	}
}

// The group is what a withdrawn toast is looked up by: renaming it would leave
// the toasts of an earlier run in the notification center.
func TestGroupIsStable(t *testing.T) {
	t.Parallel()

	if group != "myspec" {
		t.Errorf("group = %q, want %q", group, "myspec")
	}
}
