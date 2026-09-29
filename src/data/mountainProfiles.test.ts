import { describe, expect, it } from 'vitest';
import { MOUNTAINS } from '@/data/mountains';
import { MOUNTAIN_PROFILES, mountainProfileFor } from '@/data/mountainProfiles';

const HTTPS_ABSOLUTE = /^https:\/\/[^\s]+$/;

const isValidHttpsUrl = (value: string): boolean => {
  if (!HTTPS_ABSOLUTE.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.length > 0;
  } catch {
    return false;
  }
};

describe('mountain profiles — data integrity', () => {
  it('gives every mountain in the dataset a profile', () => {
    for (const mountain of MOUNTAINS) {
      expect(mountainProfileFor(mountain.id), `missing profile for ${mountain.id}`).not.toBeNull();
    }
  });

  it('never carries a profile for a mountain that does not exist', () => {
    const mountainIds = new Set(MOUNTAINS.map((mountain) => mountain.id));
    for (const id of Object.keys(MOUNTAIN_PROFILES)) {
      expect(mountainIds.has(id), `profile ${id} has no matching mountain`).toBe(true);
    }
  });

  it('gives every mountain a valid absolute https official website', () => {
    for (const mountain of MOUNTAINS) {
      const profile = mountainProfileFor(mountain.id)!;
      expect(isValidHttpsUrl(profile.officialWebsite), `${mountain.id} officialWebsite`).toBe(true);
    }
  });

  it('never fabricates a URL — every optional link is either a valid https URL or explicitly null', () => {
    const optionalUrlFields = ['snowReportUrl', 'webcamUrl', 'ticketUrl', 'passInfoUrl'] as const;
    for (const mountain of MOUNTAINS) {
      const profile = mountainProfileFor(mountain.id)!;
      for (const field of optionalUrlFields) {
        const value = profile[field];
        if (value === null) continue;
        expect(isValidHttpsUrl(value), `${mountain.id}.${field} = ${value}`).toBe(true);
      }
    }
  });

  it('gives every mountain a real, structured official trail map — an https officialUrl always, and, when set, a valid https image/pdf asset', () => {
    for (const mountain of MOUNTAINS) {
      const { trailMap } = mountainProfileFor(mountain.id)!;
      expect(trailMap, `${mountain.id} trailMap`).toBeDefined();
      expect(trailMap.source, `${mountain.id} trailMap.source`).toBe('official');
      expect(isValidHttpsUrl(trailMap.officialUrl), `${mountain.id} trailMap.officialUrl`).toBe(true);
      if (trailMap.imageUrl) expect(isValidHttpsUrl(trailMap.imageUrl), `${mountain.id} trailMap.imageUrl`).toBe(true);
      if (trailMap.pdfUrl) expect(isValidHttpsUrl(trailMap.pdfUrl), `${mountain.id} trailMap.pdfUrl`).toBe(true);
    }
  });

  it('never claims a season for a trail map asset it does not actually have, and never claims an asset with no season', () => {
    // A season claim without a viewable asset would misleadingly imply
    // there's something current to look at; an asset with no season claim
    // is fine (a page URL doesn't need one) — but never the reverse:
    // an asset presented as embeddable *without* saying which season it's
    // from would be exactly the "is this even current" ambiguity this
    // field exists to avoid.
    for (const mountain of MOUNTAINS) {
      const { trailMap } = mountainProfileFor(mountain.id)!;
      const hasAsset = Boolean(trailMap.imageUrl || trailMap.pdfUrl);
      if (hasAsset) {
        expect(trailMap.season, `${mountain.id} trailMap.season for a claimed asset`).toBeTruthy();
      } else {
        expect(trailMap.season ?? null, `${mountain.id} trailMap.season without an asset`).toBeNull();
      }
    }
  });

  it('only ever uses the three defined season-date statuses, and pairs "confirmed"/"projected" with a real date or leaves it null honestly', () => {
    const validStatuses = new Set(['confirmed', 'projected', 'tbd']);
    for (const mountain of MOUNTAINS) {
      const profile = mountainProfileFor(mountain.id)!;
      for (const seasonDate of [profile.openingDate, profile.closingDate]) {
        expect(validStatuses.has(seasonDate.status), `${mountain.id} season date status`).toBe(true);
        if (seasonDate.status === 'confirmed') {
          expect(seasonDate.date, `${mountain.id} confirmed date must not be null`).not.toBeNull();
        }
        if (seasonDate.date !== null) {
          expect(seasonDate.date, `${mountain.id} date shape`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
      }
    }
  });

  it('uses the official Purgatory Ski Resort domain (purgatory.ski), never a look-alike or unrelated resort', () => {
    const profile = mountainProfileFor('purgatory')!;
    expect(profile.officialWebsite).toBe('https://www.purgatory.ski');
    for (const url of [profile.snowReportUrl, profile.webcamUrl, profile.ticketUrl]) {
      if (url) expect(new URL(url).hostname).toMatch(/(^|\.)purgatory\.ski$/);
    }
    // Purgatory's pass is the Power Pass, the resort's own multi-mountain
    // program on its own domain — confirmed by the site owner, not a look-alike.
    expect(new URL(profile.passInfoUrl!).hostname).toMatch(/(^|\.)(purgatory|thepowerpass)\.ski$/);
    expect(new URL(profile.trailMap.officialUrl).hostname).toMatch(/(^|\.)purgatory\.ski$/);
    if (profile.trailMap.pdfUrl) expect(new URL(profile.trailMap.pdfUrl).hostname).toMatch(/(^|\.)purgatory\.ski$/);
  });

  it('never claims a confirmed opening/closing date this early in the 2026-27 season research pass', () => {
    // Every date recorded as of this research pass is, at best, a resort's own
    // published "target" — never treat that as `confirmed`.
    for (const mountain of MOUNTAINS) {
      const profile = mountainProfileFor(mountain.id)!;
      expect(profile.openingDate.status).not.toBe('confirmed');
      expect(profile.closingDate.status).not.toBe('confirmed');
    }
  });
});
