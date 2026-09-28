package session

import (
	"encoding/json"
	"strings"
	"unicode/utf8"

	"github.com/guilhermt/myspec/internal/claude"
)

// OutputLimit is the most of an output kept, from its end.
const OutputLimit = 64 << 10

// tailLimit is the most of the tail the payload carries, from its end.
const tailLimit = 4 << 10

// wholeTail is the most lines of an output shown whole; above it the tail is
// the last tailLines.
const wholeTail, tailLines = 16, 12

// Output is the whole output of a tool call.
type Output struct {
	Text      string
	Lines     int
	Truncated bool
}

// outputOf is the output a result gives the action, false when it has none.
func outputOf(action *ActionEntry, result claude.ToolResult, useResult json.RawMessage) (Output, bool) {
	var text string
	switch {
	case action.Tool == "Bash" && !result.IsError:
		text = bashOutput(result, useResult)
	case action.Tool == "Bash":
		text = result.Text()
		if first, rest, _ := strings.Cut(text, "\n"); exitCodeLine.MatchString(first) {
			text = rest
		}
	case action.Tool == "Agent" || action.Tool == "Task" || result.IsError:
		text = result.Text()
	}

	text = strings.TrimRight(stripANSI(text), "\n")
	if text == "" {
		return Output{}, false
	}
	o := Output{Text: text}
	if len(text) > OutputLimit {
		o.Text = endOf(text, OutputLimit)
		o.Truncated = true
	}
	o.Lines = strings.Count(o.Text, "\n") + 1
	return o, true
}

// bashOutput is the stdout of a command followed by its stderr, as the
// structured result gives them, or the text of the result without one.
func bashOutput(result claude.ToolResult, useResult json.RawMessage) string {
	var streams struct {
		Stdout *string `json:"stdout"`
		Stderr *string `json:"stderr"`
	}
	if json.Unmarshal(useResult, &streams) != nil || streams.Stdout == nil {
		return result.Text()
	}
	stderr := ""
	if streams.Stderr != nil {
		stderr = *streams.Stderr
	}
	if *streams.Stdout != "" && stderr != "" {
		return *streams.Stdout + "\n" + stderr
	}
	return *streams.Stdout + stderr
}

// tailOf is the part of an output the payload carries.
func tailOf(o Output) string {
	tail := o.Text
	if o.Lines > wholeTail {
		lines := strings.Split(tail, "\n")
		tail = strings.Join(lines[len(lines)-tailLines:], "\n")
	}
	if len(tail) > tailLimit {
		tail = endOf(tail, tailLimit)
	}
	return tail
}

// endOf is the end of a text within limit bytes, starting at the beginning of
// a line and at a valid UTF-8 boundary.
func endOf(text string, limit int) string {
	end := text[len(text)-limit:]
	if _, rest, ok := strings.Cut(end, "\n"); ok {
		end = rest
	}
	for end != "" && !utf8.RuneStart(end[0]) {
		end = end[1:]
	}
	return end
}
