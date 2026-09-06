package claude

import (
	"context"
	"errors"
	"fmt"
	"os/exec"
)

// ErrNotLoggedIn reports that the CLI has no login the app can use.
var ErrNotLoggedIn = errors.New("claude: not logged in")

// Preflight runs `claude auth status` and reports whether the CLI can be used
// with the user's login. It wraps ErrNotLoggedIn when the exit code is 1 and
// returns any other failure as is. The caller owns the timeout.
func Preflight(ctx context.Context, binary string) error {
	cmd := exec.CommandContext(ctx, binary, "auth", "status")
	// Both streams stay nil, which sends them to the null device: only the
	// exit code says whether the user is logged in.

	if err := cmd.Run(); err != nil {
		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) && exitErr.ExitCode() == 1 {
			return fmt.Errorf("claude auth status: %w", ErrNotLoggedIn)
		}
		return fmt.Errorf("claude auth status: %w", err)
	}
	return nil
}
