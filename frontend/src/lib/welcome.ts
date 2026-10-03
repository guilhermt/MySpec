import type { Location } from "@/lib/locations";
import type { State } from "@/lib/wails";

/** welcomeMode is the app with no board, no repository and no active item: the Home welcomes. */
export function welcomeMode(app: State | null): boolean {
  return (
    app !== null &&
    app.migration === null &&
    (app.repositories ?? []).length === 0 &&
    (app.boards ?? []).length === 0 &&
    (app.tasks ?? []).length === 0 &&
    (app.reviews ?? []).length === 0 &&
    (app.discussions ?? []).length === 0
  );
}

/** archivedAnything says History has something to open. */
export function archivedAnything(app: State): boolean {
  return (
    (app.history ?? []).length > 0 ||
    (app.reviewHistory ?? []).length > 0 ||
    (app.discussionHistory ?? []).length > 0
  );
}

/** allowedInWelcome is a place the welcome mode keeps: Home, Settings and, with something archived, History and the archived items. */
export function allowedInWelcome(app: State, location: Location): boolean {
  switch (location.kind) {
    case "home":
    case "settings":
      return true;
    case "history":
    case "archived-task":
    case "archived-review":
    case "archived-discussion":
      return archivedAnything(app);
    default:
      return false;
  }
}
