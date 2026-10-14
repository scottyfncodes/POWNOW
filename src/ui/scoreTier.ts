/**
 * The coarse verdict bucket a 0–10 score falls in — the colour of a map pin,
 * the map's peek card and a list card's score. Never a second scoring
 * system, just a bucket of the real score, shared so every surface agrees.
 */
export type ScoreTier = 'go' | 'mixed' | 'skip';

export const tierFor = (score: number): ScoreTier => (score >= 7.2 ? 'go' : score >= 4.8 ? 'mixed' : 'skip');
