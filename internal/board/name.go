package board

import (
	"strconv"
	"strings"
	"unicode"

	"golang.org/x/text/unicode/norm"

	"github.com/guilhermt/myspec/internal/task"
)

// SuggestName is the task name suggested for a card: <number>-<slug of the title>,
// cut at a word boundary to fit task.NameMaxLen.
func SuggestName(number int, title string) string {
	prefix := strconv.Itoa(number)
	slug := slugOf(title)
	if slug == "" {
		return prefix
	}
	maxLen := task.NameMaxLen - len(prefix) - 1
	for len(slug) > maxLen {
		cut := strings.LastIndex(slug[:maxLen+1], "-")
		if cut < 0 {
			slug = strings.Trim(slug[:maxLen], "-")
			break
		}
		slug = slug[:cut]
	}
	return prefix + "-" + slug
}

// slugOf is s folded, with every run of characters outside [a-z0-9] turned
// into a hyphen and no hyphen at either end.
func slugOf(s string) string {
	var b strings.Builder
	hyphen := false
	for _, r := range fold(s) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
			hyphen = false
		} else if !hyphen {
			b.WriteByte('-')
			hyphen = true
		}
	}
	return strings.Trim(b.String(), "-")
}

// fold is s in lower case without accents: decomposed, with the combining
// marks dropped.
func fold(s string) string {
	var b strings.Builder
	for _, r := range norm.NFD.String(strings.ToLower(s)) {
		if !unicode.Is(unicode.Mn, r) {
			b.WriteRune(r)
		}
	}
	return b.String()
}
