import type { OlderKey } from "@/store/app-store";

/** olderKey names the list of the History beyond the window for a query and a repository. */
export function olderKey(query: string, repositoryId: string): OlderKey {
  return `${repositoryId}\u0000${query.trim().toLowerCase()}`;
}
