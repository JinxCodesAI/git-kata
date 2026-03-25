// lib/minimax.ts

import { logger } from './logger';

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
  logger.info('Starting evaluation for:', context.exerciseTitle);
  logger.debug('Verification output:', context.verificationOutput);
  logger.debug('User commands:', context.userCommands);
  
  const prompt = buildPrompt(context);
  logger.debug('Built prompt, length:', prompt.length);
  
  const maxRetries = 3;
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    logger.debug('Attempt', attempt + 1, 'of', maxRetries + 1);
    try {
      logger.debug('Calling MiniMax API...');
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
- 100: Perfect solution with good practices
- 70-99: Correct solution but could be improved
- 50-69: Partially correct, missing key steps
- 0-49: Incorrect or incomplete solution

Important notes:
- The verification script output is only a helper indicator, not the source of truth
- If the verification script is buggy or incorrect, base your score on whether the student fulfilled the task as described in the exercise description
- Avoid nitpicking: minor formatting differences, whitespace variations, or cosmetic changes should not reduce the score if the core task is completed correctly`,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
        signal: AbortSignal.timeout(60000),
      });
      logger.info('API response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`MiniMax API error: ${response.status}`);
      }
      
      const data = await response.json();
      // Log response metadata only - never log full response body which may contain sensitive data
      logger.debug('API response received, content length:', JSON.stringify(data).length);
      
      // Find the text content (not thinking block) by iterating through content array
      let content = '';
      if (data.content && Array.isArray(data.content)) {
        for (const item of data.content) {
          if (item.type === 'text') {
            content = item.text || '';
            break;
          }
        }
      } else {
        logger.error('LLM_RESPONSE_UNEXPECTED_STRUCTURE', {
          dataKeys: Object.keys(data),
          contentType: typeof data.content,
          isArray: Array.isArray(data.content),
        });
      }
      logger.debug('LLM response content received, length:', content.length);
      
      // Parse JSON from response
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const extractedJson = jsonMatch[0];
          logger.debug('Extracted JSON from response, length:', extractedJson.length);
          try {
            return JSON.parse(extractedJson);
          } catch (parseError) {
            logger.error('LLM_RESPONSE_PARSE_FAILED', {
              rawContent: content,
              extractedJson: extractedJson,
              parseError: String(parseError),
            });
            throw parseError;
          }
        } else {
          // No JSON found in response
          logger.error('LLM_RESPONSE_NO_JSON', {
            rawContent: content,
            contentPreview: content.substring(0, 500),
          });
        }
      } catch (e) {
        // Already logged in the nested catch blocks above
      }
      
      // Fallback
      logger.warn('Using fallback - could not parse JSON from LLM response');
      return {
        passed: false,
        score: 0,
        feedback: 'Failed to evaluate submission. Please try again.',
      };
    } catch (error) {
      lastError = error as Error;
      logger.error('LLM_ATTEMPT_FAILED', {
        attempt: attempt + 1,
        maxRetries,
        error: String(error),
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt) * 1000;
        logger.debug('Waiting', delay, 'ms before retry...');
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  
  // After retry limit exhausted, throw error to result in 500 response
  logger.error('LLM_ALL_RETRIES_EXHAUSTED', {
    totalAttempts: maxRetries + 1,
    lastError: lastError ? String(lastError) : null,
    lastErrorMessage: lastError instanceof Error ? lastError.message : null,
  });
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
