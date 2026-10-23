package contract

import (
	"encoding/json"
	"regexp"
	"slices"
	"strings"

	"mvdan.cc/sh/v3/syntax"
)

var gitOrGH = regexp.MustCompile(`\b(git|gh)\b`)

var mutationWord = regexp.MustCompile(`(?i)\bmutation\b`)

// Classify lists the git and GitHub actions of a tool call, nil when it has
// none. A shell input without a string command is one KindOther action.
func Classify(tool string, input json.RawMessage) []Action {
	switch tool {
	case "Bash", "PowerShell":
		var in struct {
			Command *string `json:"command"`
		}
		if json.Unmarshal(input, &in) != nil || in.Command == nil {
			return []Action{{Kind: KindOther, Command: string(input)}}
		}
		return classifyScript(*in.Command)
	}
	return classifyMCP(tool)
}

func classifyMCP(tool string) []Action {
	parts := strings.SplitN(tool, "__", 3)
	if len(parts) != 3 || parts[0] != "mcp" || !strings.Contains(strings.ToLower(parts[1]), "github") {
		return nil
	}
	kind := KindGitHub
	for _, p := range []string{"get_", "list_", "search_", "read_"} {
		if strings.HasPrefix(parts[2], p) {
			kind = KindRead
		}
	}
	return []Action{{Kind: kind, Command: tool}}
}

// classifyScript parses a shell script and classifies every simple command of
// it. A script that doesn't parse is one unknown action when it names git or
// gh at all.
func classifyScript(src string) []Action {
	file, err := syntax.NewParser(syntax.Variant(syntax.LangBash)).Parse(strings.NewReader(src), "")
	if err != nil {
		if gitOrGH.MatchString(src) {
			return []Action{{Kind: KindOther, Command: src}}
		}
		return nil
	}

	var actions []Action
	syntax.Walk(file, func(n syntax.Node) bool {
		if call, ok := n.(*syntax.CallExpr); ok {
			actions = append(actions, classifyCall(call, src)...)
		}
		return true
	})
	return actions
}

func classifyCall(call *syntax.CallExpr, src string) []Action {
	words := make([]string, len(call.Args))
	literal := make([]bool, len(call.Args))
	for i, w := range call.Args {
		words[i], literal[i] = wordText(w)
	}

	i := skipPrefixes(words)
	if i >= len(words) || !literal[i] {
		return nil
	}
	text := src[call.Pos().Offset():call.End().Offset()]
	args := words[i+1:]

	switch executable(words[i]) {
	case "git":
		return []Action{{Kind: classifyGit(args), Command: text, Args: gitRest(args)}}
	case "gh":
		return []Action{{Kind: classifyGH(args), Command: text, Args: ghRest(args)}}
	case "bash", "sh", "zsh":
		for j, a := range args {
			if strings.HasPrefix(a, "-") && !strings.HasPrefix(a, "--") && strings.Contains(a, "c") {
				if j+1 < len(args) && literal[i+2+j] {
					return classifyScript(args[j+1])
				}
				break
			}
		}
	}
	return nil
}

// wordText is the text of a word that can be read without running anything,
// and whether the whole word is that text.
func wordText(w *syntax.Word) (string, bool) {
	var b strings.Builder
	literal := writeParts(&b, w.Parts)
	return b.String(), literal
}

func writeParts(b *strings.Builder, parts []syntax.WordPart) bool {
	literal := true
	for _, p := range parts {
		switch p := p.(type) {
		case *syntax.Lit:
			b.WriteString(p.Value)
		case *syntax.SglQuoted:
			b.WriteString(p.Value)
		case *syntax.DblQuoted:
			if !writeParts(b, p.Parts) {
				literal = false
			}
		default:
			literal = false
		}
	}
	return literal
}

// executable is a command name without its path and its .exe.
func executable(word string) string {
	if i := strings.LastIndexAny(word, `/\`); i >= 0 {
		word = word[i+1:]
	}
	word = strings.ToLower(word)
	return strings.TrimSuffix(word, ".exe")
}

// skipPrefixes returns the index of the command a chain of env, command,
// exec, nohup, time, sudo, xargs and timeout runs.
func skipPrefixes(words []string) int {
	i := 0
	for i < len(words) {
		switch executable(words[i]) {
		case "env":
			i = skipEnv(words, i+1)
		case "command", "exec", "nohup", "time":
			i++
			for i < len(words) && strings.HasPrefix(words[i], "-") {
				i++
			}
		case "sudo":
			i = skipOptions(words, i+1, "-u", "-g", "-h", "-p", "-C", "-D", "-R", "-T", "-U", "--user", "--group", "--host", "--prompt", "--chdir", "--chroot", "--other-user")
			for i < len(words) && strings.Contains(words[i], "=") && !strings.HasPrefix(words[i], "-") {
				i++
			}
		case "xargs":
			i = skipOptions(words, i+1, "-I", "-n", "-P", "-L", "-d", "-E", "-s", "-a", "-J", "-l")
		case "timeout":
			i = skipOptions(words, i+1, "-s", "-k", "--signal", "--kill-after")
			if i < len(words) {
				i++ // the duration
			}
		default:
			return i
		}
	}
	return i
}

// skipEnv skips the options and the assignments of env from i.
func skipEnv(words []string, i int) int {
	for i < len(words) {
		w := words[i]
		switch {
		case slices.Contains([]string{"-u", "--unset", "-C", "--chdir"}, w):
			i += 2
		case strings.HasPrefix(w, "-"), strings.Contains(w, "="):
			i++
		default:
			return i
		}
	}
	return i
}

// skipOptions skips the options from i, those named in valued taking the
// next word as their value, and returns the index of the first word that is
// not one.
func skipOptions(words []string, i int, valued ...string) int {
	for i < len(words) && strings.HasPrefix(words[i], "-") {
		if slices.Contains(valued, words[i]) {
			i++
		}
		i++
	}
	return i
}

var gitReadOnly = map[string]bool{
	"status": true, "log": true, "diff": true, "show": true, "rev-parse": true, "rev-list": true,
	"ls-files": true, "ls-tree": true, "ls-remote": true, "cat-file": true, "blame": true, "annotate": true,
	"grep": true, "describe": true, "shortlog": true, "merge-base": true, "merge-tree": true, "name-rev": true,
	"for-each-ref": true, "show-ref": true, "diff-tree": true, "diff-index": true, "diff-files": true,
	"whatchanged": true, "cherry": true, "range-diff": true, "format-patch": true, "check-ignore": true,
	"check-attr": true, "check-ref-format": true, "var": true, "version": true, "help": true,
	"count-objects": true, "verify-commit": true, "verify-tag": true, "fetch": true,
}

// gitRest is the arguments of a git call from its subcommand on, after the
// global options.
func gitRest(args []string) []string {
	for i := 0; i < len(args); {
		a := args[i]
		switch {
		case a == "-C", a == "-c", a == "--git-dir", a == "--work-tree", a == "--namespace":
			i += 2
		case strings.HasPrefix(a, "-"):
			i++
		default:
			return args[i:]
		}
	}
	return nil
}

func classifyGit(args []string) Kind {
	rest := gitRest(args)
	if len(rest) == 0 {
		return KindRead
	}
	sub, a := rest[0], rest[1:]
	if gitReadOnly[sub] {
		return KindRead
	}

	switch sub {
	case "reflog":
		if len(a) == 0 || !slices.Contains([]string{"expire", "delete", "drop"}, a[0]) {
			return KindRead
		}
	case "worktree":
		if len(a) > 0 {
			switch a[0] {
			case "list":
				return KindRead
			case "add", "remove", "move", "prune", "lock", "unlock", "repair":
				return KindBranch
			}
		}
	case "stash":
		if len(a) > 0 && (a[0] == "list" || a[0] == "show") {
			return KindRead
		}
		return KindLocal
	case "remote":
		if len(a) == 0 || slices.Contains([]string{"-v", "--verbose", "show", "get-url"}, a[0]) {
			return KindRead
		}
	case "config":
		return gitConfig(a)
	case "symbolic-ref":
		if !slices.ContainsFunc(a, func(x string) bool { return x == "-d" || x == "--delete" }) && len(positional(a)) == 1 {
			return KindRead
		}
	case "branch":
		return gitBranch(a)
	case "tag":
		return gitTag(a)
	case "add", "rm", "mv", "restore", "clean", "apply", "update-index":
		return KindLocal
	case "checkout":
		return gitCheckout(a)
	case "reset":
		return gitReset(a)
	case "commit":
		if slices.Contains(a, "--amend") {
			return KindHistory
		}
		return KindCommit
	case "merge":
		if slices.Contains(a, "--abort") || slices.Contains(a, "--quit") {
			return KindLocal
		}
		return KindMerge
	case "pull":
		return KindMerge
	case "rebase", "cherry-pick", "revert", "am", "update-ref", "filter-branch", "filter-repo", "replace":
		return KindHistory
	case "switch":
		return KindBranch
	case "push":
		return KindPush
	}
	return KindOther
}

// positional is the arguments that are not options.
func positional(args []string) []string {
	var out []string
	for _, a := range args {
		if !strings.HasPrefix(a, "-") {
			out = append(out, a)
		}
	}
	return out
}

func gitConfig(a []string) Kind {
	var names []string
	for i := 0; i < len(a); i++ {
		switch x := a[i]; {
		case slices.Contains([]string{"--get", "--get-all", "--get-regexp", "--get-urlmatch", "--list", "-l"}, x):
			return KindRead
		case slices.Contains([]string{"--unset", "--unset-all", "--add", "--replace-all", "--edit", "-e", "--rename-section", "--remove-section"}, x):
			return KindOther
		case slices.Contains([]string{"-f", "--file", "--blob", "--type", "-t", "--default"}, x):
			i++
		case !strings.HasPrefix(x, "-"):
			names = append(names, x)
		}
	}
	if len(names) == 1 {
		return KindRead
	}
	return KindOther
}

func gitBranch(a []string) Kind {
	var list, name bool
	for i := 0; i < len(a); i++ {
		x := a[i]
		key, _, hasValue := strings.Cut(x, "=")
		switch {
		case x == "--":
			name = name || i+1 < len(a)
			i = len(a)
		case !strings.HasPrefix(x, "-"):
			name = true
		case x == "-l" || x == "--list":
			list = true
		case slices.Contains([]string{"--contains", "--no-contains", "--merged", "--no-merged", "--points-at", "--sort", "--format"}, key):
			if !hasValue {
				i++
			}
		case slices.Contains([]string{"-a", "-r", "-v", "-vv", "--all", "--remotes", "--verbose", "--show-current", "--color", "--no-color", "--column", "--no-column", "-i", "--ignore-case"}, x):
		case isCluster(x, "arlvi"):
			list = list || strings.Contains(x, "l")
		default:
			return KindBranch
		}
	}
	if name && !list {
		return KindBranch
	}
	return KindRead
}

// isCluster tells whether x is a group of short options, all from letters.
func isCluster(x, letters string) bool {
	if len(x) < 2 || x[0] != '-' || x[1] == '-' {
		return false
	}
	return strings.Trim(x[1:], letters) == ""
}

func gitTag(a []string) Kind {
	if len(a) == 0 {
		return KindRead
	}
	for _, x := range a {
		key, _, _ := strings.Cut(x, "=")
		if slices.Contains([]string{"--list", "--contains", "--no-contains", "--points-at", "--sort", "--merged", "--no-merged"}, key) ||
			(isCluster(x, "ln0123456789") && strings.ContainsAny(x, "ln")) {
			return KindRead
		}
	}
	return KindTag
}

func gitCheckout(a []string) Kind {
	if slices.ContainsFunc(a, func(x string) bool {
		return slices.Contains([]string{"-b", "-B", "--orphan", "--detach", "-d", "-t", "--track"}, x)
	}) {
		return KindBranch
	}
	if i := slices.Index(a, "--"); i >= 0 && i < len(a)-1 {
		return KindLocal
	}
	return KindBranch
}

func gitReset(a []string) Kind {
	if i := slices.Index(a, "--"); i >= 0 {
		a = a[:i]
	}
	commits := positional(a)
	if len(commits) == 0 || commits[0] == "HEAD" || commits[0] == "@" {
		return KindLocal
	}
	return KindHistory
}

var ghReadOnly = map[string][]string{
	"pr":       {"view", "list", "checks", "diff", "status"},
	"run":      {"view", "list", "watch", "download"},
	"issue":    {"view", "list", "status"},
	"repo":     {"view", "list"},
	"release":  {"view", "list", "download"},
	"workflow": {"view", "list"},
	"auth":     {"status", "token"},
	"label":    {"list"},
	"gist":     {"view", "list"},
	"cache":    {"list"},
	"ruleset":  {"view", "list", "check"},
	"project":  {"view", "list", "item-list", "field-list"},
}

// ghRest is the arguments of a gh call without --repo/-R and --hostname.
func ghRest(args []string) []string {
	var out []string
	for i := 0; i < len(args); i++ {
		switch a := args[i]; {
		case a == "--repo", a == "-R", a == "--hostname":
			i++
		case strings.HasPrefix(a, "--repo="), strings.HasPrefix(a, "--hostname="):
		default:
			out = append(out, a)
		}
	}
	return out
}

func classifyGH(args []string) Kind {
	rest := ghRest(args)
	pos := positional(rest)
	if len(pos) == 0 {
		return KindRead
	}

	switch pos[0] {
	case "status", "browse", "version":
		return KindRead
	case "search":
		return KindRead
	case "api":
		return classifyAPI(rest)
	}
	if subs, ok := ghReadOnly[pos[0]]; ok && len(pos) > 1 && slices.Contains(subs, pos[1]) {
		return KindRead
	}
	return KindGitHub
}

func classifyAPI(rest []string) Kind {
	var endpoint string
	for i := 1; i < len(rest); i++ {
		x := rest[i]
		if !strings.HasPrefix(x, "-") {
			endpoint = x
			break
		}
		if slices.Contains([]string{"-X", "--method", "-H", "--header", "-q", "--jq", "-t", "--template", "--cache", "-f", "-F", "--field", "--raw-field", "--input", "-p", "--preview"}, x) {
			i++
		}
	}
	if endpoint == "graphql" {
		if mutationWord.MatchString(strings.Join(rest, " ")) {
			return KindGitHub
		}
		return KindRead
	}

	for i := 1; i < len(rest); i++ {
		x := rest[i]
		key, value, hasValue := strings.Cut(x, "=")
		switch {
		case x == "--method" || x == "-X":
			if i+1 < len(rest) && !strings.EqualFold(rest[i+1], "GET") {
				return KindGitHub
			}
		case key == "--method" && hasValue:
			if !strings.EqualFold(value, "GET") {
				return KindGitHub
			}
		case strings.HasPrefix(x, "-X") && !strings.HasPrefix(x, "--"):
			if !strings.EqualFold(x[2:], "GET") {
				return KindGitHub
			}
		case slices.Contains([]string{"--field", "--raw-field", "--input"}, key),
			strings.HasPrefix(x, "-f") && !strings.HasPrefix(x, "--"),
			strings.HasPrefix(x, "-F") && !strings.HasPrefix(x, "--"):
			return KindGitHub
		}
	}
	return KindRead
}
