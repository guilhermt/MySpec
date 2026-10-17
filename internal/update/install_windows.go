package update

// InstallCommand is the command that installs or updates MySpec on this
// system, the one of the README. When it changes, the one of install_linux.go
// changes too.
const InstallCommand = "irm https://raw.githubusercontent.com/guilhermt/MySpec/main/install.ps1 | iex"
