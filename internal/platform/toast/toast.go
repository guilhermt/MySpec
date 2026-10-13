// Package toast shows the notifications of the app as Windows toasts: it
// registers who the app is to the notification platform, shows and withdraws
// toasts, hears the clicks on them and tells whether Windows would show a
// banner with sound. It knows nothing of the product; notify decides what to
// send and when.
package toast

import (
	"encoding/xml"
	"fmt"
	"strconv"
)

// group is the group every toast of the app carries; with its tag, the id the
// notifier knows it by, it names one toast to withdraw.
const group = "myspec"

// Mode is the notification mode of Windows: whether do-not-disturb, by hand or
// by an automatic rule, holds the banners back.
type Mode int

// The notification modes, as ToastNotificationMode numbers them, and
// ModeUnknown where Windows has no mode to read.
const (
	ModeUnrestricted Mode = 0
	ModePriorityOnly Mode = 1
	ModeAlarmsOnly   Mode = 2
	ModeUnknown      Mode = -1
)

// Conditions is what Windows says about the toasts of the app at one moment.
type Conditions struct {
	Mode     Mode
	Banner   bool // the banners of the app are on
	AppSound bool // the app may play a sound with its notifications
	Sounds   bool // notifications may play sounds at all
}

// Silenced reports whether the chime stays quiet: Windows would show no
// banner, or would show it without sound. Any do-not-disturb silences it,
// the priority list included, which Windows does not let the app read. A mode
// Windows does not report leaves the chime to ring.
func (c Conditions) Silenced() bool {
	if !c.Banner || !c.AppSound || !c.Sounds {
		return true
	}
	return c.Mode == ModePriorityOnly || c.Mode == ModeAlarmsOnly
}

// reading is what the registry holds about the toasts of the app. A value
// that is not there reads as its default, which is on.
type reading struct {
	showBanner    uint64 // ShowBanner of the app; 0 turns its banners off
	hasShowBanner bool
	soundFile     string // SoundFile of the app; empty turns its sound off
	hasSoundFile  bool
	allowSound    uint64 // NOC_GLOBAL_SETTING_ALLOW_NOTIFICATION_SOUND; 0 turns every sound off
	hasAllowSound bool
}

// conditions are the conditions the reading and the mode make.
func (r reading) conditions(mode Mode) Conditions {
	return Conditions{
		Mode:     mode,
		Banner:   !r.hasShowBanner || r.showBanner != 0,
		AppSound: !r.hasSoundFile || r.soundFile != "",
		Sounds:   !r.hasAllowSound || r.allowSound != 0,
	}
}

// toastDoc is a toast clickable as a whole, with a title, a body and no sound
// of its own: the app rings its chime, and no button. Its launch is the id
// the click comes back with.
type toastDoc struct {
	XMLName xml.Name    `xml:"toast"`
	Launch  string      `xml:"launch,attr"`
	Visual  toastVisual `xml:"visual"`
	Audio   toastAudio  `xml:"audio"`
}

type toastVisual struct {
	Binding toastBinding `xml:"binding"`
}

type toastBinding struct {
	Template string   `xml:"template,attr"`
	Texts    []string `xml:"text"`
}

type toastAudio struct {
	Silent string `xml:"silent,attr"`
}

// toastXML is the toast of a notification the notifier knows by id.
func toastXML(id uint32, title, body string) (string, error) {
	doc := toastDoc{
		Launch: strconv.FormatUint(uint64(id), 10),
		Visual: toastVisual{Binding: toastBinding{Template: "ToastGeneric", Texts: []string{title, body}}},
		Audio:  toastAudio{Silent: "true"},
	}
	out, err := xml.Marshal(doc)
	if err != nil {
		return "", fmt.Errorf("toast xml: %w", err)
	}
	return string(out), nil
}

// parseLaunch reads the id a clicked toast carries back in its launch
// argument. Anything else is not a toast of the app.
func parseLaunch(args string) (uint32, bool) {
	id, err := strconv.ParseUint(args, 10, 32)
	if err != nil {
		return 0, false
	}
	return uint32(id), true
}
