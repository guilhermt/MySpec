package bindings

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/prompts"
	"github.com/guilhermt/myspec/internal/reviewmode"
	"github.com/guilhermt/myspec/internal/store"
	"github.com/guilhermt/myspec/internal/theme"
)

// machineTimeout is how long the check of the machine waits for gh.
const machineTimeout = 5 * time.Second

// GHLogin tells whether gh is installed and holds a login.
type GHLogin interface {
	SignedIn(ctx context.Context) error
}

// SettingsService is the settings API the frontend calls.
type SettingsService struct {
	theme       *theme.Service
	defaults    *models.Service
	reviewModes *reviewmode.Service
	login       GHLogin
	dataDir     string
	log         *slog.Logger
}

// NewSettingsService builds the service over the theme domain, the model and
// review mode defaults of the app, the login of gh and the prompts of the data
// directory.
func NewSettingsService(
	t *theme.Service,
	defaults *models.Service,
	reviewModes *reviewmode.Service,
	login GHLogin,
	dataDir string,
	log *slog.Logger,
) *SettingsService {
	return &SettingsService{
		theme:       t,
		defaults:    defaults,
		reviewModes: reviewModes,
		login:       login,
		dataDir:     dataDir,
		log:         log,
	}
}

// SetTheme stores the theme preference: system, light or dark.
func (s *SettingsService) SetTheme(preference string) error {
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
	listed, err := prompts.List(s.dataDir)
	if err != nil {
		return nil, s.fail("ListPrompts", err)
	}
	return FromListed(listed), nil
}

// CheckMachine looks at what the app needs of the machine: the claude CLI, from
// the reading of the catalog of this run, and gh with a login. What it can't
// tell is unknown.
func (s *SettingsService) CheckMachine() Machine {
	machine := Machine{Claude: "unknown", GH: "unknown"}

	if done, failure := s.defaults.Discovery(); done {
		switch failure {
		case "", models.CatalogUnsupported:
			machine.Claude = "found"
		case models.CatalogNotFound:
			machine.Claude = "not_found"
		case models.CatalogFailed:
			// A reading that failed for another reason says nothing of the CLI.
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), machineTimeout)
	defer cancel()

	switch err := s.login.SignedIn(ctx); {
	case err == nil:
		machine.GH = "ready"
	case errors.Is(err, gh.ErrNotFound):
		machine.GH = "not_installed"
	case errors.Is(err, gh.ErrNotAuthenticated):
		machine.GH = "signed_out"
	default:
		s.log.Warn("machine check failed", "error", err)
	}
	return machine
}

// GetPrompt reads a prompt as the settings show it.
func (s *SettingsService) GetPrompt(stage string) (Prompt, error) {
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
