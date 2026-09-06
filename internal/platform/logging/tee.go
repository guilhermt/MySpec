package logging

import (
	"context"
	"errors"
	"log/slog"
)

// teeHandler fans every record out to two handlers, so the same logger can
// write JSON to the log file and readable text to stderr.
type teeHandler struct {
	primary   slog.Handler
	secondary slog.Handler
}

func newTee(primary, secondary slog.Handler) *teeHandler {
	return &teeHandler{primary: primary, secondary: secondary}
}

func (t *teeHandler) Enabled(ctx context.Context, level slog.Level) bool {
	return t.primary.Enabled(ctx, level) || t.secondary.Enabled(ctx, level)
}

func (t *teeHandler) Handle(ctx context.Context, rec slog.Record) error {
	var errs []error
	for _, h := range []slog.Handler{t.primary, t.secondary} {
		if !h.Enabled(ctx, rec.Level) {
			continue
		}
		// Clone because a handler may keep the record's attrs.
		if err := h.Handle(ctx, rec.Clone()); err != nil {
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...)
}

func (t *teeHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return newTee(t.primary.WithAttrs(attrs), t.secondary.WithAttrs(attrs))
}

func (t *teeHandler) WithGroup(name string) slog.Handler {
	return newTee(t.primary.WithGroup(name), t.secondary.WithGroup(name))
}
