package machine

import (
	"context"
	"errors"
	"slices"
	"strings"
	"sync"

	"github.com/guilhermt/myspec/internal/claude"
	"github.com/guilhermt/myspec/internal/gh"
)

// check runs both chains at once and puts their items in order.
func (s *Service) check(ctx context.Context) Report {
	var (
		wg              sync.WaitGroup
		claudeItems     [3]Item
		ghItems         [3]Item
		path, version   string
		account         string
		scopes, missing []string
	)
	wg.Add(2)
	go func() {
		defer wg.Done()
		claudeItems, path, version = s.checkClaude(ctx)
	}()
	go func() {
		defer wg.Done()
		ghItems, account, scopes, missing = s.checkGitHub(ctx)
	}()
	wg.Wait()

	items := make([]Item, 0, len(Order))
	items = append(items, claudeItems[:]...)
	items = append(items, ghItems[:]...)
	r := Report{
		Items:         items,
		ClaudePath:    path,
		ClaudeVersion: version,
		GHAccount:     account,
		GHScopes:      scopes,
		MissingScopes: missing,
	}
	s.logReport(r)
	return r
}

// checkClaude is the chain of Claude Code: found, then logged in and its version.
func (s *Service) checkClaude(ctx context.Context) (items [3]Item, path, version string) {
	items = [3]Item{{ID: ClaudeFound}, {ID: ClaudeLogin}, {ID: ClaudeVersion}}

	found, err := s.claude.Locate()
	switch {
	case errors.Is(err, claude.ErrNotFound):
		items[0].Result = Missing
	case err != nil:
		items[0] = unchecked(ClaudeFound, ReasonFailed, err)
	default:
		items[0].Result = OK
	}
	if items[0].Result != OK {
		items[1] = dependent(ClaudeLogin)
		items[2] = dependent(ClaudeVersion)
		return items, "", ""
	}
	path = found

	timedOut, err := s.command(ctx, func(ctx context.Context) error {
		return s.claude.Preflight(ctx, path)
	})
	switch {
	case err == nil:
		items[1].Result = OK
	case errors.Is(err, claude.ErrNotLoggedIn):
		items[1].Result = Missing
	case timedOut:
		items[1] = unchecked(ClaudeLogin, ReasonTimeout, nil)
	default:
		items[1] = unchecked(ClaudeLogin, ReasonFailed, err)
	}

	var v claude.Version
	timedOut, err = s.command(ctx, func(ctx context.Context) error {
		var readErr error
		v, readErr = s.claude.ReadVersion(ctx, path)
		return readErr
	})
	switch {
	case err == nil:
		version = v.String()
		if v.Less(minVersion) {
			items[2].Result = Missing
		} else {
			items[2].Result = OK
		}
	case errors.Is(err, claude.ErrVersionUnreadable):
		items[2] = unchecked(ClaudeVersion, ReasonUnreadable, err)
	case timedOut:
		items[2] = unchecked(ClaudeVersion, ReasonTimeout, nil)
	default:
		items[2] = unchecked(ClaudeVersion, ReasonFailed, err)
	}
	return items, path, version
}

// checkGitHub is the chain of gh: found and signed in, then the account and its scopes.
func (s *Service) checkGitHub(ctx context.Context) (items [3]Item, account string, scopes, missing []string) {
	items = [3]Item{{ID: GHFound}, {ID: GHLogin}, {ID: GHScopes}}

	timedOut, err := s.command(ctx, s.github.SignedIn)
	if errors.Is(err, gh.ErrNotFound) {
		items[0].Result = Missing
		items[1] = dependent(GHLogin)
		items[2] = dependent(GHScopes)
		return items, "", nil, nil
	}
	// The binary ran, whatever it answered.
	items[0].Result = OK
	items[2] = dependent(GHScopes)
	switch {
	case err == nil:
		items[1].Result = OK
	case errors.Is(err, gh.ErrNotAuthenticated):
		items[1].Result = Missing
		return items, "", nil, nil
	case timedOut:
		items[1] = unchecked(GHLogin, ReasonTimeout, nil)
		return items, "", nil, nil
	default:
		items[1] = unchecked(GHLogin, ReasonFailed, err)
		return items, "", nil, nil
	}

	var a gh.Account
	timedOut, err = s.command(ctx, func(ctx context.Context) error {
		var accountErr error
		a, accountErr = s.github.Account(ctx)
		return accountErr
	})
	switch {
	case err == nil:
		account, scopes = a.Login, a.Scopes
		if a.Scopes == nil {
			items[2] = unchecked(GHScopes, ReasonNoScopes, nil)
			break
		}
		for _, scope := range RequiredScopes {
			if !slices.Contains(a.Scopes, scope) {
				missing = append(missing, scope)
			}
		}
		items[2] = Item{ID: GHScopes, Result: OK}
		if len(missing) > 0 {
			items[2].Result = Missing
		}
	case errors.Is(err, gh.ErrNotAuthenticated):
		items[1] = Item{ID: GHLogin, Result: Missing, Reason: ReasonInvalidToken, Detail: err.Error()}
	case timedOut:
		items[2] = unchecked(GHScopes, ReasonTimeout, nil)
	default:
		items[2] = unchecked(GHScopes, ReasonFailed, err)
	}
	return items, account, scopes, missing
}

// command runs f with the timeout of one command and tells a timeout apart
// from any other failure.
func (s *Service) command(ctx context.Context, f func(ctx context.Context) error) (timedOut bool, err error) {
	cmdCtx, cancel := context.WithTimeout(ctx, s.timeout)
	defer cancel()

	err = f(cmdCtx)
	timedOut = err != nil && errors.Is(cmdCtx.Err(), context.DeadlineExceeded) && ctx.Err() == nil
	return timedOut, err
}

// unchecked is an item the app could not tell, with the text of err as detail.
func unchecked(id ItemID, reason Reason, err error) Item {
	item := Item{ID: id, Result: Unchecked, Reason: reason}
	if err != nil {
		item.Detail = err.Error()
	}
	return item
}

// dependent is an item left unchecked by one it depends on.
func dependent(id ItemID) Item {
	return Item{ID: id, Result: Unchecked, Reason: ReasonDepends}
}

// logReport writes a line for each item with a detail and one for the check.
func (s *Service) logReport(r Report) {
	var missing, undecided []string
	for _, item := range r.Items {
		switch item.Result {
		case Missing:
			missing = append(missing, string(item.ID))
		case OK:
		case Unchecked:
			undecided = append(undecided, string(item.ID)+":"+string(item.Reason))
		}
		if item.Detail == "" {
			continue
		}
		if item.Result == Missing {
			s.log.Warn("machine item missing", "item", item.ID, "reason", item.Reason, "error", item.Detail)
		} else {
			s.log.Warn("machine item unchecked", "item", item.ID, "reason", item.Reason, "error", item.Detail)
		}
	}
	s.log.Info("machine checked",
		"claude_path", r.ClaudePath,
		"claude_version", r.ClaudeVersion,
		"claude_min_version", claude.MinVersion,
		"gh_account", r.GHAccount,
		"gh_scopes", strings.Join(r.GHScopes, ","),
		"missing", strings.Join(missing, ","),
		"unchecked", strings.Join(undecided, ","),
	)
}
