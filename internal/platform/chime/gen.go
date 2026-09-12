//go:build ignore

// This program synthesizes chime.wav, the sound of the notifications of the
// app: a rising fifth of two soft, bell-like notes. Its output is
// deterministic and committed, so building the app never runs it;
// `go generate ./internal/platform/chime/` runs it again after it changes.
package main

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"math"
	"os"
)

// The format of the file: 16-bit PCM, mono, at 48 kHz, the one format every
// audio player the app runs reads.
const (
	sampleRate     = 48000
	channels       = 1
	bitsPerSample  = 16
	bytesPerSample = bitsPerSample / 8
	blockAlign     = channels * bytesPerSample
	byteRate       = sampleRate * blockAlign
	formatPCM      = 1
)

// The sizes the RIFF header declares: the fmt chunk of a PCM file, and what
// the header holds after the RIFF size field besides the samples.
const (
	fmtChunkSize  = 16
	riffHeaderLen = 36
)

// The shape of the sound, in seconds and gains.
const (
	duration      = 0.75  // the length of the file: 36000 samples
	attack        = 0.006 // the raised-cosine onset of a note: struck, without a click
	decay         = 0.09  // a note fades as exp(-t/decay), about -60 dB at 0.62 s
	overtoneGain  = 0.25  // a second partial at twice the frequency of the note
	overtoneDecay = 0.045 // the overtone fades faster, so the brightness goes first
	fadeOut       = 0.02  // the linear fade that brings the last sample to exactly 0
)

// peak is the level of the loudest sample, -6 dBFS (about 0.5012): soft, with
// headroom.
var peak = math.Pow(10, -6.0/20)

// maxSample is full scale for a 16-bit sample.
const maxSample = math.MaxInt16

// The file go generate writes, in the package directory it runs in.
const (
	outputFile = "chime.wav"
	outputPerm = 0o644
)

// note is one note of the chime: its frequency in Hz, when it starts in
// seconds, and its gain.
type note struct {
	freq  float64
	start float64
	gain  float64
}

// notes rise a fifth: E5, then B5.
var notes = []note{
	{freq: 659.25, start: 0, gain: 1.0},
	{freq: 987.77, start: 0.120, gain: 0.85},
}

func main() {
	wav, err := encode(synthesize())
	if err == nil {
		err = os.WriteFile(outputFile, wav, outputPerm)
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "generate chime:", err)
		os.Exit(1)
	}
}

// synthesize sums the notes, fades out the end and scales the result to peak,
// as 16-bit samples.
func synthesize() []int16 {
	signal := make([]float64, int(duration*sampleRate))
	for i := range signal {
		at := float64(i) / sampleRate
		for _, n := range notes {
			signal[i] += n.sample(at - n.start)
		}
	}
	fade(signal)
	normalize(signal)
	return quantize(signal)
}

// sample is the note t seconds after it starts; before it starts, silence.
func (n note) sample(t float64) float64 {
	if t < 0 {
		return 0
	}
	fundamental := math.Sin(2 * math.Pi * n.freq * t)
	overtone := overtoneGain * math.Exp(-t/overtoneDecay) * math.Sin(2*math.Pi*2*n.freq*t)
	return n.gain * onset(t) * math.Exp(-t/decay) * (fundamental + overtone)
}

// onset is the raised-cosine attack envelope of a note.
func onset(t float64) float64 {
	if t >= attack {
		return 1
	}
	return 0.5 - 0.5*math.Cos(math.Pi*t/attack)
}

// fade brings the last fadeOut seconds of the signal linearly down to exactly
// 0 at the last sample.
func fade(signal []float64) {
	length := int(fadeOut * sampleRate)
	last := len(signal) - 1
	for i := len(signal) - length; i <= last; i++ {
		signal[i] *= float64(last-i) / float64(length-1)
	}
}

// normalize scales the signal so that its loudest sample is at peak.
func normalize(signal []float64) {
	var top float64
	for _, x := range signal {
		top = max(top, math.Abs(x))
	}
	for i := range signal {
		signal[i] *= peak / top
	}
}

// quantize turns the signal into 16-bit samples.
func quantize(signal []float64) []int16 {
	samples := make([]int16, len(signal))
	for i, x := range signal {
		samples[i] = int16(math.Round(x * maxSample))
	}
	return samples
}

// encode writes the samples as a WAV file: the canonical 44-byte RIFF header,
// then the data, little endian.
func encode(samples []int16) ([]byte, error) {
	dataLen := uint32(len(samples) * bytesPerSample)
	var buf bytes.Buffer
	for _, field := range []any{
		[]byte("RIFF"), riffHeaderLen + dataLen, []byte("WAVE"),
		[]byte("fmt "), uint32(fmtChunkSize), uint16(formatPCM), uint16(channels),
		uint32(sampleRate), uint32(byteRate), uint16(blockAlign), uint16(bitsPerSample),
		[]byte("data"), dataLen,
		samples,
	} {
		if err := binary.Write(&buf, binary.LittleEndian, field); err != nil {
			return nil, fmt.Errorf("encode %T: %w", field, err)
		}
	}
	return buf.Bytes(), nil
}
