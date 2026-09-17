import entries from './catalogue.json';
const codes = ['ar', 'ur', 'tr', 'id', 'fr'] as const;
export const dictionaries = Object.fromEntries(codes.map((code, i) => [code, Object.fromEntries(Object.entries(entries).flatMap(([key, values]) => [[key, values[i]!], [key.toLowerCase(), values[i]!]]))])) as Record<typeof codes[number], Record<string, string>>;
