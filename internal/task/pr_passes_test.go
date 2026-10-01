package task_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/prreport"
	"github.com/guilhermt/myspec/internal/task"
)

// prReport is a report of a pass with two findings, one of them general.
func prReport(pass int) prreport.Report {
	return prreport.Report{
		Pass:    pass,
		Summary: "Two things to look at.",
		Findings: []prreport.ParsedFinding{
			{Number: 1, Title: "Missing check", Path: "api/limits.go", Line: 12, Text: "Check the limit."},
			{Number: 2, Text: "Document the limits."},
		},
	}
}

// recordedPRPass asks for a pass of a task and records prReport in it.
func recordedPRPass(t *testing.T, f *fixture, id string, pass int) task.PRPass {
	t.Helper()

	if _, err := f.service.AskPRPass(t.Context(), id, pass); err != nil {
		t.Fatalf("AskPRPass() = %v, want nil", err)
	}
	recorded, _, err := f.service.RecordPRReport(t.Context(), id, prReport(pass))
	if err != nil {
		t.Fatalf("RecordPRReport() = %v, want nil", err)
	}
	return recorded
}

func TestAskPRPass(t *testing.T) {
	t.Parallel()

	t.Run("records a new pass", func(t *testing.T) {
		t.Parallel()
		f := newFixture(t)
		created := f.create(t, "add-login")
		before := f.changeCount()

		got, err := f.service.AskPRPass(t.Context(), created.ID, 1)
		if err != nil {
			t.Fatalf("AskPRPass() = %v, want nil", err)
		}
		want := task.PRPass{TaskID: created.ID, Pass: 1, AskedAt: base}
		if diff := cmp.Diff(want, got); diff != "" {
			t.Errorf("AskPRPass() mismatch (-want +got):\n%s", diff)
		}
		if diff := cmp.Diff([]task.PRPass{want}, f.service.PRPasses(created.ID)); diff != "" {
			t.Errorf("PRPasses() mismatch (-want +got):\n%s", diff)
		}
		if diff := cmp.Diff([]task.PRPass{want}, f.repo.storedPRPasses(created.ID)); diff != "" {
			t.Errorf("stored passes mismatch (-want +got):\n%s", diff)
		}
		if got := f.changeCount(); got != before+1 {
			t.Errorf("OnChange ran %d times, want 1", got-before)
		}
	})

	t.Run("replaces a pass that was not recorded", func(t *testing.T) {
		t.Parallel()
		f := newFixture(t)
		created := f.create(t, "add-login")
		for range 2 {
			if _, err := f.service.AskPRPass(t.Context(), created.ID, 1); err != nil {
				t.Fatalf("AskPRPass() = %v, want nil", err)
			}
		}

		if got := len(f.service.PRPasses(created.ID)); got != 1 {
			t.Errorf("PRPasses() holds %d passes, want 1", got)
		}
	})

	t.Run("refuses a pass that is recorded", func(t *testing.T) {
		t.Parallel()
		f := newFixture(t)
		created := f.create(t, "add-login")
		recordedPRPass(t, f, created.ID, 1)

		_, err := f.service.AskPRPass(t.Context(), created.ID, 1)

		wantErrIs(t, err, task.ErrPRPassRecorded)
	})

	t.Run("refuses an unknown task", func(t *testing.T) {
		t.Parallel()
		f := newFixture(t)

		_, err := f.service.AskPRPass(t.Context(), "nope", 1)

		wantErrIs(t, err, task.ErrNotFound)
	})
}

func TestUnaskPRPass(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")
	if _, err := f.service.AskPRPass(t.Context(), created.ID, 1); err != nil {
		t.Fatalf("AskPRPass() = %v, want nil", err)
	}
	recordedPRPass(t, f, created.ID, 2)

	if err := f.service.UnaskPRPass(t.Context(), created.ID, 1); err != nil {
		t.Fatalf("UnaskPRPass() = %v, want nil", err)
	}
	// A recorded pass and a missing one are left alone.
	if err := f.service.UnaskPRPass(t.Context(), created.ID, 2); err != nil {
		t.Fatalf("UnaskPRPass(recorded) = %v, want nil", err)
	}
	if err := f.service.UnaskPRPass(t.Context(), created.ID, 3); err != nil {
		t.Fatalf("UnaskPRPass(missing) = %v, want nil", err)
	}

	passes := f.service.PRPasses(created.ID)
	if len(passes) != 1 || passes[0].Pass != 2 {
		t.Errorf("PRPasses() = %+v, want only pass 2", passes)
	}
	if got := len(f.repo.storedPRPasses(created.ID)); got != 1 {
		t.Errorf("the store holds %d passes, want 1", got)
	}
}

func TestRecordPRReport(t *testing.T) {
	t.Parallel()

	t.Run("the first readable report", func(t *testing.T) {
		t.Parallel()
		f := newFixture(t)
		created := f.create(t, "add-login")
		if _, err := f.service.AskPRPass(t.Context(), created.ID, 1); err != nil {
			t.Fatalf("AskPRPass() = %v, want nil", err)
		}

		got, changed, err := f.service.RecordPRReport(t.Context(), created.ID, prReport(1))
		if err != nil {
			t.Fatalf("RecordPRReport() = %v, want nil", err)
		}

		if !changed {
			t.Error("changed = false, want true")
		}
		want := task.PRPass{
			TaskID: created.ID, Pass: 1, AskedAt: base, Recorded: true, SummaryOriginal: "Two things to look at.",
			Revision: 1, RecordedAt: base, Findings: prreport.Fresh(prReport(1).Findings),
		}
		if diff := cmp.Diff(want, got); diff != "" {
			t.Errorf("RecordPRReport() mismatch (-want +got):\n%s", diff)
		}
		if diff := cmp.Diff([]task.PRPass{want}, f.repo.storedPRPasses(created.ID)); diff != "" {
			t.Errorf("stored passes mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("the same report again", func(t *testing.T) {
		t.Parallel()
		f := newFixture(t)
		created := f.create(t, "add-login")
		recorded := recordedPRPass(t, f, created.ID, 1)
		before := f.changeCount()

		got, changed, err := f.service.RecordPRReport(t.Context(), created.ID, prReport(1))
		if err != nil {
			t.Fatalf("RecordPRReport() = %v, want nil", err)
		}

		if changed {
			t.Error("changed = true, want false")
		}
		if diff := cmp.Diff(recorded, got); diff != "" {
			t.Errorf("RecordPRReport() mismatch (-want +got):\n%s", diff)
		}
		if got := f.changeCount(); got != before {
			t.Errorf("OnChange ran %d times, want none", got-before)
		}
	})

	t.Run("a rewrite inherits what the user decided", func(t *testing.T) {
		t.Parallel()
		f := newFixture(t)
		created := f.create(t, "add-login")
		recordedPRPass(t, f, created.ID, 1)
		if err := f.service.DecidePRFinding(t.Context(), created.ID, 1, 1, prreport.DecisionApproved); err != nil {
			t.Fatalf("DecidePRFinding() = %v, want nil", err)
		}
		if err := f.service.SetPRFindingText(t.Context(), created.ID, 1, 1, "Check it, with a test."); err != nil {
			t.Fatalf("SetPRFindingText() = %v, want nil", err)
		}
		rewrite := prReport(1)
		rewrite.Findings[0].Title = "Missing limit check"
		rewrite.Findings[1].Line = 3
		rewrite.Findings[1].Path = "docs/limits.md"

		got, changed, err := f.service.RecordPRReport(t.Context(), created.ID, rewrite)
		if err != nil {
			t.Fatalf("RecordPRReport() = %v, want nil", err)
		}

		if !changed || got.Revision != 2 {
			t.Errorf("changed = %t, revision = %d, want true and 2", changed, got.Revision)
		}
		first, second := got.Findings[0], got.Findings[1]
		if first.Decision != prreport.DecisionApproved || first.Text != "Check it, with a test." ||
			first.Title != "Missing limit check" {
			t.Errorf("the first finding = %+v, want the decision and the text kept, the title new", first)
		}
		if second.Decision != prreport.DecisionNone || second.Text != "Document the limits." {
			t.Errorf("the moved finding = %+v, want it to be born undecided", second)
		}
		if diff := cmp.Diff(got, f.service.PRPasses(created.ID)[0]); diff != "" {
			t.Errorf("cached pass mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("a sent pass does not change", func(t *testing.T) {
		t.Parallel()
		f := newFixture(t)
		created := f.create(t, "add-login")
		recordedPRPass(t, f, created.ID, 1)
		if err := f.service.MarkPRPassSent(t.Context(), created.ID, 1); err != nil {
			t.Fatalf("MarkPRPassSent() = %v, want nil", err)
		}
		rewrite := prReport(1)
		rewrite.Summary = "Something else."

		got, changed, err := f.service.RecordPRReport(t.Context(), created.ID, rewrite)
		if err != nil {
			t.Fatalf("RecordPRReport() = %v, want nil", err)
		}

		if changed || got.SummaryOriginal != "Two things to look at." {
			t.Errorf("changed = %t, summary = %q, want the pass as it was", changed, got.SummaryOriginal)
		}
	})

	t.Run("a clean report", func(t *testing.T) {
		t.Parallel()
		f := newFixture(t)
		created := f.create(t, "add-login")
		if _, err := f.service.AskPRPass(t.Context(), created.ID, 1); err != nil {
			t.Fatalf("AskPRPass() = %v, want nil", err)
		}

		got, changed, err := f.service.RecordPRReport(t.Context(), created.ID,
			prreport.Report{Pass: 1, Clean: true, Summary: "All good."})
		if err != nil {
			t.Fatalf("RecordPRReport() = %v, want nil", err)
		}

		if !changed || !got.Recorded || !got.Clean || len(got.Findings) != 0 {
			t.Errorf("RecordPRReport() = %+v, %t, want a recorded clean pass without findings", got, changed)
		}
	})

	t.Run("a pass that was not asked", func(t *testing.T) {
		t.Parallel()
		f := newFixture(t)
		created := f.create(t, "add-login")

		_, _, err := f.service.RecordPRReport(t.Context(), created.ID, prReport(1))

		wantErrIs(t, err, task.ErrNotFound)
	})
}

func TestDecidePRFinding(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		pass     int
		number   int
		decision prreport.Decision
		wantErr  error
	}{
		{name: "approves", pass: 1, number: 1, decision: prreport.DecisionApproved},
		{name: "discards", pass: 1, number: 2, decision: prreport.DecisionDiscarded},
		{name: "undoes", pass: 1, number: 1, decision: prreport.DecisionNone},
		{name: "unknown decision", pass: 1, number: 1, decision: "maybe", wantErr: prreport.ErrUnknownDecision},
		{name: "unknown finding", pass: 1, number: 9, decision: prreport.DecisionApproved, wantErr: task.ErrNotFound},
		{name: "unknown pass", pass: 4, number: 1, decision: prreport.DecisionApproved, wantErr: task.ErrNotFound},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			f := newFixture(t)
			created := f.create(t, "add-login")
			recordedPRPass(t, f, created.ID, 1)

			err := f.service.DecidePRFinding(t.Context(), created.ID, tt.pass, tt.number, tt.decision)

			if tt.wantErr != nil {
				wantErrIs(t, err, tt.wantErr)
				return
			}
			if err != nil {
				t.Fatalf("DecidePRFinding() = %v, want nil", err)
			}
			cached := f.service.PRPasses(created.ID)[0].Findings[tt.number-1].Decision
			stored := f.repo.storedPRPasses(created.ID)[0].Findings[tt.number-1].Decision
			if cached != tt.decision || stored != tt.decision {
				t.Errorf("decision cached = %q, stored = %q, want %q in both", cached, stored, tt.decision)
			}
		})
	}
}

func TestSetPRFindingText(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		text    string
		want    string
		wantErr error
	}{
		{name: "trims", text: "  Check it.\n", want: "Check it."},
		{name: "empty", text: " \n", wantErr: prreport.ErrEmptyText},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			f := newFixture(t)
			created := f.create(t, "add-login")
			recordedPRPass(t, f, created.ID, 1)

			err := f.service.SetPRFindingText(t.Context(), created.ID, 1, 1, tt.text)

			if tt.wantErr != nil {
				wantErrIs(t, err, tt.wantErr)
				return
			}
			if err != nil {
				t.Fatalf("SetPRFindingText() = %v, want nil", err)
			}
			if got := f.repo.storedPRPasses(created.ID)[0].Findings[0].Text; got != tt.want {
				t.Errorf("stored text = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestApproveRestOfPRFindings(t *testing.T) {
	t.Parallel()

	t.Run("leaves the decided ones", func(t *testing.T) {
		t.Parallel()
		f := newFixture(t)
		created := f.create(t, "add-login")
		recordedPRPass(t, f, created.ID, 1)
		if err := f.service.DecidePRFinding(t.Context(), created.ID, 1, 1, prreport.DecisionDiscarded); err != nil {
			t.Fatalf("DecidePRFinding() = %v, want nil", err)
		}

		if err := f.service.ApproveRestOfPRFindings(t.Context(), created.ID, 1); err != nil {
			t.Fatalf("ApproveRestOfPRFindings() = %v, want nil", err)
		}

		findings := f.repo.storedPRPasses(created.ID)[0].Findings
		if findings[0].Decision != prreport.DecisionDiscarded || findings[1].Decision != prreport.DecisionApproved {
			t.Errorf("decisions = %q and %q, want discarded and approved", findings[0].Decision, findings[1].Decision)
		}
	})

	t.Run("writes nothing when all are decided", func(t *testing.T) {
		t.Parallel()
		f := newFixture(t)
		created := f.create(t, "add-login")
		recordedPRPass(t, f, created.ID, 1)
		if err := f.service.ApproveRestOfPRFindings(t.Context(), created.ID, 1); err != nil {
			t.Fatalf("ApproveRestOfPRFindings() = %v, want nil", err)
		}
		before := f.changeCount()

		if err := f.service.ApproveRestOfPRFindings(t.Context(), created.ID, 1); err != nil {
			t.Fatalf("ApproveRestOfPRFindings() again = %v, want nil", err)
		}

		if got := f.changeCount(); got != before {
			t.Errorf("OnChange ran %d times, want none", got-before)
		}
	})

	t.Run("an unknown pass", func(t *testing.T) {
		t.Parallel()
		f := newFixture(t)
		created := f.create(t, "add-login")

		wantErrIs(t, f.service.ApproveRestOfPRFindings(t.Context(), created.ID, 1), task.ErrNotFound)
	})
}

func TestMarkAndUnmarkPRPassSent(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")
	recordedPRPass(t, f, created.ID, 1)

	if err := f.service.MarkPRPassSent(t.Context(), created.ID, 1); err != nil {
		t.Fatalf("MarkPRPassSent() = %v, want nil", err)
	}
	if got := f.repo.storedPRPasses(created.ID)[0]; !got.Sent() || !got.SentAt.Equal(base) {
		t.Errorf("stored SentAt = %v, want %v", got.SentAt, base)
	}
	if !f.service.PRPasses(created.ID)[0].Sent() {
		t.Error("the cached pass is not sent, want it sent")
	}

	if err := f.service.UnmarkPRPassSent(t.Context(), created.ID, 1); err != nil {
		t.Fatalf("UnmarkPRPassSent() = %v, want nil", err)
	}
	if f.service.PRPasses(created.ID)[0].Sent() || f.repo.storedPRPasses(created.ID)[0].Sent() {
		t.Error("the pass is still sent, want it unmarked")
	}

	wantErrIs(t, f.service.MarkPRPassSent(t.Context(), created.ID, 7), task.ErrNotFound)
}

func TestPRPassesAreCopies(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")
	recordedPRPass(t, f, created.ID, 1)

	f.service.PRPasses(created.ID)[0].Findings[0].Text = "changed under it"

	if got := f.service.PRPasses(created.ID)[0].Findings[0].Text; got != "Check the limit." {
		t.Errorf("text = %q, want the cache untouched", got)
	}
}

func TestPRPassMethods(t *testing.T) {
	t.Parallel()

	finding := func(number int, d prreport.Decision) prreport.Finding {
		return prreport.Finding{Number: number, Decision: d}
	}
	tests := []struct {
		name         string
		pass         task.PRPass
		sent         bool
		decided      bool
		approved     int
		allDiscarded bool
	}{
		{name: "not recorded", pass: task.PRPass{}, decided: true},
		{
			name:    "undecided",
			pass:    task.PRPass{Recorded: true, Findings: []prreport.Finding{finding(1, prreport.DecisionNone)}},
			decided: false,
		},
		{
			name: "approved and discarded",
			pass: task.PRPass{Recorded: true, Findings: []prreport.Finding{
				finding(1, prreport.DecisionApproved), finding(2, prreport.DecisionDiscarded),
			}},
			decided: true, approved: 1,
		},
		{
			name: "all discarded",
			pass: task.PRPass{Recorded: true, Findings: []prreport.Finding{
				finding(1, prreport.DecisionDiscarded), finding(2, prreport.DecisionDiscarded),
			}},
			decided: true, allDiscarded: true,
		},
		{
			name: "all discarded but sent",
			pass: task.PRPass{Recorded: true, SentAt: base, Findings: []prreport.Finding{
				finding(1, prreport.DecisionDiscarded),
			}},
			sent: true, decided: true,
		},
		{name: "clean", pass: task.PRPass{Recorded: true, Clean: true}, decided: true},
		{
			name:    "all discarded but not recorded",
			pass:    task.PRPass{Findings: []prreport.Finding{finding(1, prreport.DecisionDiscarded)}},
			decided: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := tt.pass.Sent(); got != tt.sent {
				t.Errorf("Sent() = %t, want %t", got, tt.sent)
			}
			if got := tt.pass.Decided(); got != tt.decided {
				t.Errorf("Decided() = %t, want %t", got, tt.decided)
			}
			if got := len(tt.pass.Approved()); got != tt.approved {
				t.Errorf("len(Approved()) = %d, want %d", got, tt.approved)
			}
			if got := tt.pass.AllDiscarded(); got != tt.allDiscarded {
				t.Errorf("AllDiscarded() = %t, want %t", got, tt.allDiscarded)
			}
		})
	}
}

func TestSyncLoadsThePRPasses(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")
	want := recordedPRPass(t, f, created.ID, 1)
	f.repo.seedPRPass(task.PRPass{TaskID: created.ID, Pass: 2, AskedAt: base})

	f.sync(t)

	got := f.service.PRPasses(created.ID)
	if len(got) != 2 || got[1].Pass != 2 {
		t.Fatalf("PRPasses() = %+v, want the two stored passes in order", got)
	}
	if diff := cmp.Diff(want, got[0]); diff != "" {
		t.Errorf("first pass mismatch (-want +got):\n%s", diff)
	}
}

func TestClearPRRunForgetsThePRPasses(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")
	recordedPRPass(t, f, created.ID, 1)

	if err := f.service.ClearPRRun(t.Context(), created.ID); err != nil {
		t.Fatalf("ClearPRRun() = %v, want nil", err)
	}

	if got := f.service.PRPasses(created.ID); got != nil {
		t.Errorf("PRPasses() = %+v, want none", got)
	}
	if got := f.repo.storedPRPasses(created.ID); got != nil {
		t.Errorf("the store holds %+v, want none", got)
	}
}
