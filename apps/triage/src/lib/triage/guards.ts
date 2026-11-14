/**
 * Deterministic safety checks that run alongside the AI. These never replace
 * the model's own judgement; they are a second, independent layer that cannot
 * be talked out of its rules by ticket content.
 */

const INJECTION_PATTERNS: Array<{ id: string; pattern: RegExp }> = [
  {
    id: "ignore_instructions",
    pattern: /\b(ignore|disregard|forget|override|bypass)\b[^.\n]{0,40}\b(instructions?|rules|prompts?|guidelines|polic(y|ies)|guardrails)\b/i,
  },
  {
    id: "privileged_role_claim",
    pattern: /\b(system|developer|admin(istrator)?|root)\s+(override|prompt|message|mode|instructions?|command)\b/i,
  },
  { id: "persona_switch", pattern: /\byou\s+are\s+now\b/i },
  {
    id: "scripted_reply",
    pattern: /\b(reply|respond|answer)\s+(only\s+)?with\b[^.\n]{0,20}["“']/i,
  },
  { id: "fake_markup", pattern: /<\/?\s*(system|assistant|instructions?|prompt|context[-\w]*|ticket[-\w]*)\s*>/i },
  { id: "jailbreak_term", pattern: /\b(jailbreak|DAN mode|prompt injection)\b/i },
];

/** Returns the ids of every injection pattern found in the text (empty = clean). */
export function detectInjection(text: string): string[] {
  return INJECTION_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ id }) => id);
}

const PROMISE_PATTERNS: Array<{ id: string; pattern: RegExp }> = [
  {
    id: "claims_action_taken",
    pattern: /\b(i|we)\s*(have|'ve|’ve)?\s+(just\s+)?(issued|processed|approved|refunded|credited|reset|unlocked|cancelled|canceled|waived|reversed)\b/i,
  },
  {
    id: "refund_granted",
    pattern: /\brefund\s+(has\s+been|is|was)\s+(approved|issued|processed|granted|on its way)\b/i,
  },
  { id: "refund_approved_phrase", pattern: /\brefund\s+approved\b/i },
  {
    id: "promises_refund",
    pattern: /\b(i|we)\s*(will|'ll|’ll)\s+(issue|process|approve|send)\s+(you\s+)?(a|the|your)\s+(full\s+)?refund\b/i,
  },
  { id: "guarantee", pattern: /\bwe\s+guarantee\b/i },
];

const HOST_PATTERN =
  /\b(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})(\/[^\s)>\]"']*)?/gi;
const EMAIL_PATTERN = /\b[a-z0-9._%+-]+@((?:[a-z0-9-]+\.)+[a-z]{2,})\b/gi;

/** Every hostname or email domain mentioned in the text, lower-cased. */
function extractHosts(text: string): string[] {
  const hosts = new Set<string>();
  for (const m of text.matchAll(EMAIL_PATTERN)) hosts.add(m[1].toLowerCase());
  for (const m of text.matchAll(HOST_PATTERN)) hosts.add(m[1].toLowerCase());
  return [...hosts];
}

export type DraftSafetyResult = {
  ok: boolean;
  promiseViolations: string[];
  unknownHosts: string[];
};

/**
 * Rejects drafts that (a) claim an account action was taken or a refund
 * granted, or (b) mention a link, domain or email that isn't in the articles
 * the draft was built from.
 */
export function checkDraftSafety(reply: string, sourceText: string): DraftSafetyResult {
  const promiseViolations = PROMISE_PATTERNS.filter(({ pattern }) => pattern.test(reply)).map(
    ({ id }) => id,
  );
  const allowed = sourceText.toLowerCase();
  const unknownHosts = extractHosts(reply).filter((host) => !allowed.includes(host));
  return {
    ok: promiseViolations.length === 0 && unknownHosts.length === 0,
    promiseViolations,
    unknownHosts,
  };
}

/** True when every cited slug was among the retrieved articles (and at least one was cited). */
export function citationsAreValid(cited: string[], retrievedSlugs: string[]): boolean {
  if (cited.length === 0) return false;
  const allowed = new Set(retrievedSlugs);
  return cited.every((slug) => allowed.has(slug));
}

/**
 * Neutralises anything in untrusted text that could be mistaken for our prompt
 * delimiters. Combined with a per-request random tag name this prevents a
 * ticket from "closing" its own data block.
 */
export function neutraliseDelimiters(text: string): string {
  return text.replace(/<(\/?)\s*(ticket|articles?|context)/gi, "‹$1$2");
}
