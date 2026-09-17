package prreview_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/prreview"
)

// lines is the set of line numbers a file has on the new side.
func lines(numbers ...int) map[int]struct{} {
	set := map[int]struct{}{}
	for _, number := range numbers {
		set[number] = struct{}{}
	}
	return set
}

func TestTheNewSideOfADiffHoldsTheLinesAddedAndTheOnesAround(t *testing.T) {
	t.Parallel()

	unified := `diff --git a/internal/task/service.go b/internal/task/service.go
index 1111111..2222222 100644
--- a/internal/task/service.go
+++ b/internal/task/service.go
@@ -10,3 +10,4 @@ func New() {
 	first
-	dropped
+	added
+	another
 	last
`

	want := map[string]map[int]struct{}{
		"internal/task/service.go": lines(10, 11, 12, 13),
	}
	if diff := cmp.Diff(want, prreview.RightLines(unified)); diff != "" {
		t.Errorf("right lines (-want +got):\n%s", diff)
	}
}

func TestTwoHunksOfAFileEachStartWhereTheirHeaderSays(t *testing.T) {
	t.Parallel()

	unified := `--- a/main.go
+++ b/main.go
@@ -1,2 +1,2 @@
 package main
+import "fmt"
@@ -30,2 +40,2 @@
 func main() {
+	fmt.Println("hi")
`

	want := map[string]map[int]struct{}{"main.go": lines(1, 2, 40, 41)}
	if diff := cmp.Diff(want, prreview.RightLines(unified)); diff != "" {
		t.Errorf("right lines (-want +got):\n%s", diff)
	}
}

func TestANewFileIsAllNewSide(t *testing.T) {
	t.Parallel()

	unified := `diff --git a/docs/new.md b/docs/new.md
new file mode 100644
--- /dev/null
+++ b/docs/new.md
@@ -0,0 +1,2 @@
+# Title
+
\ No newline at end of file
`

	want := map[string]map[int]struct{}{"docs/new.md": lines(1, 2)}
	if diff := cmp.Diff(want, prreview.RightLines(unified)); diff != "" {
		t.Errorf("right lines (-want +got):\n%s", diff)
	}
}

func TestARemovedFileHasNoNewSideToCommentOn(t *testing.T) {
	t.Parallel()

	unified := `diff --git a/old.go b/old.go
deleted file mode 100644
--- a/old.go
+++ /dev/null
@@ -1,2 +0,0 @@
-package old
-
`

	if got := prreview.RightLines(unified); len(got) != 0 {
		t.Errorf("right lines = %v, want none", got)
	}
}

func TestARenamedFileKeepsOnlyItsNewName(t *testing.T) {
	t.Parallel()

	unified := `diff --git a/old/name.go b/new/name.go
similarity index 90%
rename from old/name.go
rename to new/name.go
--- a/old/name.go
+++ b/new/name.go
@@ -5,2 +5,2 @@
 package name
+// renamed
`

	want := map[string]map[int]struct{}{"new/name.go": lines(5, 6)}
	if diff := cmp.Diff(want, prreview.RightLines(unified)); diff != "" {
		t.Errorf("right lines (-want +got):\n%s", diff)
	}
}
