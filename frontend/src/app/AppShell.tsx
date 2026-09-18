import { useViewedSituation } from "@/features/attention/useViewedSituation";
import { BoardView } from "@/features/board/BoardView";
import { usePendingStart } from "@/features/board/usePendingStart";
import { ArchivedTaskView } from "@/features/history/ArchivedTaskView";
import { HistoryPanel } from "@/features/history/HistoryPanel";
import { Home } from "@/features/home/Home";
import { ArchivedReviewView } from "@/features/reviews/ArchivedReviewView";
import { ReviewsView } from "@/features/reviews/ReviewsView";
import { ReviewView } from "@/features/reviews/ReviewView";
import { StartReviewDialog } from "@/features/reviews/StartReviewDialog";
import { usePendingReview } from "@/features/reviews/usePendingReview";
import { SettingsView } from "@/features/settings/SettingsView";
import { Sidebar } from "@/features/sidebar/Sidebar";
import { TaskView } from "@/features/task/TaskView";
import { NewTaskDialog } from "@/features/task-create/NewTaskDialog";
import { useAppStore, useOpenBoardId } from "@/store/app-store";

/** MainArea is the one screen the app is on: a task, a review, an archived one, the history, the settings, a board, or home. */
function MainArea() {
  const openTaskId = useAppStore((state) => state.openTaskId);
  const openReviewId = useAppStore((state) => state.openReviewId);
  const openArchivedId = useAppStore((state) => state.openArchivedId);
  const openArchivedReviewId = useAppStore((state) => state.openArchivedReviewId);
  const settingsOpen = useAppStore((state) => state.settingsOpen);
  const historyOpen = useAppStore((state) => state.historyOpen);
  const reviewsOpen = useAppStore((state) => state.reviewsOpen);
  const openBoardId = useOpenBoardId();

  if (openTaskId !== null) {
    return <TaskView taskId={openTaskId} />;
  }
  if (openReviewId !== null) {
    return <ReviewView reviewId={openReviewId} />;
  }
  if (openArchivedId !== null) {
    return <ArchivedTaskView taskId={openArchivedId} />;
  }
  if (openArchivedReviewId !== null) {
    return <ArchivedReviewView reviewId={openArchivedReviewId} />;
  }
  if (settingsOpen) {
    return <SettingsView />;
  }
  if (historyOpen) {
    return <HistoryPanel />;
  }
  if (reviewsOpen) {
    return <ReviewsView />;
  }
  return openBoardId !== null ? <BoardView boardId={openBoardId} /> : <Home />;
}

export function AppShell() {
  useViewedSituation();
  usePendingStart();
  usePendingReview();

  return (
    <div className="grid h-dvh grid-cols-[var(--sidebar-width)_minmax(0,1fr)]">
      <Sidebar />
      <MainArea />
      <NewTaskDialog />
      <StartReviewDialog />
    </div>
  );
}
