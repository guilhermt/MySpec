package board_test

import (
	"strings"
	"testing"

	"github.com/guilhermt/myspec/internal/board"
	"github.com/guilhermt/myspec/internal/task"
)

func TestSuggestNameIsTheNumberAndTheSlugOfTheTitle(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		number int
		title  string
		want   string
	}{
		{"accents and spaces", 412, "Emitir nota de serviço em lote", "412-emitir-nota-de-servico-em-lote"},
		{"symbols collapse into one hyphen", 7, "  [API] Fix: login -- & logout!  ", "7-api-fix-login-logout"},
		{"only symbols", 9, "!!! ???", "9"},
		{
			"cut at a word boundary",
			1234,
			"Permitir que o usuário exporte relatórios financeiros consolidados por período",
			"1234-permitir-que-o-usuario-exporte-relatorios-financeiros",
		},
		{
			"the kept words end exactly at the bound",
			1,
			strings.Repeat("a", 30) + " " + strings.Repeat("b", 31) + " cc",
			"1-" + strings.Repeat("a", 30) + "-" + strings.Repeat("b", 31),
		},
		{"a single long word", 5, strings.Repeat("a", 80), "5-" + strings.Repeat("a", 62)},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := board.SuggestName(tt.number, tt.title)
			if got != tt.want {
				t.Errorf("SuggestName(%d, %q) = %q, want %q", tt.number, tt.title, got, tt.want)
			}
			if len(got) > task.NameMaxLen {
				t.Errorf("SuggestName(%d, %q) has %d characters, more than %d", tt.number, tt.title, len(got), task.NameMaxLen)
			}
		})
	}
}
