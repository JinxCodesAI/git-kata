# Discrepancy Report

## Summary
16 discrepancies found (7 Critical, 5 Medium, 4 Minor)

---

## Critical Issues (Block Release)

### 1. No LLM Retry Logic (LL-05)
- **Location**: `/lib/minimax.ts:16-72`
- **Expected**: Must retry LLM API up to 3 times on failure; after retry limit exhausted, return 500 error
- **Actual**: Single API call with no retry mechanism. Throws error immediately on failure (line 50).
- **Impact**: LLM evaluation will fail permanently on temporary issues (network blips, rate limits). Users must refresh and resubmit.

---

### 2. Session-User Ownership Not Validated (Section 8.2)
- **Location**: `/app/api/attempt/route.ts`
- **Expected**: userId in request must match the userId who owns the session (403 error if mismatch)
- **Actual**: No validation. The code retrieves the session (line 21) but never checks if `session.userId === userId`
- **Impact**: Users can submit attempts for other users' sessions. Security vulnerability.

---

### 3. handleSubmitSolution Doesn't Check Response Status (Global Error Handling 8.4)
- **Location**: `/app/challenge/[id]/page.tsx:273-305` (specifically lines 291-294)
- **Expected**: Check `res.ok`, display Error Modal on 4xx/5xx, do NOT continue operation
- **Actual**:
  ```typescript
  const data = await res.json();
  setFeedback(data);  // Sets feedback regardless of res.ok
  setShowFeedback(true);
  ```
  The code parses JSON and displays it as a feedback result even if the server returned 400/403/404/500.
- **Impact**: Error responses (like "Unauthorized" or "Session not found") will be displayed as if they were successful LLM evaluation results.

---

### 4. handleResetExercise Doesn't Check DELETE Response
- **Location**: `/app/challenge/[id]/page.tsx:313`
- **Expected**: Check response status before proceeding
- **Actual**:
  ```typescript
  await fetch(`/api/sandbox/${session.sessionId}`, { method: 'DELETE' });
  // No status check - continues even if DELETE fails
  const userId = localStorage.getItem('gitkata_user_id');
  const sandboxRes = await fetch('/api/sandbox/create', {...});
  ```
- **Impact**: If DELETE fails, old session container remains but new one is created. Resources leaked, user has multiple sessions.

---

### 5. Leaderboard Page Silently Swallows Errors (Global Error Handling 8.4)
- **Location**: `/app/leaderboard/page.tsx:20-38`
- **Expected**: Display Error Modal on 4xx/5xx
- **Actual**:
  ```typescript
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return { entries: [], totalParticipants: 0 };  // Returns empty data
  }
  ```
  User sees "No leaderboard data available" instead of an error message.
- **Impact**: User is unaware there was a failure and might think no one has completed exercises yet.

---

### 6. Leaderboard Fetch Doesn't Check response.ok
- **Location**: `/app/leaderboard/page.tsx:20-38`
- **Expected**: Check `response.ok` before parsing JSON
- **Actual**:
  ```typescript
  const response = await fetch(`/api/leaderboard?limit=${limit}&offset=${offset}`);
  // NO response.ok check - assumes all responses are OK
  return response.json();
  ```
- **Impact**: HTTP errors (4xx/5xx) are silently treated as success, returning empty data.

---

### 7. Profile Page Silently Fails on Error (Global Error Handling 8.4)
- **Location**: `/app/profile/page.tsx`
- **Expected**: Display Error Modal on 4xx/5xx
- **Actual**:
  ```typescript
  if (!response.ok) {
    throw new Error('Failed to fetch profile');
  }
  // Error is thrown but caught and displayed as plain text, not ErrorModal
  ```
- **Impact**: User sees raw error text instead of proper Error Modal.

---

## Medium Issues

### 8. Profile Page Doesn't Use ErrorModal (Global Error Handling 8.4)
- **Location**: `/app/profile/page.tsx:59-76` and lines 108-136
- **Expected**: Display Error Modal on errors
- **Actual**: Error is stored in state and displayed as plain red text in terminal area. Does not use the `ErrorModal` component.
- **Impact**: Inconsistent error handling. User sees raw error instead of proper modal.

---

### 9. No Timeout on LLM API Call (LL-06)
- **Location**: `/lib/minimax.ts:19-47`
- **Expected**: Backend should wait until LLM request completes or fails; UI should show waiting indicator
- **Actual**: No `AbortSignal` or timeout on the fetch call to MiniMax API. Could hang indefinitely.
- **Impact**: If MiniMax API is unresponsive, the request will hang forever, leaving user waiting with "Submitting..." button.

---

### 10. handleSubmitSolution Loading State is Insufficient (LL-06)
- **Location**: `/app/challenge/[id]/page.tsx:273-305`
- **Expected**: UI should show waiting indicator during LLM evaluation
- **Actual**: Only button text changes to "Submitting...". No modal or distinct visual feedback indicating LLM evaluation is in progress.
- **Impact**: User might think submission failed and refresh, causing duplicate submissions.

---

### 11. Profile API Creates Anonymous User Instead of 400 (Input Validation)
- **Location**: `/app/api/profile/route.ts`
- **Expected**: Missing userId query param should return 400 Bad Request
- **Actual**: Creates anonymous user and returns 200 OK
  ```typescript
  } else {
    // Create anonymous user
    user = await prisma.user.create({
      data: { name: 'anonymous' },
    });
  }
  ```
- **Impact**: Invalid userId is silently accepted instead of being rejected.

---

## Minor Issues

### 12. handleSubmitSolution Catch Block Uses Feedback Modal Instead of Error Modal
- **Location**: `/app/challenge/[id]/page.tsx:295-301`
- **Expected**: Network errors should show ErrorModal
- **Actual**:
  ```typescript
  } catch (err) {
    setFeedback({passed: false, score: 0, feedback: 'Failed to submit...'});  // Uses feedback modal
    setShowFeedback(true);  // Shows feedback modal
  }
  ```
- **Impact**: Network errors are shown in FeedbackModal instead of ErrorModal. The error message also lacks detail (doesn't say "network error" vs "server error").

---

### 13. Frontend `userId` is Not UUID Format
- **Location**: `/app/challenge/[id]/page.tsx:117-121`
- **Expected**: User IDs should be UUID format for validation
- **Actual**:
  ```typescript
  userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  ```
  This creates a string starting with "user-" followed by a timestamp and random string, not a valid UUID.
- **Impact**: The UUID format validation mentioned in Section 8.2 is not being followed on the frontend.

---

### 14. handleResetExercise Ignores State Fetch Failure
- **Location**: `/app/challenge/[id]/page.tsx:333-338`
- **Expected**: Check `stateRes.ok` and show ErrorModal on failure
- **Actual**:
  ```typescript
  if (stateRes.ok) {
    const stateData = await stateRes.json();
    setCurrentBranch(stateData.branch);
  }
  // No else clause - silent failure
  ```
- **Impact**: If fetching state after reset fails, user sees incorrect branch state.

---

### 15. Leaderboard API Silently Uses Default Values for Invalid Params
- **Location**: `/app/api/leaderboard/route.ts`
- **Expected**: Invalid limit/offset should return 400 Bad Request
- **Actual**: Invalid values are parsed with defaults (e.g., `Math.min` clamps to max)
- **Impact**: Client cannot distinguish between "no data" and "invalid request".

---

## Recommendations

### Immediate Fixes Required:

1. **Add retry logic to minimax.ts**:
   - Implement 3 retries with exponential backoff
   - Return 500 error only after all retries exhausted

2. **Add session-user ownership validation to `/api/attempt/route.ts`**:
   - After line 24, add:
     ```typescript
     if (session.userId !== userId) {
       return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
     }
     ```

3. **Fix handleSubmitSolution error handling**:
   - Check `if (!res.ok)` before using response data
   - Show ErrorModal on 4xx/5xx, do not set feedback

4. **Fix handleResetExercise**:
   - Check DELETE response status before creating new session
   - Handle state fetch failure appropriately

5. **Fix Leaderboard error handling**:
   - Check `response.ok` before parsing JSON
   - Display ErrorModal on failure, do not return empty data silently

6. **Add ErrorModal to Profile page**:
   - Use the existing ErrorModal component for consistency
   - Handle fetch errors with proper modal

7. **Fix profile API userId handling**:
   - Return 400 if userId is provided but invalid
   - Only create anonymous user if no userId provided at all

8. **Add timeout to LLM API call**:
   - Add `signal: AbortSignal.timeout(60000)` or similar to prevent indefinite hanging

### Files to Modify:
- `/lib/minimax.ts` - Add retry logic and timeout
- `/app/api/attempt/route.ts` - Add ownership validation
- `/app/api/profile/route.ts` - Return 400 for invalid userId
- `/app/challenge/[id]/page.tsx` - Fix error handling in handleSubmitSolution and handleResetExercise
- `/app/leaderboard/page.tsx` - Fix error handling
- `/app/profile/page.tsx` - Add ErrorModal component

---

## Verification Checklist

After fixes, verify:

- [ ] LLM API retries 3 times before failing
- [ ] Attempt API returns 403 when userId doesn't match session owner
- [ ] All fetch calls in challenge page check `res.ok`
- [ ] ErrorModal appears for all 4xx/5xx responses in challenge page
- [ ] Leaderboard shows ErrorModal on fetch failure
- [ ] Profile shows ErrorModal on fetch failure
- [ ] LLM API has timeout to prevent indefinite hang
- [ ] Reset exercise checks DELETE response before creating new session
- [ ] Profile API returns 400 for invalid userId