import { cache } from "react";
import fs from "node:fs/promises";
import path from "node:path";

import OpenAI from "openai";
import Papa from "papaparse";


const SOURCE_ROOT = path.join(process.cwd(), "..");
const APP_DATA_DIR = path.join(process.cwd(), "app-data");
const LEGACY_DIR = path.join(SOURCE_ROOT, "High Protein Estimator (version 1)");
const ICMR_PATH = path.join(LEGACY_DIR, "nutritional_100gm_db.csv");
const RECORDS_PATH = path.join(APP_DATA_DIR, "genai-reference-records.json");
const EMBEDDINGS_PATH = path.join(APP_DATA_DIR, "genai-reference-embeddings.f32");
const MANIFEST_PATH = path.join(APP_DATA_DIR, "genai-reference-manifest.json");

const DEFAULT_RESPONSES_MODEL = process.env.OPENAI_RESPONSES_MODEL || "gpt-4.1-mini";
const DEFAULT_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
const DEFAULT_BACKEND_MODE = process.env.OPENAI_NUTRITION_BACKEND || "auto";
const TOP_K_NEIGHBORS = 3;
const RERANK_CANDIDATES = 8;
const MAX_CONCURRENCY = 3;

const HELPER_RULES = [
  {
    id: "paneer-curries",
    text: "Paneer curries often land around 15-20 g protein and 500-700 kcal per serving, depending on gravy richness and portion size.",
    keywords: ["paneer", "butter masala", "tikka masala", "kadhai", "curry"],
  },
  {
    id: "chicken-biryani",
    text: "Chicken biryani often lands around 25-35 g protein and 650-800 kcal per serving, depending on rice quantity and oil or ghee use.",
    keywords: ["biryani", "chicken"],
  },
  {
    id: "dal-lentil",
    text: "Dal and lentil bowls often land around 10-15 g protein and 300-450 kcal per serving, depending on tempering fat and serving size.",
    keywords: ["dal", "lentil", "rajma", "chole"],
  },
  {
    id: "fried-snacks",
    text: "Fried snack portions often land around 4-8 g protein and 200-350 kcal per serving, depending on filling and fry medium.",
    keywords: ["fried", "pakoda", "samosa", "roll", "snack"],
  },
  {
    id: "fried-rice-noodles",
    text: "Fried rice and noodle mains usually depend on rice or noodle volume, added oil, and protein mix, so calories can rise quickly even when protein stays moderate.",
    keywords: ["fried rice", "noodles", "hakka", "rice", "schezwan"],
  },
];

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    reasoning_trace: { type: "string" },
    estimated_protein_g: { anyOf: [{ type: "number" }, { type: "null" }] },
    estimated_energy_kcal: { anyOf: [{ type: "number" }, { type: "null" }] },
    protein_confidence_percent: { anyOf: [{ type: "number" }, { type: "null" }] },
    protein_confidence_band: {
      anyOf: [{ type: "string", enum: ["High", "Medium", "Low"] }, { type: "null" }],
    },
    energy_confidence_percent: { anyOf: [{ type: "number" }, { type: "null" }] },
    energy_confidence_band: {
      anyOf: [{ type: "string", enum: ["High", "Medium", "Low"] }, { type: "null" }],
    },
    extracted_protein_g: { anyOf: [{ type: "number" }, { type: "null" }] },
    extracted_energy_kcal: { anyOf: [{ type: "number" }, { type: "null" }] },
    source_usage: {
      type: "object",
      additionalProperties: false,
      properties: {
        used_similar_items: { type: "boolean" },
        used_icmr: { type: "boolean" },
        used_helper_rules: { type: "boolean" },
        price_considered_lightly: { type: "boolean" },
      },
      required: ["used_similar_items", "used_icmr", "used_helper_rules", "price_considered_lightly"],
    },
  },
  required: [
    "reasoning_trace",
    "estimated_protein_g",
    "estimated_energy_kcal",
    "protein_confidence_percent",
    "protein_confidence_band",
    "energy_confidence_percent",
    "energy_confidence_band",
    "extracted_protein_g",
    "extracted_energy_kcal",
    "source_usage",
  ],
};

let assetsPromise;
let openAiClient;


function normalizeText(value = "") {
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


function parseNumericValue(value) {
  if (value == null || value === "") {
    return null;
  }

  const parsed = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}


function roundValue(value, digits = 1) {
  if (!Number.isFinite(value)) {
    return null;
  }
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}


function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}


function confidenceBandFromPercent(value) {
  if (!Number.isFinite(value)) {
    return null;
  }
  if (value >= 80) {
    return "High";
  }
  if (value >= 60) {
    return "Medium";
  }
  return "Low";
}


function normalizePercent(value) {
  if (!Number.isFinite(value)) {
    return null;
  }
  return Math.round(clamp(value, 0, 100));
}


function normalizeVector(vector) {
  const norm = Math.hypot(...vector);
  if (!norm) {
    return vector.map(() => 0);
  }
  return vector.map((value) => value / norm);
}


function dotProduct(matrix, rowIndex, vector, dimensions) {
  let total = 0;
  const offset = rowIndex * dimensions;
  for (let index = 0; index < dimensions; index += 1) {
    total += matrix[offset + index] * vector[index];
  }
  return total;
}


function extractFirstNumericMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) {
      continue;
    }

    const parsed = Number(match[1]);
    if (Number.isFinite(parsed)) {
      return roundValue(parsed);
    }
  }

  return null;
}


function extractExplicitNutritionFromDescription(description) {
  const normalized = String(description || "").trim();
  if (!normalized) {
    return {
      extracted_protein_g: null,
      extracted_energy_kcal: null,
      source_field: null,
    };
  }

  const proteinPatterns = [
    /(?:^|[\s(:,;])(\d+(?:\.\d+)?)\s*(?:g|gm|grams?)\s*(?:of\s*)?protein\b/i,
    /\bprotein\b[^0-9]{0,12}(\d+(?:\.\d+)?)\s*(?:g|gm|grams?)\b/i,
  ];
  const energyPatterns = [
    /(?:^|[\s(:,;])(\d+(?:\.\d+)?)\s*(?:kcal|kcals|calories?)\b/i,
    /\b(?:energy|calories?)\b[^0-9]{0,12}(\d+(?:\.\d+)?)\s*(?:kcal|kcals|calories?)?\b/i,
  ];

  const extractedProtein = extractFirstNumericMatch(normalized, proteinPatterns);
  const extractedEnergy = extractFirstNumericMatch(normalized, energyPatterns);

  return {
    extracted_protein_g: extractedProtein,
    extracted_energy_kcal: extractedEnergy,
    source_field: extractedProtein != null || extractedEnergy != null ? "ITEM_DESCRIPTION" : null,
  };
}


function priceBand(value) {
  const numeric = parseNumericValue(value);
  if (numeric == null) {
    return null;
  }
  if (numeric < 100) {
    return "under-100";
  }
  if (numeric < 200) {
    return "100-199";
  }
  if (numeric < 300) {
    return "200-299";
  }
  if (numeric < 500) {
    return "300-499";
  }
  return "500-plus";
}


function buildQueryBlob(item) {
  const parts = [
    `item_name: ${item.name || ""}`,
    `item_description: ${item.description || ""}`,
    `cuisine: ${item.cuisine || ""}`,
    `item_grammage: ${item.grammage || ""}`,
    `main_ingredient_1: ${item.mainIngredient1 || ""}`,
    `main_ingredient_2: ${item.mainIngredient2 || ""}`,
    `main_ingredient_3: ${item.mainIngredient3 || ""}`,
    `compulsory_components: ${item.compulsoryComponents || ""}`,
    `optional_components: ${item.optionalComponents || ""}`,
    `item_price_band: ${priceBand(item.price) || ""}`,
  ];

  return normalizeText(parts.filter(Boolean).join(" | "));
}


function buildInputPayload(item) {
  return {
    RID: item.rid || null,
    ITEM_NAME: item.name || null,
    ITEM_DESCRIPTION: item.description || null,
    RX_CUISINE: item.cuisine || null,
    ITEM_PRICE: item.price || null,
    ITEM_GRAMMAGE: item.grammage || null,
    MAIN_INGREDIENT_1: item.mainIngredient1 || null,
    MAIN_INGREDIENT_2: item.mainIngredient2 || null,
    MAIN_INGREDIENT_3: item.mainIngredient3 || null,
    MAIN_INGREDIENT_1_GRAMMAGE: item.mainIngredient1Grammage || null,
    MAIN_INGREDIENT_2_GRAMMAGE: item.mainIngredient2Grammage || null,
    MAIN_INGREDIENT_3_GRAMMAGE: item.mainIngredient3Grammage || null,
    COMPULSORY_COMPONENTS: item.compulsoryComponents || null,
    OPTIONAL_COMPONENTS: item.optionalComponents || null,
  };
}


function summarizeResults(results) {
  const matched = results.filter((item) => item.estimated_energy_kcal != null);
  const highConfidence = matched.filter((item) => item.confidence_band === "High").length;
  const mediumConfidence = matched.filter((item) => item.confidence_band === "Medium").length;
  const lowConfidence = matched.filter((item) => item.confidence_band === "Low").length;
  const extractedProteinCount = results.filter((item) => item.extracted_protein_g != null).length;
  const extractedEnergyCount = results.filter((item) => item.extracted_energy_kcal != null).length;

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
    extractedProteinCount,
    extractedEnergyCount,
    highestCalorieItem: highestCalorieItem
      ? {
          name: highestCalorieItem.input_name,
          calories: highestCalorieItem.estimated_energy_kcal,
        }
      : null,
  };
}


function formatNeighbor(neighbor, index) {
  return [
    `${index + 1}. ITEM_NAME: ${neighbor.ITEM_NAME || "Unknown"}`,
    `ITEM_DESCRIPTION: ${neighbor.ITEM_DESCRIPTION || "Not available"}`,
    `PROTEIN_GM: ${neighbor.PROTEIN_GM ?? "Unknown"}`,
    `ENERGY_KCAL: ${neighbor.ENERGY_KCAL ?? "Unknown"}`,
    `DISH_TYPE: ${neighbor.DISH_TYPE || "Unknown"}`,
    `DISH_FAMILY: ${neighbor.DISH_FAMILY || "Unknown"}`,
    `RX_CUISINE: ${neighbor.RX_CUISINE || "Unknown"}`,
    `ITEM_PRICE: ${neighbor.ITEM_PRICE ?? "Unknown"}`,
    `SIMILARITY: ${roundValue(neighbor.retrieval_score, 3) ?? "Unknown"}`,
  ].join(" | ");
}


function buildHelperRules(item) {
  const corpus = normalizeText(
    [
      item.name,
      item.description,
      item.cuisine,
      item.mainIngredient1,
      item.mainIngredient2,
      item.mainIngredient3,
      item.compulsoryComponents,
      item.optionalComponents,
    ]
      .filter(Boolean)
      .join(" ")
  );

  const rules = HELPER_RULES.filter((rule) =>
    rule.keywords.some((keyword) => corpus.includes(normalizeText(keyword)))
  );

  return rules.length ? rules : HELPER_RULES.slice(0, 2);
}


function buildPrompt({ item, neighbors, icmrMatches, helperRules, extractedValues }) {
  const itemBlock = [
    "NEW ITEM TO ESTIMATE",
    `RID: ${item.rid}`,
    `ITEM_NAME: ${item.name || ""}`,
    `ITEM_DESCRIPTION: ${item.description || ""}`,
    `RX_CUISINE: ${item.cuisine || ""}`,
    `ITEM_PRICE: ${item.price || ""}`,
    `ITEM_GRAMMAGE: ${item.grammage || ""}`,
    `MAIN_INGREDIENT_1: ${item.mainIngredient1 || ""}`,
    `MAIN_INGREDIENT_2: ${item.mainIngredient2 || ""}`,
    `MAIN_INGREDIENT_3: ${item.mainIngredient3 || ""}`,
    `MAIN_INGREDIENT_1_GRAMMAGE: ${item.mainIngredient1Grammage || ""}`,
    `MAIN_INGREDIENT_2_GRAMMAGE: ${item.mainIngredient2Grammage || ""}`,
    `MAIN_INGREDIENT_3_GRAMMAGE: ${item.mainIngredient3Grammage || ""}`,
    `COMPULSORY_COMPONENTS: ${item.compulsoryComponents || ""}`,
    `OPTIONAL_COMPONENTS: ${item.optionalComponents || ""}`,
    `ITEM_PRICE_HINT: Use only as a weak dish-level signal. Do not infer premium restaurant pricing as higher calories by itself.`,
  ].join("\n");

  const neighborBlock = neighbors.length
    ? neighbors.map((neighbor, index) => formatNeighbor(neighbor, index)).join("\n")
    : "No retrieved similar items were available.";

  const icmrBlock = icmrMatches.length
    ? icmrMatches
        .map(
          (match, index) =>
            `${index + 1}. ${match.name} | Protein ${match.protein_per_100g} g/100g | Energy ${match.energy_per_100g} kcal/100g | Similarity ${match.similarity_percent}`
        )
        .join("\n")
    : "No reliable ICMR ingredient matches were found.";

  const helperBlock = helperRules.map((rule, index) => `${index + 1}. ${rule.text}`).join("\n");

  const extractionBlock =
    extractedValues.extracted_protein_g != null || extractedValues.extracted_energy_kcal != null
      ? `EXPLICIT VALUES FOUND IN ITEM_DESCRIPTION\nextracted_protein_g: ${extractedValues.extracted_protein_g ?? "null"}\nextracted_energy_kcal: ${extractedValues.extracted_energy_kcal ?? "null"}\nThese values must be copied into extracted_* output fields but should not override the independent estimate.`
      : "EXPLICIT VALUES FOUND IN ITEM_DESCRIPTION\nNo explicit protein or calorie values were detected by preprocessing.";

  const systemPrompt = [
    "You are an expert food nutritionist and data analyst.",
    "Estimate protein and energy for the NEW ITEM using the retrieved similar items, the ICMR ingredient references, and the helper rules.",
    "Use only the most relevant references.",
    "Treat ITEM_PRICE as a weak contextual tie-breaker only. It is item price, not restaurant price, and must never dominate dish identity.",
    "Return only valid JSON matching the schema.",
    "Give separate confidence percentages and bands for protein and energy.",
    "Keep reasoning_trace to one sentence.",
  ].join(" ");

  const userPrompt = [
    itemBlock,
    "",
    "RETRIEVED SIMILAR ITEMS",
    neighborBlock,
    "",
    "ICMR INGREDIENT REFERENCES",
    icmrBlock,
    "",
    "HELPER RULES",
    helperBlock,
    "",
    extractionBlock,
    "",
    "TASK",
    "Produce unbiased estimates for estimated_protein_g and estimated_energy_kcal, plus separate confidence fields.",
    "If evidence is weak, lower the confidence instead of guessing with high confidence.",
    "Use null only if the estimate truly cannot be supported.",
  ].join("\n");

  return { systemPrompt, userPrompt };
}


function parseResponseOutput(response) {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }

  const collected = [];
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.text) {
        collected.push(content.text);
      }
    }
  }

  return collected.join("").trim();
}


function formatFallbackReason(code) {
  switch (code) {
    case "backend_disabled":
      return "GenAI mode is disabled by configuration, so the portal fell back to deterministic V1.";
    case "missing_api_key":
      return "OPENAI_API_KEY is not configured, so the portal fell back to deterministic V1.";
    case "missing_assets":
      return "GenAI vector assets are missing, so the portal fell back to deterministic V1.";
    case "asset_load_failed":
      return "GenAI vector assets could not be loaded, so the portal fell back to deterministic V1.";
    case "openai_error":
      return "The OpenAI request failed, so the portal fell back to deterministic V1.";
    default:
      return "The GenAI backend was unavailable, so the portal fell back to deterministic V1.";
  }
}


const readIcmr = cache(async () => {
  const raw = await fs.readFile(ICMR_PATH, "utf-8");
  const parsed = Papa.parse(raw, {
    header: true,
    skipEmptyLines: true,
  });

  return parsed.data.map((row) => ({
    name: row.Ingredient_name || row.ingredient_name || "",
    protein_per_100g: parseNumericValue(row.protein_per_100g),
    energy_per_100g: parseNumericValue(row.energy_per_100g),
    carbs_per_100g: parseNumericValue(row.carbs_per_100g),
    fat_per_100g: parseNumericValue(row.fat_per_100g),
  }));
});


async function loadGenAiAssets() {
  if (assetsPromise) {
    return assetsPromise;
  }

  assetsPromise = (async () => {
    const [manifestRaw, recordsRaw, embeddingsRaw] = await Promise.all([
      fs.readFile(MANIFEST_PATH, "utf-8"),
      fs.readFile(RECORDS_PATH, "utf-8"),
      fs.readFile(EMBEDDINGS_PATH),
    ]);

    const manifest = JSON.parse(manifestRaw);
    const records = JSON.parse(recordsRaw);
    const embeddings = new Float32Array(
      embeddingsRaw.buffer,
      embeddingsRaw.byteOffset,
      embeddingsRaw.byteLength / Float32Array.BYTES_PER_ELEMENT
    );

    if (manifest.count !== records.length) {
      throw new Error("GenAI asset manifest count does not match record count.");
    }
    if (manifest.count * manifest.dimensions !== embeddings.length) {
      throw new Error("GenAI asset manifest dimensions do not match embedding matrix length.");
    }

    return {
      manifest,
      records,
      embeddings,
    };
  })();

  try {
    return await assetsPromise;
  } catch (error) {
    assetsPromise = null;
    throw error;
  }
}


function getOpenAIClient() {
  if (!openAiClient) {
    openAiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      organization: process.env.OPENAI_ORGANIZATION || undefined,
      project: process.env.OPENAI_PROJECT || process.env.OPENAI_PROJECT_ID || undefined,
    });
  }

  return openAiClient;
}


function getGenAiReadiness() {
  if (DEFAULT_BACKEND_MODE === "v1" || DEFAULT_BACKEND_MODE === "off") {
    return {
      enabled: false,
      reasonCode: "backend_disabled",
      detail: formatFallbackReason("backend_disabled"),
    };
  }

  if (!process.env.OPENAI_API_KEY) {
    return {
      enabled: false,
      reasonCode: "missing_api_key",
      detail: formatFallbackReason("missing_api_key"),
    };
  }

  return { enabled: true };
}


function priceRerankBoost(itemPrice, candidatePrice) {
  if (itemPrice == null || candidatePrice == null) {
    return 0;
  }

  const width = Math.max(candidatePrice * 0.35, 60);
  const closeness = clamp(1 - Math.abs(itemPrice - candidatePrice) / width, 0, 1);
  return roundValue(closeness * 0.02, 4) || 0;
}


function retrieveNeighbors(queryVector, assets, item) {
  const ranked = [];
  for (let index = 0; index < assets.manifest.count; index += 1) {
    const baseScore = dotProduct(assets.embeddings, index, queryVector, assets.manifest.dimensions);
    ranked.push({
      ...assets.records[index],
      retrieval_score: baseScore,
      price_rerank_boost: 0,
      final_score: baseScore,
    });
  }

  ranked.sort((a, b) => b.retrieval_score - a.retrieval_score);
  const topCandidates = ranked.slice(0, RERANK_CANDIDATES).map((candidate) => {
    const boost = priceRerankBoost(parseNumericValue(item.price), candidate.ITEM_PRICE);
    return {
      ...candidate,
      price_rerank_boost: boost,
      final_score: candidate.retrieval_score + boost,
    };
  });

  topCandidates.sort((a, b) => b.final_score - a.final_score);

  return topCandidates.slice(0, TOP_K_NEIGHBORS).map((candidate) => ({
    ...candidate,
    similarity_percent: Math.round(clamp(candidate.final_score, 0, 1) * 100),
  }));
}


async function lookupIcmrMatches(item) {
  const icmr = await readIcmr();
  const candidateTexts = [
    item.name,
    item.description,
    item.mainIngredient1,
    item.mainIngredient2,
    item.mainIngredient3,
    item.compulsoryComponents,
    item.optionalComponents,
  ].filter(Boolean);

  const matches = icmr
    .map((reference) => {
      const score = candidateTexts.reduce((best, text) => {
        const normalizedIngredient = normalizeText(reference.name);
        const exact = normalizeText(text).includes(normalizedIngredient) ? 1 : 0;
        return Math.max(best, exact, tokenScore(text, reference.name), diceScore(text, reference.name));
      }, 0);

      return {
        ...reference,
        similarity_score: score,
        similarity_percent: Math.round(score * 100),
      };
    })
    .filter((match) => match.similarity_score >= 0.55)
    .sort((a, b) => b.similarity_score - a.similarity_score)
    .slice(0, 5);

  return matches;
}


async function getQueryEmbeddings(queryBlobs, embeddingModel, dimensions) {
  const client = getOpenAIClient();
  const params = {
    model: embeddingModel || DEFAULT_EMBEDDING_MODEL,
    input: queryBlobs,
  };
  if (dimensions) {
    params.dimensions = dimensions;
  }

  const response = await client.embeddings.create(params);
  return response.data.map((item) => normalizeVector(item.embedding));
}

function buildExplainability(item, row, neighbors, icmrMatches, helperRules, extractedValues, parsed) {
  const signalsChecked = ["ITEM_NAME"];
  if (item.description) {
    signalsChecked.push("ITEM_DESCRIPTION");
  }
  if (item.cuisine) {
    signalsChecked.push("RX_CUISINE");
  }
  if (item.mainIngredient1 || item.mainIngredient2 || item.mainIngredient3) {
    signalsChecked.push("MAIN_INGREDIENTS");
  }
  if (item.compulsoryComponents || item.optionalComponents) {
    signalsChecked.push("DISH_COMPONENTS");
  }
  if (item.price) {
    signalsChecked.push("ITEM_PRICE");
  }
  if (item.grammage) {
    signalsChecked.push("ITEM_GRAMMAGE");
  }

  const signalsHelped = ["ITEM_NAME"];
  if (parsed.source_usage.used_similar_items) {
    signalsHelped.push("RETRIEVED_SIMILAR_ITEMS");
  }
  if (parsed.source_usage.used_icmr) {
    signalsHelped.push("ICMR_REFERENCES");
  }
  if (parsed.source_usage.used_helper_rules) {
    signalsHelped.push("HELPER_RULES");
  }
  if (parsed.source_usage.price_considered_lightly) {
    signalsHelped.push("ITEM_PRICE");
  }
  if (item.description) {
    signalsHelped.push("ITEM_DESCRIPTION");
  }

  const capturedNotUsed = [];
  if (item.grammage) {
    capturedNotUsed.push("ITEM_GRAMMAGE");
  }
  if (item.mainIngredient1Grammage || item.mainIngredient2Grammage || item.mainIngredient3Grammage) {
    capturedNotUsed.push("MAIN_INGREDIENT_GRAMMAGES");
  }

  return {
    reasoning_trace: row.reasoning_trace,
    detailed_rationale: row.rationale,
    match: {
      matched_name: row.matched_name,
      matched_cuisine: row.matched_cuisine,
      match_type: row.match_type,
      match_score_percent: row.match_score,
      support_count: row.support_count,
      source_lineage: row.source_lineage,
    },
    inputs: {
      required_partner_inputs: ["RID", "ITEM_NAME", "ITEM_PRICE"],
      provided_optional_fields: Object.entries(buildInputPayload(item))
        .filter(([key, value]) => !["RID", "ITEM_NAME", "ITEM_PRICE"].includes(key) && value)
        .map(([key]) => key),
      signals_checked_by_v1: [],
      signals_checked_by_genai: signalsChecked,
      signals_that_helped_this_match: Array.from(new Set(signalsHelped)),
      captured_but_not_used_by_v1: capturedNotUsed,
      explicit_values_found_in_description: {
        available: extractedValues.extracted_protein_g != null || extractedValues.extracted_energy_kcal != null,
        extracted_protein_g: extractedValues.extracted_protein_g,
        extracted_energy_kcal: extractedValues.extracted_energy_kcal,
        source_field: extractedValues.source_field,
      },
    },
    price_signal: {
      boost: row.retrieval?.price_rerank_boost ?? 0,
      status: parsed.source_usage.price_considered_lightly ? "applied_lightly" : "ignored_or_negligible",
      note: parsed.source_usage.price_considered_lightly
        ? "Item price was only used as a weak dish-level tie-breaker after retrieval."
        : "Item price did not materially affect the estimate.",
    },
    retrieval: {
      neighbors,
      icmr_matches: icmrMatches,
      helper_rules: helperRules.map((rule) => rule.text),
    },
    scoring_snapshot: {
      top_neighbor_similarity: neighbors[0]?.similarity_percent ?? null,
      top_neighbor_price_rerank_boost: row.retrieval?.price_rerank_boost ?? 0,
    },
    estimator_note:
      "This row was estimated by the GenAI retrieval backend using retrieved similar items, ICMR ingredient references, helper rules, and a structured OpenAI response.",
  };
}


function buildOutputDetail(parsed, extractedValues, finalConfidencePercent, finalConfidenceBand) {
  return {
    reasoning_trace: parsed.reasoning_trace,
    estimated_protein_g: parsed.estimated_protein_g,
    estimated_energy_kcal: parsed.estimated_energy_kcal,
    estimation_confidence: finalConfidenceBand,
    confidence_percent: finalConfidencePercent,
    extracted_protein_g:
      extractedValues.extracted_protein_g ?? parsed.extracted_protein_g ?? null,
    extracted_energy_kcal:
      extractedValues.extracted_energy_kcal ?? parsed.extracted_energy_kcal ?? null,
    confidence_detail: {
      protein_confidence: {
        band: parsed.protein_confidence_band,
        percent: parsed.protein_confidence_percent,
        available: parsed.protein_confidence_percent != null,
        note: "GenAI protein confidence returned by the structured model output.",
      },
      energy_confidence: {
        band: parsed.energy_confidence_band,
        percent: parsed.energy_confidence_percent,
        available: parsed.energy_confidence_percent != null,
        note: "GenAI calorie confidence returned by the structured model output.",
      },
      final_confidence: {
        band: finalConfidenceBand,
        percent: finalConfidencePercent,
        source: "minimum_of_protein_and_energy_confidence",
        derived_from_minimum_rule: true,
        note: "Final confidence is the minimum of the protein and energy confidences, matching the Gen AI design note.",
      },
    },
  };
}


async function estimateOneItem(item, assets, queryVector, queryBlob) {
  const extractedValues = extractExplicitNutritionFromDescription(item.description);
  const neighbors = retrieveNeighbors(queryVector, assets, item);
  const icmrMatches = await lookupIcmrMatches(item);
  const helperRules = buildHelperRules(item);
  const { systemPrompt, userPrompt } = buildPrompt({
    item,
    neighbors,
    icmrMatches,
    helperRules,
    extractedValues,
  });

  const client = getOpenAIClient();
  const response = await client.responses.create({
    model: DEFAULT_RESPONSES_MODEL,
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "nutrition_estimate",
        strict: true,
        schema: RESPONSE_SCHEMA,
      },
    },
  });

  const rawText = parseResponseOutput(response);
  if (!rawText) {
    throw new Error("The OpenAI response did not contain structured JSON output.");
  }

  const parsed = JSON.parse(rawText);
  parsed.protein_confidence_percent = normalizePercent(parsed.protein_confidence_percent);
  parsed.energy_confidence_percent = normalizePercent(parsed.energy_confidence_percent);
  parsed.protein_confidence_band =
    parsed.protein_confidence_band || confidenceBandFromPercent(parsed.protein_confidence_percent);
  parsed.energy_confidence_band =
    parsed.energy_confidence_band || confidenceBandFromPercent(parsed.energy_confidence_percent);
  parsed.estimated_protein_g = roundValue(parsed.estimated_protein_g);
  parsed.estimated_energy_kcal = roundValue(parsed.estimated_energy_kcal);

  const finalConfidencePercent =
    parsed.protein_confidence_percent != null && parsed.energy_confidence_percent != null
      ? Math.min(parsed.protein_confidence_percent, parsed.energy_confidence_percent)
      : null;
  const finalConfidenceBand =
    finalConfidencePercent != null ? confidenceBandFromPercent(finalConfidencePercent) : "Low";

  const output = buildOutputDetail(
    parsed,
    extractedValues,
    finalConfidencePercent,
    finalConfidenceBand
  );
  const topNeighbor = neighbors[0] || null;
  const rationaleParts = [
    parsed.reasoning_trace,
    neighbors.length ? `Retrieved ${neighbors.length} similar item references.` : "No similar item references were retrieved.",
    icmrMatches.length ? `Found ${icmrMatches.length} ICMR ingredient references.` : "No strong ICMR ingredient reference was found.",
    parsed.source_usage.price_considered_lightly
      ? "Item price was considered lightly after dish identity was established."
      : "Item price did not materially affect the estimate.",
  ];

  const row = {
    row_id: item.rid,
    result_key: item.rowId,
    input_name: item.name,
    input_description: item.description,
    input_cuisine: item.cuisine,
    input_item_price: item.price,
    input_item_grammage: item.grammage,
    input_main_ingredient_1: item.mainIngredient1,
    input_main_ingredient_2: item.mainIngredient2,
    input_main_ingredient_3: item.mainIngredient3,
    input_main_ingredient_1_grammage: item.mainIngredient1Grammage,
    input_main_ingredient_2_grammage: item.mainIngredient2Grammage,
    input_main_ingredient_3_grammage: item.mainIngredient3Grammage,
    input_compulsory_components: item.compulsoryComponents,
    input_optional_components: item.optionalComponents,
    matched_name: topNeighbor?.ITEM_NAME || null,
    matched_cuisine: topNeighbor?.RX_CUISINE || null,
    estimated_energy_kcal: output.estimated_energy_kcal,
    estimated_protein_g: output.estimated_protein_g,
    support_count: neighbors.length,
    match_type: "GenAI estimate with retrieved references",
    match_score: topNeighbor?.similarity_percent || 0,
    confidence_score: output.confidence_percent,
    confidence_band: output.estimation_confidence || "Low",
    estimation_confidence: output.estimation_confidence,
    confidence_percent: output.confidence_percent,
    extracted_protein_g: output.extracted_protein_g,
    extracted_energy_kcal: output.extracted_energy_kcal,
    reasoning_trace: output.reasoning_trace,
    rationale: rationaleParts.filter(Boolean).join(" "),
    source_lineage: "OpenAI + retrieved similar items + ICMR",
    input: buildInputPayload(item),
    output,
    retrieval: {
      query_blob: queryBlob,
      price_rerank_boost: topNeighbor?.price_rerank_boost || 0,
    },
  };

  row.explainability = buildExplainability(item, row, neighbors, icmrMatches, helperRules, extractedValues, parsed);
  return row;
}


async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}


export async function tryEstimateMenuItemsWithGenAI(items = []) {
  const readiness = getGenAiReadiness();
  if (!readiness.enabled) {
    return {
      available: false,
      reasonCode: readiness.reasonCode,
      detail: readiness.detail,
    };
  }

  let assets;
  try {
    assets = await loadGenAiAssets();
  } catch (error) {
    return {
      available: false,
      reasonCode: "missing_assets",
      detail: `${formatFallbackReason("missing_assets")} ${error instanceof Error ? error.message : ""}`.trim(),
    };
  }

  try {
    const queryBlobs = items.map((item) => buildQueryBlob(item));
    const queryVectors = await getQueryEmbeddings(
      queryBlobs,
      assets.manifest.embeddingModel || DEFAULT_EMBEDDING_MODEL,
      assets.manifest.dimensions || undefined
    );
    const results = await mapWithConcurrency(items, MAX_CONCURRENCY, (item, index) =>
      estimateOneItem(item, assets, queryVectors[index], queryBlobs[index])
    );

    return {
      available: true,
      payload: {
        generatedAt: new Date().toISOString(),
        estimator: {
          engine: "openai_retrieval_llm_v2",
          contract_version: "genai-rag-v2",
          mode: "genai",
          model: DEFAULT_RESPONSES_MODEL,
          embeddingModel: assets.manifest.embeddingModel || DEFAULT_EMBEDDING_MODEL,
          vectorAsset: {
            available: true,
            createdAt: assets.manifest.createdAt || null,
            count: assets.manifest.count,
            dimensions: assets.manifest.dimensions,
          },
          separate_protein_confidence_available: true,
          separate_energy_confidence_available: true,
          extracted_values_from_description_available: true,
          fallback: {
            active: false,
            reasonCode: null,
            detail: null,
          },
          notes: [
            "Each row uses retrieved similar items, ICMR ingredient references, helper rules, and a structured OpenAI response.",
            "Final confidence is the minimum of the protein and energy confidence percentages.",
          ],
        },
        summary: summarizeResults(results),
        results,
      },
    };
  } catch (error) {
    return {
      available: false,
      reasonCode: "openai_error",
      detail: `${formatFallbackReason("openai_error")} ${error instanceof Error ? error.message : ""}`.trim(),
    };
  }
}
