package gh

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strconv"
	"strings"
)

// ErrNoSuchNode is a repository, an issue or a board GitHub answered NOT_FOUND
// for: it does not exist, or the account cannot see it.
var ErrNoSuchNode = errors.New("gh: not found on GitHub")

// lookupSize is how many nodes one lookup query reads.
const lookupSize = 50

// issueFields are the fields of an issue every read and every write ask for.
const issueFields = `id number title url repository { id }`

// lookupIssue reads one issue of a lookup under an alias: the alias, the
// owner, the name and the number.
const lookupIssue = `%s: repository(owner: %s, name: %s) { issue(number: %d) { ` + issueFields + ` } }
`

// lookupRepository reads one repository of a lookup under an alias: the alias,
// the owner and the name.
const lookupRepository = `%s: repository(owner: %s, name: %s) { id nameWithOwner }
`

// The mutations that write an issue and a board. The body of an issue goes by
// variable, never interpolated.
const (
	createIssueMutation = `mutation($repositoryId: ID!, $title: String!, $body: String!) {
  createIssue(input: {repositoryId: $repositoryId, title: $title, body: $body}) { issue { ` + issueFields + ` } } }`

	updateIssueMutation = `mutation($id: ID!, $title: String!, $body: String!) {
  updateIssue(input: {id: $id, title: $title, body: $body}) { issue { id } } }`

	addProjectItemMutation = `mutation($projectId: ID!, $contentId: ID!) {
  addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) { item { id } } }`

	setSingleSelectMutation = `mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
  updateProjectV2ItemFieldValue(input: {projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: {singleSelectOptionId: $optionId}}) { projectV2Item { id } } }`

	addSubIssueMutation = `mutation($issueId: ID!, $subIssueId: ID!) {
  addSubIssue(input: {issueId: $issueId, subIssueId: $subIssueId, replaceParent: true}) { issue { id } } }`

	addBlockedByMutation = `mutation($issueId: ID!, $blockingIssueId: ID!) {
  addBlockedBy(input: {issueId: $issueId, blockingIssueId: $blockingIssueId}) { issue { id } } }`
)

// IssueRef names an issue: owner/name#number.
type IssueRef struct {
	Owner  string
	Name   string
	Number int
}

// String reads owner/name#number.
func (r IssueRef) String() string {
	return r.Owner + "/" + r.Name + "#" + strconv.Itoa(r.Number)
}

// IssueNode is an issue as the writes need it.
type IssueNode struct {
	ID           string
	Number       int
	Title        string
	URL          string
	RepositoryID string
}

// issueNode is an issue as GitHub answers it.
type issueNode struct {
	ID         string `json:"id"`
	Number     int    `json:"number"`
	Title      string `json:"title"`
	URL        string `json:"url"`
	Repository struct {
		ID string `json:"id"`
	} `json:"repository"`
}

// node is the issue as the callers read it.
func (n issueNode) node() IssueNode {
	return IssueNode{
		ID:           n.ID,
		Number:       n.Number,
		Title:        n.Title,
		URL:          n.URL,
		RepositoryID: n.Repository.ID,
	}
}

// LookupIssues reads the node id, the number, the title and the url of each
// issue, in one query with aliases (i0, i1...), in chunks of 50. A reference
// GitHub does not answer is left out of the map: the caller decides what a
// missing one means.
func (r *Runner) LookupIssues(ctx context.Context, refs []IssueRef) (map[IssueRef]IssueNode, error) {
	found := map[IssueRef]IssueNode{}
	for chunk := range slices.Chunk(refs, lookupSize) {
		data, err := r.lookup(ctx, issuesQuery(chunk))
		if err != nil {
			return nil, err
		}
		for i, ref := range chunk {
			var result *struct {
				Issue *issueNode `json:"issue"`
			}
			if err := decodeAlias(data, issueAlias, i, &result); err != nil {
				return nil, fmt.Errorf("gh: decode issue %s: %w", ref, err)
			}
			if result != nil && result.Issue != nil && result.Issue.ID != "" {
				found[ref] = result.Issue.node()
			}
		}
	}
	return found, nil
}

// LookupRepositories reads the node id of each repository, by owner/name in
// lower case, in one query with aliases. A repository GitHub does not answer
// is left out of the map.
func (r *Runner) LookupRepositories(ctx context.Context, repos []string) (map[string]string, error) {
	found := map[string]string{}
	for chunk := range slices.Chunk(repos, lookupSize) {
		data, err := r.lookup(ctx, repositoriesLookupQuery(chunk))
		if err != nil {
			return nil, err
		}
		for i, repo := range chunk {
			var result *struct {
				ID string `json:"id"`
			}
			if err := decodeAlias(data, repositoryAlias, i, &result); err != nil {
				return nil, fmt.Errorf("gh: decode repository %s: %w", repo, err)
			}
			if result != nil && result.ID != "" {
				found[strings.ToLower(repo)] = result.ID
			}
		}
	}
	return found, nil
}

// CreateIssue creates an issue and answers with it.
func (r *Runner) CreateIssue(ctx context.Context, repositoryID, title, body string) (IssueNode, error) {
	var data struct {
		CreateIssue *struct {
			Issue *issueNode `json:"issue"`
		} `json:"createIssue"`
	}
	vars := Vars{"repositoryId": repositoryID, "title": title, "body": body}
	if err := r.mutate(ctx, createIssueMutation, vars, "repository "+repositoryID, &data); err != nil {
		return IssueNode{}, err
	}
	if data.CreateIssue == nil || data.CreateIssue.Issue == nil {
		return IssueNode{}, fmt.Errorf("%w: repository %s", ErrNoSuchNode, repositoryID)
	}
	return data.CreateIssue.Issue.node(), nil
}

// UpdateIssue rewrites the title and the body of an issue.
func (r *Runner) UpdateIssue(ctx context.Context, issueID, title, body string) error {
	var data struct {
		UpdateIssue *struct {
			Issue *struct {
				ID string `json:"id"`
			} `json:"issue"`
		} `json:"updateIssue"`
	}
	vars := Vars{"id": issueID, "title": title, "body": body}
	if err := r.mutate(ctx, updateIssueMutation, vars, "issue "+issueID, &data); err != nil {
		return err
	}
	if data.UpdateIssue == nil || data.UpdateIssue.Issue == nil {
		return fmt.Errorf("%w: issue %s", ErrNoSuchNode, issueID)
	}
	return nil
}

// AddProjectItem puts an issue on a board and answers with the id of its
// item. GitHub answers the item that exists when the issue is already there.
func (r *Runner) AddProjectItem(ctx context.Context, projectID, contentID string) (string, error) {
	var data struct {
		AddProjectV2ItemByID *struct {
			Item *struct {
				ID string `json:"id"`
			} `json:"item"`
		} `json:"addProjectV2ItemById"`
	}
	vars := Vars{"projectId": projectID, "contentId": contentID}
	if err := r.mutate(ctx, addProjectItemMutation, vars, "board "+projectID, &data); err != nil {
		return "", err
	}
	if data.AddProjectV2ItemByID == nil || data.AddProjectV2ItemByID.Item == nil {
		return "", fmt.Errorf("%w: board %s", ErrNoSuchNode, projectID)
	}
	return data.AddProjectV2ItemByID.Item.ID, nil
}

// SetProjectSingleSelect sets a single select field of an item of a board.
func (r *Runner) SetProjectSingleSelect(ctx context.Context, projectID, itemID, fieldID, optionID string) error {
	var data struct {
		UpdateProjectV2ItemFieldValue *struct {
			Item *struct {
				ID string `json:"id"`
			} `json:"projectV2Item"`
		} `json:"updateProjectV2ItemFieldValue"`
	}
	vars := Vars{"projectId": projectID, "itemId": itemID, "fieldId": fieldID, "optionId": optionID}
	if err := r.mutate(ctx, setSingleSelectMutation, vars, "board "+projectID, &data); err != nil {
		return err
	}
	if data.UpdateProjectV2ItemFieldValue == nil || data.UpdateProjectV2ItemFieldValue.Item == nil {
		return fmt.Errorf("%w: board %s", ErrNoSuchNode, projectID)
	}
	return nil
}

// AddSubIssue makes an issue a sub-issue of another, replacing the parent it
// has when it has one.
func (r *Runner) AddSubIssue(ctx context.Context, parentID, subIssueID string) error {
	var data struct {
		AddSubIssue *struct {
			Issue *struct {
				ID string `json:"id"`
			} `json:"issue"`
		} `json:"addSubIssue"`
	}
	vars := Vars{"issueId": parentID, "subIssueId": subIssueID}
	if err := r.mutate(ctx, addSubIssueMutation, vars, "issue "+parentID, &data); err != nil {
		return err
	}
	if data.AddSubIssue == nil || data.AddSubIssue.Issue == nil {
		return fmt.Errorf("%w: issue %s", ErrNoSuchNode, parentID)
	}
	return nil
}

// AddBlockedBy records that an issue is blocked by another.
func (r *Runner) AddBlockedBy(ctx context.Context, issueID, blockingIssueID string) error {
	var data struct {
		AddBlockedBy *struct {
			Issue *struct {
				ID string `json:"id"`
			} `json:"issue"`
		} `json:"addBlockedBy"`
	}
	vars := Vars{"issueId": issueID, "blockingIssueId": blockingIssueID}
	if err := r.mutate(ctx, addBlockedByMutation, vars, "issue "+issueID, &data); err != nil {
		return err
	}
	if data.AddBlockedBy == nil || data.AddBlockedBy.Issue == nil {
		return fmt.Errorf("%w: issue %s", ErrNoSuchNode, issueID)
	}
	return nil
}

// lookup runs a query of aliases and answers with the data by alias. A node
// GitHub answered NOT_FOUND for is one the caller asked about and does not
// exist, so it is missing data and not a failure.
func (r *Runner) lookup(ctx context.Context, query string) (map[string]json.RawMessage, error) {
	resp, err := r.GraphQL(ctx, query, nil)
	if err != nil && !HasNotFound(resp.Errors) {
		return nil, err
	}
	if len(resp.Data) == 0 {
		return nil, nil
	}
	var data map[string]json.RawMessage
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		return nil, fmt.Errorf("gh: decode lookup: %w", err)
	}
	return data, nil
}

// mutate runs a mutation and decodes its data into out. A node GitHub cannot
// resolve is ErrNoSuchNode with subject, the node the mutation was about. A
// mutation GitHub refused answers with the data null next to the reason, which
// is what comes back, because it is what the user needs to read.
func (r *Runner) mutate(ctx context.Context, mutation string, vars Vars, subject string, out any) error {
	resp, err := r.GraphQL(ctx, mutation, vars)
	if HasNotFound(resp.Errors) {
		return fmt.Errorf("%w: %s", ErrNoSuchNode, subject)
	}
	if err != nil {
		return err
	}
	if refused := refusalOf(resp.Errors); refused != nil {
		return fmt.Errorf("gh: mutation on %s: %w", subject, refused)
	}
	if len(resp.Data) == 0 || string(resp.Data) == "null" {
		return fmt.Errorf("%w: %s", ErrNoSuchNode, subject)
	}
	if err := json.Unmarshal(resp.Data, out); err != nil {
		return fmt.Errorf("gh: decode mutation: %w", err)
	}
	return nil
}

// issuesQuery is the query that reads refs, each under its alias.
func issuesQuery(refs []IssueRef) string {
	var b strings.Builder
	b.WriteString("query {\n")
	for i, ref := range refs {
		fmt.Fprintf(&b, lookupIssue, lookupAlias(issueAlias, i), strconv.Quote(ref.Owner), strconv.Quote(ref.Name), ref.Number)
	}
	b.WriteString("}\n")
	return b.String()
}

// repositoriesLookupQuery is the query that reads repos, each under its alias.
// A name that is not owner/name reads nothing, and is left out of the answer.
func repositoriesLookupQuery(repos []string) string {
	var b strings.Builder
	b.WriteString("query {\n")
	for i, repo := range repos {
		owner, name, _ := strings.Cut(repo, "/")
		fmt.Fprintf(&b, lookupRepository, lookupAlias(repositoryAlias, i), strconv.Quote(owner), strconv.Quote(name))
	}
	b.WriteString("}\n")
	return b.String()
}

// The prefixes of the aliases of a lookup, one per kind of node.
const (
	issueAlias      = "i"
	repositoryAlias = "r"
)

// lookupAlias is the alias of the i-th node of a lookup of kind prefix.
func lookupAlias(prefix string, i int) string { return prefix + strconv.Itoa(i) }

// decodeAlias decodes the i-th alias of data into out, which stays nil when
// GitHub did not answer it.
func decodeAlias(data map[string]json.RawMessage, prefix string, i int, out any) error {
	raw, ok := data[lookupAlias(prefix, i)]
	if !ok {
		return nil
	}
	return json.Unmarshal(raw, out)
}
