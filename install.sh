#!/bin/sh
# Installs or updates MySpec for the current user, from the latest GitHub release.
# Usage: curl -fsSL https://raw.githubusercontent.com/guilhermt/MySpec/main/install.sh | sh
set -eu

REPO=guilhermt/MySpec
APP=myspec
APP_ID=org.wails.myspec
PACKAGE=myspec-linux-amd64.tar.gz
PACKAGE_URL="https://github.com/$REPO/releases/latest/download/$PACKAGE"

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

has() {
  command -v "$1" >/dev/null 2>&1
}

fetch() {
  curl --proto '=https' --proto-redir '=https' --tlsv1.2 "$@"
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
    die "cannot check the system libraries: ldconfig was not found"
  fi
  libs=$("$ldconfig" -p) || die "cannot check the system libraries: ldconfig -p failed"

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
  case "$(distro_family)" in
    arch)
      printf 'Install them with:\n  sudo pacman -S %s\n' "$arch_pkgs" >&2
      ;;
    apt)
      printf 'Install them with:\n  sudo apt install %s\n' "$apt_pkgs" >&2
      ;;
    *)
      printf 'Install them with the command for your distribution:\n' >&2
      printf '  Arch:            sudo pacman -S %s\n' "$arch_pkgs" >&2
      printf '  Ubuntu/Pop!_OS:  sudo apt install %s\n' "$apt_pkgs" >&2
      ;;
  esac
  printf 'Then run this command again.\n' >&2
  exit 1
}

# Sets VERSION and DOWNLOAD_URL from the redirect of the stable URL, which is
# not followed: its Location is the exact package URL of the latest release.
resolve_release() {
  status=0
  location=$(fetch -fsS -o /dev/null -w '%{redirect_url}' "$PACKAGE_URL") || status=$?
  if [ "$status" -eq 22 ]; then
    die "no MySpec release is published yet"
  elif [ "$status" -ne 0 ]; then
    die "could not reach GitHub to find the latest release; check the connection and run this command again"
  fi
  case "$location" in
    https://github.com/*/releases/download/v*/"$PACKAGE") ;;
    *) die "unexpected answer from GitHub for the latest release: $location" ;;
  esac
  tag=${location%/"$PACKAGE"}
  VERSION=${tag##*/}
  case "$VERSION" in
    v[0-9]*.[0-9]*.[0-9]*) ;;
    *) die "unexpected answer from GitHub for the latest release: $location" ;;
  esac
  DOWNLOAD_URL=$location
}

# The copy goes next to the destination, on the same filesystem, so mv is an
# atomic rename: a running MySpec keeps the old file's inode until it closes.
place() {
  cp "$1" "$2.new"
  chmod "$3" "$2.new"
  mv -f "$2.new" "$2"
}

report_requirement() {
  if has "$1"; then
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
  if has claude || [ -x "$HOME/.local/bin/claude" ]; then
    printf '  %-7s %-10s %s\n' claude found "Claude Code, installed and logged in"
  else
    printf '  %-7s %-10s %s\n' claude "not found" "Claude Code, installed and logged in"
  fi
  report_requirement gh "GitHub CLI, installed and logged in"
  report_requirement git "git with access to your repositories"
}

main() {
  if [ "$(id -u)" -eq 0 ]; then
    die "run this command as your own user, without sudo"
  fi
  [ -n "${HOME:-}" ] || die "HOME is not set"
  BIN_DIR="$HOME/.local/bin"
  APPS_DIR="$HOME/.local/share/applications"
  ICONS_DIR="$HOME/.local/share/icons/hicolor"

  for tool in curl tar; do
    has "$tool" || die "$tool is required but was not found; install it and run this command again"
  done

  os=$(uname -s)
  arch=$(uname -m)
  if [ "$os" != Linux ] || [ "$arch" != x86_64 ]; then
    die "MySpec is only published for Linux amd64; this system is $os $arch"
  fi

  check_libraries

  TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/myspec-install.XXXXXX") || die "cannot create a temporary directory"
  trap 'rm -rf "$TMP_DIR"' EXIT
  trap 'exit 1' HUP INT TERM

  resolve_release

  printf 'Downloading MySpec %s...\n' "$VERSION"
  fetch -fsSL -o "$TMP_DIR/$PACKAGE" "$DOWNLOAD_URL" ||
    die "could not download MySpec $VERSION; check the connection and run this command again"

  mkdir "$TMP_DIR/package"
  tar -xzf "$TMP_DIR/$PACKAGE" -C "$TMP_DIR/package" || die "the downloaded package could not be extracted"
  for file in "$APP" "$APP_ID.desktop" "$APP_ID.svg" "$APP_ID.png"; do
    [ -f "$TMP_DIR/package/$file" ] || die "the package of MySpec $VERSION is missing $file"
  done

  sed "s|@EXEC@|$BIN_DIR/$APP|" "$TMP_DIR/package/$APP_ID.desktop" >"$TMP_DIR/$APP_ID.desktop"

  if [ -e "$BIN_DIR/$APP" ]; then
    action=updated
  else
    action=installed
  fi

  mkdir -p "$BIN_DIR" "$APPS_DIR" "$ICONS_DIR/scalable/apps" "$ICONS_DIR/512x512/apps"
  place "$TMP_DIR/package/$APP" "$BIN_DIR/$APP" 755
  place "$TMP_DIR/$APP_ID.desktop" "$APPS_DIR/$APP_ID.desktop" 644
  place "$TMP_DIR/package/$APP_ID.svg" "$ICONS_DIR/scalable/apps/$APP_ID.svg" 644
  place "$TMP_DIR/package/$APP_ID.png" "$ICONS_DIR/512x512/apps/$APP_ID.png" 644

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
