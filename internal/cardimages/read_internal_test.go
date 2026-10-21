package cardimages

import (
	"os"
	"strconv"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"
	"github.com/vektah/gqlparser/v2/validator"
)

func TestTheImagesOfABodyComeInDocumentOrderWithoutEmojiOrEmptySources(t *testing.T) {
	t.Parallel()

	body, err := os.ReadFile("testdata/body.html")
	if err != nil {
		t.Fatalf("read body: %v", err)
	}
	want := []found{
		{
			src: "https://private-user-images.githubusercontent.com/85903764/675031994-2e53d98e-1f4c-4b7e-9a01-5d3c7a1b8e22.png?jwt=eyJhbGciOiJIUzI1NiJ9.fake.signature",
			alt: "Logo do MySpec",
		},
		{
			src:       "https://camo.githubusercontent.com/0123456789abcdef/68747470733a2f2f6578616d706c652e636f6d2f6469616772616d2e706e67",
			canonical: "https://example.com/diagram.png",
		},
	}
	if diff := cmp.Diff(want, imagesOf(string(body)), cmp.AllowUnexported(found{})); diff != "" {
		t.Errorf("imagesOf (-want +got):\n%s", diff)
	}
}

func TestAnAttachmentOfTheMarkdownAndOneOfTheHTMLShareASourceKey(t *testing.T) {
	t.Parallel()

	const id = "2e53d98e-1f4c-4b7e-9a01-5d3c7a1b8e22"
	tests := []struct {
		name string
		src  string
		want string
	}{
		{"user-attachments of the Markdown", "https://github.com/user-attachments/assets/" + id, "github:" + id},
		{"signed URL of the HTML", "https://private-user-images.githubusercontent.com/85903764/675031994-" + id + ".png?jwt=abc", "github:" + id},
		{"old user-images URL", "https://user-images.githubusercontent.com/1/" + id + ".png", "github:" + id},
		{"upper case UUID", "https://github.com/user-attachments/assets/2E53D98E-1F4C-4B7E-9A01-5D3C7A1B8E22", "github:" + id},
		{"another host keeps the URL", "https://example.com/" + id + ".png", "https://example.com/" + id + ".png"},
		{"a github.com path without UUID keeps the URL", "https://github.com/o/n/raw/main/a.png", "https://github.com/o/n/raw/main/a.png"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if got := sourceKey(tt.src); got != tt.want {
				t.Errorf("sourceKey(%q) = %q, want %q", tt.src, got, tt.want)
			}
		})
	}
}

func TestTheBodyQueryIsValidAgainstTheGitHubSchema(t *testing.T) {
	t.Parallel()

	source, err := os.ReadFile("../pulls/testdata/schema.docs.graphql")
	if err != nil {
		t.Fatalf("read schema: %v", err)
	}
	schema, err := gqlparser.LoadSchema(&ast.Source{Name: "schema.docs.graphql", Input: string(source)})
	if err != nil {
		t.Fatalf("load schema: %v", err)
	}
	for _, n := range []int{1, batchSize} {
		t.Run(strconv.Itoa(n)+" issues", func(t *testing.T) {
			t.Parallel()
			issues := make([]Issue, n)
			for i := range issues {
				issues[i] = Issue{Owner: "o", Name: "n", Number: i + 1}
			}
			doc, err := parser.ParseQuery(&ast.Source{Name: "bodies", Input: bodyBatch(issues)})
			if err != nil {
				t.Fatalf("parse query: %v", err)
			}
			if errs := validator.ValidateWithRules(schema, doc, nil); len(errs) > 0 {
				t.Fatalf("query does not validate against the GitHub schema: %v", errs)
			}
		})
	}
}
