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

// cardUpdates is what a reading saw of each card, as the active tasks take it.
func cardUpdates(cards map[string]board.Card) map[string]task.CardUpdate {
	updates := make(map[string]task.CardUpdate, len(cards))
	for key, card := range cards {
		var epic *task.CardEpic
		if card.Epic != nil {
			e := card.Epic.Issue
			epic = &task.CardEpic{Owner: e.Owner, Name: e.Name, Number: e.Number, Title: e.Title, URL: e.URL}
		}
		updates[key] = task.CardUpdate{
			Title:    card.Title,
			Body:     card.Body,
			URL:      card.URL,
			Status:   card.Status,
			State:    card.State,
			Epic:     epic,
			ReadAt:   card.ReadAt,
			KeepEpic: card.EpicUnconfirmed,
		}
	}
	return updates
}

// onBoardRead records on the active tasks of a board what a reading saw of
// their cards.
func (a *App) onBoardRead(boardID string, cards map[string]board.Card) {
	updates := cardUpdates(cards)

	ctx, cancel := context.WithTimeout(context.Background(), callTimeout)
	defer cancel()

	if err := a.tasks.UpdateCards(ctx, boardID, updates); err != nil {
		a.log.Error("task cards not updated", "board", boardID, "error", err)
	}
}

// onBoardRemoved drops the drafts of a removed board from what the New
// discussion dialog lists: the database already lost them with the board.
func (a *App) onBoardRemoved(boardID string) {
	a.newDiscussionDrafts.ForgetBoard(boardID)
}
