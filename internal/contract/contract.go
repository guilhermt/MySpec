// Package contract is the git and GitHub contract of a session: what each
// kind of session may do with git and GitHub, and the PreToolUse hook of the
// Claude Code that applies it. It knows nothing of tasks, sessions or the
// database; the session writes the state the hook reads.
package contract

import (
	"fmt"
	"slices"
	"strings"
)

// Role is what a session is for, which is what its contract depends on.
type Role string

// The roles of a session.
const (
	RolePlanning      Role = "planning" // prd, tech_spec, plan, one_shot
	RoleStep          Role = "step"     // the implementer of a step
	RoleStepReview    Role = "step_review"
	RolePRDraft       Role = "pr_draft" // the session of the PR stage, which writes the draft
	RolePRReview      Role = "pr_review"
	RolePRFix         Role = "pr_fix"
	RoleReviewPublish Role = "review_publish" // the review center, publish mode
	RoleReviewApply   Role = "review_apply"   // the review center, apply mode
	RoleDiscussion    Role = "discussion"
)

// Turn is what the message that opened the turn in course asked for.
type Turn string

// The turns a message can open.
const (
	TurnNone   Turn = ""
	TurnCommit Turn = "commit" // a commit prompt of the app
	TurnApply  Turn = "apply"  // the approved findings, or a report handed to the implementer
)

// State is what the hook knows about a session: written by internal/session,
// one JSON file per session.
type State struct {
	Role   Role   `json:"role"`
	Turn   Turn   `json:"turn"`
	Branch string `json:"branch"` // the branch of the task or of the pull request; "" when none
	Base   string `json:"base"`   // the base without origin/: dev; "" when none
	Step   int    `json:"step"`   // RoleStep and RoleStepReview only
}

// Kind is what a git or GitHub action does.
type Kind string

// The kinds of action, from the one never stopped to the unknown one.
const (
	KindRead    Kind = "read"    // never stopped
	KindLocal   Kind = "local"   // the index and the files of the worktree: add, rm, mv, restore, stash, clean, apply, a reset that does not move the branch, checkout of paths
	KindCommit  Kind = "commit"  // git commit, without --amend
	KindMerge   Kind = "merge"   // git merge, and git pull
	KindHistory Kind = "history" // rebase, cherry-pick, revert, am, commit --amend, a reset that moves the branch, update-ref, filter-branch, replace
	KindBranch  Kind = "branch"  // create, switch, rename or delete a branch; checkout of a branch or a commit; worktree add, remove, move
	KindTag     Kind = "tag"
	KindPush    Kind = "push"
	KindGitHub  Kind = "github" // a write of gh, or of a GitHub MCP tool
	KindOther   Kind = "other"  // any other git write, and any git subcommand the classifier doesn't know
)

// Action is one git or GitHub action of a command.
type Action struct {
	Kind    Kind
	Command string   // the simple command as written: "git push origin main"
	Args    []string // git or gh arguments after the global options, the subcommand first
}

// ReasonPrefix starts every reason Check gives, and is how the app tells a
// deviation card from any other permission request.
const ReasonPrefix = "This is outside what this stage does: "

// Check applies the contract of the role of state to each action, in order.
// The first one outside it decides, and reason says what the app expects
// instead. A read is always inside.
func Check(state State, actions []Action) (reason string, outside bool) {
	for _, a := range actions {
		if a.Kind == KindRead || allowed(state, a) {
			continue
		}
		return reasonFor(state, a), true
	}
	return "", false
}

func allowed(st State, a Action) bool {
	switch st.Role {
	case RoleStep:
		return a.Kind == KindLocal || (a.Kind == KindCommit && st.Turn == TurnCommit)
	case RolePRFix, RoleReviewApply:
		return a.Kind == KindLocal ||
			(a.Kind == KindCommit && st.Turn == TurnCommit) ||
			(a.Kind == KindMerge && (st.Turn == TurnApply || st.Turn == TurnCommit) && mergesBase(st, a))
	case RolePlanning, RoleStepReview, RolePRDraft, RolePRReview, RoleReviewPublish, RoleDiscussion:
		return false
	}
	return false
}

// mergeValued are the options of git merge that take their value as the next
// argument; the forms with = are one argument already.
var mergeValued = []string{"-m", "--message", "-F", "--file", "-s", "--strategy", "-X", "--strategy-option", "--into-name"}

// mergesBase tells whether a is `git merge --continue`, or a merge whose only
// target is origin/<base>.
func mergesBase(st State, a Action) bool {
	if len(a.Args) == 0 || a.Args[0] != "merge" {
		return false
	}
	var targets []string
	args := a.Args[1:]
	for i := 0; i < len(args); i++ {
		switch arg := args[i]; {
		case arg == "--continue":
			return true
		case slices.Contains(mergeValued, arg):
			i++ // the value of the option is not a target
		case !strings.HasPrefix(arg, "-"):
			targets = append(targets, arg)
		}
	}
	return st.Base != "" && len(targets) == 1 && targets[0] == "origin/"+st.Base
}

func reasonFor(st State, a Action) string {
	base := st.Base
	if base == "" {
		base = "its base"
	}
	branch := st.Branch
	if branch == "" {
		branch = "the branch of the task"
	}
	step := st.Step

	var expects string
	switch st.Role {
	case RolePRDraft:
		if a.Kind == KindPush || (a.Kind == KindGitHub && len(a.Args) >= 2 && a.Args[0] == "pr" && a.Args[1] == "create") {
			expects = fmt.Sprintf("MySpec opens the pull request into %s once you approve the draft.", base)
		} else {
			expects = fmt.Sprintf("this stage only writes the draft. MySpec opens the pull request into %s once you approve it.", base)
		}
	case RoleStep:
		switch a.Kind {
		case KindCommit:
			expects = fmt.Sprintf("MySpec asks for the commit of step %d once its review is done.", step)
		case KindPush:
			expects = fmt.Sprintf("MySpec pushes %s itself when it opens the pull request.", branch)
		default:
			expects = fmt.Sprintf("MySpec expects the work of step %d on %s, committed when it asks.", step, branch)
		}
	case RolePRFix:
		switch a.Kind {
		case KindCommit:
			expects = "MySpec asks for the commit once the changes are approved."
		case KindPush:
			expects = "MySpec pushes every commit of the review to the pull request itself."
		case KindMerge:
			expects = fmt.Sprintf("the only merge here is origin/%s, to resolve a conflict the review asked for.", base)
		default:
			expects = fmt.Sprintf("MySpec expects the fixes on %s, committed when it asks.", branch)
		}
	case RoleReviewApply:
		switch a.Kind {
		case KindCommit:
			expects = "MySpec asks for the commit once you approve the changes."
		case KindPush:
			expects = "MySpec pushes the commit of the fixes itself."
		case KindMerge:
			expects = fmt.Sprintf("the only merge here is origin/%s, to resolve a conflict you approved.", base)
		default:
			expects = "MySpec expects the fixes on the pull request as it is, committed when it asks."
		}
	case RoleStepReview, RolePRReview:
		expects = "the reviewer only reads. The implementer changes the code, and MySpec asks for the commit."
	case RoleReviewPublish:
		expects = "this review only reads. MySpec publishes the findings you approve."
	case RoleDiscussion:
		expects = "the discussion only writes its documents. MySpec publishes the drafts you approve."
	default:
		expects = "this stage only writes its document. Git and GitHub stay as they are."
	}
	return ReasonPrefix + expects
}
