package session

import (
	"cmp"
	"encoding/json"
	"os"
	"strings"
	"unicode/utf8"
)

// commandLimit is the longest command shown as the target of a Bash action,
// in runes.
const commandLimit = 120

// ellipsis closes a command cut at commandLimit.
const ellipsis = "…"

// mcpPrefix opens the name of every MCP tool: mcp__<server>__<tool>.
const mcpPrefix = "mcp__"

// labels are the verbs of the tools the interface knows.
var labels = map[string]string{
	"Read":         "Reading",
	"Write":        "Writing",
	"Edit":         "Editing",
	"MultiEdit":    "Editing",
	"NotebookEdit": "Editing",
	"Bash":         "Running",
	"Glob":         "Finding files",
	"Grep":         "Searching",
	"WebFetch":     "Fetching",
	"WebSearch":    "Searching the web",
	"Task":         "Delegating",
	"Agent":        "Delegating",
	"Skill":        "Using skill",
	"TodoWrite":    "Planning",
	"TaskCreate":   "Planning",
	"TaskUpdate":   "Planning",
	"TaskList":     "Planning",
	"TaskGet":      "Planning",
}

// Label is the verb for a tool before its input is known.
func Label(tool string) string {
	if label, ok := labels[tool]; ok {
		return label
	}
	if strings.HasPrefix(tool, mcpPrefix) {
		return "Calling"
	}
	return tool
}

// For returns the verb and the target once the input is complete. dir is the
// session directory, used to shorten paths.
func For(tool string, input json.RawMessage, dir string) (label, target string) {
	label = Label(tool)

	var fields map[string]any
	if err := json.Unmarshal(input, &fields); err != nil {
		fields = nil
	}
	str := func(key string) string {
		value, _ := fields[key].(string)
		return value
	}

	switch tool {
	case "Read", "Write", "Edit", "MultiEdit":
		target = shortenPath(str("file_path"), dir)
	case "NotebookEdit":
		target = shortenPath(cmp.Or(str("file_path"), str("notebook_path")), dir)
	case "Bash":
		target = firstLine(str("command"))
	case "Glob", "Grep":
		target = str("pattern")
	case "WebFetch":
		target = str("url")
	case "WebSearch":
		target = str("query")
	case "Task", "Agent":
		target = str("description")
	case "Skill":
		target = str("skill")
	default:
		if strings.HasPrefix(tool, mcpPrefix) {
			target = mcpTarget(tool)
		}
	}
	return label, target
}

// mcpTarget renders mcp__<server>__<tool> as "<server> · <tool>".
func mcpTarget(tool string) string {
	server, name, ok := strings.Cut(strings.TrimPrefix(tool, mcpPrefix), "__")
	if !ok {
		return server
	}
	return server + " · " + name
}

// firstLine is the first line of a command, cut at commandLimit runes.
func firstLine(command string) string {
	line, _, _ := strings.Cut(strings.TrimSpace(command), "\n")
	line = strings.TrimSpace(line)
	if utf8.RuneCountInString(line) <= commandLimit {
		return line
	}
	runes := []rune(line)
	return string(runes[:commandLimit]) + ellipsis
}

// shortenPath makes a path relative to dir when it is inside it, and replaces
// the home directory with ~ otherwise.
func shortenPath(path, dir string) string {
	if path == "" {
		return ""
	}
	if dir != "" && strings.HasPrefix(path, dir+"/") {
		return strings.TrimPrefix(path, dir+"/")
	}
	if home, err := os.UserHomeDir(); err == nil && home != "" {
		if path == home {
			return "~"
		}
		if strings.HasPrefix(path, home+"/") {
			return "~" + strings.TrimPrefix(path, home)
		}
	}
	return path
}
