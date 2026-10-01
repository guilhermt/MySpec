package store_test

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/prreport"
	"github.com/guilhermt/myspec/internal/store"
	"github.com/guilhermt/myspec/internal/task"
)

// newPRPass builds a recorded structured pass with two findings, one of them
// general.
func newPRPass(taskID string, number int) task.PRPass {
	return task.PRPass{
		TaskID:          taskID,
		Pass:            number,
		AskedAt:         fixedTime,
		Recorded:        true,
		SummaryOriginal: "Two things to look at.",
		Revision:        2,
		RecordedAt:      fixedTime.Add(time.Minute),
		SentAt:          fixedTime.Add(2 * time.Minute),
		Findings: []prreport.Finding{
			{
				Number: 1, Title: "Missing check", Path: "api/limits.go", Line: 12,
				Original: "Check the limit.", Text: "Check the limit, with a test.", Decision: prreport.DecisionApproved,
			},
			{Number: 2, Original: "Document it.", Text: "Document it.", Decision: prreport.DecisionDiscarded},
		},
	}
}

// listPRPasses reads the passes of a task, failing the test on error.
func listPRPasses(t *testing.T, s *store.Store, taskID string) []task.PRPass {
	t.Helper()

	passes, err := s.Tasks.ListPRPasses(t.Context(), taskID)
	if err != nil {
		t.Fatalf("ListPRPasses() = %v, want nil", err)
	}
	return passes
}

// assertNoOrphanPRFindings asks for a pass again after it was deleted and fails
// when findings of the old one come back with it.
func assertNoOrphanPRFindings(t *testing.T, s *store.Store, taskID string, pass int) {
	t.Helper()

	asked := task.PRPass{TaskID: taskID, Pass: pass, AskedAt: fixedTime}
	if err := s.Tasks.WritePRPass(t.Context(), asked); err != nil {
		t.Fatalf("WritePRPass() = %v, want nil", err)
	}
	for _, got := range listPRPasses(t, s, taskID) {
		if got.Pass == pass && len(got.Findings) != 0 {
			t.Errorf("pass %d came back with %d findings, want the delete to have taken them", pass, len(got.Findings))
		}
	}
}

func TestPRPassRoundTripsWithItsFindings(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)
	taskID := seedTask(t, s)
	want := []task.PRPass{newPRPass(taskID, 1), {TaskID: taskID, Pass: 2, AskedAt: fixedTime}}

	for _, pass := range want {
		if err := s.Tasks.WritePRPass(t.Context(), pass); err != nil {
			t.Fatalf("WritePRPass() = %v, want nil", err)
		}
	}

	if diff := cmp.Diff(want, listPRPasses(t, s, taskID)); diff != "" {
		t.Errorf("ListPRPasses() mismatch (-want +got):\n%s", diff)
	}
}

func TestWritePRPassReplacesTheFindings(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)
	taskID := seedTask(t, s)
	if err := s.Tasks.WritePRPass(t.Context(), newPRPass(taskID, 1)); err != nil {
		t.Fatalf("WritePRPass() = %v, want nil", err)
	}

	asked := task.PRPass{TaskID: taskID, Pass: 1, AskedAt: fixedTime.Add(time.Hour)}
	if err := s.Tasks.WritePRPass(t.Context(), asked); err != nil {
		t.Fatalf("WritePRPass() again = %v, want nil", err)
	}

	if diff := cmp.Diff([]task.PRPass{asked}, listPRPasses(t, s, taskID)); diff != "" {
		t.Errorf("ListPRPasses() mismatch (-want +got):\n%s", diff)
	}
}

func TestUpdatePRFindingRewritesTheTextAndTheDecision(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)
	taskID := seedTask(t, s)
	pass := newPRPass(taskID, 1)
	if err := s.Tasks.WritePRPass(t.Context(), pass); err != nil {
		t.Fatalf("WritePRPass() = %v, want nil", err)
	}

	updated := pass.Findings[1]
	updated.Text, updated.Decision = "Document the limits.", prreport.DecisionApproved
	if err := s.Tasks.UpdatePRFinding(t.Context(), taskID, 1, updated); err != nil {
		t.Fatalf("UpdatePRFinding() = %v, want nil", err)
	}

	pass.Findings[1] = updated
	if diff := cmp.Diff([]task.PRPass{pass}, listPRPasses(t, s, taskID)); diff != "" {
		t.Errorf("ListPRPasses() mismatch (-want +got):\n%s", diff)
	}
}

func TestDeletePRPassTakesItsFindings(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)
	taskID := seedTask(t, s)
	for _, number := range []int{1, 2} {
		if err := s.Tasks.WritePRPass(t.Context(), newPRPass(taskID, number)); err != nil {
			t.Fatalf("WritePRPass() = %v, want nil", err)
		}
	}

	if err := s.Tasks.DeletePRPass(t.Context(), taskID, 1); err != nil {
		t.Fatalf("DeletePRPass() = %v, want nil", err)
	}

	passes := listPRPasses(t, s, taskID)
	if len(passes) != 1 || passes[0].Pass != 2 || len(passes[0].Findings) != 2 {
		t.Fatalf("ListPRPasses() = %+v, want only pass 2 with its findings", passes)
	}
	assertNoOrphanPRFindings(t, s, taskID, 1)
}

func TestDeletePRRunTakesThePRPasses(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)
	taskID := seedTask(t, s)
	if err := s.Tasks.UpsertPRRun(t.Context(), newPRRun(taskID, task.PRReviewing)); err != nil {
		t.Fatalf("UpsertPRRun() = %v, want nil", err)
	}
	if err := s.Tasks.WritePRPass(t.Context(), newPRPass(taskID, 1)); err != nil {
		t.Fatalf("WritePRPass() = %v, want nil", err)
	}

	if err := s.Tasks.DeletePRRun(t.Context(), taskID); err != nil {
		t.Fatalf("DeletePRRun() = %v, want nil", err)
	}

	if got := listPRPasses(t, s, taskID); len(got) != 0 {
		t.Errorf("ListPRPasses() = %+v, want none", got)
	}
	assertNoOrphanPRFindings(t, s, taskID, 1)
}

func TestPRPassesGoWithTheTask(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)
	taskID := seedTask(t, s)
	if err := s.Tasks.WritePRPass(t.Context(), newPRPass(taskID, 1)); err != nil {
		t.Fatalf("WritePRPass() = %v, want nil", err)
	}

	if err := s.Tasks.Delete(t.Context(), taskID); err != nil {
		t.Fatalf("Tasks.Delete() = %v, want nil", err)
	}

	if got := listPRPasses(t, s, taskID); len(got) != 0 {
		t.Errorf("ListPRPasses() = %+v, want the cascade to have taken them", got)
	}
}

func TestListPRPassesOfATaskWithoutOne(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	if got := listPRPasses(t, s, seedTask(t, s)); len(got) != 0 {
		t.Errorf("ListPRPasses() = %+v, want none", got)
	}
}
