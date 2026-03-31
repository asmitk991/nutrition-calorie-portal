export const REQUIRED_MENU_FIELDS = ["RID", "ITEM_NAME", "ITEM_PRICE"];

export const OPTIONAL_MENU_FIELDS = [
  "ITEM_DESCRIPTION",
  "RX_CUISINE",
  "ITEM_GRAMMAGE",
  "MAIN_INGREDIENT_1",
  "MAIN_INGREDIENT_2",
  "MAIN_INGREDIENT_3",
  "MAIN_INGREDIENT_1_GRAMMAGE",
  "MAIN_INGREDIENT_2_GRAMMAGE",
  "MAIN_INGREDIENT_3_GRAMMAGE",
  "COMPULSORY_COMPONENTS",
  "OPTIONAL_COMPONENTS",
];

export const CSV_HEADER_ORDER = [...REQUIRED_MENU_FIELDS, ...OPTIONAL_MENU_FIELDS];

const EMPTY_DRAFT = {
  rid: "",
  name: "",
  description: "",
  cuisine: "",
  price: "",
  grammage: "",
  mainIngredient1: "",
  mainIngredient2: "",
  mainIngredient3: "",
  mainIngredient1Grammage: "",
  mainIngredient2Grammage: "",
  mainIngredient3Grammage: "",
  compulsoryComponents: "",
  optionalComponents: "",
};

const FIELD_ALIASES = {
  rid: ["RID", "rid", "Rid"],
  name: ["ITEM_NAME", "item_name", "name", "ItemName"],
  description: ["ITEM_DESCRIPTION", "item_description", "description", "Description"],
  cuisine: ["RX_CUISINE", "rx_cuisine", "cuisine", "CUISINE"],
  price: ["ITEM_PRICE", "item_price", "price", "Price"],
  grammage: ["ITEM_GRAMMAGE", "item_grammage", "grammage", "Grammage"],
  mainIngredient1: ["MAIN_INGREDIENT_1", "main_ingredient_1", "mainIngredient1"],
  mainIngredient2: ["MAIN_INGREDIENT_2", "main_ingredient_2", "mainIngredient2"],
  mainIngredient3: ["MAIN_INGREDIENT_3", "main_ingredient_3", "mainIngredient3"],
  mainIngredient1Grammage: [
    "MAIN_INGREDIENT_1_GRAMMAGE",
    "main_ingredient_1_grammage",
    "mainIngredient1Grammage",
  ],
  mainIngredient2Grammage: [
    "MAIN_INGREDIENT_2_GRAMMAGE",
    "main_ingredient_2_grammage",
    "mainIngredient2Grammage",
  ],
  mainIngredient3Grammage: [
    "MAIN_INGREDIENT_3_GRAMMAGE",
    "main_ingredient_3_grammage",
    "mainIngredient3Grammage",
  ],
  compulsoryComponents: [
    "COMPULSORY_COMPONENTS",
    "compulsory_components",
    "compulsoryComponents",
  ],
  optionalComponents: ["OPTIONAL_COMPONENTS", "optional_components", "optionalComponents"],
};

function readAliasedValue(source = {}, aliases = []) {
  for (const alias of aliases) {
    if (!(alias in source)) {
      continue;
    }

    const value = source[alias];
    if (value == null) {
      continue;
    }

    const normalized = String(value).trim();
    if (normalized) {
      return normalized;
    }
  }

  return "";
}

export function createEmptyDraft() {
  return { ...EMPTY_DRAFT };
}

export function normalizeMenuInput(input = {}, index = 0, options = {}) {
  return {
    rowId: String(options.rowId || input.rowId || input.internalRowId || `row-${index + 1}`),
    rid: readAliasedValue(input, FIELD_ALIASES.rid),
    name: readAliasedValue(input, FIELD_ALIASES.name),
    description: readAliasedValue(input, FIELD_ALIASES.description),
    cuisine: readAliasedValue(input, FIELD_ALIASES.cuisine),
    price: readAliasedValue(input, FIELD_ALIASES.price),
    grammage: readAliasedValue(input, FIELD_ALIASES.grammage),
    mainIngredient1: readAliasedValue(input, FIELD_ALIASES.mainIngredient1),
    mainIngredient2: readAliasedValue(input, FIELD_ALIASES.mainIngredient2),
    mainIngredient3: readAliasedValue(input, FIELD_ALIASES.mainIngredient3),
    mainIngredient1Grammage: readAliasedValue(input, FIELD_ALIASES.mainIngredient1Grammage),
    mainIngredient2Grammage: readAliasedValue(input, FIELD_ALIASES.mainIngredient2Grammage),
    mainIngredient3Grammage: readAliasedValue(input, FIELD_ALIASES.mainIngredient3Grammage),
    compulsoryComponents: readAliasedValue(input, FIELD_ALIASES.compulsoryComponents),
    optionalComponents: readAliasedValue(input, FIELD_ALIASES.optionalComponents),
    sourceRowNumber: index + 1,
  };
}

export function mapCsvMenuRow(row = {}, index = 0) {
  return normalizeMenuInput(row, index, { rowId: `csv-${index + 1}` });
}

export function hasMenuInputContent(item = {}) {
  const normalized = item.sourceRowNumber ? item : normalizeMenuInput(item);
  return [
    normalized.rid,
    normalized.name,
    normalized.description,
    normalized.cuisine,
    normalized.price,
    normalized.grammage,
    normalized.mainIngredient1,
    normalized.mainIngredient2,
    normalized.mainIngredient3,
    normalized.mainIngredient1Grammage,
    normalized.mainIngredient2Grammage,
    normalized.mainIngredient3Grammage,
    normalized.compulsoryComponents,
    normalized.optionalComponents,
  ].some(Boolean);
}

export function getMissingRequiredFields(item = {}) {
  const normalized = item.sourceRowNumber ? item : normalizeMenuInput(item);
  const missing = [];

  if (!normalized.rid) {
    missing.push("RID");
  }
  if (!normalized.name) {
    missing.push("ITEM_NAME");
  }
  if (!normalized.price) {
    missing.push("ITEM_PRICE");
  }

  return missing;
}

export function validateMenuItems(items = []) {
  const normalizedItems = items.map((item, index) => normalizeMenuInput(item, index)).filter(hasMenuInputContent);
  const errors = normalizedItems
    .map((item) => {
      const missingFields = getMissingRequiredFields(item);
      if (!missingFields.length) {
        return null;
      }

      return {
        rowId: item.rowId,
        rid: item.rid || null,
        rowNumber: item.sourceRowNumber,
        itemName: item.name || null,
        missingFields,
        message: `Row ${item.sourceRowNumber} is missing ${missingFields.join(", ")}.`,
      };
    })
    .filter(Boolean);

  return { normalizedItems, errors };
}
