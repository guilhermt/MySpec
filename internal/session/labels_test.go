package session_test

import (
	"encoding/json"
	"os"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"

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
	longCommand := strings.Repeat("x", 1010)

	cases := map[string]struct {
		tool  string
		input string
		want  session.Described
	}{
		"read inside the session directory": {
			tool: "Read", input: `{"file_path":"/work/api/main.go"}`,
			want: session.Described{Label: "Reading", Target: "main.go"},
		},
		"write outside the session directory": {
			tool: "Write", input: `{"file_path":"/etc/hosts"}`,
			want: session.Described{Label: "Writing", Target: "/etc/hosts"},
		},
		"edit": {
			tool: "Edit", input: `{"file_path":"/work/api/pkg/a.go","old_string":"a"}`,
			want: session.Described{Label: "Editing", Target: "pkg/a.go"},
		},
		"multi edit": {
			tool: "MultiEdit", input: `{"file_path":"/work/api/b.go"}`,
			want: session.Described{Label: "Editing", Target: "b.go"},
		},
		"notebook edit": {
			tool: "NotebookEdit", input: `{"notebook_path":"/work/api/nb.ipynb"}`,
			want: session.Described{Label: "Editing", Target: "nb.ipynb"},
		},
		"bash keeps the first line": {
			tool: "Bash", input: `{"command":"  go test ./...\necho done"}`,
			want: session.Described{Label: "Running", Target: "go test ./...", CommandLines: 2},
		},
		"bash cuts a long command": {
			tool: "Bash", input: `{"command":"` + longCommand + `"}`,
			want: session.Described{Label: "Running", Target: strings.Repeat("x", 1000) + "…", CommandLines: 1},
		},
		"glob": {
			tool: "Glob", input: `{"pattern":"**/*.go"}`,
			want: session.Described{Label: "Finding files", Target: "**/*.go"},
		},
		"grep": {
			tool: "Grep", input: `{"pattern":"TODO","path":"."}`,
			want: session.Described{Label: "Searching", Target: "TODO"},
		},
		"web fetch": {
			tool: "WebFetch", input: `{"url":"https://example.com"}`,
			want: session.Described{Label: "Fetching", Target: "https://example.com"},
		},
		"web search": {
			tool: "WebSearch", input: `{"query":"go generics"}`,
			want: session.Described{Label: "Searching the web", Target: "go generics"},
		},
		"bash with a description": {
			tool: "Bash", input: `{"command":"ls -1","description":"List the files"}`,
			want: session.Described{Label: "Running", Target: "ls -1", Description: "List the files", CommandLines: 1},
		},
		"bash without a command": {
			tool: "Bash", input: `{}`,
			want: session.Described{Label: "Running"},
		},
		"task": {
			tool: "Task", input: `{"subagent_type":"Explore","description":"find callers"}`,
			want: session.Described{Label: "Delegating", Target: "Explore", Description: "find callers"},
		},
		"agent": {
			tool: "Agent", input: `{"subagent_type":"general-purpose","description":"review"}`,
			want: session.Described{Label: "Delegating", Target: "general-purpose", Description: "review"},
		},
		"skill": {
			tool: "Skill", input: `{"skill":"gm-prd"}`,
			want: session.Described{Label: "Using skill", Target: "gm-prd"},
		},
		"planning has no target": {
			tool: "TodoWrite", input: `{"todos":[]}`,
			want: session.Described{Label: "Planning", Target: ""},
		},
		"mcp tool": {
			tool: "mcp__github__list_issues", input: `{"repo":"x"}`,
			want: session.Described{Label: "Calling", Target: "github · list_issues"},
		},
		"mcp tool without a tool name": {
			tool: "mcp__github", input: `{}`,
			want: session.Described{Label: "Calling", Target: "github"},
		},
		"unknown tool": {
			tool: "Frobnicate", input: `{"x":1}`,
			want: session.Described{Label: "Frobnicate", Target: ""},
		},
		"invalid input": {
			tool: "Read", input: `{not json`,
			want: session.Described{Label: "Reading", Target: ""},
		},
		"missing field": {
			tool: "Read", input: `{"path":"/x"}`,
			want: session.Described{Label: "Reading", Target: ""},
		},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			got := session.For(tc.tool, json.RawMessage(tc.input), dir)
			if diff := cmp.Diff(tc.want, got); diff != "" {
				t.Errorf("For(%s) mismatch (-want +got):\n%s", tc.tool, diff)
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
	if target := session.For("Read", input, "/work/api").Target; target != "~/notes/todo.md" {
		t.Errorf("target = %q, want ~/notes/todo.md", target)
	}
	input = json.RawMessage(`{"file_path":"` + home + `"}`)
	if target := session.For("Read", input, "/work/api").Target; target != "~" {
		t.Errorf("target = %q, want ~", target)
	}
}
