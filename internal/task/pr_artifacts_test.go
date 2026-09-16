package task_test

import (
	"os"
	"path/filepath"
	"strconv"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/task"
)

// draftFile is the draft of the pull request, as the agent writes it.
func draftFile(repository, title, body string) string {
	return "---\nrepository: " + repository + "\ntitle: " + title + "\n---\n\n" + body
}

// reportFile is one review pass, as the agent writes it.
func reportFile(repository string, pass int, status, body string) string {
	return "---\nrepository: " + repository + "\npass: " + strconv.Itoa(pass) +
		"\nstatus: " + status + "\n---\n\n" + body
}

// writePR puts a file inside the pr folder of a task.
func writePR(t *testing.T, tk task.Task, name, content string) {
	t.Helper()

	if err := os.MkdirAll(tk.PRDir(), 0o700); err != nil {
		t.Fatalf("create pr directory: %v", err)
	}
	writeFile(t, filepath.Join(tk.PRDir(), name), content)
}

func TestPRPaths(t *testing.T) {
	t.Parallel()

	tk := task.Task{ArtifactsDir: "/data/add-login"}

	if got, want := tk.PRDir(), "/data/add-login/pr"; got != want {
		t.Errorf("PRDir() = %q, want %q", got, want)
	}
	if got, want := tk.DraftPath(), "/data/add-login/pr/draft.md"; got != want {
		t.Errorf("DraftPath() = %q, want %q", got, want)
	}
	if got, want := tk.ReviewPath(2), "/data/add-login/pr/review-2.md"; got != want {
		t.Errorf("ReviewPath() = %q, want %q", got, want)
	}
}

func TestReadPRArtifactsOfAMissingFolder(t *testing.T) {
	t.Parallel()

	got := task.ReadPRArtifacts(filepath.Join(t.TempDir(), "pr"))

	if diff := cmp.Diff(task.PRArtifacts{}, got); diff != "" {
		t.Errorf("ReadPRArtifacts() mismatch (-want +got):\n%s", diff)
	}
}

func TestReadPRArtifactsFindsTheDraftAndTheReportsOfTheTask(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")
	writePR(t, created, "draft.md", draftFile("dev/web", "Add the store", "What it does.\n"))
	writePR(t, created, "review-2.md", reportFile("dev/web", 2, "clean", "Nothing to change.\n"))
	writePR(t, created, "review-1.md", reportFile("dev/web", 1, "findings", "Two things.\n"))

	got := task.ReadPRArtifacts(created.PRDir())

	want := task.PRArtifacts{
		Draft: task.Draft{Present: true, Title: "Add the store", Body: "What it does."},
		Reports: []task.ReviewReport{
			{Pass: 1, File: "review-1.md"},
			{Pass: 2, File: "review-2.md", Clean: true},
		},
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("ReadPRArtifacts() mismatch (-want +got):\n%s", diff)
	}
}

func TestReadPRArtifactsIgnoresWhatIsNotAnArtifactOfTheTask(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")
	writePR(t, created, ".draft.md.swp", "half a write")
	writePR(t, created, "notes.md", "loose notes")
	writePR(t, created, "review-x.md", reportFile("dev/web", 1, "clean", "Body.\n"))
	if err := os.MkdirAll(filepath.Join(created.PRDir(), "draft.md"), 0o700); err != nil {
		t.Fatalf("create directory: %v", err)
	}

	got := task.ReadPRArtifacts(created.PRDir())

	if diff := cmp.Diff(task.PRArtifacts{}, got); diff != "" {
		t.Errorf("ReadPRArtifacts() mismatch (-want +got):\n%s", diff)
	}
}

func TestReadPRArtifactsRefusesHalfWrittenFiles(t *testing.T) {
	t.Parallel()

	tests := map[string]struct{ name, content string }{
		"a draft with no header": {name: "draft.md", content: "# Add the store\n"},
		"a draft with no title":  {name: "draft.md", content: "---\nrepository: dev/web\n---\n\nBody.\n"},
		"a draft with no body":   {name: "draft.md", content: draftFile("dev/web", "Add the store", "\n \n")},
		"a report with no status": {
			name:    "review-1.md",
			content: "---\nrepository: dev/web\npass: 1\n---\n\nBody.\n",
		},
		"a report whose pass disagrees with its name": {
			name:    "review-1.md",
			content: reportFile("dev/web", 2, "clean", "Body.\n"),
		},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			created := f.create(t, "add-login")
			writePR(t, created, tc.name, tc.content)

			if got := task.ReadPRArtifacts(created.PRDir()); got.Draft.Present || len(got.Reports) != 0 {
				t.Errorf("ReadPRArtifacts() = %+v, want nothing", got)
			}
		})
	}
}

func TestReadPRArtifactsReadsCleanExactly(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")
	writePR(t, created, "review-1.md", reportFile("dev/web", 1, "Clean", "Body.\n"))

	got := task.ReadPRArtifacts(created.PRDir())

	if len(got.Reports) != 1 {
		t.Fatalf("ReadPRArtifacts() = %+v, want one report", got)
	}
	if got.Reports[0].Clean {
		t.Error("Clean = true, want false: only a lowercase \"clean\" closes a pass")
	}
}

func TestWriteDraftIsWhatTheReaderReadsBack(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")

	err := task.WriteDraft(
		created.DraftPath(), "dev/web", "origin/dev", "  Add the review strip\n", "\nWhat it does.\n\n",
	)
	if err != nil {
		t.Fatalf("WriteDraft() = %v, want nil", err)
	}

	content, err := os.ReadFile(created.DraftPath())
	if err != nil {
		t.Fatalf("read the draft = %v, want nil", err)
	}
	want := "---\nrepository: dev/web\nbase: origin/dev\ntitle: Add the review strip\n---\n\nWhat it does.\n"
	if string(content) != want {
		t.Errorf("draft = %q, want %q", content, want)
	}

	got := task.ReadPRArtifacts(created.PRDir())
	wantDraft := task.Draft{Present: true, Title: "Add the review strip", Body: "What it does."}
	if diff := cmp.Diff(wantDraft, got.Draft); diff != "" {
		t.Errorf("Draft mismatch (-want +got):\n%s", diff)
	}
}

func TestWriteDraftKeepsTheTitleOnOneLine(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")

	if err := task.WriteDraft(created.DraftPath(), "dev/web", "origin/main", "Add\nthe store", "Body."); err != nil {
		t.Fatalf("WriteDraft() = %v, want nil", err)
	}

	got := task.ReadPRArtifacts(created.PRDir())
	if want := "Add the store"; got.Draft.Title != want {
		t.Errorf("Title = %q, want %q", got.Draft.Title, want)
	}
}

func TestWriteDraftCreatesTheFolder(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")

	if err := task.WriteDraft(created.DraftPath(), "dev/web", "origin/dev", "Title", "Body."); err != nil {
		t.Fatalf("WriteDraft() = %v, want nil", err)
	}
	if !exists(created.PRDir()) {
		t.Error("the pr folder is missing, want it created")
	}
}

func TestInspectReadsThePRFolder(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")
	writePR(t, created, "draft.md", draftFile("dev/web", "Add the store", "What it does.\n"))

	got, err := f.service.Inspect(created.ID)
	if err != nil {
		t.Fatalf("Inspect() = %v, want nil", err)
	}

	if !got.Has(task.ArtifactPR) {
		t.Errorf("Has(ArtifactPR) = false, want the draft found: %+v", got.PR)
	}
	if title := got.PR.Draft.Title; title != "Add the store" {
		t.Errorf("Draft.Title = %q, want %q", title, "Add the store")
	}
}

func TestArtifactsOfANewTaskHoldNoPRArtifact(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")

	got, ok := f.service.Artifacts(created.ID)
	if !ok {
		t.Fatal("Artifacts() = false, want the task")
	}
	if got.Has(task.ArtifactPR) {
		t.Error("Has(ArtifactPR) = true, want nothing written yet")
	}
}

func TestWatcherReportsThePRFolderAsItComesAndGoes(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")

	writePR(t, created, "draft.md", draftFile("dev/web", "Add the store", "What it does.\n"))
	waitFor(t, "the draft to appear", func() bool {
		calls := f.artifactCalls()
		if len(calls) == 0 {
			return false
		}
		_, ok := calls[len(calls)-1].change(task.ArtifactPR)
		return ok
	})
	seen := len(f.artifactCalls())

	if err := os.RemoveAll(created.PRDir()); err != nil {
		t.Fatalf("remove pr directory: %v", err)
	}
	waitFor(t, "the removal to settle", func() bool { return len(f.artifactCalls()) > seen })

	calls := f.artifactCalls()
	if _, ok := calls[len(calls)-1].change(task.ArtifactPR); ok {
		t.Error("the pr folder was reported although it is gone")
	}
	if cached, _ := f.service.Artifacts(created.ID); cached.Has(task.ArtifactPR) {
		t.Error("Has(ArtifactPR) = true, want the cache to follow the folder")
	}
}

func TestRemoveArtifactsFromTheImplementationThrowsAwayThePRFolder(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")
	writePR(t, created, "draft.md", draftFile("dev/web", "Add the store", "What it does.\n"))

	if err := f.service.RemoveArtifacts(t.Context(), created.ID, task.StageImplementation); err != nil {
		t.Fatalf("RemoveArtifacts() = %v, want nil", err)
	}

	if exists(created.PRDir()) {
		t.Error("the pr folder is still there, want it thrown away")
	}
	if cached, _ := f.service.Artifacts(created.ID); cached.Has(task.ArtifactPR) {
		t.Error("Has(ArtifactPR) = true, want the cache to follow the folder")
	}
}

func TestReadArtifactReturnsThePRArtifacts(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")
	draft := draftFile("dev/web", "Add the store", "What it does.\n")
	report := reportFile("dev/web", 1, "clean", "Nothing to change.\n")
	writePR(t, created, "draft.md", draft)
	writePR(t, created, "review-1.md", report)

	tests := map[string]struct{ name, want string }{
		"a draft":  {name: "pr/draft.md", want: draft},
		"a report": {name: "pr/review-1.md", want: report},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			got, err := f.service.ReadArtifact(created.ID, tc.name)
			if err != nil {
				t.Fatalf("ReadArtifact(%q) = %v, want nil", tc.name, err)
			}
			if got != tc.want {
				t.Errorf("ReadArtifact(%q) = %q, want %q", tc.name, got, tc.want)
			}
		})
	}
}

func TestReadArtifactRefusesAnythingButThePRArtifacts(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login")

	names := map[string]string{
		"a path through the pr folder": "pr/../PRD.md",
		"a nested path":                "pr/nested/draft.md",
		"a file that is not a draft":   "pr/notes.md",
		"a report with no pass":        "pr/review-.md",
		"the folder itself":            task.PRDirName,
	}

	for name, artifact := range names {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			_, err := f.service.ReadArtifact(created.ID, artifact)
			wantErrIs(t, err, task.ErrNotFound)
		})
	}
}
