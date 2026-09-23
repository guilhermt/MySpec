package store

import (
	"encoding/json"
	"fmt"

	"github.com/guilhermt/myspec/internal/gh"
)

// encodeTrouble is the JSON of a trouble, "" for none.
func encodeTrouble(t gh.Trouble) (string, error) {
	if !t.Any() {
		return "", nil
	}
	encoded, err := json.Marshal(t)
	if err != nil {
		return "", fmt.Errorf("encode trouble: %w", err)
	}
	return string(encoded), nil
}

// decodeTrouble reads the JSON back, the zero value for "".
func decodeTrouble(value string) (gh.Trouble, error) {
	if value == "" {
		return gh.Trouble{}, nil
	}
	var t gh.Trouble
	if err := json.Unmarshal([]byte(value), &t); err != nil {
		return gh.Trouble{}, fmt.Errorf("decode trouble: %w", err)
	}
	return t, nil
}
