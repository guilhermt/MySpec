import { Markdown } from "@/features/chat/Markdown";
import { splitFrontMatter } from "@/lib/front-matter";

/** StepDocument shows a step file with its header read as metadata. */
export function StepDocument({ content }: { content: string }) {
  const { fields, body } = splitFrontMatter(content);
  const repository = fields.repository ?? "";

  return (
    <div className="flex max-w-[760px] flex-col gap-2 select-text">
      {repository !== "" && (
        <p className="text-xs text-muted-foreground">
          Repository · <span className="font-mono">{repository}</span>
        </p>
      )}
      <Markdown>{body}</Markdown>
    </div>
  );
}
