import { useViewedSituation } from "@/features/attention/useViewedSituation";
import { BoardView } from "@/features/board/BoardView";
import { usePendingStart } from "@/features/board/usePendingStart";
import { ArchivedDiscussionView } from "@/features/discussion/ArchivedDiscussionView";
import { DiscussionView } from "@/features/discussion/DiscussionView";
import { NewDiscussionDialog } from "@/features/discussion/NewDiscussionDialog";
import { ArchivedReview } from "@/features/history/ArchivedReview";
import { ArchivedTask } from "@/features/history/ArchivedTask";
import { HistoryPanel } from "@/features/history/HistoryPanel";
import { Home } from "@/features/home/Home";
import { GoneView } from "@/features/navigation/GoneView";
import { AppNotices } from "@/features/notice/AppNotices";
import { ShellToasts } from "@/features/notice/ShellToasts";
import { ReviewsView } from "@/features/reviews/ReviewsView";
import { ReviewView } from "@/features/reviews/ReviewView";
import { StartReviewDialog } from "@/features/reviews/StartReviewDialog";
import { usePendingReview } from "@/features/reviews/usePendingReview";
import { SettingsView } from "@/features/settings/SettingsView";
import { Sidebar } from "@/features/sidebar/Sidebar";
import { TaskView } from "@/features/task/TaskView";
import { NewTaskDialog } from "@/features/task-create/NewTaskDialog";
import { Welcome } from "@/features/welcome/Welcome";
import { cn } from "@/lib/utils";
import { useLocation, useSidebarRail, useWelcomeMode } from "@/store/app-store";

/** LocationView is the screen of the place on screen. */
function LocationView() {
  const location = useLocation();
  const welcome = useWelcomeMode();
  switch (location.kind) {
    case "home":
      return welcome ? <Welcome /> : <Home />;
    case "board":
      return <BoardView key={location.id} boardId={location.id} />;
    case "reviews":
      return <ReviewsView />;
    case "history":
      return <HistoryPanel />;
    case "settings":
      return <SettingsView />;
    case "task":
      return <TaskView key={location.id} taskId={location.id} />;
    case "review":
      return <ReviewView key={location.id} reviewId={location.id} />;
    case "discussion":
      return <DiscussionView key={location.id} discussionId={location.id} />;
    case "archived-task":
      return <ArchivedTask key={location.id} taskId={location.id} />;
    case "archived-review":
      return <ArchivedReview key={location.id} reviewId={location.id} />;
    case "archived-discussion":
      return <ArchivedDiscussionView key={location.id} discussionId={location.id} />;
    case "gone":
      return <GoneView key={`${location.item}:${location.id}`} location={location} />;
  }
}

export function AppShell() {
  useViewedSituation();
  usePendingStart();
  usePendingReview();
  const welcome = useWelcomeMode();
  const rail = useSidebarRail() && !welcome;

  return (
    <div
      className={cn(
        "grid h-dvh",
        rail
          ? "grid-cols-[var(--sidebar-collapsed)_minmax(0,1fr)]"
          : "grid-cols-[var(--sidebar-width)_minmax(0,1fr)]",
      )}
    >
      <Sidebar />
      <main className="main-area relative flex h-dvh min-w-0 flex-col">
        <AppNotices />
        <LocationView />
        <ShellToasts />
      </main>
      <NewTaskDialog />
      <StartReviewDialog />
      <NewDiscussionDialog />
    </div>
  );
}
