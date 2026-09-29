package flow

import (
	"context"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/session"
)

// MarkChecks exposes markChecks to the external tests of the package: a pass
// only starts from a reading without pending checks, so the flow never hands it
// one.
func (s *Service) MarkChecks(ctx context.Context, key session.Key, pass int, checks *gh.PRChecks) {
	s.markChecks(ctx, key, pass, checks)
}
