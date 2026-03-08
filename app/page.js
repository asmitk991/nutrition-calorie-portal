import Image from "next/image";

import PortalWorkbench from "@/components/portal-workbench";
import { getFeaturedItems, getOverview } from "@/lib/portal-data";

import styles from "./page.module.css";


function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}


export default async function Home() {
  const overview = await getOverview();
  const featured = await getFeaturedItems();

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.kicker}>Version 1 for restaurant partners</span>
          <h1>Turn the existing Swiggy calorie work into a portal your team can review today.</h1>
          <p className={styles.heroText}>
            This V1 does not pretend to be a final nutrition engine. It operationalizes the current modeled catalog so
            restaurants can upload a menu, see estimated calories per item, and understand where the rollout is already
            strong versus where human refinement is still needed.
          </p>

          <div className={styles.heroActions}>
            <a className={styles.primaryButton} href="#portal">
              Open estimator
            </a>
            <a className={styles.secondaryButton} href="/sample-menu.csv" download>
              Download sample menu
            </a>
          </div>
        </div>

        <div className={styles.heroPanel}>
          <div className={styles.heroStat}>
            <span>Modeled catalog rows</span>
            <strong>{overview.modeledItems.toLocaleString()}</strong>
          </div>
          <div className={styles.heroStat}>
            <span>Normalized dish names</span>
            <strong>{overview.uniqueDishNames.toLocaleString()}</strong>
          </div>
          <div className={styles.heroStat}>
            <span>Training reference rows</span>
            <strong>{overview.referenceRows.toLocaleString()}</strong>
          </div>
          <div className={styles.heroStat}>
            <span>Description coverage</span>
            <strong>{formatPercent(overview.descriptionCoverage)}</strong>
          </div>
        </div>
      </section>

      <div className={styles.metricRow}>
        <div className={styles.metricCard}>
          <span>Swiggy menu coverage</span>
          <strong>{overview.testItems.toLocaleString()} rows</strong>
          <p>Existing test-side items already scored with predicted calories and protein.</p>
        </div>
        <div className={styles.metricCard}>
          <span>Direct evidence layer</span>
          <strong>{formatPercent(overview.regexEnergyCoverage)}</strong>
          <p>Rows where explicit calorie text was directly extracted in the current export.</p>
        </div>
        <div className={styles.metricCard}>
          <span>Training median</span>
          <strong>{overview.trainingSignals.avgCalories} kcal</strong>
          <p>Median calorie label in the current high-protein training set.</p>
        </div>
        <div className={styles.metricCard}>
          <span>Primary cuisine block</span>
          <strong>{overview.topCuisines[0]?.name || "North Indian"}</strong>
          <p>The largest cuisine segment in the current modeled demand set.</p>
        </div>
      </div>

      <PortalWorkbench />

      <section className={styles.storyGrid}>
        <div className={styles.panel}>
          <div className={styles.sectionHeading}>
            <span className={styles.kicker}>What this V1 uses</span>
            <h2>The portal is built on top of the modeling work already in this workspace.</h2>
          </div>

          <div className={styles.storyList}>
            <article className={styles.storyCard}>
              <h3>Modeled prediction layer</h3>
              <p>
                `final_prediction_v4.csv` provides the immediate calorie and protein outputs for the Swiggy catalog. This
                is the first estimation surface powering the portal.
              </p>
            </article>
            <article className={styles.storyCard}>
              <h3>Demand-side metadata</h3>
              <p>
                `hp_test_data.csv` adds cuisine, classifier, and segment context so each match feels like a product
                workflow instead of a bare score lookup.
              </p>
            </article>
            <article className={styles.storyCard}>
              <h3>Training and reference context</h3>
              <p>
                `hp_train_data.csv` and the FAISS reference dataset are used to explain coverage, maturity, and what the
                next refinement loop should focus on.
              </p>
            </article>
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.sectionHeading}>
            <span className={styles.kicker}>Rollout logic</span>
            <h2>How restaurants would actually use this.</h2>
          </div>

          <div className={styles.storyList}>
            <article className={styles.storyCard}>
              <h3>Step 1</h3>
              <p>Upload a menu or enter dishes manually. The portal matches each line against the modeled Swiggy corpus.</p>
            </article>
            <article className={styles.storyCard}>
              <h3>Step 2</h3>
              <p>Review calories, protein, confidence, and support counts before sending the items further downstream.</p>
            </article>
            <article className={styles.storyCard}>
              <h3>Step 3</h3>
              <p>Send low-confidence or no-match rows into analyst review, nutrition ops, or restaurant clarification.</p>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeading}>
          <span className={styles.kicker}>Catalog intelligence</span>
          <h2>High-support dish anchors from the current modeled catalog.</h2>
        </div>

        <div className={styles.featureGrid}>
          {featured.map((item) => (
            <article key={item.normalized_name} className={styles.featureCard}>
              <span className={styles.featureTag}>{item.top_cuisine || item.reference_cuisine || "Catalog item"}</span>
              <h3>{item.display_name}</h3>
              <p>{item.description || "Short-form description not available in the current export."}</p>
              <div className={styles.featureStats}>
                <strong>{item.predicted_energy_kcal} kcal</strong>
                <span>{item.predicted_protein_g} g protein</span>
                <span>{item.support_count} modeled rows</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeading}>
          <span className={styles.kicker}>Prototype lineage</span>
          <h2>This portal inherits the original Streamlit workflow but reframes it for product review.</h2>
        </div>

        <div className={styles.imageGrid}>
          <figure className={styles.imageCard}>
            <Image src="/legacy-upload.png" alt="Legacy upload screen from the original estimator." width={1867} height={749} />
            <figcaption>The earlier prototype already proved the CSV upload and batch estimation flow.</figcaption>
          </figure>
          <figure className={styles.imageCard}>
            <Image src="/legacy-results.png" alt="Legacy results preview from the original estimator." width={1849} height={305} />
            <figcaption>This V1 keeps that operational intent but upgrades the framing for restaurant rollout.</figcaption>
          </figure>
        </div>
      </section>
    </main>
  );
}
