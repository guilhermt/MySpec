package bindings

import "log/slog"

// HistorySources reads the whole History, converted, newest first.
type HistorySources struct {
	Tasks       func() []ArchivedTask
	Reviews     func() []ArchivedReview
	Discussions func() []ArchivedDiscussion
}

// HistoryService pages the History beyond the window the state carries,
// searches the whole of it and finds an archived item by id.
type HistoryService struct {
	late    late[HistoryService]
	sources HistorySources
	log     *slog.Logger
}

// NewHistoryService builds the service over the sources of the History.
func NewHistoryService(sources HistorySources, log *slog.Logger) *HistoryService {
	return &HistoryService{sources: sources, log: log}
}

// ListArchived is the page of the History after the cursor that matches the
// query and the repository, with how many items of the whole History match.
func (s *HistoryService) ListArchived(request HistoryRequest) (HistoryPage, error) {
	s, err := s.late.resolve(s)
	if err != nil {
		return HistoryPage{}, err
	}
	page, err := historyPage(s.entries(), request)
	if err != nil {
		return HistoryPage{}, s.fail("ListArchived", err)
	}
	return page, nil
}

// GetArchived is the archived item with the id, in whichever kind it is; every
// field is nil when no archived item has it.
func (s *HistoryService) GetArchived(id string) (ArchivedItem, error) {
	s, err := s.late.resolve(s)
	if err != nil {
		return ArchivedItem{}, err
	}
	for _, entry := range s.entries() {
		if entry.id == id {
			return ArchivedItem{Task: entry.task, Review: entry.review, Discussion: entry.discussion}, nil
		}
	}
	return ArchivedItem{}, nil
}

// entries are the whole History, newest first.
func (s *HistoryService) entries() []historyEntry {
	return historyEntries(s.sources.Tasks(), s.sources.Reviews(), s.sources.Discussions())
}

func (s *HistoryService) fail(method string, err error) error { return failure(s.log, method, err) }
