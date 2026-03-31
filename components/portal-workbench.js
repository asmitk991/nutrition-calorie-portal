"use client";

import { useMemo, useState } from "react";
import Papa from "papaparse";

import styles from "@/app/page.module.css";
import {
  CSV_HEADER_ORDER,
  createEmptyDraft,
  getMissingRequiredFields,
  hasMenuInputContent,
  mapCsvMenuRow,
  normalizeMenuInput,
  validateMenuItems,
} from "@/lib/menu-input-schema";

const DEMO_ROWS = [
  normalizeMenuInput(
    {
      RID: "DEMO-001",
      ITEM_NAME: "Paneer Butter Masala",
      ITEM_DESCRIPTION: "Paneer cubes in rich butter tomato gravy",
      RX_CUISINE: "North Indian",
      ITEM_PRICE: "250",
      ITEM_GRAMMAGE: "320",
      MAIN_INGREDIENT_1: "Paneer",
      MAIN_INGREDIENT_1_GRAMMAGE: "120",
      MAIN_INGREDIENT_2: "Tomato gravy",
      MAIN_INGREDIENT_2_GRAMMAGE: "150",
      MAIN_INGREDIENT_3: "Butter",
      MAIN_INGREDIENT_3_GRAMMAGE: "20",
      COMPULSORY_COMPONENTS: "Paneer cubes, butter tomato gravy",
      OPTIONAL_COMPONENTS: "Butter naan, onion salad",
    },
    0,
    { rowId: "demo-1" }
  ),
  normalizeMenuInput(
    {
      RID: "DEMO-002",
      ITEM_NAME: "Chicken Fried Rice",
      ITEM_DESCRIPTION: "Wok tossed rice with chicken and seasoning",
      RX_CUISINE: "Chinese/Pan-Asian",
      ITEM_PRICE: "249",
      ITEM_GRAMMAGE: "350",
      MAIN_INGREDIENT_1: "Rice",
      MAIN_INGREDIENT_1_GRAMMAGE: "220",
      MAIN_INGREDIENT_2: "Chicken",
      MAIN_INGREDIENT_2_GRAMMAGE: "90",
      MAIN_INGREDIENT_3: "Seasoning oil",
      MAIN_INGREDIENT_3_GRAMMAGE: "18",
      COMPULSORY_COMPONENTS: "Chicken, fried rice base, seasoning",
      OPTIONAL_COMPONENTS: "Egg topping, chilli oil",
    },
    1,
    { rowId: "demo-2" }
  ),
  normalizeMenuInput(
    {
      RID: "DEMO-003",
      ITEM_NAME: "Veg Hakka Noodles",
      ITEM_DESCRIPTION: "Stir fried noodles with vegetables",
      RX_CUISINE: "Chinese/Pan-Asian",
      ITEM_PRICE: "199",
      ITEM_GRAMMAGE: "300",
      MAIN_INGREDIENT_1: "Noodles",
      MAIN_INGREDIENT_1_GRAMMAGE: "180",
      MAIN_INGREDIENT_2: "Mixed vegetables",
      MAIN_INGREDIENT_2_GRAMMAGE: "95",
      MAIN_INGREDIENT_3: "Sauce",
      MAIN_INGREDIENT_3_GRAMMAGE: "20",
      COMPULSORY_COMPONENTS: "Noodles, mixed vegetables, wok sauce",
      OPTIONAL_COMPONENTS: "Chilli vinegar, spring onion garnish",
    },
    2,
    { rowId: "demo-3" }
  ),
];

const FIELD_CONFIG = {
  rid: {
    label: "RID",
    requirement: "Required",
    placeholder: "RID-1001",
    helper: "Use your restaurant or partner row ID so the estimate maps back to the same menu line.",
  },
  name: {
    label: "Item name",
    requirement: "Required",
    placeholder: "Paneer Butter Masala",
    helper: "Enter the dish name exactly as it appears on the menu.",
  },
  price: {
    label: "Item price",
    requirement: "Required",
    placeholder: "250",
    helper: "Enter the selling price for this dish only. Do not use a restaurant-level average.",
    inputMode: "decimal",
  },
  description: {
    label: "Item description",
    requirement: "Optional",
    placeholder: "Paneer cubes in rich butter tomato gravy",
    helper: "Short menu copy helps when the dish name is broad, repeated, or abbreviated.",
    as: "textarea",
    wide: true,
  },
  cuisine: {
    label: "Cuisine",
    requirement: "Optional",
    placeholder: "North Indian",
    helper: "Add the cuisine label if the restaurant already groups dishes this way.",
  },
  grammage: {
    label: "Item grammage",
    requirement: "Optional",
    placeholder: "320",
    helper: "Use the approximate total weight of the dish in grams if you know it.",
    inputMode: "decimal",
  },
  mainIngredient1: {
    label: "Main ingredient 1",
    requirement: "Optional",
    placeholder: "Paneer",
    helper: "List the most important ingredient first when the dish needs extra context.",
  },
  mainIngredient1Grammage: {
    label: "Main ingredient 1 grammage",
    requirement: "Optional",
    placeholder: "120",
    helper: "Approximate grams for the first ingredient.",
    inputMode: "decimal",
  },
  mainIngredient2: {
    label: "Main ingredient 2",
    requirement: "Optional",
    placeholder: "Tomato gravy",
    helper: "Use the second slot for a major ingredient that materially changes calories or protein.",
  },
  mainIngredient2Grammage: {
    label: "Main ingredient 2 grammage",
    requirement: "Optional",
    placeholder: "150",
    helper: "Approximate grams for the second ingredient.",
    inputMode: "decimal",
  },
  mainIngredient3: {
    label: "Main ingredient 3",
    requirement: "Optional",
    placeholder: "Butter",
    helper: "Use the third slot for a meaningful ingredient, not garnish.",
  },
  mainIngredient3Grammage: {
    label: "Main ingredient 3 grammage",
    requirement: "Optional",
    placeholder: "20",
    helper: "Approximate grams for the third ingredient.",
    inputMode: "decimal",
  },
  compulsoryComponents: {
    label: "Compulsory components",
    requirement: "Optional",
    placeholder: "Paneer tikka pieces, mint chutney",
    helper: "List the parts that normally come with the dish. Use comma-separated values.",
    as: "textarea",
    wide: true,
  },
  optionalComponents: {
    label: "Optional components",
    requirement: "Optional",
    placeholder: "Extra dip, onion salad, pickle",
    helper: "List addons or sides that may come with the dish but are not guaranteed. Use comma-separated values.",
    as: "textarea",
    wide: true,
  },
};

const FORM_SECTIONS = [
  {
    id: "required",
    eyebrow: "Required fields",
    title: "Needed before estimation",
    description: "Every menu row must include these three fields before it can be added to the batch or estimated.",
    fields: ["rid", "name", "price"],
  },
  {
    id: "optional",
    eyebrow: "Optional enrichment",
    title: "Helpful context for stronger matching",
    description: "These fields are not mandatory, but they improve matching for dishes with generic or unclear names.",
    fields: ["description", "cuisine"],
  },
  {
    id: "ingredients",
    eyebrow: "Ingredients and composition",
    title: "Optional dish composition details",
    description:
      "Use ingredient, grammage, and compulsory or optional component details when a new dish needs more context than the menu name alone.",
    fields: [
      "grammage",
      "mainIngredient1",
      "mainIngredient1Grammage",
      "mainIngredient2",
      "mainIngredient2Grammage",
      "mainIngredient3",
      "mainIngredient3Grammage",
      "compulsoryComponents",
      "optionalComponents",
    ],
  },
];

const CONFIDENCE_GUIDE = {
  High: {
    headline: "Usually ready to use",
    detail:
      "V1 found the same dish or a strong analogue with solid support. Spot-check only if the recipe, portion, or plating is unusual.",
  },
  Medium: {
    headline: "Review before publishing",
    detail:
      "A reasonable analogue was found, but some context is broad or missing. Review if the dish has custom sides, portions, or recipe changes.",
  },
  Low: {
    headline: "Manual review required",
    detail:
      "The portal found weak support or no stable analogue. Add optional context if you have it and do not use the estimate without a human check.",
  },
};

function summarizeResults(results) {
  const matched = results.filter((item) => item.estimated_energy_kcal != null);
  const averageCalories = matched.length
    ? Math.round(matched.reduce((sum, item) => sum + item.estimated_energy_kcal, 0) / matched.length)
    : 0;
  const highConfidence = results.filter((item) => item.confidence_band === "High").length;
  const reviewCount = results.filter(
    (item) => item.estimated_energy_kcal == null || item.confidence_band !== "High"
  ).length;

  return {
    matched: matched.length,
    unmatched: results.length - matched.length,
    averageCalories,
    highConfidence,
    reviewCount,
  };
}

function formatIngredients(row) {
  const ingredients = [
    [row.mainIngredient1, row.mainIngredient1Grammage],
    [row.mainIngredient2, row.mainIngredient2Grammage],
    [row.mainIngredient3, row.mainIngredient3Grammage],
  ].filter(([name, grammage]) => name || grammage);

  if (!ingredients.length) {
    return "Not provided";
  }

  return ingredients
    .map(([name, grammage]) => {
      if (name && grammage) {
        return `${name} (${grammage} g)`;
      }
      return name || `${grammage} g`;
    })
    .join(", ");
}

function formatValidationErrors(errors) {
  if (!errors.length) {
    return "";
  }

  if (errors.length === 1) {
    return errors[0].message;
  }

  return `${errors[0].message} ${errors.length - 1} more rows also need RID, ITEM_NAME, and ITEM_PRICE.`;
}

function formatColumnList(columns) {
  return columns.join(", ");
}


function formatList(values, emptyLabel = "None") {
  return values?.length ? values.join(", ") : emptyLabel;
}


function getEstimatorCopy(estimator) {
  const isGenAi = estimator?.mode === "genai" || estimator?.engine === "openai_retrieval_llm_v2";
  const isFallback = estimator?.fallback?.active;

  if (isGenAi) {
    return {
      title: "AI-assisted estimate",
      detail:
        "This batch used the AI-assisted estimation flow with reference dishes and ingredient checks.",
    };
  }

  if (isFallback) {
    return {
      title: "Fallback estimate",
      detail:
        estimator?.fallback?.detail ||
        "The AI-assisted backend was unavailable, so the portal used the packaged catalog matcher instead.",
    };
  }

  return {
    title: "Catalog estimate",
    detail: "This batch used the packaged catalog matcher.",
  };
}


function ComponentSummary({ compulsory, optional }) {
  return (
    <div className={styles.statusCell}>
      <span className={styles.subText}>
        <strong>Compulsory:</strong> {compulsory || "Not provided"}
      </span>
      <span className={styles.subText}>
        <strong>Optional:</strong> {optional || "Not provided"}
      </span>
    </div>
  );
}

function getConfidenceGuide(band, hasEstimate = true) {
  if (!hasEstimate) {
    return {
      headline: "Manual review required",
      detail: "No reliable comparison was found for this row.",
    };
  }

  return CONFIDENCE_GUIDE[band] || CONFIDENCE_GUIDE.Low;
}


function QueueDetailsSummary({ row }) {
  return (
    <div className={styles.statusCell}>
      <span className={styles.subText}>
        <strong>Description:</strong> {row.description || "Not provided"}
      </span>
      <span className={styles.subText}>
        <strong>Cuisine:</strong> {row.cuisine || "Not provided"}
      </span>
      <span className={styles.subText}>
        <strong>Grammage:</strong> {row.grammage || "Not provided"}
      </span>
      <span className={styles.subText}>
        <strong>Main ingredients:</strong> {formatIngredients(row)}
      </span>
      <ComponentSummary compulsory={row.compulsoryComponents} optional={row.optionalComponents} />
    </div>
  );
}


function ExtractionSummary({ row }) {
  const hasProtein = row.extracted_protein_g != null;
  const hasEnergy = row.extracted_energy_kcal != null;

  if (!hasProtein && !hasEnergy) {
    return (
      <div className={styles.statusCell}>
        <strong>No values found in the description</strong>
        <span className={styles.subText}>The menu description did not explicitly mention protein or calories.</span>
      </div>
    );
  }

  return (
    <div className={styles.statusCell}>
      <strong>Captured from ITEM_DESCRIPTION</strong>
      <span className={styles.subText}>
        <strong>Protein:</strong> {hasProtein ? `${row.extracted_protein_g} g` : "Not found"}
      </span>
      <span className={styles.subText}>
        <strong>Calories:</strong> {hasEnergy ? `${row.extracted_energy_kcal} kcal` : "Not found"}
      </span>
      <span className={styles.subText}>These values are shown separately and do not replace the V1 estimate.</span>
    </div>
  );
}


function ConfidenceSummary({ row }) {
  const guide = getConfidenceGuide(row.confidence_band, row.estimated_energy_kcal != null);
  const confidenceDetail = row.output?.confidence_detail;
  const proteinConfidence = confidenceDetail?.protein_confidence;
  const energyConfidence = confidenceDetail?.energy_confidence;

  return (
    <div className={styles.statusCell}>
      <span className={`${styles.badge} ${styles[`badge${row.confidence_band}`]}`}>{row.confidence_band}</span>
      <span className={styles.subText}>
        <strong>Final confidence:</strong> {row.confidence_score}/100
      </span>
      <span className={styles.subText}>{guide.headline}</span>
      <span className={styles.subText}>
        <strong>Protein confidence:</strong>{" "}
        {proteinConfidence?.available
          ? `${proteinConfidence.percent}/100 (${proteinConfidence.band})`
          : proteinConfidence?.note || "Not available yet"}
      </span>
      <span className={styles.subText}>
        <strong>Calorie confidence:</strong>{" "}
        {energyConfidence?.available
          ? `${energyConfidence.percent}/100 (${energyConfidence.band})`
          : energyConfidence?.note || "Not available yet"}
      </span>
      {!proteinConfidence?.available && !energyConfidence?.available ? (
        <span className={styles.subText}>Separate protein and calorie confidence is not shown in fallback mode.</span>
      ) : null}
    </div>
  );
}


function ExplainabilitySummary({ row }) {
  const explainability = row.explainability || {};
  const inputs = explainability.inputs || {};
  const checkedSignals =
    inputs.signals_checked_by_genai?.length ? inputs.signals_checked_by_genai : inputs.signals_checked_by_v1;
  const retrievedRefs = explainability.retrieval?.neighbors?.map((neighbor) => neighbor.ITEM_NAME).filter(Boolean);

  return (
    <div className={styles.statusCell}>
      <strong>{row.reasoning_trace || row.rationale}</strong>
      <span className={styles.subText}>
        <strong>What the portal looked at:</strong> {formatList(checkedSignals, "ITEM_NAME")}
      </span>
      <span className={styles.subText}>
        <strong>What helped most:</strong> {formatList(inputs.signals_that_helped_this_match, "ITEM_NAME")}
      </span>
      {retrievedRefs?.length ? (
        <span className={styles.subText}>
          <strong>Reference dishes checked:</strong> {formatList(retrievedRefs)}
        </span>
      ) : null}
      {inputs.captured_but_not_used_by_v1?.length ? (
        <span className={styles.subText}>
          <strong>Saved for later use:</strong> {formatList(inputs.captured_but_not_used_by_v1)}
        </span>
      ) : null}
      <span className={styles.subText}>
        <strong>Price note:</strong> {explainability.price_signal?.note || "Price was not checked for this row."}
      </span>
      <span className={styles.subText}>
        <strong>Why this estimate was given:</strong> {row.rationale}
      </span>
    </div>
  );
}

function DraftField({ fieldKey, draft, updateDraft }) {
  const field = FIELD_CONFIG[fieldKey];
  const Control = field.as === "textarea" ? "textarea" : "input";
  const controlProps =
    field.as === "textarea"
      ? {}
      : {
          inputMode: field.inputMode,
        };

  return (
    <label className={field.wide ? styles.fieldWide : styles.field}>
      <span className={styles.fieldLabelRow}>
        <span>{field.label}</span>
        <span
          className={`${styles.fieldTag} ${
            field.requirement === "Required" ? styles.fieldTagRequired : styles.fieldTagOptional
          }`}
        >
          {field.requirement}
        </span>
      </span>
      <Control
        {...controlProps}
        value={draft[fieldKey]}
        onChange={(event) => updateDraft(fieldKey, event.target.value)}
        placeholder={field.placeholder}
      />
      <span className={styles.fieldHelper}>{field.helper}</span>
    </label>
  );
}

export default function PortalWorkbench() {
  const [queue, setQueue] = useState(() => DEMO_ROWS.map((row) => ({ ...row })));
  const [draft, setDraft] = useState(() => createEmptyDraft());
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const queueSummary = useMemo(() => summarizeResults(results?.results || []), [results]);
  const draftHasContent = useMemo(() => hasMenuInputContent(draft), [draft]);
  const draftMissingFields = useMemo(() => getMissingRequiredFields(draft), [draft]);
  const readyCount = useMemo(
    () => queue.filter((row) => getMissingRequiredFields(row).length === 0).length,
    [queue]
  );
  const needsInputCount = queue.length - readyCount;
  const rowsWithOptionalContext = useMemo(
    () =>
      queue.filter(
        (row) =>
          row.description ||
          row.cuisine ||
          row.grammage ||
          row.mainIngredient1 ||
          row.mainIngredient2 ||
          row.mainIngredient3 ||
          row.compulsoryComponents ||
          row.optionalComponents
      ).length,
    [queue]
  );
  const estimatorCopy = useMemo(() => getEstimatorCopy(results?.estimator), [results]);

  function updateDraft(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function addDraftRow() {
    const missingFields = getMissingRequiredFields(draft);
    if (missingFields.length) {
      setError(`Add ${missingFields.join(", ")} before adding a menu item.`);
      return;
    }

    setQueue((current) => [
      ...current,
      normalizeMenuInput(draft, current.length, {
        rowId: `manual-${Date.now()}`,
      }),
    ]);
    setDraft(createEmptyDraft());
    setResults(null);
    setError("");
  }

  function removeRow(rowId) {
    setQueue((current) => current.filter((row) => row.rowId !== rowId));
    setResults(null);
  }

  function loadDemo() {
    setQueue(DEMO_ROWS.map((row) => ({ ...row })));
    setResults(null);
    setError("");
  }

  function clearAll() {
    setQueue([]);
    setResults(null);
    setError("");
  }

  async function handleCsvUpload(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    const parsed = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
    });

    const rows = parsed.data.map(mapCsvMenuRow).filter(hasMenuInputContent);
    if (!rows.length) {
      setError("The uploaded CSV did not contain readable menu rows.");
      return;
    }

    setQueue(rows.slice(0, 80));
    setResults(null);
    setError("");
  }

  async function runEstimate() {
    const { normalizedItems, errors: validationErrors } = validateMenuItems(queue);

    if (!normalizedItems.length) {
      setError("Add at least one menu item before running estimation.");
      return;
    }

    if (validationErrors.length) {
      setError(formatValidationErrors(validationErrors));
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: normalizedItems }),
      });

      const payload = await response.json();
      if (!response.ok) {
        const detailMessage = Array.isArray(payload.details) && payload.details.length ? formatValidationErrors(payload.details) : "";
        throw new Error(detailMessage || payload.error || "Request failed");
      }

      setResults(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to estimate menu items.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={styles.workbench} id="portal">
      <div className={styles.sectionHeading}>
        <span className={styles.kicker}>Step 1</span>
        <h2>Add your dishes and make sure each row has the basic details.</h2>
        <p>
          Every row needs <strong>RID</strong>, <strong>ITEM_NAME</strong>, and <strong>ITEM_PRICE</strong>. Add the
          optional fields only when they help explain the dish better, especially for custom items, combos, bowls, or
          branded dishes.
        </p>
      </div>

      <div className={styles.workbenchGrid}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.panelEyebrow}>Manual entry</span>
              <h3>Add one dish at a time</h3>
            </div>
            <button className={styles.secondaryButton} type="button" onClick={loadDemo}>
              Load demo set
            </button>
          </div>

          <p className={styles.formIntro}>
            Fields marked <strong>Required</strong> must be present before you can add the dish to the batch. Fields marked{" "}
            <strong>Optional</strong> improve the match when you have them. That includes compulsory and optional dish
            components for new dishes.
          </p>

          <div className={styles.formSectionList}>
            {FORM_SECTIONS.map((section) => (
              <section key={section.id} className={styles.formSection}>
                <div className={styles.formSectionHeader}>
                  <span className={styles.panelEyebrow}>{section.eyebrow}</span>
                  <h4>{section.title}</h4>
                  <p>{section.description}</p>
                </div>

                <div className={styles.formGrid}>
                  {section.fields.map((fieldKey) => (
                    <DraftField key={fieldKey} fieldKey={fieldKey} draft={draft} updateDraft={updateDraft} />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className={styles.formActions}>
            <button className={styles.primaryButton} type="button" onClick={addDraftRow}>
              Add item
            </button>
            <a className={styles.secondaryButton} href="/sample-menu.csv" download>
              Download sample CSV
            </a>
          </div>

          <p className={styles.formNote}>
            {draftHasContent
              ? draftMissingFields.length
                ? `This row still needs ${draftMissingFields.join(", ")} before it can be added.`
                : "This row has the required fields needed to join the batch."
              : "Start with RID, Item name, and Item price. Then add optional context if you have it."}
          </p>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.panelEyebrow}>CSV upload</span>
              <h3>Upload your menu file</h3>
            </div>
          </div>

          <div className={styles.uploadGuide}>
            <div className={styles.guideGrid}>
              <div className={`${styles.guideCard} ${styles.guideCardRequired}`}>
                <strong>Required columns</strong>
                <p>Every row must include these columns before estimation can run.</p>
                <div className={styles.guideList}>
                  <span className={styles.guideChip}>RID</span>
                  <span className={styles.guideChip}>ITEM_NAME</span>
                  <span className={styles.guideChip}>ITEM_PRICE</span>
                </div>
              </div>

              <div className={styles.guideCard}>
                <strong>Optional columns</strong>
                <p>Add these when you have them to improve matching for new or ambiguous dishes.</p>
                <div className={styles.guideList}>
                  {CSV_HEADER_ORDER.filter((field) => !["RID", "ITEM_NAME", "ITEM_PRICE"].includes(field)).map((field) => (
                    <span key={field} className={styles.guideChipMuted}>
                      {field}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <p className={styles.formNote}>
              <code>ITEM_PRICE</code> means the selling price of that dish, not a restaurant-level average. Older CSV
              headers such as <code>price</code>, <code>description</code>, and <code>cuisine</code> still import, but
              every row must end up with {formatColumnList(["RID", "ITEM_NAME", "ITEM_PRICE"])} before estimation runs.
              <br />
              <strong>COMPULSORY_COMPONENTS</strong> and <strong>OPTIONAL_COMPONENTS</strong> are optional enrichment
              fields for new or custom dishes.
            </p>
          </div>

          <label className={styles.uploadBox}>
            <input type="file" accept=".csv" onChange={handleCsvUpload} />
            <strong>Upload a CSV with one row per dish.</strong>
            <span>Required columns: RID, ITEM_NAME, ITEM_PRICE.</span>
            <span>
              Optional columns can include description, cuisine, grammage, ingredient details, and compulsory or
              optional dish components.
            </span>
          </label>

          <div className={styles.formActions}>
            <button className={styles.secondaryButton} type="button" onClick={clearAll}>
              Clear batch
            </button>
            <button className={styles.primaryButton} type="button" onClick={runEstimate} disabled={loading}>
              {loading ? "Estimating..." : "Run estimate"}
            </button>
          </div>

          {error ? <p className={styles.errorText}>{error}</p> : null}
        </div>
      </div>

      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <span className={styles.panelEyebrow}>Step 2</span>
            <h3>{queue.length ? `Check the ${queue.length} dishes in this batch before running the estimate` : "No dishes have been added to this batch yet"}</h3>
          </div>
          <p className={styles.batchHint}>
            {readyCount} ready now. {needsInputCount} still need required fields. This screen supports up to 80 dishes per batch.
          </p>
        </div>

        <div className={styles.batchSummary}>
          <article className={styles.batchSummaryCard}>
            <span>Required fields complete</span>
            <strong>{readyCount}</strong>
            <p>Rows that already include RID, ITEM_NAME, and ITEM_PRICE.</p>
          </article>
          <article className={styles.batchSummaryCard}>
            <span>Need more input</span>
            <strong>{needsInputCount}</strong>
            <p>Rows that will be blocked until the missing required fields are filled.</p>
          </article>
          <article className={styles.batchSummaryCard}>
            <span>Optional context added</span>
            <strong>{rowsWithOptionalContext}</strong>
            <p>Rows that already include description, cuisine, ingredients, grammage, or dish-component details.</p>
          </article>
        </div>

        {queue.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Dish ID</th>
                  <th>Dish name</th>
                  <th>Selling price</th>
                  <th>Extra details</th>
                  <th>Can estimate?</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {queue.map((row) => {
                  const missingFields = getMissingRequiredFields(row);
                  const isReady = missingFields.length === 0;

                  return (
                    <tr key={row.rowId}>
                      <td>{row.rid || "Missing"}</td>
                      <td>{row.name || "Missing"}</td>
                      <td>{row.price || "Missing"}</td>
                      <td>
                        <QueueDetailsSummary row={row} />
                      </td>
                      <td>
                        <div className={styles.statusCell}>
                          <span className={`${styles.statusBadge} ${isReady ? styles.statusReady : styles.statusNeeds}`}>
                            {isReady ? "Ready to estimate" : "Needs required input"}
                          </span>
                          <span className={styles.statusNote}>
                            {isReady ? "RID, ITEM_NAME, and ITEM_PRICE are present." : `Missing ${missingFields.join(", ")}.`}
                          </span>
                        </div>
                      </td>
                      <td>
                        <button className={styles.inlineButton} type="button" onClick={() => removeRow(row.rowId)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.emptyState}>
            <strong>No dishes have been added yet.</strong>
            <p>Add a dish manually or upload a CSV. Each row needs RID, ITEM_NAME, and ITEM_PRICE before it can run.</p>
          </div>
        )}
      </div>

      {results ? (
        <div className={styles.resultsBlock}>
          <div className={styles.sectionHeading}>
            <span className={styles.kicker}>Step 3</span>
            <h2>Review the estimates and focus only on the rows that need attention.</h2>
            <p>
              {estimatorCopy.detail} The API returns a reasoning trace, estimated calories and protein, extracted
              values when they are present in the description, and the confidence structure supported by the active
              engine.
            </p>
          </div>

          <div className={styles.outputContractCard}>
            <strong>{estimatorCopy.title}</strong>
            <p>
              This batch was processed with <strong>{estimatorCopy.title.toLowerCase()}</strong>
              {results.estimator?.model ? (
                <>
                  {" "}
                  using <code>{results.estimator.model}</code>
                </>
              ) : null}
            </p>
            <p>
              This batch captured explicit values from descriptions on{" "}
              <strong>{results.summary.extractedProteinCount}</strong> rows for protein and{" "}
              <strong>{results.summary.extractedEnergyCount}</strong> rows for calories.
            </p>
            {results.estimator?.fallback?.active ? (
              <p>
                <strong>Fallback reason:</strong> {results.estimator.fallback.detail}
              </p>
            ) : null}
          </div>

          <div className={styles.metricRow}>
            <div className={styles.metricCard}>
              <span>Estimated</span>
              <strong>{results.summary.matchedCount}</strong>
              <p>{results.summary.unmatchedCount} rows still did not get a reliable estimate and need review.</p>
            </div>
            <div className={styles.metricCard}>
              <span>Needs review</span>
              <strong>{queueSummary.reviewCount}</strong>
              <p>Rows marked medium confidence, low confidence, or unmatched.</p>
            </div>
            <div className={styles.metricCard}>
              <span>Average calories</span>
              <strong>{queueSummary.averageCalories} kcal</strong>
              <p>Average across the rows that received a calorie estimate in this batch.</p>
            </div>
            <div className={styles.metricCard}>
              <span>Usually ready</span>
              <strong>{queueSummary.highConfidence}</strong>
              <p>Rows marked high confidence and usually safe to move forward after a quick check.</p>
            </div>
          </div>

          <div className={styles.confidenceGrid}>
            {Object.entries(CONFIDENCE_GUIDE).map(([band, guide]) => (
              <article key={band} className={styles.confidenceCard}>
                <span>{band} confidence</span>
                <strong>{guide.headline}</strong>
                <p>{guide.detail}</p>
              </article>
            ))}
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Your dish</th>
                  <th>Best match found</th>
                  <th>Estimate</th>
                  <th>What to do next</th>
                  <th>Why this estimate was given</th>
                </tr>
              </thead>
              <tbody>
                {results.results.map((row, index) => (
                  <tr key={row.result_key || `${row.row_id}-${index}`}>
                    <td>
                      <div className={styles.statusCell}>
                        <strong>{row.input_name}</strong>
                        <span className={styles.subText}>RID: {row.row_id}</span>
                        <span className={styles.subText}>{row.input_cuisine || "Cuisine not provided"}</span>
                        <span className={styles.subText}>Item price: {row.input_item_price || "Not provided"}</span>
                        <ComponentSummary
                          compulsory={row.input_compulsory_components}
                          optional={row.input_optional_components}
                        />
                      </div>
                    </td>
                    <td>
                      <div className={styles.statusCell}>
                        <strong>{row.matched_name || "Manual review"}</strong>
                        <span className={styles.subText}>{row.match_type}</span>
                        <span className={styles.subText}>Support: {row.support_count || "-"}</span>
                        <span className={styles.subText}>Source: {row.source_lineage}</span>
                      </div>
                    </td>
                    <td>
                      <div className={styles.statusCell}>
                        <span className={styles.subText}>
                          <strong>Calories:</strong>{" "}
                          {row.estimated_energy_kcal != null ? `${row.estimated_energy_kcal} kcal` : "Not available"}
                        </span>
                        <span className={styles.subText}>
                          <strong>Protein:</strong>{" "}
                          {row.estimated_protein_g != null ? `${row.estimated_protein_g} g` : "Not available"}
                        </span>
                        <ExtractionSummary row={row} />
                      </div>
                    </td>
                    <td>
                      <ConfidenceSummary row={row} />
                    </td>
                    <td>
                      <ExplainabilitySummary row={row} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
