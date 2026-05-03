export type Tier = 'junior' | 'mid' | 'senior' | 'staff';
export type QuestionType = 'behavioral' | 'technical' | 'coding';

export interface TestCase {
  description: string;
  args: unknown[];
  expected: unknown;
  display: string; // human-readable e.g. "solution('racecar') → true"
}

export interface QuestionMeta {
  type: QuestionType;
  language?: 'javascript';
  starterCode?: string;
  testCases?: TestCase[];
}

export const COMPANIES = [
  'Google', 'Meta', 'Amazon', 'Apple', 'Microsoft',
  'Netflix', 'Stripe', 'Airbnb', 'Uber', 'Figma',
];

// ── Company-specific openers ─────────────────────────────────────────────────
const COMPANY_OPENER: Record<string, string> = {
  Google:    'Tell me about yourself and why Google excites you more than any other company right now.',
  Meta:      "Walk me through your background and what draws you to Meta's mission of building social connection at scale.",
  Amazon:    "Introduce yourself and tell me which of Amazon's Leadership Principles resonates most with how you work.",
  Apple:     'Tell me about yourself and describe a product detail that you think Apple gets right that others miss.',
  Microsoft: 'Walk me through your background and share why you think this role at Microsoft is the right next step for you.',
  Netflix:   'Introduce yourself and tell me about a time you made a bold decision with incomplete information.',
  Stripe:    'Tell me about yourself and describe the most complex technical or business problem you have solved recently.',
  Airbnb:    'Walk me through your background and tell me about a time you created a sense of belonging for others.',
  Uber:      'Introduce yourself and tell me about a time you moved quickly to solve an ambiguous problem.',
  Figma:     'Tell me about yourself and share an example of how you have made something easier for someone to use.',
};

// ── Company behavioral questions ─────────────────────────────────────────────
const COMPANY_BEHAVIORAL: Record<string, string[]> = {
  Google:    [
    'Describe a time you used data to change the direction of a project.',
    'Tell me about a time you had to work with an ambiguous problem at scale.',
    'How have you made an existing system simpler or more reliable?',
    'Describe a situation where you disagreed with your manager and how you handled it.',
    'Give an example of a time you went significantly beyond what was asked of you.',
  ],
  Meta:      [
    'Describe a time you moved fast and broke something — and what you learned.',
    'Tell me about a feature you shipped that had unexpected social impact.',
    'How have you prioritised user value over internal convenience?',
    'Describe a situation where you had to influence a decision across teams.',
    'Tell me about a time you used qualitative and quantitative signals together.',
  ],
  Amazon:    [
    'Tell me about a time you dove deep into a problem others had overlooked.',
    'Describe a situation where you delivered results under extreme time pressure.',
    'How have you raised the bar for your team\'s engineering standards?',
    'Tell me about a time you earned the trust of a skeptical stakeholder.',
    'Describe a decision you made that saved significant cost or time.',
  ],
  Apple:     [
    'Tell me about a time you obsessed over a small detail that made a big difference.',
    'Describe a project where the user experience was the hardest part to get right.',
    'How have you maintained quality when timelines were compressed?',
    'Tell me about a cross-functional collaboration that produced something excellent.',
    'Describe a time you pushed back on a requirement that would have hurt the end user.',
  ],
  Microsoft: [
    'Tell me about a time you helped someone on your team grow significantly.',
    'Describe a situation where you had to balance innovation with backward compatibility.',
    'How have you driven adoption of a new tool or process in a skeptical team?',
    'Tell me about a time you built something that scaled to millions of users.',
    'Describe a cross-org initiative you led from idea to delivery.',
  ],
  Netflix:   [
    'Tell me about the most courageous professional decision you have made.',
    'Describe a time you gave candid, constructive feedback that was hard to deliver.',
    'How have you operated effectively with minimal process or oversight?',
    'Tell me about a time you hired or advocated for exceptional talent.',
    'Describe how you have balanced creative vision with engineering constraints.',
  ],
  Stripe:    [
    'Tell me about a time you made payments or financial data significantly more reliable.',
    'Describe how you have approached API design for external developers.',
    'How have you built trust with a technical customer under pressure?',
    'Tell me about a time you simplified something that seemed inherently complex.',
    'Describe a situation where correctness mattered more than speed.',
  ],
  Airbnb:    [
    'Tell me about a time you created a remarkable experience for someone.',
    'Describe a situation where you built empathy for a user group different from yourself.',
    'Tell me about a time you used design thinking to solve a trust problem.',
    'Describe a community or culture initiative you drove.',
    'How have you balanced host and guest needs when they conflicted?',
  ],
  Uber:      [
    'Tell me about a time you launched something in a new market quickly.',
    'Describe a situation where supply and demand were out of balance and what you did.',
    'How have you operated at speed without sacrificing safety or reliability?',
    'Tell me about a time you navigated regulatory ambiguity to ship a product.',
    'Describe a cross-functional challenge you solved under tight deadlines.',
  ],
  Figma:     [
    'Tell me about a time you made a complex workflow significantly simpler.',
    'Describe a collaboration tool or process you introduced that changed how your team worked.',
    'How have you gathered user feedback and turned it into a better product?',
    'Tell me about a time you balanced performance and visual quality.',
    'Describe a situation where real-time collaboration introduced unexpected technical challenges.',
  ],
};

// ── Behavioral fallback ───────────────────────────────────────────────────────
const BEHAVIORAL_BASE = [
  'Describe a time you had to work under significant pressure. What was the outcome?',
  'Give an example of a conflict with a teammate and how you resolved it.',
  'Tell me about your biggest professional failure and what you learned from it.',
  'Describe a time you had to influence without formal authority.',
  'How do you prioritise when multiple urgent things compete for your attention?',
  'Tell me about a project you are most proud of and your specific contribution.',
  'Describe a situation where you had to learn something completely new very quickly.',
  'How do you approach giving and receiving critical feedback?',
  'Tell me about a time you took ownership of a problem outside your defined scope.',
];

// ── Technical (non-coding) by tier ───────────────────────────────────────────
const TECHNICAL_BY_TIER: Record<Tier, string[]> = {
  junior: [
    'What is the difference between a stack and a queue? Give a real-world example of each.',
    'What is time complexity? Give an example of an O(n log n) algorithm.',
    'How does HTTPS differ from HTTP and why does it matter?',
    'What is a closure in JavaScript? Give an example.',
    'What is the difference between SQL and NoSQL databases?',
    'How does event-driven programming differ from synchronous programming?',
    'What is the difference between `==` and `===` in JavaScript?',
  ],
  mid: [
    'Walk me through designing a URL shortening service like bit.ly.',
    'Explain the CAP theorem with a practical trade-off example.',
    'How would you scale a database that is hitting read-throughput limits?',
    'What is event-driven architecture and when should you use it?',
    'Describe a caching strategy and its invalidation trade-offs.',
    'What is the N+1 problem and how do you fix it?',
    'How would you design a rate limiter for a public API?',
  ],
  senior: [
    'Design a real-time collaborative document editing system.',
    'How would you architect a multi-region deployment for globally consistent low latency?',
    'Explain your approach to observability — metrics, logs, and distributed traces.',
    'What are your strategies for zero-downtime deployments?',
    'Describe how you led a large-scale technical migration with minimal disruption.',
    'How would you design a notification system that handles millions of events/second?',
    'Describe your incident management and post-mortem approach.',
  ],
  staff: [
    'How do you align engineering strategy with business outcomes across multiple teams?',
    'Describe how you persuaded an organisation to adopt a new technical direction.',
    'How do you build and sustain engineering culture as an org scales?',
    'How do you evaluate build vs buy vs open-source for critical infrastructure?',
    'Describe your framework for technical roadmapping across quarters.',
    'How do you navigate competing priorities between velocity and reliability?',
    'How do you identify and cultivate future technical leaders?',
  ],
};

// ── Coding challenges by tier ─────────────────────────────────────────────────
interface CodingQuestion {
  text: string;
  starterCode: string;
  testCases: TestCase[];
}

const CODING_BY_TIER: Record<Tier, CodingQuestion[]> = {
  junior: [
    {
      text: 'Write a function `solution(s)` that returns the string `s` reversed.',
      starterCode: `function solution(s) {
  // Your code here
}`,
      testCases: [
        { description: 'Basic string',   args: ['hello'],    expected: 'olleh',   display: "solution('hello') → 'olleh'" },
        { description: 'Palindrome',     args: ['racecar'],  expected: 'racecar', display: "solution('racecar') → 'racecar'" },
        { description: 'Single char',   args: ['a'],        expected: 'a',       display: "solution('a') → 'a'" },
        { description: 'Empty string',  args: [''],         expected: '',        display: "solution('') → ''" },
      ],
    },
    {
      text: 'Write a function `solution(n)` that returns an array of strings for numbers 1–n: "FizzBuzz" if divisible by both 3 and 5, "Fizz" if by 3, "Buzz" if by 5, otherwise the number as a string.',
      starterCode: `function solution(n) {
  // Return an array of strings from 1 to n
}`,
      testCases: [
        { description: 'n=5',  args: [5],  expected: ['1','2','Fizz','4','Buzz'],                             display: 'solution(5) → ["1","2","Fizz","4","Buzz"]' },
        { description: 'n=15 last element', args: [15], expected: ['1','2','Fizz','4','Buzz','Fizz','7','8','Fizz','Buzz','11','Fizz','13','14','FizzBuzz'], display: 'solution(15) → [..., "FizzBuzz"]' },
        { description: 'n=1',  args: [1],  expected: ['1'],                                                   display: 'solution(1) → ["1"]' },
      ],
    },
    {
      text: 'Write a function `solution(arr)` that returns the maximum value in an array of numbers. Return `null` for an empty array.',
      starterCode: `function solution(arr) {
  // Return the maximum number
}`,
      testCases: [
        { description: 'Normal array',  args: [[3, 1, 4, 1, 5, 9, 2, 6]], expected: 9,    display: 'solution([3,1,4,1,5,9,2,6]) → 9' },
        { description: 'Single item',  args: [[42]],                        expected: 42,   display: 'solution([42]) → 42' },
        { description: 'Negatives',    args: [[-5, -1, -3]],               expected: -1,   display: 'solution([-5,-1,-3]) → -1' },
        { description: 'Empty array',  args: [[]],                          expected: null, display: 'solution([]) → null' },
      ],
    },
  ],

  mid: [
    {
      text: 'Write a function `solution(nums, target)` that returns the indices of the two numbers that add up to `target`. Assume exactly one solution exists. Return as [i, j] where i < j.',
      starterCode: `function solution(nums, target) {
  // Return [i, j] such that nums[i] + nums[j] === target
}`,
      testCases: [
        { description: 'Basic case',     args: [[2,7,11,15], 9],  expected: [0,1], display: 'solution([2,7,11,15], 9) → [0,1]' },
        { description: 'Different pair', args: [[3,2,4], 6],      expected: [1,2], display: 'solution([3,2,4], 6) → [1,2]' },
        { description: 'Same value',     args: [[3,3], 6],        expected: [0,1], display: 'solution([3,3], 6) → [0,1]' },
        { description: 'Larger array',   args: [[1,5,3,2,8,4], 9], expected: [1,4], display: 'solution([1,5,3,2,8,4], 9) → [1,4]' },
      ],
    },
    {
      text: 'Write a function `solution(s)` that returns `true` if the parentheses, brackets, and braces in string `s` are valid (correctly nested and closed), otherwise `false`.',
      starterCode: `function solution(s) {
  // Return true if brackets are valid, false otherwise
}`,
      testCases: [
        { description: 'Valid simple',    args: ['()'],      expected: true,  display: "solution('()') → true" },
        { description: 'Valid complex',   args: ['()[]{}'  ], expected: true,  display: "solution('()[]{}') → true" },
        { description: 'Invalid nested',  args: ['(]'],      expected: false, display: "solution('(]') → false" },
        { description: 'Valid nested',    args: ['{[()]}'],  expected: true,  display: "solution('{[()]}') → true" },
        { description: 'Unclosed',        args: ['(('],      expected: false, display: "solution('((') → false" },
      ],
    },
    {
      text: 'Write a function `solution(n)` that returns the nth Fibonacci number (0-indexed: F(0)=0, F(1)=1, F(2)=1…). Optimise for performance using memoization or iteration.',
      starterCode: `function solution(n) {
  // Return the nth Fibonacci number efficiently
}`,
      testCases: [
        { description: 'F(0)', args: [0],  expected: 0,  display: 'solution(0) → 0' },
        { description: 'F(1)', args: [1],  expected: 1,  display: 'solution(1) → 1' },
        { description: 'F(7)', args: [7],  expected: 13, display: 'solution(7) → 13' },
        { description: 'F(10)',args: [10], expected: 55, display: 'solution(10) → 55' },
        { description: 'F(20)',args: [20], expected: 6765, display: 'solution(20) → 6765' },
      ],
    },
  ],

  senior: [
    {
      text: 'Implement a function `solution(capacity)` that returns an LRU (Least Recently Used) Cache object with methods `get(key)` and `put(key, value)`. `get` returns -1 if key does not exist. `put` evicts the LRU item when capacity is exceeded.',
      starterCode: `function solution(capacity) {
  // Return an object with get(key) and put(key, value) methods
  const cache = new Map();

  return {
    get(key) {
      // Your implementation
    },
    put(key, value) {
      // Your implementation
    }
  };
}`,
      testCases: [
        {
          description: 'Basic LRU operations',
          args: [2],
          expected: [-1, 1, -1],
          display: 'lru=solution(2); lru.put(1,1); lru.put(2,2); lru.get(1)→1; lru.put(3,3); lru.get(2)→-1; lru.get(3)→3',
        },
        {
          description: 'Single capacity',
          args: [1],
          expected: [-1],
          display: 'lru=solution(1); lru.put(1,1); lru.put(2,2); lru.get(1)→-1',
        },
      ],
    },
    {
      text: 'Write a function `solution(fn, delay)` that returns a debounced version of `fn`. The debounced function delays invoking `fn` until `delay` milliseconds have elapsed since the last invocation.',
      starterCode: `function solution(fn, delay) {
  // Return a debounced version of fn
  let timer = null;

  return function(...args) {
    // Your implementation
  };
}`,
      testCases: [
        {
          description: 'Returns a function',
          args: [() => {}, 100],
          expected: 'function',
          display: 'typeof solution(() => {}, 100) → "function"',
        },
        {
          description: 'Debounced function is callable',
          args: [(x: number) => x * 2, 50],
          expected: true,
          display: 'const d = solution(fn, 50); typeof d === "function" → true',
        },
      ],
    },
    {
      text: 'Write a function `solution(obj)` that performs a deep clone of a plain JavaScript object (handles nested objects, arrays, primitives). You may not use `JSON.parse(JSON.stringify(...))` or structuredClone.',
      starterCode: `function solution(obj) {
  // Deep clone without JSON.parse/JSON.stringify or structuredClone
}`,
      testCases: [
        { description: 'Flat object',    args: [{a:1, b:2}],           expected: {a:1, b:2},       display: 'solution({a:1,b:2}) → {a:1,b:2}' },
        { description: 'Nested object',  args: [{a:{b:{c:42}}}],       expected: {a:{b:{c:42}}},   display: 'solution({a:{b:{c:42}}}) → same' },
        { description: 'With array',     args: [{arr:[1,2,3], x:'hi'}], expected: {arr:[1,2,3], x:'hi'}, display: 'solution({arr:[1,2,3],x:"hi"}) → same' },
        { description: 'Primitives',     args: [42],                    expected: 42,               display: 'solution(42) → 42' },
      ],
    },
  ],

  staff: [
    {
      text: 'Implement `solution(promises)` that works like `Promise.all` — returns a promise that resolves with an array of results when all input promises resolve, or rejects with the first rejection. Do not use the built-in `Promise.all`.',
      starterCode: `function solution(promises) {
  // Implement Promise.all from scratch
  return new Promise((resolve, reject) => {
    // Your implementation
  });
}`,
      testCases: [
        {
          description: 'Returns a Promise',
          args: [[]],
          expected: 'promise',
          display: 'solution([]) instanceof Promise → true',
        },
        {
          description: 'Resolves empty array',
          args: [[]],
          expected: [],
          display: 'solution([]) → []',
        },
      ],
    },
    {
      text: 'Implement a function `solution()` that returns an EventEmitter class instance with `on(event, fn)`, `off(event, fn)`, and `emit(event, ...args)` methods.',
      starterCode: `function solution() {
  // Return an EventEmitter with on, off, emit
  const listeners = {};

  return {
    on(event, fn) {
      // Subscribe
    },
    off(event, fn) {
      // Unsubscribe
    },
    emit(event, ...args) {
      // Fire all handlers
    }
  };
}`,
      testCases: [
        {
          description: 'on + emit fires handler',
          args: [],
          expected: 42,
          display: 'let v; ee=solution(); ee.on("x",n=>v=n); ee.emit("x",42); v → 42',
        },
        {
          description: 'off removes handler',
          args: [],
          expected: 0,
          display: 'let c=0; ee=solution(); const h=()=>c++; ee.on("x",h); ee.off("x",h); ee.emit("x"); c → 0',
        },
        {
          description: 'Multiple listeners',
          args: [],
          expected: 2,
          display: 'let c=0; ee=solution(); ee.on("x",()=>c++); ee.on("x",()=>c++); ee.emit("x"); c → 2',
        },
      ],
    },
    {
      text: 'Write a function `solution(fn)` that returns a curried version of `fn`. The curried function should accept arguments one at a time and execute `fn` once all expected arguments are provided.',
      starterCode: `function solution(fn) {
  // Return a curried version of fn
  return function curried(...args) {
    // Your implementation
  };
}`,
      testCases: [
        { description: 'Binary function',  args: [(a: number,b: number)=>a+b], expected: 5, display: 'const add=solution((a,b)=>a+b); add(2)(3) → 5' },
        { description: 'Ternary function', args: [(a: number,b: number,c: number)=>a+b+c], expected: 6, display: 'const sum=solution((a,b,c)=>a+b+c); sum(1)(2)(3) → 6' },
        { description: 'All at once',      args: [(a: number,b: number)=>a*b], expected: 12, display: 'const mul=solution((a,b)=>a*b); mul(3,4) → 12' },
      ],
    },
  ],
};

// ── Fisher-Yates shuffle ─────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Returns { questions: string[], meta: QuestionMeta[] }
 * questions[i] is the display text, meta[i] carries type + coding data.
 *
 * Composition per session (count=6 default):
 *   - Q0: company-specific opener (behavioral)
 *   - Q1–Q2: company behavioral
 *   - Q3–Q4: technical or behavioral (based on tier)
 *   - Q5: coding challenge (for mid/senior/staff)
 */
export function getQuestionsWithMeta(
  company: string,
  tier: Tier,
  count = 6,
): { questions: string[]; meta: QuestionMeta[] } {
  const opener        = COMPANY_OPENER[company] ?? `Tell me about yourself and why you want to join ${company}.`;
  const companyBeh    = shuffle(COMPANY_BEHAVIORAL[company] ?? BEHAVIORAL_BASE);
  const technical     = shuffle(TECHNICAL_BY_TIER[tier]);
  const behavioralFb  = shuffle(BEHAVIORAL_BASE);
  const codingPool    = shuffle(CODING_BY_TIER[tier] ?? CODING_BY_TIER['junior']);

  const questions: string[]     = [];
  const meta:      QuestionMeta[] = [];

  // Q0 — opener
  questions.push(opener);
  meta.push({ type: 'behavioral' });

  // Q1, Q2 — company behavioral
  for (let i = 0; i < 2 && questions.length < count - 1; i++) {
    questions.push(companyBeh[i] ?? behavioralFb[i]);
    meta.push({ type: 'behavioral' });
  }

  // Q3, Q4 — technical (for mid+) or behavioral (junior)
  const isTechnical = tier !== 'junior';
  for (let i = 0; i < 2 && questions.length < count - 1; i++) {
    if (isTechnical) {
      questions.push(technical[i] ?? behavioralFb[i + 2]);
      meta.push({ type: 'technical' });
    } else {
      questions.push(behavioralFb[i] ?? companyBeh[i + 2]);
      meta.push({ type: 'behavioral' });
    }
  }

  // Fill remaining with behavioral/technical before coding
  while (questions.length < count - 1) {
    const idx = questions.length - 3;
    questions.push(isTechnical ? (technical[idx] ?? behavioralFb[idx]) : behavioralFb[idx]);
    meta.push({ type: isTechnical ? 'technical' : 'behavioral' });
  }

  // Last Q — coding challenge (always included for all tiers)
  const coding = codingPool[0]!;
  questions.push(coding.text);
  meta.push({
    type: 'coding',
    language: 'javascript',
    starterCode: coding.starterCode,
    testCases: coding.testCases,
  });

  return { questions, meta };
}

/** Backward-compatible string-only getter */
export function getQuestions(company: string, tier: Tier, count = 6): string[] {
  return getQuestionsWithMeta(company, tier, count).questions;
}
