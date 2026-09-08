package task_test

import (
	"os"
	"path/filepath"
	"strconv"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/task"
)

// draftFile is the draft of a repository, as the agent writes it.
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

func TestSlugIsTheFileNameFormOfARepository(t *testing.T) {
	t.Parallel()

	tests := map[string]struct{ rel, want string }{
		"the workspace root": {rel: ".", want: "_root"},
		"a repository":       {rel: "api", want: "api"},
		"a nested one":       {rel: "apps/web", want: "apps__web"},
		"a deeper one":       {rel: "services/api/core", want: "services__api__core"},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			if got := task.Slug(tc.rel); got != tc.want {
				t.Errorf("Slug(%q) = %q, want %q", tc.rel, got, tc.want)
			}
		})
	}
}

func TestPRPaths(t *testing.T) {
	t.Parallel()

	tk := task.Task{ArtifactsDir: "/data/add-login"}

	if got, want := tk.PRDir(), "/data/add-login/pr"; got != want {
		t.Errorf("PRDir() = %q, want %q", got, want)
	}
	if got, want := tk.DraftPath("apps__web"), "/data/add-login/pr/apps__web-draft.md"; got != want {
		t.Errorf("DraftPath() = %q, want %q", got, want)
	}
	if got, want := tk.ReviewPath("api", 2), "/data/add-login/pr/api-review-2.md"; got != want {
		t.Errorf("ReviewPath() = %q, want %q", got, want)
	}
}

func TestReadPRArtifactsOfAMissingFolder(t *testing.T) {
	t.Parallel()

	got := task.ReadPRArtifacts(filepath.Join(t.TempDir(), "pr"), []string{"api"})

	if got == nil {
		t.Fatal("ReadPRArtifacts() = nil, want an empty map")
	}
	if len(got) != 0 {
		t.Errorf("ReadPRArtifacts() = %+v, want nothing", got)
	}
}

func TestReadPRArtifactsReadsTheDraftAndTheReports(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")
	writePR(t, created, "api-draft.md", draftFile("api", "Add the store", "What it does.\n"))
	writePR(t, created, "api-review-2.md", reportFile("api", 2, "clean", "Nothing to change.\n"))
	writePR(t, created, "api-review-1.md", reportFile("api", 1, "findings", "Two things.\n"))

	got := task.ReadPRArtifacts(created.PRDir(), []string{"api"})

	want := map[string]task.RepoArtifacts{
		"api": {
			Draft: task.Draft{Present: true, Title: "Add the store", Body: "What it does."},
			Reports: []task.ReviewReport{
				{Pass: 1, File: "api-review-1.md"},
				{Pass: 2, File: "api-review-2.md", Clean: true},
			},
		},
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("ReadPRArtifacts() mismatch (-want +got):\n%s", diff)
	}
}

func TestReadPRArtifactsIgnoresWhatIsNotAnArtifactOfTheTask(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")
	writePR(t, created, "web-draft.md", draftFile("web", "Of another repository", "Body.\n"))
	writePR(t, created, ".api-draft.md.swp", "half a write")
	writePR(t, created, "notes.md", "loose notes")
	writePR(t, created, "api-review-x.md", reportFile("api", 1, "clean", "Body.\n"))
	if err := os.MkdirAll(filepath.Join(created.PRDir(), "api-draft.md"), 0o700); err != nil {
		t.Fatalf("create directory: %v", err)
	}

	got := task.ReadPRArtifacts(created.PRDir(), []string{"api"})

	if len(got) != 0 {
		t.Errorf("ReadPRArtifacts() = %+v, want nothing", got)
	}
}

func TestReadPRArtifactsRefusesHalfWrittenFiles(t *testing.T) {
	t.Parallel()

	tests := map[string]struct{ name, content string }{
		"a draft with no header": {name: "api-draft.md", content: "# Add the store\n"},
		"a draft with no title":  {name: "api-draft.md", content: "---\nrepository: api\n---\n\nBody.\n"},
		"a draft with no body":   {name: "api-draft.md", content: draftFile("api", "Add the store", "\n \n")},
		"a report with no status": {
			name:    "api-review-1.md",
			content: "---\nrepository: api\npass: 1\n---\n\nBody.\n",
		},
		"a report whose pass disagrees with its name": {
			name:    "api-review-1.md",
			content: reportFile("api", 2, "clean", "Body.\n"),
		},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			created := f.create(t, "add-login", "")
			writePR(t, created, tc.name, tc.content)

			if got := task.ReadPRArtifacts(created.PRDir(), []string{"api"}); len(got) != 0 {
				t.Errorf("ReadPRArtifacts() = %+v, want nothing", got)
			}
		})
	}
}

func TestReadPRArtifactsReadsCleanExactly(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")
	writePR(t, created, "api-review-1.md", reportFile("api", 1, "Clean", "Body.\n"))

	got := task.ReadPRArtifacts(created.PRDir(), []string{"api"})

	if len(got["api"].Reports) != 1 {
		t.Fatalf("ReadPRArtifacts() = %+v, want one report", got)
	}
	if got["api"].Reports[0].Clean {
		t.Error("Clean = true, want false: only a lowercase \"clean\" closes a pass")
	}
}

func TestWriteDraftIsWhatTheReaderReadsBack(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")
	path := created.DraftPath("apps__web")

	err := task.WriteDraft(path, "apps/web", "origin/dev", "  Add the review strip\n", "\nWhat it does.\n\n")
	if err != nil {
		t.Fatalf("WriteDraft() = %v, want nil", err)
	}

	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read the draft = %v, want nil", err)
	}
	want := "---\nrepository: apps/web\nbase: origin/dev\ntitle: Add the review strip\n---\n\nWhat it does.\n"
	if string(content) != want {
		t.Errorf("draft = %q, want %q", content, want)
	}

	got := task.ReadPRArtifacts(created.PRDir(), []string{"apps__web"})
	wantDraft := task.Draft{Present: true, Title: "Add the review strip", Body: "What it does."}
	if diff := cmp.Diff(wantDraft, got["apps__web"].Draft); diff != "" {
		t.Errorf("Draft mismatch (-want +got):\n%s", diff)
	}
}

func TestWriteDraftKeepsTheTitleOnOneLine(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")
	path := created.DraftPath("api")

	if err := task.WriteDraft(path, "api", "origin/main", "Add\nthe store", "Body."); err != nil {
		t.Fatalf("WriteDraft() = %v, want nil", err)
	}

	got := task.ReadPRArtifacts(created.PRDir(), []string{"api"})
	if want := "Add the store"; got["api"].Draft.Title != want {
		t.Errorf("Title = %q, want %q", got["api"].Draft.Title, want)
	}
}

func TestWriteDraftCreatesTheFolder(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")

	if err := task.WriteDraft(created.DraftPath("api"), "api", "origin/dev", "Title", "Body."); err != nil {
		t.Fatalf("WriteDraft() = %v, want nil", err)
	}
	if !exists(created.PRDir()) {
		t.Error("the pr folder is missing, want it created")
	}
}

func TestInspectReadsThePRFolder(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")
	writePR(t, created, "api-draft.md", draftFile("api", "Add the store", "What it does.\n"))

	got, err := f.service.Inspect(created.ID)
	if err != nil {
		t.Fatalf("Inspect() = %v, want nil", err)
	}

	if !got.Has(task.ArtifactPR) {
		t.Errorf("Has(ArtifactPR) = false, want the draft found: %+v", got.PR)
	}
	if title := got.PR["api"].Draft.Title; title != "Add the store" {
		t.Errorf("Draft.Title = %q, want %q", title, "Add the store")
	}
}

func TestArtifactsOfANewTaskHoldAnEmptyPRMap(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")

	got, ok := f.service.Artifacts(created.ID)
	if !ok {
		t.Fatal("Artifacts() = false, want the task")
	}
	if got.PR == nil {
		t.Error("Artifacts().PR = nil, want an empty map")
	}
	if got.Has(task.ArtifactPR) {
		t.Error("Has(ArtifactPR) = true, want nothing written yet")
	}
}

func TestWatcherReportsThePRFolderAsItComesAndGoes(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")

	writePR(t, created, "api-draft.md", draftFile("api", "Add the store", "What it does.\n"))
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
	created := f.create(t, "add-login", "")
	writePR(t, created, "api-draft.md", draftFile("api", "Add the store", "What it does.\n"))

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
	created := f.create(t, "add-login", "")
	draft := draftFile("api", "Add the store", "What it does.\n")
	report := reportFile("api", 1, "clean", "Nothing to change.\n")
	writePR(t, created, "api-draft.md", draft)
	writePR(t, created, "api-review-1.md", report)

	tests := map[string]struct{ name, want string }{
		"a draft":  {name: "pr/api-draft.md", want: draft},
		"a report": {name: "pr/api-review-1.md", want: report},
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
	created := f.create(t, "add-login", "")

	names := map[string]string{
		"a path through the pr folder": "pr/../PRD.md",
		"a nested path":                "pr/nested/api-draft.md",
		"a file that is not a draft":   "pr/notes.md",
		"a report with no pass":        "pr/api-review-.md",
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
