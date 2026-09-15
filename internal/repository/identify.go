package repository

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"time"

	"github.com/guilhermt/myspec/internal/git"
)

// identifyTimeout bounds reading the origin of a clone, which is local work.
const identifyTimeout = 10 * time.Second

// Identifier tells which GitHub repository a folder is a clone of.
type Identifier struct{ git *git.Runner }

// NewIdentifier builds an Identifier that asks git.
func NewIdentifier(runner *git.Runner) Identifier { return Identifier{git: runner} }

// Identify reads the identity of the clone at path. A path that is not a
// directory refuses as clone_missing, one without a .git directory as
// not_git_root, one without origin as no_origin, and an origin outside GitHub
// as not_github; every refusal is a *Refusal. Any other failure of git comes
// back as git said it.
func (i Identifier) Identify(ctx context.Context, path string) (Identity, error) {
	path = filepath.Clean(path)

	info, err := os.Stat(path)
	if err != nil || !info.IsDir() {
		return Identity{}, &Refusal{Reason: ReasonCloneMissing, Path: path}
	}
	if !IsClone(path) {
		return Identity{}, &Refusal{Reason: ReasonNotGitRoot, Path: path}
	}

	ctx, cancel := context.WithTimeout(ctx, identifyTimeout)
	defer cancel()

	url, err := i.git.RemoteURL(ctx, path, "origin")
	if errors.Is(err, git.ErrNoRemote) {
		return Identity{}, &Refusal{Reason: ReasonNoOrigin, Path: path}
	}
	if err != nil {
		return Identity{}, err
	}

	identity, ok := ParseRemote(url)
	if !ok {
		return Identity{}, &Refusal{Reason: ReasonNotGitHub, Path: path, URL: url}
	}
	return identity, nil
}
