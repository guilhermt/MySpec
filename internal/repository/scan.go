package repository

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
)

// ScanDepth is how many folders below the scan root the scan descends.
const ScanDepth = 6

// scanWorkers is how many clones are identified at once.
const scanWorkers = 8

// skippedFolder is the one folder name the scan skips besides the hidden ones.
const skippedFolder = "node_modules"

// Candidate is a clone of a GitHub repository the scan found under the root,
// and whether its repository is already registered, at this path or another.
type Candidate struct {
	Identity   Identity
	Path       string
	Registered bool
}

// Scan finds the clones of GitHub repositories under the scan root, by
// owner/name ignoring case, then by path. It fails only when the root itself
// cannot be read.
func (s *Service) Scan(ctx context.Context) ([]Candidate, error) {
	roots, err := s.collectRoots(ctx)
	if err != nil {
		return nil, err
	}
	candidates := s.identifyRoots(ctx, roots)

	s.mu.Lock()
	for i := range candidates {
		candidates[i].Registered = slices.ContainsFunc(s.items, func(repo Repository) bool {
			return repo.Identity().Same(candidates[i].Identity)
		})
	}
	s.mu.Unlock()

	slices.SortFunc(candidates, func(a, b Candidate) int {
		return cmp.Or(
			strings.Compare(strings.ToLower(a.Identity.Owner), strings.ToLower(b.Identity.Owner)),
			strings.Compare(strings.ToLower(a.Identity.Name), strings.ToLower(b.Identity.Name)),
			strings.Compare(a.Path, b.Path),
		)
	})
	return candidates, nil
}

// collectRoots walks the scan root and returns the clones under it. It skips
// hidden folders and node_modules, never descends into a folder with a .git
// entry and stops at ScanDepth. Folders it cannot read are skipped.
func (s *Service) collectRoots(ctx context.Context) ([]string, error) {
	root := s.scanRoot
	var roots []string
	err := filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
		if ctxErr := ctx.Err(); ctxErr != nil {
			return fmt.Errorf("scan %s: %w", root, ctxErr)
		}
		if err != nil {
			if path == root {
				return fmt.Errorf("scan %s: %w", root, err)
			}
			if entry != nil && entry.IsDir() {
				return fs.SkipDir
			}
			return nil
		}
		if !entry.IsDir() || path == root {
			return nil
		}
		if name := entry.Name(); strings.HasPrefix(name, ".") || name == skippedFolder {
			return fs.SkipDir
		}
		if _, err := os.Lstat(filepath.Join(path, ".git")); err == nil {
			if IsClone(path) {
				roots = append(roots, path)
			}
			return fs.SkipDir
		}
		if depth(root, path) >= ScanDepth {
			return fs.SkipDir
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return roots, nil
}

// identifyRoots identifies the clones at roots concurrently. A clone Identify
// refuses is left out silently; one it fails on is left out with a warning.
func (s *Service) identifyRoots(ctx context.Context, roots []string) []Candidate {
	paths := make(chan string)
	var (
		wg         sync.WaitGroup
		mu         sync.Mutex
		candidates = []Candidate{}
	)
	for range min(scanWorkers, len(roots)) {
		wg.Go(func() {
			for path := range paths {
				identity, err := s.identify(ctx, path)
				if err != nil {
					var refusal *Refusal
					if !errors.As(err, &refusal) {
						s.log.Warn("clone not identified", "path", path, "error", err)
					}
					continue
				}
				mu.Lock()
				candidates = append(candidates, Candidate{Identity: identity, Path: path})
				mu.Unlock()
			}
		})
	}
	for _, path := range roots {
		paths <- path
	}
	close(paths)
	wg.Wait()
	return candidates
}

// depth is how many folders path is below root.
func depth(root, path string) int {
	rel, err := filepath.Rel(root, path)
	if err != nil {
		return 0
	}
	return strings.Count(rel, string(filepath.Separator)) + 1
}
