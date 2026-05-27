# RX Restaurant Calorie Portal

This is a restaurant-facing nutrition estimation portal built from the modeling artifacts in the parent `Rx Nutritional Calculator` workspace.

The product goal is straightforward:
- let restaurant partners upload a menu,
- estimate calories and protein per item using the GenAI backend,
- show which rows look ready to use and which ones still need review.

## What this app uses

- `final_prediction_v4.csv`: modeled Swiggy nutrition outputs used in the packaged catalog layer.
- `hp_test_data.csv`: item metadata such as cuisine, classifier, and segment.
- `hp_train_data.csv`: training-side context used for rollout framing and summary metrics.
- `High Protein Estimator (version 1)/train_metadata.csv` and `embedding_train data.csv`: reference-set context from the earlier FAISS prototype.
- `active_health_items_20Apr.csv`: April 20 active menu coverage dataset used for runtime retrieval context.
- `High Protein Estimator (version 1)/nutritional_100gm_db.csv`: ICMR ingredient reference data used by the GenAI flow.
- `Interface Screen Grabs/*.png`: legacy prototype screenshots used in the product story section.

## What a partner sees

- Landing page that explains:
  - what to upload,
  - which fields are mandatory,
  - how the current estimate is generated,
  - what confidence means,
  - when a row should be reviewed manually.
- Menu estimation workbench with:
  - manual item entry,
  - CSV and Excel upload,
  - explicit required-field guidance,
  - optional ingredient-card enrichment,
  - included and optional add-ons,
  - confidence-aware calorie and protein estimation,
  - internal logic and review signals.
- Catalog coverage and example sections that show the kinds of dishes the current labeled data already supports well.

## Intake schema

The portal now accepts the Gen AI document intake shape below.

Required partner inputs:
- `RID` (numeric item ID used only for tracking)
- `ITEM_NAME`
- `ITEM_PRICE` (item-level price, not restaurant-level price)
- `ITEM_GRAMMAGE`

Optional partner inputs:
- `ITEM_DESCRIPTION`
- `RX_CUISINE`
- `MAIN_INGREDIENT_1` ... `MAIN_INGREDIENT_6`
- `MAIN_INGREDIENT_1_GRAMMAGE` ... `MAIN_INGREDIENT_6_GRAMMAGE`
- `INGREDIENTS_LIST`
- `COMPULSORY_COMPONENTS`
- `OPTIONAL_COMPONENTS`

Backward-compatibility notes:
- CSV parsing still reads older aliases such as `item_name`, `description`, `cuisine`, and `price`.
- Estimation now validates that numeric `RID`, `ITEM_NAME`, `ITEM_PRICE`, and `ITEM_GRAMMAGE` are present before processing.
- Internal `rowId` values are still generated for UI state, but they are not treated as partner `RID`.
- `RID` is stripped to digits during normalization and is not sent into nutrition prompts, so RID-only changes do not affect estimates.

## Local development

```bash
npm install
npm run build:data
npm run dev
```

Open `http://localhost:3000`.

If you want the retrieval-plus-LLM path, copy `.env.example` to `.env.local` and add `OPENAI_API_KEY`.

## Data build

```bash
npm run build:data
```

This generates:
- `app-data/catalog.json`
- `app-data/overview.json`
- `app-data/featured.json`
- `app-data/active-menu-catalog.json`
- `public/sample-menu.csv`

## GenAI asset build

The GenAI path needs precomputed embedding assets for the labeled nutrition reference set.

```bash
npm run build:genai-assets
```

This requires `OPENAI_API_KEY` and writes:
- `app-data/genai-reference-records.json`
- `app-data/genai-reference-embeddings.f32`
- `app-data/genai-reference-manifest.json`

Without these assets, or without OpenAI credentials at runtime, the API fails loudly instead of switching to a deterministic matcher.

## Production build

```bash
npm run build
```

## Runtime modes

The portal now prefers the GenAI backend when it can run:
- query embedding from the uploaded row using `text-embedding-3-small`,
- retrieval of similar historical items from the labeled nutrition reference set,
- retrieval of active menu context from the April 20 dataset,
- ICMR ingredient lookup from the 100g reference file,
- helper rules for broad food families,
- structured OpenAI response for protein, calories, reasoning trace, and separate protein versus calorie confidence.

Important behavior:
- `ITEM_PRICE` is item-level only and stays a weak contextual signal,
- `ITEM_GRAMMAGE` is required and is used directly in the GenAI prompt,
- ingredient cards and `INGREDIENTS_LIST` are optional but strongly recommended for custom dishes,
- included and optional add-ons are collected through the existing component fields for backward compatibility,
- restaurant-facing calorie output uses compact kcal display, with ranges for lower-confidence estimates,
- final confidence is the minimum of protein and calorie confidence in GenAI mode,
- explicit protein or calorie values in `ITEM_DESCRIPTION` are extracted separately and do not override the estimate.

## Output contract

Each response now includes top-level estimator metadata for the GenAI result path.

Each result row still includes the existing flat fields used by the UI, and now also includes:
- `reasoning_trace`
- `estimated_protein_g`
- `estimated_energy_kcal`
- `estimation_confidence`
- `confidence_percent`
- `extracted_protein_g`
- `extracted_energy_kcal`
- `input`: the normalized partner input payload
- `output`: the forward-compatible estimate payload
- `explainability`: match details, signals checked, signals that helped, and the item-price note

GenAI behavior:
- `output.confidence_detail.protein_confidence` and `output.confidence_detail.energy_confidence` are populated,
- `output.confidence_detail.final_confidence` is derived from the minimum rule,
- `explainability.retrieval` includes labeled neighbors, active menu context, ICMR matches, and helper rules.

## Environment

Use `.env.example` as the starting point:
- `OPENAI_API_KEY`: required for embedding generation and runtime GenAI calls
- `OPENAI_NUTRITION_BACKEND`: use `auto` or `genai`
- `OPENAI_RESPONSES_MODEL`: defaults to `gpt-4.1-mini`
- `OPENAI_EMBEDDING_MODEL`: defaults to `text-embedding-3-small`
- `OPENAI_ORGANIZATION` and `OPENAI_PROJECT`: optional

## Why this portal exists

This portal exists to make menu estimation operational:
- restaurants can upload real menu rows and see estimates immediately,
- teams can tell which rows are strong enough to use and which need review,
- the next refinement loop can focus on real menu gaps instead of abstract offline metrics.
