import PortalWorkbench from "@/components/portal-workbench";
import { REQUIRED_MENU_FIELDS } from "@/lib/menu-input-schema";
import { getFeaturedItems, getOverview } from "@/lib/portal-data";

import styles from "./page.module.css";

export default async function Home() {
  const overview = await getOverview();
  const featured = (await getFeaturedItems()).slice(0, 4);
  const topModeledItems = overview.topModeledItems.slice(0, 5);

  const confidenceGuide = [
    {
      band: "High confidence",
      headline: "Usually ready to publish",
      detail:
        "The portal found the same dish or a very strong comparison. Check only if the recipe, portion, or included sides are unusual.",
    },
    {
      band: "Medium confidence",
      headline: "Review before you use it",
      detail:
        "A reasonable comparison was found, but some dish details are broad or missing. Review if portions, add-ons, or prep style differ.",
    },
    {
      band: "Low confidence",
      headline: "Send for manual check",
      detail:
        "The portal could not find strong enough support. Add more dish context if you have it and do not publish without review.",
    },
  ];

  const ownerTips = [
    {
      step: "01",
      title: "Use the exact menu name",
      detail: "Keep the dish name the same as the name shown to customers. Small naming differences can change which match is chosen.",
    },
    {
      step: "02",
      title: "Add description for broad names",
      detail: "If your dish is branded, custom, or generic, a short description helps the portal avoid the wrong comparison.",
    },
    {
      step: "03",
      title: "List key ingredients or components",
      detail: "Use ingredients, compulsory components, and optional components for platters, bowls, wraps, combos, and new dishes.",
    },
    {
      step: "04",
      title: "Use item price only",
      detail: "Enter the selling price for that dish only. Do not use restaurant-level averages or premium positioning as a shortcut.",
    },
    {
      step: "05",
      title: "Review custom portions",
      detail: "If the dish has unusual sides, extra cheese, larger portions, or special prep, review the estimate before publishing.",
    },
  ];

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.brandLockup}>
          <span className={styles.brandMark}>RX</span>
          <div>
            <strong>RX Menu Nutrition Desk</strong>
            <span>Upload your menu, check the estimate, publish only what is ready.</span>
          </div>
        </div>

        <div className={styles.topbarMeta}>
          <span>Required today: RID, ITEM_NAME, ITEM_PRICE</span>
          <span>Upload limit: 80 dishes per batch</span>
        </div>
      </header>

      <section className={styles.commandDeck}>
        <div className={styles.heroPanel}>
          <div className={styles.heroCopy}>
            <span className={styles.kicker}>Built for restaurant owners</span>
            <h1>Turn menu rows into calorie estimates your team can actually review.</h1>
            <p className={styles.heroText}>
              Start with three required fields for each dish: your row ID, the dish name, and the dish price. Then add
              optional details only when you have them. The portal will show which rows look ready, which need review,
              and which still need manual checking.
            </p>
          </div>

          <div className={styles.heroActions}>
            <a className={styles.primaryButton} href="#portal">
              Start estimating
            </a>
            <a className={styles.secondaryButton} href="/sample-menu.csv" download>
              Download sample CSV
            </a>
          </div>

          <div className={styles.heroStatsRow}>
            <article className={styles.dashboardStat}>
              <span>What you need</span>
              <strong>{REQUIRED_MENU_FIELDS.length} required fields</strong>
              <p>RID, dish name, and item price are enough to start a row.</p>
            </article>
            <article className={styles.dashboardStat}>
              <span>How you can upload</span>
              <strong>One dish or full CSV</strong>
              <p>Use manual entry for a few dishes or upload a menu file for a batch.</p>
            </article>
            <article className={styles.dashboardStat}>
              <span>What you get back</span>
              <strong>Calories, protein, confidence</strong>
              <p>Each row comes back with an estimate, a confidence label, and a short explanation.</p>
            </article>
            <article className={styles.dashboardStat}>
              <span>What needs attention</span>
              <strong>Rows marked review</strong>
              <p>Medium and low confidence rows are the ones your team should check before publishing.</p>
            </article>
          </div>
        </div>

        <aside className={styles.heroSidebar}>
          <article className={styles.sidebarCardDark}>
            <span className={styles.panelEyebrow}>Quick checklist</span>
            <h2>What to keep ready before you upload.</h2>

            <div className={styles.statusList}>
              <div className={styles.statusRow}>
                <span>Must have</span>
                <strong>RID, item name, item price</strong>
                <p>Without these three, the row cannot move forward.</p>
              </div>
              <div className={styles.statusRow}>
                <span>Helpful when available</span>
                <strong>Description, cuisine, ingredients, sides</strong>
                <p>These details matter most for branded dishes, custom bowls, platters, wraps, or combos.</p>
              </div>
              <div className={styles.statusRow}>
                <span>Before publishing</span>
                <strong>Review medium and low confidence</strong>
                <p>Use the confidence label as a review queue, especially for unusual portions or custom recipes.</p>
              </div>
            </div>
          </article>

          <article className={styles.sidebarCard}>
            <div className={styles.sidebarHeader}>
              <span className={styles.panelEyebrow}>Menus that usually match faster</span>
              <h2>These cuisines have the most support in the current data.</h2>
            </div>

            <p className={styles.panelLead}>
              Rows from these cuisines are more likely to find a strong comparison quickly, especially when the dish
              name and description are clear.
            </p>

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
                      style={{ width: `${(cuisine.count / overview.topCuisines[0].count) * 100}%` }}
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
            <span className={styles.kicker}>How it works</span>
            <h2>Three simple steps from upload to review.</h2>
            <p>
              You do not need to think about the underlying model to use this page. The portal reads your row, compares
              it with known dish references, and then tells you how safe it is to use the result.
            </p>
          </div>

          <div className={styles.workflowList}>
            <article className={styles.workflowCard}>
              <span>01</span>
              <h3>Add the dish details you already have</h3>
              <p>Start with the required fields. Add optional details only when the dish needs extra explanation.</p>
            </article>
            <article className={styles.workflowCard}>
              <span>02</span>
              <h3>The portal finds the closest comparison</h3>
              <p>It uses the dish name first, then description, cuisine, ingredients, and components to narrow the estimate.</p>
            </article>
            <article className={styles.workflowCard}>
              <span>03</span>
              <h3>You get an estimate plus the next action</h3>
              <p>The result tells you whether the row is usually ready, needs review, or should go for manual checking.</p>
            </article>
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.sectionHeading}>
            <span className={styles.kicker}>Confidence guide</span>
            <h2>How to decide what can be used right away.</h2>
            <p>
              Confidence is a review tool, not a nutrition guarantee. Treat it as the signal that helps your team know
              which rows can move quickly and which rows need a second look.
            </p>
          </div>

          <div className={styles.confidenceGrid}>
            {confidenceGuide.map((item) => (
              <article key={item.band} className={styles.confidenceCard}>
                <span>{item.band}</span>
                <strong>{item.headline}</strong>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </article>
      </section>

      <PortalWorkbench />

      <section className={styles.bottomGrid}>
        <article className={styles.panel}>
          <div className={styles.sectionHeading}>
            <span className={styles.kicker}>Operator tips</span>
            <h2>Five habits that improve results.</h2>
            <p>These are the fastest ways to reduce review work for your team when you upload a fresh menu.</p>
          </div>

          <div className={styles.rankedList}>
            {ownerTips.map((item) => (
              <article key={item.step} className={styles.rankedCard}>
                <span className={styles.rankedIndex}>{item.step}</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
                </div>
              </article>
            ))}
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.sectionHeading}>
            <span className={styles.kicker}>Examples from current data</span>
            <h2>Dishes the portal already understands well.</h2>
            <p>
              If your menu has dishes like these, the portal is more likely to return a useful comparison quickly and
              reduce manual review work.
            </p>
          </div>

          <div className={styles.featureGridCompact}>
            {featured.map((item) => (
              <article key={item.normalized_name} className={styles.featureCard}>
                <span className={styles.featureTag}>{item.top_cuisine || item.reference_cuisine || "Catalog item"}</span>
                <h3>{item.display_name}</h3>
                <p>{item.description || "Short description not available in the current export."}</p>
                <div className={styles.featureStats}>
                  <strong>{Math.round(item.predicted_energy_kcal)} kcal</strong>
                  <span>{item.predicted_protein_g} g protein</span>
                  <span>{item.support_count.toLocaleString()} reference rows</span>
                </div>
              </article>
            ))}
          </div>

          <div className={styles.rankedList}>
            {topModeledItems.map((item, index) => (
              <article key={item.name} className={styles.rankedCard}>
                <span className={styles.rankedIndex}>0{index + 1}</span>
                <div>
                  <h3>{item.name}</h3>
                  <p>{item.count.toLocaleString()} modeled rows already exist for this dish family in the current packaged data.</p>
                </div>
              </article>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
