package claude_test

import (
	"os"
	"testing"

	"github.com/guilhermt/myspec/internal/claude/claudetest"
)

// TestMain lets the test binary stand in for the claude CLI: a child process
// started with EnvFlag set runs the fake instead of the tests.
func TestMain(m *testing.M) {
	if os.Getenv(claudetest.EnvFlag) == "1" {
		os.Exit(claudetest.Run())
	}
	os.Exit(m.Run())
}
