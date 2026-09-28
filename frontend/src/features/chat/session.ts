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
};
