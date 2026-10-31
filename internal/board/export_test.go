package board

import (
	"context"
	"encoding/json"
)

// The query templates and the functions of the reading that have no caller
// outside the tests yet.
var (
	// StructureQuery is structureQuery.
	StructureQuery = structureQuery
	// ItemsQuery is itemsQuery.
	ItemsQuery = itemsQuery
	// StampsQuery is stampsQuery.
	StampsQuery = stampsQuery
	// RepositoriesQuery is repositoriesQuery.
	RepositoriesQuery = repositoriesQuery
	// RepositoryQuery is repositoryQuery.
	RepositoryQuery = repositoryQuery
	// Fragments is fragments.
	Fragments = fragments
	// StampFragments is stampFragments.
	StampFragments = stampFragments
	// BatchQuery is batchQuery.
	BatchQuery = batchQuery
	// StampBatchQuery is stampBatchQuery.
	StampBatchQuery = stampBatchQuery
)

// IssueNode is an issue as the items and the batch read it.
type IssueNode = issueNode

// ItemCard is an issue of the items with its item.
type ItemCard = itemCard

// IndexedIssue is indexedIssue.
type IndexedIssue = indexedIssue

// CardStamp is cardStamp.
func CardStamp(c ItemCard) string { return cardStamp(c) }

// IndexStamp is indexStamp.
func IndexStamp(n IssueNode, projectID string) string { return indexStamp(n, projectID) }

// IndexedOf is indexedOf.
func IndexedOf(n IssueNode, projectID string) IndexedIssue { return indexedOf(n, projectID) }

// ItemStamp is the stamp of the card an item decoded from raw holds.
func ItemStamp(raw []byte) (string, error) {
	var n itemNode
	if err := json.Unmarshal(raw, &n); err != nil {
		return "", err
	}
	return cardStamp(itemCard{issueNode: n.Content.issueNode, updatedAt: n.UpdatedAt}), nil
}

// BatchedStamp is the stamp of the card n holds in the board projectID.
func BatchedStamp(n IssueNode, projectID string) string { return cardStamp(n.itemIn(projectID)) }

// ReadBatch is readBatch.
func (s *Service) ReadBatch(ctx context.Context, refs []Ref) (map[string]IssueNode, error) {
	return s.readBatch(ctx, refs)
}

// ReadStamps is readStamps.
func (s *Service) ReadStamps(ctx context.Context, refs []Ref) (map[string]IssueNode, error) {
	return s.readStamps(ctx, refs)
}

// IssueNode is the issue of i.
func (i indexedIssue) IssueNode() IssueNode { return i.issueNode }

// StructureStamp is the stamp of the structure the board at b reads.
func (s *Service) StructureStamp(ctx context.Context, b Board) (string, error) {
	st, err := s.readStructure(ctx, locatorOf(b))
	return st.Stamp, err
}
