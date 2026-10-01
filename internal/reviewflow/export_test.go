package reviewflow

import "github.com/guilhermt/myspec/internal/gh"

// ChecksCount exposes checksCount to the external tests of the package: a pass
// only starts from a reading without pending checks, so the flow never hands it
// one.
func ChecksCount(checks gh.PRChecks) (passed, total int) {
	return checksCount(checks)
}
