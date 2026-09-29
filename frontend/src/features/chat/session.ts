/**
 * SessionState is what the conversation needs to know about the session behind
 * it. A task carries one of these and so does a repository of the PR stage,
 * which is why the chat takes the shape rather than the whole record.
 */
export interface SessionState {
  sessionStatus: string;
  /** sessionModel and sessionEffort are what the session runs with from its next message on; "" without a session. */
  sessionModel: string;
  sessionEffort: string;
  turnRunning: boolean;
  processRunning: boolean;
  retryAttempt: number;
  /** retryMax, retryAt (RFC 3339) and retryReason go with retryAttempt; zero without a retry. */
  retryMax: number;
  retryAt: string;
  retryReason: string;
  /** turnStartedAt is when the turn in progress started, RFC 3339; "" without a turn. */
  turnStartedAt: string;
  /** lastError is the error that stopped the session; "" when it runs. */
  lastError: string;
  /** turnFailed is the last turn ending in an error the session survived. */
  turnFailed: boolean;
  /** pausedAt is when the session was paused, RFC 3339; "" when it is not, or the time is unknown. */
  pausedAt: string;
}

/**
 * IDLE_SESSION is a session that does nothing: the one behind an earlier conversation, which is
 * read and never talks again.
 */
export const IDLE_SESSION: SessionState = {
  sessionStatus: "waiting",
  sessionModel: "",
  sessionEffort: "",
  turnRunning: false,
  processRunning: false,
  retryAttempt: 0,
  retryMax: 0,
  retryAt: "",
  retryReason: "",
  turnStartedAt: "",
  lastError: "",
  turnFailed: false,
  pausedAt: "",
};
