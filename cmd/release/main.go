// Command release publishes a release of MySpec. task release runs it:
//
//	task release -- <patch|minor|major>
package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/release"
)

const usage = "usage: task release -- <patch|minor|major>"

// runTimeout is how long the checks, the fetch and the push have, together.
const runTimeout = 5 * time.Minute

func main() { os.Exit(run(os.Args[1:])) }

func run(args []string) int {
	if len(args) != 1 {
		fmt.Fprintln(os.Stderr, usage)
		return 2
	}
	bump, err := release.ParseBump(args[0])
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		fmt.Fprintln(os.Stderr, usage)
		return 2
	}

	ctx, cancel := context.WithTimeout(context.Background(), runTimeout)
	defer cancel()

	result, err := release.Run(ctx, release.Deps{Git: git.New(git.Deps{})}, ".", bump)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}

	fmt.Printf("Pushed %s. The release workflow builds and publishes it.\n", result.Version.Tag())
	if result.Links.Workflow != "" {
		fmt.Printf("Workflow: %s\n", result.Links.Workflow)
		fmt.Printf("Release:  %s\n", result.Links.Release)
	}
	return 0
}
