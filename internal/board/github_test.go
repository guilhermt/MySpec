package board_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/board"
)

// The options of the module field of the board.
var (
	core = board.Option{ID: "opt-core", Name: "Core"}
	web  = board.Option{ID: "opt-web", Name: "Web"}
)

func TestTheReadingTakesTheIDOfTheStatusFieldAndTheFirstFieldNamedModule(t *testing.T) {
	t.Parallel()
	f := newFixture(t, board.Stored{})
	f.github.answer(structureMatch, "", structureFields("Roadmap", []board.Option{todo, done},
		node{"name": "Status", "dataType": "SINGLE_SELECT", "id": statusFieldID},
		singleSelect("field-priority", "Priority", board.Option{ID: "opt-high", Name: "High"}),
		singleSelect("field-module", " MÓDULO ", core, web),
		singleSelect("field-module-en", "Module", core),
	))
	f.github.answer(itemsMatch, openQ, itemsPage(""))
	f.github.answer(itemsMatch, closedQ, itemsPage(""))

	f.refresh(t)

	reading := f.service.Stored(boardID).Reading
	if reading == nil {
		t.Fatal("Stored().Reading = nil, want the reading")
	}
	if reading.StatusFieldID != statusFieldID {
		t.Errorf("StatusFieldID = %q, want %q", reading.StatusFieldID, statusFieldID)
	}
	want := &board.ModuleField{ID: "field-module", Name: " MÓDULO ", Options: []board.Option{core, web}}
	if diff := cmp.Diff(want, reading.Module); diff != "" {
		t.Errorf("Module (-want +got):\n%s", diff)
	}
}

func TestABoardWithoutAFieldNamedModuleReadsNoModule(t *testing.T) {
	t.Parallel()
	f := newFixture(t, board.Stored{})
	f.github.answer(structureMatch, "", structure("Roadmap"))
	f.github.answer(itemsMatch, openQ, itemsPage(""))
	f.github.answer(itemsMatch, closedQ, itemsPage(""))

	f.refresh(t)

	reading := f.service.Stored(boardID).Reading
	if reading == nil {
		t.Fatal("Stored().Reading = nil, want the reading")
	}
	if reading.Module != nil {
		t.Errorf("Module = %+v, want nil", reading.Module)
	}
}

func TestAModuleFieldWithoutOptionsReadsAnEmptyList(t *testing.T) {
	t.Parallel()
	f := newFixture(t, board.Stored{})
	f.github.answer(structureMatch, "", structureFields("Roadmap", []board.Option{todo},
		node{"name": "Status", "dataType": "SINGLE_SELECT", "id": statusFieldID},
		node{"name": "Module", "dataType": "SINGLE_SELECT", "id": "field-module"},
	))
	f.github.answer(itemsMatch, openQ, itemsPage(""))
	f.github.answer(itemsMatch, closedQ, itemsPage(""))

	f.refresh(t)

	reading := f.service.Stored(boardID).Reading
	if reading == nil {
		t.Fatal("Stored().Reading = nil, want the reading")
	}
	want := &board.ModuleField{ID: "field-module", Name: "Module", Options: []board.Option{}}
	if diff := cmp.Diff(want, reading.Module); diff != "" {
		t.Errorf("Module (-want +got):\n%s", diff)
	}
}

func TestABoardWithoutAStatusFieldWithOptionsReadsNoStatusFieldID(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name     string
		statuses []board.Option
	}{
		{name: "no Status field"},
		{name: "a Status field without options", statuses: []board.Option{}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			f := newFixture(t, board.Stored{})
			f.github.answer(structureMatch, "", structureFields("Roadmap", tt.statuses,
				node{"name": "Title", "dataType": "TITLE"},
			))
			f.github.answer(itemsMatch, openQ, itemsPage(""))
			f.github.answer(itemsMatch, closedQ, itemsPage(""))

			f.refresh(t)

			reading := f.service.Stored(boardID).Reading
			if reading == nil {
				t.Fatal("Stored().Reading = nil, want the reading")
			}
			if reading.HasStatus || reading.StatusFieldID != "" {
				t.Errorf("HasStatus = %v with StatusFieldID %q, want false without an id", reading.HasStatus, reading.StatusFieldID)
			}
		})
	}
}
