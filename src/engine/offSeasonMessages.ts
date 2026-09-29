import { MONTH_LONG } from '@/domain/dates';
import type { DateKey } from '@/domain/dates';
import { fromDateKey } from '@/domain/dates';
import type { MountainWeather } from '@/domain/conditions';
import type { Mountain } from '@/domain/mountain';
import type { MountainOperationalState, OffSeasonMessage } from '@/domain/mountainStatus';
import { createRng, hashSeed } from '@/lib/random';

/**
 * Personality for the states where a normal ski recommendation would be
 * dishonest. The humor is a garnish, chosen deterministically (seeded by
 * mountain + date, never `Math.random`) so the same day always reads the
 * same way and nothing here is flaky in a test. The `detail` line underneath
 * is the part that actually has to be true — every number in it comes from
 * `weather`/`reason`, nothing is invented.
 *
 * Lines are written per mountain, riffing on that mountain's real
 * `character` line (data/mountains.ts) rather than one generic joke bank
 * shared by all 15 — "no snow at Vail" and "no snow at Wolf Creek" are
 * different jokes because they're different mountains. `GENERIC_LINES` is
 * only a fallback for a mountain id this bank doesn't recognize (test
 * fixtures, mainly); every real mountain in data/mountains.ts has its own
 * entry below.
 */

type LineFn = (month: string) => string;
type NonSkiableState = 'OFF_SEASON' | 'NO_SNOW' | 'INSUFFICIENT_COVERAGE' | 'CLOSED';
type MountainLineBank = Record<NonSkiableState, LineFn[]>;

const GENERIC_LINES: MountainLineBank = {
  OFF_SEASON: [
    (month) => `Buddy. It's ${month}. Put the skis away. We have work to do.`,
    () => "Technically ski season. Spiritually, it's still dirt season.",
  ],
  NO_SNOW: [
    () => "There's a mountain under there somewhere. Just not enough of it in white.",
    () => 'Dirt, rock, and a chairlift with nothing to do.',
  ],
  INSUFFICIENT_COVERAGE: [
    () => 'Not quite. The mountain is still wearing its summer clothes.',
    () => 'A few runs worth of hope, not yet a ski day.',
  ],
  CLOSED: [
    () => 'Closed today. Even the mountain needs a day off sometimes.',
    () => 'Lifts are parked. So should you be.',
  ],
};

const UNKNOWN_LINES: LineFn[] = [
  () => "We genuinely don't know what this mountain is up to right now.",
  () => "No lift report, no guess. We're not going to make one up.",
];

/** One bank per mountain id in data/mountains.ts, each riffing on that mountain's own `character` line. */
const MOUNTAIN_LINES: Record<string, MountainLineBank> = {
  vail: {
    OFF_SEASON: [
      () => "The Back Bowls are just bowls right now. Come back when they're full.",
      (month) => `${month} in Vail Village: still gorgeous, still charging Vail prices for a mountain with nothing on it.`,
    ],
    NO_SNOW: [
      () => 'Blue Sky Basin is closed for a season nobody wants to admit is over.',
      () => 'The Back Bowls are open-air hiking trails at the moment. Technically still bowls.',
    ],
    INSUFFICIENT_COVERAGE: [() => "A few inches on a mountain built for Back Bowl days. Not there yet."],
    CLOSED: [() => "Vail Village is still doing its thing. The mountain behind it isn't."],
  },
  'beaver-creek': {
    OFF_SEASON: [
      () => "Beaver Creek's groomers are dirt right now, and dirt doesn't corduroy.",
      (month) => `${month} at Beaver Creek: still quiet, still upscale, still no snow.`,
    ],
    NO_SNOW: [
      () => 'The corduroy is on hold. So is everything else here.',
      () => "Short lift lines for a lift that isn't spinning.",
    ],
    INSUFFICIENT_COVERAGE: [() => "A dusting on the groomers isn't a groomed run yet."],
    CLOSED: [() => 'Even the valets have the day off.'],
  },
  breckenridge: {
    OFF_SEASON: [
      () => 'The Imperial Express is the highest chairlift in North America, currently going nowhere fast.',
      (month) => `${month} on Main Street: still busy. The mountain behind it: still bare.`,
    ],
    NO_SNOW: [
      () => '12,840 feet of elevation and zero inches of anything useful on it.',
      () => 'Peak 8 is just a very tall hill right now.',
    ],
    INSUFFICIENT_COVERAGE: [() => "Alpine's not open yet. The wind's ready; the snow isn't."],
    CLOSED: [() => "Main Street's open. The lifts aren't."],
  },
  keystone: {
    OFF_SEASON: [
      () => 'First chair needs snow to be first onto. Working on it.',
      (month) => `${month}: the groomers are warmed up. The snow hasn't RSVP'd.`,
    ],
    NO_SNOW: [
      () => 'Best early groomers on the corridor, if the corridor had any snow to groom.',
      () => "River Run's fountains are running. The lifts aren't.",
    ],
    INSUFFICIENT_COVERAGE: [() => 'Early-season groomers need actual snow to groom. Getting there.'],
    CLOSED: [() => 'Even the earliest chair in Summit County takes a day off sometimes.'],
  },
  'crested-butte': {
    OFF_SEASON: [
      () => 'The extreme terrain is just extreme dirt right now.',
      (month) => `${month}: the drive still tests the friendship. The mountain gives nothing back for it yet.`,
    ],
    NO_SNOW: [
      () => 'Steep and deep needs the deep part. Currently just steep.',
      () => "Elk Ave is doing its thing. The peak behind it is bare rock.",
    ],
    INSUFFICIENT_COVERAGE: [() => 'A few inches on terrain built for a lot more. Patience.'],
    CLOSED: [() => 'Even the gnarliest terrain in Colorado needs a day off.'],
  },
  'winter-park': {
    OFF_SEASON: [
      () => "Mary Jane's bumps are dirt moguls right now — a genuinely different sport.",
      (month) => `${month}: the pass road is clear. The mountain's a different story.`,
    ],
    NO_SNOW: [
      () => 'No bumps, no snow, no Mary Jane magic. Just Jane.',
      () => 'The access road behaved perfectly today. Shame there was nothing to drive it for.',
    ],
    INSUFFICIENT_COVERAGE: [() => 'A start on the bumps. Not enough to call it Mary Jane season yet.'],
    CLOSED: [() => 'Closed. Even the pass road agrees there was no rush today.'],
  },
  purgatory: {
    OFF_SEASON: [
      () => 'San Juan snow is a rumor right now, not a forecast.',
      (month) => `${month} in Durango: warm enough that the mountain isn't even trying.`,
    ],
    NO_SNOW: [
      () => 'No lift lines, because there are also no lifts running. A different kind of empty.',
      () => "The base area still doesn't feel like a mall. Mostly because it's also not currently a ski resort.",
    ],
    INSUFFICIENT_COVERAGE: [() => 'San Juan snow is starting to show up. Not enough of it yet.'],
    CLOSED: [() => 'Closed for the day — same as the season currently is.'],
  },
  copper: {
    OFF_SEASON: [
      () => "West to east, beginner to expert — right now it's all just brown.",
      (month) => `${month} off I-70: the exit's right there. The snow isn't.`,
    ],
    NO_SNOW: [
      () => "The upper mountain isn't wind-held today. It's just not there.",
      () => "Center Village is ready. The terrain that sorts itself out has nothing to sort yet.",
    ],
    INSUFFICIENT_COVERAGE: [() => "The lower mountain's getting there. Upper Copper needs more."],
    CLOSED: [() => 'Closed. Even the exit off I-70 knows it.'],
  },
  'wolf-creek': {
    OFF_SEASON: [
      () => "Wolf Creek gets the most snow in Colorado — technically still true, it's just all future snow.",
      (month) => `${month}, a long way from anywhere, with nothing on the ground yet to show for the drive.`,
    ],
    NO_SNOW: [
      () => 'Most snow in Colorado is a season average, not a today guarantee.',
      () => "The two-digit lift ticket is still a bargain. There's just nothing to spend it on yet.",
    ],
    INSUFFICIENT_COVERAGE: [() => "It's coming — Wolf Creek usually delivers eventually. Not today though."],
    CLOSED: [() => 'Closed, out here, a long way from anywhere that would notice.'],
  },
  'arapahoe-basin': {
    OFF_SEASON: [
      () => 'A-Basin usually beats everyone to first tracks. Right now there is nothing to track.',
      (month) => `${month} on the Continental Divide: still divided, still no snow on either side.`,
    ],
    NO_SNOW: [
      () => 'The Basin that opens before everyone else is currently open to absolutely nothing.',
      () => 'High alpine, low snow. Come back when that ratio flips.',
    ],
    INSUFFICIENT_COVERAGE: [() => "Legendary isn't open yet. Getting closer."],
    CLOSED: [() => 'Even the mountain that never wants to close, closes sometimes.'],
  },
  loveland: {
    OFF_SEASON: [
      () => 'Closest lift-served turns to Denver — currently zero lift-served turns to Denver.',
      (month) => `${month}, and the wind still hasn't stopped. The snow, on the other hand, hasn't started.`,
    ],
    NO_SNOW: [
      () => 'The wind never really stops here. The snow apparently did.',
      () => 'Closest mountain to Denver, farthest thing from a ski day right now.',
    ],
    INSUFFICIENT_COVERAGE: [() => 'A little coverage, a lot of wind. Not quite a day yet.'],
    CLOSED: [() => "Closed today. The wind's still working, at least."],
  },
  eldora: {
    OFF_SEASON: [
      () => "45 minutes from Boulder and there's nothing worth the drive yet.",
      (month) => `${month}: steep enough to matter, if there were anything on it.`,
    ],
    NO_SNOW: [
      () => 'Small mountain, big attitude, currently zero snow to back it up.',
      () => 'The closest real terrain to Boulder is currently just terrain.',
    ],
    INSUFFICIENT_COVERAGE: [() => "A start. Not enough to justify the drive up the canyon yet."],
    CLOSED: [() => "Closed. Boulder's 45 minutes away and completely unaffected."],
  },
  steamboat: {
    OFF_SEASON: [
      () => 'Champagne Powder is a trademarked term for snow that currently does not exist here.',
      (month) => `${month} in a real Western town, three hours from anywhere, with nothing to ski once you get there.`,
    ],
    NO_SNOW: [
      () => 'No champagne, no powder. Just a really nice town.',
      () => 'Three hours from anywhere, for a mountain with nothing on it yet.',
    ],
    INSUFFICIENT_COVERAGE: [() => 'Getting there. Not champagne yet — maybe seltzer.'],
    CLOSED: [() => "Closed. The town's still real and Western, at least."],
  },
  monarch: {
    OFF_SEASON: [
      () => 'No high-speed lifts, no lines, and right now, no snow either.',
      (month) => `${month}: Mirkwood Basin is just a very committed hike to nothing.`,
    ],
    NO_SNOW: [
      () => 'The extra 300 vertical feet in Mirkwood is currently just 300 vertical feet.',
      () => 'Old-school lifts, old-school lines, currently old-school dirt.',
    ],
    INSUFFICIENT_COVERAGE: [() => 'Not enough yet to earn the hike into Mirkwood.'],
    CLOSED: [() => 'Closed today. No lines to skip either way.'],
  },
  telluride: {
    OFF_SEASON: [
      () => "The dead-end road still dead-ends. There's just nothing worth driving it for yet.",
      (month) => `${month} in the box canyon: gorgeous, quiet, and completely snow-free.`,
    ],
    NO_SNOW: [
      () => 'Alpino Vino is the highest restaurant in North America. Right now it is just a really high restaurant.',
      () => 'Gold Hill and Palmyra Peak are extreme terrain in theory. Right now they are extreme rock.',
    ],
    INSUFFICIENT_COVERAGE: [() => 'A start in the box canyon. The extreme stuff needs a lot more.'],
    CLOSED: [() => 'Closed. The dead-end road is unusually quiet today, even for a dead-end road.'],
  },
};

function pickLine(state: MountainOperationalState, mountain: Mountain, date: DateKey): string {
  const monthName = MONTH_LONG[fromDateKey(date).getMonth()] ?? '';
  if (state === 'UNKNOWN') {
    const rng = createRng(hashSeed(mountain.id, date, state));
    return rng.pick(UNKNOWN_LINES)(monthName);
  }
  if (state !== 'OFF_SEASON' && state !== 'NO_SNOW' && state !== 'INSUFFICIENT_COVERAGE' && state !== 'CLOSED') {
    return '';
  }
  const lines = MOUNTAIN_LINES[mountain.id]?.[state] ?? GENERIC_LINES[state];
  const rng = createRng(hashSeed(mountain.id, date, state));
  return rng.pick(lines)(monthName);
}

/** The real data behind the joke: current situation, and — the part that actually matters — what's coming. */
function detailFor(
  state: MountainOperationalState,
  reason: string,
  weather: MountainWeather | null,
): string {
  const history = weather?.snowHistory;
  const future = history?.futureTotalIn ?? null;
  const past = history?.pastTotalIn ?? null;

  const incomingNote =
    future !== null && future >= 6
      ? ` ${future.toFixed(0)}" is projected over the next 5 days — NOT TODAY doesn't mean NOT SOON.`
      : '';
  const recentNote = past !== null && past > 0 ? ` ${past.toFixed(0)}" has fallen over the last 5 days.` : '';

  switch (state) {
    case 'OFF_SEASON':
      return `${reason}${recentNote}${incomingNote || ' Nothing meaningful in the forecast yet.'}`;
    case 'NO_SNOW':
    case 'INSUFFICIENT_COVERAGE':
      return `${reason}${recentNote}${incomingNote}`;
    case 'CLOSED':
      return reason;
    case 'UNKNOWN':
    default:
      return reason;
  }
}

export function buildOffSeasonMessage(
  state: MountainOperationalState,
  reason: string,
  mountain: Mountain,
  date: DateKey,
  weather: MountainWeather | null,
): OffSeasonMessage | null {
  if (state !== 'OFF_SEASON' && state !== 'NO_SNOW' && state !== 'INSUFFICIENT_COVERAGE' && state !== 'CLOSED' && state !== 'UNKNOWN') {
    return null;
  }
  const line = pickLine(state, mountain, date);
  if (!line) return null;
  return {
    state,
    line,
    detail: detailFor(state, reason, weather),
  };
}
