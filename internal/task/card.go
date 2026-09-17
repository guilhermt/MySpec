package task

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// IssueState is whether an issue is open.
type IssueState string

// The states of an issue.
const (
	IssueOpen   IssueState = "open"
	IssueClosed IssueState = "closed"
)

// Card is the card of the board a task was created from, as the last reading of
// the board saw it.
type Card struct {
	BoardID string // the board it was read from; kept when the board is removed
	Owner   string
	Name    string
	Number  int
	Title   string
	Body    string
	URL     string
	Status  string // the option of the Status field; "" without one
	State   IssueState
	Epic    *CardEpic // nil without an epic
	ReadAt  time.Time
}

// CardEpic is the epic of a card.
type CardEpic struct {
	Owner  string `json:"owner"`
	Name   string `json:"name"`
	Number int    `json:"number"`
	Title  string `json:"title"`
	URL    string `json:"url"`
}

// Key identifies the issue of a card: owner/name#number, in lower case.
func (c Card) Key() string { return IssueKey(c.Owner, c.Name, c.Number) }

// Key identifies the issue of the epic, as Card.Key does.
func (e CardEpic) Key() string { return IssueKey(e.Owner, e.Name, e.Number) }

// Reference is the card as a closing reference names it: owner/name#number, as
// GitHub writes it.
func (c Card) Reference() string {
	return c.Owner + "/" + c.Name + "#" + strconv.Itoa(c.Number)
}

// IssueKey is the key of an issue: owner/name#number in lower case.
func IssueKey(owner, name string, number int) string {
	return strings.ToLower(owner + "/" + name + "#" + strconv.Itoa(number))
}

// emptyCardBody stands in for the description of a card that has none.
const emptyCardBody = "_The card has no description._"

// Markdown is the card as the prompt of a pull request reads it.
func (c Card) Markdown() string {
	body := strings.TrimSpace(c.Body)
	if body == "" {
		body = emptyCardBody
	}
	return fmt.Sprintf("### %s\n\n- Issue: %s\n- Link: %s\n\n%s", c.Title, c.Reference(), c.URL, body)
}

// closingPattern finds a closing reference to the card: a keyword GitHub
// accepts, then #N or owner/name#N.
func closingPattern(c Card) *regexp.Regexp {
	return regexp.MustCompile(`(?i)\b(close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved)\s*:?\s+(?:` +
		regexp.QuoteMeta(c.Owner+"/"+c.Name) + `)?#` + strconv.Itoa(c.Number) + `\b`)
}

// EnsureClosingReference returns body with "Closes <Reference>" appended, after
// a blank line, unless body already closes the card.
func EnsureClosingReference(body string, c Card) string {
	if closingPattern(c).MatchString(body) {
		return body
	}
	closes := "Closes " + c.Reference()
	trimmed := strings.TrimRight(body, " \t\n")
	if trimmed == "" {
		return closes
	}
	return trimmed + "\n\n" + closes
}

// CardTakenError is a card that already has an active task.
type CardTakenError struct {
	Number   int
	TaskName string
}

func (e *CardTakenError) Error() string { return "task: card already has an active task" }

// CardUpdate is what a reading of a board saw of one card.
type CardUpdate struct {
	Title  string
	Body   string
	URL    string
	Status string
	State  IssueState
	Epic   *CardEpic
	ReadAt time.Time
}
