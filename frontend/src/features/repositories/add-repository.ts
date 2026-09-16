import type { RepositoryCandidate } from "@/lib/wails";

/** SCAN_DEPTH mirrors repository.ScanDepth: how many folders below the home folder the scan descends. */
export const SCAN_DEPTH = 6;

export const NO_CANDIDATES_TEXT = `No GitHub clones were found in your home folder, up to ${SCAN_DEPTH} folders deep.`;

export const SCANNING_TEXT = "Scanning your home folder…";

/** filterCandidates keeps the candidates whose name or path holds the query, ignoring case. */
export function filterCandidates(
  candidates: readonly RepositoryCandidate[],
  query: string,
): readonly RepositoryCandidate[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") {
    return candidates;
  }
  return candidates.filter(
    (candidate) =>
      candidate.fullName.toLowerCase().includes(needle) ||
      candidate.path.toLowerCase().includes(needle),
  );
}

/** addLabel is the confirm button of the dialog for the number of checked clones. */
export function addLabel(count: number): string {
  return count > 1 ? `Add ${count} repositories` : "Add repository";
}
