package attention_test

import (
	"errors"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/attention"
	"github.com/guilhermt/myspec/internal/task"
)

// yesterday is when a situation a run of the app before left in the store
// started.
var yesterday = base.Add(-24 * time.Hour)

// holding is what Update answers for one task holding the situations given.
func holding(id string, situations ...attention.Situation) map[string][]attention.Situation {
	return map[string][]attention.Situation{id: situations}
}

// wantCalls compares the calls a fake recorded with the ones expected.
func wantCalls(t *testing.T, subject string, want, got []string) {
	t.Helper()

	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("%s calls mismatch (-want +got):\n%s", subject, diff)
	}
}

func TestASituationStartsOnlyOnceItSettles(t *testing.T) {
	t.Parallel()
	f := newService(t, true)
	reply := []attention.Found{found(taskID, prdPlace, attention.KindReply)}

	if got := f.service.Update(reply); len(got) != 0 {
		t.Fatalf("Update() when first seen = %v, want nothing", got)
	}
	f.advance(attention.Settle / 2)
	if got := f.service.Update(reply); len(got) != 0 {
		t.Fatalf("Update() before it settles = %v, want nothing", got)
	}
	f.advance(attention.Settle / 2)

	want := holding(taskID, attention.Situation{
		ID: "s1", TaskID: taskID, Place: prdPlace, Kind: attention.KindReply, StartedAt: base,
	})
	if diff := cmp.Diff(want, f.service.Update(reply)); diff != "" {
		t.Errorf("Update() once settled mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff([]time.Duration{attention.Settle}, f.after.delays()); diff != "" {
		t.Errorf("scheduled delays mismatch (-want +got):\n%s", diff)
	}
	if f.dues != 1 {
		t.Errorf("OnDue called %d times, want once, when the settle was due", f.dues)
	}
	wantCalls(t, "store", []string{"upsert:task-1:stage:prd:s1"}, f.store.calls)
}

func TestANewSituationNotifiesOnlyWithTheWindowAway(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		focused bool
		calls   []string
	}{
		{"the window is away", false, []string{"send:s1:login-screen:reply at stage:prd"}},
		{"the window is in front", true, nil},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			f := newService(t, test.focused)

			f.settle(found(taskID, prdPlace, attention.KindReply))

			wantCalls(t, "notifier", test.calls, f.notifier.calls)
			want := []attention.Started{{
				Situation: attention.Situation{
					ID: "s1", TaskID: taskID, Place: prdPlace, Kind: attention.KindReply, StartedAt: base,
				},
				Focused: test.focused,
			}}
			if diff := cmp.Diff(want, f.started); diff != "" {
				t.Errorf("OnStarted mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestAChangeOfFormGoesOnWithTheSameSituation(t *testing.T) {
	t.Parallel()
	f := newService(t, false)

	review := found(taskID, stepPlace, attention.KindStepReview)
	review.Form = attention.FormReview
	f.settle(review)

	staged := review
	staged.Form, staged.Percent = attention.FormStaged, 50
	f.advance(time.Minute)
	want := holding(taskID, attention.Situation{
		ID: "s1", TaskID: taskID, Place: stepPlace, Kind: attention.KindStepReview,
		Form: attention.FormStaged, Percent: 50, StartedAt: base,
	})
	if diff := cmp.Diff(want, f.service.Update([]attention.Found{staged})); diff != "" {
		t.Errorf("Update() with part staged mismatch (-want +got):\n%s", diff)
	}

	approve := review
	approve.Form = attention.FormApprove
	f.advance(time.Minute)
	want = holding(taskID, attention.Situation{
		ID: "s1", TaskID: taskID, Place: stepPlace, Kind: attention.KindStepReview,
		Form: attention.FormApprove, StartedAt: base,
	})
	if diff := cmp.Diff(want, f.service.Update([]attention.Found{approve})); diff != "" {
		t.Errorf("Update() with everything staged mismatch (-want +got):\n%s", diff)
	}

	wantCalls(t, "notifier", []string{"send:s1:login-screen:step_review at step:2"}, f.notifier.calls)
	wantCalls(t, "store", []string{"upsert:task-1:step:2:s1"}, f.store.calls)
}

func TestAnEndedSituationIsWithdrawnAfterItsGrace(t *testing.T) {
	t.Parallel()
	f := newService(t, false)
	f.settle(found(taskID, prdPlace, attention.KindReply))
	const sent = "send:s1:login-screen:reply at stage:prd"

	// A quiet while with nothing to update goes by before the situation ends:
	// its grace counts from the update that no longer sees it.
	f.advance(time.Minute)
	if got := f.service.Update(nil); len(got) != 0 {
		t.Fatalf("Update() once it ended = %v, want it hidden at once", got)
	}
	f.advance(attention.Grace / 2)
	if got := f.service.Update(nil); len(got) != 0 {
		t.Fatalf("Update() within its grace = %v, want nothing", got)
	}
	wantCalls(t, "notifier within the grace", []string{sent}, f.notifier.calls)
	wantCalls(t, "store within the grace", []string{"upsert:task-1:stage:prd:s1"}, f.store.calls)

	f.advance(attention.Grace / 2)
	f.service.Update(nil)

	wantCalls(t, "notifier", []string{sent, "withdraw:s1"}, f.notifier.calls)
	wantCalls(t, "store", []string{"upsert:task-1:stage:prd:s1", "delete:task-1:stage:prd"}, f.store.calls)
	if diff := cmp.Diff([]time.Duration{attention.Settle, attention.Grace}, f.after.delays()); diff != "" {
		t.Errorf("scheduled delays mismatch (-want +got):\n%s", diff)
	}
}

func TestASituationBackWithinItsGraceIsTheSameOne(t *testing.T) {
	t.Parallel()
	f := newService(t, false)
	reply := []attention.Found{found(taskID, prdPlace, attention.KindReply)}
	f.settle(reply...)

	// One reading without it, after a quiet while.
	f.advance(time.Minute)
	f.service.Update(nil)
	f.advance(attention.Grace / 2)

	want := holding(taskID, attention.Situation{
		ID: "s1", TaskID: taskID, Place: prdPlace, Kind: attention.KindReply, StartedAt: base,
	})
	if diff := cmp.Diff(want, f.service.Update(reply)); diff != "" {
		t.Errorf("Update() back within its grace mismatch (-want +got):\n%s", diff)
	}
	// Back, it holds on past the grace it had.
	f.advance(attention.Grace)
	if diff := cmp.Diff(want, f.service.Update(reply)); diff != "" {
		t.Errorf("Update() after its grace mismatch (-want +got):\n%s", diff)
	}

	wantCalls(t, "notifier", []string{"send:s1:login-screen:reply at stage:prd"}, f.notifier.calls)
	wantCalls(t, "store", []string{"upsert:task-1:stage:prd:s1"}, f.store.calls)
}

func TestASituationBackAfterAGapIsANewOne(t *testing.T) {
	t.Parallel()
	f := newService(t, false)
	reply := found(taskID, prdPlace, attention.KindReply)
	f.settle(reply)

	f.advance(time.Minute)
	f.service.Update(nil)
	f.advance(attention.Grace)
	f.service.Update(nil)

	f.advance(time.Minute)
	again := f.clock.now
	want := holding(taskID, attention.Situation{
		ID: "s2", TaskID: taskID, Place: prdPlace, Kind: attention.KindReply, StartedAt: again,
	})
	if diff := cmp.Diff(want, f.settle(reply)); diff != "" {
		t.Errorf("Update() of the situation back mismatch (-want +got):\n%s", diff)
	}

	wantCalls(t, "notifier", []string{
		"send:s1:login-screen:reply at stage:prd",
		"withdraw:s1",
		"send:s2:login-screen:reply at stage:prd",
	}, f.notifier.calls)
}

func TestAnotherKindAtThePlaceIsANewSituation(t *testing.T) {
	t.Parallel()
	f := newService(t, false)
	f.settle(found(taskID, prdPlace, attention.KindPermission))

	// The permission turns into a reply with no moment without a situation.
	reply := []attention.Found{found(taskID, prdPlace, attention.KindReply)}
	f.advance(time.Minute)
	answered := f.clock.now
	if got := f.service.Update(reply); len(got) != 0 {
		t.Fatalf("Update() as the kind changes = %v, want nothing until the reply settles", got)
	}
	f.advance(attention.Settle)

	want := holding(taskID, attention.Situation{
		ID: "s2", TaskID: taskID, Place: prdPlace, Kind: attention.KindReply, StartedAt: answered,
	})
	if diff := cmp.Diff(want, f.service.Update(reply)); diff != "" {
		t.Errorf("Update() once the reply settled mismatch (-want +got):\n%s", diff)
	}

	wantCalls(t, "notifier", []string{
		"send:s1:login-screen:permission at stage:prd",
		"withdraw:s1",
		"send:s2:login-screen:reply at stage:prd",
	}, f.notifier.calls)
	wantCalls(t, "store", []string{
		"upsert:task-1:stage:prd:s1",
		"delete:task-1:stage:prd",
		"upsert:task-1:stage:prd:s2",
	}, f.store.calls)
}

// withForm is a situation found in a form.
func withForm(f attention.Found, form attention.Form) attention.Found {
	f.Form = form
	return f
}

func TestAPullRequestInTroubleThatChangesFormIsTheSameSituation(t *testing.T) {
	t.Parallel()
	f := newService(t, false)
	trouble := found(taskID, prPlace, attention.KindPRTrouble)
	f.settle(withForm(trouble, attention.FormChecks))

	f.advance(time.Minute)
	want := holding(taskID, attention.Situation{
		ID: "s1", TaskID: taskID, Place: prPlace, Kind: attention.KindPRTrouble,
		Form: attention.FormChecksConflict, StartedAt: base,
	})
	got := f.service.Update([]attention.Found{withForm(trouble, attention.FormChecksConflict)})
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("Update() with a conflict too mismatch (-want +got):\n%s", diff)
	}

	wantCalls(t, "notifier", []string{"send:s1:login-screen:pr_trouble at pr"}, f.notifier.calls)
	wantCalls(t, "store", []string{"upsert:task-1:pr:s1"}, f.store.calls)
}

func TestAPullRequestReadyToMergeThatGetsInTroubleNotifies(t *testing.T) {
	t.Parallel()
	f := newService(t, false)
	f.settle(withForm(found(taskID, prPlace, attention.KindMerge), attention.FormMerge))

	f.advance(time.Minute)
	troubled := f.clock.now
	want := holding(taskID, attention.Situation{
		ID: "s2", TaskID: taskID, Place: prPlace, Kind: attention.KindPRTrouble,
		Form: attention.FormConflict, StartedAt: troubled,
	})
	got := f.settle(withForm(found(taskID, prPlace, attention.KindPRTrouble), attention.FormConflict))
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("Update() once the trouble settled mismatch (-want +got):\n%s", diff)
	}

	wantCalls(t, "notifier", []string{
		"send:s1:login-screen:merge at pr",
		"withdraw:s1",
		"send:s2:login-screen:pr_trouble at pr",
	}, f.notifier.calls)
	if len(f.started) != 2 || f.started[1].Situation.Kind != attention.KindPRTrouble {
		t.Errorf("OnStarted = %v, want the merge and then the trouble", f.started)
	}
}

func TestAPullRequestBackFromTroubleIsReadyToMergeQuietly(t *testing.T) {
	t.Parallel()
	f := newService(t, false)
	f.settle(withForm(found(taskID, prPlace, attention.KindPRTrouble), attention.FormChecks))

	// The trouble goes away and the merge settles in the same instant the
	// grace of the trouble runs out.
	f.advance(time.Minute)
	fixed := f.clock.now
	want := holding(taskID, attention.Situation{
		ID: "s2", TaskID: taskID, Place: prPlace, Kind: attention.KindMerge,
		Form: attention.FormMerge, StartedAt: fixed,
	})
	got := f.settle(withForm(found(taskID, prPlace, attention.KindMerge), attention.FormMerge))
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("Update() once the merge settled mismatch (-want +got):\n%s", diff)
	}

	wantCalls(t, "notifier", []string{"send:s1:login-screen:pr_trouble at pr", "withdraw:s1"}, f.notifier.calls)
	wantCalls(t, "store", []string{
		"upsert:task-1:pr:s1",
		"delete:task-1:pr",
		"upsert:task-1:pr:s2",
	}, f.store.calls)
	if len(f.started) != 1 || f.started[0].Situation.Kind != attention.KindPRTrouble {
		t.Errorf("OnStarted = %v, want the trouble only", f.started)
	}
}

func TestAReviewBackToPublishedEndsItsTroubleWithNothingNew(t *testing.T) {
	t.Parallel()
	f := newService(t, false)
	reviewPlace := attention.Place{Kind: attention.PlaceReview}
	f.settle(withForm(found(reviewID, reviewPlace, attention.KindPRTrouble), attention.FormChecks))

	f.advance(time.Minute)
	f.service.Update(nil)
	f.advance(attention.Grace)
	if got := f.service.Update(nil); len(got) != 0 {
		t.Errorf("Update() once the trouble ended = %v, want nothing", got)
	}

	wantCalls(t, "notifier", []string{"send:s1:login-screen:pr_trouble at review", "withdraw:s1"}, f.notifier.calls)
	wantCalls(t, "store", []string{"upsert:review-1:review:s1", "delete:review-1:review"}, f.store.calls)
	if len(f.started) != 1 {
		t.Errorf("OnStarted = %v, want the trouble only", f.started)
	}
}

func TestTheBaselineTakesWhatItFinds(t *testing.T) {
	t.Parallel()
	f := newService(t, false)

	techSpec := attention.Place{Kind: attention.PlaceStage, Stage: task.StageTechSpec}
	f.store.seed(
		attention.Record{TaskID: "task-1", Place: "stage:tech_spec", ID: "stored-1", Kind: attention.KindReply, StartedAt: yesterday},
		attention.Record{TaskID: "task-2", Place: prPlace.Key(), ID: "stored-2", Kind: attention.KindMerge, StartedAt: yesterday},
		attention.Record{TaskID: "task-3", Place: "step:2", ID: "stored-3", Kind: attention.KindPermission, StartedAt: yesterday},
		attention.Record{TaskID: "task-4", Place: "stage:prd", ID: "stored-4", Kind: attention.KindReply, StartedAt: yesterday},
		attention.Record{TaskID: "task-6", Place: "nowhere", ID: "stored-6", Kind: attention.KindReply, StartedAt: yesterday},
	)
	if err := f.service.Sync(t.Context(), []string{"task-1", "task-2", "task-3", "task-4", "task-5", "task-6"}); err != nil {
		t.Fatalf("Sync() = %v, want nil", err)
	}

	merge := found("task-2", prPlace, attention.KindMerge)
	merge.Form = attention.FormClose
	seen := []attention.Found{
		found("task-1", techSpec, attention.KindReply),
		merge,
		// The permission was cancelled with the app closed, and a reply
		// waits in its place.
		found("task-3", stepPlace, attention.KindReply),
		found("task-5", prdPlace, attention.KindReply),
	}
	want := map[string][]attention.Situation{
		"task-1": {{ID: "stored-1", TaskID: "task-1", Place: techSpec, Kind: attention.KindReply, StartedAt: yesterday}},
		"task-2": {{
			ID: "stored-2", TaskID: "task-2", Place: prPlace, Kind: attention.KindMerge,
			Form: attention.FormClose, StartedAt: yesterday,
		}},
		"task-3": {{ID: "s1", TaskID: "task-3", Place: stepPlace, Kind: attention.KindReply, StartedAt: yesterday}},
		"task-5": {{ID: "s2", TaskID: "task-5", Place: prdPlace, Kind: attention.KindReply, StartedAt: base}},
	}
	if diff := cmp.Diff(want, f.service.Update(seen)); diff != "" {
		t.Errorf("Update() in the baseline mismatch (-want +got):\n%s", diff)
	}
	wantCalls(t, "store in the baseline", []string{
		"upsert:task-3:step:2:s1",
		"upsert:task-5:stage:prd:s2",
	}, f.store.calls)
	if got := f.logged(t, "situation place unknown"); got != 1 {
		t.Errorf("logged %q %d times, want once for the record of task-6", "situation place unknown", got)
	}

	// Once the baseline is over, the record nothing found ends.
	f.advance(attention.Baseline)
	if diff := cmp.Diff(want, f.service.Update(seen)); diff != "" {
		t.Errorf("Update() after the baseline mismatch (-want +got):\n%s", diff)
	}
	wantCalls(t, "store", []string{
		"upsert:task-3:step:2:s1",
		"upsert:task-5:stage:prd:s2",
		"delete:task-4:stage:prd",
	}, f.store.calls)

	if diff := cmp.Diff([]time.Duration{attention.Baseline}, f.after.delays()); diff != "" {
		t.Errorf("scheduled delays mismatch (-want +got):\n%s", diff)
	}
	wantCalls(t, "notifier", nil, f.notifier.calls)
	if len(f.started) != 0 {
		t.Errorf("OnStarted heard %v, want nothing for what the baseline found", f.started)
	}
}

func TestTheBaselineEndsWhenAnUpdateWasDueBeforeItsEnd(t *testing.T) {
	t.Parallel()
	f := newService(t, false)
	f.store.seed(attention.Record{
		TaskID: "task-2", Place: "stage:prd", ID: "stored", Kind: attention.KindReply, StartedAt: yesterday,
	})

	// The tasks before have a situation settling when the next ones load.
	f.service.Update([]attention.Found{found(taskID, prdPlace, attention.KindReply)})
	f.advance(attention.Settle / 2)
	if err := f.service.Sync(t.Context(), []string{"task-2"}); err != nil {
		t.Fatalf("Sync() = %v, want nil", err)
	}
	f.service.Update(nil)

	// The settle of the tasks before is due, and brings its update.
	f.advance(attention.Settle / 2)
	f.service.Update(nil)

	end := attention.Baseline - attention.Settle/2
	if diff := cmp.Diff([]time.Duration{attention.Settle, end}, f.after.delays()); diff != "" {
		t.Fatalf("scheduled delays mismatch (-want +got):\n%s", diff)
	}
	f.advance(end)
	f.service.Update(nil)

	if f.dues != 2 {
		t.Errorf("OnDue called %d times, want twice: the settle and the end of the baseline", f.dues)
	}
	wantCalls(t, "store", []string{"delete:task-2:stage:prd"}, f.store.calls)
}

func TestSyncWithdrawsTheNotificationsOfTheTasksBefore(t *testing.T) {
	t.Parallel()
	f := newService(t, false)
	f.settle(found(taskID, prdPlace, attention.KindReply), found("task-2", prdPlace, attention.KindQuestion))
	f.service.View("s1")

	if err := f.service.Sync(t.Context(), []string{"task-3"}); err != nil {
		t.Fatalf("Sync() = %v, want nil", err)
	}

	// View took s1 away already; Sync withdraws only s2, still shown.
	wantCalls(t, "notifier", []string{
		"send:s1:login-screen:reply at stage:prd",
		"send:s2:login-screen:question at stage:prd",
		"withdraw:s1",
		"withdraw:s2",
	}, f.notifier.calls)
	for _, id := range []string{"s1", "s2"} {
		if target, ok := f.service.Open(id); ok {
			t.Errorf("Open(%s) = %+v, true; want the notifications of the tasks before forgotten", id, target)
		}
	}
}

func TestASyncThatCannotReadTheStoreStillTakesABaseline(t *testing.T) {
	t.Parallel()
	f := newService(t, false)

	// The tasks before hold a situation, notified with the window away.
	f.settle(found(taskID, prdPlace, attention.KindReply))

	f.store.err = errors.New("disk I/O error")
	if err := f.service.Sync(t.Context(), []string{"task-2"}); !errors.Is(err, f.store.err) {
		t.Fatalf("Sync() = %v, want %v", err, f.store.err)
	}
	f.store.err = nil

	// What the tasks just loaded already wait for is found, not started.
	loaded := f.clock.now
	question := []attention.Found{found("task-2", prdPlace, attention.KindQuestion)}
	want := holding("task-2", attention.Situation{
		ID: "s2", TaskID: "task-2", Place: prdPlace, Kind: attention.KindQuestion, StartedAt: loaded,
	})
	if diff := cmp.Diff(want, f.service.Update(question)); diff != "" {
		t.Errorf("Update() after Sync mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff([]time.Duration{attention.Settle, attention.Baseline}, f.after.delays()); diff != "" {
		t.Errorf("scheduled delays mismatch (-want +got):\n%s", diff)
	}

	// Past the baseline it holds on, and nothing ends the situation of the
	// tasks before: its row stays as it was.
	f.advance(attention.Baseline)
	if diff := cmp.Diff(want, f.service.Update(question)); diff != "" {
		t.Errorf("Update() after the baseline mismatch (-want +got):\n%s", diff)
	}

	wantCalls(t, "notifier", []string{"send:s1:login-screen:reply at stage:prd", "withdraw:s1"}, f.notifier.calls)
	wantCalls(t, "store", []string{"upsert:task-1:stage:prd:s1", "upsert:task-2:stage:prd:s2"}, f.store.calls)
	if len(f.started) != 1 || f.started[0].Situation.ID != "s1" {
		t.Errorf("OnStarted heard %+v, want only s1, which started before the tasks loaded", f.started)
	}
}

func TestViewWithdrawsAShownNotification(t *testing.T) {
	t.Parallel()
	f := newService(t, false)
	f.settle(found(taskID, prdPlace, attention.KindReply))
	const sent = "send:s1:login-screen:reply at stage:prd"

	f.service.View("s1")
	wantCalls(t, "notifier after View", []string{sent, "withdraw:s1"}, f.notifier.calls)

	// Once withdrawn, neither another View nor the end of the situation
	// withdraws it again; an id nobody was notified about is ignored.
	f.service.View("s1")
	f.service.View("unknown")
	f.advance(time.Minute)
	f.service.Update(nil)
	f.advance(attention.Grace)
	f.service.Update(nil)

	wantCalls(t, "notifier", []string{sent, "withdraw:s1"}, f.notifier.calls)
}

func TestOpenLeadsToThePlaceOnce(t *testing.T) {
	t.Parallel()
	f := newService(t, false)
	draft := found(taskID, prPlace, attention.KindDraft)
	f.settle(draft)

	target, ok := f.service.Open("s1")
	if !ok {
		t.Fatal("Open(s1) = false, want the place of the situation")
	}
	if diff := cmp.Diff(attention.Target{TaskID: taskID, Place: prPlace}, target); diff != "" {
		t.Errorf("Open(s1) mismatch (-want +got):\n%s", diff)
	}
	if target, ok = f.service.Open("s1"); ok {
		t.Errorf("Open(s1) again = %+v, true; want false", target)
	}

	// A situation that ended still leads to its place.
	findings := found(taskID, stepPlace, attention.KindFindings)
	f.settle(draft, findings)
	f.service.Update([]attention.Found{draft})
	f.advance(attention.Grace)
	f.service.Update([]attention.Found{draft})

	target, ok = f.service.Open("s2")
	if !ok {
		t.Fatal("Open(s2) = false, want the place of the situation that ended")
	}
	if diff := cmp.Diff(attention.Target{TaskID: taskID, Place: stepPlace}, target); diff != "" {
		t.Errorf("Open(s2) mismatch (-want +got):\n%s", diff)
	}
	wantCalls(t, "notifier", []string{
		"send:s1:login-screen:draft at pr",
		"send:s2:login-screen:findings at step:2",
		"withdraw:s2",
	}, f.notifier.calls)
}

func TestTheSituationsOfATaskComeMostUrgentFirst(t *testing.T) {
	t.Parallel()
	f := newService(t, true)

	stepAt := func(number int) attention.Place {
		return attention.Place{Kind: attention.PlaceStep, Step: number}
	}
	merge := found(taskID, prPlace, attention.KindMerge)
	findings := found(taskID, stepAt(1), attention.KindFindings)
	blocked := found(taskID, stepAt(2), attention.KindPRBlocked)
	draft := found(taskID, stepAt(3), attention.KindDraft)
	reply := found(taskID, stepAt(4), attention.KindReply)
	failed := found("task-2", prdPlace, attention.KindSessionError)

	// One start after the other, and the last three at the same instant.
	f.settle(merge)
	f.advance(time.Minute)
	f.settle(merge, findings)
	f.advance(time.Minute)
	f.settle(merge, findings, blocked)
	f.advance(time.Minute)
	got := f.settle(merge, findings, blocked, draft, reply, failed)

	step := attention.Settle + time.Minute
	situation := func(id string, fd attention.Found, startedAt time.Time) attention.Situation {
		return attention.Situation{ID: id, TaskID: fd.TaskID, Place: fd.Place, Kind: fd.Kind, StartedAt: startedAt}
	}
	want := map[string][]attention.Situation{
		taskID: {
			situation("s3", blocked, base.Add(2*step)),
			situation("s2", findings, base.Add(step)),
			situation("s4", draft, base.Add(3*step)),
			situation("s5", reply, base.Add(3*step)),
			situation("s1", merge, base),
		},
		"task-2": {situation("s6", failed, base.Add(3*step))},
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("Update() mismatch (-want +got):\n%s", diff)
	}
}

func TestAStoreThatFailsOnlyReachesTheLog(t *testing.T) {
	t.Parallel()
	f := newService(t, false)
	f.store.err = errors.New("disk I/O error")

	want := holding(taskID, attention.Situation{
		ID: "s1", TaskID: taskID, Place: prdPlace, Kind: attention.KindReply, StartedAt: base,
	})
	if diff := cmp.Diff(want, f.settle(found(taskID, prdPlace, attention.KindReply))); diff != "" {
		t.Errorf("Update() with a failing store mismatch (-want +got):\n%s", diff)
	}
	f.advance(time.Minute)
	f.service.Update(nil)
	f.advance(attention.Grace)
	f.service.Update(nil)

	wantCalls(t, "notifier", []string{"send:s1:login-screen:reply at stage:prd", "withdraw:s1"}, f.notifier.calls)
	for _, msg := range []string{"record situation failed", "forget situation failed"} {
		if got := f.logged(t, msg); got != 1 {
			t.Errorf("logged %q %d times, want once", msg, got)
		}
	}
}

func TestNoNotifierSendsNothing(t *testing.T) {
	t.Parallel()

	clk := &clock{now: base}
	var started []attention.Started
	service := attention.New(attention.Deps{
		Store:     newMemStore(),
		Focused:   func() bool { return false },
		Now:       clk.Now,
		OnStarted: func(st attention.Started) { started = append(started, st) },
	})
	reply := []attention.Found{found(taskID, prdPlace, attention.KindReply)}

	service.Update(reply)
	clk.advance(attention.Settle)
	got := service.Update(reply)[taskID]
	if len(got) != 1 {
		t.Fatalf("Update() = %v, want the situation all the same", got)
	}
	if len(started) != 1 || started[0].Focused {
		t.Errorf("OnStarted heard %+v, want one situation started away from the window", started)
	}

	// Nothing was sent, so nothing leads anywhere or is withdrawn.
	id := got[0].ID
	if target, ok := service.Open(id); ok {
		t.Errorf("Open(%s) = %+v, true; want false", id, target)
	}
	service.View(id)
	clk.advance(time.Minute)
	service.Update(nil)
	clk.advance(attention.Grace)
	if ended := service.Update(nil); len(ended) != 0 {
		t.Errorf("Update() once ended = %v, want nothing", ended)
	}
}

func TestNothingIsScheduledOnceClosed(t *testing.T) {
	t.Parallel()
	f := newService(t, false)
	reply := found(taskID, prdPlace, attention.KindReply)

	f.service.Update([]attention.Found{reply})
	f.service.Close()
	if !f.after.timers[0].stopped {
		t.Error("Close() left the settle scheduled")
	}
	// A timer can fire as Close stops it; what it runs asks for nothing.
	f.after.timers[0].f()
	if f.dues != 0 {
		t.Errorf("OnDue called %d times after Close, want never", f.dues)
	}

	f.advance(attention.Settle)
	f.service.Update([]attention.Found{reply, found("task-2", prdPlace, attention.KindReply)})

	if len(f.after.timers) != 1 {
		t.Errorf("scheduled %v, want nothing after Close", f.after.delays())
	}
	wantCalls(t, "notifier", nil, f.notifier.calls)
}
