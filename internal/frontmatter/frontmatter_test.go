package frontmatter_test

import (
	"maps"
	"testing"

	"github.com/guilhermt/myspec/internal/frontmatter"
)

func TestSplitReadsTheHeaderAndTheBody(t *testing.T) {
	t.Parallel()

	content := "---\ntitle: Add the login screen\nbase: dev\n---\n\nThe body.\n"
	fields, body := frontmatter.Split(content)

	want := map[string]string{"title": "Add the login screen", "base": "dev"}
	if !maps.Equal(fields, want) {
		t.Errorf("fields = %v, want %v", fields, want)
	}
	if body != "\nThe body.\n" {
		t.Errorf("body = %q, want the text after the header", body)
	}
}

func TestSplitTakesContentWithNoHeaderAsAllBody(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		content string
	}{
		{"no fence at all", "# A report\n\nNothing else.\n"},
		{"a fence that never closes", "---\ntitle: Add the login screen\n\nThe body.\n"},
		{"a fence that does not open the file", "\n---\ntitle: Add the login screen\n---\n"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			fields, body := frontmatter.Split(test.content)
			if fields != nil {
				t.Errorf("fields = %v, want nil", fields)
			}
			if body != test.content {
				t.Errorf("body = %q, want the content untouched", body)
			}
		})
	}
}

func TestSplitUnwrapsAValueAndIgnoresALineWithNoColon(t *testing.T) {
	t.Parallel()

	content := "---\ntitle: \"Add the login screen\"\nbase: 'dev'\npath: `pr/draft.md`\njust a line\n---\nbody"
	fields, body := frontmatter.Split(content)

	want := map[string]string{
		"title": "Add the login screen",
		"base":  "dev",
		"path":  "pr/draft.md",
	}
	if !maps.Equal(fields, want) {
		t.Errorf("fields = %v, want %v", fields, want)
	}
	if body != "body" {
		t.Errorf("body = %q, want %q", body, "body")
	}
}

func TestSplitReadsAHeaderWrittenWithCarriageReturns(t *testing.T) {
	t.Parallel()

	fields, body := frontmatter.Split("---\r\ntitle: Add the login screen\r\n---\r\nbody\r\n")
	if got := fields["title"]; got != "Add the login screen" {
		t.Errorf("title = %q, want %q", got, "Add the login screen")
	}
	if body != "body\n" {
		t.Errorf("body = %q, want %q", body, "body\n")
	}
}

func TestSplitKeepsAnEmptyHeader(t *testing.T) {
	t.Parallel()

	fields, body := frontmatter.Split("---\n---\nbody")
	if fields == nil || len(fields) != 0 {
		t.Errorf("fields = %v, want an empty map", fields)
	}
	if body != "body" {
		t.Errorf("body = %q, want %q", body, "body")
	}
}
