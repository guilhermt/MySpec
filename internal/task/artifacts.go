package task

// ArtifactKind names an artifact of a task.
type ArtifactKind string

// The artifacts a task produces while it is planned.
const (
	ArtifactPRD      ArtifactKind = "prd"
	ArtifactTechSpec ArtifactKind = "tech_spec"
	ArtifactPlan     ArtifactKind = "plan"
	ArtifactPR       ArtifactKind = "pr"
)

// Artifacts is what the folder of a task holds.
type Artifacts struct {
	PRD      bool // PRD.md exists with content
	TechSpec bool // tech-spec.md exists with content
	Plan     Plan
	PR       map[string]RepoArtifacts // by repository slug; never nil
}

// Done reports whether the artifact that ends a stage is there.
func (a Artifacts) Done(stage Stage) bool {
	switch stage {
	case StagePRD:
		return a.PRD
	case StageTechSpec:
		return a.TechSpec
	case StagePlan:
		return a.Plan.Valid()
	case StageImplementation:
		return true
	default:
		return false
	}
}

// Has reports whether an artifact kind is present.
func (a Artifacts) Has(kind ArtifactKind) bool {
	switch kind {
	case ArtifactPRD:
		return a.PRD
	case ArtifactTechSpec:
		return a.TechSpec
	case ArtifactPlan:
		return a.Plan.Present
	case ArtifactPR:
		return len(a.PR) > 0
	default:
		return false
	}
}

// Change is one artifact that changed on disk.
type Change struct {
	Kind  ArtifactKind
	First bool // the artifact appeared (or the plan became valid) with this change
}
