import { geminiJSON } from './gemini';

export interface QuestionReview {
  questionIndex: number;
  score: number;          // 0-100
  verdict: 'Excellent' | 'Good' | 'Adequate' | 'Poor' | 'No Answer';
  feedback: string;
  strengths: string[];
  improvements: string[];
}

export interface OverallReview {
  score: number;          // 0-100 (weighted: 60% answers + 40% biometrics)
  recommendation: 'Strong Hire' | 'Hire' | 'Maybe' | 'No Hire';
  summary: string;
  technicalStrength: number;
  communicationScore: number;
  culturalFit: number;
}

export interface EvaluationResult {
  questionReviews: QuestionReview[];
  overallReview: OverallReview;
}

const VERDICT_MAP: Record<string, QuestionReview['verdict']> = {
  excellent: 'Excellent',
  good:      'Good',
  adequate:  'Adequate',
  poor:      'Poor',
  'no answer': 'No Answer',
};

function safeVerdict(raw: unknown): QuestionReview['verdict'] {
  const s = String(raw ?? '').toLowerCase();
  return VERDICT_MAP[s] ?? 'Adequate';
}

function safeArr(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String).slice(0, 4) : [];
}

async function evaluateOneAnswer(
  question: string,
  questionType: string,
  answer: string,
  index: number,
): Promise<QuestionReview> {
  const isEmpty = !answer || answer.trim().length < 5;
  if (isEmpty) {
    return {
      questionIndex: index,
      score: 0,
      verdict: 'No Answer',
      feedback: 'No answer was recorded for this question.',
      strengths: [],
      improvements: ['Attempt every question — even a partial answer shows your thought process.'],
    };
  }

  const isCode = questionType === 'coding';
  const typeHint = isCode
    ? 'The candidate submitted code. Evaluate correctness, efficiency, readability, and edge-case handling.'
    : 'Evaluate clarity, depth, relevance, and use of concrete examples (STAR method for behavioural).';

  const prompt = `You are a senior ${isCode ? 'software engineering' : 'technical'} interviewer.

Question (${questionType}): "${question}"

Candidate's answer:
"""
${answer.slice(0, 1800)}
"""

${typeHint}

Return VALID JSON only (no markdown, no explanation outside the JSON):
{
  "score": <integer 0-100>,
  "verdict": "<Excellent|Good|Adequate|Poor>",
  "feedback": "<2-3 concise sentences>",
  "strengths": ["<1-3 specific strengths>"],
  "improvements": ["<1-3 specific improvements>"]
}`;

  const result = await geminiJSON<{
    score: unknown;
    verdict: unknown;
    feedback: unknown;
    strengths: unknown;
    improvements: unknown;
  }>(prompt);

  if (!result) {
    return {
      questionIndex: index,
      score: 50,
      verdict: 'Adequate',
      feedback: 'Answer received but could not be fully evaluated.',
      strengths: [],
      improvements: [],
    };
  }

  return {
    questionIndex: index,
    score: Math.min(100, Math.max(0, Number(result.score) || 50)),
    verdict: safeVerdict(result.verdict),
    feedback: String(result.feedback ?? '').slice(0, 500),
    strengths: safeArr(result.strengths),
    improvements: safeArr(result.improvements),
  };
}

async function generateOverallReview(
  questions: string[],
  answers: string[],
  reviews: QuestionReview[],
  biometricScore: number,
  company: string,
  tier: string,
): Promise<OverallReview> {
  const avgAnswerScore = reviews.length > 0
    ? Math.round(reviews.reduce((s, r) => s + r.score, 0) / reviews.length)
    : 50;

  const combinedScore = Math.round(0.6 * avgAnswerScore + 0.4 * biometricScore);

  const prompt = `You are a hiring committee chair evaluating a ${tier}-level candidate for ${company}.

Per-question scores: ${reviews.map((r, i) => `Q${i + 1}: ${r.score}/100 (${r.verdict})`).join(', ')}
Average answer quality: ${avgAnswerScore}/100
Biometric composure score: ${biometricScore}/100
Combined score: ${combinedScore}/100

Based on the scores above, provide a final hiring review.

Return VALID JSON only:
{
  "recommendation": "<Strong Hire|Hire|Maybe|No Hire>",
  "summary": "<3-4 sentence overall assessment>",
  "technicalStrength": <integer 0-100>,
  "communicationScore": <integer 0-100>,
  "culturalFit": <integer 0-100>
}`;

  const result = await geminiJSON<{
    recommendation: unknown;
    summary: unknown;
    technicalStrength: unknown;
    communicationScore: unknown;
    culturalFit: unknown;
  }>(prompt);

  const recMap: Record<string, OverallReview['recommendation']> = {
    'strong hire': 'Strong Hire',
    'hire':        'Hire',
    'maybe':       'Maybe',
    'no hire':     'No Hire',
  };
  const rec = recMap[String(result?.recommendation ?? '').toLowerCase()] ??
    (combinedScore >= 75 ? 'Hire' : combinedScore >= 55 ? 'Maybe' : 'No Hire');

  return {
    score: combinedScore,
    recommendation: rec,
    summary: String(result?.summary ?? 'Evaluation complete.').slice(0, 600),
    technicalStrength: Math.min(100, Math.max(0, Number(result?.technicalStrength) || avgAnswerScore)),
    communicationScore: Math.min(100, Math.max(0, Number(result?.communicationScore) || biometricScore)),
    culturalFit: Math.min(100, Math.max(0, Number(result?.culturalFit) || combinedScore)),
  };
}

export async function evaluateSession(params: {
  questions: string[];
  questionTypes: string[];
  answers: string[];
  biometricScore: number; // 0-100
  company: string;
  tier: string;
}): Promise<EvaluationResult> {
  const { questions, questionTypes, answers, biometricScore, company, tier } = params;

  // Evaluate all answers in parallel
  const questionReviews = await Promise.all(
    questions.map((q, i) =>
      evaluateOneAnswer(q, questionTypes[i] ?? 'behavioral', answers[i] ?? '', i)
    )
  );

  const overallReview = await generateOverallReview(
    questions, answers, questionReviews, biometricScore, company, tier
  );

  return { questionReviews, overallReview };
}
