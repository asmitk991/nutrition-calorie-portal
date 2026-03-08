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
      <header className={styles.topbar}>
        <div className={styles.brandLockup}>
          <span className={styles.brandMark}>RX</span>
          <div>
            <strong>Restaurant Calorie Portal</strong>
            <span>Swiggy-aligned estimation workspace</span>
          </div>
        </div>
        <div className={styles.topbarMeta}>
          <span>V1</span>
          <span>{overview.modeledItems.toLocaleString()} modeled rows</span>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroMain}>
          <span className={styles.kicker}>For restaurant onboarding and calorie rollout</span>
          <h1>Estimate calories fast, show confidence clearly, and push weak dishes into review.</h1>
          <p className={styles.heroText}>
            This product turns the existing Swiggy calorie work into something your team can actually demo. Restaurants can
            upload a menu, get dish-level calorie estimates, and understand which items are already well supported by the
            current catalog and which ones still need analyst calibration.
          </p>

          <div className={styles.heroActions}>
            <a className={styles.primaryButton} href="#portal">
              Launch estimator
            </a>
            <a className={styles.secondaryButton} href="/sample-menu.csv" download>
              Download sample CSV
            </a>
          </div>

          <div className={styles.heroFootnote}>
            <span>Built from your current CSV outputs, training context, and prototype lineage.</span>
          </div>
        </div>

        <div className={styles.heroRail}>
          <div className={styles.heroRailCard}>
            <span>Catalog coverage</span>
            <strong>{overview.uniqueDishNames.toLocaleString()}</strong>
            <p>normalized dish anchors ready for matching in the V1 portal.</p>
          </div>
          <div className={styles.heroRailCardDark}>
            <span>Primary cuisine block</span>
            <strong>{overview.topCuisines[0]?.name || "North Indian"}</strong>
            <p>{overview.topCuisines[0]?.count?.toLocaleString() || 0} items in the current modeled demand set.</p>
          </div>
          <div className={styles.heroRailGrid}>
            <div className={styles.heroMiniStat}>
              <span>Description coverage</span>
              <strong>{formatPercent(overview.descriptionCoverage)}</strong>
            </div>
            <div className={styles.heroMiniStat}>
              <span>Regex calorie evidence</span>
              <strong>{formatPercent(overview.regexEnergyCoverage)}</strong>
            </div>
            <div className={styles.heroMiniStat}>
              <span>Training median</span>
              <strong>{overview.trainingSignals.avgCalories} kcal</strong>
            </div>
            <div className={styles.heroMiniStat}>
              <span>Reference rows</span>
              <strong>{overview.referenceRows.toLocaleString()}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.signalStrip}>
        <article className={styles.signalCard}>
          <span>Restaurant upload flow</span>
          <strong>Manual entry + CSV intake</strong>
          <p>Immediate batch estimation for ops demos and onboarding calls.</p>
        </article>
        <article className={styles.signalCard}>
          <span>Decision support</span>
          <strong>Calories + confidence + support</strong>
          <p>Teams can separate strong catalog matches from dishes that still need human review.</p>
        </article>
        <article className={styles.signalCard}>
          <span>Rollout intent</span>
          <strong>Bridge to user-facing Swiggy calories</strong>
          <p>This V1 is designed to operationalize the current model outputs, not hide uncertainty.</p>
        </article>
      </section>

      <PortalWorkbench />

      <section className={styles.storyGrid}>
        <div className={styles.panel}>
          <div className={styles.sectionHeading}>
            <span className={styles.kicker}>Data backbone</span>
            <h2>The portal is using the work already done, not replacing it.</h2>
          </div>

          <div className={styles.storyList}>
            <article className={styles.storyCard}>
              <h3>Prediction surface</h3>
              <p>
                `final_prediction_v4.csv` is the live estimation layer in this V1. That keeps the product demo grounded in
                the calorie outputs you already have.
              </p>
            </article>
            <article className={styles.storyCard}>
              <h3>Swiggy metadata context</h3>
              <p>
                `hp_test_data.csv` adds cuisine and catalog context so every restaurant match looks like a product decision,
                not a spreadsheet row.
              </p>
            </article>
            <article className={styles.storyCard}>
              <h3>Training context</h3>
              <p>
                `hp_train_data.csv` and the FAISS reference set frame where your current data is strong and what the next
                refinement loop should target.
              </p>
            </article>
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.sectionHeading}>
            <span className={styles.kicker}>Operational workflow</span>
            <h2>How a restaurant ops team would use this product.</h2>
          </div>

          <div className={styles.storyList}>
            <article className={styles.storyCard}>
              <h3>1. Upload menu</h3>
              <p>Paste dishes manually or drop in a CSV with names, descriptions, cuisines, and prices.</p>
            </article>
            <article className={styles.storyCard}>
              <h3>2. Review confidence</h3>
              <p>See calorie estimates with support counts and rationale before anything moves closer to production.</p>
            </article>
            <article className={styles.storyCard}>
              <h3>3. Escalate edge cases</h3>
              <p>Low-confidence rows become the queue for analyst review, restaurant clarification, or model refinement.</p>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeading}>
          <span className={styles.kicker}>High-support anchors</span>
          <h2>Modeled dishes that already give the portal real weight.</h2>
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
          <h2>The current portal stands on top of the earlier estimator workflow.</h2>
        </div>

        <div className={styles.imageGrid}>
          <figure className={styles.imageCard}>
            <Image src="/legacy-upload.png" alt="Legacy upload screen from the original estimator." width={1867} height={749} />
            <figcaption>The original prototype already established the menu-upload behavior.</figcaption>
          </figure>
          <figure className={styles.imageCard}>
            <Image src="/legacy-results.png" alt="Legacy results preview from the original estimator." width={1849} height={305} />
            <figcaption>This redesign turns that same workflow into a stronger team-facing product surface.</figcaption>
          </figure>
        </div>
      </section>
    </main>
  );
}
