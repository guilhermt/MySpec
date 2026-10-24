package selfcontext

import (
	"fmt"
	"time"

	"github.com/guilhermt/myspec/internal/discussion"
	"github.com/guilhermt/myspec/internal/discussionflow"
	"github.com/guilhermt/myspec/internal/session"
)

// DiscussionInput is what the state of a discussion is rendered from.
type DiscussionInput struct {
	State    discussionflow.State
	Stage    string
	Sessions map[session.Key]session.Summary
	Now      time.Time
}

// Discussion is the state of a discussion for its session.
func Discussion(in DiscussionInput) string {
	s, d := in.State, in.State.Discussion
	status := "Status: " + labelOf(discussionStatusLabels, s.Status)
	if s.Round > 0 {
		status += fmt.Sprintf(" · round %d", s.Round)
	}
	written := "not written yet"
	if s.HasDocument {
		written = "written"
	}
	lines := []string{
		header("discussion", in.Now),
		fmt.Sprintf("Discussion: %s · board %s", d.Title, d.BoardTitle),
		fmt.Sprintf("This conversation: %s (%s)", conversationName(in.Stage), in.Stage),
		status,
		fmt.Sprintf("Documents: discussion.md %s (%s); drafts.md %s", d.DocumentPath(), written, d.DraftsPath()),
	}
	if s.UnreadableDrafts != "" {
		lines = append(lines, "Drafts unreadable: "+s.UnreadableDrafts)
	}
	lines = append(lines, draftLines(s)...)
	if k := publishedEarlier(s); k > 0 {
		lines = append(lines, fmt.Sprintf("Published in earlier rounds: %d drafts", k))
	}
	lines = append(lines, archiveLine(s), conversationsLine(d.ID, in.Stage, in.Sessions))
	return block(append(lines, divergenceLines(s.Divergence)...))
}

// draftLines list the drafts of the current round, one per line.
func draftLines(s discussionflow.State) []string {
	if s.Round == 0 {
		return []string{"Drafts: none yet"}
	}
	lines := []string{fmt.Sprintf("Drafts of round %d:", s.Round)}
	for _, ds := range s.Drafts {
		if ds.Draft.Round == s.Round {
			lines = append(lines, draftLine(ds.Draft))
		}
	}
	return lines
}

// draftLine is one draft: what it is, what the user decided and, when there is
// one, how its publication went.
func draftLine(d discussion.Draft) string {
	line := fmt.Sprintf("- %s · %s · %s · %s", d.ID, draftKind(d), d.Title, draftDecision(d.Decision))
	switch {
	case d.Published.Outcome != discussion.OutcomeNone:
		line += fmt.Sprintf(" · published as %s/%s#%d %s", d.Owner, d.Name, d.Published.Number, d.Published.URL)
	case d.PublishError != "":
		line += " · publish failed: " + d.PublishError
	}
	return line
}

// draftKind says what the draft would do on GitHub.
func draftKind(d discussion.Draft) string {
	switch d.Kind {
	case discussion.KindUpdate:
		if d.Card != nil {
			return fmt.Sprintf("update of %s/%s#%d", d.Card.Owner, d.Card.Name, d.Card.Number)
		}
		return "update"
	case discussion.KindEpic:
		return fmt.Sprintf("epic in %s/%s", d.Owner, d.Name)
	default: // a new card
	}
	return fmt.Sprintf("new card in %s/%s", d.Owner, d.Name)
}

// draftDecision is what the user decided about a draft.
func draftDecision(d discussion.Decision) string {
	switch d {
	case discussion.DecisionApproved:
		return "Approved"
	case discussion.DecisionDiscarded:
		return "Discarded"
	default: // not decided yet
	}
	return "To decide"
}

// publishedEarlier counts the drafts of earlier rounds that went to GitHub.
func publishedEarlier(s discussionflow.State) int {
	n := 0
	for _, ds := range s.Drafts {
		if ds.Draft.Round < s.Round && ds.Draft.Published.Outcome != discussion.OutcomeNone {
			n++
		}
	}
	return n
}

// archiveLine says whether the discussion can leave the list, and if not why.
func archiveLine(s discussionflow.State) string {
	if s.CanArchive {
		return "Ready to archive: yes"
	}
	if s.ArchiveHint == "" {
		return "Ready to archive: no"
	}
	return "Ready to archive: no · " + s.ArchiveHint
}
