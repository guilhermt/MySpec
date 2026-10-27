package app

import (
	"strconv"
	"strings"
	"time"

	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/deploys"
)

// deployNotificationPrefix starts the id of the notification of a deploy, which
// is how a click tells it from the notification of a situation.
const deployNotificationPrefix = "deploy:"

// deployNotificationParts is how many parts the id of a notification of a deploy
// has after the prefix: the repository, the branch and the run.
const deployNotificationParts = 3

// onDeployFinished tells the user that a deploy the app merged ended: a toast
// with the window in front, a notification of the system with it away.
func (a *App) onDeployFinished(f deploys.Finished) {
	if a.windowFocused() {
		if wails, _ := a.handles(); wails != nil {
			wails.Event.Emit(bindings.EventDeployFinished, bindings.FromDeployFinished(f))
		}
		return
	}
	if a.notifier == nil {
		return
	}
	duration := deployDuration(f.Duration)
	body := "Deployed in " + duration + "."
	if !f.Succeeded {
		body = "The deploy failed after " + duration + "."
	}
	a.notifier.Send(deployNotificationID(f), f.FullName+" · "+f.Environment, body)
}

// deployNotificationID is the id of the notification of a deploy:
// deploy:<repository>:<branch>:<run>. Neither a UUID nor a branch holds a colon.
func deployNotificationID(f deploys.Finished) string {
	return deployNotificationPrefix + f.RepositoryID + ":" + f.Branch + ":" + strconv.FormatInt(f.RunID, 10)
}

// deployTarget reads a notification id of a deploy back: the repository and
// the branch; ok false for any other id.
func deployTarget(id string) (repositoryID, branch string, ok bool) {
	rest, found := strings.CutPrefix(id, deployNotificationPrefix)
	if !found {
		return "", "", false
	}
	parts := strings.Split(rest, ":")
	if len(parts) != deployNotificationParts || parts[0] == "" || parts[1] == "" {
		return "", "", false
	}
	return parts[0], parts[1], true
}

// deployDuration writes how long a deploy took: 3m 12s, 45s, or 1h 2m above an
// hour, without the seconds.
func deployDuration(d time.Duration) string {
	d = d.Round(time.Second)
	hours, minutes, seconds := int(d.Hours()), int(d.Minutes())%60, int(d.Seconds())%60
	switch {
	case hours > 0:
		return strconv.Itoa(hours) + "h " + strconv.Itoa(minutes) + "m"
	case minutes > 0:
		return strconv.Itoa(minutes) + "m " + strconv.Itoa(seconds) + "s"
	default:
		return strconv.Itoa(seconds) + "s"
	}
}
