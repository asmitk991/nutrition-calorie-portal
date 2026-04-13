"use client";

/**
 * MinimalCalculator
 * ------------------
 * The single, simple calculator that lives at the top of the landing page.
 *
 * Design intent (per Deepak's feedback on 7 Apr 2026):
 *   - Calculator at the top, simple, unintimidating.
 *   - One required input (dish name). Everything else collapses behind "Add details".
 *   - One CTA. One result card. No noise.
 *
 * Backend contract:
 *   POST /api/estimate  with  { items: [ { RID, ITEM_NAME, ITEM_PRICE, ...optional } ] }
 *   The route already validates that RID + ITEM_NAME + ITEM_PRICE are present, so we
 *   auto-fill RID + ITEM_PRICE with placeholders if the user only types a dish name.
 */

import { useState } from "react";
import styles from "./minimal-calculator.module.css";

const DEFAULT_PRICE_PLACEHOLDER = "0";

export default function MinimalCalculator() {
  // ---- form state ---------------------------------------------------------
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [grammage, setGrammage] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  // ---- request state ------------------------------------------------------
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [estimatorMeta, setEstimatorMeta] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setResult(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Please enter a dish name to estimate.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              RID: `web-${Date.now()}`,
              ITEM_NAME: trimmedName,
              ITEM_PRICE: price.trim() || DEFAULT_PRICE_PLACEHOLDER,
              ITEM_DESCRIPTION: description.trim(),
              RX_CUISINE: cuisine.trim(),
              ITEM_GRAMMAGE: grammage.trim(),
            },
          ],
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "The estimator could not process this dish.");
      }

      const firstResult = Array.isArray(data?.results) ? data.results[0] : null;
      if (!firstResult) {
        throw new Error("No estimate was returned. Try again with a more specific dish name.");
      }

      setResult(firstResult);
      setEstimatorMeta(data.estimator || null);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setName("");
    setPrice("");
    setDescription("");
    setCuisine("");
    setGrammage("");
    setResult(null);
    setError(null);
    setEstimatorMeta(null);
    setShowDetails(false);
  }

  return (
    <section className={styles.calculator} aria-label="Quick nutrition calculator">
      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.fieldPrimary}>
          <span>Dish name</span>
          <input
            type="text"
            placeholder="e.g. Paneer Butter Masala"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
            required
          />
        </label>

        <button type="submit" className={styles.primaryButton} disabled={loading}>
          {loading ? "Estimating…" : "Get nutrition estimate"}
        </button>

        <button
          type="button"
          className={styles.disclosure}
          aria-expanded={showDetails}
          onClick={() => setShowDetails((open) => !open)}
        >
          {showDetails ? "− Hide optional details" : "+ Add optional details (improves accuracy)"}
        </button>

        {showDetails && (
          <div className={styles.optionalGrid}>
            <label className={styles.field}>
              <span>Item price (₹)</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="220"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>Cuisine</span>
              <input
                type="text"
                placeholder="North Indian"
                value={cuisine}
                onChange={(event) => setCuisine(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>Grammage (g)</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                placeholder="300"
                value={grammage}
                onChange={(event) => setGrammage(event.target.value)}
              />
            </label>
            <label className={`${styles.field} ${styles.fieldFull}`}>
              <span>Short description</span>
              <input
                type="text"
                placeholder="Cottage cheese cubes in a creamy tomato gravy"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
          </div>
        )}

        {error && <p className={styles.error} role="alert">{error}</p>}
      </form>

      {result && (
        <ResultCard result={result} estimatorMeta={estimatorMeta} onReset={handleReset} />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// ResultCard: one clean panel, big numbers, one-line confidence note.
// ---------------------------------------------------------------------------
function ResultCard({ result, estimatorMeta, onReset }) {
  const energy = safeRound(result.estimated_energy_kcal);
  const protein = safeRound(result.estimated_protein_g, 1);
  const confidenceLabel = humanizeConfidence(result.estimation_confidence);
  const confidencePercent =
    typeof result.confidence_percent === "number" ? `${Math.round(result.confidence_percent)}%` : null;
  const usingFallback = Boolean(estimatorMeta?.fallback?.active);
  const reasoning = result.reasoning_trace || result.rationale || null;

  return (
    <article className={styles.resultCard} aria-live="polite">
      <header className={styles.resultHeader}>
        <span className={styles.resultEyebrow}>Estimated nutrition</span>
        <h3>
          {result.input_name ||
            result.input?.ITEM_NAME ||
            result.display_name ||
            result.matched_name ||
            "Your dish"}
        </h3>
      </header>

      <div className={styles.resultStats}>
        <div className={styles.statBlock}>
          <span>Energy</span>
          <strong>{energy != null ? `${energy} kcal` : "—"}</strong>
        </div>
        <div className={styles.statBlock}>
          <span>Protein</span>
          <strong>{protein != null ? `${protein} g` : "—"}</strong>
        </div>
        <div className={`${styles.statBlock} ${styles.statBlockMuted}`}>
          <span>Confidence</span>
          <strong>{confidenceLabel}{confidencePercent ? ` · ${confidencePercent}` : ""}</strong>
        </div>
      </div>

      {reasoning && (
        <p className={styles.reasoning}>
          <span>Why:</span> {reasoning}
        </p>
      )}

      <footer className={styles.resultFooter}>
        <span className={styles.engineBadge}>
          Engine: {usingFallback ? "Deterministic fallback" : estimatorMeta?.engine || "GenAI"}
        </span>
        <button type="button" className={styles.linkButton} onClick={onReset}>
          Try another dish
        </button>
      </footer>
    </article>
  );
}

// ---- helpers --------------------------------------------------------------
function safeRound(value, decimals = 0) {
  if (value == null || Number.isNaN(Number(value))) return null;
  const factor = Math.pow(10, decimals);
  return Math.round(Number(value) * factor) / factor;
}

function humanizeConfidence(value) {
  if (!value) return "—";
  const v = String(value).toLowerCase();
  if (v.includes("high")) return "High";
  if (v.includes("med")) return "Medium";
  if (v.includes("low")) return "Low";
  return value;
}
