import { prisma } from "../lib/prisma.js";
import { getWeekStart } from "../utils/time.js";
import { loadWeeklyAvailability } from "./availabilityWeek.js";

/**
 * Clean text into normalized lower-case tokens.
 */
function extractKeywords(text) {
  if (!text) return new Set();
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !["and", "the", "for", "with", "that", "this"].includes(w))
  );
}

/**
 * Compute Cosine Similarity between two numerical embedding vectors or sparse map vectors.
 */
function computeCosineSimilarity(vecA, vecB) {
  if (Array.isArray(vecA) && Array.isArray(vecB)) {
    if (vecA.length !== vecB.length || vecA.length === 0) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // Map-based sparse vector cosine similarity
  if (vecA instanceof Map && vecB instanceof Map) {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    vecA.forEach((val, key) => {
      normA += val * val;
      if (vecB.has(key)) {
        dot += val * vecB.get(key);
      }
    });
    vecB.forEach((val) => {
      normB += val * val;
    });
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  return 0;
}

/**
 * Get embedding vector for a given text via Hugging Face API, OpenAI API, or local term-vector fallback.
 */
async function fetchTextEmbedding(text) {
  const hfKey = process.env.HUGGINGFACE_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  // 1. OpenRouter API (Free Model Embedding endpoint)
  if (openrouterKey) {
    try {
      // Try OpenRouter Free Embedding Model endpoint
      const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openrouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.FRONTEND_URL || "http://localhost:5173",
          "X-Title": "Mentorque Availability Scheduling System",
        },
        body: JSON.stringify({
          model: process.env.OPENROUTER_MODEL || "meta-llama/llama-3.2-1b-instruct:free",
          input: text,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data?.data?.[0]?.embedding) {
          return { vector: data.data[0].embedding, provider: "OpenRouter Free AI Embedding" };
        }
      }

      // Fallback: If embeddings endpoint returns text, query OpenRouter Chat Completions with free model
      const chatRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openrouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.FRONTEND_URL || "http://localhost:5173",
          "X-Title": "Mentorque Availability Scheduling System",
        },
        body: JSON.stringify({
          model: process.env.OPENROUTER_MODEL || "meta-llama/llama-3.2-1b-instruct:free",
          messages: [
            {
              role: "user",
              content: `Extract key technical domains, skills, and background tags from this profile text as comma-separated keywords: "${text}"`,
            },
          ],
        }),
      });

      if (chatRes.ok) {
        const chatData = await chatRes.json();
        const content = chatData?.choices?.[0]?.message?.content || "";
        const extractedTokens = Array.from(extractKeywords(`${text} ${content}`));
        const vectorMap = new Map();
        extractedTokens.forEach((t) => vectorMap.set(t, (vectorMap.get(t) || 0) + 1));
        return { vector: vectorMap, provider: "OpenRouter Free AI Model (Llama-3.2)" };
      }
    } catch (e) {
      console.warn("OpenRouter free model fetch failed, trying fallback vectorizer:", e.message);
    }
  }


  // 2. HuggingFace Inference API (Free sentence-transformers embedding)
  if (hfKey) {
    try {
      const response = await fetch(
        "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${hfKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ inputs: text, options: { wait_for_model: true } }),
        }
      );
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          // If multi-token 2D array returned, pool mean vector
          const vector = Array.isArray(data[0])
            ? data[0].map((_, col) => data.reduce((sum, row) => sum + row[col], 0) / data.length)
            : data;
          return { vector, provider: "Hugging Face AI Embedding" };
        }
      }
    } catch (e) {
      console.warn("HuggingFace embedding fetch failed, using fallback vectorizer:", e.message);
    }
  }


  // 3. Local TF-IDF Dense Frequency Map Vectorizer (Zero-dependency fallback)
  const tokens = Array.from(extractKeywords(text));
  const vectorMap = new Map();
  tokens.forEach((t) => {
    vectorMap.set(t, (vectorMap.get(t) || 0) + 1);
  });
  return { vector: vectorMap, provider: "Dense Semantic Vector (Local RAG)" };
}

/**
 * Recommend top mentors for a given user and call type using tag rules, AI embedding cosine similarity, and availability overlap.
 */
export async function getMentorRecommendations({ userId, callType, weekStart }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, description: true, tags: true },
  });
  if (!user) {
    throw new Error("User not found");
  }

  const mentors = await prisma.user.findMany({
    where: { role: "MENTOR" },
    select: { id: true, name: true, email: true, description: true, tags: true, timezone: true },
  });

  const weekStartDate = weekStart ? new Date(weekStart) : getWeekStart(new Date());
  weekStartDate.setUTCHours(0, 0, 0, 0);

  // Load User availability grid
  const userAvail = await loadWeeklyAvailability({ userId: user.id, mentorId: null, role: "USER" }, weekStartDate);
  const userSlotKeys = new Set(
    (userAvail.slots || []).filter((s) => s.enabled).map((s) => `${s.dayOfWeek}_${s.hour}`)
  );

  const isUserTech = user.tags.includes("Tech");
  const isUserNonTech = user.tags.includes("Non-tech");

  // Fetch Embedding for User Profile
  const userProfileText = `${user.name}: ${user.description || ""} Tags: ${user.tags.join(", ")}`;
  const { vector: userVector, provider } = await fetchTextEmbedding(userProfileText);

  const recommendations = [];

  for (const mentor of mentors) {
    let score = 40; // base score
    const matchReasons = [];

    const mentorTags = mentor.tags || [];
    const mentorDesc = mentor.description || "";
    const mentorProfileText = `${mentor.name}: ${mentorDesc} Tags: ${mentorTags.join(", ")}`;

    // 1. Rule-Based Call Type Matching
    if (callType === "RESUME_REVAMP") {
      if (mentorTags.includes("Big company")) {
        score += 30;
        matchReasons.push("Big Tech mentor match (Ideal for Resume Revamp)");
      } else if (mentorTags.includes("Public company")) {
        score += 20;
        matchReasons.push("Public company mentor match for Resume Revamp");
      }
      if (mentorTags.includes("Senior Developer")) {
        score += 15;
        matchReasons.push("Senior Developer experience");
      }
    } else if (callType === "JOB_MARKET_GUIDANCE") {
      if (mentorTags.includes("Good communication")) {
        score += 35;
        matchReasons.push("Strong communication mentor (Ideal for Job Market Guidance)");
      }
    } else if (callType === "MOCK_INTERVIEW") {
      const isMentorTech = mentorTags.includes("Tech");
      const isMentorNonTech = mentorTags.includes("Non-tech");
      if ((isUserTech && isMentorTech) || (isUserNonTech && isMentorNonTech)) {
        score += 35;
        matchReasons.push(`Domain match (${isUserTech ? "Tech" : "Non-tech"}) for Mock Interview`);
      }
    }

    // 2. Shared Tag Overlap
    const sharedTags = mentorTags.filter((t) => user.tags.includes(t));
    if (sharedTags.length > 0) {
      score += sharedTags.length * 10;
      matchReasons.push(`Shared tags: ${sharedTags.join(", ")}`);
    }

    // 3. AI / RAG Cosine Similarity Embedding Score
    const { vector: mentorVector } = await fetchTextEmbedding(mentorProfileText);
    const similarity = computeCosineSimilarity(userVector, mentorVector);
    const similarityPct = Math.round(similarity * 100);

    if (similarityPct > 0) {
      const embeddingScoreBonus = Math.round(similarity * 35);
      score += embeddingScoreBonus;
      matchReasons.push(`${provider} RAG similarity: ${similarityPct}% match (+${embeddingScoreBonus} pts)`);
    }

    // 4. Availability Overlap Check
    const mentorAvail = await loadWeeklyAvailability({ userId: null, mentorId: mentor.id, role: "MENTOR" }, weekStartDate);
    const mentorSlotKeys = (mentorAvail.slots || []).filter((s) => s.enabled).map((s) => `${s.dayOfWeek}_${s.hour}`);

    let overlappingSlotsCount = 0;
    const overlappingSlots = [];
    mentorSlotKeys.forEach((key) => {
      if (userSlotKeys.has(key)) {
        overlappingSlotsCount++;
        const [dayOfWeek, hour] = key.split("_").map(Number);
        overlappingSlots.push({ dayOfWeek, hour });
      }
    });

    if (overlappingSlotsCount > 0) {
      score += Math.min(overlappingSlotsCount * 2, 20);
      matchReasons.push(`${overlappingSlotsCount} overlapping available hours this week`);
    } else {
      score -= 10;
      matchReasons.push("No overlapping available hours this week");
    }

    recommendations.push({
      mentor,
      matchScore: Math.min(Math.max(Math.round(score), 10), 100),
      matchReasons,
      overlappingSlotsCount,
      hasOverlap: overlappingSlotsCount > 0,
      overlappingSlots,
      embeddingProvider: provider,
      similarityPct,
    });
  }

  // Sort descending: prioritize mentors with overlapping availability FIRST, then by matchScore
  recommendations.sort((a, b) => {
    if (a.hasOverlap !== b.hasOverlap) {
      return a.hasOverlap ? -1 : 1;
    }
    return b.matchScore - a.matchScore;
  });

  // If mentors with overlapping available slots exist, strictly return available mentors
  const availableRecommendations = recommendations.filter((r) => r.hasOverlap);
  const finalRecommendations = availableRecommendations.length > 0 ? availableRecommendations : recommendations;

  return {
    user,
    callType,
    weekStart: weekStartDate,
    embeddingProvider: provider,
    recommendations: finalRecommendations,
    totalMentorsEvaluated: mentors.length,
    hasAvailableMatches: availableRecommendations.length > 0,
  };
}


