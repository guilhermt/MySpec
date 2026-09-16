package board

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"
	"strconv"
	"strings"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/task"
)

// GraphQL is gh.Runner.GraphQL.
type GraphQL interface {
	GraphQL(ctx context.Context, query string, vars gh.Vars) (gh.Response, error)
}

// fragments are the parts of an issue and of a board item the reads share.
const fragments = `
fragment prs on Issue { closedByPullRequestsReferences(first: 10, includeClosedPrs: true) { nodes { number url state repository { nameWithOwner } } } }
fragment brief on Issue { number title url state repository { nameWithOwner } }
fragment values on ProjectV2Item { fieldValues(first: 30) { nodes { __typename
  ... on ProjectV2ItemFieldSingleSelectValue { name optionId field { ... on ProjectV2FieldCommon { name } } }
  ... on ProjectV2ItemFieldTextValue { text field { ... on ProjectV2FieldCommon { name } } }
  ... on ProjectV2ItemFieldNumberValue { number field { ... on ProjectV2FieldCommon { name } } }
  ... on ProjectV2ItemFieldDateValue { date field { ... on ProjectV2FieldCommon { name } } }
  ... on ProjectV2ItemFieldIterationValue { title field { ... on ProjectV2FieldCommon { name } } } } } }
fragment card on Issue { ...brief body
  assignees(first: 10) { nodes { login avatarUrl } }
  parent { ...brief body }
  blockedBy(first: 20) { nodes { ...brief ...prs } }
  ...prs }
`

// structureQuery reads the title, the Status field and the fields of a board,
// and the viewer. The %s is the owner type.
const structureQuery = `query($owner: String!, $number: Int!) { viewer { login }
  owner: %s(login: $owner) { projectV2(number: $number) { id title url
    field(name: "Status") { ... on ProjectV2SingleSelectField { id options { id name } } }
    fields(first: 50) { nodes { ... on ProjectV2FieldCommon { name dataType } } } } } }`

// itemsQuery reads one page of the items of a board that match q. The %s is
// the owner type.
const itemsQuery = `query($owner: String!, $number: Int!, $q: String!, $cursor: String) {
  owner: %s(login: $owner) { projectV2(number: $number) {
    items(first: 100, after: $cursor, query: $q) { pageInfo { hasNextPage endCursor }
      nodes { ...values content { __typename ... on Issue { ...card } } } } } } }`

// batchIssue reads one issue of a batch under an alias: the alias, the owner,
// the name and the number.
const batchIssue = `%s: repository(owner: %s, name: %s) { issue(number: %d) { ...card
  subIssues(first: 50) { nodes { ...brief } }
  projectItems(first: 20) { nodes { project { id } ...values } } } }
`

// The GraphQL names the reading tells apart.
const (
	typeNotFound      = "NOT_FOUND"
	typeIssue         = "Issue"
	statusField       = "Status"
	typeSingleSelect  = "ProjectV2ItemFieldSingleSelectValue"
	typeTextValue     = "ProjectV2ItemFieldTextValue"
	typeNumberValue   = "ProjectV2ItemFieldNumberValue"
	typeDateValue     = "ProjectV2ItemFieldDateValue"
	typeIterationItem = "ProjectV2ItemFieldIterationValue"
)

// valueDataTypes are the data types of the fields whose values a card shows.
var valueDataTypes = []string{"TEXT", "NUMBER", "DATE", "SINGLE_SELECT", "ITERATION"}

// structure is what the structure query found of a board.
type structure struct {
	ProjectID   string
	Title       string
	URL         string
	Viewer      string
	Statuses    []Option        // board order; never nil
	HasStatus   bool            // the Status field is a single select with options
	ValueFields map[string]bool // the names of the fields whose values a card shows
}

type repositoryNode struct {
	NameWithOwner string `json:"nameWithOwner"`
}

// split is owner and name.
func (r repositoryNode) split() (owner, name string) {
	owner, name, _ = strings.Cut(r.NameWithOwner, "/")
	return owner, name
}

type briefNode struct {
	Number     int            `json:"number"`
	Title      string         `json:"title"`
	URL        string         `json:"url"`
	State      string         `json:"state"`
	Repository repositoryNode `json:"repository"`
}

// issue is the node as an Issue.
func (n briefNode) issue() Issue {
	owner, name := n.Repository.split()
	return Issue{
		Owner:  owner,
		Name:   name,
		Number: n.Number,
		Title:  n.Title,
		URL:    n.URL,
		State:  task.IssueState(strings.ToLower(n.State)),
	}
}

// key is the key of the issue.
func (n briefNode) key() string {
	owner, name := n.Repository.split()
	return task.IssueKey(owner, name, n.Number)
}

type pullRequestNode struct {
	Number     int            `json:"number"`
	URL        string         `json:"url"`
	State      string         `json:"state"`
	Repository repositoryNode `json:"repository"`
}

type pullRequestsNode struct {
	Nodes []pullRequestNode `json:"nodes"`
}

// list is the pull requests; never nil.
func (n pullRequestsNode) list() []PullRequest {
	prs := make([]PullRequest, 0, len(n.Nodes))
	for _, pr := range n.Nodes {
		owner, name := pr.Repository.split()
		prs = append(prs, PullRequest{
			Owner:  owner,
			Name:   name,
			Number: pr.Number,
			URL:    pr.URL,
			State:  PRState(strings.ToLower(pr.State)),
		})
	}
	return prs
}

type epicNode struct {
	briefNode
	Body string `json:"body"`
}

type blockerNode struct {
	briefNode
	ClosedByPullRequestsReferences pullRequestsNode `json:"closedByPullRequestsReferences"`
}

type fieldValueNode struct {
	Typename string  `json:"__typename"`
	Name     string  `json:"name"`
	OptionID string  `json:"optionId"`
	Text     string  `json:"text"`
	Number   float64 `json:"number"`
	Date     string  `json:"date"`
	Title    string  `json:"title"`
	Field    struct {
		Name string `json:"name"`
	} `json:"field"`
}

type fieldValuesNode struct {
	Nodes []fieldValueNode `json:"nodes"`
}

// projectItemNode is the item of an issue in a board.
type projectItemNode struct {
	Project struct {
		ID string `json:"id"`
	} `json:"project"`
	FieldValues fieldValuesNode `json:"fieldValues"`
}

// issueNode is an issue as the items and the batch read it; the sub-issues and
// the board items come only from the batch.
type issueNode struct {
	briefNode
	Body      string `json:"body"`
	Assignees struct {
		Nodes []Assignee `json:"nodes"`
	} `json:"assignees"`
	Parent    *epicNode `json:"parent"`
	BlockedBy struct {
		Nodes []blockerNode `json:"nodes"`
	} `json:"blockedBy"`
	ClosedByPullRequestsReferences pullRequestsNode `json:"closedByPullRequestsReferences"`
	SubIssues                      struct {
		Nodes []briefNode `json:"nodes"`
	} `json:"subIssues"`
	ProjectItems struct {
		Nodes []projectItemNode `json:"nodes"`
	} `json:"projectItems"`
}

// valuesIn is the field values of the issue's item in the board projectID.
func (n issueNode) valuesIn(projectID string) fieldValuesNode {
	for _, item := range n.ProjectItems.Nodes {
		if item.Project.ID == projectID {
			return item.FieldValues
		}
	}
	return fieldValuesNode{}
}

type itemNode struct {
	FieldValues fieldValuesNode `json:"fieldValues"`
	Content     *struct {
		Typename string `json:"__typename"`
		issueNode
	} `json:"content"`
}

// itemsPage is one page of the items of a board.
type itemsPage struct {
	Items       []itemNode
	HasNextPage bool
	EndCursor   string
}

// readStructure runs the structure query for the board at loc. It fails with
// a *Failure.
func (s *Service) readStructure(ctx context.Context, loc Locator) (structure, error) {
	resp, err := s.github.GraphQL(ctx, fmt.Sprintf(structureQuery, loc.OwnerType), gh.Vars{
		"owner":  loc.Owner,
		"number": loc.Number,
	})
	if err != nil {
		if hasNotFound(resp.Errors) {
			return structure{}, &Failure{Reason: ReasonNotFound}
		}
		return structure{}, failureOf(err)
	}
	var data struct {
		Viewer struct {
			Login string `json:"login"`
		} `json:"viewer"`
		Owner *struct {
			ProjectV2 *struct {
				ID    string `json:"id"`
				Title string `json:"title"`
				URL   string `json:"url"`
				Field *struct {
					Options []Option `json:"options"`
				} `json:"field"`
				Fields struct {
					Nodes []struct {
						Name     string `json:"name"`
						DataType string `json:"dataType"`
					} `json:"nodes"`
				} `json:"fields"`
			} `json:"projectV2"`
		} `json:"owner"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		return structure{}, failureOf(fmt.Errorf("decode board structure: %w", err))
	}
	if data.Owner == nil || data.Owner.ProjectV2 == nil {
		return structure{}, &Failure{Reason: ReasonNotFound}
	}
	project := data.Owner.ProjectV2
	st := structure{
		ProjectID:   project.ID,
		Title:       project.Title,
		URL:         project.URL,
		Viewer:      data.Viewer.Login,
		Statuses:    []Option{},
		ValueFields: map[string]bool{},
	}
	if project.Field != nil && len(project.Field.Options) > 0 {
		st.Statuses = project.Field.Options
		st.HasStatus = true
	}
	for _, f := range project.Fields.Nodes {
		if f.Name != statusField && slices.Contains(valueDataTypes, f.DataType) {
			st.ValueFields[f.Name] = true
		}
	}
	return st, nil
}

// readItems runs one page of the items query. cursor is "" on the first page.
// It fails with a *Failure.
func (s *Service) readItems(ctx context.Context, loc Locator, q, cursor string) (itemsPage, error) {
	vars := gh.Vars{"owner": loc.Owner, "number": loc.Number, "q": q}
	if cursor != "" {
		vars["cursor"] = cursor
	}
	resp, err := s.github.GraphQL(ctx, fmt.Sprintf(itemsQuery, loc.OwnerType)+fragments, vars)
	if err != nil {
		if hasNotFound(resp.Errors) {
			return itemsPage{}, &Failure{Reason: ReasonNotFound}
		}
		return itemsPage{}, failureOf(err)
	}
	var data struct {
		Owner *struct {
			ProjectV2 *struct {
				Items struct {
					PageInfo struct {
						HasNextPage bool   `json:"hasNextPage"`
						EndCursor   string `json:"endCursor"`
					} `json:"pageInfo"`
					Nodes []itemNode `json:"nodes"`
				} `json:"items"`
			} `json:"projectV2"`
		} `json:"owner"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		return itemsPage{}, failureOf(fmt.Errorf("decode board items: %w", err))
	}
	if data.Owner == nil || data.Owner.ProjectV2 == nil {
		return itemsPage{}, &Failure{Reason: ReasonNotFound}
	}
	items := data.Owner.ProjectV2.Items
	return itemsPage{Items: items.Nodes, HasNextPage: items.PageInfo.HasNextPage, EndCursor: items.PageInfo.EndCursor}, nil
}

// readBatch reads refs in chunks of batchSize, and returns the issues found by
// key. A reference to an issue that does not exist is left out. It fails with
// a *Failure.
func (s *Service) readBatch(ctx context.Context, refs []Ref) (map[string]issueNode, error) {
	index := map[string]issueNode{}
	for chunk := range slices.Chunk(refs, batchSize) {
		resp, err := s.github.GraphQL(ctx, batchQuery(chunk), gh.Vars{})
		if err != nil {
			return nil, failureOf(err)
		}
		var data map[string]json.RawMessage
		if err := json.Unmarshal(resp.Data, &data); err != nil {
			return nil, failureOf(fmt.Errorf("decode issues: %w", err))
		}
		for i, r := range chunk {
			raw, ok := data[alias(i)]
			if !ok {
				continue
			}
			var result *struct {
				Issue *issueNode `json:"issue"`
			}
			if err := json.Unmarshal(raw, &result); err != nil {
				return nil, failureOf(fmt.Errorf("decode issue %s: %w", r.Key(), err))
			}
			if result != nil && result.Issue != nil {
				index[r.Key()] = *result.Issue
			}
		}
	}
	return index, nil
}

// batchQuery is the query that reads refs, each under its alias.
func batchQuery(refs []Ref) string {
	var b strings.Builder
	b.WriteString("query {\n")
	for i, r := range refs {
		fmt.Fprintf(&b, batchIssue, alias(i), strconv.Quote(r.Owner), strconv.Quote(r.Name), r.Number)
	}
	b.WriteString("rateLimit { cost } }\n")
	b.WriteString(fragments)
	return b.String()
}

// alias is the alias of the i-th issue of a batch.
func alias(i int) string { return "i" + strconv.Itoa(i) }

// hasNotFound reports whether GitHub answered that a part does not exist.
func hasNotFound(errs []gh.GraphQLError) bool {
	return slices.ContainsFunc(errs, func(e gh.GraphQLError) bool { return e.Type == typeNotFound })
}

// fieldsOf is the values of the value fields of st, in GitHub's order, and the
// option of the Status field; never nil.
func fieldsOf(values fieldValuesNode, st structure) (fields []Field, status Option) {
	fields = []Field{}
	for _, v := range values.Nodes {
		name := v.Field.Name
		if name == statusField {
			if v.Typename == typeSingleSelect && slices.ContainsFunc(st.Statuses, func(o Option) bool { return o.ID == v.OptionID }) {
				status = Option{ID: v.OptionID, Name: v.Name}
			}
			continue
		}
		if !st.ValueFields[name] {
			continue
		}
		if value, ok := fieldValue(v); ok {
			fields = append(fields, Field{Name: name, Value: value})
		}
	}
	return fields, status
}

// fieldValue is a field value as text, by its type.
func fieldValue(v fieldValueNode) (string, bool) {
	switch v.Typename {
	case typeSingleSelect:
		return v.Name, true
	case typeTextValue:
		return v.Text, true
	case typeNumberValue:
		return strconv.FormatFloat(v.Number, 'f', -1, 64), true
	case typeDateValue:
		return v.Date, true
	case typeIterationItem:
		return v.Title, true
	default:
		return "", false
	}
}
