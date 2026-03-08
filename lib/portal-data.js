import { cache } from "react";
import fs from "node:fs/promises";
import path from "node:path";


const APP_DATA_DIR = path.join(process.cwd(), "app-data");


const readJson = cache(async (fileName) => {
  const filePath = path.join(APP_DATA_DIR, fileName);
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw);
});


export const getOverview = () => readJson("overview.json");
export const getFeaturedItems = () => readJson("featured.json");


let catalogPromise;
let exactMapPromise;


export async function getCatalog() {
  if (!catalogPromise) {
    catalogPromise = readJson("catalog.json");
  }
  return catalogPromise;
}


async function getExactMap() {
  if (!exactMapPromise) {
    exactMapPromise = getCatalog().then((catalog) => {
      const map = new Map();
      for (const item of catalog) {
        map.set(item.normalized_name, item);
      }
      return map;
    });
  }
  return exactMapPromise;
}


export function normalizeText(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


function uniqueTokens(value) {
  return Array.from(new Set(normalizeText(value).split(" ").filter(Boolean)));
}


function tokenScore(a, b) {
  const tokensA = uniqueTokens(a);
  const tokensB = uniqueTokens(b);
  if (!tokensA.length || !tokensB.length) {
    return 0;
  }

  const setB = new Set(tokensB);
  let shared = 0;
  for (const token of tokensA) {
    if (setB.has(token)) {
      shared += 1;
    }
  }

  return shared / Math.max(tokensA.length, tokensB.length);
}


function bigrams(value) {
  const normalized = normalizeText(value);
  if (normalized.length < 2) {
    return new Set(normalized ? [normalized] : []);
  }

  const output = new Set();
  for (let index = 0; index < normalized.length - 1; index += 1) {
    output.add(normalized.slice(index, index + 2));
  }
  return output;
}


function diceScore(a, b) {
  const gramsA = bigrams(a);
  const gramsB = bigrams(b);
  if (!gramsA.size || !gramsB.size) {
    return 0;
  }

  let shared = 0;
  for (const gram of gramsA) {
    if (gramsB.has(gram)) {
      shared += 1;
    }
  }

  return (2 * shared) / (gramsA.size + gramsB.size);
}


function scoreCandidate(input, candidate) {
  const normalizedName = normalizeText(input.name);
  const normalizedDescription = normalizeText(input.description);
  const candidateName = candidate.normalized_name;
  const candidateDescription = normalizeText(candidate.description || "");

  if (!normalizedName || !candidateName) {
    return 0;
  }

  const exact = normalizedName === candidateName ? 1 : 0;
  const contains = normalizedName.includes(candidateName) || candidateName.includes(normalizedName) ? 1 : 0;
  const inputTokens = uniqueTokens(normalizedName);
  const candidateTokens = uniqueTokens(candidateName);
  const candidateTokenSet = new Set(candidateTokens);
  let sharedTokenCount = 0;
  for (const token of inputTokens) {
    if (candidateTokenSet.has(token)) {
      sharedTokenCount += 1;
    }
  }
  const queryCoverage = inputTokens.length ? sharedTokenCount / inputTokens.length : 0;
  const candidateCoverage = candidateTokens.length ? sharedTokenCount / candidateTokens.length : 0;
  const nameDiceScore = diceScore(normalizedName, candidateName);
  const descriptionScore = normalizedDescription ? tokenScore(normalizedDescription, candidateDescription) : 0;
  const cuisineScore =
    input.cuisine && candidate.top_cuisine && normalizeText(input.cuisine) === normalizeText(candidate.top_cuisine) ? 1 : 0;

  if (exact) {
    return 1;
  }

  const structuralBoost = contains || queryCoverage >= 0.99 ? 0.3 : 0;

  return structuralBoost + queryCoverage * 0.3 + candidateCoverage * 0.08 + nameDiceScore * 0.12 + descriptionScore * 0.03 + cuisineScore * 0.02;
}


function confidenceFromMatch(candidate, matchScore, matchType) {
  let score = candidate?.data_confidence || 30;
  score += Math.round(matchScore * 28);

  if (matchType === "fuzzy") {
    score -= 8;
  }

  score = Math.min(96, Math.max(18, score));

  let band = "Low";
  if (score >= 80) {
    band = "High";
  } else if (score >= 60) {
    band = "Medium";
  }

  return { score, band };
}


function summarizeResults(results) {
  const matched = results.filter((item) => item.estimated_energy_kcal != null);
  const highConfidence = matched.filter((item) => item.confidence_band === "High").length;
  const mediumConfidence = matched.filter((item) => item.confidence_band === "Medium").length;
  const lowConfidence = matched.filter((item) => item.confidence_band === "Low").length;

  const averageCalories = matched.length
    ? Math.round(matched.reduce((sum, item) => sum + item.estimated_energy_kcal, 0) / matched.length)
    : 0;
  const averageProtein = matched.length
    ? Math.round((matched.reduce((sum, item) => sum + item.estimated_protein_g, 0) / matched.length) * 10) / 10
    : 0;

  const highestCalorieItem = matched
    .slice()
    .sort((a, b) => (b.estimated_energy_kcal || 0) - (a.estimated_energy_kcal || 0))[0];

  return {
    uploadedCount: results.length,
    matchedCount: matched.length,
    unmatchedCount: results.length - matched.length,
    highConfidence,
    mediumConfidence,
    lowConfidence,
    averageCalories,
    averageProtein,
    highestCalorieItem: highestCalorieItem
      ? {
          name: highestCalorieItem.input_name,
          calories: highestCalorieItem.estimated_energy_kcal,
        }
      : null,
  };
}


export async function estimateMenuItems(items = []) {
  const cleanItems = items
    .map((item, index) => ({
      rowId: item.rowId || `row-${index + 1}`,
      name: String(item.name || "").trim(),
      description: String(item.description || "").trim(),
      cuisine: String(item.cuisine || "").trim(),
      price: String(item.price || "").trim(),
    }))
    .filter((item) => item.name);

  const limitedItems = cleanItems.slice(0, 80);
  const catalog = await getCatalog();
  const exactMap = await getExactMap();

  const results = limitedItems.map((item) => {
    const normalizedName = normalizeText(item.name);
    const exactMatch = exactMap.get(normalizedName);

    if (exactMatch) {
      const confidence = confidenceFromMatch(exactMatch, 1, "exact");
      return {
        row_id: item.rowId,
        input_name: item.name,
        input_description: item.description,
        input_cuisine: item.cuisine,
        matched_name: exactMatch.display_name,
        matched_cuisine: exactMatch.top_cuisine || exactMatch.reference_cuisine || exactMatch.train_cuisine || "Unknown",
        estimated_energy_kcal: exactMatch.predicted_energy_kcal,
        estimated_protein_g: exactMatch.predicted_protein_g,
        support_count: exactMatch.support_count,
        match_type: "Exact catalog match",
        match_score: 100,
        confidence_score: confidence.score,
        confidence_band: confidence.band,
        rationale: `Matched directly to ${exactMatch.display_name} using ${exactMatch.support_count} modeled Swiggy rows.`,
        source_lineage: exactMatch.top_parent || exactMatch.train_restaurant || "Swiggy catalog model",
      };
    }

    let bestCandidate = null;
    let bestScore = 0;

    for (const candidate of catalog) {
      if (!candidate.normalized_name) {
        continue;
      }

      const score = scoreCandidate(item, candidate);
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = candidate;
      }
    }

    if (!bestCandidate || bestScore < 0.58) {
      return {
        row_id: item.rowId,
        input_name: item.name,
        input_description: item.description,
        input_cuisine: item.cuisine,
        matched_name: null,
        matched_cuisine: null,
        estimated_energy_kcal: null,
        estimated_protein_g: null,
        support_count: 0,
        match_type: "No confident match",
        match_score: Math.round(bestScore * 100),
        confidence_score: 24,
        confidence_band: "Low",
        rationale: "No stable catalog analogue was found in the current V1 lookup layer.",
        source_lineage: "Manual review required",
      };
    }

    const confidence = confidenceFromMatch(bestCandidate, bestScore, "fuzzy");
    return {
      row_id: item.rowId,
      input_name: item.name,
      input_description: item.description,
      input_cuisine: item.cuisine,
      matched_name: bestCandidate.display_name,
      matched_cuisine: bestCandidate.top_cuisine || bestCandidate.reference_cuisine || bestCandidate.train_cuisine || "Unknown",
      estimated_energy_kcal: bestCandidate.predicted_energy_kcal,
      estimated_protein_g: bestCandidate.predicted_protein_g,
      support_count: bestCandidate.support_count,
      match_type: "Closest catalog analogue",
      match_score: Math.round(bestScore * 100),
      confidence_score: confidence.score,
      confidence_band: confidence.band,
      rationale: `Matched to ${bestCandidate.display_name} as the nearest modeled analogue with ${bestCandidate.support_count} historical rows.`,
      source_lineage: bestCandidate.top_parent || bestCandidate.train_restaurant || "Swiggy catalog model",
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    summary: summarizeResults(results),
    results,
  };
}
