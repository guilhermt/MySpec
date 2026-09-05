# MySpec

Desktop app that orchestrates a Claude Code development workflow: PRD, tech spec,
step plan, step-by-step implementation, PR and wrap-up.

See [PRODUCT.md](./PRODUCT.md) for what the product does, [WORKFLOW.md](./WORKFLOW.md)
for the workflow it automates and [STACK.md](./STACK.md) for the technical stack.

## Prerequisites

Two things are installed by hand; everything else comes from them.

**1. System packages.** The Wails build dependencies on Linux, plus the C
toolchain cgo needs:

```sh
sudo pacman -S --needed gtk4 webkitgtk-6.0 base-devel pkgconf
```

**2. [mise](https://mise.jdx.dev).** `sudo pacman -S mise` (this machine uses
`mise-bin` from the Omarchy repository), with `mise activate` in your shell so
entering the project directory activates the pinned versions.

Go, Node, pnpm, Task, golangci-lint, gotestsum, lefthook, govulncheck and
go-test-coverage are all pinned in [`mise.toml`](./mise.toml) and installed by
mise. Nothing else is expected on the machine.

## Setup

```sh
mise install   # installs Task and the rest of the pinned toolchain
task setup
```

`mise install` comes first because `task` itself is one of the pinned tools.
Running it twice is harmless: `task setup` starts with `mise install` again, so
one command keeps a clone up to date afterwards.

`task setup` then installs the `wails3` CLI, downloads the Go modules, installs
the frontend dependencies with pnpm and installs the git hooks.

### VS Code

Open the folder normally — no workspace file needed. The Biome extension finds
the binary on the `PATH`, where mise puts it, and reads
[`biome.json`](./biome.json) from the repository root.

`.vscode/settings.json` names Biome the default formatter for the file types it
owns, so it does not compete with a Prettier extension that may be installed for
other projects, and points Go at gopls with the same gofumpt and import grouping
that `task fmt:go` applies. `.vscode/extensions.json` recommends the two
extensions those settings depend on — without them the settings do nothing,
silently — plus the TOML and YAML ones, and marks Prettier and ESLint as
unwanted here.

## Commands

| Command | What it does |
|---|---|
| `task setup` | Prepares a fresh clone: tools, dependencies, git hooks |
| `task dev` | Runs the app in development mode with Vite HMR |
| `task build` | Production build to `bin/myspec` |
| `task run` | Runs `bin/myspec` |
| `task generate` | Regenerates `frontend/bindings` from the Go services |
| `task fmt` | Formats Go and frontend code |
| `task lint` | `lint:go` (golangci-lint) and `lint:web` (Biome) |
| `task typecheck` | `tsc --noEmit` on the frontend |
| `task test` | `test:go` (gotestsum + coverage threshold) and `test:web` (Vitest) |
| `task vuln` | `govulncheck ./...` |
| `task tidy:check` | Fails when `go.mod`/`go.sum` are not tidy |
| `task bindings:check` | Fails when `frontend/bindings` is out of date |
| `task check` | Everything the CI runs, in order |
| `task install` | Installs the app for the current user |
| `task uninstall` | Removes what `install` put in place; never touches app data |

`task install` writes, under `$HOME`:

- `.local/bin/myspec`
- `.local/share/applications/org.wails.myspec.desktop`
- `.local/share/icons/hicolor/scalable/apps/org.wails.myspec.svg`
- `.local/share/icons/hicolor/512x512/apps/org.wails.myspec.png`

`task uninstall` removes exactly those four files. The app data directory is
never touched.

## Target machine notes

Results of the checks in the tech spec, section 24, run on the target machine
(Omarchy / Arch, Hyprland on Wayland, AMD GPU, single 2560x1080 monitor at
`scale = 1`), with Wails `v3.0.0-beta.16`, GTK 4.22.4 and WebKitGTK 2.52.6.

### 1. Rendering (passed, no workaround needed)

Checked with `task dev` and with the production build from `task install`.

- Content renders on first paint. No black screen, no glitches, no missing paint
  after focus changes.
- The window survived being resized several times by the Hyprland tiling layout
  (867 → 469 → 1753 → 872 px wide) with the content still crisp after every
  resize.
- Switching the system colour scheme (`org.gnome.desktop.interface color-scheme`
  between `prefer-light` and `prefer-dark`) while the app is open causes no
  flicker or repaint artefact.
- Text is rendered at the right size on the `scale = 1` monitor. Fractional
  scaling is untested — this machine has a single monitor at scale 1.

No `WEBKIT_*` environment variable was needed, so `applyWebKitEnvironment()`
stays empty when `internal/app/webkit_linux.go` is written.

The only output on stderr is WebKit's `Overriding existing handler for signal 10`
notice, which is harmless.

### 2. `app_id` (as expected)

```
$ hyprctl clients -j | jq -r '.[] | select(.title | endswith("MySpec")) | .class'
org.wails.myspec
```

`class` and `initialClass` are both `org.wails.myspec`, matching the
`StartupWMClass` of the desktop entry, so no rename was needed anywhere.

### 3. Launcher (verified) and bar (not applicable)

After `task install`:

- The entry is in the desktop application database with the name `MySpec`, the
  product description and the icon name `org.wails.myspec`
  (`Gio.AppInfo.get_all()`), and `desktop-file-validate` passes.
- The icon name resolves through the GTK icon theme to
  `~/.local/share/icons/hicolor/512x512/apps/org.wails.myspec.png`.
- Launching the entry (`gtk-launch org.wails.myspec`) starts
  `~/.local/bin/myspec` and the window comes up as `org.wails.myspec` / `MySpec`,
  which is what lets the launcher match the running window to its entry.

The bar on this machine is `omarchy-shell` (quickshell), which shows workspaces
and a clock and has no window-title or app-icon module, so there is nothing
app-specific to check there. The window-identity requirement is covered by the
`app_id` above.

### Other observations

- WebKitGTK creates `~/.local/share/myspec/` (`mediakeys/`, `storage/`) on first
  run, derived from `Linux.ProgramName`. That is the same directory the app's own
  XDG data path will use.
- The window is transparent while `BackgroundColour` is unset. The window options
  in the tech spec, section 12, set it, so this disappears once
  `internal/app` lands.
