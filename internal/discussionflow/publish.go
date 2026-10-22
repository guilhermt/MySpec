package discussionflow

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/guilhermt/myspec/internal/board"
	"github.com/guilhermt/myspec/internal/discussion"
	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/images"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
)

// publishTimeout bounds a run that writes on GitHub. The run has a goroutine of
// its own, so it outlives the evaluation that started it.
const publishTimeout = 10 * time.Minute

// The sentences a draft says about a publication that could not go on.
const (
	msgNoReading         = "The board hasn't been read yet."
	msgNoCard            = "The card this update rewrites is not one of the board."
	msgEpicNotPublished  = "The epic hasn't been published yet."
	msgNotManagedSuffix  = " is no longer managed by the board."
	msgNoRepositoryStart = "The repository "
	msgNoRepositoryEnd   = " doesn't exist or this account can't write to it."
	msgNotRecorded       = "Couldn't record the publication: "
)

// The sentences a draft says about the images of a publication.
const (
	msgOldGH             = "Publishing images needs GitHub CLI %s or newer, and this machine has %s. Update it the way you installed it, then retry."
	msgAttachNoWrite     = "Couldn't upload the image %s: this account can't write to %s."
	msgAttachNoWriteAll  = "Couldn't upload the images: this account can't write to %s."
	msgAttachRefused     = "GitHub refused the image %s: %s."
	msgAttachRateLimited = "Couldn't upload the image %s: GitHub's rate limit was reached. Try again in a few minutes."
	msgAttachNetwork     = "Couldn't upload the image %s: GitHub couldn't be reached."
	msgAttachOther       = "Couldn't upload the image %s: %s"
	msgAttachOtherAll    = "Couldn't upload the images: %s"
	msgImageMissing      = "The image %s isn't in this discussion."
	msgImageTooLarge     = "The image %s is over 10 MB, which GitHub doesn't take."
	msgNoIssueURL        = "Couldn't read the issue GitHub CLI created: "
	msgVersionUnreadable = "Couldn't read the version of GitHub CLI."
)

// publishDue writes on GitHub what the chain of a discussion lets go. It
// answers at once: the run goes on a goroutine of its own, so an evaluation
// never waits for GitHub.
func (s *Service) publishDue(stored discussion.Discussion) {
	if s.isClosed() {
		return
	}
	if len(s.chain(stored.ID).due()) == 0 {
		return
	}

	l := s.lockOf(stored.ID)

	s.mu.Lock()
	started := !l.publishing
	if started {
		l.publishing = true
	}
	s.mu.Unlock()

	if !started {
		return
	}
	s.notify(stored.ID)
	go s.publishRun(stored)
}

// chain is the chain of a discussion as the app knows its drafts, a
// publication only memory holds included: such a draft says so like any
// other failure, and no run takes it.
func (s *Service) chain(id string) chain {
	return chainOf(s.effectiveDrafts(id, s.discussions.Drafts(id)))
}

// runningSet are the drafts of a run by id, which is what the interface reads
// to say that this draft is the one being written.
func runningSet(targets []discussion.Draft) map[string]bool {
	running := make(map[string]bool, len(targets))
	for _, target := range targets {
		running[target.ID] = true
	}
	return running
}

// unrecordedDrafts are the publications of a discussion that only memory
// holds, by draft id.
func (s *Service) unrecordedDrafts(id string) map[string]unrecorded {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	return maps.Clone(l.unrecorded)
}

// hasUnrecorded reports whether memory holds a publication of a discussion
// that no write of the app could keep.
func (s *Service) hasUnrecorded(id string) bool {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	return len(l.unrecorded) > 0
}

// keepUnrecorded takes what GitHub did for a draft into memory, because no
// write of the app held it.
func (s *Service) keepUnrecorded(id, draftID string, entry unrecorded) {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	l.unrecorded[draftID] = entry
}

// dropUnrecorded forgets what memory held for a draft, once the store has it.
func (s *Service) dropUnrecorded(id, draftID string) {
	l := s.lockOf(id)

	s.mu.Lock()
	defer s.mu.Unlock()

	delete(l.unrecorded, draftID)
}

// orderTargets puts the drafts of a run in the order GitHub takes them: each
// one after the epic it belongs to and after the drafts it depends on, ties by
// position. A cycle between targets is broken by position, and says so.
func orderTargets(targets []discussion.Draft) (ordered []discussion.Draft, cycle bool) {
	left := slices.Clone(targets)
	slices.SortStableFunc(left, func(a, b discussion.Draft) int { return a.Position - b.Position })

	ordered = make([]discussion.Draft, 0, len(left))
	written := map[string]bool{}
	for len(left) > 0 {
		next := slices.IndexFunc(left, func(d discussion.Draft) bool { return comes(d, left, written) })
		if next < 0 {
			next, cycle = 0, true
		}
		written[left[next].ID] = true
		ordered = append(ordered, left[next])
		left = slices.Delete(left, next, next+1)
	}
	return ordered, cycle
}

// comes reports whether every draft of the run that has to be written before
// this one is already in the order.
func comes(draft discussion.Draft, left []discussion.Draft, written map[string]bool) bool {
	for _, before := range writtenFirst(draft) {
		if written[before] {
			continue
		}
		if slices.ContainsFunc(left, func(d discussion.Draft) bool { return d.ID == before }) {
			return false
		}
	}
	return true
}

// writtenFirst are the drafts a draft points at that GitHub needs first: the
// epic it belongs to and the drafts it depends on.
func writtenFirst(draft discussion.Draft) []string {
	var before []string
	if ref, ok := draft.EpicRef(); ok && ref.IsDraft() {
		before = append(before, ref.Draft)
	}
	for _, dependency := range draft.Dependencies {
		if dependency.IsDraft() && dependency.Dropped == discussion.DropNone {
			before = append(before, dependency.Draft)
		}
	}
	return before
}

// publishRun writes on GitHub what the discussion is due to write, one draft
// after the other, and leaves it with what it wrote. The drafts of the run are
// read here, with the publication of the discussion already this run's: a run
// that ended between the evaluation and this one wrote some of them. The
// context is its own: the evaluation that asked for the run is long over by
// the time GitHub answers.
func (s *Service) publishRun(stored discussion.Discussion) {
	ctx, cancel := context.WithTimeout(context.Background(), publishTimeout)
	defer cancel()

	c := s.chain(stored.ID)
	targets := c.due()
	if c.cycle {
		s.log.Warn("discussion drafts have a dependency cycle", "discussion", stored.ID)
	}

	l := s.lockOf(stored.ID)

	s.mu.Lock()
	l.running = runningSet(targets)
	s.mu.Unlock()

	p := s.publicationOf(stored)
	p.write(ctx, targets)

	s.mu.Lock()
	l.publishing, l.running = false, nil
	s.mu.Unlock()

	if p.wrote {
		s.boards.Refresh(stored.BoardID)
	}
	s.notify(stored.ID)
	// What waited for one of these drafts may be able to go now.
	s.Check(stored.ID)
}

// publication is one run that writes on GitHub: the board it writes to, what it
// resolved once for every target, and the drafts as the run leaves them.
type publication struct {
	service *Service
	stored  discussion.Discussion
	board   board.Board
	reading *board.Reading
	managed []string                // owner/name of the repositories of the board
	repos   map[string]string       // owner/name in lower case: the node id
	issues  map[string]gh.IssueNode // task.IssueKey: the issue on GitHub
	drafts  []discussion.Draft      // as the run left them
	wrote   bool                    // something was written on GitHub

	attachChecked bool  // the version of gh was read this run
	attachErr     error // why this gh can't attach images; nil when it can
}

// publicationOf is the run of a discussion, with the board it writes cards for
// as it is now. The drafts are the ones the app knows, a publication only
// memory holds included, so what a target points at is as published for the
// run as it is for the interface.
func (s *Service) publicationOf(stored discussion.Discussion) *publication {
	p := &publication{
		service: s,
		stored:  stored,
		drafts:  s.effectiveDrafts(stored.ID, s.discussions.Drafts(stored.ID)),
		repos:   map[string]string{},
		issues:  map[string]gh.IssueNode{},
	}
	if b, ok := s.boards.Get(stored.BoardID); ok {
		p.board = b
		p.reading = s.boards.Stored(stored.BoardID).Reading
	}
	for _, repo := range s.boardRepositories(stored.BoardID) {
		p.managed = append(p.managed, repo.FullName())
	}
	return p
}

// write publishes the targets in order, and writes nothing when another run
// left none. A failure stops the run: the targets after it stay as they are,
// approved and with nothing to say, and the next run takes them.
func (p *publication) write(ctx context.Context, targets []discussion.Draft) {
	if len(targets) == 0 {
		return
	}
	if err := p.lookup(ctx, targets); err != nil {
		p.fail(ctx, targets[0], err)
		return
	}
	for i := range targets {
		if err := p.publish(ctx, &targets[i]); err != nil {
			p.fail(ctx, targets[i], err)
			return
		}
	}
}

// lookup reads from GitHub, once for the whole run, the node ids every write
// needs: the repositories the issues are created in and the issues the drafts
// point at.
func (p *publication) lookup(ctx context.Context, targets []discussion.Draft) error {
	var (
		repos []string
		refs  []gh.IssueRef
	)
	for _, target := range targets {
		if target.Kind != discussion.KindUpdate {
			repos = appendOnce(repos, target.FullName())
		}
		for _, ref := range issueRefsOf(target) {
			if !slices.Contains(refs, ref) {
				refs = append(refs, ref)
			}
		}
	}

	if len(repos) > 0 {
		found, err := p.service.gh.LookupRepositories(ctx, repos)
		if err != nil {
			return newStepError(publishError(err, "", onIssue))
		}
		for fullName, id := range found {
			p.repos[strings.ToLower(fullName)] = id
		}
	}
	if len(refs) > 0 {
		found, err := p.service.gh.LookupIssues(ctx, refs)
		if err != nil {
			return newStepError(publishError(err, "", onIssue))
		}
		for ref, node := range found {
			p.issues[task.IssueKey(ref.Owner, ref.Name, ref.Number)] = node
		}
	}
	return nil
}

// issueRefsOf are the issues that exist a draft points at: the card an update
// rewrites, the epic it belongs to and the cards it depends on.
func issueRefsOf(target discussion.Draft) []gh.IssueRef {
	var refs []gh.IssueRef
	if target.Kind == discussion.KindUpdate && target.Card != nil {
		refs = append(refs, gh.IssueRef{Owner: target.Card.Owner, Name: target.Card.Name, Number: target.Card.Number})
	}
	if ref, ok := target.EpicRef(); ok && !ref.IsDraft() {
		refs = append(refs, gh.IssueRef{Owner: ref.Owner, Name: ref.Name, Number: ref.Number})
	}
	for _, dependency := range target.Dependencies {
		if dependency.IsDraft() || dependency.Linked || dependency.Dropped != discussion.DropNone {
			continue
		}
		refs = append(refs, gh.IssueRef{Owner: dependency.Owner, Name: dependency.Name, Number: dependency.Number})
	}
	return refs
}

// publish writes one draft on GitHub, step by step, skipping what an earlier
// run already wrote.
func (p *publication) publish(ctx context.Context, target *discussion.Draft) error {
	if err := p.resolved(*target); err != nil {
		return err
	}
	for _, step := range []func(context.Context, *discussion.Draft) error{
		p.issue, p.node, p.images, p.item, p.status, p.module, p.parent, p.dependencies,
	} {
		if err := step(ctx, target); err != nil {
			return err
		}
	}
	return p.done(ctx, target)
}

// resolved reports what the draft needs and GitHub or the board no longer has,
// before anything is written for it.
func (p *publication) resolved(target discussion.Draft) error {
	if !p.manages(target.FullName()) {
		return newStepError(target.FullName() + msgNotManagedSuffix)
	}
	if p.projectID() == "" {
		return newStepError(msgNoReading)
	}
	if target.Kind == discussion.KindUpdate {
		if target.Card == nil {
			return newStepError(msgNoCard)
		}
		if _, ok := p.issues[target.Card.Key()]; !ok {
			return newStepError(missingIssue(target.Card.Reference()))
		}
	}
	if ref, ok := target.EpicRef(); ok && !ref.IsDraft() {
		if _, found := p.issues[ref.Key()]; !found {
			return newStepError(missingIssue(ref.String()))
		}
	}
	for _, dependency := range target.Dependencies {
		if dependency.IsDraft() || dependency.Linked || dependency.Dropped != discussion.DropNone {
			continue
		}
		if _, ok := p.issues[dependency.Key()]; !ok {
			return newStepError(missingIssue(dependency.String()))
		}
	}
	return nil
}

// issue creates the issue of a new card or of an epic, or rewrites the card an
// update points at. A draft with images to upload goes through gh, which
// attaches them; any other goes through the GraphQL API.
func (p *publication) issue(ctx context.Context, target *discussion.Draft) error {
	if target.Published.Started() {
		return nil
	}
	imgs := p.stored.DraftImages(target.Body)
	if err := imagesProblem(imgs); err != nil {
		return err
	}
	uploads := discussion.Uploads(imgs)
	if len(uploads) == 0 {
		if target.Kind == discussion.KindUpdate {
			return p.updateIssue(ctx, target)
		}
		return p.createIssue(ctx, target)
	}
	if err := p.attachReady(ctx); err != nil {
		return err
	}
	if target.Kind == discussion.KindUpdate {
		return p.updateAttached(ctx, target, imgs, uploads)
	}
	return p.createAttached(ctx, target, imgs, uploads)
}

// attachReady says whether the gh of this machine can attach images, reading
// its version once per run.
func (p *publication) attachReady(ctx context.Context) error {
	if !p.attachChecked {
		p.attachChecked = true
		v, err := p.service.gh.Version(ctx)
		switch {
		case err != nil:
			p.attachErr = newStepError(publishError(err, "", onIssue))
		case v.Less(gh.MinAttachVersion):
			p.attachErr = newStepError(fmt.Sprintf(msgOldGH, gh.MinAttachVersion, v))
		}
	}
	return p.attachErr
}

// imagesProblem is the first image of a body GitHub can't take. The approval
// keeps a draft with one from being published, so this only defends.
func imagesProblem(imgs []discussion.BodyImage) error {
	for _, img := range imgs {
		switch img.Problem {
		case discussion.ImageMissing:
			return newStepError(fmt.Sprintf(msgImageMissing, discussion.ImageName(img)))
		case discussion.ImageTooLarge:
			return newStepError(fmt.Sprintf(msgImageTooLarge, discussion.ImageName(img)))
		case discussion.ImageOK:
		}
	}
	return nil
}

// files are the images to attach as gh takes them, once each and in order.
func files(uploads []discussion.BodyImage) []string {
	var refs []string
	for _, u := range uploads {
		refs = appendOnce(refs, images.Ref(u.Image))
	}
	return refs
}

// attachMessage is what the user reads about an issue write with attachments
// that failed.
func (p *publication) attachMessage(err error, repo string, imgs []discussion.BodyImage) string {
	var attach *gh.AttachError
	if !errors.As(err, &attach) {
		return publishError(err, repo, onIssue)
	}
	name := ""
	if attach.Path != "" {
		path := strings.TrimPrefix(attach.Path, "./")
		name = strconv.Quote(attach.Path)
		if i := slices.IndexFunc(imgs, func(img discussion.BodyImage) bool {
			return img.Image.ID != "" && images.Ref(img.Image) == path
		}); i >= 0 {
			name = discussion.ImageName(imgs[i])
		}
	}
	switch attach.Failure {
	case gh.AttachNoWrite:
		if name == "" {
			return fmt.Sprintf(msgAttachNoWriteAll, repo)
		}
		return fmt.Sprintf(msgAttachNoWrite, name, repo)
	case gh.AttachRefused:
		return fmt.Sprintf(msgAttachRefused, name, attach.Detail)
	case gh.AttachRateLimited:
		return fmt.Sprintf(msgAttachRateLimited, name)
	case gh.AttachNetwork:
		return fmt.Sprintf(msgAttachNetwork, name)
	case gh.AttachOther:
		if name == "" {
			return fmt.Sprintf(msgAttachOtherAll, attach.Detail)
		}
		return fmt.Sprintf(msgAttachOther, name, attach.Detail)
	}
	return publishError(err, repo, onIssue)
}

// createIssue opens the issue of a draft in the repository it names.
func (p *publication) createIssue(ctx context.Context, target *discussion.Draft) error {
	repositoryID, ok := p.repos[strings.ToLower(target.FullName())]
	if !ok {
		return newStepError(msgNoRepositoryStart + target.FullName() + msgNoRepositoryEnd)
	}
	node, err := p.service.gh.CreateIssue(ctx, repositoryID, target.Title, target.Body)
	if err != nil {
		return newStepError(publishError(err, target.FullName(), onIssue))
	}
	p.wrote = true
	return p.record(ctx, target, func(d *discussion.Draft) {
		d.Published.Outcome = discussion.OutcomeCreated
		d.Published.Number = node.Number
		d.Published.URL = node.URL
		d.Published.NodeID = node.ID
	})
}

// updateIssue rewrites the card an update points at with the text the user
// left.
func (p *publication) updateIssue(ctx context.Context, target *discussion.Draft) error {
	card := *target.Card
	node := p.issues[card.Key()]
	if err := p.service.gh.UpdateIssue(ctx, node.ID, target.Title, target.Body); err != nil {
		return newStepError(publishError(err, card.Reference(), onIssue))
	}
	p.wrote = true
	return p.record(ctx, target, func(d *discussion.Draft) {
		d.Published.Outcome = discussion.OutcomeUpdated
		d.Published.Number = card.Number
		d.Published.URL = card.URL
		d.Published.NodeID = node.ID
	})
}

// createAttached opens the issue of a draft with gh, which uploads the images
// the body references. gh stops at the first image it can't upload, and writes
// the issue anyway when at least one went up: the publication keeps it, with
// the images still to upload.
func (p *publication) createAttached(ctx context.Context, target *discussion.Draft,
	imgs, uploads []discussion.BodyImage,
) error {
	if _, ok := p.repos[strings.ToLower(target.FullName())]; !ok {
		return newStepError(msgNoRepositoryStart + target.FullName() + msgNoRepositoryEnd)
	}
	all := files(uploads)
	first := all[:min(len(all), gh.MaxAttachments)]
	url, err := p.service.gh.CreateIssueAttached(ctx, p.stored.ArtifactsDir,
		target.FullName(), target.Title, target.Body, first)

	var attach *gh.AttachError
	written := err == nil
	if errors.As(err, &attach) && attach.Written {
		written, url = true, attach.URL
	}
	if !written {
		if strings.Contains(err.Error(), "printed no issue url") {
			return newStepError(msgNoIssueURL + err.Error())
		}
		return newStepError(p.attachMessage(err, target.FullName(), imgs))
	}

	p.wrote = true
	number := gh.IssueNumber(url)
	pending := err != nil || len(all) > len(first)
	if recErr := p.record(ctx, target, func(d *discussion.Draft) {
		d.Published.Outcome = discussion.OutcomeCreated
		d.Published.Number = number
		d.Published.URL = url
		d.Published.ImagesPending = pending
	}); recErr != nil {
		return recErr
	}
	if err != nil {
		return newStepError(p.attachMessage(err, target.FullName(), imgs))
	}
	p.service.log.Info("discussion draft images attached", "discussion", p.stored.ID,
		"draft", target.ID, "issue", target.Reference(), "images", len(first))
	return nil
}

// updateAttached rewrites the card an update points at with gh, which uploads
// the images the body references, as createAttached does.
func (p *publication) updateAttached(ctx context.Context, target *discussion.Draft,
	imgs, uploads []discussion.BodyImage,
) error {
	card := *target.Card
	node := p.issues[card.Key()]
	all := files(uploads)
	first := all[:min(len(all), gh.MaxAttachments)]
	err := p.service.gh.EditIssueAttached(ctx, p.stored.ArtifactsDir,
		card.Owner+"/"+card.Name, card.Number, target.Title, target.Body, first)

	var attach *gh.AttachError
	written := err == nil || (errors.As(err, &attach) && attach.Written)
	if !written {
		return newStepError(p.attachMessage(err, card.Reference(), imgs))
	}

	p.wrote = true
	pending := err != nil || len(all) > len(first)
	if recErr := p.record(ctx, target, func(d *discussion.Draft) {
		d.Published.Outcome = discussion.OutcomeUpdated
		d.Published.Number = card.Number
		d.Published.URL = card.URL
		d.Published.NodeID = node.ID
		d.Published.ImagesPending = pending
	}); recErr != nil {
		return recErr
	}
	if err != nil {
		return newStepError(p.attachMessage(err, card.Reference(), imgs))
	}
	p.service.log.Info("discussion draft images attached", "discussion", p.stored.ID,
		"draft", target.ID, "issue", target.Reference(), "images", len(first))
	return nil
}

// node reads the node id of an issue gh created, which gh doesn't print.
func (p *publication) node(ctx context.Context, target *discussion.Draft) error {
	if !target.Published.Started() || target.Published.NodeID != "" {
		return nil
	}
	ref := gh.IssueRef{Owner: target.Owner, Name: target.Name, Number: target.Published.Number}
	found, err := p.service.gh.LookupIssues(ctx, []gh.IssueRef{ref})
	if err != nil {
		return newStepError(publishError(err, target.Reference(), onIssue))
	}
	issue, ok := found[ref]
	if !ok {
		return newStepError(missingIssue(target.Reference()))
	}
	return p.record(ctx, target, func(d *discussion.Draft) { d.Published.NodeID = issue.ID })
}

// images uploads the images an issue still lacks. It reads the body GitHub has,
// where the images that went up already are links and the rest are still
// references, and attaches those.
func (p *publication) images(ctx context.Context, target *discussion.Draft) error {
	for target.Published.ImagesPending {
		body, err := p.service.gh.IssueBody(ctx, target.Published.NodeID)
		if err != nil {
			return newStepError(publishError(err, target.Reference(), onIssue))
		}
		imgs := p.stored.DraftImages(body)
		all := files(discussion.Uploads(imgs))
		if len(all) == 0 {
			return p.record(ctx, target, func(d *discussion.Draft) { d.Published.ImagesPending = false })
		}
		if ready := p.attachReady(ctx); ready != nil {
			return ready
		}
		first := all[:min(len(all), gh.MaxAttachments)]
		err = p.service.gh.EditIssueAttached(ctx, p.stored.ArtifactsDir, target.FullName(),
			target.Published.Number, "", body, first)
		if err != nil {
			var attach *gh.AttachError
			if errors.As(err, &attach) && attach.Written {
				p.wrote = true
			}
			return newStepError(p.attachMessage(err, target.FullName(), imgs))
		}
		p.wrote = true
		if len(all) == len(first) {
			return p.record(ctx, target, func(d *discussion.Draft) { d.Published.ImagesPending = false })
		}
	}
	return nil
}

// item puts the issue on the board, which is where the discussion sends it.
func (p *publication) item(ctx context.Context, target *discussion.Draft) error {
	if target.Published.ItemID != "" {
		return nil
	}
	itemID, err := p.service.gh.AddProjectItem(ctx, p.projectID(), target.Published.NodeID)
	if err != nil {
		return newStepError(publishError(err, target.Reference(), onBoard))
	}
	p.wrote = true
	return p.record(ctx, target, func(d *discussion.Draft) { d.Published.ItemID = itemID })
}

// status gives a card the discussion created the status the board opens new
// cards in. A board without one, or one whose option is gone, leaves the card
// where GitHub put it.
func (p *publication) status(ctx context.Context, target *discussion.Draft) error {
	if target.Published.Outcome != discussion.OutcomeCreated || target.Published.StatusSet {
		return nil
	}
	if p.reading == nil || p.reading.StatusFieldID == "" || p.board.NewCardStatus == "" {
		return nil
	}
	if _, ok := p.reading.StatusOption(p.board.NewCardStatus); !ok {
		return nil
	}
	err := p.service.gh.SetProjectSingleSelect(ctx, p.projectID(), target.Published.ItemID,
		p.reading.StatusFieldID, p.board.NewCardStatus)
	if err != nil {
		return newStepError(publishError(err, target.Reference(), onBoard))
	}
	p.wrote = true
	return p.record(ctx, target, func(d *discussion.Draft) { d.Published.StatusSet = true })
}

// module fills the module field of a card with the option the draft names. An
// option the board no longer has is a warning: the card is there either way.
func (p *publication) module(ctx context.Context, target *discussion.Draft) error {
	if !target.IsCard() || target.Module == "" || target.Published.ModuleSet {
		return nil
	}
	if p.reading == nil || p.reading.Module == nil {
		return nil
	}
	optionID, ok := p.reading.ModuleOptionID(target.Module)
	if !ok {
		// The module of this card is settled: nothing more will ever be set
		// for it, so the warning is said once and a later run skips the step.
		return p.record(ctx, target, func(d *discussion.Draft) {
			d.Published.ModuleSet = true
			d.Warnings = append(d.Warnings, "The module "+target.Module+" is no longer an option of the board.")
		})
	}
	err := p.service.gh.SetProjectSingleSelect(ctx, p.projectID(), target.Published.ItemID,
		p.reading.Module.ID, optionID)
	if err != nil {
		return newStepError(publishError(err, target.Reference(), onBoard))
	}
	p.wrote = true
	return p.record(ctx, target, func(d *discussion.Draft) { d.Published.ModuleSet = true })
}

// parent puts a card under the epic it belongs to: an epic of the discussion,
// published just before it, or an issue that already exists.
func (p *publication) parent(ctx context.Context, target *discussion.Draft) error {
	if !target.IsCard() || target.Published.ParentSet {
		return nil
	}
	ref, ok := target.EpicRef()
	if !ok {
		return nil
	}
	var parentID string
	if ref.IsDraft() {
		// The first step of a publication records NodeID and the last one At,
		// so the epic names the issue GitHub created for it from the moment it
		// exists, whether the publication of the epic got to the end or not.
		epic, found := draftOf(p.drafts, ref.Draft)
		if !found || epic.Published.NodeID == "" {
			return newStepError(msgEpicNotPublished)
		}
		parentID = epic.Published.NodeID
	} else {
		parentID = p.issues[ref.Key()].ID
	}

	if err := p.service.gh.AddSubIssue(ctx, parentID, target.Published.NodeID); err != nil {
		return newStepError(publishError(err, ref.String(), onIssue))
	}
	p.wrote = true
	return p.record(ctx, target, func(d *discussion.Draft) { d.Published.ParentSet = true })
}

// dependencies tells GitHub what a card can only start after. A dependency
// that cannot be recorded is dropped with a warning: the card itself is
// published either way.
func (p *publication) dependencies(ctx context.Context, target *discussion.Draft) error {
	for i := range target.Dependencies {
		if target.Dependencies[i].Linked || target.Dependencies[i].Dropped != discussion.DropNone {
			continue
		}
		if err := p.dependency(ctx, target, i); err != nil {
			return err
		}
	}
	return nil
}

// dependency records one blocked-by relation of a card.
func (p *publication) dependency(ctx context.Context, target *discussion.Draft, i int) error {
	dependency := target.Dependencies[i]
	var (
		blockingID string
		on         discussion.Draft
		found      bool
	)
	if dependency.IsDraft() {
		on, found = draftOf(p.drafts, dependency.Draft)
		if !found || on.Decision == discussion.DecisionDiscarded {
			return p.drop(ctx, target, i, discussion.DropDiscarded, "",
				"The dependency on "+dependencyName(dependency, on, found)+" was discarded and dropped.")
		}
		if !on.Published.Done() {
			// The relation belongs to this card, and the draft it points at
			// has no issue yet: the order of the run put them the other way
			// round because they depend on each other.
			detail := titleOf(on) + " is published after this card: the cards depend on each other."
			return p.drop(ctx, target, i, discussion.DropUnavailable, detail,
				"Couldn't record the dependency on "+dependencyName(dependency, on, found)+": "+detail)
		}
		blockingID = on.Published.NodeID
	} else {
		blockingID = p.issues[dependency.Key()].ID
	}

	if err := p.service.gh.AddBlockedBy(ctx, target.Published.NodeID, blockingID); err != nil {
		detail := publishError(err, dependency.String(), onIssue)
		return p.drop(ctx, target, i, discussion.DropUnavailable, detail,
			"Couldn't record the dependency on "+dependencyName(dependency, on, found)+": "+detail)
	}
	p.wrote = true
	return p.record(ctx, target, func(d *discussion.Draft) { d.Dependencies[i].Linked = true })
}

// done closes the publication of a draft: every step of it is written.
func (p *publication) done(ctx context.Context, target *discussion.Draft) error {
	at := p.service.now().UTC()
	err := p.record(ctx, target, func(d *discussion.Draft) {
		d.Published.At = at
		d.PublishError = ""
	})
	if err != nil {
		return err
	}
	p.markRound(ctx, target)
	p.service.log.Info("discussion draft published", "discussion", p.stored.ID, "draft", target.ID,
		"outcome", string(target.Published.Outcome), "issue", target.Reference())
	return nil
}

// markRound records that the round of a draft has a publication: the first
// draft of the round that reached GitHub or failed writes the marker, and the
// session keeps it once.
func (p *publication) markRound(ctx context.Context, target *discussion.Draft) {
	p.service.sessions.MarkDiscussion(ctx, sessionKey(p.stored.ID), &session.MarkerEntry{
		Type: session.MarkerDraftsPublished, Round: target.Round,
	})
}

// drop takes a dependency out of the publication, saying why.
func (p *publication) drop(ctx context.Context, target *discussion.Draft, i int,
	dropped discussion.Drop, detail, warning string,
) error {
	return p.record(ctx, target, func(d *discussion.Draft) {
		d.Dependencies[i].Dropped = dropped
		d.Dependencies[i].Detail = detail
		d.Warnings = append(d.Warnings, warning)
	})
}

// record writes one step of the publication of a draft, so that a run that
// stops halfway is taken up where it left off. The step is what GitHub has
// whether the app wrote it down or not, so the run reads it that way: a write
// that failed stops the run right after.
func (p *publication) record(ctx context.Context, target *discussion.Draft,
	mutate func(*discussion.Draft),
) error {
	err := p.service.discussions.RecordPublication(ctx, p.stored.ID, target.ID, mutate)

	mutate(target)
	if i := slices.IndexFunc(p.drafts, func(d discussion.Draft) bool { return d.ID == target.ID }); i >= 0 {
		p.drafts[i] = *target
	}
	if err != nil {
		return &recordError{draftID: target.ID, err: err}
	}
	return nil
}

// fail records why the publication of a draft stopped, which is what the user
// retries from. A write that does not happen either leaves the publication in
// memory alone: the state answers with it, and Retry writes it down before
// sending the draft again. Closing the app before that loses it, and the next
// run publishes the draft a second time.
func (p *publication) fail(ctx context.Context, target discussion.Draft, err error) {
	p.markRound(ctx, &target)
	message := p.report(target, err)
	writeErr := p.recordFailure(ctx, target, err, message)
	if writeErr == nil {
		return
	}
	p.reportUnwritten(target, err, writeErr)
	p.service.keepUnrecorded(p.stored.ID, target.ID,
		unrecorded{Published: target.Published, Error: message})
}

// reportUnwritten says in the log which write of a failure did not hold: the
// one that keeps a step GitHub took, named by the issue it took it on, or the
// one that keeps the sentence alone of a step GitHub refused.
func (p *publication) reportUnwritten(target discussion.Draft, err, writeErr error) {
	var record *recordError
	if errors.As(err, &record) {
		p.service.log.Error("record discussion publication failed", "discussion", p.stored.ID,
			"draft", target.ID, "issue", target.Reference(), "error", writeErr)
		return
	}
	p.service.log.Error("record discussion publish error failed", "discussion", p.stored.ID,
		"draft", target.ID, "error", writeErr)
}

// recordFailure writes what the user retries from. A step GitHub took goes to
// the store with the message in one write, so that what GitHub already has is
// never lost to the failure of it: the retry takes the run up at the next
// step instead of creating the issue again.
func (p *publication) recordFailure(ctx context.Context, target discussion.Draft,
	err error, message string,
) error {
	var record *recordError
	if !errors.As(err, &record) {
		return p.service.discussions.SetPublishError(ctx, p.stored.ID, target.ID, message)
	}
	published := target.Published
	return p.service.discussions.RecordPublication(ctx, p.stored.ID, target.ID,
		func(d *discussion.Draft) {
			d.Published = published
			d.PublishError = message
		})
}

// report says in the log why the publication of a draft stopped and answers
// with the sentence the user reads about it: a step GitHub refused, or a step
// it took that the app could not write down.
func (p *publication) report(target discussion.Draft, err error) string {
	var step *stepError
	if errors.As(err, &step) {
		p.service.log.Error("publish discussion draft failed",
			"discussion", p.stored.ID, "draft", target.ID, "error", step.message)
		return step.message
	}

	// What the user reads is what the store said, without the step the app
	// names itself by.
	var record *recordError
	if errors.As(err, &record) {
		err = record.err
	}
	return msgNotRecorded + err.Error()
}

// manages reports whether the board still answers for the repository a draft
// writes in.
func (p *publication) manages(fullName string) bool {
	return slices.ContainsFunc(p.managed, func(managed string) bool {
		return strings.EqualFold(managed, fullName)
	})
}

// projectID is the board on GitHub; "" while it was never read.
func (p *publication) projectID() string {
	if p.reading == nil {
		return ""
	}
	return p.reading.ProjectID
}

// dependencyName is the draft a dependency points at, as the user reads it.
func dependencyName(dependency discussion.Dependency, on discussion.Draft, found bool) string {
	if !found {
		return dependency.String()
	}
	return titleOf(on)
}

// appendOnce adds a value to a list that keeps no duplicates.
func appendOnce(values []string, value string) []string {
	if slices.Contains(values, value) {
		return values
	}
	return append(values, value)
}

// stepError is a step of a publication that failed, with the sentence the user
// reads about it.
type stepError struct{ message string }

func (e *stepError) Error() string { return "discussionflow: " + e.message }

// newStepError is a failure of a publication the user is told about.
func newStepError(message string) error { return &stepError{message: message} }

// recordError is a step of a publication GitHub took and the app could not
// write down, which is what leaves a run with more on GitHub than in the
// store.
type recordError struct {
	draftID string
	err     error
}

func (e *recordError) Error() string {
	return "discussionflow: record the publication of draft " + e.draftID + ": " + e.err.Error()
}

func (e *recordError) Unwrap() error { return e.err }

// where says which call of gh failed: the scope it needs and the node it could
// not find are not the same for the board and for an issue.
type where int

// The calls a publication makes.
const (
	onIssue where = iota
	onBoard
)

// publishError is what the user reads about a call of gh that failed, with
// subject naming the issue the call was about.
func publishError(err error, subject string, w where) string {
	var (
		rateErr *gh.RateLimitError
		ghErr   *gh.Error
	)
	switch {
	case errors.Is(err, gh.ErrVersionUnreadable):
		return msgVersionUnreadable
	case errors.Is(err, gh.ErrNotFound):
		return "GitHub CLI was not found: gh isn't on the PATH."
	case errors.Is(err, gh.ErrNotAuthenticated):
		return "gh is not authenticated. Run gh auth login."
	case errors.Is(err, gh.ErrMissingScope) && w == onBoard:
		return "gh can't write to projects. Run gh auth refresh -s project."
	case errors.Is(err, gh.ErrMissingScope):
		return "gh can't write to this repository. Run gh auth refresh -s repo."
	case errors.Is(err, gh.ErrNoSuchNode) && w == onBoard:
		return "The board doesn't exist or this account can't write to it."
	case errors.Is(err, gh.ErrNoSuchNode):
		return missingIssue(subject)
	case errors.As(err, &rateErr):
		return "GitHub's rate limit was reached. It resets at " + rateErr.ResetAt.Local().Format("15:04") + "."
	case errors.As(err, &ghErr) && ghErr.Output != "":
		return "Couldn't write to GitHub: " + ghErr.Output
	default:
		return "Couldn't write to GitHub: " + err.Error()
	}
}

// missingIssue is what the user reads about an issue GitHub did not answer for.
func missingIssue(ref string) string {
	return "The issue " + ref + " doesn't exist or this account can't read it."
}
