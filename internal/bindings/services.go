package bindings

import "github.com/wailsapp/wails/v3/pkg/application"

// Services are the binding services the app registers with Wails before its
// startup ends, each waiting for the service built at the end of it.
type Services struct {
	State      *StateService
	Repository *RepositoryService
	Settings   *SettingsService
	Task       *TaskService
	Board      *BoardService
	Review     *ReviewService
	Discussion *DiscussionService
	Attention  *AttentionService
	History    *HistoryService
}

// NewWaitingServices builds the placeholders, each answering startingMessage.
func NewWaitingServices() *Services {
	state := &StateService{}
	state.late.waiting = true
	repository := &RepositoryService{}
	repository.late.waiting = true
	settings := &SettingsService{}
	settings.late.waiting = true
	task := &TaskService{}
	task.late.waiting = true
	board := &BoardService{}
	board.late.waiting = true
	review := &ReviewService{}
	review.late.waiting = true
	discussion := &DiscussionService{}
	discussion.late.waiting = true
	attention := &AttentionService{}
	attention.late.waiting = true
	history := &HistoryService{}
	history.late.waiting = true

	return &Services{
		State:      state,
		Repository: repository,
		Settings:   settings,
		Task:       task,
		Board:      board,
		Review:     review,
		Discussion: discussion,
		Attention:  attention,
		History:    history,
	}
}

// Bind hands each placeholder the service built for it. A field left nil is
// left waiting.
func (s *Services) Bind(built Services) {
	if built.State != nil {
		s.State.late.bound.Store(built.State)
	}
	if built.Repository != nil {
		s.Repository.late.bound.Store(built.Repository)
	}
	if built.Settings != nil {
		s.Settings.late.bound.Store(built.Settings)
	}
	if built.Task != nil {
		s.Task.late.bound.Store(built.Task)
	}
	if built.Board != nil {
		s.Board.late.bound.Store(built.Board)
	}
	if built.Review != nil {
		s.Review.late.bound.Store(built.Review)
	}
	if built.Discussion != nil {
		s.Discussion.late.bound.Store(built.Discussion)
	}
	if built.Attention != nil {
		s.Attention.late.bound.Store(built.Attention)
	}
	if built.History != nil {
		s.History.late.bound.Store(built.History)
	}
}

// Wails are the placeholders as Wails services, in this order.
func (s *Services) Wails() []application.Service {
	return []application.Service{
		application.NewService(s.State),
		application.NewService(s.Repository),
		application.NewService(s.Settings),
		application.NewService(s.Task),
		application.NewService(s.Board),
		application.NewService(s.Review),
		application.NewService(s.Discussion),
		application.NewService(s.Attention),
		application.NewService(s.History),
	}
}
