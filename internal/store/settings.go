package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

// SettingsRepo stores the app settings as key-value pairs. It implements
// theme.Settings.
type SettingsRepo struct{ db *sql.DB }

// Get returns the value stored for key and whether there is one.
func (r *SettingsRepo) Get(ctx context.Context, key string) (string, bool, error) {
	const query = `SELECT value FROM settings WHERE key = ?`

	var value string
	err := r.db.QueryRowContext(ctx, query, key).Scan(&value)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return "", false, nil
	case err != nil:
		return "", false, fmt.Errorf("get setting %s: %w", key, err)
	}
	return value, true, nil
}

// Set writes value for key, overwriting whatever was there.
func (r *SettingsRepo) Set(ctx context.Context, key, value string) error {
	const upsert = `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
		ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`

	updatedAt := time.Now().UTC().Format(time.RFC3339Nano)
	if _, err := r.db.ExecContext(ctx, upsert, key, value, updatedAt); err != nil {
		return fmt.Errorf("set setting %s: %w", key, err)
	}
	return nil
}
