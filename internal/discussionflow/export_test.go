package discussionflow

import "github.com/guilhermt/myspec/internal/discussion"

// ChainView is what the chain says about a list of drafts, for the external
// tests: what the next run writes, in order, what holds each draft, which
// approved drafts won't publish, and what the discussion shows.
type ChainView struct {
	Due         []string // ids, in the order of the run
	Cycle       bool
	Holds       map[string]Hold // the drafts something holds, by id
	WontPublish []string        // ids, in position order
	Status      Status
	Waiting     Status
	ArchiveHint string // "" when the discussion can be archived
}

// ChainOf works the chain out the way State does, for a discussion whose
// drafts were read, whose conversation rests, and with a run under way when
// publishing says so.
func ChainOf(drafts []discussion.Draft, publishing bool) ChainView {
	c := chainOf(drafts)
	state := State{Discussion: discussion.Discussion{DraftsRead: true}, Publishing: publishing}
	settle(&state, drafts, nil)

	view := ChainView{
		Cycle:       c.cycle,
		Holds:       c.holds,
		Status:      state.Status,
		Waiting:     state.Waiting,
		ArchiveHint: state.ArchiveHint,
	}
	for _, d := range c.due() {
		view.Due = append(view.Due, d.ID)
	}
	for _, d := range drafts {
		if c.wontPublish(d.ID) {
			view.WontPublish = append(view.WontPublish, d.ID)
		}
	}
	return view
}
