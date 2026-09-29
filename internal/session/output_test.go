package session_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/claude"
	"github.com/guilhermt/myspec/internal/session"
)

// result is a tool_result with its content as a JSON string.
func result(text string, isError bool) claude.ToolResult {
	content, _ := json.Marshal(text)
	return claude.ToolResult{Content: content, IsError: isError}
}

func TestOutputOfEachKindOfResult(t *testing.T) {
	t.Parallel()

	long := strings.Repeat("x", 100) + "\n" + strings.Repeat("é", session.OutputLimit/2)
	cases := map[string]struct {
		tool      string
		result    claude.ToolResult
		useResult string
		want      session.Output
		ok        bool
	}{
		"a command with stdout and stderr": {
			tool: "Bash", result: result("ignored", false), useResult: `{"stdout":"ok\n","stderr":"warn"}`,
			want: session.Output{Text: "ok\n\nwarn", Lines: 3}, ok: true,
		},
		"a command with only stderr": {
			tool: "Bash", result: result("", false), useResult: `{"stdout":"","stderr":"warn"}`,
			want: session.Output{Text: "warn", Lines: 1}, ok: true,
		},
		"a command with no output": {
			tool: "Bash", result: result("", false), useResult: `{"stdout":"","stderr":"","noOutputExpected":true}`,
		},
		"a command without the structured result": {
			tool: "Bash", result: result("from the text", false), useResult: `"a string"`,
			want: session.Output{Text: "from the text", Lines: 1}, ok: true,
		},
		"a failed command drops the exit code line": {
			tool: "Bash", result: result("Exit code 2\n--- FAIL: TestX\nFAIL", true),
			want: session.Output{Text: "--- FAIL: TestX\nFAIL", Lines: 2}, ok: true,
		},
		"a failed edit": {
			tool: "Edit", result: result("<tool_use_error>String to replace not found in file.</tool_use_error>", true),
			want: session.Output{Text: "<tool_use_error>String to replace not found in file.</tool_use_error>", Lines: 1}, ok: true,
		},
		"a read that passes has none": {
			tool: "Read", result: result("1\thello", false),
		},
		"a subagent gives its report": {
			tool: "Agent", result: result("The report.\n", false),
			want: session.Output{Text: "The report.", Lines: 1}, ok: true,
		},
		"a subagent's report comes from the structured result without the frame": {
			tool:      "Agent",
			result:    result("[Subagent hand-back] The report follows:\n  The report.\nagentId: a1\n<usage>tool_uses: 2</usage>", false),
			useResult: `{"status":"completed","content":[{"type":"text","text":"The report."},{"type":"text","text":"More."}]}`,
			want:      session.Output{Text: "The report.\n\nMore.", Lines: 3}, ok: true,
		},
		"a subagent's command with no output has none": {
			tool: "Bash", result: result("(Bash completed with no output)", false),
		},
		"ANSI escapes are stripped": {
			tool: "Bash", result: result("", false), useResult: `{"stdout":"\u001b[31mred\u001b[0m","stderr":""}`,
			want: session.Output{Text: "red", Lines: 1}, ok: true,
		},
		"above the limit the end is kept from a line and a rune": {
			tool: "Agent", result: result(strings.Repeat("a", 50)+"\n"+long+"x", false),
			want: session.Output{Text: strings.Repeat("é", session.OutputLimit/2-1) + "x", Lines: 1, Truncated: true}, ok: true,
		},
	}
	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			got, ok := session.OutputOf(&session.ActionEntry{Tool: c.tool}, c.result, json.RawMessage(c.useResult))
			if ok != c.ok {
				t.Fatalf("OutputOf() ok = %v, want %v", ok, c.ok)
			}
			if diff := cmp.Diff(c.want, got); diff != "" {
				t.Errorf("OutputOf() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestTailOfAnOutput(t *testing.T) {
	t.Parallel()

	numbered := func(n int) string {
		lines := make([]string, n)
		for i := range lines {
			lines[i] = "line " + string(rune('a'+i))
		}
		return strings.Join(lines, "\n")
	}
	wide := strings.Repeat("y", 1000)
	cases := map[string]struct {
		output session.Output
		want   string
	}{
		"sixteen lines are whole": {
			output: session.Output{Text: numbered(16), Lines: 16},
			want:   numbered(16),
		},
		"seventeen lines keep the last twelve": {
			output: session.Output{Text: numbered(17), Lines: 17},
			want:   strings.Join(strings.Split(numbered(17), "\n")[5:], "\n"),
		},
		"a tail above 4 KiB keeps its end from a line": {
			output: session.Output{Text: strings.Repeat(wide+"\n", 5) + "end", Lines: 6},
			want:   strings.Repeat(wide+"\n", 4) + "end",
		},
	}
	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			if diff := cmp.Diff(c.want, session.TailOf(c.output)); diff != "" {
				t.Errorf("TailOf() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestOutputOfTheRecordedResults(t *testing.T) {
	t.Parallel()

	cases := map[string]struct {
		file, tool string
		want       session.Output
		ok         bool
	}{
		"a command that prints nothing": {file: "bash-silent.jsonl", tool: "Bash"},
		"a subagent gives only its report": {
			file: "subagent.jsonl", tool: "Agent",
			want: session.Output{Text: `The file a.txt contains a single word "hi" on the first line.`, Lines: 1}, ok: true,
		},
		"a subagent's command": {
			file: "subagent.jsonl", tool: "Bash",
			want: session.Output{Text: "a.txt", Lines: 1}, ok: true,
		},
		"a command that fails": {
			file: "bash-exit.jsonl", tool: "Bash",
			want: session.Output{Text: "cat: missing.txt: No such file or directory", Lines: 1}, ok: true,
		},
		"an edit that finds no string": {
			file: "edit-error.jsonl", tool: "Edit",
			want: session.Output{
				Text:  "<tool_use_error>String to replace not found in file.\nString: missing text</tool_use_error>",
				Lines: 2,
			},
			ok: true,
		},
	}
	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			res, useResult := lastResultOf(t, c.file, c.tool)
			got, ok := session.OutputOf(&session.ActionEntry{Tool: c.tool}, res, useResult)
			if ok != c.ok {
				t.Fatalf("OutputOf() ok = %v, want %v", ok, c.ok)
			}
			if diff := cmp.Diff(c.want, got); diff != "" {
				t.Errorf("OutputOf() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

// lastResultOf is the last result of a tool in a recorded session, with the
// structured result that came with it.
func lastResultOf(t *testing.T, file, tool string) (claude.ToolResult, json.RawMessage) {
	t.Helper()

	raw, err := os.ReadFile(filepath.Join("..", "claude", "testdata", file))
	if err != nil {
		t.Fatalf("ReadFile(%s) = %v, want nil", file, err)
	}
	tools := map[string]string{}
	var (
		found     claude.ToolResult
		useResult json.RawMessage
		ok        bool
	)
	for line := range strings.SplitSeq(strings.TrimRight(string(raw), "\n"), "\n") {
		event, err := claude.Decode([]byte(line))
		if err != nil {
			t.Fatalf("Decode(%s) = %v, want nil", file, err)
		}
		if event.Assistant != nil {
			for _, block := range event.Assistant.Message.Content {
				if block.Type == "tool_use" {
					tools[block.ID] = block.Name
				}
			}
		}
		if event.User != nil {
			for _, r := range event.User.ToolResults() {
				if tools[r.ToolUseID] == tool {
					found, useResult, ok = r, event.User.ToolUseResult, true
				}
			}
		}
	}
	if !ok {
		t.Fatalf("no %s result in %s", tool, file)
	}
	return found, useResult
}

func TestAnOutputKeepsItsLast64KiB(t *testing.T) {
	t.Parallel()

	// The limit is written out, not derived from OutputLimit: the interface says 64 KiB.
	const kept = 64 * 1024
	text := strings.Repeat("a", 10) + strings.Repeat("b", kept)
	got, ok := session.OutputOf(&session.ActionEntry{Tool: "Bash"}, result(text, false), nil)
	if !ok {
		t.Fatal("the command has no output")
	}
	if len(got.Text) != kept || strings.Contains(got.Text, "a") || !got.Truncated {
		t.Errorf("kept %d bytes, truncated %v; want the last %d, truncated", len(got.Text), got.Truncated, kept)
	}
}
