package discussionflow

import "github.com/guilhermt/myspec/internal/discussion"

// ChainView is what the chain says about a list of drafts, for the external
// tests: what the next run writes, in order, what holds each draft, and which
// approved drafts won't publish.
type ChainView struct {
	Due         []string // ids, in the order of the run
	Cycle       bool
	Holds       map[string]Hold // the drafts something holds, by id
	WontPublish []string        // ids, in position order
}

// ChainOf works the chain of a list of drafts out.
func ChainOf(drafts []discussion.Draft) ChainView {
	c := chainOf(drafts)
	view := ChainView{Cycle: c.cycle, Holds: c.holds}
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
