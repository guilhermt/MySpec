import type { Repository, RepositoryCandidate } from "@/lib/wails";

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

const byName = (a: RepositoryCandidate, b: RepositoryCandidate) =>
  a.fullName.toLowerCase().localeCompare(b.fullName.toLowerCase()) || a.path.localeCompare(b.path);

/** partition puts the clones still to register first, alphabetical, and the registered ones after. */
export function partition(candidates: readonly RepositoryCandidate[]): {
  available: RepositoryCandidate[];
  registered: RepositoryCandidate[];
} {
  return {
    available: candidates.filter((candidate) => !candidate.registered).sort(byName),
    registered: candidates.filter((candidate) => candidate.registered).sort(byName),
  };
}

/** linksAClone says a candidate whose repository is registered without a clone (case-insensitive owner/name). */
export function linksAClone(
  candidate: RepositoryCandidate,
  repositories: readonly Repository[],
): boolean {
  const name = candidate.fullName.toLowerCase();
  return repositories.some(
    (repository) => !repository.cloned && repository.fullName.toLowerCase() === name,
  );
}
