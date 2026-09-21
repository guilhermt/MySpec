package board_test

import (
	"testing"

	"github.com/guilhermt/myspec/internal/board"
)

func TestAnIssueIsNamedByItsRepositoryAndKeyedInLowerCase(t *testing.T) {
	t.Parallel()

	i := board.Issue{Owner: "Acme", Name: "Web", Number: 12}

	if got, want := i.Key(), "acme/web#12"; got != want {
		t.Errorf("Key() = %q, want %q", got, want)
	}
	if got, want := i.FullName(), "Acme/Web"; got != want {
		t.Errorf("FullName() = %q, want %q", got, want)
	}
}

func TestTheModuleOptionIsFoundByNameIgnoringCaseAndAccents(t *testing.T) {
	t.Parallel()
	reading := board.Reading{Module: &board.ModuleField{
		ID:      "field-module",
		Name:    "Módulo",
		Options: []board.Option{{ID: "opt-core", Name: "Núcleo"}, {ID: "opt-web", Name: "Web"}},
	}}

	tests := []struct {
		name string
		want string
		ok   bool
	}{
		{name: " nucleo ", want: "opt-core", ok: true},
		{name: "NÚCLEO", want: "opt-core", ok: true},
		{name: "web", want: "opt-web", ok: true},
		{name: "mobile"},
		{name: ""},
	}
	for _, tt := range tests {
		got, ok := reading.ModuleOptionID(tt.name)
		if got != tt.want || ok != tt.ok {
			t.Errorf("ModuleOptionID(%q) = %q, %v, want %q, %v", tt.name, got, ok, tt.want, tt.ok)
		}
	}
}

func TestAReadingWithoutAModuleFieldHasNoModuleOption(t *testing.T) {
	t.Parallel()
	reading := board.Reading{}

	if got, ok := reading.ModuleOptionID("Core"); ok || got != "" {
		t.Errorf("ModuleOptionID() = %q, %v, want \"\", false", got, ok)
	}
}

func TestTheStatusOptionIsFoundByItsID(t *testing.T) {
	t.Parallel()
	doing := board.Option{ID: "opt-doing", Name: "In progress"}
	reading := board.Reading{Statuses: []board.Option{{ID: "opt-todo", Name: "Todo"}, doing}}

	if got, ok := reading.StatusOption("opt-doing"); !ok || got != doing {
		t.Errorf("StatusOption() = %+v, %v, want %+v, true", got, ok, doing)
	}
	if got, ok := reading.StatusOption("opt-gone"); ok || got != (board.Option{}) {
		t.Errorf("StatusOption() = %+v, %v, want the zero option, false", got, ok)
	}
}
