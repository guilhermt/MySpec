package app

import (
	"context"

	"github.com/guilhermt/myspec/internal/board"
	"github.com/guilhermt/myspec/internal/task"
)

// boardTaskCards are the keys of the cards of the active tasks created from the
// board of boardID, which a reading of the board reads even when they fall
// outside it.
func (a *App) boardTaskCards(boardID string) []string {
	var keys []string
	for _, t := range a.tasks.List() {
		if t.Card != nil && t.Card.BoardID == boardID {
			keys = append(keys, t.Card.Key())
		}
	}
	return keys
}

// onBoardRead records on the active tasks of a board what a reading saw of
// their cards.
func (a *App) onBoardRead(boardID string, cards map[string]board.Card) {
	updates := make(map[string]task.CardUpdate, len(cards))
	for key, card := range cards {
		var epic *task.CardEpic
		if card.Epic != nil {
			e := card.Epic.Issue
			epic = &task.CardEpic{Owner: e.Owner, Name: e.Name, Number: e.Number, Title: e.Title, URL: e.URL}
		}
		updates[key] = task.CardUpdate{
			Title:  card.Title,
			Body:   card.Body,
			URL:    card.URL,
			Status: card.Status,
			State:  card.State,
			Epic:   epic,
			ReadAt: card.ReadAt,
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := a.tasks.UpdateCards(ctx, boardID, updates); err != nil {
		a.log.Error("task cards not updated", "board", boardID, "error", err)
	}
}
