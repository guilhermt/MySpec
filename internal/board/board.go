// Package board owns the boards of GitHub Projects the user registered: the
// repositories each one manages, the last reading of its cards and how that
// reading is made. What a card becomes, a task, belongs to internal/task.
package board

import (
	"slices"
	"strings"
	"time"

	"github.com/guilhermt/myspec/internal/task"
)

// OwnerType is the kind of account a project belongs to.
type OwnerType string

// The kinds of account a project belongs to.
const (
	OwnerOrganization OwnerType = "organization"
	OwnerUser         OwnerType = "user"
)

// Board is a registered GitHub project.
type Board struct {
	ID            string
	Owner         string
	OwnerType     OwnerType
	Number        int
	Title         string
	URL           string
	FinalStatuses []string // option ids of the Status field; never nil
	SavedStatuses []Option // the options of the Status field at the last save; nil before one
	NewCardStatus string   // the option id of the Status field a card created by a discussion gets; "" for none
	CreatedAt     time.Time
}

// Option is one option of the Status field.
type Option struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// ModuleField is the single select field a discussion fills on a card: the one
// named Módulo or Module.
type ModuleField struct {
	ID      string   `json:"id"`
	Name    string   `json:"name"`    // as the board names it
	Options []Option `json:"options"` // board order; never nil
}

// Issue is an issue as the board view names it.
type Issue struct {
	Owner  string          `json:"owner"`
	Name   string          `json:"name"`
	Number int             `json:"number"`
	Title  string          `json:"title"`
	URL    string          `json:"url"`
	State  task.IssueState `json:"state"`
}

// Key identifies the issue: owner/name#number, in lower case.
func (i Issue) Key() string { return task.IssueKey(i.Owner, i.Name, i.Number) }

// FullName is the repository of the issue: owner/name.
func (i Issue) FullName() string { return i.Owner + "/" + i.Name }

// PRState is the state of a pull request.
type PRState string

// The states of a pull request.
const (
	PROpen   PRState = "open"
	PRMerged PRState = "merged"
	PRClosed PRState = "closed"
)

// PullRequest is a pull request linked to an issue.
type PullRequest struct {
	Owner  string  `json:"owner"`
	Name   string  `json:"name"`
	Number int     `json:"number"`
	URL    string  `json:"url"`
	State  PRState `json:"state"`
}

// Assignee is a person assigned to a card.
type Assignee struct {
	Login     string `json:"login"`
	AvatarURL string `json:"avatarUrl"`
}

// Field is a board field of a card that has a value.
type Field struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

// Epic is the epic of a card, with its description.
type Epic struct {
	Issue
	Body string `json:"body"`
}

// Related is an issue next to a card: a sibling or a dependency.
type Related struct {
	Issue
	Status  string `json:"status"`  // the option of the Status field; "" when not in the reading
	OnBoard bool   `json:"onBoard"` // the issue is a card of the reading
}

// Dependency is an issue a card depends on, with the pull requests that close it.
type Dependency struct {
	Related
	PullRequests []PullRequest `json:"pullRequests"`
	Satisfied    bool          `json:"satisfied"` // the issue is closed or a linked pull request merged
	// Unconfirmed is a dependency the reading has not confirmed yet: it warns of
	// nothing, and it is never Satisfied.
	Unconfirmed bool `json:"unconfirmed"`
}

// Card is an issue of the board, with everything the reading found about it.
type Card struct {
	Issue
	Body         string        `json:"body"`
	StatusID     string        `json:"statusId"` // "" without a status
	Status       string        `json:"status"`
	Assignees    []Assignee    `json:"assignees"`
	Fields       []Field       `json:"fields"` // board fields with a value, Status and Title excluded, in the order GitHub returned them
	PullRequests []PullRequest `json:"pullRequests"`
	Epic         *Epic         `json:"epic"`
	Siblings     []Related     `json:"siblings"`
	Dependencies []Dependency  `json:"dependencies"`
	ReadAt       time.Time     `json:"readAt"`
	Stamp        string        `json:"stamp"` // tells whether the card changed since it was read; "" reads it again
	// Unconfirmed is a card whose relations wait for the conclusion of a reading.
	Unconfirmed bool `json:"unconfirmed"`
	// EpicUnconfirmed is a card whose convention names an epic no reading has
	// confirmed.
	EpicUnconfirmed bool `json:"epicUnconfirmed"`
}

// Reading is what the last reading of a board left stored, which can be a
// first delivery. A reading stored before the status field id and the module
// field were read has neither: the next reading fills them in.
type Reading struct {
	ProjectID     string       `json:"projectId"`
	Title         string       `json:"title"`
	Viewer        string       `json:"viewer"`   // the login gh is authenticated as
	Statuses      []Option     `json:"statuses"` // the options of the Status field, in board order; empty without one
	HasStatus     bool         `json:"hasStatus"`
	StatusFieldID string       `json:"statusFieldId"` // "" without a Status field
	Module        *ModuleField `json:"module"`        // nil without a module field
	Cards         []Card       `json:"cards"`         // open ones in board order, then the closed ones in board order
	// StructureStamp is the structure the cards were read under; "" reads every
	// card again.
	StructureStamp string `json:"structureStamp"`
	// Index is the issues the batch read of the last complete reading, by key.
	Index map[string]indexedIssue `json:"index"`
}

// ModuleOptionID is the id of the option of the module field named name,
// ignoring case and accents.
func (r *Reading) ModuleOptionID(name string) (string, bool) {
	if r.Module == nil {
		return "", false
	}
	folded := fold(strings.TrimSpace(name))
	for _, o := range r.Module.Options {
		if strings.EqualFold(fold(strings.TrimSpace(o.Name)), folded) {
			return o.ID, true
		}
	}
	return "", false
}

// StatusOption is the option of the Status field of id.
func (r *Reading) StatusOption(id string) (Option, bool) {
	i := slices.IndexFunc(r.Statuses, func(o Option) bool { return o.ID == id })
	if i < 0 {
		return Option{}, false
	}
	return r.Statuses[i], true
}

// Stored is a board's reading as the app holds it.
type Stored struct {
	Reading  *Reading  // nil before a first delivery
	ReadAt   time.Time // the conclusion of the last complete reading, or the first delivery of a board that never had one
	Failure  *Failure  // the last reading failed; nil otherwise
	FailedAt time.Time
}
