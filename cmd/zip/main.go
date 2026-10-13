// Command zip packs files into a zip archive that the same files always turn into the same bytes:
// the entries at the root, in the order given, all with the same date. task package:windows runs
// it:
//
//	go run ./cmd/zip -o <archive> -C <dir> -mtime <unix seconds> <file>...
package main

import (
	"archive/zip"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"
)

const usage = "usage: go run ./cmd/zip -o <archive> -C <dir> -mtime <unix seconds> <file>..."

func main() { os.Exit(run(os.Args[1:], os.Stderr)) }

func run(args []string, stderr io.Writer) int {
	fs := flag.NewFlagSet("zip", flag.ContinueOnError)
	fs.SetOutput(stderr)
	out := fs.String("o", "", "the zip file to create")
	dir := fs.String("C", "", "the directory the files are read from")
	mtime := fs.Int64("mtime", -1, "the date of every entry, in Unix seconds")
	if err := fs.Parse(args); err != nil || *out == "" || *mtime < 0 || fs.NArg() == 0 {
		fmt.Fprintln(stderr, usage)
		return 2
	}

	if err := create(*out, *dir, fs.Args(), time.Unix(*mtime, 0).UTC()); err != nil {
		fmt.Fprintf(stderr, "zip: %v\n", err)
		return 1
	}
	return 0
}

func create(path, dir string, names []string, modified time.Time) (err error) {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer func() { err = errors.Join(err, f.Close()) }()
	return pack(f, dir, names, modified)
}

func pack(w io.Writer, dir string, names []string, modified time.Time) error {
	zw := zip.NewWriter(w)
	for _, name := range names {
		if err := add(zw, filepath.Join(dir, name), name, modified); err != nil {
			return err
		}
	}
	return zw.Close()
}

func add(zw *zip.Writer, path, name string, modified time.Time) (err error) {
	src, err := os.Open(path)
	if err != nil {
		return err
	}
	defer func() { err = errors.Join(err, src.Close()) }()

	dst, err := zw.CreateHeader(&zip.FileHeader{Name: name, Method: zip.Deflate, Modified: modified})
	if err != nil {
		return err
	}
	_, err = io.Copy(dst, src)
	return err
}
