package gh

import "context"

// Clone clones the GitHub repository owner/name into dir, which must not exist.
// A failure is the *Error of the command, carrying what gh said.
func (r *Runner) Clone(ctx context.Context, fullName, dir string) error {
	_, err := r.Run(ctx, "", "repo", "clone", fullName, dir)
	return err
}
