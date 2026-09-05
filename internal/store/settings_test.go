package store_test

import "testing"

func TestSettingsGetMissingKey(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	value, ok, err := s.Settings.Get(t.Context(), "theme")
	if err != nil {
		t.Fatalf("Get() = %v, want nil", err)
	}
	if ok {
		t.Errorf("Get() ok = true, want false")
	}
	if value != "" {
		t.Errorf("Get() value = %q, want empty", value)
	}
}

func TestSettingsSetThenGet(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	if err := s.Settings.Set(t.Context(), "theme", "dark"); err != nil {
		t.Fatalf("Set() = %v, want nil", err)
	}

	value, ok, err := s.Settings.Get(t.Context(), "theme")
	if err != nil {
		t.Fatalf("Get() = %v, want nil", err)
	}
	if !ok || value != "dark" {
		t.Errorf("Get() = %q, %v, want %q, true", value, ok, "dark")
	}
}

func TestSettingsSetOverwrites(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	for _, value := range []string{"dark", "light"} {
		if err := s.Settings.Set(t.Context(), "theme", value); err != nil {
			t.Fatalf("Set(%q) = %v, want nil", value, err)
		}
	}

	value, ok, err := s.Settings.Get(t.Context(), "theme")
	if err != nil {
		t.Fatalf("Get() = %v, want nil", err)
	}
	if !ok || value != "light" {
		t.Errorf("Get() = %q, %v, want %q, true", value, ok, "light")
	}
}

func TestSettingsKeysAreIndependent(t *testing.T) {
	t.Parallel()
	s := newStore(t)

	if err := s.Settings.Set(t.Context(), "theme", "dark"); err != nil {
		t.Fatalf("Set() = %v, want nil", err)
	}

	if _, ok, err := s.Settings.Get(t.Context(), "other"); err != nil || ok {
		t.Errorf("Get(other) = %v, %v, want false, nil", ok, err)
	}
}
