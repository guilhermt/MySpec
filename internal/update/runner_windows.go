package update

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"time"

	"golang.org/x/sys/windows"
)

// runnerWaitDelay is how long Run waits for a script that was killed to exit
// before it kills it again.
const runnerWaitDelay = 5 * time.Second

// scriptRunner runs the install script with Windows PowerShell, without a
// window and in a process group of its own, with no job object: the app closing
// never stops it, because an installation cut between the two moves of the
// executable is worse than one that ends after the app. Only the deadline kills
// it.
type scriptRunner struct{}

// Run implements Runner.
func (scriptRunner) Run(ctx context.Context, script, result string) ([]byte, error) {
	root := os.Getenv("SystemRoot")
	if root == "" {
		root = `C:\Windows`
	}
	exe := filepath.Join(root, "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
	// The text goes through iex, as the irm | iex of the README does, which does
	// not depend on the execution policy. The path goes by the environment, so
	// it needs no quoting.
	cmd := exec.CommandContext(ctx, exe, "-NoProfile", "-NonInteractive", "-Command",
		"iex ([System.IO.File]::ReadAllText($env:MYSPEC_INSTALL_SCRIPT))")
	cmd.Env = append(os.Environ(), "MYSPEC_INSTALL_SCRIPT="+script, "MYSPEC_INSTALL_RESULT="+result)
	cmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: windows.CREATE_NO_WINDOW | windows.CREATE_NEW_PROCESS_GROUP}
	cmd.WaitDelay = runnerWaitDelay
	// The output goes to a file next to the script, never to a pipe of the app:
	// a script that prints after the app closed would die on the closed pipe.
	outputPath := filepath.Join(filepath.Dir(script), "output")
	file, err := os.Create(outputPath)
	if err != nil {
		return nil, fmt.Errorf("create the output of %s: %w", script, err)
	}
	cmd.Stdout, cmd.Stderr = file, file

	runErr := cmd.Run()
	_ = file.Close()
	output, _ := os.ReadFile(outputPath)
	if runErr != nil {
		return output, fmt.Errorf("run %s: %w", script, runErr)
	}
	return output, nil
}
