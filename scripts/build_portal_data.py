import json
from pathlib import Path

import pandas as pd


APP_ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = APP_ROOT.parent
DATA_DIR = APP_ROOT / "app-data"
PUBLIC_DIR = APP_ROOT / "public"


def normalize_text(value):
    if pd.isna(value):
        return ""
    text = str(value).strip().lower()
    return " ".join(text.split())


def first_non_empty(series):
    for value in series:
        if pd.notna(value):
            text = str(value).strip()
            if text:
                return text
    return ""


def mode_or_empty(series):
    cleaned = series.dropna().astype(str).str.strip()
    cleaned = cleaned[cleaned != ""]
    if cleaned.empty:
        return ""
    return cleaned.value_counts().index[0]


def positive_numeric(series):
    values = pd.to_numeric(series, errors="coerce").dropna()
    return values[values > 0]


def positive_numeric_count(series):
    return int(positive_numeric(series).shape[0])


def positive_numeric_median(series):
    values = positive_numeric(series)
    if values.empty:
        return float("nan")
    return float(values.median())


def positive_numeric_quantile(series, quantile):
    values = positive_numeric(series)
    if values.empty:
        return float("nan")
    return float(values.quantile(quantile))


def positive_numeric_min(series):
    values = positive_numeric(series)
    if values.empty:
        return float("nan")
    return float(values.min())


def positive_numeric_max(series):
    values = positive_numeric(series)
    if values.empty:
        return float("nan")
    return float(values.max())


def build_catalog():
    predictions = pd.read_csv(
        SOURCE_ROOT / "final_prediction_v4.csv",
        usecols=[
            "ITEM_ID",
            "ITEM_NAME",
            "ITEM_DESCRIPTION",
            "Protein_Regex",
            "Energy_Regex",
            "Protein_Pred_Model",
            "Energy_Pred_Model",
        ],
        low_memory=False,
    )

    hp_test = pd.read_csv(
        SOURCE_ROOT / "hp_test_data.csv",
        usecols=[
            "ITEM_ID",
            "ITEM_NAME",
            "ITEM_DESCRIPTION",
            "PARENT_NAME",
            "RX_CUISINE",
            "RX_CLASSIFIER",
            "RX_SEGMENTS",
            "IS_TRUSTED_RX",
        ],
        low_memory=False,
    )

    hp_train = pd.read_csv(
        SOURCE_ROOT / "hp_train_data.csv",
        usecols=[
            "ITEM_NAME",
            "REST_NAME",
            "RX_CUISINE",
            "DISH_TYPE",
            "DISH_FAMILY",
            "ITEM_PRICE",
            "PROTEIN_VALUE_IN_GRAM",
            "CALORIE_VALUE_IN_KCAL",
        ],
        low_memory=False,
    )

    reference = pd.read_csv(
        SOURCE_ROOT / "High Protein Estimator (version 1)" / "embedding_train data.csv",
        usecols=["ITEM_NAME", "RX_CUISINE", "DISH_TYPE", "DISH_FAMILY"],
        low_memory=False,
    )

    predictions["normalized_name"] = predictions["ITEM_NAME"].map(normalize_text)
    predictions["clean_description"] = (
        predictions["ITEM_DESCRIPTION"]
        .fillna("")
        .astype(str)
        .str.strip()
        .replace({"unknown": "", "nan": ""})
    )

    hp_test["normalized_name"] = hp_test["ITEM_NAME"].map(normalize_text)
    hp_train["normalized_name"] = hp_train["ITEM_NAME"].map(normalize_text)
    reference["normalized_name"] = reference["ITEM_NAME"].map(normalize_text)

    test_grouped = (
        hp_test.groupby("normalized_name", as_index=False)
        .agg(
            top_parent=("PARENT_NAME", mode_or_empty),
            top_cuisine=("RX_CUISINE", mode_or_empty),
            top_classifier=("RX_CLASSIFIER", mode_or_empty),
            top_segment=("RX_SEGMENTS", mode_or_empty),
            trusted_share=("IS_TRUSTED_RX", "mean"),
        )
    )

    train_grouped = (
        hp_train.groupby("normalized_name", as_index=False)
        .agg(
            train_restaurant=("REST_NAME", mode_or_empty),
            train_cuisine=("RX_CUISINE", mode_or_empty),
            train_dish_type=("DISH_TYPE", mode_or_empty),
            train_dish_family=("DISH_FAMILY", mode_or_empty),
            train_price_count=("ITEM_PRICE", positive_numeric_count),
            train_median_price=("ITEM_PRICE", positive_numeric_median),
            train_price_q1=("ITEM_PRICE", lambda x: positive_numeric_quantile(x, 0.25)),
            train_price_q3=("ITEM_PRICE", lambda x: positive_numeric_quantile(x, 0.75)),
            train_price_min=("ITEM_PRICE", positive_numeric_min),
            train_price_max=("ITEM_PRICE", positive_numeric_max),
            train_avg_protein=("PROTEIN_VALUE_IN_GRAM", "median"),
            train_avg_calories=("CALORIE_VALUE_IN_KCAL", "median"),
        )
    )

    reference_grouped = (
        reference.groupby("normalized_name", as_index=False)
        .agg(
            reference_cuisine=("RX_CUISINE", mode_or_empty),
            reference_dish_type=("DISH_TYPE", mode_or_empty),
            reference_dish_family=("DISH_FAMILY", mode_or_empty),
        )
    )

    catalog = (
        predictions.groupby("normalized_name", as_index=False)
        .agg(
            display_name=("ITEM_NAME", mode_or_empty),
            description=("clean_description", first_non_empty),
            support_count=("ITEM_ID", "count"),
            predicted_protein_g=("Protein_Pred_Model", "median"),
            predicted_energy_kcal=("Energy_Pred_Model", "median"),
            regex_protein_support=("Protein_Regex", lambda x: int(x.notna().sum())),
            regex_energy_support=("Energy_Regex", lambda x: int(x.notna().sum())),
            observed_protein_g=("Protein_Regex", "median"),
            observed_energy_kcal=("Energy_Regex", "median"),
        )
        .merge(test_grouped, on="normalized_name", how="left")
        .merge(train_grouped, on="normalized_name", how="left")
        .merge(reference_grouped, on="normalized_name", how="left")
    )

    catalog = catalog[catalog["normalized_name"] != ""].copy()
    catalog["trusted_share"] = catalog["trusted_share"].fillna(0.0)
    price_iqr = (catalog["train_price_q3"] - catalog["train_price_q1"]).clip(lower=0)
    catalog["train_price_iqr"] = price_iqr.where(catalog["train_median_price"].notna())
    price_band_half_width = pd.concat(
        [
            price_iqr.mul(1.5),
            catalog["train_median_price"].mul(0.35),
            pd.Series(60.0, index=catalog.index),
        ],
        axis=1,
    ).max(axis=1, skipna=True)
    price_band_half_width = price_band_half_width.where(catalog["train_median_price"].notna())
    catalog["train_price_band_low"] = (catalog["train_median_price"] - price_band_half_width).clip(lower=0).where(
        catalog["train_median_price"].notna()
    )
    catalog["train_price_band_high"] = (catalog["train_median_price"] + price_band_half_width).where(
        catalog["train_median_price"].notna()
    )
    catalog["train_price_spread_ratio"] = (
        catalog["train_price_iqr"] / catalog["train_median_price"]
    ).where((catalog["train_median_price"].notna()) & (catalog["train_median_price"] > 0))
    catalog["data_confidence"] = 32
    catalog.loc[catalog["support_count"] >= 250, "data_confidence"] += 28
    catalog.loc[catalog["support_count"].between(100, 249), "data_confidence"] += 22
    catalog.loc[catalog["support_count"].between(25, 99), "data_confidence"] += 15
    catalog.loc[catalog["support_count"].between(5, 24), "data_confidence"] += 8
    catalog.loc[catalog["regex_energy_support"] > 0, "data_confidence"] += 12
    catalog.loc[catalog["regex_protein_support"] > 0, "data_confidence"] += 10
    catalog.loc[catalog["train_avg_calories"].notna(), "data_confidence"] += 8
    catalog.loc[catalog["description"].astype(str).str.len() > 0, "data_confidence"] += 6
    catalog.loc[catalog["trusted_share"] >= 0.5, "data_confidence"] += 4
    catalog["data_confidence"] = catalog["data_confidence"].clip(0, 95).astype(int)
    catalog["confidence_band"] = pd.cut(
        catalog["data_confidence"],
        bins=[-1, 54, 74, 100],
        labels=["Low", "Medium", "High"],
    ).astype(str)

    catalog = catalog.sort_values(["support_count", "data_confidence"], ascending=[False, False])

    def clean_record(record):
        output = {}
        for key, value in record.items():
            if pd.isna(value):
                output[key] = None
            elif isinstance(value, float):
                output[key] = round(value, 1)
            else:
                output[key] = value
        return output

    records = [clean_record(record) for record in catalog.to_dict(orient="records")]

    overview = {
        "modeledItems": int(len(predictions)),
        "uniqueDishNames": int(catalog.shape[0]),
        "testItems": int(len(hp_test)),
        "trainItems": int(len(hp_train)),
        "referenceRows": int(len(reference)),
        "describedTestShare": round(float(hp_test["ITEM_DESCRIPTION"].fillna("").astype(str).str.strip().ne("").mean()), 4),
        "descriptionCoverage": round(float(1 - predictions["ITEM_DESCRIPTION"].isna().mean()), 4),
        "regexProteinCoverage": round(float(predictions["Protein_Regex"].notna().mean()), 4),
        "regexEnergyCoverage": round(float(predictions["Energy_Regex"].notna().mean()), 4),
        "topCuisines": [
            {"name": str(name), "count": int(count)}
            for name, count in hp_test["RX_CUISINE"].dropna().astype(str).value_counts().head(8).items()
        ],
        "topModeledItems": [
            {"name": str(name), "count": int(count)}
            for name, count in predictions["ITEM_NAME"].dropna().astype(str).value_counts().head(8).items()
        ],
        "confidenceMix": [
            {"label": str(label), "count": int(count)}
            for label, count in catalog["confidence_band"].value_counts().reindex(["High", "Medium", "Low"]).fillna(0).items()
        ],
        "trainingSignals": {
            "avgProtein": round(float(hp_train["PROTEIN_VALUE_IN_GRAM"].median()), 1),
            "avgCalories": round(float(hp_train["CALORIE_VALUE_IN_KCAL"].median()), 1),
        },
    }

    featured = records[:12]
    return records, overview, featured


def build_sample_menu(catalog):
    sample_items = []
    seen = set()
    for item in catalog:
        if item["confidence_band"] != "High":
            continue
        if item["top_cuisine"] not in {
            "North Indian",
            "Chinese/Pan-Asian",
            "Continental/Italian/European",
            "Rolls/Wraps",
            "Biryani",
        }:
            continue
        if item["display_name"] in seen:
            continue
        sample_items.append(
            {
                "RID": f"SAMPLE-{len(sample_items) + 1:03d}",
                "ITEM_NAME": item["display_name"],
                "ITEM_PRICE": "" if pd.isna(item["train_median_price"]) else int(round(item["train_median_price"])),
                "ITEM_DESCRIPTION": item["description"] or "",
                "RX_CUISINE": item["top_cuisine"] or item["reference_cuisine"] or "",
                "ITEM_GRAMMAGE": "",
                "MAIN_INGREDIENT_1": "",
                "MAIN_INGREDIENT_2": "",
                "MAIN_INGREDIENT_3": "",
                "MAIN_INGREDIENT_1_GRAMMAGE": "",
                "MAIN_INGREDIENT_2_GRAMMAGE": "",
                "MAIN_INGREDIENT_3_GRAMMAGE": "",
                "COMPULSORY_COMPONENTS": "",
                "OPTIONAL_COMPONENTS": "",
            }
        )
        seen.add(item["display_name"])
        if len(sample_items) == 10:
            break
    return pd.DataFrame(sample_items)


def main():
    DATA_DIR.mkdir(exist_ok=True)
    PUBLIC_DIR.mkdir(exist_ok=True)

    catalog, overview, featured = build_catalog()
    sample_menu = build_sample_menu(catalog)

    (DATA_DIR / "catalog.json").write_text(json.dumps(catalog, indent=2), encoding="utf-8")
    (DATA_DIR / "overview.json").write_text(json.dumps(overview, indent=2), encoding="utf-8")
    (DATA_DIR / "featured.json").write_text(json.dumps(featured, indent=2), encoding="utf-8")
    sample_menu.to_csv(PUBLIC_DIR / "sample-menu.csv", index=False)

    print(f"Wrote {len(catalog)} catalog records to {DATA_DIR}")


if __name__ == "__main__":
    main()
