package board_test

import (
	"encoding/json"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/board"
)

const (
	issueUpdated = "2026-09-10T10:00:00Z"
	itemUpdated  = "2026-09-11T11:00:00Z"
	subUpdated   = "2026-09-09T09:00:00Z"
)

// stampedIssue is an issue the batch reads, updated at issueUpdated, with two
// pull requests, a sub-issue and its item in the board.
func stampedIssue() node {
	n := issueNode("acme/api", 1)
	n["updatedAt"] = issueUpdated
	n["closedByPullRequestsReferences"] = nodes(pr("acme/api", 5, "MERGED"), pr("acme/web", 2, "OPEN"))
	n["subIssues"] = nodes(
		with(brief("acme/api", 8), "updatedAt", subUpdated),
		with(brief("acme/web", 3), "updatedAt", subUpdated),
	)
	n["projectItems"] = nodes(
		with(projectItem("other-project", statusValue(todo)), "updatedAt", "2026-01-01T00:00:00Z"),
		with(projectItem(projectID, statusValue(doing)), "updatedAt", itemUpdated),
	)
	return n
}

// minimalIssue is the issue as the stamp queries read it, with its pull
// requests and sub-issues in the opposite order.
func minimalIssue() node {
	return node{
		"number":     1,
		"updatedAt":  issueUpdated,
		"repository": node{"nameWithOwner": "acme/api"},
		"parent":     nil,
		"blockedBy":  nodes(),
		"closedByPullRequestsReferences": nodes(
			node{"number": 2, "state": "OPEN", "repository": node{"nameWithOwner": "acme/web"}},
			node{"number": 5, "state": "MERGED", "repository": node{"nameWithOwner": "acme/api"}},
		),
		"subIssues": nodes(
			node{"number": 3, "updatedAt": subUpdated, "repository": node{"nameWithOwner": "acme/web"}},
			node{"number": 8, "updatedAt": subUpdated, "repository": node{"nameWithOwner": "acme/api"}},
		),
		"projectItems": nodes(node{"updatedAt": itemUpdated, "project": node{"id": projectID}}),
	}
}

func TestTheStampOfACardIsTheSameInTheThreeReadings(t *testing.T) {
	t.Parallel()

	// The complete items query.
	full, err := json.Marshal(with(item(stampedIssue(), statusValue(doing)), "updatedAt", itemUpdated))
	if err != nil {
		t.Fatal(err)
	}
	fromItems, err := board.ItemStamp(full)
	if err != nil {
		t.Fatalf("ItemStamp(full) = %v, want nil", err)
	}

	// The minimal items query.
	minimalItem := node{"updatedAt": itemUpdated, "content": with(minimalIssue(), "__typename", "Issue")}
	minimal, err := json.Marshal(minimalItem)
	if err != nil {
		t.Fatal(err)
	}
	fromList, err := board.ItemStamp(minimal)
	if err != nil {
		t.Fatalf("ItemStamp(minimal) = %v, want nil", err)
	}

	// The complete batch and the batch of stamps.
	f := newFixture(t, board.Stored{})
	f.github.answer(batchMatch, "", batch(stampedIssue()))
	f.github.answer("fragment prStamps", "", batch(minimalIssue()))
	refs := []board.Ref{{Owner: "acme", Name: "api", Number: 1}}
	read, err := f.service.ReadBatch(t.Context(), refs)
	if err != nil {
		t.Fatalf("ReadBatch() = %v, want nil", err)
	}
	stamped, err := f.service.ReadStamps(t.Context(), refs)
	if err != nil {
		t.Fatalf("ReadStamps() = %v, want nil", err)
	}
	fromBatch := board.BatchedStamp(read["acme/api#1"], projectID)
	fromStamps := board.BatchedStamp(stamped["acme/api#1"], projectID)

	want := itemUpdated + "|" + issueUpdated + "|acme/api#5:MERGED,acme/web#2:OPEN"
	for name, got := range map[string]string{
		"the items": fromItems, "the minimal items": fromList, "the batch": fromBatch, "the batch of stamps": fromStamps,
	} {
		if got != want {
			t.Errorf("stamp from %s = %q, want %q", name, got, want)
		}
	}
}

func TestTheIndexStampOfAnIssueIsTheSameInTheBatchAndInTheBatchOfStamps(t *testing.T) {
	t.Parallel()

	f := newFixture(t, board.Stored{})
	f.github.answer(batchMatch, "", batch(stampedIssue()))
	f.github.answer("fragment prStamps", "", batch(minimalIssue()))
	refs := []board.Ref{{Owner: "acme", Name: "api", Number: 1}}
	read, err := f.service.ReadBatch(t.Context(), refs)
	if err != nil {
		t.Fatalf("ReadBatch() = %v, want nil", err)
	}
	stamped, err := f.service.ReadStamps(t.Context(), refs)
	if err != nil {
		t.Fatalf("ReadStamps() = %v, want nil", err)
	}

	got := board.IndexStamp(stamped["acme/api#1"], projectID)
	want := issueUpdated + "|acme/api#5:MERGED,acme/web#2:OPEN|acme/api#8@" + subUpdated + ",acme/web#3@" + subUpdated + "|" + itemUpdated
	if got != want {
		t.Errorf("IndexStamp(stamps) = %q, want %q", got, want)
	}
	if batched := board.IndexStamp(read["acme/api#1"], projectID); batched != want {
		t.Errorf("IndexStamp(batch) = %q, want %q", batched, want)
	}
}

func TestAnIndexedIssueKeepsWhatTheAssemblyUsesAndItsStamp(t *testing.T) {
	t.Parallel()

	n := stampedIssue()
	n["assignees"] = nodes(node{"login": "ana", "avatarUrl": "https://example.test/ana"})
	n["parent"] = with(brief("acme/api", 9), "body", "the epic")
	n["blockedBy"] = nodes(brief("acme/api", 4))
	n["body"] = "the body"
	f := newFixture(t, board.Stored{})
	f.github.answer(batchMatch, "", batch(n))
	read, err := f.service.ReadBatch(t.Context(), []board.Ref{{Owner: "acme", Name: "api", Number: 1}})
	if err != nil {
		t.Fatalf("ReadBatch() = %v, want nil", err)
	}
	issue := read["acme/api#1"]

	indexed := board.IndexedOf(issue, projectID)

	if indexed.Parent != nil || len(indexed.Assignees.Nodes) != 0 || len(indexed.BlockedBy.Nodes) != 0 {
		t.Errorf("IndexedOf() kept parent %v, assignees %v and blockers %v, want none", indexed.Parent, indexed.Assignees.Nodes, indexed.BlockedBy.Nodes)
	}
	if len(issue.Assignees.Nodes) != 1 || issue.Parent == nil || len(issue.BlockedBy.Nodes) != 1 {
		t.Error("IndexedOf() changed the issue it was given")
	}
	if len(indexed.ProjectItems.Nodes) != 1 || indexed.ProjectItems.Nodes[0].Project.ID != projectID {
		t.Errorf("IndexedOf() kept the items %+v, want only the one of %s", indexed.ProjectItems.Nodes, projectID)
	}
	if indexed.Body != "the body" || len(indexed.SubIssues.Nodes) != 2 || len(indexed.ClosedByPullRequestsReferences.Nodes) != 2 {
		t.Errorf("IndexedOf() = %+v, want the body, the sub-issues and the pull requests", indexed)
	}
	if want := board.IndexStamp(issue, projectID); indexed.Stamp != want {
		t.Errorf("Stamp = %q, want %q", indexed.Stamp, want)
	}

	raw, err := json.Marshal(indexed)
	if err != nil {
		t.Fatalf("Marshal() = %v, want nil", err)
	}
	var back board.IndexedIssue
	if err = json.Unmarshal(raw, &back); err != nil {
		t.Fatalf("Unmarshal() = %v, want nil", err)
	}
	again, err := json.Marshal(back)
	if err != nil {
		t.Fatalf("Marshal() = %v, want nil", err)
	}
	if diff := cmp.Diff(string(raw), string(again)); diff != "" {
		t.Errorf("the indexed issue changed through JSON (-before +after):\n%s", diff)
	}
	if got := board.IndexStamp(back.IssueNode(), projectID); got != indexed.Stamp {
		t.Errorf("IndexStamp(back) = %q, want %q", got, indexed.Stamp)
	}
}

func TestTheStampOfTheStructureFollowsTheWholeAnswer(t *testing.T) {
	t.Parallel()

	stampOf := func(reply reply) string {
		t.Helper()
		f := newFixture(t, board.Stored{})
		f.github.answer(structureMatch, "", reply)
		b, _ := f.service.Get(boardID)
		stamp, err := f.service.StructureStamp(t.Context(), b)
		if err != nil {
			t.Fatalf("StructureStamp() = %v, want nil", err)
		}
		return stamp
	}

	first := stampOf(structure("Roadmap"))
	if len(first) != 64 {
		t.Errorf("stamp = %q, want a SHA-256 in hexadecimal", first)
	}
	if again := stampOf(structure("Roadmap")); again != first {
		t.Errorf("the same structure stamped %q and %q, want one stamp", first, again)
	}
	if renamed := stampOf(structure("Roadmap v2")); renamed == first {
		t.Error("a new title kept the stamp, want another")
	}
	if reordered := stampOf(structureWith("Roadmap", done, doing, todo)); reordered == first {
		t.Error("new options kept the stamp, want another")
	}
}
