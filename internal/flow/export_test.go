package flow

import (
	"context"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
)

// MarkChecks exposes markChecks to the external tests of the package: a pass
// only starts from a reading without pending checks, so the flow never hands it
// one.
func (s *Service) MarkChecks(ctx context.Context, key session.Key, pass int, checks *gh.PRChecks) {
	s.markChecks(ctx, key, pass, checks)
}

// PRReportMessage exposes prReportMessage to the external tests of the package.
func PRReportMessage(path, content string, round int) string {
	return prReportMessage(path, content, round)
}

// PRLocalPassMessage exposes prLocalPassMessage to the external tests of the
// package.
func PRLocalPassMessage(reply, path, status string) string {
	return prLocalPassMessage(reply, path, status)
}

// DiscardedFindings exposes discardedFindings to the external tests of the
// package.
func DiscardedFindings(passes []task.PRPass, pass int) string {
	return discardedFindings(passes, pass)
}

// PRResolved exposes prResolved to the external tests of the package.
func PRResolved(pass task.PRPass) bool { return prResolved(pass) }

// ChecksGreen exposes checksGreen to the external tests of the package.
func ChecksGreen(c gh.PRChecks) bool { return checksGreen(c) }
