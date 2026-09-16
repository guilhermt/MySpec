import { Button } from "@/components/ui/button";
import { chooseCloneFolder } from "@/store/actions";
import { useAppStore } from "@/store/app-store";

/** CloneFolderField is the folder the app clones repositories into, and the way to choose it. */
export function CloneFolderField() {
  const cloneFolder = useAppStore((state) => state.app?.cloneFolder ?? "");

  return (
    <div className="flex items-center gap-4 rounded-lg border px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-sm font-medium">Clone folder</span>
        {cloneFolder === "" ? (
          <span className="text-xs text-muted-foreground">Not chosen</span>
        ) : (
          <span className="break-all font-mono text-xs text-muted-foreground">{cloneFolder}</span>
        )}
      </div>
      <Button variant="outline" size="sm" onClick={() => void chooseCloneFolder()}>
        Choose…
      </Button>
    </div>
  );
}
