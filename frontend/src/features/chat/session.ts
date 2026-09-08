/**
 * SessionState is what the conversation needs to know about the session behind
 * it. A task carries one of these and so does a repository of the PR stage,
 * which is why the chat takes the shape rather than the whole record.
 */
export interface SessionState {
  sessionStatus: string;
  turnRunning: boolean;
  processRunning: boolean;
  retryAttempt: number;
}
