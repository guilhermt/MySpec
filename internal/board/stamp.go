package board

import (
	"slices"
	"strconv"
	"strings"
)

// indexedIssue is an issue the batch read, kept with the reading so the next
// one rebuilds the relations without reading it again.
type indexedIssue struct {
	issueNode
	Stamp string `json:"stamp"`
}

// prStamp is the pull requests linked to n and their states, in a stable order.
func prStamp(n issueNode) string {
	prs := make([]string, 0, len(n.ClosedByPullRequestsReferences.Nodes))
	for _, pr := range n.ClosedByPullRequestsReferences.Nodes {
		prs = append(prs, pr.Repository.NameWithOwner+"#"+strconv.Itoa(pr.Number)+":"+pr.State)
	}
	slices.Sort(prs)
	return strings.Join(prs, ",")
}

// cardStamp tells whether the card of c changed: the update times of its item
// and of its issue, and its pull requests.
func cardStamp(c itemCard) string {
	return strings.Join([]string{c.updatedAt, c.UpdatedAt, prStamp(c.issueNode)}, "|")
}

// indexStamp tells whether the issue n changed in what the assembly uses of it:
// the issue, its pull requests, its sub-issues and its item in the board
// projectID.
func indexStamp(n issueNode, projectID string) string {
	subs := make([]string, 0, len(n.SubIssues.Nodes))
	for _, sub := range n.SubIssues.Nodes {
		subs = append(subs, sub.Repository.NameWithOwner+"#"+strconv.Itoa(sub.Number)+"@"+sub.UpdatedAt)
	}
	slices.Sort(subs)
	return strings.Join([]string{n.UpdatedAt, prStamp(n), strings.Join(subs, ","), n.itemIn(projectID).updatedAt}, "|")
}

// indexedOf is n as the reading keeps it: without what the assembly does not
// use, and with the item of the board projectID only.
func indexedOf(n issueNode, projectID string) indexedIssue {
	stamp := indexStamp(n, projectID)
	n.Assignees.Nodes = nil
	n.Parent = nil
	n.BlockedBy.Nodes = nil
	var items []projectItemNode
	for _, item := range n.ProjectItems.Nodes {
		if item.Project.ID == projectID {
			items = []projectItemNode{item}
			break
		}
	}
	n.ProjectItems.Nodes = items
	return indexedIssue{issueNode: n, Stamp: stamp}
}
