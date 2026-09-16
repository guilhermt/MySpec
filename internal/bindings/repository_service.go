package bindings

import (
	"context"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"github.com/guilhermt/myspec/internal/repository"
)

// gitCallTimeout bounds a call that reads the origin of a clone.
const gitCallTimeout = 30 * time.Second

// scanTimeout bounds a scan of the home folder, which reads every clone found.
const scanTimeout = 2 * time.Minute

// FolderPicker opens the native folder chooser. ok is false when the user
// cancels.
type FolderPicker interface {
	PickFolder(title, startIn string) (path string, ok bool, err error)
}

// RepositoryService is the repository API the frontend calls.
type RepositoryService struct {
	repositories *repository.Service
	picker       FolderPicker
	log          *slog.Logger
}

// NewRepositoryService builds the service over the repository domain.
func NewRepositoryService(
	repositories *repository.Service, picker FolderPicker, log *slog.Logger,
) *RepositoryService {
	return &RepositoryService{repositories: repositories, picker: picker, log: log}
}

// ScanRepositories lists the clones of GitHub repositories under the home
// folder, marking the ones whose repository is already registered.
func (s *RepositoryService) ScanRepositories() ([]RepositoryCandidate, error) {
	ctx, cancel := context.WithTimeout(context.Background(), scanTimeout)
	defer cancel()

	candidates, err := s.repositories.Scan(ctx)
	if err != nil {
		return nil, s.fail("ScanRepositories", err)
	}
	return FromCandidates(candidates), nil
}

// AddRepository registers the clone at path. A folder the app refuses comes
// back as the sentence the user reads.
func (s *RepositoryService) AddRepository(path string) error {
	ctx, cancel := context.WithTimeout(context.Background(), gitCallTimeout)
	defer cancel()

	if _, err := s.repositories.Add(ctx, path); err != nil {
		return s.fail("AddRepository", err)
	}
	return nil
}

// BrowseRepository asks for the folder of a clone with the native chooser and
// registers it. Cancelling changes nothing and is not an error; a folder the
// app refuses comes back as the sentence the user reads.
func (s *RepositoryService) BrowseRepository() error {
	path, ok, err := s.picker.PickFolder("Add repository", os.Getenv("HOME"))
	if err != nil {
		return s.fail("BrowseRepository", err)
	}
	if !ok {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), gitCallTimeout)
	defer cancel()

	if _, err := s.repositories.Add(ctx, path); err != nil {
		return s.fail("BrowseRepository", err)
	}
	return nil
}

// ChangeRepositoryPath asks for the new folder of the clone of a repository.
func (s *RepositoryService) ChangeRepositoryPath(id string) error {
	repo, ok := s.repositories.Get(id)
	if !ok {
		return s.fail("ChangeRepositoryPath", repository.ErrNotFound)
	}
	path, picked, err := s.picker.PickFolder("Change the path of "+repo.FullName(), filepath.Dir(repo.Path))
	if err != nil {
		return s.fail("ChangeRepositoryPath", err)
	}
	if !picked {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), gitCallTimeout)
	defer cancel()

	if _, err := s.repositories.ChangePath(ctx, id, path); err != nil {
		return s.fail("ChangeRepositoryPath", err)
	}
	return nil
}

// RemoveRepository removes a repository that has no task.
func (s *RepositoryService) RemoveRepository(id string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.repositories.Remove(ctx, id); err != nil {
		return s.fail("RemoveRepository", err)
	}
	return nil
}

// SetRepositoryFilter chooses the repository the task list and the history
// show; "" shows them all.
func (s *RepositoryService) SetRepositoryFilter(id string) error {
	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := s.repositories.SetFilter(ctx, id); err != nil {
		return s.fail("SetRepositoryFilter", err)
	}
	return nil
}

func (s *RepositoryService) fail(method string, err error) error { return failure(s.log, method, err) }
