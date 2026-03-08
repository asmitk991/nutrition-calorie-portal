import PortalWorkbench from "@/components/portal-workbench";
import { getFeaturedItems, getOverview } from "@/lib/portal-data";

import styles from "./page.module.css";


function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}


function formatCompactNumber(value) {
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}


export default async function Home() {
  const overview = await getOverview();
  const featured = (await getFeaturedItems()).slice(0, 4);

  const leadCuisine = overview.topCuisines[0];
  const confidenceTotal = overview.confidenceMix.reduce((sum, item) => sum + item.count, 0);
  const topModeledItems = overview.topModeledItems.slice(0, 5);

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.brandLockup}>
          <span className={styles.brandMark}>RX</span>
          <div>
            <strong>RX Restaurant Calorie Portal</strong>
            <span>Swiggy-aligned onboarding dashboard for calorie estimation</span>
          </div>
        </div>

        <div className={styles.topbarMeta}>
          <span>Dashboard V1</span>
          <span>{overview.modeledItems.toLocaleString()} modeled rows live</span>
        </div>
      </header>

      <section className={styles.commandDeck}>
        <div className={styles.heroPanel}>
          <div className={styles.heroCopy}>
            <span className={styles.kicker}>Restaurant Ops Dashboard</span>
            <h1>Cleaner menu estimation. Sharper signals. Less dashboard noise.</h1>
            <p className={styles.heroText}>
              This revamp turns the landing page into an operating surface for onboarding restaurant menus. Teams can upload
              a batch, estimate calories against the current catalog, and immediately see where the model is strong versus
              where analyst review is still required.
            </p>
          </div>

          <div className={styles.heroActions}>
            <a className={styles.primaryButton} href="#portal">
              Open estimator
            </a>
            <a className={styles.secondaryButton} href="/sample-menu.csv" download>
              Download sample CSV
            </a>
          </div>

          <div className={styles.heroStatsRow}>
            <article className={styles.dashboardStat}>
              <span>Catalog footprint</span>
              <strong>{formatCompactNumber(overview.modeledItems)}</strong>
              <p>Modeled menu rows currently backing match confidence and calorie estimates.</p>
            </article>
            <article className={styles.dashboardStat}>
              <span>Dish anchors</span>
              <strong>{formatCompactNumber(overview.uniqueDishNames)}</strong>
              <p>Normalized dish names ready to absorb restaurant menu variants in V1.</p>
            </article>
            <article className={styles.dashboardStat}>
              <span>Description coverage</span>
              <strong>{formatPercent(overview.descriptionCoverage)}</strong>
              <p>Enough text context to support stronger analog matching when names get messy.</p>
            </article>
            <article className={styles.dashboardStat}>
              <span>Training median</span>
              <strong>{Math.round(overview.trainingSignals.avgCalories)} kcal</strong>
              <p>Average calorie signal from the current training backbone used for estimation.</p>
            </article>
          </div>
        </div>

        <aside className={styles.heroSidebar}>
          <article className={styles.sidebarCardDark}>
            <span className={styles.panelEyebrow}>Live operating posture</span>
            <h2>Where the current model is strongest.</h2>

            <div className={styles.statusList}>
              <div className={styles.statusRow}>
                <span>Primary cuisine density</span>
                <strong>{leadCuisine?.name || "North Indian"}</strong>
                <p>{leadCuisine?.count?.toLocaleString() || 0} rows dominate the present demand mix.</p>
              </div>
              <div className={styles.statusRow}>
                <span>Reference backbone</span>
                <strong>{overview.referenceRows.toLocaleString()}</strong>
                <p>Reference rows are available to explain why a menu line matched the way it did.</p>
              </div>
              <div className={styles.statusRow}>
                <span>Regex evidence</span>
                <strong>{formatPercent(overview.regexEnergyCoverage)}</strong>
                <p>Explicit calorie mentions remain sparse, so analogue quality matters more than labels.</p>
              </div>
            </div>
          </article>

          <article className={styles.sidebarCard}>
            <div className={styles.sidebarHeader}>
              <span className={styles.panelEyebrow}>Cuisine spread</span>
              <h2>Demand concentration</h2>
            </div>

            <div className={styles.barList}>
              {overview.topCuisines.slice(0, 5).map((cuisine) => (
                <div key={cuisine.name} className={styles.barRow}>
                  <div className={styles.barMeta}>
                    <strong>{cuisine.name}</strong>
                    <span>{cuisine.count.toLocaleString()} rows</span>
                  </div>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{ width: `${(cuisine.count / (leadCuisine?.count || cuisine.count)) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>
        </aside>
      </section>

      <section className={styles.dashboardGrid}>
        <article className={styles.panel}>
          <div className={styles.sectionHeading}>
            <span className={styles.kicker}>Confidence split</span>
            <h2>Read the catalog honestly before showing calories downstream.</h2>
            <p>
              The page now foregrounds confidence as an operational signal. High-support matches can move faster; medium and
              low-support dishes become the review queue instead of getting buried inside the page.
            </p>
          </div>

          <div className={styles.confidenceGrid}>
            {overview.confidenceMix.map((entry) => (
              <article key={entry.label} className={styles.confidenceCard}>
                <span>{entry.label} confidence</span>
                <strong>{entry.count.toLocaleString()}</strong>
                <p>{formatPercent(entry.count / confidenceTotal)} of normalized dish anchors in the current mix.</p>
              </article>
            ))}
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.sectionHeading}>
            <span className={styles.kicker}>Ops flow</span>
            <h2>What this dashboard should help a team do next.</h2>
          </div>

          <div className={styles.workflowList}>
            <article className={styles.workflowCard}>
              <span>01</span>
              <h3>Stage the menu batch</h3>
              <p>Use manual entry for fast demos or CSV intake for real onboarding conversations.</p>
            </article>
            <article className={styles.workflowCard}>
              <span>02</span>
              <h3>Estimate with context</h3>
              <p>Review calories, protein, support count, and rationale together instead of as separate fragments.</p>
            </article>
            <article className={styles.workflowCard}>
              <span>03</span>
              <h3>Escalate weak rows</h3>
              <p>Push low-confidence dishes into analyst follow-up rather than over-trusting the catalog match.</p>
            </article>
          </div>
        </article>
      </section>

      <PortalWorkbench />

      <section className={styles.bottomGrid}>
        <article className={styles.panel}>
          <div className={styles.sectionHeading}>
            <span className={styles.kicker}>High-frequency dishes</span>
            <h2>The demand patterns already shaping your menu matches.</h2>
          </div>

          <div className={styles.rankedList}>
            {topModeledItems.map((item, index) => (
              <article key={item.name} className={styles.rankedCard}>
                <span className={styles.rankedIndex}>0{index + 1}</span>
                <div>
                  <h3>{item.name}</h3>
                  <p>{item.count.toLocaleString()} modeled rows already reinforce this dish family.</p>
                </div>
              </article>
            ))}
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.sectionHeading}>
            <span className={styles.kicker}>Reliable anchors</span>
            <h2>Featured reference dishes with enough support to guide estimation.</h2>
          </div>

          <div className={styles.featureGridCompact}>
            {featured.map((item) => (
              <article key={item.normalized_name} className={styles.featureCard}>
                <span className={styles.featureTag}>{item.top_cuisine || item.reference_cuisine || "Catalog item"}</span>
                <h3>{item.display_name}</h3>
                <p>{item.description || "Short-form description not available in the current export."}</p>
                <div className={styles.featureStats}>
                  <strong>{Math.round(item.predicted_energy_kcal)} kcal</strong>
                  <span>{item.predicted_protein_g} g protein</span>
                  <span>{item.support_count.toLocaleString()} supporting rows</span>
                </div>
              </article>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
