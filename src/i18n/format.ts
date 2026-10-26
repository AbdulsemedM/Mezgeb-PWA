/**
 * The subset of ICU MessageFormat the app's strings use (the same strings as the Flutter app's
 * ARB files): `{name}` placeholders and `{count, plural, =0{…} =1{…} other{…}}`.
 */
export type Params = Record<string, string | number>;

export function formatMessage(template: string, params: Params = {}): string {
  let out = '';
  let i = 0;
  while (i < template.length) {
    const open = template.indexOf('{', i);
    if (open < 0) {
      out += template.slice(i);
      break;
    }
    out += template.slice(i, open);
    const close = matchingBrace(template, open);
    out += formatArgument(template.slice(open + 1, close), params);
    i = close + 1;
  }
  return out;
}

function formatArgument(body: string, params: Params): string {
  const comma = body.indexOf(',');
  if (comma < 0) {
    const value = params[body.trim()];
    return value === undefined ? `{${body}}` : String(value);
  }
  const name = body.slice(0, comma).trim();
  const rest = body.slice(comma + 1);
  const kindEnd = rest.indexOf(',');
  const kind = rest.slice(0, kindEnd).trim();
  if (kind !== 'plural') return `{${body}}`;
  const value = Number(params[name] ?? 0);
  const cases = parseCases(rest.slice(kindEnd + 1));
  const chosen = cases.get(`=${value}`) ?? cases.get(value === 1 ? 'one' : 'other') ?? '';
  return formatMessage(chosen.replaceAll('#', String(value)), params);
}

function parseCases(text: string): Map<string, string> {
  const cases = new Map<string, string>();
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf('{', i);
    if (open < 0) break;
    const key = text.slice(i, open).trim();
    const close = matchingBrace(text, open);
    cases.set(key, text.slice(open + 1, close));
    i = close + 1;
  }
  return cases;
}

function matchingBrace(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return i;
  }
  throw new Error(`Unbalanced braces in message: ${text}`);
}
