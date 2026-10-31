package app

import (
	"testing"

	"github.com/guilhermt/myspec/internal/board"
)

func TestCardUpdatesKeepTheEpicOfACardWhoseEpicIsNotConfirmed(t *testing.T) {
	t.Parallel()

	epic := &board.Epic{Issue: board.Issue{Owner: "acme", Name: "web", Number: 3, Title: "Auth"}}
	confirmed := board.Card{Issue: board.Issue{Owner: "acme", Name: "web", Number: 12}, Epic: epic}
	unconfirmed := board.Card{Issue: board.Issue{Owner: "acme", Name: "web", Number: 13}, EpicUnconfirmed: true}

	got := cardUpdates(map[string]board.Card{"acme/web#12": confirmed, "acme/web#13": unconfirmed})

	if update := got["acme/web#12"]; update.KeepEpic || update.Epic == nil || update.Epic.Number != 3 {
		t.Errorf("update of the confirmed card = %+v, want its epic and KeepEpic false", update)
	}
	if update := got["acme/web#13"]; !update.KeepEpic || update.Epic != nil {
		t.Errorf("update of the unconfirmed card = %+v, want KeepEpic and no epic", update)
	}
}
