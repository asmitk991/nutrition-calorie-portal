"use client";

import { useMemo, useState } from "react";
import Papa from "papaparse";

import styles from "@/app/page.module.css";


const DEMO_ROWS = [
  {
    rowId: "demo-1",
    name: "Paneer Butter Masala",
    description: "Paneer cubes in rich butter tomato gravy",
    cuisine: "North Indian",
    price: "250",
  },
  {
    rowId: "demo-2",
    name: "Chicken Fried Rice",
    description: "Wok tossed rice with chicken and seasoning",
    cuisine: "Chinese/Pan-Asian",
    price: "249",
  },
  {
    rowId: "demo-3",
    name: "Veg Hakka Noodles",
    description: "Stir fried noodles with vegetables",
    cuisine: "Chinese/Pan-Asian",
    price: "199",
  },
];


function summarizeResults(results) {
  const matched = results.filter((item) => item.estimated_energy_kcal != null);
  const averageCalories = matched.length
    ? Math.round(matched.reduce((sum, item) => sum + item.estimated_energy_kcal, 0) / matched.length)
    : 0;
  const averageProtein = matched.length
    ? Math.round((matched.reduce((sum, item) => sum + item.estimated_protein_g, 0) / matched.length) * 10) / 10
    : 0;

  return {
    matched: matched.length,
    unmatched: results.length - matched.length,
    averageCalories,
    averageProtein,
  };
}


function mapCsvRow(row, index) {
  return {
    rowId: `csv-${index + 1}`,
    name: row.ITEM_NAME || row.item_name || row.name || row.ItemName || "",
    description: row.ITEM_DESCRIPTION || row.item_description || row.description || "",
    cuisine: row.RX_CUISINE || row.cuisine || row.CUISINE || "",
    price: row.ITEM_PRICE || row.price || row.Price || "",
  };
}


export default function PortalWorkbench() {
  const [queue, setQueue] = useState(DEMO_ROWS);
  const [draft, setDraft] = useState({ name: "", description: "", cuisine: "", price: "" });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const queueSummary = useMemo(() => summarizeResults(results?.results || []), [results]);

  function updateDraft(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function addDraftRow() {
    if (!draft.name.trim()) {
      return;
    }

    setQueue((current) => [
      ...current,
      {
        rowId: `manual-${Date.now()}`,
        name: draft.name.trim(),
        description: draft.description.trim(),
        cuisine: draft.cuisine.trim(),
        price: draft.price.trim(),
      },
    ]);
    setDraft({ name: "", description: "", cuisine: "", price: "" });
    setResults(null);
    setError("");
  }

  function removeRow(rowId) {
    setQueue((current) => current.filter((row) => row.rowId !== rowId));
    setResults(null);
  }

  function loadDemo() {
    setQueue(DEMO_ROWS);
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

    const rows = parsed.data.map(mapCsvRow).filter((row) => row.name.trim());
    if (!rows.length) {
      setError("The uploaded CSV did not contain readable menu rows.");
      return;
    }

    setQueue(rows.slice(0, 80));
    setResults(null);
    setError("");
  }

  async function runEstimate() {
    if (!queue.length) {
      setError("Add at least one menu item before running estimation.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: queue }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Request failed");
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
        <span className={styles.kicker}>Restaurant workflow</span>
        <h2>Upload a menu, estimate calories, and flag where the catalog is still weak.</h2>
        <p>
          This V1 workbench is designed for restaurant ops teams. It uses the modeled Swiggy catalog already present in this
          workspace and converts it into a menu-facing estimation layer.
        </p>
      </div>

      <div className={styles.workbenchGrid}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.panelEyebrow}>Quick add</span>
              <h3>Build a batch manually</h3>
            </div>
            <button className={styles.secondaryButton} type="button" onClick={loadDemo}>
              Load demo set
            </button>
          </div>

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Dish name</span>
              <input value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} placeholder="Paneer Butter Masala" />
            </label>
            <label className={styles.field}>
              <span>Cuisine</span>
              <input value={draft.cuisine} onChange={(event) => updateDraft("cuisine", event.target.value)} placeholder="North Indian" />
            </label>
            <label className={styles.fieldWide}>
              <span>Description</span>
              <textarea
                value={draft.description}
                onChange={(event) => updateDraft("description", event.target.value)}
                placeholder="Paneer cubes in rich butter tomato gravy"
              />
            </label>
            <label className={styles.field}>
              <span>Menu price</span>
              <input value={draft.price} onChange={(event) => updateDraft("price", event.target.value)} placeholder="250" />
            </label>
          </div>

          <div className={styles.formActions}>
            <button className={styles.primaryButton} type="button" onClick={addDraftRow}>
              Add item
            </button>
            <a className={styles.secondaryButton} href="/sample-menu.csv" download>
              Download sample CSV
            </a>
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.panelEyebrow}>CSV intake</span>
              <h3>Drop in a restaurant menu file</h3>
            </div>
          </div>

          <label className={styles.uploadBox}>
            <input type="file" accept=".csv" onChange={handleCsvUpload} />
            <strong>Upload a CSV with ITEM_NAME and optional ITEM_DESCRIPTION.</strong>
            <span>We also read RX_CUISINE and ITEM_PRICE when they are available.</span>
          </label>

          <div className={styles.formActions}>
            <button className={styles.secondaryButton} type="button" onClick={clearAll}>
              Clear batch
            </button>
            <button className={styles.primaryButton} type="button" onClick={runEstimate} disabled={loading}>
              {loading ? "Estimating..." : "Estimate calories"}
            </button>
          </div>

          {error ? <p className={styles.errorText}>{error}</p> : null}
        </div>
      </div>

      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <span className={styles.panelEyebrow}>Current batch</span>
            <h3>{queue.length} menu items ready for estimation</h3>
          </div>
          <p className={styles.batchHint}>For the V1 demo the queue is capped at 80 rows.</p>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Dish</th>
                <th>Description</th>
                <th>Cuisine</th>
                <th>Price</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {queue.map((row) => (
                <tr key={row.rowId}>
                  <td>{row.name}</td>
                  <td>{row.description || "Not provided"}</td>
                  <td>{row.cuisine || "Unknown"}</td>
                  <td>{row.price || "-"}</td>
                  <td>
                    <button className={styles.inlineButton} type="button" onClick={() => removeRow(row.rowId)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {results ? (
        <div className={styles.resultsBlock}>
          <div className={styles.sectionHeading}>
            <span className={styles.kicker}>Estimation output</span>
            <h2>Portfolio summary for the uploaded menu</h2>
          </div>

          <div className={styles.metricRow}>
            <div className={styles.metricCard}>
              <span>Matched items</span>
              <strong>{results.summary.matchedCount}</strong>
              <p>{results.summary.unmatchedCount} still need manual review.</p>
            </div>
            <div className={styles.metricCard}>
              <span>Average calories</span>
              <strong>{queueSummary.averageCalories} kcal</strong>
              <p>Across the matched menu rows in this batch.</p>
            </div>
            <div className={styles.metricCard}>
              <span>Average protein</span>
              <strong>{queueSummary.averageProtein} g</strong>
              <p>Useful for later protein-calorie calibration.</p>
            </div>
            <div className={styles.metricCard}>
              <span>High confidence</span>
              <strong>{results.summary.highConfidence}</strong>
              <p>Rows with strong support from the current catalog layer.</p>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Input dish</th>
                  <th>Matched analogue</th>
                  <th>Calories</th>
                  <th>Protein</th>
                  <th>Confidence</th>
                  <th>Support</th>
                  <th>Why</th>
                </tr>
              </thead>
              <tbody>
                {results.results.map((row) => (
                  <tr key={row.row_id}>
                    <td>
                      <strong>{row.input_name}</strong>
                      <span className={styles.subText}>{row.input_cuisine || "Cuisine not provided"}</span>
                    </td>
                    <td>
                      {row.matched_name || "Manual review"}
                      <span className={styles.subText}>{row.match_type}</span>
                    </td>
                    <td>{row.estimated_energy_kcal != null ? `${row.estimated_energy_kcal} kcal` : "-"}</td>
                    <td>{row.estimated_protein_g != null ? `${row.estimated_protein_g} g` : "-"}</td>
                    <td>
                      <span className={`${styles.badge} ${styles[`badge${row.confidence_band}`]}`}>{row.confidence_band}</span>
                      <span className={styles.subText}>{row.confidence_score}/100</span>
                    </td>
                    <td>{row.support_count || "-"}</td>
                    <td>{row.rationale}</td>
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
