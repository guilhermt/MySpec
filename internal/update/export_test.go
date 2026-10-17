package update

// NewScriptRunner is the Runner of this system, for the tests of the package
// outside it.
var NewScriptRunner = func() Runner { return scriptRunner{} }

// ScriptResult is the result of an install script, for TestParseResult.
type ScriptResult struct {
	Result, Version, Path, Kind, Reason string
	Commands                            []string
}

// ParseResult is parseResult with a result the test can name.
func ParseResult(data []byte) (ScriptResult, bool) {
	res, ok := parseResult(data)
	return ScriptResult{res.result, res.version, res.path, res.kind, res.reason, res.commands}, ok
}

// Sentence is sentence, for TestSentence.
var Sentence = sentence
