"use client";

import { useState } from "react";

import { sanitizeRid } from "@/lib/menu-input-schema";
import { formatKcalDisplay, formatProteinDisplay } from "@/lib/nutrition-display";

import styles from "./minimal-calculator.module.css";

function createEmptyIngredient() {
  return { name: "", grammage: "" };
}

function formatIngredientList(ingredients = []) {
  const validIngredients = (ingredients || []).filter((ingredient) => ingredient?.name || ingredient?.grammage);
  if (!validIngredients.length) {
    return "Not provided";
  }

  return validIngredients
    .map((ingredient) => {
      if (ingredient.name && ingredient.grammage) {
        return `${ingredient.name} (${ingredient.grammage} g)`;
      }

      return ingredient.name || `${ingredient.grammage} g`;
    })
    .join(", ");
}

export default function MinimalCalculator({ cuisineOptions = [] }) {
  const [form, setForm] = useState(() => ({
    rid: "",
    name: "",
    price: "",
    grammage: "",
    description: "",
    cuisine: "",
    compulsoryComponents: "",
    optionalComponents: "",
    ingredients: [createEmptyIngredient()],
  }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [estimatorMeta, setEstimatorMeta] = useState(null);
  const [showInternal, setShowInternal] = useState(false);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: key === "rid" ? sanitizeRid(value) : value }));
  }

  function updateIngredient(index, key, value) {
    setForm((current) => ({
      ...current,
      ingredients: current.ingredients.map((ingredient, ingredientIndex) =>
        ingredientIndex === index ? { ...ingredient, [key]: value } : ingredient
      ),
    }));
  }

  function addIngredient() {
    setForm((current) => ({
      ...current,
      ingredients: [...current.ingredients, createEmptyIngredient()],
    }));
  }

  function removeIngredient(index) {
    setForm((current) => {
      const nextIngredients = current.ingredients.filter((_, ingredientIndex) => ingredientIndex !== index);

      return {
        ...current,
        ingredients: nextIngredients.length ? nextIngredients : [createEmptyIngredient()],
      };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setResult(null);

    const missingFields = [];
    if (!form.rid.trim()) missingFields.push("RID");
    if (!form.name.trim()) missingFields.push("Item name");
    if (!form.price.trim()) missingFields.push("Item price");
    if (!form.grammage.trim()) missingFields.push("Item grammage");

    if (missingFields.length) {
      setError(`Please add ${missingFields.join(", ")} before estimating.`);
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
              RID: form.rid.trim(),
              ITEM_NAME: form.name.trim(),
              ITEM_PRICE: form.price.trim(),
              ITEM_GRAMMAGE: form.grammage.trim(),
              ITEM_DESCRIPTION: form.description.trim(),
              RX_CUISINE: form.cuisine.trim(),
              COMPULSORY_COMPONENTS: form.compulsoryComponents.trim(),
              OPTIONAL_COMPONENTS: form.optionalComponents.trim(),
              ingredients: form.ingredients
                .map((ingredient) => ({
                  name: ingredient.name.trim(),
                  grammage: ingredient.grammage.trim(),
                }))
                .filter((ingredient) => ingredient.name || ingredient.grammage),
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
        throw new Error("No estimate was returned. Try again with a more explicit dish build.");
      }

      setResult(firstResult);
      setEstimatorMeta(data.estimator || null);
      setShowInternal(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setForm({
      rid: "",
      name: "",
      price: "",
      grammage: "",
      description: "",
      cuisine: "",
      compulsoryComponents: "",
      optionalComponents: "",
      ingredients: [createEmptyIngredient()],
    });
    setResult(null);
    setEstimatorMeta(null);
    setError(null);
    setShowInternal(false);
  }

  return (
    <section className={styles.calculator} aria-label="Single menu-item nutrition builder">
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.headerBlock}>
          <span className={styles.eyebrow}>Item estimate</span>
          <h2>Enter the menu item exactly as the restaurant sells it.</h2>
          <p>
            Required fields identify the item and portion. Optional ingredients and add-ons improve the estimate when
            the item name is not enough.
          </p>
        </div>

        <div className={styles.requiredGrid}>
          <Field
            label="RID"
            required
            value={form.rid}
            placeholder="1001"
            helper="Numeric item ID for tracking only."
            inputMode="numeric"
            onChange={(value) => updateField("rid", value)}
          />
          <Field
            label="Item name"
            required
            value={form.name}
            placeholder="Paneer Butter Masala"
            helper="Customer-facing dish name."
            onChange={(value) => updateField("name", value)}
          />
          <Field
            label="Item price"
            required
            value={form.price}
            placeholder="250"
            helper="Selling price for this dish only."
            inputMode="decimal"
            onChange={(value) => updateField("price", value)}
          />
          <Field
            label="Item grammage"
            required
            value={form.grammage}
            placeholder="320"
            helper="Approximate total plated weight in grams."
            inputMode="decimal"
            onChange={(value) => updateField("grammage", value)}
          />
        </div>

        <div className={styles.optionalSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTag}>Optional</span>
            <strong>Add context only where it improves the estimate.</strong>
          </div>

          <div className={styles.optionalGrid}>
            <Field
              label="Short description"
              value={form.description}
              placeholder="Paneer 120 g, tomato gravy 150 g, butter 20 g."
              helper="Operator note only. Prefer ingredients with grams over marketing copy."
              as="textarea"
              full
              onChange={(value) => updateField("description", value)}
            />
            <label className={styles.field}>
              <span className={styles.labelRow}>
                <span>Cuisine</span>
                <span className={styles.optionalBadge}>Optional</span>
              </span>
              <select value={form.cuisine} onChange={(event) => updateField("cuisine", event.target.value)}>
                <option value="">Select cuisine</option>
                {cuisineOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <small>Optional cuisine tag if the restaurant already classifies dishes this way.</small>
            </label>
            <Field
              label="Included add-ons"
              value={form.compulsoryComponents}
              placeholder="Paneer cubes, gravy"
              helper="Add-ons or sides that always come with the dish."
              as="textarea"
              onChange={(value) => updateField("compulsoryComponents", value)}
            />
            <Field
              label="Optional add-ons"
              value={form.optionalComponents}
              placeholder="Onion salad, pickle"
              helper="Add-ons or accompaniments the customer may choose."
              as="textarea"
              onChange={(value) => updateField("optionalComponents", value)}
            />
          </div>
        </div>

        <div className={styles.cartSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTag}>Ingredients</span>
            <strong>Add the main ingredients if the dish has a custom build.</strong>
          </div>
          <p className={styles.sectionNote}>
            Keep this short: ingredient name and approximate grams. Skip this for simple, obvious menu items.
          </p>

          <div className={styles.cardList}>
            {form.ingredients.map((ingredient, index) => (
              <article key={`ingredient-${index}`} className={styles.ingredientCard}>
                <Field
                  label={`Ingredient ${index + 1}`}
                  value={ingredient.name}
                  placeholder="Paneer"
                  helper="Main ingredient name."
                  onChange={(value) => updateIngredient(index, "name", value)}
                />
                <Field
                  label="Grammage"
                  value={ingredient.grammage}
                  placeholder="50"
                  helper="Approximate grams for this ingredient."
                  inputMode="decimal"
                  onChange={(value) => updateIngredient(index, "grammage", value)}
                />
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => removeIngredient(index)}
                  disabled={form.ingredients.length === 1 && !ingredient.name && !ingredient.grammage}
                >
                  Remove
                </button>
              </article>
            ))}
          </div>

          <div className={styles.actionRow}>
            <button type="button" className={styles.secondaryButton} onClick={addIngredient}>
              Add ingredient
            </button>
            <div className={styles.cartSummary}>
              <span>Ingredient summary</span>
              <strong>{formatIngredientList(form.ingredients)}</strong>
            </div>
          </div>
        </div>

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <div className={styles.submitRow}>
          <button type="submit" className={styles.primaryButton} disabled={loading}>
            {loading ? "Estimating..." : "Estimate item"}
          </button>
          <button type="button" className={styles.linkButton} onClick={handleReset}>
            Reset builder
          </button>
        </div>
      </form>

      {result ? (
        <ResultCard
          result={result}
          estimatorMeta={estimatorMeta}
          showInternal={showInternal}
          onToggleInternal={() => setShowInternal((open) => !open)}
          onReset={handleReset}
        />
      ) : null}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  helper,
  required = false,
  inputMode,
  as = "input",
  full = false,
}) {
  const Control = as === "textarea" ? "textarea" : "input";

  return (
    <label className={`${styles.field} ${full ? styles.fieldFull : ""}`}>
      <span className={styles.labelRow}>
        <span>{label}</span>
        <span className={required ? styles.requiredBadge : styles.optionalBadge}>
          {required ? "Required" : "Optional"}
        </span>
      </span>
      <Control
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
      />
      <small>{helper}</small>
    </label>
  );
}

function ResultCard({ result, estimatorMeta, showInternal, onToggleInternal, onReset }) {
  const confidenceLabel = humanizeConfidence(result.estimation_confidence);
  const confidencePercent =
    typeof result.confidence_percent === "number" ? `${Math.round(result.confidence_percent)}%` : null;
  const reasoning = result.reasoning_trace || result.rationale || null;
  const activeContext =
    result.explainability?.retrieval?.active_menu_context?.map((candidate) => candidate.display_name).filter(Boolean) ||
    [];

  return (
    <article className={styles.resultCard} aria-live="polite">
      <header className={styles.resultHeader}>
        <span className={styles.resultEyebrow}>Estimated nutrition</span>
        <h3>{result.input_name || "Your dish"}</h3>
        <p>
          Labeled nutrition references, the April 20 active menu dataset, and ICMR ingredient checks all informed this
          estimate.
        </p>
      </header>

      <div className={styles.resultStats}>
        <div className={styles.statBlock}>
          <span>Calories</span>
          <strong>{formatKcalDisplay(result.estimated_energy_kcal, result.estimation_confidence)}</strong>
        </div>
        <div className={styles.statBlock}>
          <span>Protein</span>
          <strong>{formatProteinDisplay(result.estimated_protein_g)}</strong>
        </div>
        <div className={`${styles.statBlock} ${styles.statBlockMuted}`}>
          <span>Confidence</span>
          <strong>
            {confidenceLabel}
            {confidencePercent ? ` - ${confidencePercent}` : ""}
          </strong>
        </div>
      </div>

      {reasoning ? (
        <p className={styles.reasoning}>
          <span>Why:</span> {reasoning}
        </p>
      ) : null}

      <div className={styles.resultFooter}>
        <span className={styles.engineBadge}>Engine: {estimatorMeta?.engine || "GenAI"}</span>
        <button type="button" className={styles.linkButton} onClick={onToggleInternal}>
          {showInternal ? "Hide internal logic" : "Show internal logic"}
        </button>
        <button type="button" className={styles.linkButton} onClick={onReset}>
          Build another dish
        </button>
      </div>

      {showInternal ? (
        <div className={styles.internalPanel}>
          <div className={styles.internalGrid}>
            <div>
              <strong>Signals checked</strong>
              <p>{formatList(result.explainability?.inputs?.signals_checked_by_genai, "ITEM_NAME")}</p>
            </div>
            <div>
              <strong>Signals that helped</strong>
              <p>{formatList(result.explainability?.inputs?.signals_that_helped_this_match, "ITEM_NAME")}</p>
            </div>
            <div>
              <strong>Labeled nutrition references</strong>
              <p>
                {formatList(
                  result.explainability?.retrieval?.neighbors?.map((neighbor) => neighbor.ITEM_NAME).filter(Boolean),
                  "None"
                )}
              </p>
            </div>
            <div>
              <strong>April 20 active-menu context</strong>
              <p>{formatList(activeContext, "None")}</p>
            </div>
            <div>
              <strong>Price note</strong>
              <p>{result.explainability?.price_signal?.note || "Not available"}</p>
            </div>
            <div>
              <strong>Input ingredients</strong>
              <p>{formatIngredientList(result.input_ingredients)}</p>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function humanizeConfidence(value) {
  if (!value) return "--";
  const normalized = String(value).toLowerCase();
  if (normalized.includes("high")) return "High";
  if (normalized.includes("med")) return "Medium";
  if (normalized.includes("low")) return "Low";
  return value;
}

function formatList(values, emptyLabel = "None") {
  return values?.length ? values.join(", ") : emptyLabel;
}
