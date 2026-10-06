import { Markdown } from "@/features/chat/Markdown";
import { splitFrontMatter } from "@/lib/front-matter";

/** StepDocument shows a step file, without the metadata header it may carry. */
export function StepDocument({ content }: { content: string }) {
  const { body } = splitFrontMatter(content);

  return (
    <div className="flex max-w-(--measure-conversation) flex-col gap-(--space-2) select-text">
      <Markdown className="ui-headings">{body}</Markdown>
    </div>
  );
}
