import type { SnowHistory } from '@/domain/conditions';
import { type DateKey, formatDateLabel, weekdayLong, weekdayShort } from '@/domain/dates';
import type { Mountain } from '@/domain/mountain';

/**
 * A mountain as a picture you can text the crew: its name, the biggest snow
 * day coming, and the next five days as bars. Everything on the card is a
 * number the app already shows; nothing is made up for the share.
 */
export interface ShareCardData {
  mountain: Mountain;
  /** The five-day outlook, or null when the forecast isn't available. */
  snow: SnowHistory | null;
  /** The day the card was made, printed on it so an old screenshot says how old it is. */
  today: DateKey;
  usingDemoData: boolean;
  /** Where the card points, e.g. "snownow.vercel.app". */
  host: string;
}

/** Inches as the app prints them: one decimal under 10, whole above. */
export const inches = (value: number): string => `${value.toFixed(value < 10 ? 1 : 0)}″`;

/** The day the most snow is forecast, or null when nothing measurable is coming. */
export function biggestDay(snow: SnowHistory | null): { date: DateKey; snowfallIn: number } | null {
  if (!snow || snow.future.length === 0) return null;
  const top = snow.future.reduce((best, day) => (day.snowfallIn > best.snowfallIn ? day : best));
  return top.snowfallIn >= 0.5 ? top : null;
}

/** The one line that goes with the card in a text: "Wolf Creek: 14″ Monday, 22″ in the next 5 days." */
export function shareText(data: ShareCardData): string {
  const name = data.mountain.name;
  if (!data.snow) return `${name} on POW NOW.`;
  const top = biggestDay(data.snow);
  if (!top) return `${name}: no real snow in the next 5 days.`;
  const day = weekdayLong(top.date);
  const total = data.snow.futureTotalIn;
  return total - top.snowfallIn >= 0.5
    ? `${name}: ${inches(top.snowfallIn)} ${day}, ${inches(total)} in the next 5 days.`
    : `${name}: ${inches(top.snowfallIn)} ${day}.`;
}

/** The link the card carries: straight to this mountain's profile. */
export const shareUrl = (mountainId: string): string =>
  `${window.location.origin}${window.location.pathname}#/profile/${mountainId}`;

/* ------------------------------------------------------------------ drawing */

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

const FONT = `ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;
const BG = '#04060a';
const RAISE = '#0a0f18';
const INK = '#f3f7ff';
const DIM = 'rgba(243, 247, 255, 0.66)';
const FAINT = 'rgba(243, 247, 255, 0.42)';
const LINE = 'rgba(243, 247, 255, 0.12)';
const ICE = '#7ce7ff';
const WARN = '#ffc861';
/** A bar is full at the week's biggest day, but never at less than this, so a dusting never looks like a dump. */
const MIN_FULL_BAR_IN = 8;

/** Shrinks a font until `text` fits `maxWidth`, so TELLURIDE and Arizona Snowbowl both sit on one line. */
function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: number, start: number, maxWidth: number, min = 56): number {
  let size = start;
  for (; size > min; size -= 4) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    if (ctx.measureText(text).width <= maxWidth) break;
  }
  ctx.font = `${weight} ${size}px ${FONT}`;
  return size;
}

function tracked(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number, align: 'left' | 'right' = 'left') {
  const chars = [...text];
  const width = chars.reduce((sum, ch) => sum + ctx.measureText(ch).width + spacing, -spacing);
  let cursor = align === 'right' ? x - width : x;
  ctx.textAlign = 'left';
  for (const ch of chars) {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + spacing;
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draws the card onto `canvas`. Returns false when the browser can't draw (no 2D context). */
export function drawShareCard(canvas: HTMLCanvasElement, data: ShareCardData): boolean {
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    ctx = null;
  }
  if (!ctx) return false;

  const { mountain, snow } = data;
  const pad = 88;
  const inner = CARD_WIDTH - pad * 2;

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  ctx.textBaseline = 'alphabetic';

  // A ridge line low across the card, under the footer.
  const ridgeTop = 1132;
  ctx.beginPath();
  ctx.moveTo(0, CARD_HEIGHT);
  ctx.lineTo(0, ridgeTop + 56);
  ctx.lineTo(260, ridgeTop + 24);
  ctx.lineTo(430, ridgeTop + 44);
  ctx.lineTo(700, ridgeTop);
  ctx.lineTo(860, ridgeTop + 30);
  ctx.lineTo(CARD_WIDTH, ridgeTop + 14);
  ctx.lineTo(CARD_WIDTH, CARD_HEIGHT);
  ctx.closePath();
  ctx.fillStyle = RAISE;
  ctx.fill();

  // Wordmark, top left; the date it was made, top right.
  ctx.font = `900 46px ${FONT}`;
  ctx.fillStyle = INK;
  ctx.fillText('POW', pad, 140);
  const powWidth = ctx.measureText('POW').width;
  ctx.fillStyle = ICE;
  ctx.fillText('NOW', pad + powWidth - 2, 140);
  ctx.font = `700 26px ${FONT}`;
  ctx.fillStyle = FAINT;
  tracked(ctx, formatDateLabel(data.today).toUpperCase(), CARD_WIDTH - pad, 138, 3, 'right');

  // Where it is, then the name.
  ctx.font = `800 28px ${FONT}`;
  ctx.fillStyle = DIM;
  tracked(ctx, `${mountain.region} · ${mountain.state}`.toUpperCase(), pad, 268, 5);
  ctx.fillStyle = INK;
  const nameSize = fitFont(ctx, mountain.name, 900, 120, inner);
  ctx.fillText(mountain.name, pad, 268 + nameSize * 1.02);

  const blockTop = 268 + nameSize * 1.02 + 96;
  const top = biggestDay(snow);

  if (!snow) {
    ctx.font = `800 52px ${FONT}`;
    ctx.fillStyle = DIM;
    ctx.fillText('Forecast unavailable', pad, blockTop + 40);
  } else {
    // The headline: the biggest day, as big as the card allows.
    if (top) {
      ctx.font = `900 200px ${FONT}`;
      ctx.fillStyle = ICE;
      const amount = inches(top.snowfallIn);
      ctx.fillText(amount, pad - 6, blockTop + 150);
      const amountWidth = ctx.measureText(amount).width;
      ctx.font = `900 64px ${FONT}`;
      ctx.fillStyle = INK;
      ctx.fillText(weekdayLong(top.date), pad + amountWidth + 24, blockTop + 150);
      ctx.font = `700 34px ${FONT}`;
      ctx.fillStyle = DIM;
      ctx.fillText(`${inches(snow.futureTotalIn)} in the next 5 days`, pad, blockTop + 214);
    } else {
      ctx.font = `900 84px ${FONT}`;
      ctx.fillStyle = INK;
      ctx.fillText('Dry spell', pad, blockTop + 90);
      ctx.font = `700 34px ${FONT}`;
      ctx.fillStyle = DIM;
      ctx.fillText('No real snow in the next 5 days', pad, blockTop + 150);
    }

    // Five bars, one per day, the big day lit.
    const barsTop = blockTop + 290;
    const barsHeight = 250;
    const days = snow.future.slice(0, 5);
    const fullBar = Math.max(MIN_FULL_BAR_IN, ...days.map((day) => day.snowfallIn));
    const gap = 26;
    const barWidth = (inner - gap * (days.length - 1)) / Math.max(1, days.length);
    days.forEach((day, index) => {
      const x = pad + index * (barWidth + gap);
      roundRect(ctx!, x, barsTop, barWidth, barsHeight, 22);
      ctx!.fillStyle = 'rgba(243, 247, 255, 0.06)';
      ctx!.fill();
      ctx!.strokeStyle = LINE;
      ctx!.lineWidth = 2;
      ctx!.stroke();
      if (day.snowfallIn >= 0.05) {
        const h = Math.max(26, Math.min(1, day.snowfallIn / fullBar) * barsHeight);
        roundRect(ctx!, x, barsTop + barsHeight - h, barWidth, h, 22);
        ctx!.fillStyle = top && day.date === top.date ? ICE : 'rgba(124, 231, 255, 0.42)';
        ctx!.fill();
      }
      ctx!.textAlign = 'center';
      ctx!.font = `900 36px ${FONT}`;
      ctx!.fillStyle = day.snowfallIn >= 0.05 ? INK : FAINT;
      ctx!.fillText(day.snowfallIn >= 0.05 ? inches(day.snowfallIn) : '0', x + barWidth / 2, barsTop + barsHeight + 56);
      ctx!.font = `800 26px ${FONT}`;
      ctx!.fillStyle = DIM;
      ctx!.fillText(weekdayShort(day.date).toUpperCase(), x + barWidth / 2, barsTop + barsHeight + 96);
      ctx!.textAlign = 'left';
    });
  }

  // Footer: the facts that make the mountain, and where to look.
  const footY = CARD_HEIGHT - 96;
  ctx.font = `800 30px ${FONT}`;
  ctx.fillStyle = INK;
  const facts = `${mountain.elevations.verticalFt.toLocaleString()}′ vert  ·  ${mountain.terrain.acres.toLocaleString()} acres  ·  ${mountain.elevations.summitFt.toLocaleString()}′ summit`;
  ctx.fillText(facts, pad, footY - 54);
  ctx.font = `700 28px ${FONT}`;
  ctx.fillStyle = DIM;
  ctx.fillText(data.host, pad, footY);
  if (data.usingDemoData) {
    ctx.font = `900 24px ${FONT}`;
    ctx.fillStyle = WARN;
    tracked(ctx, 'DEMO DATA', CARD_WIDTH - pad, footY, 4, 'right');
  }
  return true;
}

/** The drawn card as a PNG, or null when the browser can't produce one. */
export function cardBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    } catch {
      resolve(null);
    }
  });
}
