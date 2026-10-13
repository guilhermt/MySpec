package toast

import (
	"errors"
	"fmt"
	"log/slog"

	"golang.org/x/sys/windows/registry"
)

// appKeyRoot is where the notification platform finds who an AppUserModelID is.
const appKeyRoot = `Software\Classes\AppUserModelId\`

// The keys and values where Windows keeps the notification settings of the
// user and of each app.
const (
	settingsKey     = `Software\Microsoft\Windows\CurrentVersion\Notifications\Settings`
	showBannerValue = "ShowBanner"
	soundFileValue  = "SoundFile"
	allowSoundValue = "NOC_GLOBAL_SETTING_ALLOW_NOTIFICATION_SOUND"
)

// register writes who the app is to the notification platform: its name, its
// icon and the class that hears the clicks on its toasts. It writes on every
// start, which also repairs a key someone changed.
func register(appID, displayName, iconPath string) error {
	key, _, err := registry.CreateKey(registry.CURRENT_USER, appKeyRoot+appID, registry.SET_VALUE)
	if err != nil {
		return fmt.Errorf("create key %s: %w", appKeyRoot+appID, err)
	}
	defer key.Close()

	if err := key.SetStringValue("DisplayName", displayName); err != nil {
		return fmt.Errorf("set DisplayName: %w", err)
	}
	if err := key.SetStringValue("CustomActivator", activatorCLSID); err != nil {
		return fmt.Errorf("set CustomActivator: %w", err)
	}
	if iconPath == "" {
		if err := key.DeleteValue("IconUri"); err != nil && !errors.Is(err, registry.ErrNotExist) {
			return fmt.Errorf("delete IconUri: %w", err)
		}
		return nil
	}
	if err := key.SetStringValue("IconUri", iconPath); err != nil {
		return fmt.Errorf("set IconUri: %w", err)
	}
	return nil
}

// readSettings reads what the registry holds about the toasts of the app. A
// value it cannot read counts as absent, which means on.
func readSettings(appID string, log *slog.Logger) reading {
	var r reading

	if key, ok := openSettings(settingsKey+`\`+appID, log); ok {
		r.showBanner, r.hasShowBanner = integerValue(key, showBannerValue, log)
		r.soundFile, r.hasSoundFile = stringValue(key, soundFileValue, log)
		key.Close()
	}
	if key, ok := openSettings(settingsKey, log); ok {
		r.allowSound, r.hasAllowSound = integerValue(key, allowSoundValue, log)
		key.Close()
	}
	return r
}

func openSettings(path string, log *slog.Logger) (registry.Key, bool) {
	key, err := registry.OpenKey(registry.CURRENT_USER, path, registry.QUERY_VALUE)
	if err != nil {
		logUnknown(log, path, err)
		return 0, false
	}
	return key, true
}

func integerValue(key registry.Key, name string, log *slog.Logger) (uint64, bool) {
	v, _, err := key.GetIntegerValue(name)
	if err != nil {
		logUnknown(log, name, err)
		return 0, false
	}
	return v, true
}

func stringValue(key registry.Key, name string, log *slog.Logger) (string, bool) {
	v, _, err := key.GetStringValue(name)
	if err != nil {
		logUnknown(log, name, err)
		return "", false
	}
	return v, true
}

// logUnknown logs a setting that is there but cannot be read; one that is not
// there is the default and says nothing.
func logUnknown(log *slog.Logger, name string, err error) {
	if errors.Is(err, registry.ErrNotExist) {
		return
	}
	log.Debug("notification setting unknown", "value", name, "err", err)
}
