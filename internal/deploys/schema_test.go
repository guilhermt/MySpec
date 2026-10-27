package deploys_test

import (
	"os"
	"testing"

	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"
	"github.com/vektah/gqlparser/v2/validator"

	"github.com/guilhermt/myspec/internal/deploys"
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
	repositories := []deploys.Target{
		{ID: "repo-1", Owner: "acme", Name: "api", Environments: threeEnvironments()},
		{ID: "repo-2", Owner: "acme", Name: "web", Environments: threeEnvironments()},
	}
	tests := []struct {
		name  string
		query string
	}{
		{"two repositories of three environments", deploys.ReadQuery(repositories)},
		{"names with quotes", deploys.ReadQuery([]deploys.Target{{Owner: `a"b`, Name: `c\d`, Environments: threeEnvironments()[:2]}})},
		{"the branches of the options", deploys.BranchesQuery("acme", "api", []string{"dev", "main"})},
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
