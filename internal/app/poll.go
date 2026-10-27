package app

import (
	"context"
	"time"
)

// prPollInterval is how often the app asks GitHub about the pull requests
// whose merge it waits for.
const prPollInterval = time.Minute

// pullsRefreshTicks is how many polls go by between two readings of the open
// pull requests of the registered repositories and of the deploys of the
// managed ones: they change far more slowly than the pull request of a task the
// app is waiting on. It is the reading with the Deploys view closed.
const pullsRefreshTicks = 5

// pollPRs asks the flows to read the pull requests they wait on, and now and
// then the open pull requests of every repository and the deploys, until ctx ends. The flows do
// the asking on goroutines of their own; this only keeps time.
func (a *App) pollPRs(ctx context.Context) {
	ticker := time.NewTicker(prPollInterval)
	defer ticker.Stop()

	ticks := 0
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			a.flow.PollPRs()
			a.reviewFlow.Poll()
			ticks++
			if ticks%pullsRefreshTicks == 0 {
				a.pulls.Refresh()
				a.deploys.Refresh()
			}
		}
	}
}
