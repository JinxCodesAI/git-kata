interface RateLimitWindow {
  timestamps: number[];
}

const windows = new Map<string, RateLimitWindow>();

// Periodic cleanup of expired entries - uses lazy cleanup per-key in checkRateLimit
// to avoid race conditions with concurrent mutations
setInterval(() => {
  const now = Date.now();
  for (const [key, window] of windows.entries()) {
    // Use lazy cleanup: filter timestamps on next access, not here
    // This avoids race condition where cleanup interval and checkRateLimit
    // both mutate the same array concurrently
    const minValidTime = now - 120_000;
    const originalLength = window.timestamps.length;
    window.timestamps = window.timestamps.filter(t => t >= minValidTime);
    if (window.timestamps.length === 0) {
      windows.delete(key);
    }
  }
}, 60_000);

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  let window = windows.get(key);

  if (!window) {
    window = { timestamps: [] };
    windows.set(key, window);
  }

  // Lazy cleanup: remove expired timestamps before checking
  // This is safe because both the filter and push happen synchronously
  // in Node.js single-threaded context
  window.timestamps = window.timestamps.filter(t => now - t < windowMs);

  if (window.timestamps.length >= maxRequests) {
    const oldest = window.timestamps[0];
    return { allowed: false, retryAfterMs: windowMs - (now - oldest) };
  }

  window.timestamps.push(now);
  return { allowed: true, retryAfterMs: 0 };
}

// Endpoint-specific rate limit configurations
export const RATE_LIMITS = {
  sandboxCreate: { maxRequests: 5, windowMs: 60_000 },
  sandboxExec: { maxRequests: 120, windowMs: 60_000 },
  attempt: { maxRequests: 5, windowMs: 60_000 },
  leaderboard: { maxRequests: 30, windowMs: 60_000 },
} as const;