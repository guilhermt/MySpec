package store

import (
	"encoding/json"
	"fmt"

	"github.com/guilhermt/myspec/internal/gh"
)

// encodeChecks is the JSON of the checks of a reading, "" for none read.
func encodeChecks(checks []gh.Check) (string, error) {
	if checks == nil {
		return "", nil
	}
	encoded, err := json.Marshal(checks)
	if err != nil {
		return "", fmt.Errorf("encode checks: %w", err)
	}
	return string(encoded), nil
}

// decodeChecks reads the JSON back, nil for "".
func decodeChecks(value string) ([]gh.Check, error) {
	if value == "" {
		return nil, nil
	}
	var checks []gh.Check
	if err := json.Unmarshal([]byte(value), &checks); err != nil {
		return nil, fmt.Errorf("decode checks: %w", err)
	}
	return checks, nil
}
