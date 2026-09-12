package chime_test

import (
	"bytes"
	"encoding/binary"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/platform/chime"
)

// wavHeader is the canonical 44-byte header of a PCM WAV file, field by field
// at its offset.
type wavHeader struct {
	RIFF          [4]byte
	RIFFSize      uint32
	WAVE          [4]byte
	Fmt           [4]byte
	FmtSize       uint32
	Format        uint16
	Channels      uint16
	SampleRate    uint32
	ByteRate      uint32
	BlockAlign    uint16
	BitsPerSample uint16
	Data          [4]byte
	DataSize      uint32
}

// headerLen is the size of wavHeader on disk.
const headerLen = 44

func TestInstallCopiesTheChimeAndRepairsIt(t *testing.T) {
	t.Parallel()

	want, err := os.ReadFile("chime.wav")
	if err != nil {
		t.Fatalf("ReadFile(chime.wav) = %v, want nil", err)
	}
	dataDir := t.TempDir()
	wantPath := filepath.Join(dataDir, "sounds", "chime.wav")
	if got := chime.Path(dataDir); got != wantPath {
		t.Errorf("Path() = %q, want %q", got, wantPath)
	}

	path := install(t, dataDir)
	if path != wantPath {
		t.Errorf("Install() = %q, want %q", path, wantPath)
	}
	wantContent(t, path, want)
	wantPerm(t, path, 0o600)
	wantPerm(t, filepath.Dir(path), 0o700)

	if err = os.WriteFile(path, []byte("broken"), 0o600); err != nil {
		t.Fatalf("WriteFile() = %v, want nil", err)
	}
	install(t, dataDir)
	wantContent(t, path, want)

	past := time.Date(2020, 1, 2, 3, 4, 5, 0, time.UTC)
	if err = os.Chtimes(path, past, past); err != nil {
		t.Fatalf("Chtimes() = %v, want nil", err)
	}
	install(t, dataDir)
	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("Stat() = %v, want nil", err)
	}
	if !info.ModTime().Equal(past) {
		t.Errorf("modified at %v, want %v: a good copy was rewritten", info.ModTime(), past)
	}
}

func TestInstallFailsWhereTheDirectoryCannotBeMade(t *testing.T) {
	t.Parallel()

	dataDir := filepath.Join(t.TempDir(), "file")
	if err := os.WriteFile(dataDir, nil, 0o600); err != nil {
		t.Fatalf("WriteFile() = %v, want nil", err)
	}

	path, err := chime.Install(dataDir)
	if err == nil || path != "" {
		t.Errorf("Install() = %q, %v, want \"\" and an error", path, err)
	}
}

func TestTheChimeIsAShortSoftMonoWAV(t *testing.T) {
	t.Parallel()

	content, err := os.ReadFile("chime.wav")
	if err != nil {
		t.Fatalf("ReadFile(chime.wav) = %v, want nil", err)
	}
	reader := bytes.NewReader(content)
	var header wavHeader
	if err := binary.Read(reader, binary.LittleEndian, &header); err != nil {
		t.Fatalf("read header: %v", err)
	}
	want := wavHeader{
		RIFF:          [4]byte{'R', 'I', 'F', 'F'},
		RIFFSize:      uint32(len(content) - 8),
		WAVE:          [4]byte{'W', 'A', 'V', 'E'},
		Fmt:           [4]byte{'f', 'm', 't', ' '},
		FmtSize:       16,
		Format:        1,
		Channels:      1,
		SampleRate:    48000,
		ByteRate:      96000,
		BlockAlign:    2,
		BitsPerSample: 16,
		Data:          [4]byte{'d', 'a', 't', 'a'},
		DataSize:      uint32(len(content) - headerLen),
	}
	if diff := cmp.Diff(want, header); diff != "" {
		t.Fatalf("header mismatch (-want +got):\n%s", diff)
	}
	if header.DataSize%2 != 0 {
		t.Fatalf("data length = %d, want an even number of bytes", header.DataSize)
	}

	samples := make([]int16, header.DataSize/2)
	if err := binary.Read(reader, binary.LittleEndian, samples); err != nil {
		t.Fatalf("read samples: %v", err)
	}
	if duration := time.Duration(len(samples)) * time.Second / 48000; duration <= 500*time.Millisecond || duration >= time.Second {
		t.Errorf("duration = %v, want more than 500ms and less than 1s", duration)
	}
	var top int
	for _, sample := range samples {
		top = max(top, int(sample), -int(sample))
	}
	// -7 dBFS and -6 dBFS of full scale, rounding included.
	if top < 14636 || top > 16423 {
		t.Errorf("peak = %d, want between 14636 and 16423", top)
	}
	if last := samples[len(samples)-1]; last != 0 {
		t.Errorf("last sample = %d, want 0", last)
	}
}

// install runs Install, failing the test when it fails.
func install(t *testing.T, dataDir string) string {
	t.Helper()

	path, err := chime.Install(dataDir)
	if err != nil {
		t.Fatalf("Install() = %v, want nil", err)
	}
	return path
}

// wantContent fails the test unless the file at path holds want.
func wantContent(t *testing.T, path string, want []byte) {
	t.Helper()

	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("ReadFile(%s) = %v, want nil", path, err)
	}
	if !bytes.Equal(got, want) {
		t.Errorf("%s holds %d bytes that are not the chime", path, len(got))
	}
}

// wantPerm fails the test unless path has the permissions want.
func wantPerm(t *testing.T, path string, want os.FileMode) {
	t.Helper()

	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("Stat(%s) = %v, want nil", path, err)
	}
	if got := info.Mode().Perm(); got != want {
		t.Errorf("%s has permissions %v, want %v", path, got, want)
	}
}
