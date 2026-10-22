package gh_test

import (
	"errors"
	"strings"
	"testing"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/gh/ghtest"
)

const issueURL = "https://github.com/acme/web/issues/12"

func TestCreateIssueAttachedPassesTheBodyOnStdinAndEachFile(t *testing.T) {
	t.Parallel()
	r, fake := runner(t, map[string]ghtest.Reply{"issue": {Stdout: issueURL + "\n"}})

	dir := t.TempDir()
	url, err := r.CreateIssueAttached(t.Context(), dir, "acme/web", "Export", "body ![a](images/a.png)", []string{"images/a.png", "images/b.png"})
	if err != nil {
		t.Fatalf("CreateIssueAttached() = %v, want nil", err)
	}
	if url != issueURL {
		t.Errorf("url = %q, want %q", url, issueURL)
	}
	call := fake.Calls(t)[0]
	want := "issue create --repo acme/web --title Export --body-file - --attach images/a.png --attach images/b.png"
	if call.Args != want {
		t.Errorf("Args = %q, want %q", call.Args, want)
	}
	if call.Dir == "" || !strings.HasSuffix(call.Dir, dir[strings.LastIndex(dir, "/")+1:]) {
		t.Errorf("Dir = %q, want it to be %q", call.Dir, dir)
	}
	if got := fake.Stdin(t); got != "body ![a](images/a.png)" {
		t.Errorf("stdin = %q, want the body", got)
	}
}

func TestCreateIssueAttachedWithoutUrlIsAnError(t *testing.T) {
	t.Parallel()
	r, _ := runner(t, map[string]ghtest.Reply{"issue": {Stdout: "done"}})

	_, err := r.CreateIssueAttached(t.Context(), t.TempDir(), "acme/web", "t", "b", nil)
	if err == nil || !strings.Contains(err.Error(), "printed no issue url") {
		t.Errorf("CreateIssueAttached() = %v, want the missing url", err)
	}
}

func TestCreateIssueAttachedPartialFailureSaysTheIssueWasWritten(t *testing.T) {
	t.Parallel()
	r, _ := runner(t, map[string]ghtest.Reply{"issue": {
		Stdout: issueURL + "\n",
		Stderr: "could not upload images/a.png: GitHub refused the file\n",
		Exit:   1,
	}})

	_, err := r.CreateIssueAttached(t.Context(), t.TempDir(), "acme/web", "t", "b", []string{"images/a.png"})
	var attach *gh.AttachError
	if !errors.As(err, &attach) {
		t.Fatalf("error = %v, want *gh.AttachError", err)
	}
	if !attach.Written || attach.URL != issueURL {
		t.Errorf("Written, URL = %v, %q, want true, %q", attach.Written, attach.URL, issueURL)
	}
	if attach.Path != "images/a.png" || attach.Failure != gh.AttachRefused || attach.Detail != "GitHub refused the file" {
		t.Errorf("attach = %+v, want a.png refused", attach)
	}
	if attach.Err == nil || !errors.Is(attach, attach.Err) {
		t.Errorf("errors.Is(attach, attach.Err) = false, want the gh error underneath")
	}
	if want := "gh: attach images/a.png: GitHub refused the file"; attach.Error() != want {
		t.Errorf("Error() = %q, want %q", attach.Error(), want)
	}
}

func TestCreateIssueAttachedClassifiesAFailureWithNothingWritten(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name    string
		stderr  string
		path    string
		failure gh.AttachFailure
		message string
	}{
		{"no write", "could not upload images/a.png: attaching files requires write access to acme/web", "images/a.png", gh.AttachNoWrite, "gh: attach images/a.png: attaching files requires write access to acme/web"},
		{"rate limited", "could not upload images/a.png: you have been rate limited", "images/a.png", gh.AttachRateLimited, ""},
		{"network", "failed to upload images/a.png: dial tcp: timeout", "images/a.png", gh.AttachNetwork, ""},
		{"refused", "could not upload images/a.png: unsupported file type", "images/a.png", gh.AttachRefused, ""},
		{"no write without path", "attaching files requires write access to acme/web", "", gh.AttachNoWrite, "gh: attach: attaching files requires write access"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			r, _ := runner(t, map[string]ghtest.Reply{"issue": {Stderr: tt.stderr, Exit: 1}})

			_, err := r.CreateIssueAttached(t.Context(), t.TempDir(), "acme/web", "t", "b", []string{"images/a.png"})
			var attach *gh.AttachError
			if !errors.As(err, &attach) {
				t.Fatalf("error = %v, want *gh.AttachError", err)
			}
			if attach.Written || attach.Path != tt.path || attach.Failure != tt.failure {
				t.Errorf("attach = %+v, want not written, %q, %q", attach, tt.path, tt.failure)
			}
			if tt.message != "" && !strings.HasPrefix(attach.Error(), tt.message) {
				t.Errorf("Error() = %q, want it to start with %q", attach.Error(), tt.message)
			}
		})
	}
}

func TestCreateIssueAttachedWrittenWithoutAnUploadLineIsOther(t *testing.T) {
	t.Parallel()
	r, _ := runner(t, map[string]ghtest.Reply{"issue": {Stdout: issueURL, Stderr: "something odd", Exit: 1}})

	_, err := r.CreateIssueAttached(t.Context(), t.TempDir(), "acme/web", "t", "b", nil)
	var attach *gh.AttachError
	if !errors.As(err, &attach) {
		t.Fatalf("error = %v, want *gh.AttachError", err)
	}
	if !attach.Written || attach.Failure != gh.AttachOther || attach.Detail != "something odd" {
		t.Errorf("attach = %+v, want written, other, something odd", attach)
	}
}

func TestCreateIssueAttachedExit4IsNotAuthenticated(t *testing.T) {
	t.Parallel()
	r, _ := runner(t, map[string]ghtest.Reply{"issue": {Stderr: "token expired", Exit: 4}})

	_, err := r.CreateIssueAttached(t.Context(), t.TempDir(), "acme/web", "t", "b", nil)
	if !errors.Is(err, gh.ErrNotAuthenticated) {
		t.Errorf("error = %v, want ErrNotAuthenticated", err)
	}
}

func TestCreateIssueAttachedOtherFailureIsTheGhError(t *testing.T) {
	t.Parallel()
	r, _ := runner(t, map[string]ghtest.Reply{"issue": {Stderr: "boom", Exit: 1}})

	_, err := r.CreateIssueAttached(t.Context(), t.TempDir(), "acme/web", "t", "b", nil)
	var ghErr *gh.Error
	var attach *gh.AttachError
	if !errors.As(err, &ghErr) || errors.As(err, &attach) {
		t.Errorf("error = %v, want a plain *gh.Error", err)
	}
}

func TestEditIssueAttachedWithAndWithoutTitle(t *testing.T) {
	t.Parallel()
	r, fake := runner(t, map[string]ghtest.Reply{"issue": {}})

	if err := r.EditIssueAttached(t.Context(), t.TempDir(), "acme/web", 12, "New", "body", []string{"images/a.png"}); err != nil {
		t.Fatalf("EditIssueAttached() = %v, want nil", err)
	}
	if err := r.EditIssueAttached(t.Context(), t.TempDir(), "acme/web", 12, "", "body", nil); err != nil {
		t.Fatalf("EditIssueAttached() = %v, want nil", err)
	}
	calls := fake.Calls(t)
	if want := "issue edit 12 --repo acme/web --title New --body-file - --attach images/a.png"; calls[0].Args != want {
		t.Errorf("Args = %q, want %q", calls[0].Args, want)
	}
	if want := "issue edit 12 --repo acme/web --body-file -"; calls[1].Args != want {
		t.Errorf("Args = %q, want %q", calls[1].Args, want)
	}
}

func TestEditIssueAttachedFailure(t *testing.T) {
	t.Parallel()
	r, _ := runner(t, map[string]ghtest.Reply{"issue": {Stdout: issueURL, Stderr: "failed to upload images/b.png: eof", Exit: 1}})

	err := r.EditIssueAttached(t.Context(), t.TempDir(), "acme/web", 12, "", "b", []string{"images/b.png"})
	var attach *gh.AttachError
	if !errors.As(err, &attach) || !attach.Written || attach.Failure != gh.AttachNetwork {
		t.Errorf("error = %v, want a written network AttachError", err)
	}
}

func TestIssueBody(t *testing.T) {
	t.Parallel()
	r, fake := runner(t, map[string]ghtest.Reply{"api": {Stdout: `{"data":{"node":{"body":"hello ![a](x)"}}}`}})

	got, err := r.IssueBody(t.Context(), "I_1")
	if err != nil {
		t.Fatalf("IssueBody() = %v, want nil", err)
	}
	if got != "hello ![a](x)" {
		t.Errorf("IssueBody() = %q, want the body", got)
	}
	if args := fake.Calls(t)[0].Args; !strings.Contains(args, "id=I_1") {
		t.Errorf("Args = %q, want the id", args)
	}
}

func TestIssueBodyNotFound(t *testing.T) {
	t.Parallel()
	tests := map[string]string{
		"error":     `{"data":{"node":null},"errors":[{"type":"NOT_FOUND","message":"Could not resolve to a node"}]}`,
		"null node": `{"data":{"node":null}}`,
	}
	for name, stdout := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			r, _ := runner(t, map[string]ghtest.Reply{"api": {Stdout: stdout}})

			_, err := r.IssueBody(t.Context(), "I_1")
			if !errors.Is(err, gh.ErrNoSuchNode) {
				t.Errorf("IssueBody() = %v, want ErrNoSuchNode", err)
			}
		})
	}
}

func TestIssueNumber(t *testing.T) {
	t.Parallel()
	tests := map[string]int{
		issueURL:                             12,
		issueURL + "/":                       12,
		"https://github.com/acme/web/pull/3": 0,
		"":                                   0,
	}
	for url, want := range tests {
		if got := gh.IssueNumber(url); got != want {
			t.Errorf("IssueNumber(%q) = %d, want %d", url, got, want)
		}
	}
}
