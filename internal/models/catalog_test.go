package models_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/claude"
	"github.com/guilhermt/myspec/internal/claude/claudetest"
	"github.com/guilhermt/myspec/internal/models"
)

// referenceCatalog is what the app offers out of the catalog of the fake: one
// entry per resolved model, without the default alias, the duplicate and the
// disabled entry.
func referenceCatalog() models.Catalog {
	efforts := []models.Effort{models.Low, models.Medium, models.High, models.XHigh, models.Max}
	return models.Catalog{Models: []models.CatalogModel{
		{Name: "claude-opus-5-5[1m]", Efforts: efforts},
		{Name: models.Fable51, Efforts: efforts},
		{Name: models.Sonnet5, Efforts: efforts},
		{Name: "claude-haiku-4-5-20251001", Efforts: []models.Effort{}},
	}}
}

func TestCatalogFromOffersOneEntryPerResolvedModel(t *testing.T) {
	t.Parallel()

	got := models.CatalogFrom(claudetest.Catalog)
	if diff := cmp.Diff(referenceCatalog(), got); diff != "" {
		t.Errorf("CatalogFrom() mismatch (-want +got):\n%s", diff)
	}
}

func TestCatalogFromNothingIsEmptyAndNotNil(t *testing.T) {
	t.Parallel()

	got := models.CatalogFrom(nil)
	if got.Models == nil {
		t.Fatal("CatalogFrom(nil).Models = nil, want an empty slice")
	}
	if len(got.Models) != 0 {
		t.Errorf("CatalogFrom(nil).Models has %d models, want none", len(got.Models))
	}
}

func TestCatalogFromSkipsAModelWithoutAResolvedName(t *testing.T) {
	t.Parallel()

	got := models.CatalogFrom([]claude.ModelEntry{{Value: "mystery"}, {Value: "sonnet", ResolvedModel: "claude-sonnet-5"}})
	want := models.Catalog{Models: []models.CatalogModel{{Name: models.Sonnet5, Efforts: []models.Effort{}}}}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("CatalogFrom() mismatch (-want +got):\n%s", diff)
	}
}

func TestLookupFindsAModelByName(t *testing.T) {
	t.Parallel()

	catalog := referenceCatalog()

	got, ok := catalog.Lookup(models.Sonnet5)
	if !ok {
		t.Fatalf("Lookup(%q) found nothing, want the model", models.Sonnet5)
	}
	if diff := cmp.Diff(catalog.Models[2], got); diff != "" {
		t.Errorf("Lookup() mismatch (-want +got):\n%s", diff)
	}

	if _, ok := catalog.Lookup("gpt"); ok {
		t.Error(`Lookup("gpt") found a model, want nothing`)
	}
}

func TestProcessEffortDropsTheEffortOfAModelThatTakesNone(t *testing.T) {
	t.Parallel()

	catalog := referenceCatalog()
	cases := []struct {
		name   string
		choice models.Choice
		want   models.Effort
	}{
		{"a model that takes no effort", models.Choice{Model: "claude-haiku-4-5-20251001", Effort: models.High}, ""},
		{"a model that takes one", models.Choice{Model: models.Sonnet5, Effort: models.High}, models.High},
		{"a model the catalog lacks", models.Choice{Model: "gpt", Effort: models.High}, models.High},
		{"a choice without an effort", models.Choice{Model: models.Sonnet5}, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := catalog.ProcessEffort(tc.choice); got != tc.want {
				t.Errorf("ProcessEffort(%+v) = %q, want %q", tc.choice, got, tc.want)
			}
		})
	}
}
