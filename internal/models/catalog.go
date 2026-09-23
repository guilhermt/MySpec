package models

import (
	"slices"

	"github.com/guilhermt/myspec/internal/claude"
)

// CatalogModel is a model the installed Claude Code offers, with the effort
// levels it accepts.
type CatalogModel struct {
	Name    Model    `json:"name"`
	Efforts []Effort `json:"efforts"` // never nil; empty for a model that takes no effort
}

// Catalog is what the installed Claude Code offers: one entry per model, in the
// order the CLI lists them. An empty catalog is one no reading ever filled.
type Catalog struct {
	Models []CatalogModel `json:"models"` // never nil
}

// CatalogFailure is why the reading of the catalog failed.
type CatalogFailure string

// The ways a reading fails, as the interface tells them apart.
const (
	CatalogNotFound    CatalogFailure = "not_found"   // the CLI binary could not be located
	CatalogUnsupported CatalogFailure = "unsupported" // the installed CLI does not answer list_models
	CatalogFailed      CatalogFailure = "failed"      // the process errored, timed out or answered nonsense
)

// defaultAlias is the entry of the CLI that names the model of the machine's
// own settings; it always duplicates another entry of the catalog.
const defaultAlias = "default"

// CatalogFrom picks what the app offers out of what the CLI reported: one
// entry per resolved model, in the order of the CLI, the first of two entries
// that resolve to the same model, skipping the entry whose alias is "default",
// which duplicates another model, and the entries the CLI disabled. The
// efforts of a model are the levels it lists; none when it supports none.
func CatalogFrom(entries []claude.ModelEntry) Catalog {
	offered := make([]CatalogModel, 0, len(entries))
	seen := make(map[string]bool, len(entries))
	for _, entry := range entries {
		if entry.Value == defaultAlias || entry.Disabled || entry.ResolvedModel == "" || seen[entry.ResolvedModel] {
			continue
		}
		seen[entry.ResolvedModel] = true

		efforts := make([]Effort, 0, len(entry.SupportedEffortLevels))
		if entry.SupportsEffort {
			for _, level := range entry.SupportedEffortLevels {
				efforts = append(efforts, Effort(level))
			}
		}
		offered = append(offered, CatalogModel{Name: Model(entry.ResolvedModel), Efforts: efforts})
	}
	return Catalog{Models: offered}
}

// Lookup is the entry of a model, and whether the catalog has it.
func (c Catalog) Lookup(name Model) (CatalogModel, bool) {
	for _, model := range c.Models {
		if model.Name == name {
			return model, true
		}
	}
	return CatalogModel{}, false
}

// ProcessEffort is the effort a process starts with for a choice: none for a
// model the catalog knows and that takes no effort, the effort of the choice
// otherwise. A model the catalog lacks keeps its effort, and the CLI decides.
func (c Catalog) ProcessEffort(choice Choice) Effort {
	if model, ok := c.Lookup(choice.Model); ok && len(model.Efforts) == 0 {
		return ""
	}
	return choice.Effort
}

// clone is a copy no caller of the service can write on.
func (c Catalog) clone() Catalog {
	cloned := make([]CatalogModel, len(c.Models))
	for i, model := range c.Models {
		model.Efforts = slices.Clone(model.Efforts)
		cloned[i] = model
	}
	return Catalog{Models: cloned}
}
