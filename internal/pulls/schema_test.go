package pulls

import (
	"os"
	"testing"

	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"
	"github.com/vektah/gqlparser/v2/validator"
)

// githubSchema loads the public schema of the GitHub GraphQL API kept in
// testdata; it is refreshed from https://docs.github.com/public/fpt/schema.docs.graphql
// when a query changes.
func githubSchema(t *testing.T) *ast.Schema {
	t.Helper()
	source, err := os.ReadFile("testdata/schema.docs.graphql")
	if err != nil {
		t.Fatalf("read schema: %v", err)
	}
	schema, err := gqlparser.LoadSchema(&ast.Source{Name: "schema.docs.graphql", Input: string(source)})
	if err != nil {
		t.Fatalf("load schema: %v", err)
	}
	return schema
}

func TestEveryQueryIsValidAgainstTheGitHubSchema(t *testing.T) {
	t.Parallel()

	schema := githubSchema(t)
	tests := []struct {
		name  string
		query string
	}{
		{"viewer", viewerQuery},
		{"list of one repository", listQuery(1)},
		{"list of a full batch", listQuery(batchSize)},
		{"detail of one pull request", detailQuery(1)},
		{"detail of a full batch", detailQuery(batchSize)},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			doc, err := parser.ParseQuery(&ast.Source{Name: tt.name, Input: tt.query})
			if err != nil {
				t.Fatalf("parse query: %v", err)
			}
			if errs := validator.ValidateWithRules(schema, doc, nil); len(errs) > 0 {
				t.Fatalf("query does not validate against the GitHub schema: %v", errs)
			}
		})
	}
}
