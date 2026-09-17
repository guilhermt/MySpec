package repository

import "strconv"

// Reason is why the app refuses a folder, a repository or an action on one.
type Reason string

// The reasons a repository is refused.
const (
	ReasonCloneMissing    Reason = "clone_missing"      // the registered path is not a clone any more
	ReasonNotGitRoot      Reason = "not_git_root"       // the folder is not the root of a git repository
	ReasonNoOrigin        Reason = "no_origin"          // the repository has no origin remote
	ReasonNotGitHub       Reason = "not_github"         // the origin remote is not on github.com
	ReasonRegistered      Reason = "already_registered" // owner/name is registered at another path
	ReasonOtherRepository Reason = "other_repository"   // the new path is a clone of another repository
	ReasonHasTasks        Reason = "has_tasks"          // the repository still has tasks
	ReasonNotCloned       Reason = "not_cloned"         // the repository has no clone yet
	ReasonPathTaken       Reason = "path_taken"         // the clone target exists and is not a clone of the repository
)

// Refusal is a folder or a repository the app refuses, with everything the
// sentence the user reads needs.
type Refusal struct {
	Reason     Reason
	Path       string // the folder chosen, the registered path for clone_missing and already_registered, the clone target for path_taken
	URL        string // not_github: the origin remote
	Repository string // already_registered, other_repository, has_tasks, not_cloned, path_taken: owner/name of the registered repository
	Other      string // other_repository: owner/name of the folder chosen
	Active     int    // has_tasks
	Archived   int    // has_tasks
}

func (r *Refusal) Error() string { return "repository: " + r.Message() }

// Message is the refusal as the interface shows it.
func (r *Refusal) Message() string {
	switch r.Reason {
	case ReasonCloneMissing:
		return "The clone at " + r.Path + " is missing."
	case ReasonNotGitRoot:
		return r.Path + " is not the root of a git repository."
	case ReasonNoOrigin:
		return r.Path + " has no origin remote."
	case ReasonNotGitHub:
		return "The origin remote of " + r.Path + " is not on GitHub: " + r.URL + "."
	case ReasonRegistered:
		return r.Repository + " is already registered at " + r.Path + "."
	case ReasonOtherRepository:
		return r.Path + " is a clone of " + r.Other + ", not of " + r.Repository + "."
	case ReasonHasTasks:
		return r.Repository + " has " + tasks(r.Active, "active") + " and " + tasks(r.Archived, "archived") +
			". Delete them before removing the repository."
	case ReasonNotCloned:
		return r.Repository + " isn't cloned yet."
	case ReasonPathTaken:
		return r.Path + " already exists and is not a clone of " + r.Repository + "."
	default:
		return r.Path + " is refused: " + string(r.Reason) + "."
	}
}

// tasks counts tasks of a kind in words: "1 active task", "2 archived tasks".
func tasks(n int, kind string) string {
	noun := "tasks"
	if n == 1 {
		noun = "task"
	}
	return strconv.Itoa(n) + " " + kind + " " + noun
}
