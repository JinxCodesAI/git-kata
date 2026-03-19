// lib/minimax.ts

interface EvaluationResult {
  passed: boolean;
  score: number;
  feedback: string;
}

interface EvaluationContext {
  exerciseTitle: string;
  exerciseDescription: string;
  userCommands: string[];
  verificationOutput: string;  // Output from verify.sh
}

async function evaluateAttempt(context: EvaluationContext): Promise<EvaluationResult> {
  console.log('[MINIMAX] Starting evaluation for:', context.exerciseTitle);
  console.log('[MINIMAX] Verification output:', context.verificationOutput);
  console.log('[MINIMAX] User commands:', context.userCommands);
  
  const prompt = buildPrompt(context);
  console.log('[MINIMAX] Built prompt, length:', prompt.length);
  console.log('[MINIMAX] Full prompt:\n', prompt);
  
  const maxRetries = 3;
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    console.log('[MINIMAX] Attempt', attempt + 1, 'of', maxRetries + 1);
    try {
      console.log('[MINIMAX] Calling MiniMax API...');
      const response = await fetch(process.env.MINIMAX_BASE_URL!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.MINIMAX_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'MiniMax-M2.5-highspeed',
          max_tokens: 1024,
          system: `You are a Git instructor evaluating a student's solution.
Provide constructive, encouraging feedback.
Be strict but fair in your evaluation.
Always respond with valid JSON in this exact format:
{"passed": boolean, "score": number, "feedback": "string"}

Score guidelines:
- 90-100: Perfect solution with good practices
- 70-89: Correct solution but could be improved
- 50-69: Partially correct, missing key steps
- 0-49: Incorrect or incomplete solution`,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
        signal: AbortSignal.timeout(60000),
      });
      console.log('[MINIMAX] API response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`MiniMax API error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[MINIMAX] API response data:', JSON.stringify(data));
      
      // Find the text content (not thinking block) by iterating through content array
      let content = '';
      for (const item of data.content || []) {
        if (item.type === 'text') {
          content = item.text || '';
          break;
        }
      }
      console.log('[MINIMAX] LLM response content:', content);
      
      // Parse JSON from response
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          console.log('[MINIMAX] Parsed JSON:', jsonMatch[0]);
          return JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error('[MINIMAX] Failed to parse LLM response:', content);
      }
      
      // Fallback
      console.log('[MINIMAX] Using fallback - could not parse JSON from LLM response');
      return {
        passed: false,
        score: 0,
        feedback: 'Failed to evaluate submission. Please try again.',
      };
    } catch (error) {
      lastError = error as Error;
      console.error('[MINIMAX] Attempt', attempt + 1, 'failed:', error);
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt) * 1000;
        console.log('[MINIMAX] Waiting', delay, 'ms before retry...');
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  
  // After retry limit exhausted, throw error to result in 500 response
  console.error('[MINIMAX] All retries exhausted, throwing error');
  throw lastError;
}

function buildPrompt(context: EvaluationContext): string {
  return `Evaluate this Git exercise submission:

## Exercise: ${context.exerciseTitle}

### Description:
${context.exerciseDescription}

### Student's Commands:
${context.userCommands.map((c, i) => `${i + 1}. ${c}`).join('\n')}

### Verification Script Output:
This is the output from running the exercise's verification script, which checks
if the student completed the exercise correctly. Read this natural language output
and evaluate whether the student passed or failed.

${context.verificationOutput}

### Evaluation Instructions:
1. Read the verification script output carefully
2. Determine if the student achieved the exercise goal based on the verification results
3. Consider the Student's Commands to understand their approach
4. Provide specific, actionable feedback
5. Assign a score from 0-100 based on how well they completed the exercise

Respond with JSON only: {"passed": boolean, "score": number, "feedback": "string"}`;
}

export const minimax = {
  evaluateAttempt,
};
