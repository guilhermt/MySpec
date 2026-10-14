package app_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/wailsapp/wails/v3/pkg/application"

	"github.com/guilhermt/myspec/internal/app"
)

var (
	light = application.NewRGB(254, 253, 253)
	dark  = application.NewRGB(25, 23, 21)
)

func TestTheBackdropPaintsAColourAskedForEarlyWhenTheWebviewIsReady(t *testing.T) {
	t.Parallel()
	var b app.Backdrop

	b.Set(dark)

	var painted []application.RGBA
	b.Ready(func(c application.RGBA) { painted = append(painted, c) })
	if diff := cmp.Diff([]application.RGBA{dark}, painted); diff != "" {
		t.Errorf("painted when the webview became ready (-want +got):\n%s", diff)
	}
}

func TestTheBackdropPaintsOnlyTheLastColourAskedForBeforeTheWebviewWasReady(t *testing.T) {
	t.Parallel()
	var b app.Backdrop

	b.Set(dark)
	b.Set(light)

	var painted []application.RGBA
	b.Ready(func(c application.RGBA) { painted = append(painted, c) })
	if diff := cmp.Diff([]application.RGBA{light}, painted); diff != "" {
		t.Errorf("painted when the webview became ready (-want +got):\n%s", diff)
	}
}

func TestTheBackdropPaintsNothingWhenTheWebviewBecomesReadyWithNoColourAskedFor(t *testing.T) {
	t.Parallel()
	var b app.Backdrop

	var painted []application.RGBA
	b.Ready(func(c application.RGBA) { painted = append(painted, c) })
	if len(painted) != 0 {
		t.Errorf("painted %v with no colour asked for", painted)
	}
}

func TestTheBackdropPaintsAtOnceOnceTheWebviewIsReady(t *testing.T) {
	t.Parallel()
	var b app.Backdrop
	var painted []application.RGBA
	b.Ready(func(c application.RGBA) { painted = append(painted, c) })

	b.Set(dark)
	b.Set(light)

	if diff := cmp.Diff([]application.RGBA{dark, light}, painted); diff != "" {
		t.Errorf("painted after the webview was ready (-want +got):\n%s", diff)
	}
}
