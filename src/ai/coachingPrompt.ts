export interface CoachingContext {
  stressScore: number;
  heartRate: number;
  wpm: number;
  fillerWordsPerMin: number;
  transcriptSegment: string;
  question: string;
  trigger: string;
}

export function buildCoachingPrompt(ctx: CoachingContext): string {
  const stressPct = Math.round(ctx.stressScore * 100);
  const triggerNote = {
    stress_spike: 'The candidate is experiencing a significant stress spike and needs the interview to slow down for a calming reset.',
    filler_surge: 'The candidate is overusing filler words.',
    wpm_low: 'The candidate is speaking too slowly — possibly stuck or overthinking.',
    wpm_high: 'The candidate is speaking too fast — possibly rushing due to nerves.',
    periodic: 'Routine coaching check-in.',
  }[ctx.trigger] ?? '';
  const triggerDirective = ctx.trigger === 'stress_spike'
    ? 'For a stress spike, explicitly tell them to pause, breathe, relax, and remember it is okay to take a moment before continuing.'
    : 'Keep the advice short and immediately useful.';

  return `You are AuraSync, a calm, expert AI interview coach speaking directly to a candidate mid-interview.

Current biometric snapshot:
- Stress level: ${stressPct}% (${ctx.stressScore >= 0.7 ? 'HIGH' : ctx.stressScore >= 0.4 ? 'MODERATE' : 'LOW'})
- Heart rate: ${ctx.heartRate} BPM
- Speech speed: ${ctx.wpm} WPM (ideal: 120–160 WPM)
- Filler words: ${ctx.fillerWordsPerMin.toFixed(1)}/min (ideal: <3/min)

Current interview question: "${ctx.question}"

Recent candidate speech: "${ctx.transcriptSegment || '(silence)'}"

Situation: ${triggerNote}

${triggerDirective}

Give exactly ONE short coaching note (max 2 sentences). Be warm, specific, reassuring, and actionable. Address the most critical issue right now. Do not use the candidate's name. Do not say "I notice" or "I can see". Start directly with the advice.`;
}
