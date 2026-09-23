package claude

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os/exec"
	"strings"
	"time"

	"github.com/google/uuid"
)

// ErrCatalogUnsupported reports a CLI that does not answer list_models: one
// older than the request.
var ErrCatalogUnsupported = errors.New("claude: list_models is not supported")

// errNoCatalogAnswer reports a CLI that ended without answering.
var errNoCatalogAnswer = errors.New("claude: list_models got no answer")

// catalogWaitDelay is how long Wait gives the process to leave once its output
// ended or the context was cancelled, before it is killed.
const catalogWaitDelay = 2 * time.Second

// ListModels asks the CLI for the catalog of models it offers, in a process of
// its own that ends with the answer. dir is the working directory of the
// process. The caller owns the timeout: when ctx ends, the process is killed
// and the reading fails. It wraps ErrCatalogUnsupported when the CLI does not
// know the request.
func ListModels(ctx context.Context, binary, dir string) ([]ModelEntry, error) {
	cmd := exec.CommandContext(ctx, binary, Args...)
	cmd.Dir = dir
	cmd.WaitDelay = catalogWaitDelay

	stderr := &tailBuffer{limit: stderrTail}
	cmd.Stderr = stderr

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, fmt.Errorf("open claude stdin: %w", err)
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("open claude stdout: %w", err)
	}

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("start claude %s: %w", binary, err)
	}

	requestID := uuid.NewString()
	// The pipe is unbuffered, so the line and its terminator go in one write.
	if _, err := stdin.Write(append(ListModelsRequest(requestID), '\n')); err != nil {
		_ = stdin.Close()
		_ = cmd.Wait()
		return nil, fmt.Errorf("write list_models request: %w", err)
	}

	answer := readCatalogAnswer(stdout, stdin, requestID)
	// A second close is harmless, and the first one may not have happened.
	_ = stdin.Close()
	_ = cmd.Wait()

	// The exit error of Wait is not reported: with an answer in hand the exit
	// status does not matter, and without one the stderr says more.
	tail := strings.TrimSpace(stderr.String())
	switch {
	case answer == nil && ctx.Err() != nil:
		return nil, fmt.Errorf("claude list_models: %w: %s", ctx.Err(), tail)
	case answer == nil:
		return nil, fmt.Errorf("%w: %s", errNoCatalogAnswer, tail)
	case answer.Response.Subtype == "error":
		return nil, fmt.Errorf("claude list_models: %s: %w", answer.Response.Error, ErrCatalogUnsupported)
	}

	var catalog listModelsResponse
	if err := json.Unmarshal(answer.Response.Response, &catalog); err != nil {
		return nil, fmt.Errorf("decode list_models answer: %w", err)
	}
	return catalog.Models, nil
}

// readCatalogAnswer scans stdout for the answer to requestID and closes stdin
// once it has it, which makes the CLI exit. It keeps scanning to the end of
// stdout so that the pipe never fills, and returns nil when no answer came.
func readCatalogAnswer(stdout io.Reader, stdin io.Closer, requestID string) *ControlResponseEvent {
	var answer *ControlResponseEvent

	scanner := bufio.NewScanner(stdout)
	scanner.Buffer(make([]byte, 0, scanBuffer), maxLine)
	for scanner.Scan() {
		event, err := Decode(scanner.Bytes())
		if err != nil {
			continue
		}
		if answer != nil || event.ControlResponse == nil || event.ControlResponse.Response.RequestID != requestID {
			continue
		}
		answer = event.ControlResponse
		_ = stdin.Close()
	}
	return answer
}
