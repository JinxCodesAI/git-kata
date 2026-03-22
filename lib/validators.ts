const USER_ID_REGEX = /^[a-zA-Z0-9_-]{1,100}$/;
const SESSION_ID_REGEX = /^session-[a-zA-Z0-9_-]+$/;

export function validateUserId(userId: unknown): userId is string {
  return typeof userId === 'string' && USER_ID_REGEX.test(userId);
}

export function validateSessionId(sessionId: unknown): sessionId is string {
  return typeof sessionId === 'string' && SESSION_ID_REGEX.test(sessionId);
}