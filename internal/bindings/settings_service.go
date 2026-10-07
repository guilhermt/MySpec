package bindings

import (
	"context"
	"errors"
	"log/slog"

	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/reviewmode"
	"github.com/guilhermt/myspec/internal/store"
	"github.com/guilhermt/myspec/internal/theme"
)

// SettingsService is the settings API the frontend calls.
type SettingsService struct {
	late         late[SettingsService]
	theme        *theme.Service
	defaults     *models.Service
	reviewModes  *reviewmode.Service
	checkMachine func() Machine
	dataDir      string
	log          *slog.Logger
}

// NewSettingsService builds the service over the theme domain, the model and
// review mode defaults of the app, the check of the machine and the prompts of
// the data directory.
func NewSettingsService(
	t *theme.Service,
	defaults *models.Service,
	reviewModes *reviewmode.Service,
	checkMachine func() Machine,
	dataDir string,
	log *slog.Logger,
) *SettingsService {
	return &SettingsService{
		theme:        t,
		defaults:     defaults,
		reviewModes:  reviewModes,
		checkMachine: checkMachine,
		dataDir:      dataDir,
		log:          log,
	}
}

// SetTheme stores the theme preference: system, light or dark.
func (s *SettingsService) SetTheme(preference string) error {
	s, err := s.late.resolve(s)
	if err != nil {
		return err
	}
	pref, err := theme.ParsePreference(preference)
	if err != nil {
		s.log.Error("binding failed", "method", "SetTheme", "err", err)
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.theme.SetPreference(ctx, pref); err != nil {
		s.log.Error("binding failed", "method", "SetTheme", "err", err)
		return err
	}
	return nil
}

// SetModelDefault stores the model and effort new tasks start a stage with.
func (s *SettingsService) SetModelDefault(stage, model, effort string) error {
	s, err := s.late.resolve(s)
	if err != nil {
		return err
	}
	target, err := models.ParseStage(stage)
	if err != nil {
		return s.fail("SetModelDefault", err)
	}
	c, err := models.ParseChoice(model, effort)
	if err != nil {
		return s.fail("SetModelDefault", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.defaults.SetDefault(ctx, target, c); err != nil {
		return s.failSetting("SetModelDefault", err)
	}
	return nil
}

// SetReviewModeDefault stores who reviews the steps of the tasks created from
// now on: manual or agent.
func (s *SettingsService) SetReviewModeDefault(mode string) error {
	s, err := s.late.resolve(s)
	if err != nil {
		return err
	}
	target, err := reviewmode.ParseMode(mode)
	if err != nil {
		return s.fail("SetReviewModeDefault", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.reviewModes.SetDefault(ctx, target); err != nil {
		return s.failSetting("SetReviewModeDefault", err)
	}
	return nil
}

// ListPrompts says which prompts the user edited and when, without their text.
func (s *SettingsService) ListPrompts() ([]PromptListing, error) {
	s, err := s.late.resolve(s)
	if err != nil {
		return nil, err
	}
	listed, err := prompts.List(s.dataDir)
	if err != nil {
		return nil, s.fail("ListPrompts", err)
	}
	return FromListed(listed), nil
}

// CheckMachine checks the machine again, or waits for the check that runs,
// and returns where the check stands after it; the state carries the same
// with state:changed.
func (s *SettingsService) CheckMachine() (Machine, error) {
	s, err := s.late.resolve(s)
	if err != nil {
		return Machine{}, err
	}
	return s.checkMachine(), nil
}

// GetPrompt reads a prompt as the settings show it.
func (s *SettingsService) GetPrompt(stage string) (Prompt, error) {
	s, err := s.late.resolve(s)
	if err != nil {
		return Prompt{}, err
	}
	target, err := prompts.ParseStage(stage)
	if err != nil {
		return Prompt{}, s.fail("GetPrompt", err)
	}

	prompt, err := prompts.Read(s.dataDir, target)
	if err != nil {
		return Prompt{}, s.fail("GetPrompt", err)
	}
	return FromPrompt(prompt), nil
}

// SavePrompt stores the text of a prompt. The text of the default is no edit:
// the prompt follows the default again.
func (s *SettingsService) SavePrompt(stage, text string) (Prompt, error) {
	s, err := s.late.resolve(s)
	if err != nil {
		return Prompt{}, err
	}
	target, err := prompts.ParseStage(stage)
	if err != nil {
		return Prompt{}, s.fail("SavePrompt", err)
	}

	saved, err := prompts.Save(s.dataDir, target, text)
	if err != nil {
		return Prompt{}, s.fail("SavePrompt", err)
	}
	s.log.Info("prompt saved", "stage", stage, "modified", saved.Modified)
	return FromPrompt(saved), nil
}

// RestorePrompt throws the edit of a prompt away, so that it follows the
// default of the app again.
func (s *SettingsService) RestorePrompt(stage string) (Prompt, error) {
	s, err := s.late.resolve(s)
	if err != nil {
		return Prompt{}, err
	}
	target, err := prompts.ParseStage(stage)
	if err != nil {
		return Prompt{}, s.fail("RestorePrompt", err)
	}

	restored, err := prompts.Restore(s.dataDir, target)
	if err != nil {
		return Prompt{}, s.fail("RestorePrompt", err)
	}
	s.log.Info("prompt restored", "stage", stage)
	return FromPrompt(restored), nil
}

// failSetting is fail for the setters of a default, which write to the database:
// a full disk says so, and where.
func (s *SettingsService) failSetting(method string, err error) error {
	if store.DiskFull(err) {
		_ = s.fail(method, err) // only the log: the user gets the sentence below
		return errors.New("no space left on the disk of " + homeTilde(s.dataDir) + ". Free some space, then try again.")
	}
	return s.fail(method, err)
}

func (s *SettingsService) fail(method string, err error) error { return failure(s.log, method, err) }
