package app

import (
	"context"
	"time"
)

// prPollInterval is how often the app asks GitHub about the pull requests
// whose merge it waits for.
const prPollInterval = time.Minute

// pollPRs asks the flow to read the pull requests awaiting a merge, until ctx
// ends. The flow does the asking on goroutines of its own; this only keeps
// time.
func (a *App) pollPRs(ctx context.Context) {
	ticker := time.NewTicker(prPollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			a.flow.PollPRs()
		}
	}
}
