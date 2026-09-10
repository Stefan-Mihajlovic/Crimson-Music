export type KaraokeEase =
  | 'linear'
  | 'ease'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | `cubic-bezier(${string})`;

export type KaraokeWord = {
  text: string;
  start: number;
  duration: number;
  ease: KaraokeEase;
};

export type KaraokeLine = {
  lineId: number;
  startTime: number;
  endTime: number;
  words: KaraokeWord[];
};

const namedCurves: Record<string, readonly [number, number, number, number]> = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
};

const cubicPattern = /^cubic-bezier\(\s*([-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?)\s*,\s*([-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?)\s*,\s*([-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?)\s*,\s*([-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?)\s*\)$/i;

function arrayFromRecord(value: unknown): unknown[] {
  let parsed = value;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch { return []; }
  }
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== 'object') return [];

  const record = parsed as Record<string, unknown>;
  const keys = Object.keys(record).sort((first, second) => Number(first) - Number(second));
  if (!keys.length || !keys.every((key, index) => String(index) === key)) return [];
  return keys.map((key) => record[key]);
}

function normalizeEase(value: unknown): KaraokeEase {
  const ease = String(value || 'linear').trim().toLowerCase();
  if (namedCurves[ease]) return ease as KaraokeEase;
  const match = ease.match(cubicPattern);
  if (!match) return 'linear';
  const values = match.slice(1).map(Number);
  if (!values.every(Number.isFinite) || values[0] < 0 || values[0] > 1 || values[2] < 0 || values[2] > 1) return 'linear';
  return `cubic-bezier(${values.join(',')})`;
}

export function karaokeEaseCurve(ease: KaraokeEase): readonly [number, number, number, number] {
  const named = namedCurves[ease];
  if (named) return named;
  const values = ease.match(cubicPattern)?.slice(1).map(Number);
  return values?.length === 4
    ? [values[0], values[1], values[2], values[3]]
    : namedCurves.linear;
}

export function normalizeKaraokeLyrics(value: unknown): KaraokeLine[] {
  const sourceLines = arrayFromRecord(value);
  if (!sourceLines.length) return [];

  try {
    const ids = new Set<number>();
    const tolerance = 0.051;
    let previousLineEnd = -Infinity;

    return sourceLines.map((rawLine, lineIndex) => {
      if (!rawLine || typeof rawLine !== 'object' || Array.isArray(rawLine)) throw new Error('Invalid karaoke line');
      const line = rawLine as Record<string, unknown>;
      const lineId = Number(line.line_id);
      const startTime = Number(line.start_time);
      const endTime = Number(line.end_time);

      if (
        !Number.isInteger(lineId) || lineId <= 0 || ids.has(lineId) ||
        !Number.isFinite(startTime) || startTime < 0 ||
        !Number.isFinite(endTime) || endTime <= startTime ||
        startTime + tolerance < previousLineEnd
      ) throw new Error('Invalid karaoke line timing');

      if (!Array.isArray(line.words) || !line.words.length) throw new Error('Missing karaoke words');
      let previousWordStart = -Infinity;
      const words = line.words.map((rawWord) => {
        if (!rawWord || typeof rawWord !== 'object' || Array.isArray(rawWord)) throw new Error('Invalid karaoke word');
        const word = rawWord as Record<string, unknown>;
        const text = String(word.text || '').trim();
        const start = Number(word.start);
        const duration = Number(word.duration);
        if (
          !text || !Number.isFinite(start) || !Number.isFinite(duration) || duration <= 0 ||
          start + tolerance < startTime || start + duration > endTime + tolerance ||
          start + tolerance < previousWordStart
        ) throw new Error('Invalid karaoke word');
        previousWordStart = start;
        return { text, start, duration, ease: normalizeEase(word.ease) };
      });

      ids.add(lineId);
      previousLineEnd = endTime;
      return { lineId: lineId || lineIndex + 1, startTime, endTime, words };
    });
  } catch {
    return [];
  }
}

export function karaokeLineText(line: KaraokeLine) {
  return line.words.map((word) => word.text).join(' ');
}
