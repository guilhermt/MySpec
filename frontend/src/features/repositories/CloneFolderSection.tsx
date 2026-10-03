import { useState } from "react";
import { Button } from "@/components/system/Button";
import { SettingsBlock } from "@/features/settings/SettingsPage";
import { displayPath, displayPaths } from "@/lib/paths";
import { chooseCloneFolder } from "@/store/actions";
import { useAppStore } from "@/store/app-store";

const META = "text-(length:--text-meta) leading-(--leading-meta)";

/** CloneFolderSection is the folder the app clones repositories into, and the way to choose it. */
export function CloneFolderSection() {
  const cloneFolder = useAppStore((state) => state.app?.cloneFolder ?? "");
  const [failure, setFailure] = useState<string | null>(null);

  const choose = async () => {
    setFailure(await chooseCloneFolder());
  };

  return (
    <SettingsBlock
      title="Clone folder"
      sentence="Where Clone puts a repository that isn't on this machine"
    >
      <div className="flex flex-col gap-(--space-2)">
        <div className="flex items-center gap-(--space-3) rounded-md border border-line-1 px-(--space-3) py-(--space-2)">
          {cloneFolder === "" ? (
            <span className={`min-w-0 flex-1 text-ink-3 ${META}`}>
              Not chosen · you're asked the first time you clone
            </span>
          ) : (
            <span className={`min-w-0 flex-1 break-all font-mono text-ink-2 ${META}`}>
              {displayPath(cloneFolder)}
            </span>
          )}
          <Button variant="secondary" size="sm" onClick={() => void choose()}>
            Choose…
          </Button>
        </div>
        {failure !== null && (
          <p role="alert" className={`text-state-error ${META}`}>
            {displayPaths(failure)}
          </p>
        )}
      </div>
    </SettingsBlock>
  );
}
