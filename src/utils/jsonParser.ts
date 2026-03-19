import { jsonrepair } from 'jsonrepair';

export function safeParseJSON<T = unknown>(raw: string): { data: T | null; error: string | null; repaired: boolean } {
  const cleaned = extractJSON(raw);

  try {
    return { data: JSON.parse(cleaned) as T, error: null, repaired: false };
  } catch {
    // Try repair
  }

  try {
    const repaired = jsonrepair(cleaned);
    return { data: JSON.parse(repaired) as T, error: null, repaired: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { data: null, error: `Falha ao parsear JSON mesmo com reparo: ${msg}`, repaired: false };
  }
}

function extractJSON(raw: string): string {
  let text = raw.trim();

  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    text = codeBlockMatch[1]!.trim();
  }

  if (text.startsWith('{') || text.startsWith('[')) {
    return text;
  }

  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');

  let start = -1;
  let opener: '{' | '[' = '{';

  if (firstBrace >= 0 && (firstBracket < 0 || firstBrace < firstBracket)) {
    start = firstBrace;
    opener = '{';
  } else if (firstBracket >= 0) {
    start = firstBracket;
    opener = '[';
  }

  if (start >= 0) {
    const closer = opener === '{' ? '}' : ']';
    const end = text.lastIndexOf(closer);
    if (end > start) {
      return text.slice(start, end + 1);
    }
  }

  return text;
}
