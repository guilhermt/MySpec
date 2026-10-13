package git

// platformArgs lets git work with the long paths a worktree deep in the
// local app data reaches, past the 260 characters Windows allows by default.
var platformArgs = []string{"-c", "core.longpaths=true"}
