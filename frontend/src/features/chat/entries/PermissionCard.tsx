import { useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { asPermissionStatus, type PermissionEntry, type PermissionStatus } from "@/lib/wails";
import { answerPermission } from "@/store/actions";

const ANSWER_TEXT: Record<Exclude<PermissionStatus, "pending">, string> = {
  allowed: "Allowed",
  allowed_session: "Allowed for this session",
  denied: "Denied",
  cancelled: "Cancelled before an answer",
};

// The tools whose whole input is one path worth reading on its own.
const PATH_TOOLS = ["Write", "Edit", "Read"];

function parseInput(raw: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

// An empty suggestion list means the CLI offered no rule to remember, so there
// is nothing "for this session" could save.
function hasSuggestions(raw: string): boolean {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) && value.length > 0;
  } catch {
    return false;
  }
}

function stringField(input: Record<string, unknown>, name: string): string | null {
  const value = input[name];
  return typeof value === "string" ? value : null;
}

function Detail({ tool, input }: { tool: string; input: string }) {
  const parsed = parseInput(input);
  const command = stringField(parsed, "command");
  if (tool === "Bash" && command !== null) {
    return (
      <pre className="rounded-md bg-muted px-3 py-2 font-mono text-xs break-all whitespace-pre-wrap select-text">
        {command}
      </pre>
    );
  }
  const path = stringField(parsed, "file_path");
  if (PATH_TOOLS.includes(tool) && path !== null) {
    return <p className="font-mono text-xs break-all select-text">{path}</p>;
  }
  return (
    <pre className="max-h-48 overflow-auto rounded-md bg-muted px-3 py-2 font-mono text-xs select-text">
      {JSON.stringify(parsed, null, 2)}
    </pre>
  );
}

function answerText(status: Exclude<PermissionStatus, "pending">, message: string): string {
  return status === "denied" && message !== ""
    ? `${ANSWER_TEXT.denied} · ${message}`
    : ANSWER_TEXT[status];
}

export interface PermissionCardProps {
  taskId: string;
  permission: PermissionEntry;
}

/**
 * PermissionCard is the agent asking to use a tool. Nothing runs until the user
 * answers, so the card is the one thing in the conversation that blocks.
 */
export function PermissionCard({ taskId, permission }: PermissionCardProps) {
  const titleId = useId();
  const [denying, setDenying] = useState(false);
  const [message, setMessage] = useState("");

  const status = asPermissionStatus(permission.status);
  const pending = status === "pending";

  const answer = (decision: "allow" | "allow_session" | "deny", text: string) => {
    void answerPermission(taskId, permission.requestId, decision, text);
  };

  return (
    <fieldset
      aria-labelledby={titleId}
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-lg border border-l-4 border-l-[var(--status-attention)] bg-card p-4",
        !pending && "opacity-80",
      )}
    >
      <div className="flex items-center gap-2">
        <span id={titleId} className="font-medium">
          Permission needed
        </span>
        <Badge variant="outline" className="font-mono">
          {permission.displayName === "" ? permission.tool : permission.displayName}
        </Badge>
      </div>

      {permission.description !== "" && <p className="select-text">{permission.description}</p>}

      <Detail tool={permission.tool} input={permission.input} />

      {permission.decisionReason !== "" && (
        <p className="text-xs text-muted-foreground select-text">{permission.decisionReason}</p>
      )}
      {permission.blockedPath !== "" && (
        <p className="text-xs select-text">
          Outside the working directory: {permission.blockedPath}
        </p>
      )}

      {!pending && (
        <p className="text-xs text-muted-foreground">
          {answerText(status, permission.denyMessage)}
        </p>
      )}

      {pending && !denying && (
        <div className="flex flex-wrap items-center gap-2">
          <Button autoFocus={!permission.defaultToNo} onClick={() => answer("allow", "")}>
            Allow
          </Button>
          {!permission.suppressAlwaysAllow && hasSuggestions(permission.suggestions) && (
            <Button variant="outline" onClick={() => answer("allow_session", "")}>
              Allow for this session
            </Button>
          )}
          <Button variant="ghost" className="text-destructive" onClick={() => setDenying(true)}>
            Deny
          </Button>
        </div>
      )}

      {pending && denying && (
        <div className="flex flex-col gap-2">
          <Textarea
            autoFocus
            rows={2}
            value={message}
            aria-label="Tell the agent what to do instead (optional)"
            placeholder="Tell the agent what to do instead (optional)"
            className="max-h-40"
            onChange={(event) => setMessage(event.target.value)}
          />
          <div className="flex items-center gap-2">
            <Button variant="destructive" onClick={() => answer("deny", message.trim())}>
              Confirm deny
            </Button>
            <Button variant="ghost" onClick={() => setDenying(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </fieldset>
  );
}
