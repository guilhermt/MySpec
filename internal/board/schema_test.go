package board_test

import (
	"fmt"
	"os"
	"testing"

	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"
	"github.com/vektah/gqlparser/v2/validator"

	"github.com/guilhermt/myspec/internal/board"
)

// githubSchema loads the public schema of the GitHub GraphQL API that pulls
// keeps in testdata.
func githubSchema(t *testing.T) *ast.Schema {
	t.Helper()

	source, err := os.ReadFile("../pulls/testdata/schema.docs.graphql")
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
	refs := []board.Ref{{Owner: "acme", Name: "api", Number: 1}, {Owner: `a"b`, Name: `c\d`, Number: 2}}
	tests := []struct {
		name  string
		query string
	}{
		{"the structure of an organization board", fmt.Sprintf(board.StructureQuery, "organization")},
		{"the structure of a user board", fmt.Sprintf(board.StructureQuery, "user")},
		{"the items", fmt.Sprintf(board.ItemsQuery, "organization") + board.Fragments},
		{"the stamps of the items", fmt.Sprintf(board.StampsQuery, "organization") + board.StampFragments},
		{"the repositories of the items", fmt.Sprintf(board.RepositoriesQuery, "user")},
		{"a repository", board.RepositoryQuery},
		{"a batch of issues", board.BatchQuery(refs)},
		{"a batch of stamps", board.StampBatchQuery(refs)},
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
