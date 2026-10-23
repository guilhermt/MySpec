package contract_test

import (
	"encoding/json"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/contract"
)

func bash(t *testing.T, command string) []contract.Action {
	t.Helper()
	input, err := json.Marshal(map[string]string{"command": command})
	if err != nil {
		t.Fatal(err)
	}
	return contract.Classify("Bash", input)
}

func kinds(actions []contract.Action) []contract.Kind {
	if len(actions) == 0 {
		return nil
	}
	out := make([]contract.Kind, 0, len(actions))
	for _, a := range actions {
		out = append(out, a.Kind)
	}
	return out
}

func TestGitCommandsAreClassifiedByWhatTheyDo(t *testing.T) {
	t.Parallel()

	cases := []struct {
		command string
		want    contract.Kind
	}{
		{"git status", contract.KindRead},
		{"git --version", contract.KindRead},
		{"git", contract.KindRead},
		{"git log --oneline -5", contract.KindRead},
		{"git -C /tmp/x diff HEAD", contract.KindRead},
		{"git -c core.pager=cat show HEAD", contract.KindRead},
		{"git --no-pager log", contract.KindRead},
		{"/usr/bin/git status", contract.KindRead},
		{"git.exe status", contract.KindRead},
		{"git fetch origin", contract.KindRead},
		{"git reflog", contract.KindRead},
		{"git reflog show HEAD", contract.KindRead},
		{"git reflog expire --all", contract.KindOther},
		{"git reflog delete HEAD@{1}", contract.KindOther},
		{"git reflog -n 20", contract.KindRead},
		{"git reflog --date=iso", contract.KindRead},
		{"git reflog HEAD", contract.KindRead},
		{"git worktree list", contract.KindRead},
		{"git stash list", contract.KindRead},
		{"git stash show -p", contract.KindRead},
		{"git remote", contract.KindRead},
		{"git remote -v", contract.KindRead},
		{"git remote get-url origin", contract.KindRead},
		{"git remote add x y", contract.KindOther},
		{"git config --get user.name", contract.KindRead},
		{"git config --list", contract.KindRead},
		{"git config user.name", contract.KindRead},
		{"git config user.name Ana", contract.KindOther},
		{"git config --unset user.name", contract.KindOther},
		{"git symbolic-ref HEAD", contract.KindRead},
		{"git symbolic-ref HEAD refs/heads/x", contract.KindOther},
		{"git branch", contract.KindRead},
		{"git branch -a", contract.KindRead},
		{"git branch -vv", contract.KindRead},
		{"git branch --show-current", contract.KindRead},
		{"git branch --contains abc123", contract.KindRead},
		{"git branch --merged origin/main", contract.KindRead},
		{"git branch --sort=-committerdate", contract.KindRead},
		{"git branch --list 'feat/*'", contract.KindRead},
		{"git branch feature", contract.KindBranch},
		{"git branch -D feature", contract.KindBranch},
		{"git branch -m old new", contract.KindBranch},
		{"git branch --set-upstream-to=origin/x", contract.KindBranch},
		{"git tag", contract.KindRead},
		{"git tag -l 'v*'", contract.KindRead},
		{"git tag --contains abc", contract.KindRead},
		{"git tag v1.0.0", contract.KindTag},
		{"git tag -d v1.0.0", contract.KindTag},
		{"git add -A", contract.KindLocal},
		{"git rm a.go", contract.KindLocal},
		{"git mv a b", contract.KindLocal},
		{"git restore --staged a.go", contract.KindLocal},
		{"git clean -fd", contract.KindLocal},
		{"git apply fix.patch", contract.KindLocal},
		{"git stash", contract.KindLocal},
		{"git stash pop", contract.KindLocal},
		{"git checkout -- a.go", contract.KindLocal},
		{"git checkout HEAD -- a.go", contract.KindLocal},
		{"git checkout -b feature", contract.KindBranch},
		{"git checkout main", contract.KindBranch},
		{"git checkout main --", contract.KindBranch},
		{"git checkout --detach abc", contract.KindBranch},
		{"git switch main", contract.KindBranch},
		{"git reset", contract.KindLocal},
		{"git reset --hard", contract.KindLocal},
		{"git reset HEAD", contract.KindLocal},
		{"git reset --soft HEAD", contract.KindLocal},
		{"git reset -- a.go", contract.KindLocal},
		{"git reset HEAD -- a.go", contract.KindLocal},
		{"git reset HEAD~1", contract.KindHistory},
		{"git reset --hard origin/dev", contract.KindHistory},
		{"git merge --abort", contract.KindLocal},
		{"git merge --quit", contract.KindLocal},
		{"git merge origin/dev", contract.KindMerge},
		{"git merge --continue", contract.KindMerge},
		{"git pull", contract.KindMerge},
		{"git pull --rebase origin dev", contract.KindMerge},
		{"git commit -m 'msg'", contract.KindCommit},
		{`git commit -m "msg with space"`, contract.KindCommit},
		{"git commit --amend --no-edit", contract.KindHistory},
		{"git rebase main", contract.KindHistory},
		{"git cherry-pick abc", contract.KindHistory},
		{"git revert abc", contract.KindHistory},
		{"git update-ref -d refs/heads/x", contract.KindHistory},
		{"git worktree add ../x", contract.KindBranch},
		{"git worktree remove ../x", contract.KindBranch},
		{"git push", contract.KindPush},
		{"git push --force origin main", contract.KindPush},
		{"git submodule update", contract.KindOther},
		{"git gc", contract.KindOther},
		{"git unknown-alias", contract.KindOther},
		{"git $SUB", contract.KindOther},
		{`git "$SUB" status`, contract.KindOther},
	}
	for _, tc := range cases {
		t.Run(tc.command, func(t *testing.T) {
			t.Parallel()
			actions := bash(t, tc.command)
			if len(actions) != 1 {
				t.Fatalf("got %d actions, want 1: %+v", len(actions), actions)
			}
			if actions[0].Kind != tc.want {
				t.Errorf("kind = %q, want %q", actions[0].Kind, tc.want)
			}
		})
	}
}

func TestAnActionKeepsTheCommandAndTheArgumentsAfterTheGlobalOptions(t *testing.T) {
	t.Parallel()

	got := bash(t, "cd x && git -C /tmp/x -c a=b merge origin/dev --no-edit")
	want := []contract.Action{{
		Kind:    contract.KindMerge,
		Command: "git -C /tmp/x -c a=b merge origin/dev --no-edit",
		Args:    []string{"merge", "origin/dev", "--no-edit"},
	}}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("actions (-want +got):\n%s", diff)
	}
}

func TestGitHubCommandsAreClassifiedByWhatTheyDo(t *testing.T) {
	t.Parallel()

	cases := []struct {
		command string
		want    contract.Kind
	}{
		{"gh pr view 12", contract.KindRead},
		{"gh pr list --state open", contract.KindRead},
		{"gh pr checks", contract.KindRead},
		{"gh pr diff 3", contract.KindRead},
		{"gh -R owner/repo pr view 12", contract.KindRead},
		{"gh pr view 12 --repo owner/repo", contract.KindRead},
		{"gh pr --hostname github.com view 1", contract.KindRead},
		{"gh run view 1", contract.KindRead},
		{"gh run watch 1", contract.KindRead},
		{"gh issue view 4", contract.KindRead},
		{"gh repo view", contract.KindRead},
		{"gh release list", contract.KindRead},
		{"gh workflow list", contract.KindRead},
		{"gh search issues bug", contract.KindRead},
		{"gh auth status", contract.KindRead},
		{"gh status", contract.KindRead},
		{"gh browse", contract.KindRead},
		{"gh --version", contract.KindRead},
		{"gh label list", contract.KindRead},
		{"gh project item-list 1", contract.KindRead},
		{"gh api repos/o/r/pulls", contract.KindRead},
		{"gh api -X GET repos/o/r", contract.KindRead},
		{"gh api --method=GET repos/o/r", contract.KindRead},
		{"gh api graphql -f query='query { viewer { login } }'", contract.KindRead},
		{"gh api graphql -f query='mutation { x }'", contract.KindGitHub},
		{"gh api -X POST repos/o/r/issues", contract.KindGitHub},
		{"gh api -XPATCH repos/o/r/issues/1", contract.KindGitHub},
		{"gh api --method DELETE repos/o/r/x", contract.KindGitHub},
		{"gh api repos/o/r/issues -f title=x", contract.KindGitHub},
		{"gh api repos/o/r/issues -F body=@f", contract.KindGitHub},
		{"gh api repos/o/r/issues --input f.json", contract.KindGitHub},
		{"gh pr create --title x", contract.KindGitHub},
		{"gh pr merge 1", contract.KindGitHub},
		{"gh pr comment 1 --body x", contract.KindGitHub},
		{"gh pr", contract.KindGitHub},
		{"gh issue create", contract.KindGitHub},
		{"gh release create v1", contract.KindGitHub},
		{"gh repo delete x", contract.KindGitHub},
		{"gh $SUB", contract.KindGitHub},
	}
	for _, tc := range cases {
		t.Run(tc.command, func(t *testing.T) {
			t.Parallel()
			actions := bash(t, tc.command)
			if len(actions) != 1 {
				t.Fatalf("got %d actions, want 1: %+v", len(actions), actions)
			}
			if actions[0].Kind != tc.want {
				t.Errorf("kind = %q, want %q", actions[0].Kind, tc.want)
			}
		})
	}
}

func TestEveryCommandOfAShellStructureIsClassified(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		command string
		want    []contract.Kind
	}{
		{"and list", "git add -A && git commit -m x && git push", []contract.Kind{contract.KindLocal, contract.KindCommit, contract.KindPush}},
		{"pipe", "git log | head -3", []contract.Kind{contract.KindRead}},
		{"semicolon and or", "git status; git push || git pull", []contract.Kind{contract.KindRead, contract.KindPush, contract.KindMerge}},
		{"subshell", "(cd x && git push)", []contract.Kind{contract.KindPush}},
		{"command substitution", "echo $(git push)", []contract.Kind{contract.KindPush}},
		{"block and loop", "for b in a b; do { git push origin $b; }; done", []contract.Kind{contract.KindPush}},
		{"env prefix", "FOO=1 git push", []contract.Kind{contract.KindPush}},
		{"env command", "env -i FOO=1 -u BAR git push", []contract.Kind{contract.KindPush}},
		{"command exec nohup time", "nohup time command exec git push", []contract.Kind{contract.KindPush}},
		{"sudo", "sudo -u root git push", []contract.Kind{contract.KindPush}},
		{"xargs", "echo x | xargs -I {} git push {}", []contract.Kind{contract.KindPush}},
		{"timeout", "timeout 30 git push", []contract.Kind{contract.KindPush}},
		{"timeout with option", "timeout -s KILL 30 gh pr create", []contract.Kind{contract.KindGitHub}},
		{"bash -c", `bash -c "git push && git status"`, []contract.Kind{contract.KindPush, contract.KindRead}},
		{"sh -lc", `sh -lc 'git commit -m x'`, []contract.Kind{contract.KindCommit}},
		{"zsh -c nested", `zsh -c "bash -c 'gh pr merge 1'"`, []contract.Kind{contract.KindGitHub}},
		{"quoted name", `"git" push`, []contract.Kind{contract.KindPush}},
		{"windows path", `C:\Program Files\Git\cmd\git.exe push`, nil},
		{"unix path", "/usr/local/bin/git push", []contract.Kind{contract.KindPush}},
		{"name from a variable", "$GIT push", nil},
		{"no git", "ls -la && echo git", nil},
		{"empty", "", nil},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got := kinds(bash(t, tc.command))
			if diff := cmp.Diff(tc.want, got); diff != "" {
				t.Errorf("kinds (-want +got):\n%s", diff)
			}
		})
	}
}

func TestAScriptThatDoesNotParseIsOneUnknownActionWhenItNamesGit(t *testing.T) {
	t.Parallel()

	got := bash(t, "if git push; then")
	want := []contract.Action{{Kind: contract.KindOther, Command: "if git push; then"}}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("actions (-want +got):\n%s", diff)
	}

	if got := bash(t, "if ls; then"); got != nil {
		t.Errorf("a broken script without git = %+v, want nil", got)
	}
	if got := bash(t, "echo 'unclosed gh"); len(got) != 1 {
		t.Errorf("a broken script with gh = %+v, want one action", got)
	}
	if got := bash(t, "echo 'unclosed digit"); got != nil {
		t.Errorf("a broken script with only a word that contains git = %+v, want nil", got)
	}
}

func TestPowerShellIsClassifiedLikeBash(t *testing.T) {
	t.Parallel()

	got := contract.Classify("PowerShell", json.RawMessage(`{"command":"git push origin main"}`))
	if diff := cmp.Diff([]contract.Kind{contract.KindPush}, kinds(got)); diff != "" {
		t.Errorf("kinds (-want +got):\n%s", diff)
	}
}

func TestAGitHubMCPToolIsAnActionAndNothingElseIs(t *testing.T) {
	t.Parallel()

	cases := []struct {
		tool string
		want []contract.Kind
	}{
		{"mcp__github__get_pull_request", []contract.Kind{contract.KindRead}},
		{"mcp__github__list_issues", []contract.Kind{contract.KindRead}},
		{"mcp__github__search_code", []contract.Kind{contract.KindRead}},
		{"mcp__github__read_file", []contract.Kind{contract.KindRead}},
		{"mcp__github__get_me", []contract.Kind{contract.KindRead}},
		{"mcp__github__create_pull_request", []contract.Kind{contract.KindGitHub}},
		{"mcp__plugin_github_github__merge_pull_request", []contract.Kind{contract.KindGitHub}},
		{"mcp__GitHub__push_files", []contract.Kind{contract.KindGitHub}},
		{"mcp__slack__post_message", nil},
		{"Read", nil},
		{"mcp__github", nil},
	}
	for _, tc := range cases {
		t.Run(tc.tool, func(t *testing.T) {
			t.Parallel()
			got := contract.Classify(tc.tool, json.RawMessage(`{}`))
			if diff := cmp.Diff(tc.want, kinds(got)); diff != "" {
				t.Errorf("kinds (-want +got):\n%s", diff)
			}
			if len(got) == 1 && got[0].Command != tc.tool {
				t.Errorf("command = %q, want the tool name", got[0].Command)
			}
		})
	}
}

func TestABashInputWithoutACommandIsOther(t *testing.T) {
	t.Parallel()

	for _, in := range []string{`not json`, `{}`, `{"command": 3}`} {
		got := contract.Classify("Bash", json.RawMessage(in))
		if len(got) != 1 || got[0].Kind != contract.KindOther {
			t.Errorf("Classify(%s) = %+v, want one KindOther action", in, got)
		}
	}
}
