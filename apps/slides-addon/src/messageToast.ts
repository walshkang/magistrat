/** Matches messages that should stay visible until the user dismisses (no auto-clear). */
export function messageLooksPersistent(message: string): boolean {
  return /failed|Failed|unavailable|not available|Error|Initialization failed/i.test(message);
}
