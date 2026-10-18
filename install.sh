#!/bin/sh
# Installs or updates MySpec for the current user, from the latest GitHub release.
# Usage: curl -fsSL https://raw.githubusercontent.com/guilhermt/MySpec/main/install.sh | sh
#
# The MySpec app runs this same script to update itself, and reads how it ended
# from the file in MYSPEC_INSTALL_RESULT (the contract is in docs/development/release.md).
set -eu

REPO=guilhermt/MySpec
APP=myspec
APP_ID=org.wails.myspec
PACKAGE=myspec-linux-amd64.tar.gz
PACKAGE_URL="https://github.com/$REPO/releases/latest/download/$PACKAGE"

# Writes the result the app reads, one line per argument, when it asked for one
# by MYSPEC_INSTALL_RESULT. The terminal never sets it.
report() {
  [ -n "${MYSPEC_INSTALL_RESULT:-}" ] || return 0
  printf '%s\n' "$@" >"$MYSPEC_INSTALL_RESULT" 2>/dev/null || true
}

# Usage: die <kind> <message...>. The kind is one the app understands: offline,
# timeout, libraries, system, replace or failed.
die() {
  kind=$1
  shift
  printf 'error: %s\n' "$*" >&2
  report "result: failed" "kind: $kind" "reason: $*"
  exit 1
}

has() {
  command -v "$1" >/dev/null 2>&1
}

fetch() {
  curl --proto '=https' --proto-redir '=https' --tlsv1.2 --connect-timeout 30 "$@"
}

# Prints arch, apt or unknown. The distro only changes the suggested command.
distro_family() {
  if [ ! -r /etc/os-release ]; then
    printf 'unknown\n'
    return
  fi
  ids="$(sed -n 's/^ID=//p' /etc/os-release | tr -d "\"'") $(sed -n 's/^ID_LIKE=//p' /etc/os-release | tr -d "\"'")"
  # Splitting on spaces is intended: ids is a list of words.
  for word in $ids; do
    case "$word" in
      arch)
        printf 'arch\n'
        return
        ;;
      ubuntu | debian | pop)
        printf 'apt\n'
        return
        ;;
    esac
  done
  printf 'unknown\n'
}

check_libraries() {
  ldconfig=
  if has ldconfig; then
    ldconfig=ldconfig
  elif [ -x /sbin/ldconfig ]; then
    ldconfig=/sbin/ldconfig
  elif [ -x /usr/sbin/ldconfig ]; then
    ldconfig=/usr/sbin/ldconfig
  else
    die system "cannot check the system libraries: ldconfig was not found"
  fi
  libs=$("$ldconfig" -p) || die system "cannot check the system libraries: ldconfig -p failed"

  missing=
  arch_pkgs=
  apt_pkgs=
  if ! printf '%s\n' "$libs" | grep -qF 'libgtk-4.so.1 (libc6,x86-64)'; then
    missing="GTK 4"
    arch_pkgs="gtk4"
    apt_pkgs="libgtk-4-1"
  fi
  if ! printf '%s\n' "$libs" | grep -qF 'libwebkitgtk-6.0.so.4 (libc6,x86-64)'; then
    missing="${missing:+$missing, }WebKitGTK 6.0"
    arch_pkgs="${arch_pkgs:+$arch_pkgs }webkitgtk-6.0"
    apt_pkgs="${apt_pkgs:+$apt_pkgs }libwebkitgtk-6.0-4"
  fi
  if [ -z "$missing" ]; then
    return
  fi

  printf 'error: MySpec needs system libraries that are missing: %s\n' "$missing" >&2
  reason="MySpec needs system libraries that are missing: $missing"
  case "$(distro_family)" in
    arch)
      printf 'Install them with:\n  sudo pacman -S %s\n' "$arch_pkgs" >&2
      report "result: failed" "kind: libraries" "reason: $reason" "command: sudo pacman -S $arch_pkgs"
      ;;
    apt)
      printf 'Install them with:\n  sudo apt install %s\n' "$apt_pkgs" >&2
      report "result: failed" "kind: libraries" "reason: $reason" "command: sudo apt install $apt_pkgs"
      ;;
    *)
      printf 'Install them with the command for your distribution:\n' >&2
      printf '  Arch:            sudo pacman -S %s\n' "$arch_pkgs" >&2
      printf '  Ubuntu/Pop!_OS:  sudo apt install %s\n' "$apt_pkgs" >&2
      report "result: failed" "kind: libraries" "reason: $reason" "command: sudo pacman -S $arch_pkgs" "command: sudo apt install $apt_pkgs"
      ;;
  esac
  printf 'Then run this command again.\n' >&2
  exit 1
}

# Sets VERSION and DOWNLOAD_URL from the redirect of the stable URL, which is
# not followed: its Location is the exact package URL of the latest release.
resolve_release() {
  status=0
  location=$(fetch --max-time 30 -fsS -o /dev/null -w '%{redirect_url}' "$PACKAGE_URL") || status=$?
  if [ "$status" -eq 22 ]; then
    die failed "no MySpec release is published yet"
  elif [ "$status" -eq 28 ]; then
    die timeout "GitHub didn't answer in time to find the latest release; run this command again"
  elif [ "$status" -ne 0 ]; then
    die offline "could not reach GitHub to find the latest release; check the connection and run this command again"
  fi
  case "$location" in
    https://github.com/*/releases/download/v*/"$PACKAGE") ;;
    *) die failed "unexpected answer from GitHub for the latest release: $location" ;;
  esac
  tag=${location%/"$PACKAGE"}
  VERSION=${tag##*/}
  case "$VERSION" in
    v[0-9]*.[0-9]*.[0-9]*) ;;
    *) die failed "unexpected answer from GitHub for the latest release: $location" ;;
  esac
  DOWNLOAD_URL=$location
}

# The copy goes next to the destination, on the same filesystem, so mv is an
# atomic rename: a running MySpec keeps the old file's inode until it closes.
place() {
  if ! { cp "$1" "$2.new" && chmod "$3" "$2.new" && mv -f "$2.new" "$2"; }; then
    rm -f "$2.new"
    die replace "could not write $2; close MySpec and run this command again"
  fi
}

# Prints one line of the external requirements. The optional third argument is
# another path where the command also counts as found.
report_requirement() {
  if has "$1" || { [ -n "${3:-}" ] && [ -x "$3" ]; }; then
    state=found
  else
    state="not found"
  fi
  printf '  %-7s %-10s %s\n' "$1" "$state" "$2"
}

print_summary() {
  printf 'MySpec %s %s\n' "$VERSION" "$action"
  if [ "$action" = updated ]; then
    printf '\nA MySpec window that is open keeps the previous version until you close it and open it again.\n'
  fi
  case ":$PATH:" in
    *":$BIN_DIR:"*) ;;
    *)
      printf '\n~/.local/bin is not on your PATH, so the myspec command is not found in a terminal.\n'
      printf 'Add this line to your shell profile (~/.bashrc, ~/.zshrc or the one of your shell):\n'
      # shellcheck disable=SC2016 # the line is printed for the user to copy, unexpanded
      printf '  export PATH="$HOME/.local/bin:$PATH"\n'
      printf 'The launcher entry works without it.\n'
      ;;
  esac
  printf '\nMySpec also needs:\n'
  # claude is also looked up in ~/.local/bin, where the app finds it.
  report_requirement claude "Claude Code, installed and logged in" "$HOME/.local/bin/claude"
  report_requirement gh "GitHub CLI, installed and logged in"
  report_requirement git "git with access to your repositories"
}

main() {
  if [ "$(id -u)" -eq 0 ]; then
    die system "run this command as your own user, without sudo"
  fi
  [ -n "${HOME:-}" ] || die system "HOME is not set"
  BIN_DIR="$HOME/.local/bin"
  APPS_DIR="$HOME/.local/share/applications"
  ICONS_DIR="$HOME/.local/share/icons/hicolor"

  for tool in curl tar; do
    has "$tool" || die system "$tool is required but was not found; install it and run this command again"
  done

  os=$(uname -s)
  arch=$(uname -m)
  if [ "$os" != Linux ] || [ "$arch" != x86_64 ]; then
    die system "MySpec is only published for Linux amd64; this system is $os $arch"
  fi

  check_libraries

  TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/myspec-install.XXXXXX") || die failed "cannot create a temporary directory"
  trap 'rm -rf "$TMP_DIR"' EXIT
  trap 'exit 1' HUP INT TERM

  resolve_release

  printf 'Downloading MySpec %s...\n' "$VERSION"
  status=0
  fetch --max-time 600 -fsSL -o "$TMP_DIR/$PACKAGE" "$DOWNLOAD_URL" || status=$?
  if [ "$status" -eq 28 ]; then
    die timeout "GitHub didn't answer in time to download MySpec $VERSION; run this command again"
  elif [ "$status" -ne 0 ]; then
    die offline "could not download MySpec $VERSION; check the connection and run this command again"
  fi

  mkdir "$TMP_DIR/package"
  tar -xzf "$TMP_DIR/$PACKAGE" -C "$TMP_DIR/package" || die failed "the downloaded package could not be extracted"
  for file in "$APP" "$APP_ID.desktop" "$APP_ID.svg" "$APP_ID.png"; do
    [ -f "$TMP_DIR/package/$file" ] || die failed "the package of MySpec $VERSION is missing $file"
  done

  sed "s|@EXEC@|$BIN_DIR/$APP|" "$TMP_DIR/package/$APP_ID.desktop" >"$TMP_DIR/$APP_ID.desktop"

  if [ -e "$BIN_DIR/$APP" ]; then
    action=updated
  else
    action=installed
  fi

  mkdir -p "$BIN_DIR" "$APPS_DIR" "$ICONS_DIR/scalable/apps" "$ICONS_DIR/512x512/apps" ||
    die replace "could not create the folders of MySpec in $HOME/.local; run this command again"
  # The executable goes last: a failure on a supporting file leaves the old one intact.
  place "$TMP_DIR/$APP_ID.desktop" "$APPS_DIR/$APP_ID.desktop" 644
  place "$TMP_DIR/package/$APP_ID.svg" "$ICONS_DIR/scalable/apps/$APP_ID.svg" 644
  place "$TMP_DIR/package/$APP_ID.png" "$ICONS_DIR/512x512/apps/$APP_ID.png" 644
  place "$TMP_DIR/package/$APP" "$BIN_DIR/$APP" 755
  report "result: installed" "version: ${VERSION#v}" "path: $BIN_DIR/$APP"

  if has update-desktop-database; then
    update-desktop-database "$APPS_DIR" >/dev/null 2>&1 || true
  fi
  if has gtk-update-icon-cache; then
    gtk-update-icon-cache -f -t "$ICONS_DIR" >/dev/null 2>&1 || true
  fi

  print_summary
}

# Everything runs from main, called last, so a download cut short by curl | sh
# never runs half a script.
main "$@"
