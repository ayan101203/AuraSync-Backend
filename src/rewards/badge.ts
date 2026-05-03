import axios from 'axios';
import { Tier } from '../models/Session';

type RewardSessionLike = {
  company: string;
  tier: Tier;
  score: number;
  answerScore: number;
  communicationScore: number;
  avgStressPct: number;
  passed: boolean;
};

export interface SessionReward {
  rewardName: string;
  rewardSummary: string;
  rewardImageUrl: string;
  rewardGeneratedAt: Date;
}

interface RewardProfile {
  rewardName: string;
  rewardSummary: string;
  prompt: string;
  accent: string;
  panel: string;
}

const TIER_PREFIX: Record<Tier, string> = {
  junior: 'Spark',
  mid: 'Circuit',
  senior: 'Vector',
  staff: 'Crown',
};

function getRewardRank(score: number): string {
  if (score >= 90) return 'Sentinel';
  if (score >= 80) return 'Guardian';
  if (score >= 68) return 'Knight';
  return 'Squire';
}

function getRewardProfile(session: RewardSessionLike): RewardProfile {
  const rewardName = `${TIER_PREFIX[session.tier] ?? 'Aura'} ${getRewardRank(session.score)}`;
  const rewardSummary = `${session.company} ${session.tier} cleared with ${session.score}/100 overall, ${session.answerScore}/100 answer quality, ${session.communicationScore}/100 communication and composure, and ${session.avgStressPct}% average stress.`;
  const prompt = [
    'Original clean neo-brutalist achievement badge, NFT-style collectible card, square composition, thick black outlines, minimal premium layout, cream paper background, flat colors, one central emblem.',
    'Not based on any existing brand, game, or copyrighted badge system.',
    `Award theme: ${rewardName}.`,
    `Interview company inspiration: ${session.company}.`,
    `Difficulty tier: ${session.tier}.`,
    `Overall score: ${session.score} out of 100.`,
    `Answer quality score: ${session.answerScore} out of 100.`,
    `Communication and composure score: ${session.communicationScore} out of 100.`,
    `Average stress: ${session.avgStressPct} percent.`,
    'Include a bold geometric emblem, a simple collectible-card frame, limited palette, elegant edition mark, and a calm premium composition.',
    'No watermarks, no realistic humans, no tiny unreadable text.',
  ].join(' ');

  const palette = {
    junior: { accent: '#FFD93D', panel: '#C4B5FD' },
    mid: { accent: '#A8F0C6', panel: '#FFD93D' },
    senior: { accent: '#FF6B6B', panel: '#FFF0D9' },
    staff: { accent: '#000000', panel: '#C4B5FD' },
  }[session.tier];

  return {
    rewardName,
    rewardSummary,
    prompt,
    accent: palette?.accent ?? '#FFD93D',
    panel: palette?.panel ?? '#C4B5FD',
  };
}

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function buildFallbackBadge(profile: RewardProfile, session: RewardSessionLike): string {
  const safeName = profile.rewardName.replace(/&/g, '&amp;');
  const safeCompany = session.company.replace(/&/g, '&amp;');
  const safeTier = session.tier.toUpperCase();
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
      <rect width="1200" height="1200" fill="#FFFDF5"/>
      <rect x="92" y="92" width="1016" height="1016" fill="${profile.panel}" stroke="#000" stroke-width="20"/>
      <rect x="132" y="132" width="936" height="936" fill="#fff" stroke="#000" stroke-width="12"/>
      <rect x="162" y="162" width="288" height="64" fill="${profile.accent}" stroke="#000" stroke-width="10"/>
      <rect x="890" y="162" width="148" height="64" fill="#fff" stroke="#000" stroke-width="10"/>
      <rect x="246" y="272" width="708" height="540" rx="32" fill="#FFFDF5" stroke="#000" stroke-width="16"/>
      <circle cx="600" cy="500" r="132" fill="${profile.accent}" stroke="#000" stroke-width="16"/>
      <circle cx="600" cy="500" r="64" fill="#FFFDF5" stroke="#000" stroke-width="14"/>
      <rect x="586" y="372" width="28" height="256" rx="14" fill="#FFFDF5" stroke="#000" stroke-width="10"/>
      <rect x="472" y="486" width="256" height="28" rx="14" fill="#FFFDF5" stroke="#000" stroke-width="10"/>
      <rect x="246" y="850" width="708" height="150" fill="#fff" stroke="#000" stroke-width="12"/>
      <text x="182" y="205" font-family="Space Grotesk, Arial, sans-serif" font-size="34" font-weight="900" letter-spacing="3">AURASYNC BADGE</text>
      <text x="964" y="205" text-anchor="middle" font-family="Space Grotesk, Arial, sans-serif" font-size="26" font-weight="900">001</text>
      <text x="600" y="760" text-anchor="middle" font-family="Space Grotesk, Arial, sans-serif" font-size="78" font-weight="900">${safeName}</text>
      <text x="600" y="834" text-anchor="middle" font-family="Space Grotesk, Arial, sans-serif" font-size="26" font-weight="700">${safeCompany} • ${safeTier}</text>
      <text x="600" y="878" text-anchor="middle" font-family="Space Grotesk, Arial, sans-serif" font-size="24" font-weight="700">${session.score}/100 overall • ${session.avgStressPct}% stress</text>
      <text x="286" y="946" font-family="Space Grotesk, Arial, sans-serif" font-size="24" font-weight="900">COLLECTIBLE</text>
      <text x="914" y="946" text-anchor="end" font-family="Space Grotesk, Arial, sans-serif" font-size="24" font-weight="900">VALIDATED</text>
    </svg>
  `;

  return svgToDataUrl(svg);
}

async function generateRewardImage(prompt: string): Promise<string | null> {
  const apiKey = process.env.STABILITY_API_KEY?.trim();
  if (!apiKey) return null;

  try {
    const response = await axios.post(
      'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image',
      {
        text_prompts: [{ text: prompt, weight: 1 }],
        cfg_scale: 7.5,
        height: 512,
        width: 512,
        samples: 1,
        steps: 28,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 45_000,
      }
    );

    const base64 = response.data?.artifacts?.[0]?.base64 as string | undefined;
    if (!base64) return null;
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    console.warn('[Rewards] Stability generation failed, using fallback badge:', error instanceof Error ? error.message : error);
    return null;
  }
}

export async function createSessionReward(session: RewardSessionLike): Promise<SessionReward> {
  const profile = getRewardProfile(session);
  const rewardImageUrl =
    await generateRewardImage(profile.prompt) ??
    buildFallbackBadge(profile, session);

  return {
    rewardName: profile.rewardName,
    rewardSummary: profile.rewardSummary,
    rewardImageUrl,
    rewardGeneratedAt: new Date(),
  };
}
