package session_test

import (
	"encoding/json"
	"os"
	"strings"
	"testing"

	"github.com/guilhermt/myspec/internal/session"
)

func TestLabel(t *testing.T) {
	t.Parallel()

	cases := map[string]string{
		"Read":              "Reading",
		"Write":             "Writing",
		"Edit":              "Editing",
		"MultiEdit":         "Editing",
		"NotebookEdit":      "Editing",
		"Bash":              "Running",
		"Glob":              "Finding files",
		"Grep":              "Searching",
		"WebFetch":          "Fetching",
		"WebSearch":         "Searching the web",
		"Task":              "Delegating",
		"Agent":             "Delegating",
		"Skill":             "Using skill",
		"TodoWrite":         "Planning",
		"TaskCreate":        "Planning",
		"TaskUpdate":        "Planning",
		"TaskList":          "Planning",
		"TaskGet":           "Planning",
		"mcp__github__list": "Calling",
		"Unknown":           "Unknown",
	}
	for tool, want := range cases {
		if got := session.Label(tool); got != want {
			t.Errorf("Label(%s) = %q, want %q", tool, got, want)
		}
	}
}

func TestFor(t *testing.T) {
	t.Parallel()

	const dir = "/work/api"
	longCommand := strings.Repeat("x", 130)

	cases := map[string]struct {
		tool       string
		input      string
		wantLabel  string
		wantTarget string
	}{
		"read inside the session directory": {
			tool: "Read", input: `{"file_path":"/work/api/main.go"}`,
			wantLabel: "Reading", wantTarget: "main.go",
		},
		"write outside the session directory": {
			tool: "Write", input: `{"file_path":"/etc/hosts"}`,
			wantLabel: "Writing", wantTarget: "/etc/hosts",
		},
		"edit": {
			tool: "Edit", input: `{"file_path":"/work/api/pkg/a.go","old_string":"a"}`,
			wantLabel: "Editing", wantTarget: "pkg/a.go",
		},
		"multi edit": {
			tool: "MultiEdit", input: `{"file_path":"/work/api/b.go"}`,
			wantLabel: "Editing", wantTarget: "b.go",
		},
		"notebook edit": {
			tool: "NotebookEdit", input: `{"notebook_path":"/work/api/nb.ipynb"}`,
			wantLabel: "Editing", wantTarget: "nb.ipynb",
		},
		"bash keeps the first line": {
			tool: "Bash", input: `{"command":"  go test ./...\necho done"}`,
			wantLabel: "Running", wantTarget: "go test ./...",
		},
		"bash cuts a long command": {
			tool: "Bash", input: `{"command":"` + longCommand + `"}`,
			wantLabel: "Running", wantTarget: strings.Repeat("x", 120) + "…",
		},
		"glob": {
			tool: "Glob", input: `{"pattern":"**/*.go"}`,
			wantLabel: "Finding files", wantTarget: "**/*.go",
		},
		"grep": {
			tool: "Grep", input: `{"pattern":"TODO","path":"."}`,
			wantLabel: "Searching", wantTarget: "TODO",
		},
		"web fetch": {
			tool: "WebFetch", input: `{"url":"https://example.com"}`,
			wantLabel: "Fetching", wantTarget: "https://example.com",
		},
		"web search": {
			tool: "WebSearch", input: `{"query":"go generics"}`,
			wantLabel: "Searching the web", wantTarget: "go generics",
		},
		"task": {
			tool: "Task", input: `{"description":"find callers"}`,
			wantLabel: "Delegating", wantTarget: "find callers",
		},
		"agent": {
			tool: "Agent", input: `{"description":"review"}`,
			wantLabel: "Delegating", wantTarget: "review",
		},
		"skill": {
			tool: "Skill", input: `{"skill":"gm-prd"}`,
			wantLabel: "Using skill", wantTarget: "gm-prd",
		},
		"planning has no target": {
			tool: "TodoWrite", input: `{"todos":[]}`,
			wantLabel: "Planning", wantTarget: "",
		},
		"mcp tool": {
			tool: "mcp__github__list_issues", input: `{"repo":"x"}`,
			wantLabel: "Calling", wantTarget: "github · list_issues",
		},
		"mcp tool without a tool name": {
			tool: "mcp__github", input: `{}`,
			wantLabel: "Calling", wantTarget: "github",
		},
		"unknown tool": {
			tool: "Frobnicate", input: `{"x":1}`,
			wantLabel: "Frobnicate", wantTarget: "",
		},
		"invalid input": {
			tool: "Read", input: `{not json`,
			wantLabel: "Reading", wantTarget: "",
		},
		"missing field": {
			tool: "Read", input: `{"path":"/x"}`,
			wantLabel: "Reading", wantTarget: "",
		},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			label, target := session.For(tc.tool, json.RawMessage(tc.input), dir)
			if label != tc.wantLabel {
				t.Errorf("label = %q, want %q", label, tc.wantLabel)
			}
			if target != tc.wantTarget {
				t.Errorf("target = %q, want %q", target, tc.wantTarget)
			}
		})
	}
}

func TestForShortensHome(t *testing.T) {
	t.Parallel()

	home, err := os.UserHomeDir()
	if err != nil {
		t.Skipf("no home directory: %v", err)
	}

	input := json.RawMessage(`{"file_path":"` + home + `/notes/todo.md"}`)
	if _, target := session.For("Read", input, "/work/api"); target != "~/notes/todo.md" {
		t.Errorf("target = %q, want ~/notes/todo.md", target)
	}
	input = json.RawMessage(`{"file_path":"` + home + `"}`)
	if _, target := session.For("Read", input, "/work/api"); target != "~" {
		t.Errorf("target = %q, want ~", target)
	}
}
