/** Keep both handlers installed until owned child-group cleanup has completed.
 * npm and a terminal can deliver the same interrupt more than once. A one-shot
 * listener would restore Node's default termination behavior during cleanup.
 */
export function installCancellationSignals(controller, onInterrupt = () => {}) {
  const cancel = () => {
    onInterrupt();
    if (!controller.signal.aborted) controller.abort(new Error('Startup canceled.'));
  };
  process.on('SIGINT', cancel);
  process.on('SIGTERM', cancel);
  return () => {
    process.removeListener('SIGINT', cancel);
    process.removeListener('SIGTERM', cancel);
  };
}
