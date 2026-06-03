/**
 * AI helpers backed by the Hugging Face free Inference API, each with a
 * deterministic fallback so the product keeps working when HF is unavailable
 * (no key, cold model, rate limit, or network error). Every result carries a
 * `source` of "ai" or "fallback" for transparency.
 */

const HF_BASE = "https://api-inference.huggingface.co/models/";
const EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
const SUMMARY_MODEL = "facebook/bart-large-cnn";

export type Source = "ai" | "fallback";

/** Curated skill dictionary used for deterministic skill extraction. */
const SKILL_DICTIONARY = [
  "JavaScript", "TypeScript", "Python", "Java", "Go", "Rust", "Ruby", "PHP",
  "C++", "C#", "Swift", "Kotlin", "Scala", "Elixir", "SQL", "GraphQL",
  "React", "Next.js", "Vue", "Angular", "Svelte", "Node.js", "Express",
  "Django", "Flask", "FastAPI", "Rails", "Spring", "Laravel", ".NET",
  "HTML", "CSS", "Tailwind", "Sass", "Redux", "React Native", "Flutter",
  "PostgreSQL", "MySQL", "MongoDB", "Redis", "Supabase", "Firebase",
  "AWS", "GCP", "Azure", "Docker", "Kubernetes", "Terraform", "CI/CD",
  "Git", "Linux", "REST", "gRPC", "Microservices", "Serverless",
  "Machine Learning", "Deep Learning", "TensorFlow", "PyTorch", "NLP",
  "Data Analysis", "Pandas", "NumPy", "Spark", "Kafka", "Airflow",
  "Figma", "Product Management", "Agile", "Scrum", "Jira", "Leadership",
  "Communication", "Project Management", "Marketing", "SEO", "Sales",
  "Customer Success", "UX", "UI Design", "Accessibility", "Testing",
  "Jest", "Cypress", "Playwright", "Selenium",
];

const STOPWORDS = new Set([
  "the", "and", "for", "with", "you", "our", "are", "will", "this", "that",
  "have", "from", "your", "who", "all", "any", "not", "but", "they", "their",
  "what", "when", "which", "into", "out", "can", "has", "had", "was", "were",
  "a", "an", "to", "of", "in", "on", "at", "is", "be", "as", "or", "we", "it",
  "by", "us", "do", "if", "so", "up", "no", "per", "via", "etc", "job", "role",
  "team", "work", "experience", "years", "year", "strong", "ability", "skills",
]);

function hfKey(): string | null {
  return process.env.HUGGINGFACE_API_KEY?.trim() || null;
}

async function hfRequest<T>(model: string, payload: unknown): Promise<T> {
  const key = hfKey();
  if (!key) throw new Error("HUGGINGFACE_API_KEY not set");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(HF_BASE + model, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HF ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

// ----------------------------------------------------------------------------
// Deterministic primitives
// ----------------------------------------------------------------------------

export function extractEmail(text: string): string | null {
  return text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] ?? null;
}

export function extractPhone(text: string): string | null {
  return (
    text.match(/(\+?\d[\d\s().-]{7,}\d)/)?.[0]?.replace(/\s{2,}/g, " ").trim() ??
    null
  );
}

export function extractSkills(text: string): string[] {
  const haystack = text.toLowerCase();
  const found = SKILL_DICTIONARY.filter((skill) => {
    const needle = skill.toLowerCase();
    // Word-ish boundary match (handles ".net", "c++", "next.js").
    return new RegExp(`(^|[^a-z0-9+#.])${escapeRegExp(needle)}([^a-z0-9+#.]|$)`).test(
      ` ${haystack} `
    );
  });
  return Array.from(new Set(found));
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9+#.\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  );
}

function keywordOverlapScore(candidate: string, job: string): number {
  const a = tokenize(candidate);
  const b = tokenize(job);
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  Array.from(b).forEach((w) => {
    if (a.has(w)) shared++;
  });
  // Recall against the job's keywords, lightly smoothed.
  return Math.round(Math.min(1, shared / Math.max(8, b.size * 0.6)) * 100);
}

// ----------------------------------------------------------------------------
// Public AI features
// ----------------------------------------------------------------------------

export type ParsedResume = {
  email: string | null;
  phone: string | null;
  skills: string[];
  summary: string;
  source: Source;
};

export async function parseResume(text: string): Promise<ParsedResume> {
  const email = extractEmail(text);
  const phone = extractPhone(text);
  const skills = extractSkills(text);

  let summary = fallbackSummary(text);
  let source: Source = "fallback";
  try {
    const out = await hfRequest<Array<{ summary_text: string }>>(SUMMARY_MODEL, {
      inputs: text.slice(0, 3000),
      parameters: { max_length: 130, min_length: 30 },
    });
    const s = Array.isArray(out) ? out[0]?.summary_text : undefined;
    if (s) {
      summary = s.trim();
      source = "ai";
    }
  } catch {
    // keep deterministic summary
  }

  return { email, phone, skills, summary, source };
}

function fallbackSummary(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const sentences = clean.match(/[^.!?]+[.!?]+/g);
  if (sentences && sentences.length > 0) {
    return sentences.slice(0, 2).join(" ").trim().slice(0, 280);
  }
  return clean.slice(0, 280);
}

export type SkillResult = { skills: string[]; source: Source };

export async function extractSkillSet(text: string): Promise<SkillResult> {
  // The dictionary match is reliable and fast; treat it as the source of truth.
  return { skills: extractSkills(text), source: "fallback" };
}

export type MatchResult = { score: number; rationale: string; source: Source };

export async function matchScore(
  candidateText: string,
  jobText: string
): Promise<MatchResult> {
  if (!candidateText.trim() || !jobText.trim()) {
    return { score: 0, rationale: "Not enough information to score.", source: "fallback" };
  }

  // Try semantic similarity via sentence-transformers embeddings.
  try {
    const out = await hfRequest<number[]>(EMBEDDING_MODEL, {
      inputs: {
        source_sentence: jobText.slice(0, 2000),
        sentences: [candidateText.slice(0, 2000)],
      },
    });
    const sim = Array.isArray(out) ? out[0] : undefined;
    if (typeof sim === "number" && !Number.isNaN(sim)) {
      // Cosine similarity (~0.1–0.8 typical) mapped onto a friendlier 0–100.
      const score = Math.max(0, Math.min(100, Math.round(sim * 120)));
      return {
        score,
        rationale: "Semantic similarity between the résumé and job description.",
        source: "ai",
      };
    }
  } catch {
    // fall through to keyword overlap
  }

  const score = keywordOverlapScore(candidateText, jobText);
  return {
    score,
    rationale: "Keyword overlap between the résumé and job description.",
    source: "fallback",
  };
}
