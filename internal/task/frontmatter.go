package task

import (
	"slices"
	"strings"
)

// frontMatterFence opens and closes the metadata header of a step file.
const frontMatterFence = "---"

// splitFrontMatter cuts the metadata header off content. Lines without a
// colon are ignored, and a value may be wrapped in quotes or backticks.
func splitFrontMatter(content string) (fields map[string]string, body string, ok bool) {
	text := strings.ReplaceAll(content, "\r", "")
	if !strings.HasPrefix(text, frontMatterFence+"\n") {
		return nil, content, false
	}

	lines := strings.Split(text[len(frontMatterFence)+1:], "\n")
	end := slices.Index(lines, frontMatterFence)
	if end < 0 {
		return nil, content, false
	}

	fields = make(map[string]string)
	for _, line := range lines[:end] {
		key, value, found := strings.Cut(line, ":")
		if !found {
			continue
		}
		fields[strings.TrimSpace(key)] = unwrap(strings.TrimSpace(value))
	}
	return fields, strings.Join(lines[end+1:], "\n"), true
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
