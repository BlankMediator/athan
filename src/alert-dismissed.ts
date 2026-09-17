/** An intentional dismissal is a terminal delivery outcome, not a playback failure. */
export class AlertDismissedError extends Error {
  constructor() { super('Dismissed by user'); this.name = 'AlertDismissedError'; }
}
