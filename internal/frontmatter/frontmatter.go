// Package frontmatter reads the metadata header of the Markdown artifacts of
// the product: a pull request draft, a review report. It only splits the
// header off the body; what each field means belongs to whoever asked.
package frontmatter

import (
	"slices"
	"strings"
)

// Fence opens and closes the metadata header of an artifact. A file may have
// none, and a step file may have one, which is skipped.
const Fence = "---"

// Split cuts the metadata header off content. Content without one is all
// body. A UTF-8 byte order mark and blank lines before the opening fence, and
// spaces after a fence, are accepted. Lines without a colon are ignored, keys
// come out in lowercase, and a value may be wrapped in quotes or backticks.
func Split(content string) (fields map[string]string, body string) {
	text := strings.ReplaceAll(content, "\r", "")
	text = strings.TrimPrefix(text, "\ufeff")
	text = strings.TrimLeft(text, "\n")

	first, rest, found := strings.Cut(text, "\n")
	if !found || strings.TrimRight(first, " \t") != Fence {
		return nil, content
	}

	lines := strings.Split(rest, "\n")
	end := slices.IndexFunc(lines, func(line string) bool {
		return strings.TrimRight(line, " \t") == Fence
	})
	if end < 0 {
		return nil, content
	}

	fields = make(map[string]string)
	for _, line := range lines[:end] {
		key, value, found := strings.Cut(line, ":")
		if !found {
			continue
		}
		fields[strings.ToLower(strings.TrimSpace(key))] = unwrap(strings.TrimSpace(value))
	}
	return fields, strings.Join(lines[end+1:], "\n")
}

// unwrap drops one pair of surrounding quotes or backticks from a value.
func unwrap(value string) string {
	for _, quote := range []string{`"`, `'`, "`"} {
		if len(value) >= 2*len(quote) && strings.HasPrefix(value, quote) && strings.HasSuffix(value, quote) {
			return value[len(quote) : len(value)-len(quote)]
		}
	}
	return value
}
