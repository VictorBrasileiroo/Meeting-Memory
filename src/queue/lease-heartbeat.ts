import { JOB_LEASE_RENEW_INTERVAL_MS } from './job-policy';

export function startLeaseHeartbeat(
  renew: () => Promise<boolean>,
  intervalMs = JOB_LEASE_RENEW_INTERVAL_MS,
): { signal: AbortSignal; stop: (abort?: boolean) => Promise<void> } {
  const controller = new AbortController();
  let stopped = false;
  let inFlight: Promise<void> | null = null;
  const invalidate = () => { stopped = true; clearInterval(timer); controller.abort(); };
  const timer = setInterval(() => {
    if (stopped || inFlight) return;
    inFlight = renew().then((valid) => { if (!valid) invalidate(); })
      .catch(invalidate)
      .finally(() => { inFlight = null; });
  }, intervalMs);
  return {
    signal: controller.signal,
    stop: async (abort = false) => {
      stopped = true;
      clearInterval(timer);
      if (abort) controller.abort();
      await inFlight;
    },
  };
}
