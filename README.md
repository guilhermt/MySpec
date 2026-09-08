# MySpec

Desktop app that orchestrates a Claude Code development workflow: PRD, tech spec,
step plan, step-by-step implementation, PR and wrap-up.

See [PRODUCT.md](./PRODUCT.md) for what the product does, [WORKFLOW.md](./WORKFLOW.md)
for the workflow it automates and [STACK.md](./STACK.md) for the technical stack.

## Prerequisites

Three things are installed by hand; everything else comes from them.

**1. System packages.** The Wails build dependencies on Linux, plus the C
toolchain cgo needs:

```sh
sudo pacman -S --needed gtk4 webkitgtk-6.0 base-devel pkgconf
```

**2. [mise](https://mise.jdx.dev).** `sudo pacman -S mise` (this machine uses
`mise-bin` from the Omarchy repository), with `mise activate` in your shell so
entering the project directory activates the pinned versions.

**3. Claude Code.** The `claude` CLI on the PATH (or in `~/.local/bin`), logged
in once with `claude` in a terminal. `MYSPEC_CLAUDE_PATH` overrides where the app
looks for it.

**4. git and VS Code.** `git` on the PATH, able to reach the `origin` of the
repositories of the workspace without a prompt — the app runs it with
`GIT_TERMINAL_PROMPT=0`, so a fetch that asks for a password fails instead of
hanging. `code` on the PATH is what **Open in VS Code** runs; without it the app
says so and everything else keeps working.

Go, Node, pnpm, Task, Biome, golangci-lint, gotestsum, lefthook, govulncheck and
go-test-coverage are all pinned in [`mise.toml`](./mise.toml) and installed by
mise. The CI installs the same file with `jdx/mise-action`, so both run the same
versions. Nothing else is expected on the machine.

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

The hook is a pre-commit one, defined in [`lefthook.yml`](./lefthook.yml): it
runs Biome over the staged frontend files and `golangci-lint fmt` over the staged
Go files, restaging what they fix. It formats only — linting, typechecking and
tests are left to `task check` and to the CI, so a commit is never blocked by a
slow check.

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

`main.go` embeds `frontend/dist`, which is build output and so is missing from a
fresh clone — and `//go:embed` refuses to typecheck against a directory with no
files in it. The Go tasks put an empty placeholder there when they find none, so
`task check` works before the first `task build` and a real build replaces it.

`task install` writes, under `$HOME`:

- `.local/bin/myspec`
- `.local/share/applications/org.wails.myspec.desktop`
- `.local/share/icons/hicolor/scalable/apps/org.wails.myspec.svg`
- `.local/share/icons/hicolor/512x512/apps/org.wails.myspec.png`

`task uninstall` removes exactly those four files. The app data directory is
never touched.

## Data directory

Everything the app keeps lives under `~/.local/share/myspec/`:

- `myspec.db`, the SQLite database with the settings, the workspaces, the tasks
  and every conversation.
- `prompts/prd.md`, `prompts/tech_spec.md`, `prompts/plan.md` and
  `prompts/commit.md`, the prompts the app sends: the first three start the
  session of each planning stage, and the last one is what an approved step is
  committed with. They are written on first run, meant to be edited, and
  recreated the next time the app starts if they are deleted. A session already
  running keeps the prompt it started with.
- `workspaces/<name>-<hash>/tasks/<task>/`, the artifacts of each task, in a
  folder per workspace and per task: `PRD.md`, `tech-spec.md` and
  `steps/<number>-<short-description>.md`, one file per step. The hash keeps two
  workspaces with the same folder name apart.

The worktrees are the exception: they live in the workspace itself, under
`.myspec/worktrees/`, so the code the agent writes sits next to the repository it
belongs to. See [Steps and worktrees](#steps-and-worktrees).

## Sessions

A task runs one `claude` process at a time: the one of the stage it is in. Each
stage keeps its own conversation, so going back to a stage picks its session up
where it was left and moving on opens a fresh one. In the implementation stage
each step has a session of its own, opened inside the worktree of its repository
with the step file as the first message.

Each session is started with the fixed flags of `claude.Args`: `-p` with
`--output-format stream-json`, `--input-format stream-json`, `--verbose`,
`--include-partial-messages`, `--permission-mode auto` and
`--permission-prompt-tool stdio`, plus `--session-id` on the first run and
`--resume` on the following ones. The app writes the user's messages into stdin
and reads the event stream back. A process with nothing to do for ten minutes is
stopped; the next message brings it back with `--resume`, and the agent still
remembers the conversation.

When something looks wrong, the log is at `~/.local/state/myspec/myspec.log`.
`claude session ready` marks a process that started and answered, with the task
it belongs to, and `binding failed` marks a call from the interface the Go side
rejected, with the method that refused it. `stage advanced`, `stage revisited`
and `stage discarded` mark every move between stages, with the task and the
stages involved.

Steps and worktrees have their own lines: `worktree created`, `worktree cleaned`,
`worktree removed` and `worktree recreated`, with the task and the path;
`step started`, `step retried`, `step cleaned and started`, `step discarded` and
`steps torn down`, with the task and the step number; and `step blocked`, with
the reason the step could not start.

The review and the commit add `step approved`, when the user approves a step and
the commit prompt is sent; `step committed`, with the short sha and the subject
of the commit; `commit did not happen`, when the commit turn ended without one;
`implementation complete`, when the last step is committed; and
`review read failed`, with the path of the worktree and what git said.

## Stages

A task goes through PRD, tech spec, plan and implementation. It moves on by
itself as soon as the document of the stage exists on disk and the conversation
is idle — the agent is waiting and nothing is queued. The stage track at the top
of a task shows where it is and what it can do:

- **Back to a stage** reopens an earlier stage and throws away everything after
  it. The task stays there, revisiting, until **Continue** is pressed, so the
  document can be reworked without the app moving on mid-sentence.
- **Discard and restart** throws the stage away too and starts a new session for
  it right away.

The plan stage has one more rule: the step files have to be a valid plan before
the task moves on. Each file is named `<number>-<short-description>.md`, starts
with a `---` header carrying `repository: <value>` that names a repository of the
workspace, and carries a `# Step N: Title` heading; the numbers run from 1 with
no gaps and no repeats. When they do not, the app tells the agent what is wrong
and asks it to fix it, up to three times. After that it stops correcting and
shows the problems above the composer, for the user to sort out with the agent
or to discard the plan and start over.

## Steps and worktrees

Once the plan is valid the task enters the implementation stage and the app
starts the first step by itself. Each step belongs to one repository and runs in
a worktree of it, created at
`<workspace>/.myspec/worktrees/<repository>/<task>/`, on a branch named after the
task. The base of the branch is resolved when the worktree is created: the app
runs `git fetch origin` and branches from `origin/dev`, or from `origin/main`
when there is no `dev`. The fetch happens only then; starting a step in a
worktree that already exists does not fetch again. `.myspec` is hidden, so the
workspace scan never takes a worktree for a repository.

The app owns the worktrees it created, and only those: it never reuses or
deletes a path or a branch it did not create. A worktree and its branch are
removed when the task is deleted, when the plan is discarded and when the task
goes back to the tech spec, with whatever was left uncommitted in them.

Before starting a step the app checks that the worktree is clean — nothing
modified, staged, deleted or untracked, ignored files aside. A dirty worktree
blocks the step, with what was found and two ways out: clean it yourself and
**Try again**, or let the app throw every change away with **Clean and start**.
A step is blocked the same way when the fetch fails, when neither base branch
exists, when the path or the branch is already there, or when the step file
names no repository of the task. The message from git is shown as git wrote it.

The step bar above the conversation carries the state — preparing, implementing,
awaiting review, in review, ready to approve, committing, done or blocked — and
the controls: **Open in VS Code**, which runs `code` on the worktree,
**Approve**, and **Discard step**, which ends the session, deletes the
conversation of the step and starts it over, cleaning the worktree unless the
user says otherwise.
The step waits for review as soon as the agent finishes a turn with nothing
pending; asking for a change in the conversation puts it back to implementing.

While a step waits for review the app watches its worktree — the tracked
directories and the git directory, so staging in the editor is seen as it
happens — and reads `git status` once per burst of events. Every changed file
git reports counts, new files one by one, ignored files never; a file counts as
reviewed when nothing of it is left outside the index, so a partly staged file is
still pending. The review strip under the step bar shows the bar, the count and
the list of changed files, each one opening in the editor of the worktree when
clicked. The same progress reads as a percentage in the task list and in the
tree, so a review can be followed without opening the task. The app never stages
anything itself: staging is the review, and the review is the gate.

**Approve** is enabled only at 100%; below that it says what is missing. It also
needs the session to be idle — no turn running, nothing queued, no permission or
question waiting — and it resumes a paused task by itself, so a review can be
approved without thinking about the process. Approving sends the commit prompt as
a message of the app in the conversation of the step, so the agent that wrote the
code is the one that commits it: exactly what is staged, in one commit, with a
subject in the imperative and the convention of the repository. A step is done
when a commit appears on the branch beyond the one it started from, whether it
came from the commit turn or from the user's own hand; if the turn ends with no
commit, the step goes back to ready to approve and says so. The app then ends
the process of the step and starts the next one by itself, creating the worktree
when the step changes repository, and blocking the usual way when it cannot
start. After the
last step is committed the task stays in the implementation stage, with every
step committed and no session running: the PR stage does not exist in this
version.

## Continuous integration

[`.github/workflows/ci.yml`](./.github/workflows/ci.yml) runs on every push to
`main` and on every pull request to `main`. The repository only uses `main`;
there is no `dev` branch. Three jobs:

| Job | What it runs |
|---|---|
| `Frontend` | `task lint:web`, `pnpm typecheck`, `pnpm test:coverage` |
| `Go` | `task tidy:check`, `task lint:go`, `task vuln`, `task test:go` |
| `Build` | `task bindings:check` and `task build`, after the other two pass |

Together they cover the same ground as `task check`, so a green `task check`
locally is the best predictor of a green pipeline.

The toolchain comes from [`mise.toml`](./mise.toml) through `jdx/mise-action`,
which is what keeps the CI and this machine on the same versions. The Go and
Build jobs additionally install `libgtk-4-dev` and `libwebkitgtk-6.0-dev`, which
cgo needs and the runner image does not carry. The pnpm store, the Go module
cache and the Go build cache are all cached between runs.

Both test jobs comment coverage on pull requests: `vitest-coverage-report-action`
posts the frontend summary, and `go-coverage-report` compares the run's
`coverage/go.out` against the artifact from the last successful `main` run and
posts the delta. That artifact is uploaded on every run, `main` included, which
is what gives later pull requests a baseline to compare against. The `Build` job
uploads the binary as `myspec-linux-amd64`, kept for seven days.

Three departures from the tech spec, section 23:

- The actions are pinned to their current major versions (`checkout@v7`,
  `mise-action@v4`, `cache@v6`, `upload-artifact@v7`) rather than the older ones
  the spec names. Dependabot would raise all four in its first week anyway.
- `go-coverage-report` is pinned to `v1.3.1`, not `v1`. That repository publishes
  no moving major tag, so `@v1` does not resolve and the step would fail.
- `go-coverage-report` gets an explicit `root-package`. Its default is
  `github.com/<owner>/<repo>`, which here would be `github.com/guilhermt/MySpec`,
  and the module is `github.com/guilhermt/myspec`. Without the override no
  changed file would match its coverage profile.

[`.github/dependabot.yml`](./.github/dependabot.yml) watches Go modules, the
frontend npm packages and the actions themselves, weekly, with minor and patch
updates grouped into one pull request per ecosystem.

## Target machine notes

Results of the checks in the tech spec, section 24. They were first run on the
scaffold and re-run in full on the finished feature, against the production
build installed with `task install`.

Machine: Omarchy 4.0.2 / Arch, Hyprland 0.56.2 on Wayland, AMD GPU, single
2560x1080 monitor at `scale = 1`. Wails `v3.0.0-beta.16`, GTK 4.22.4,
WebKitGTK 2.52.6.

### 1. Rendering (passed, no workaround needed)

Checked with `task dev` and with the production build from `task install`.

- Content renders on first paint. No black screen, no glitches, no missing paint
  after focus changes.
- The window stayed crisp through repeated resizes, both the ones the Hyprland
  tiling layout imposes and deliberate ones from 820x520 up to 2200x1000.
- Switching the system colour scheme (`org.gnome.desktop.interface color-scheme`
  between `prefer-light` and `prefer-dark`) while the app is open repaints the
  whole interface with no flicker or artefact, and so does picking Light, Dark or
  System in the app.
- Text is rendered at the right size on the `scale = 1` monitor. Fractional
  scaling is untested — this machine has a single monitor at scale 1.

No `WEBKIT_*` environment variable was needed, so `applyWebKitEnvironment()` in
`internal/app/webkit_linux.go` is empty.

The only output on stderr is WebKit's `Overriding existing handler for signal 10`
notice, which is harmless.

### 2. `app_id` (as expected)

```
$ hyprctl clients -j | jq -r '.[] | select(.title | endswith("MySpec")) | .class'
org.wails.myspec
```

`class` and `initialClass` are both `org.wails.myspec`, matching the
`StartupWMClass` of the desktop entry, so no rename was needed anywhere.

### 3. Launcher (verified); bar and window switcher (not applicable)

After `task install`:

- The entry is in the desktop application database with the name `MySpec`, the
  product description and the icon name `org.wails.myspec`
  (`Gio.AppInfo.get_all()`), and `desktop-file-validate` passes.
- The icon name resolves through the GTK icon theme, to the SVG at small sizes
  and to `~/.local/share/icons/hicolor/512x512/apps/org.wails.myspec.png` at 512.
- Searching `myspec` in the Omarchy menu's Apps section lists **MySpec** with the
  right icon. The app is not in `/usr/share/omarchy/default/omarchy/launcher.hides`,
  so nothing hides it.
- Launching the entry (`gtk-launch org.wails.myspec`) starts
  `~/.local/bin/myspec` and the window comes up as `org.wails.myspec` / `MySpec`,
  which is what lets the launcher match the running window to its entry.

The PRD also asks for the right name and icon "in the bar and in the window
switcher". Neither exists on this machine to check against:

- The bar is `omarchy-shell` (quickshell) with the `omarchy.active-window`
  widget disabled, so it shows workspaces and a clock and no window title or app
  icon.
- Alt+Tab is bound to Hyprland's `window.cycle_next`, which moves focus with no
  overlay — nothing renders a name or an icon.

Both would read the window's `app_id` if they existed, and that is verified
above, so the requirement is met as far as this desktop can show it.

### 4. Single instance (verified)

With the app open on one folder and the desktop on a different Hyprland
workspace, running `myspec <other folder>` from a terminal in a third directory
switches the desktop to the app's workspace, gives the window focus, replaces
the tree and updates the title. Relative arguments, `.` included, resolve
against the second invocation's working directory. `myspec /does/not/exist`
keeps the open workspace and renders the notice over it.

The second process runs its whole startup — log, database, `Bootstrap` — before
`application.New` finds the lock and hands the arguments over, so the log carries
a second `app starting` for a process that then exits. Nothing is corrupted (the
writes are idempotent and SQLite serialises them), but the work is wasted.

The focus handover is `gtk_window_present`, which Hyprland honours because
`misc:focus_on_activate` is on. A compositor that refuses activation requests
would leave the window where it is; the workspace would still change.

### 5. Native dialog (verified)

Ctrl+O opens the `xdg-desktop-portal-gtk` chooser in folder mode, following the
system colour scheme, from the welcome screen and from an open workspace alike.
Picking a folder opens it as the workspace. Cancelling with Escape closes the
chooser and changes nothing: no state change, no log line.

The welcome screen's **Open folder** button and the switcher's **Open folder…**
item were not clicked during the check — the session drove the app by keyboard —
but all three paths call the same `openFolderDialog` action.

### System theme: read from the portal, not from Wails

The tech spec, section 12, has `internal/app` ask Wails for the desktop colour
scheme. Neither half of that works in `v3.0.0-beta.16` on the GTK4 backend:

- `Env.IsDarkMode()` returns false whenever `App.impl` is nil, and `impl` is only
  built inside `Run()` — after the options, the services and the window are
  created. Every reading before the main loop starts reports a light desktop.
- `events.Common.ThemeChanged` never fires. The portal watcher that would raise
  it, `listenForSystemThemeChanges`, is started from `(*linuxApp).init`, which is
  not part of the `platformApp` interface and is never called on this backend.
  Verified with `dbus-monitor`: the portal does emit `SettingChanged` for
  `org.freedesktop.appearance` / `color-scheme`, and Wails ignores it.

The PRD requires the interface to follow a system theme change immediately, so
`internal/app/theme.go` reads `org.freedesktop.portal.Settings` over D-Bus itself
and subscribes to `SettingChanged`. That also puts the right colour behind the
webview from the first frame, since the reading now happens before the window is
created. `github.com/godbus/dbus/v5` was already in the module graph through
Wails and is now a direct dependency.

### Window state

`StartState: WindowStateMaximised` reaches a tiling compositor as "fill the tile
you are given", which is what happens here: the window opens filling its slot on
the current Hyprland workspace, whatever that slot is. Nothing about the window
geometry is persisted, so a reopen lands wherever the layout puts it. On a
stacking desktop the same option produces a genuinely maximised window.

### Other observations

- WebKitGTK creates `~/.local/share/myspec/` (`mediakeys/`, `storage/`) on first
  run, derived from `Linux.ProgramName`. That is the same directory the app's own
  XDG data path uses.
- The database file lands with mode 0644 rather than 0600: WebKitGTK creates
  `~/.local/share/myspec/` before the app does, so the `0o700` in `store.Open`
  and `xdg.Ensure` finds the directory already there and changes nothing.
- Screenshots of the window look semi-transparent. That is Omarchy, not the app:
  `/usr/share/omarchy/default/hypr/windows.lua` tags every window with
  `opacity = "0.985 0.96"`. The window's own background is opaque.
