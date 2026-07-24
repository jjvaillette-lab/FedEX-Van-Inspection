/**
 * Interview-question compliance checker (client-safe, no AI required).
 *
 * Flags questions that wander into protected-class or high-risk territory
 * and offers a job-related rewrite. The owner always has the final call —
 * this warns and suggests, it never blocks (same philosophy as the DOT
 * checklist guard).
 */

export interface QuestionWarning {
  level: "illegal" | "risky";
  reason: string;
  suggestion: string | null;
}

interface Rule {
  test: (t: string) => boolean;
  level: "illegal" | "risky";
  reason: string;
  suggestion: string | null;
}

const RULES: Rule[] = [
  {
    // Age fishing — but "are you 21+" style minimum-age requirements are fine.
    test: (t) =>
      !/\b21\b|\b18\b|\b25\b/.test(t) &&
      /(how old|your age|\bage\b|birth ?date|date of birth|year (were you|you were) born|year did you graduate)/.test(t),
    level: "illegal",
    reason: "Asking a candidate's age (or proxies like graduation year) risks age-discrimination claims.",
    suggestion: "Are you 21 years of age or older? (the DOT/insurance minimum for this role)",
  },
  {
    test: (t) => /(kind of car|what car|own a car|own a vehicle|car do you (own|drive)|do you have a car|reliable transportation)/.test(t),
    level: "risky",
    reason: "Vehicle ownership can discriminate against people who commute other ways — what you really need is reliable attendance.",
    suggestion: "We start at 9:00 AM at the terminal every day — would you have any trouble getting to work on time, every scheduled day?",
  },
  {
    test: (t) => /(married|\bsingle\b|\bkids\b|children|child ?care|pregnan|spouse|husband|wife|family plans|who lives with you)/.test(t),
    level: "illegal",
    reason: "Marital status, children, and pregnancy are protected topics — availability is the job-related question.",
    suggestion: "This role runs 5–6 days a week including at least one weekend day — can you commit to that schedule?",
  },
  {
    test: (t) => /(citizen|where (are|were) you (from|born)|nationality|national origin|native language|first language|accent|immigration status|green card)/.test(t),
    level: "illegal",
    reason: "National origin and citizenship questions are off-limits — work authorization is the legal version.",
    suggestion: "Are you legally authorized to work in the United States?",
  },
  {
    test: (t) => /(religio|church|sabbath|faith|worship|which holidays do you)/.test(t),
    level: "illegal",
    reason: "Religion and religious observance are protected — ask about schedule availability instead.",
    suggestion: "Are you available to work the posted schedule, including weekends?",
  },
  {
    test: (t) =>
      !/(drug screening|drug test|background check)/.test(t) &&
      /(disabilit|medical (condition|history)|medication|health (condition|issues|problems)|injur|surgery|mental health|depress|anxiety|do you smoke|smoking|do you drink|alcohol|how much do you weigh|your weight|how tall|your height|workers.? comp)/.test(t),
    level: "illegal",
    reason: "Health, disability, and injury history are ADA-protected — ask about ability to perform the job's essential functions instead.",
    suggestion: "This job requires lifting packages up to 100–150 lbs and frequent climbing in and out of the truck — are you able to perform those essential functions, with or without a reasonable accommodation?",
  },
  {
    test: (t) => /(arrest|criminal record|criminal history|convicted|felony|misdemeanor|been to (jail|prison))/.test(t),
    level: "risky",
    reason: "Criminal-history questions are restricted in many states (including Connecticut's ban-the-box rules) — the background-check consent framing is the safe version.",
    suggestion: "This role requires passing a pre-employment background check and drug screening — are you able to meet that requirement?",
  },
  {
    test: (t) => /(credit (score|history|check)|bankrupt|\bdebt\b|garnish)/.test(t),
    level: "risky",
    reason: "Financial-history questions invite discrimination claims and aren't job-related for driving roles.",
    suggestion: null,
  },
  {
    test: (t) => /(union|organized labor)/.test(t),
    level: "risky",
    reason: "Union membership questions can violate labor law — leave it out.",
    suggestion: null,
  },
  {
    test: (t) => /(\brace\b|ethnic|skin color|\bgender\b|sexual orientation|transgender|\breligion\b)/.test(t),
    level: "illegal",
    reason: "There is no compliant version of this question — remove it.",
    suggestion: null,
  },
  {
    test: (t) => /(type of discharge|discharge status|dishonorabl)/.test(t),
    level: "risky",
    reason: "Military discharge type is protected in many states — ask about the experience itself.",
    suggestion: "Tell me about your military experience and how it prepared you for this kind of work.",
  },
];

/** Returns a warning for the question text, or null when it looks fine. */
export function checkInterviewQuestion(text: string): QuestionWarning | null {
  const t = text.toLowerCase();
  if (!t.trim()) return null;
  for (const rule of RULES) {
    if (rule.test(t)) {
      return { level: rule.level, reason: rule.reason, suggestion: rule.suggestion };
    }
  }
  return null;
}
