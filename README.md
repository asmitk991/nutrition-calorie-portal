# RX Restaurant Calorie Portal

This is a restaurant-facing V1 portal built from the modeling artifacts in the parent `Rx Nutritional Calculator` workspace.

The product goal is straightforward:
- let restaurant partners upload a menu,
- estimate calories and protein per item using the current modeled Swiggy catalog,
- show confidence and support so ops teams know what can ship now and what still needs refinement.

## What this app uses

- `final_prediction_v4.csv`: current calorie and protein predictions across the modeled Swiggy catalog.
- `hp_test_data.csv`: item metadata such as cuisine, classifier, and segment.
- `hp_train_data.csv`: training-side context used for rollout framing and summary metrics.
- `High Protein Estimator (version 1)/embedding_train data.csv`: reference-set context from the earlier FAISS prototype.
- `Interface Screen Grabs/*.png`: legacy prototype screenshots used in the product story section.

The app does not call OpenAI in V1. It uses derived JSON artifacts generated from the existing CSV exports so the portal is deployable and demo-friendly.

## Product scope

- Landing page with rollout framing for internal teams and restaurant partners.
- Menu estimation workbench with:
  - manual item entry,
  - CSV upload,
  - confidence-aware calorie estimation,
  - support counts and rationale.
- Catalog intelligence section showing high-support dish anchors.
- Prototype lineage section showing the earlier Streamlit flow.

## Local development

```bash
npm install
npm run build:data
npm run dev
```

Open `http://localhost:3000`.

## Data build

```bash
npm run build:data
```

This generates:
- `app-data/catalog.json`
- `app-data/overview.json`
- `app-data/featured.json`
- `public/sample-menu.csv`

## Production build

```bash
npm run build
```

## Notes on the matching engine

- Exact match is attempted first on normalized dish names.
- If there is no exact hit, the app uses a lightweight fuzzy analogue search against the derived catalog.
- Match confidence is not a nutrition truth score. It is a rollout score based on:
  - name-match strength,
  - support volume in the modeled catalog,
  - presence of direct regex evidence,
  - availability of training/reference context.

## Why this V1 exists

This portal is intended to help teams move from experimentation to workflow:
- restaurants can see estimated calories today,
- internal teams can isolate weak catalog coverage,
- the next refinement loop can be directed by real menu gaps instead of abstract model metrics.
