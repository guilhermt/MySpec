package gh_test

import (
	"errors"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/gh/ghtest"
)

// issueJSON is an issue as GitHub answers it.
const issueJSON = `{"id":"I_1","number":7,"title":"Export invoices","url":"https://github.com/acme/web/issues/7",` +
	`"repository":{"id":"R_1"}}`

func TestLookupIssuesReadsEachIssueUnderItsAlias(t *testing.T) {
	t.Parallel()
	r, fake := runner(t, map[string]ghtest.Reply{"api": {
		Stdout: `{"data":{"i0":{"issue":` + issueJSON + `},"i1":{"issue":{"id":"I_2","number":9,"title":"Sign in",` +
			`"url":"https://github.com/acme/api/issues/9","repository":{"id":"R_2"}}}}}`,
	}})

	first := gh.IssueRef{Owner: "acme", Name: "web", Number: 7}
	second := gh.IssueRef{Owner: "acme", Name: "api", Number: 9}
	got, err := r.LookupIssues(t.Context(), []gh.IssueRef{first, second})
	if err != nil {
		t.Fatalf("LookupIssues() = %v, want nil", err)
	}
	want := map[gh.IssueRef]gh.IssueNode{
		first:  {ID: "I_1", Number: 7, Title: "Export invoices", URL: "https://github.com/acme/web/issues/7", RepositoryID: "R_1"},
		second: {ID: "I_2", Number: 9, Title: "Sign in", URL: "https://github.com/acme/api/issues/9", RepositoryID: "R_2"},
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("LookupIssues() mismatch (-want +got):\n%s", diff)
	}
	args := fake.Calls(t)[0].Args
	for _, want := range []string{`i0: repository(owner: "acme", name: "web") { issue(number: 7)`, `i1: repository(owner: "acme", name: "api") { issue(number: 9)`} {
		if !strings.Contains(args, want) {
			t.Errorf("query = %q, want it to contain %q", args, want)
		}
	}
}

func TestLookupIssuesLeavesOutTheReferencesGitHubDoesNotAnswer(t *testing.T) {
	t.Parallel()
	r, _ := runner(t, map[string]ghtest.Reply{"api": {
		Stdout: `{"data":{"i0":{"issue":` + issueJSON + `},"i1":{"issue":null}},` +
			`"errors":[{"type":"NOT_FOUND","message":"Could not resolve to an Issue with the number of 9.","path":["i1"]}]}`,
		Stderr: "gh: Could not resolve to an Issue with the number of 9.",
		Exit:   1,
	}})

	first := gh.IssueRef{Owner: "acme", Name: "web", Number: 7}
	missing := gh.IssueRef{Owner: "acme", Name: "web", Number: 9}
	got, err := r.LookupIssues(t.Context(), []gh.IssueRef{first, missing})
	if err != nil {
		t.Fatalf("LookupIssues() = %v, want nil for a missing issue", err)
	}
	if len(got) != 1 || got[first].ID != "I_1" {
		t.Errorf("LookupIssues() = %+v, want only the issue that exists", got)
	}
}

func TestLookupIssuesAnswersNothingWhenNoReferenceExists(t *testing.T) {
	t.Parallel()
	// GitHub answers no data at all when every reference of the query is
	// missing, and gh fails; the references are still just missing.
	r, _ := runner(t, map[string]ghtest.Reply{"api": {
		Stdout: `{"data":null,"errors":[{"type":"NOT_FOUND","message":"Could not resolve to an Issue with the number of 7.","path":["i0"]}]}`,
		Stderr: "gh: Could not resolve to an Issue with the number of 7.",
		Exit:   1,
	}})

	got, err := r.LookupIssues(t.Context(), []gh.IssueRef{{Owner: "acme", Name: "web", Number: 7}})
	if err != nil {
		t.Fatalf("LookupIssues() = %v, want nil for a missing issue", err)
	}
	if len(got) != 0 {
		t.Errorf("LookupIssues() = %+v, want no issue", got)
	}
}

func TestLookupIssuesReadsInChunksOfFifty(t *testing.T) {
	t.Parallel()
	r, fake := runner(t, map[string]ghtest.Reply{"api": {Stdout: `{"data":{}}`}})

	refs := make([]gh.IssueRef, 51)
	for i := range refs {
		refs[i] = gh.IssueRef{Owner: "acme", Name: "web", Number: i + 1}
	}
	if _, err := r.LookupIssues(t.Context(), refs); err != nil {
		t.Fatalf("LookupIssues() = %v, want nil", err)
	}
	if calls := fake.Calls(t); len(calls) != 2 {
		t.Errorf("calls = %d, want 2 for 51 references", len(calls))
	}
}

func TestLookupIssuesReportsATokenWithoutTheProjectScope(t *testing.T) {
	t.Parallel()
	r, _ := runner(t, map[string]ghtest.Reply{"api": {
		Stdout: `{"errors":[{"type":"INSUFFICIENT_SCOPES","message":"Your token has not been granted the required scopes."}]}`,
		Stderr: "gh: Your token has not been granted the required scopes.",
		Exit:   1,
	}})

	_, err := r.LookupIssues(t.Context(), []gh.IssueRef{{Owner: "acme", Name: "web", Number: 7}})
	if !errors.Is(err, gh.ErrMissingScope) {
		t.Errorf("LookupIssues() = %v, want ErrMissingScope", err)
	}
}

func TestLookupRepositoriesReadsTheNodeIdByOwnerAndName(t *testing.T) {
	t.Parallel()
	r, fake := runner(t, map[string]ghtest.Reply{"api": {
		Stdout: `{"data":{"r0":{"id":"R_1","nameWithOwner":"acme/web"},"r1":null},` +
			`"errors":[{"type":"NOT_FOUND","message":"Could not resolve to a Repository."}]}`,
		Stderr: "gh: Could not resolve to a Repository.",
		Exit:   1,
	}})

	got, err := r.LookupRepositories(t.Context(), []string{"Acme/Web", "acme/gone"})
	if err != nil {
		t.Fatalf("LookupRepositories() = %v, want nil", err)
	}
	want := map[string]string{"acme/web": "R_1"}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("LookupRepositories() mismatch (-want +got):\n%s", diff)
	}
	if args := fake.Calls(t)[0].Args; !strings.Contains(args, `r0: repository(owner: "Acme", name: "Web") { id nameWithOwner }`) {
		t.Errorf("query = %q, want it to read the repository under its alias", args)
	}
}

func TestCreateIssueAnswersTheIssueWithTheBodyAsAVariable(t *testing.T) {
	t.Parallel()
	r, fake := runner(t, map[string]ghtest.Reply{"api": {Stdout: `{"data":{"createIssue":{"issue":` + issueJSON + `}}}`}})

	got, err := r.CreateIssue(t.Context(), "R_1", "Export invoices", "A body with $vars and \"quotes\".")
	if err != nil {
		t.Fatalf("CreateIssue() = %v, want nil", err)
	}
	want := gh.IssueNode{ID: "I_1", Number: 7, Title: "Export invoices", URL: "https://github.com/acme/web/issues/7", RepositoryID: "R_1"}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("CreateIssue() mismatch (-want +got):\n%s", diff)
	}
	args := fake.Calls(t)[0].Args
	if !strings.Contains(args, `-f body=A body with $vars and "quotes".`) {
		t.Errorf("args = %q, want the body as a variable", args)
	}
}

func TestCreateIssueReportsARepositoryGitHubCannotResolve(t *testing.T) {
	t.Parallel()
	r, _ := runner(t, map[string]ghtest.Reply{"api": {
		Stdout: `{"data":null,"errors":[{"type":"NOT_FOUND","message":"Could not resolve to a node with the global id of 'R_x'."}]}`,
		Stderr: "gh: Could not resolve to a node.",
		Exit:   1,
	}})

	_, err := r.CreateIssue(t.Context(), "R_x", "Export invoices", "body")
	if !errors.Is(err, gh.ErrNoSuchNode) {
		t.Fatalf("CreateIssue() = %v, want ErrNoSuchNode", err)
	}
	if !strings.Contains(err.Error(), "R_x") {
		t.Errorf("CreateIssue() = %q, want it to name the repository", err)
	}
}

func TestCreateIssueReportsAnAnswerWithoutTheIssue(t *testing.T) {
	t.Parallel()
	r, _ := runner(t, map[string]ghtest.Reply{"api": {Stdout: `{"data":{"createIssue":null}}`}})

	_, err := r.CreateIssue(t.Context(), "R_1", "Export invoices", "body")
	if !errors.Is(err, gh.ErrNoSuchNode) {
		t.Errorf("CreateIssue() = %v, want ErrNoSuchNode", err)
	}
}

func TestCreateIssueSaysWhatGitHubRefusedTheMutationWith(t *testing.T) {
	t.Parallel()
	r, _ := runner(t, map[string]ghtest.Reply{"api": {
		Stdout: `{"data":{"createIssue":null},"errors":[{"type":"FORBIDDEN","message":"Resource not accessible by integration"}]}`,
		Stderr: "gh: Resource not accessible by integration",
		Exit:   1,
	}})

	_, err := r.CreateIssue(t.Context(), "R_1", "Export invoices", "body")
	if err == nil {
		t.Fatalf("CreateIssue() = nil, want what GitHub refused it with")
	}
	if errors.Is(err, gh.ErrNoSuchNode) {
		t.Errorf("CreateIssue() = %v, want a refusal and not ErrNoSuchNode", err)
	}
	var ghErr *gh.Error
	if !errors.As(err, &ghErr) {
		t.Fatalf("CreateIssue() = %v, want a *gh.Error", err)
	}
	if ghErr.Output != "Resource not accessible by integration" {
		t.Errorf("Output = %q, want what GitHub said", ghErr.Output)
	}
}

func TestAMutationThatWasPerformedNextToAnErrorEntryAnswersWithTheIssue(t *testing.T) {
	t.Parallel()
	r, _ := runner(t, map[string]ghtest.Reply{"api": {
		Stdout: `{"data":{"createIssue":{"issue":{"id":"I_1","number":7,"title":"Export invoices",` +
			`"url":"https://github.com/acme/web/issues/7","repository":{"id":"R_1"}}}},` +
			`"errors":[{"type":"SERVICE_UNAVAILABLE","message":"Something went wrong while executing your query."}]}`,
		Stderr: "gh: Something went wrong while executing your query.",
		Exit:   1,
	}})

	got, err := r.CreateIssue(t.Context(), "R_1", "Export invoices", "body")
	if err != nil {
		t.Fatalf("CreateIssue() = %v, want nil", err)
	}
	want := gh.IssueNode{ID: "I_1", Number: 7, Title: "Export invoices", URL: "https://github.com/acme/web/issues/7", RepositoryID: "R_1"}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("CreateIssue() mismatch (-want +got):\n%s", diff)
	}
}

func TestUpdateIssueRewritesTheTitleAndTheBody(t *testing.T) {
	t.Parallel()
	r, fake := runner(t, map[string]ghtest.Reply{"api": {Stdout: `{"data":{"updateIssue":{"issue":{"id":"I_1"}}}}`}})

	if err := r.UpdateIssue(t.Context(), "I_1", "Export invoices", "body"); err != nil {
		t.Fatalf("UpdateIssue() = %v, want nil", err)
	}
	args := fake.Calls(t)[0].Args
	for _, want := range []string{"-f body=body", "-f id=I_1", "-f title=Export invoices"} {
		if !strings.Contains(args, want) {
			t.Errorf("args = %q, want it to contain %q", args, want)
		}
	}
}

func TestUpdateIssueReportsAnIssueGitHubCannotResolve(t *testing.T) {
	t.Parallel()
	r, _ := runner(t, map[string]ghtest.Reply{"api": {Stdout: `{"data":{"updateIssue":{"issue":null}}}`}})

	err := r.UpdateIssue(t.Context(), "I_x", "Export invoices", "body")
	if !errors.Is(err, gh.ErrNoSuchNode) {
		t.Errorf("UpdateIssue() = %v, want ErrNoSuchNode", err)
	}
}

func TestAddProjectItemAnswersTheIdOfTheItem(t *testing.T) {
	t.Parallel()
	r, fake := runner(t, map[string]ghtest.Reply{"api": {
		Stdout: `{"data":{"addProjectV2ItemById":{"item":{"id":"PVTI_1"}}}}`,
	}})

	got, err := r.AddProjectItem(t.Context(), "PVT_1", "I_1")
	if err != nil {
		t.Fatalf("AddProjectItem() = %v, want nil", err)
	}
	if got != "PVTI_1" {
		t.Errorf("AddProjectItem() = %q, want the id of the item", got)
	}
	if args := fake.Calls(t)[0].Args; !strings.Contains(args, "-f contentId=I_1") || !strings.Contains(args, "-f projectId=PVT_1") {
		t.Errorf("args = %q, want the board and the issue", args)
	}
}

func TestAddProjectItemReportsABoardGitHubCannotResolve(t *testing.T) {
	t.Parallel()
	r, _ := runner(t, map[string]ghtest.Reply{"api": {
		Stdout: `{"data":null,"errors":[{"type":"NOT_FOUND","message":"Could not resolve to a ProjectV2."}]}`,
		Stderr: "gh: Could not resolve to a ProjectV2.",
		Exit:   1,
	}})

	_, err := r.AddProjectItem(t.Context(), "PVT_x", "I_1")
	if !errors.Is(err, gh.ErrNoSuchNode) {
		t.Errorf("AddProjectItem() = %v, want ErrNoSuchNode", err)
	}
}

func TestSetProjectSingleSelectSendsTheOption(t *testing.T) {
	t.Parallel()
	r, fake := runner(t, map[string]ghtest.Reply{"api": {
		Stdout: `{"data":{"updateProjectV2ItemFieldValue":{"projectV2Item":{"id":"PVTI_1"}}}}`,
	}})

	if err := r.SetProjectSingleSelect(t.Context(), "PVT_1", "PVTI_1", "F_1", "OPT_1"); err != nil {
		t.Fatalf("SetProjectSingleSelect() = %v, want nil", err)
	}
	args := fake.Calls(t)[0].Args
	for _, want := range []string{"-f fieldId=F_1", "-f itemId=PVTI_1", "-f optionId=OPT_1", "-f projectId=PVT_1"} {
		if !strings.Contains(args, want) {
			t.Errorf("args = %q, want it to contain %q", args, want)
		}
	}
}

func TestAddSubIssueReplacesTheParent(t *testing.T) {
	t.Parallel()
	r, fake := runner(t, map[string]ghtest.Reply{"api": {Stdout: `{"data":{"addSubIssue":{"issue":{"id":"I_1"}}}}`}})

	if err := r.AddSubIssue(t.Context(), "I_1", "I_2"); err != nil {
		t.Fatalf("AddSubIssue() = %v, want nil", err)
	}
	args := fake.Calls(t)[0].Args
	if !strings.Contains(args, "replaceParent: true") {
		t.Errorf("query = %q, want it to replace the parent", args)
	}
	if !strings.Contains(args, "-f issueId=I_1") || !strings.Contains(args, "-f subIssueId=I_2") {
		t.Errorf("args = %q, want the parent and the sub-issue", args)
	}
}

func TestAddBlockedByRecordsTheDependency(t *testing.T) {
	t.Parallel()
	r, fake := runner(t, map[string]ghtest.Reply{"api": {Stdout: `{"data":{"addBlockedBy":{"issue":{"id":"I_1"}}}}`}})

	if err := r.AddBlockedBy(t.Context(), "I_1", "I_2"); err != nil {
		t.Fatalf("AddBlockedBy() = %v, want nil", err)
	}
	if args := fake.Calls(t)[0].Args; !strings.Contains(args, "-f blockingIssueId=I_2") || !strings.Contains(args, "-f issueId=I_1") {
		t.Errorf("args = %q, want the issue and the one blocking it", args)
	}
}

func TestAddBlockedByReportsWhatGhSaid(t *testing.T) {
	t.Parallel()
	r, _ := runner(t, map[string]ghtest.Reply{"api": {
		Stderr: "gh: Field 'addBlockedBy' doesn't exist on type 'Mutation'",
		Exit:   1,
	}})

	err := r.AddBlockedBy(t.Context(), "I_1", "I_2")
	var ghErr *gh.Error
	if !errors.As(err, &ghErr) {
		t.Fatalf("AddBlockedBy() = %v, want *gh.Error", err)
	}
	if !strings.Contains(ghErr.Output, "addBlockedBy") {
		t.Errorf("Output = %q, want what gh said", ghErr.Output)
	}
}
