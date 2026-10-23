package contract_test

import (
	"strings"
	"testing"

	"github.com/guilhermt/myspec/internal/contract"
)

func act(kind contract.Kind, args ...string) contract.Action {
	return contract.Action{Kind: kind, Command: strings.Join(args, " "), Args: args}
}

func TestTheContractOfEachRole(t *testing.T) {
	t.Parallel()

	commit := contract.State{Role: contract.RoleStep, Turn: contract.TurnCommit, Branch: "task/x", Base: "dev", Step: 2}
	idle := commit
	idle.Turn = contract.TurnNone
	fix := func(role contract.Role, turn contract.Turn) contract.State {
		return contract.State{Role: role, Turn: turn, Branch: "feat", Base: "dev"}
	}

	cases := []struct {
		name    string
		state   contract.State
		actions []contract.Action
		outside bool
		reason  string
	}{
		{"a read is always inside", contract.State{Role: contract.RoleDiscussion}, []contract.Action{act(contract.KindRead, "log")}, false, ""},
		{"no actions", contract.State{Role: contract.RoleDiscussion}, nil, false, ""},
		{
			"planning writes no git",
			contract.State{Role: contract.RolePlanning},
			[]contract.Action{act(contract.KindLocal, "add")},
			true,
			"This is outside what this stage does: this stage only writes its document. Git and GitHub stay as they are.",
		},
		{
			"an unknown role is asked",
			contract.State{},
			[]contract.Action{act(contract.KindCommit, "commit")},
			true,
			"This is outside what this stage does: this stage only writes its document. Git and GitHub stay as they are.",
		},
		{"step stages files", idle, []contract.Action{act(contract.KindLocal, "add")}, false, ""},
		{"step commits on the commit turn", commit, []contract.Action{act(contract.KindCommit, "commit")}, false, ""},
		{
			"step commit off the turn", idle,
			[]contract.Action{act(contract.KindCommit, "commit")},
			true,
			"This is outside what this stage does: MySpec asks for the commit of step 2 once its review is done.",
		},
		{
			"step push", commit,
			[]contract.Action{act(contract.KindPush, "push")},
			true,
			"This is outside what this stage does: MySpec pushes task/x itself when it opens the pull request.",
		},
		{
			"step amend", commit,
			[]contract.Action{act(contract.KindHistory, "commit", "--amend")},
			true,
			"This is outside what this stage does: MySpec expects the work of step 2 on task/x, committed when it asks.",
		},
		{
			"step without a branch",
			contract.State{Role: contract.RoleStep, Step: 1},
			[]contract.Action{act(contract.KindBranch, "switch")},
			true,
			"This is outside what this stage does: MySpec expects the work of step 1 on the branch of the task, committed when it asks.",
		},
		{
			"step review only reads",
			contract.State{Role: contract.RoleStepReview},
			[]contract.Action{act(contract.KindLocal, "add")},
			true,
			"This is outside what this stage does: the reviewer only reads. The implementer changes the code, and MySpec asks for the commit.",
		},
		{
			"pr review only reads",
			contract.State{Role: contract.RolePRReview},
			[]contract.Action{act(contract.KindCommit, "commit")},
			true,
			"This is outside what this stage does: the reviewer only reads. The implementer changes the code, and MySpec asks for the commit.",
		},
		{
			"draft pushes",
			contract.State{Role: contract.RolePRDraft, Base: "dev"},
			[]contract.Action{act(contract.KindPush, "push")},
			true,
			"This is outside what this stage does: MySpec opens the pull request into dev once you approve the draft.",
		},
		{
			"draft opens the pr",
			contract.State{Role: contract.RolePRDraft},
			[]contract.Action{act(contract.KindGitHub, "pr", "create")},
			true,
			"This is outside what this stage does: MySpec opens the pull request into its base once you approve the draft.",
		},
		{
			"draft anything else",
			contract.State{Role: contract.RolePRDraft, Base: "dev"},
			[]contract.Action{act(contract.KindGitHub, "pr", "merge")},
			true,
			"This is outside what this stage does: this stage only writes the draft. MySpec opens the pull request into dev once you approve it.",
		},
		{"fix stages", fix(contract.RolePRFix, contract.TurnApply), []contract.Action{act(contract.KindLocal, "restore")}, false, ""},
		{"fix commits on the commit turn", fix(contract.RolePRFix, contract.TurnCommit), []contract.Action{act(contract.KindCommit, "commit")}, false, ""},
		{
			"fix commit on the apply turn", fix(contract.RolePRFix, contract.TurnApply),
			[]contract.Action{act(contract.KindCommit, "commit")},
			true,
			"This is outside what this stage does: MySpec asks for the commit once the changes are approved.",
		},
		{
			"fix push", fix(contract.RolePRFix, contract.TurnCommit),
			[]contract.Action{act(contract.KindPush, "push")},
			true,
			"This is outside what this stage does: MySpec pushes every commit of the review to the pull request itself.",
		},
		{"fix merges the base", fix(contract.RolePRFix, contract.TurnApply), []contract.Action{act(contract.KindMerge, "merge", "origin/dev")}, false, ""},
		{"fix merges the base with a message", fix(contract.RolePRFix, contract.TurnApply), []contract.Action{act(contract.KindMerge, "merge", "origin/dev", "-m", "Merge origin/dev")}, false, ""},
		{"fix merges the base with a strategy option", fix(contract.RoleReviewApply, contract.TurnApply), []contract.Action{act(contract.KindMerge, "merge", "-s", "ort", "-X", "theirs", "origin/dev")}, false, ""},
		{
			"fix merges another branch with a message", fix(contract.RolePRFix, contract.TurnApply),
			[]contract.Action{act(contract.KindMerge, "merge", "-m", "origin/dev", "origin/main")},
			true,
			"This is outside what this stage does: the only merge here is origin/dev, to resolve a conflict the review asked for.",
		},
		{"fix merges the base with options", fix(contract.RolePRFix, contract.TurnCommit), []contract.Action{act(contract.KindMerge, "merge", "--no-edit", "origin/dev")}, false, ""},
		{"fix continues a merge", fix(contract.RolePRFix, contract.TurnApply), []contract.Action{act(contract.KindMerge, "merge", "--continue")}, false, ""},
		{
			"fix merges another branch", fix(contract.RolePRFix, contract.TurnApply),
			[]contract.Action{act(contract.KindMerge, "merge", "origin/main")},
			true,
			"This is outside what this stage does: the only merge here is origin/dev, to resolve a conflict the review asked for.",
		},
		{
			"fix merges two targets", fix(contract.RolePRFix, contract.TurnApply),
			[]contract.Action{act(contract.KindMerge, "merge", "origin/dev", "x")},
			true,
			"This is outside what this stage does: the only merge here is origin/dev, to resolve a conflict the review asked for.",
		},
		{
			"fix pulls", fix(contract.RolePRFix, contract.TurnApply),
			[]contract.Action{act(contract.KindMerge, "pull", "origin", "dev")},
			true,
			"This is outside what this stage does: the only merge here is origin/dev, to resolve a conflict the review asked for.",
		},
		{
			"fix merges off a turn", fix(contract.RolePRFix, contract.TurnNone),
			[]contract.Action{act(contract.KindMerge, "merge", "origin/dev")},
			true,
			"This is outside what this stage does: the only merge here is origin/dev, to resolve a conflict the review asked for.",
		},
		{
			"fix without a base merges nothing",
			contract.State{Role: contract.RolePRFix, Turn: contract.TurnApply},
			[]contract.Action{act(contract.KindMerge, "merge", "origin/")},
			true,
			"This is outside what this stage does: the only merge here is origin/its base, to resolve a conflict the review asked for.",
		},
		{
			"fix history", fix(contract.RolePRFix, contract.TurnApply),
			[]contract.Action{act(contract.KindHistory, "rebase")},
			true,
			"This is outside what this stage does: MySpec expects the fixes on feat, committed when it asks.",
		},
		{
			"apply commit", fix(contract.RoleReviewApply, contract.TurnApply),
			[]contract.Action{act(contract.KindCommit, "commit")},
			true,
			"This is outside what this stage does: MySpec asks for the commit once you approve the changes.",
		},
		{"apply commits on its turn", fix(contract.RoleReviewApply, contract.TurnCommit), []contract.Action{act(contract.KindCommit, "commit")}, false, ""},
		{
			"apply push", fix(contract.RoleReviewApply, contract.TurnCommit),
			[]contract.Action{act(contract.KindPush, "push")},
			true,
			"This is outside what this stage does: MySpec pushes the commit of the fixes itself.",
		},
		{
			"apply merge", fix(contract.RoleReviewApply, contract.TurnApply),
			[]contract.Action{act(contract.KindMerge, "merge", "origin/x")},
			true,
			"This is outside what this stage does: the only merge here is origin/dev, to resolve a conflict you approved.",
		},
		{
			"apply anything else", fix(contract.RoleReviewApply, contract.TurnApply),
			[]contract.Action{act(contract.KindGitHub, "pr", "merge")},
			true,
			"This is outside what this stage does: MySpec expects the fixes on the pull request as it is, committed when it asks.",
		},
		{
			"publish only reads",
			contract.State{Role: contract.RoleReviewPublish},
			[]contract.Action{act(contract.KindGitHub, "pr", "comment")},
			true,
			"This is outside what this stage does: this review only reads. MySpec publishes the findings you approve.",
		},
		{
			"discussion only writes documents",
			contract.State{Role: contract.RoleDiscussion},
			[]contract.Action{act(contract.KindGitHub, "issue", "create")},
			true,
			"This is outside what this stage does: the discussion only writes its documents. MySpec publishes the drafts you approve.",
		},
		{
			"the first action outside decides", commit,
			[]contract.Action{act(contract.KindLocal, "add"), act(contract.KindPush, "push"), act(contract.KindTag, "tag")},
			true,
			"This is outside what this stage does: MySpec pushes task/x itself when it opens the pull request.",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			reason, outside := contract.Check(tc.state, tc.actions)
			if outside != tc.outside || reason != tc.reason {
				t.Errorf("Check = (%q, %v), want (%q, %v)", reason, outside, tc.reason, tc.outside)
			}
		})
	}
}

func TestEveryReasonStartsWithThePrefix(t *testing.T) {
	t.Parallel()

	roles := []contract.Role{
		contract.RolePlanning, contract.RoleStep, contract.RoleStepReview, contract.RolePRDraft, contract.RolePRReview,
		contract.RolePRFix, contract.RoleReviewPublish, contract.RoleReviewApply, contract.RoleDiscussion, "",
	}
	kinds := []contract.Kind{contract.KindLocal, contract.KindCommit, contract.KindMerge, contract.KindHistory, contract.KindBranch, contract.KindTag, contract.KindPush, contract.KindGitHub, contract.KindOther}
	for _, role := range roles {
		for _, kind := range kinds {
			reason, outside := contract.Check(contract.State{Role: role}, []contract.Action{{Kind: kind}})
			if !outside {
				continue
			}
			if !strings.HasPrefix(reason, contract.ReasonPrefix) || !strings.HasSuffix(reason, ".") {
				t.Errorf("role %q, kind %q: reason %q", role, kind, reason)
			}
		}
	}
}
