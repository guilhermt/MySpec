// The views a draft of a discussion draws: the feature's rules produce them, the system only draws.

/** DraftStateView is what a draft says of where it stands, open and folded. */
export interface DraftStateView {
  /** open is what the open draft says next to the decision; null when the gesture line says it. */
  open: string | null;
  /** folded is what the folded draft says on the right. */
  folded: string;
  glyph: "hold" | "check" | "error" | "blocked" | "spinner" | null;
  /** strong draws the state in --ink-1 500: a hold the user takes a way out of. */
  strong: boolean;
  /** link is the issue of a draft on GitHub: "billing#479". */
  link: { label: string; url: string } | null;
  /** time is the time of the publication: 15:10 today, Sep 23 before. */
  time: string;
  /** wayBack is "To take it back, close billing#479 on GitHub."; "" otherwise. */
  wayBack: string;
  /** created is the issue of a draft started before its failure, drawn above the failure; null otherwise. */
  created: { label: string; url: string } | null;
}

/** DependencyView is one dependency of the open draft, by its title. */
export interface DependencyView {
  title: string;
  /** draft is a draft of the current round, opened in the card; null for an issue. */
  draft: string | null;
  /** url opens the issue: a draft of a closed round on GitHub, or a card of the board. */
  url: string;
  /** linked is a dependency recorded on GitHub: the tooltip says so. */
  linked: boolean;
}

/** GestureLineView is the line that says what Approve and Discard publish now. */
export interface GestureLineView {
  icon: "chain" | "hourglass" | "blocked";
  /** segments are the text, with Approve and Discard strong. */
  segments: { text: string; strong: boolean }[];
  /** text is the whole line, the accessible description of Approve. */
  text: string;
}

/** DecisionView is what the decision of a draft allows. */
export interface DecisionView {
  /** shown is false for a started draft, which keeps only its state and the way out by GitHub. */
  shown: boolean;
  approveReason: string | null;
  discardReason: string | null;
  /** editReason disables Edit: "A publication is running"; null when it edits. */
  editReason: string | null;
}

/** DiffLine is one line of the change of the body of an update. */
export interface DiffLine {
  kind: "same" | "added" | "removed";
  text: string;
}
