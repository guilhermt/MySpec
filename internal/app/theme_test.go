package app_test

import (
	"math"
	"os"
	"regexp"
	"strconv"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/wailsapp/wails/v3/pkg/application"

	"github.com/guilhermt/myspec/internal/app"
	"github.com/guilhermt/myspec/internal/theme"
)

// tokensPath is the single source of the design tokens, which the frontend imports.
const tokensPath = "../../frontend/src/styles/tokens.css"

// darkBlock opens the block that the fixed dark theme reads its tokens from.
const darkBlock = `[data-theme="dark"] {`

var surface1 = regexp.MustCompile(`--surface-1:\s*oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)`)

func TestTheBackgroundBehindTheWebviewIsTheFirstSurfaceOfEachTheme(t *testing.T) {
	t.Parallel()
	source, err := os.ReadFile(tokensPath)
	if err != nil {
		t.Fatalf("read the tokens: %v", err)
	}
	tokens := string(source)
	dark := strings.Index(tokens, darkBlock)
	if dark < 0 {
		t.Fatalf("tokens.css has no %s block", darkBlock)
	}

	for _, tc := range []struct {
		mode  theme.Mode
		block string
	}{
		{theme.ModeLight, tokens},
		{theme.ModeDark, tokens[dark:]},
	} {
		t.Run(string(tc.mode), func(t *testing.T) {
			t.Parallel()
			want := sRGBOf(t, tc.block)
			if diff := cmp.Diff(want, app.BackgroundFor(tc.mode)); diff != "" {
				t.Errorf("background for %s is not --surface-1 (-want +got):\n%s", tc.mode, diff)
			}
		})
	}
}

// sRGBOf reads the first --surface-1 of a block of tokens.css and converts it from OKLCH to the
// 8-bit sRGB the window paints.
func sRGBOf(t *testing.T, block string) application.RGBA {
	t.Helper()
	match := surface1.FindStringSubmatch(block)
	if match == nil {
		t.Fatal("no --surface-1 in oklch")
	}
	l, c, h := number(t, match[1]), number(t, match[2]), number(t, match[3])

	// OKLCH to OKLab, then to linear sRGB (Björn Ottosson's matrices).
	a, b := c*math.Cos(h*math.Pi/180), c*math.Sin(h*math.Pi/180)
	lp := cube(l + 0.3963377774*a + 0.2158037573*b)
	mp := cube(l - 0.1055613458*a - 0.0638541728*b)
	sp := cube(l - 0.0894841775*a - 1.2914855480*b)
	red := 4.0767416621*lp - 3.3077115913*mp + 0.2309699292*sp
	green := -1.2684380046*lp + 2.6097574011*mp - 0.3413193965*sp
	blue := -0.0041960863*lp - 0.7034186147*mp + 1.7076147010*sp
	return application.NewRGB(channel(red), channel(green), channel(blue))
}

func cube(x float64) float64 {
	return x * x * x
}

// channel encodes a linear sRGB channel with the sRGB transfer function, in 8 bits.
func channel(linear float64) uint8 {
	linear = math.Min(1, math.Max(0, linear))
	encoded := 12.92 * linear
	if linear > 0.0031308 {
		encoded = 1.055*math.Pow(linear, 1/2.4) - 0.055
	}
	return uint8(math.Round(encoded * 255))
}

func number(t *testing.T, text string) float64 {
	t.Helper()
	value, err := strconv.ParseFloat(text, 64)
	if err != nil {
		t.Fatalf("parse %q: %v", text, err)
	}
	return value
}

func TestTheWindowOpensInTheThemeTheDesktopAskedFor(t *testing.T) {
	t.Parallel()

	if got := app.ModeFor(true); got != theme.ModeDark {
		t.Errorf("ModeFor(dark) = %q, want %q", got, theme.ModeDark)
	}
	if got := app.ModeFor(false); got != theme.ModeLight {
		t.Errorf("ModeFor(light) = %q, want %q", got, theme.ModeLight)
	}
}
