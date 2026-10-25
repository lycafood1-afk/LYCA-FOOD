var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// customer-and-backend/app/api/ingredients/route.ts
var route_exports = {};
__export(route_exports, {
  DELETE: () => DELETE,
  GET: () => GET,
  POST: () => POST,
  dynamic: () => dynamic
});

// vercel-runtime/context.mjs
import { AsyncLocalStorage } from "node:async_hooks";
var requestContext = new AsyncLocalStorage();

// vercel-runtime/environment.mjs
var env = new Proxy({}, { get: (_, name) => requestContext.getStore()?.environment[name] });

// vercel-runtime/identity.mjs
async function getChatGPTUser() {
  return requestContext.getStore()?.user || null;
}

// vercel-runtime/database.mjs
import { neon as realNeon } from "@neondatabase/serverless";
var neon = (...args) => requestContext.getStore()?.sql || realNeon(...args);

// customer-and-backend/db/postgres.ts
var databaseEnvironment = () => env;
function databaseProvider() {
  const selected = databaseEnvironment().CATALOGUE_DATABASE?.trim().toLowerCase() || "postgresql";
  if (selected === "postgres" || selected === "postgresql") return "postgresql";
  if (selected === "d1") return "d1";
  throw new Error("Unsupported catalogue database configuration.");
}
function getPostgres() {
  const connection = databaseEnvironment().DATABASE_URL?.trim();
  if (!connection) throw new Error("PostgreSQL DATABASE_URL is not configured.");
  if (!/^postgres(?:ql)?:\/\//.test(connection)) throw new Error("Invalid PostgreSQL connection configuration.");
  return neon(connection, { fetchOptions: { signal: AbortSignal.timeout(15e3) } });
}
function legacyDatabase() {
  const database = databaseEnvironment().DB;
  if (!database) throw new Error("Legacy migration database is unavailable.");
  return database;
}
function catalogueReadOnly() {
  return ["1", "true"].includes(databaseEnvironment().CATALOGUE_READ_ONLY?.toLowerCase() || "");
}

// customer-and-backend/db/repository.ts
var object = (data) => typeof data === "string" ? JSON.parse(data) : data;
async function ingredientRecords() {
  if (databaseProvider() === "d1") {
    const result = await legacyDatabase().prepare("SELECT id,data,status,version,updated_at FROM ingredients").all();
    return result.results.map((row) => ({ id: row.id, data: object(row.data), status: row.status, version: row.version, updatedAt: row.updated_at }));
  }
  const rows = await getPostgres().query("SELECT id,data,status,version,updated_at FROM lyca.ingredients ORDER BY id");
  return rows.map((row) => ({ id: String(row.id), data: object(row.data), status: row.status, version: Number(row.version), updatedAt: new Date(row.updated_at).toISOString() }));
}
async function saveIngredientRecord(id, data, status, expectedVersion, updatedAt, create = false) {
  if (databaseProvider() === "d1") {
    const db = legacyDatabase();
    const result = create ? await db.prepare("INSERT INTO ingredients (id,data,status,version,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(id, JSON.stringify(data), status, 1, updatedAt).run() : await db.prepare("UPDATE ingredients SET data=?,status=?,version=?,updated_at=? WHERE id=? AND version=?").bind(JSON.stringify(data), status, expectedVersion + 1, updatedAt, id, expectedVersion).run();
    return !!result.meta.changes;
  }
  const rows = create ? await getPostgres().query("WITH chosen AS (SELECT id FROM lyca.categories WHERE id=$5 FOR KEY SHARE) INSERT INTO lyca.ingredients (id,data,status,version,updated_at) SELECT $1,$2::jsonb,$3,1,$4::timestamptz FROM chosen ON CONFLICT(id) DO NOTHING RETURNING id", [id, JSON.stringify(data), status, updatedAt, data.category]) : await getPostgres().query("WITH chosen AS (SELECT id FROM lyca.categories WHERE id=$7 FOR KEY SHARE) UPDATE lyca.ingredients SET data=$2::jsonb,status=$3,version=$4,updated_at=$5::timestamptz WHERE id=$1 AND version=$6 AND EXISTS(SELECT 1 FROM chosen) RETURNING id", [id, JSON.stringify(data), status, expectedVersion + 1, updatedAt, expectedVersion, data.category]);
  return rows.length === 1;
}
async function deleteIngredientRecord(id, expectedVersion) {
  if (databaseProvider() === "d1") {
    const result = await legacyDatabase().prepare("DELETE FROM ingredients WHERE id=? AND version=?").bind(id, expectedVersion).run();
    return !!result.meta.changes;
  }
  const rows = await getPostgres().query("DELETE FROM lyca.ingredients WHERE id=$1 AND version=$2 RETURNING id", [id, expectedVersion]);
  return rows.length === 1;
}
async function deleteAllProducts() {
  if (databaseProvider() === "d1") {
    await legacyDatabase().batch([legacyDatabase().prepare("DELETE FROM ingredients"), legacyDatabase().prepare("DELETE FROM products")]);
    return;
  }
  const sql = getPostgres();
  await sql.transaction([sql.query("DELETE FROM lyca.ingredients"), sql.query("DELETE FROM lyca.products")]);
}
async function categoryRecords() {
  if (databaseProvider() === "d1") throw new Error("Category management requires PostgreSQL.");
  const rows = await getPostgres().query("SELECT id,data,version FROM lyca.categories ORDER BY sort_order,id");
  return rows.map((row) => {
    const data = object(row.data);
    const groups = Array.isArray(data.groups) ? data.groups.map((group) => typeof group === "string" ? group : group && typeof group === "object" && "name" in group ? String(group.name) : "").filter(Boolean) : [];
    return { ...data, groups, id: String(row.id), version: Number(row.version) };
  });
}
async function createCategory(category) {
  const rows = await getPostgres().query("INSERT INTO lyca.categories (id,data,sort_order) VALUES ($1,$2::jsonb,(SELECT COALESCE(max(sort_order),0)+1 FROM lyca.categories)) ON CONFLICT DO NOTHING RETURNING id", [category.id, JSON.stringify(category)]);
  return rows.length === 1;
}
async function updateCategory(category, expectedVersion) {
  const rows = await getPostgres().query("UPDATE lyca.categories SET data=$2::jsonb,version=version+1 WHERE id=$1 AND version=$3 RETURNING version", [category.id, JSON.stringify(category), expectedVersion]);
  return rows.length ? Number(rows[0].version) : null;
}
async function deleteCategory(id, expectedVersion, deleteIngredients) {
  const sql = getPostgres();
  const results = await sql.transaction([
    sql.query("SELECT id FROM lyca.categories WHERE id=$1 FOR UPDATE", [id]),
    sql.query("DELETE FROM lyca.ingredients WHERE data->>'category'=$1 AND $3::boolean AND EXISTS(SELECT 1 FROM lyca.categories WHERE id=$1 AND version=$2) RETURNING id", [id, expectedVersion, deleteIngredients]),
    sql.query("DELETE FROM lyca.categories WHERE id=$1 AND version=$2 AND NOT EXISTS(SELECT 1 FROM lyca.ingredients WHERE data->>'category'=$1) RETURNING id", [id, expectedVersion])
  ]);
  return { deleted: results[2].length === 1, deletedIngredients: results[1].length };
}
async function productRecords() {
  if (databaseProvider() === "d1") {
    const result = await legacyDatabase().prepare("SELECT id,data,archived FROM products").all();
    return result.results.map((row) => ({ id: row.id, data: object(row.data), archived: !!row.archived }));
  }
  const rows = await getPostgres().query("SELECT id,data,archived FROM lyca.products ORDER BY id");
  return rows.map((row) => ({ id: String(row.id), data: object(row.data), archived: !!row.archived }));
}
async function saveProductRecord(id, data, archived) {
  if (databaseProvider() === "d1") {
    await legacyDatabase().prepare("INSERT INTO products (id,data,archived) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,archived=excluded.archived").bind(id, JSON.stringify(data), archived ? 1 : 0).run();
    return;
  }
  await getPostgres().query("INSERT INTO lyca.products (id,data,archived) VALUES ($1,$2::jsonb,$3) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,archived=EXCLUDED.archived", [id, JSON.stringify(data), archived]);
}
async function publicSettings() {
  if (databaseProvider() === "d1") {
    const row = await legacyDatabase().prepare("SELECT value FROM settings WHERE id='public'").first();
    return row ? object(row.value) : null;
  }
  const rows = await getPostgres().query("SELECT value FROM lyca.settings WHERE id='public'");
  return rows[0] ? object(rows[0].value) : null;
}
async function savePublicSettings(value) {
  if (databaseProvider() === "d1") {
    await legacyDatabase().prepare("INSERT INTO settings (id,value) VALUES ('public',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value").bind(JSON.stringify(value)).run();
    return;
  }
  await getPostgres().query("INSERT INTO lyca.settings (id,value) VALUES ('public',$1::jsonb) ON CONFLICT(id) DO UPDATE SET value=EXCLUDED.value", [JSON.stringify(value)]);
}

// customer-and-backend/lib/store.ts
var bucket = () => env.BUCKET;
async function catalogue(includeArchived = false) {
  const rows = await productRecords();
  return rows.map((r) => ({ ...r.data, archived: r.archived })).filter((p) => includeArchived || !p.archived);
}
async function getSettings() {
  return await publicSettings() || { serviceId: "", templateId: "", publicKey: "", responsePromise: "" };
}
async function isAdmin(req) {
  const e = env;
  const bridge = req?.headers.get("x-lyca-admin-key");
  if (bridge && e.ADMIN_BRIDGE_KEY) {
    const enc = new TextEncoder();
    const [a, b] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(bridge)), crypto.subtle.digest("SHA-256", enc.encode(e.ADMIN_BRIDGE_KEY))]);
    const aa = new Uint8Array(a), bb = new Uint8Array(b);
    let diff = 0;
    for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i];
    if (diff === 0) return true;
  }
  const user = await getChatGPTUser();
  return !!user && !!e.ADMIN_EMAIL && user.email.toLowerCase() === e.ADMIN_EMAIL.toLowerCase();
}
function sameOrigin(req) {
  const origin = req.headers.get("origin");
  return !origin || origin === new URL(req.url).origin;
}
function failure(e) {
  console.error("Catalogue request failed", { code: typeof e === "object" && e && "code" in e ? String(e.code) : "unavailable" });
  return Response.json({ error: "This service is temporarily unavailable. Please try again." }, { status: 503 });
}
function migrationInProgress() {
  return Response.json({ error: "The catalogue is being migrated. Please try saving again shortly." }, { status: 503, headers: { "Retry-After": "30", "Cache-Control": "no-store" } });
}

// customer-and-backend/lib/ingredients-seed.json
var ingredients_seed_default = {
  categories: [
    {
      id: "juice-concentrates",
      title: "Juice Concentrates, Purees, Pulps & Pastes",
      shortTitle: "Juice & Fruit Ingredients",
      description: "A broad fruit and vegetable portfolio for beverage, dairy, bakery, sauce, and food manufacturing applications.",
      image: "/images/mango.webp",
      imageAlt: "Mango juice and freshly sliced mango against a dark backdrop",
      imageCaption: "MANGO / CONCENTRATES & PUREES",
      groups: [
        {
          name: "Mango",
          items: [
            "Alphonso Mango Pulp",
            "Totapuri Mango Pulp / Concentrate",
            "Kesar Mango Pulp",
            "Sindhura Mango Pulp",
            "Tommy Atkins Mango Puree",
            "Magdalena Mango Puree"
          ]
        },
        {
          name: "Guava",
          items: [
            "White Guava Juice Concentrate / Pulp",
            "Pink Guava Juice Concentrate / Pulp"
          ]
        },
        {
          name: "Tomato",
          items: [
            "Tomato Paste 36\u201338 (CB & HB)",
            "Tomato Paste 30\u201332 (CB & HB)",
            "Tomato Paste 28\u201330 (CB & HB)",
            "Dehydrated Tomato Flakes"
          ]
        },
        {
          name: "Chilli, Pepper, Ginger & Garlic",
          items: [
            "Red and Green Chilli Puree",
            "Cayenne Pepper Paste",
            "Fermented Red Chilli Paste",
            "Red and Green Ripened Chilli Paste",
            "Ginger Puree",
            "Garlic Paste"
          ]
        },
        {
          name: "Other Concentrates & Purees",
          items: [
            "Frozen Concentrated Orange Juice",
            "Apple Juice Concentrate / Puree / NFC",
            "Red Grape Juice Concentrate",
            "White Grape Juice Concentrate",
            "Sweetening Compound",
            "Low Acid White Grape Juice Concentrate",
            "Pineapple Juice Concentrate",
            "Deionized Pineapple Juice Concentrate",
            "Mixed Fruit Juice Concentrate",
            "Strawberry Puree",
            "Pomegranate Juice Concentrate",
            "Apricot Puree / Diced / Halves / Juice Concentrate",
            "Pear and Peach Juice Concentrate / Puree"
          ]
        }
      ],
      note: "Brochure packaging formats include aseptic packs, aseptic bins, cans, frozen products, and concentrates. Sizes vary by format, and availability should be confirmed for each product."
    },
    {
      id: "coconut-products",
      title: "Coconut Products",
      shortTitle: "Coconut Products",
      description: "Versatile coconut ingredients for confectionery, bakery, beverage, culinary, and prepared food applications.",
      image: "/images/coconut.webp",
      imageAlt: "Fresh coconut halves and pieces on a dark surface",
      imageCaption: "COCONUT / MILK, OIL & DESICCATED",
      groups: [
        {
          name: "Coconut Range",
          items: [
            "Low-Fat Desiccated Coconut \u2014 Fine & Medium",
            "High-Fat Desiccated Coconut \u2014 Fine & Medium",
            "Desiccated Coconut Flakes",
            "Coconut Cream Powder",
            "Coconut Sugar",
            "Toasted Coconut Paste",
            "Virgin Coconut Oil",
            "Aseptic Coconut Milk & Water"
          ]
        }
      ]
    },
    {
      id: "coffee-cocoa",
      title: "Coffee & Cocoa",
      shortTitle: "Coffee & Cocoa",
      description: "Coffee formats and cocoa ingredients for beverages, desserts, confectionery, and manufactured food applications.",
      image: "/images/coffee.webp",
      imageAlt: "Roasted coffee beans on dark stone",
      imageCaption: "COFFEE & COCOA / AROMA & DEPTH",
      groups: [
        {
          name: "Coffee",
          items: [
            "Spray-Dried Instant Coffee",
            "Agglomerated Instant Coffee",
            "Decaffeinated Instant Coffee",
            "Instant & Micro-Ground Coffee",
            "Flavoured Instant Coffee",
            "Coffee Extract",
            "Coffee Oil",
            "Raw Caffeine",
            "Naturally Decaffeinated Green Coffee"
          ]
        },
        {
          name: "Cocoa",
          items: [
            "Cocoa Powder"
          ]
        }
      ]
    },
    {
      id: "dairy-ingredients",
      title: "Dairy Ingredients",
      shortTitle: "Dairy Ingredients",
      description: "A structured range for dairy, beverage, bakery, nutrition, dessert, and prepared food applications.",
      image: "/images/dairy.webp",
      imageAlt: "Fresh milk pouring into a glass against black",
      imageCaption: "DAIRY / TEXTURE & RICHNESS",
      groups: [
        {
          name: "Dairy Range",
          items: [
            "Whole Milk Powder",
            "Skimmed Milk Powder",
            "Fat-Filled Milk Powder",
            "Milk Stabilizers & Emulsifiers",
            "Unsalted Sweet Cream Lactic Butter",
            "Cheese Powder",
            "Curd Powder",
            "Yoghurt Powder",
            "Whey Protein Powder",
            "Soy Milk Powder"
          ]
        }
      ]
    },
    {
      id: "fruit-preparations",
      title: "Fruit Preparations",
      shortTitle: "Fruit Preparations",
      description: "Fruit preparations developed for integration across a wide range of finished food and beverage formats.",
      image: "/images/berries.webp",
      imageAlt: "Raspberries reflected on a black surface",
      imageCaption: "FRUIT PREPARATIONS / FLAVOUR & TEXTURE",
      groups: [
        {
          name: "Applications",
          items: [
            "Dairy products",
            "Ice cream",
            "Beverages",
            "Bakery products",
            "Desserts",
            "Confectionery"
          ]
        }
      ]
    },
    {
      id: "spray-dried-powders",
      title: "Spray-Dried Powders",
      shortTitle: "Spray-Dried Powders",
      description: "Fruit, specialty, and natural colour powders presented in an easy-to-browse ingredient collection.",
      image: "/images/powder.webp",
      imageAlt: "Fresh mangoes, a source fruit for the fruit powder range",
      imageCaption: "FRUIT & SPECIALTY POWDERS / SOURCE FRUIT",
      groups: [
        {
          name: "Fruit Powders",
          items: [
            "Ripe Mango",
            "Raw Mango",
            "Orange",
            "Tamarind",
            "Pineapple",
            "Pomegranate",
            "Ripe Papaya",
            "Raw Papaya",
            "Sweet Lime",
            "Ripe Banana",
            "Raw Banana",
            "Black Grape",
            "Guava",
            "Strawberry",
            "Apple",
            "Watermelon",
            "Cranberry",
            "Blueberry",
            "Raspberry"
          ]
        },
        {
          name: "Specialty Powders",
          items: [
            "Honey",
            "Vinegar",
            "Apple Cider Vinegar",
            "Jaggery",
            "Coconut Milk",
            "Coconut Water",
            "Amla"
          ]
        },
        {
          name: "Natural Colour Powders",
          items: [
            "Caramel",
            "Orange Annatto",
            "Yellow Annatto",
            "Beetroot"
          ]
        }
      ]
    },
    {
      id: "food-colours",
      title: "Food Colours",
      shortTitle: "Food Colours",
      description: "A varied palette of plant-derived colour ingredients for food and beverage product development.",
      image: "/images/colors.webp",
      imageAlt: "Deep red dried hibiscus flowers, a botanical colour source",
      imageCaption: "HIBISCUS / COLOUR FROM NATURE",
      groups: [
        {
          name: "Natural Colour Range",
          items: [
            "Beetroot",
            "Black Carrot",
            "Orange Carrot",
            "Safflower",
            "Spirulina",
            "Chokeberry",
            "Elderberry",
            "Black Currant",
            "Red Radish",
            "Purple Potato",
            "Dried Apple",
            "Spirulina and Safflower",
            "Hibiscus"
          ]
        }
      ]
    }
  ],
  ingredients: [
    {
      id: "juice-concentrates-mango-alphonso-mango-pulp",
      name: "Alphonso Mango Pulp",
      category: "juice-concentrates",
      group: "Mango",
      description: "",
      image: "/images/mango.webp",
      imageAlt: "Mango juice and freshly sliced mango against a dark backdrop",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "juice-concentrates-mango-totapuri-mango-pulp-concentrate",
      name: "Totapuri Mango Pulp / Concentrate",
      category: "juice-concentrates",
      group: "Mango",
      description: "",
      image: "/images/mango.webp",
      imageAlt: "Mango juice and freshly sliced mango against a dark backdrop",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "juice-concentrates-mango-kesar-mango-pulp",
      name: "Kesar Mango Pulp",
      category: "juice-concentrates",
      group: "Mango",
      description: "",
      image: "/images/mango.webp",
      imageAlt: "Mango juice and freshly sliced mango against a dark backdrop",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "juice-concentrates-mango-sindhura-mango-pulp",
      name: "Sindhura Mango Pulp",
      category: "juice-concentrates",
      group: "Mango",
      description: "",
      image: "/images/mango.webp",
      imageAlt: "Mango juice and freshly sliced mango against a dark backdrop",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "juice-concentrates-mango-tommy-atkins-mango-puree",
      name: "Tommy Atkins Mango Puree",
      category: "juice-concentrates",
      group: "Mango",
      description: "",
      image: "/images/mango.webp",
      imageAlt: "Mango juice and freshly sliced mango against a dark backdrop",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "juice-concentrates-mango-magdalena-mango-puree",
      name: "Magdalena Mango Puree",
      category: "juice-concentrates",
      group: "Mango",
      description: "",
      image: "/images/mango.webp",
      imageAlt: "Mango juice and freshly sliced mango against a dark backdrop",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "juice-concentrates-guava-white-guava-juice-concentrate-pulp",
      name: "White Guava Juice Concentrate / Pulp",
      category: "juice-concentrates",
      group: "Guava",
      description: "",
      image: "/images/mango.webp",
      imageAlt: "Mango juice and freshly sliced mango against a dark backdrop",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "juice-concentrates-guava-pink-guava-juice-concentrate-pulp",
      name: "Pink Guava Juice Concentrate / Pulp",
      category: "juice-concentrates",
      group: "Guava",
      description: "",
      image: "/images/mango.webp",
      imageAlt: "Mango juice and freshly sliced mango against a dark backdrop",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "juice-concentrates-tomato-tomato-paste-36-38-cb-and-hb",
      name: "Tomato Paste 36\u201338 (CB & HB)",
      category: "juice-concentrates",
      group: "Tomato",
      description: "",
      image: "/images/mango.webp",
      imageAlt: "Mango juice and freshly sliced mango against a dark backdrop",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "juice-concentrates-tomato-tomato-paste-30-32-cb-and-hb",
      name: "Tomato Paste 30\u201332 (CB & HB)",
      category: "juice-concentrates",
      group: "Tomato",
      description: "",
      image: "/images/mango.webp",
      imageAlt: "Mango juice and freshly sliced mango against a dark backdrop",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "juice-concentrates-tomato-tomato-paste-28-30-cb-and-hb",
      name: "Tomato Paste 28\u201330 (CB & HB)",
      category: "juice-concentrates",
      group: "Tomato",
      description: "",
      image: "/images/mango.webp",
      imageAlt: "Mango juice and freshly sliced mango against a dark backdrop",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "juice-concentrates-tomato-dehydrated-tomato-flakes",
      name: "Dehydrated Tomato Flakes",
      category: "juice-concentrates",
      group: "Tomato",
      description: "",
      image: "/images/mango.webp",
      imageAlt: "Mango juice and freshly sliced mango against a dark backdrop",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "juice-concentrates-chilli-pepper-ginger-and-garlic-red-and-green-chilli-puree",
      name: "Red and Green Chilli Puree",
      category: "juice-concentrates",
      group: "Chilli, Pepper, Ginger & Garlic",
      description: "",
      image: "/images/mango.webp",
      imageAlt: "Mango juice and freshly sliced mango against a dark backdrop",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "juice-concentrates-chilli-pepper-ginger-and-garlic-cayenne-pepper-paste",
      name: "Cayenne Pepper Paste",
      category: "juice-concentrates",
      group: "Chilli, Pepper, Ginger & Garlic",
      description: "",
      image: "/images/mango.webp",
      imageAlt: "Mango juice and freshly sliced mango against a dark backdrop",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "juice-concentrates-chilli-pepper-ginger-and-garlic-fermented-red-chilli-paste",
      name: "Fermented Red Chilli Paste",
      category: "juice-concentrates",
      group: "Chilli, Pepper, Ginger & Garlic",
      description: "",
      image: "/images/mango.webp",
      imageAlt: "Mango juice and freshly sliced mango against a dark backdrop",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "juice-concentrates-chilli-pepper-ginger-and-garlic-red-and-green-ripened-chilli-paste",
      name: "Red and Green Ripened Chilli Paste",
      category: "juice-concentrates",
      group: "Chilli, Pepper, Ginger & Garlic",
      description: "",
      image: "/images/mango.webp",
      imageAlt: "Mango juice and freshly sliced mango against a dark backdrop",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "juice-concentrates-chilli-pepper-ginger-and-garlic-ginger-puree",
      name: "Ginger Puree",
      category: "juice-concentrates",
      group: "Chilli, Pepper, Ginger & Garlic",
      description: "",
      image: "/images/mango.webp",
      imageAlt: "Mango juice and freshly sliced mango against a dark backdrop",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "juice-concentrates-chilli-pepper-ginger-and-garlic-garlic-paste",
      name: "Garlic Paste",
      category: "juice-concentrates",
      group: "Chilli, Pepper, Ginger & Garlic",
      description: "",
      image: "/images/mango.webp",
      imageAlt: "Mango juice and freshly sliced mango against a dark backdrop",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "juice-concentrates-other-concentrates-and-purees-frozen-concentrated-orange-juice",
      name: "Frozen Concentrated Orange Juice",
      category: "juice-concentrates",
      group: "Other Concentrates & Purees",
      description: "",
      image: "/images/mango.webp",
      imageAlt: "Mango juice and freshly sliced mango against a dark backdrop",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "juice-concentrates-other-concentrates-and-purees-apple-juice-concentrate-puree-nfc",
      name: "Apple Juice Concentrate / Puree / NFC",
      category: "juice-concentrates",
      group: "Other Concentrates & Purees",
      description: "",
      image: "/images/mango.webp",
      imageAlt: "Mango juice and freshly sliced mango against a dark backdrop",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "juice-concentrates-other-concentrates-and-purees-red-grape-juice-concentrate",
      name: "Red Grape Juice Concentrate",
      category: "juice-concentrates",
      group: "Other Concentrates & Purees",
      description: "",
      image: "/images/mango.webp",
      imageAlt: "Mango juice and freshly sliced mango against a dark backdrop",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "juice-concentrates-other-concentrates-and-purees-white-grape-juice-concentrate",
      name: "White Grape Juice Concentrate",
      category: "juice-concentrates",
      group: "Other Concentrates & Purees",
      description: "",
      image: "/images/mango.webp",
      imageAlt: "Mango juice and freshly sliced mango against a dark backdrop",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "juice-concentrates-other-concentrates-and-purees-sweetening-compound",
      name: "Sweetening Compound",
      category: "juice-concentrates",
      group: "Other Concentrates & Purees",
      description: "",
      image: "/images/mango.webp",
      imageAlt: "Mango juice and freshly sliced mango against a dark backdrop",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "juice-concentrates-other-concentrates-and-purees-low-acid-white-grape-juice-concentrate",
      name: "Low Acid White Grape Juice Concentrate",
      category: "juice-concentrates",
      group: "Other Concentrates & Purees",
      description: "",
      image: "/images/mango.webp",
      imageAlt: "Mango juice and freshly sliced mango against a dark backdrop",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "juice-concentrates-other-concentrates-and-purees-pineapple-juice-concentrate",
      name: "Pineapple Juice Concentrate",
      category: "juice-concentrates",
      group: "Other Concentrates & Purees",
      description: "",
      image: "/images/mango.webp",
      imageAlt: "Mango juice and freshly sliced mango against a dark backdrop",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "juice-concentrates-other-concentrates-and-purees-deionized-pineapple-juice-concentrate",
      name: "Deionized Pineapple Juice Concentrate",
      category: "juice-concentrates",
      group: "Other Concentrates & Purees",
      description: "",
      image: "/images/mango.webp",
      imageAlt: "Mango juice and freshly sliced mango against a dark backdrop",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "juice-concentrates-other-concentrates-and-purees-mixed-fruit-juice-concentrate",
      name: "Mixed Fruit Juice Concentrate",
      category: "juice-concentrates",
      group: "Other Concentrates & Purees",
      description: "",
      image: "/images/mango.webp",
      imageAlt: "Mango juice and freshly sliced mango against a dark backdrop",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "juice-concentrates-other-concentrates-and-purees-strawberry-puree",
      name: "Strawberry Puree",
      category: "juice-concentrates",
      group: "Other Concentrates & Purees",
      description: "",
      image: "/images/mango.webp",
      imageAlt: "Mango juice and freshly sliced mango against a dark backdrop",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "juice-concentrates-other-concentrates-and-purees-pomegranate-juice-concentrate",
      name: "Pomegranate Juice Concentrate",
      category: "juice-concentrates",
      group: "Other Concentrates & Purees",
      description: "",
      image: "/images/mango.webp",
      imageAlt: "Mango juice and freshly sliced mango against a dark backdrop",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "juice-concentrates-other-concentrates-and-purees-apricot-puree-diced-halves-juice-concentrate",
      name: "Apricot Puree / Diced / Halves / Juice Concentrate",
      category: "juice-concentrates",
      group: "Other Concentrates & Purees",
      description: "",
      image: "/images/mango.webp",
      imageAlt: "Mango juice and freshly sliced mango against a dark backdrop",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "juice-concentrates-other-concentrates-and-purees-pear-and-peach-juice-concentrate-puree",
      name: "Pear and Peach Juice Concentrate / Puree",
      category: "juice-concentrates",
      group: "Other Concentrates & Purees",
      description: "",
      image: "/images/mango.webp",
      imageAlt: "Mango juice and freshly sliced mango against a dark backdrop",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "coconut-products-coconut-range-low-fat-desiccated-coconut-fine-and-medium",
      name: "Low-Fat Desiccated Coconut \u2014 Fine & Medium",
      category: "coconut-products",
      group: "Coconut Range",
      description: "",
      image: "/images/coconut.webp",
      imageAlt: "Fresh coconut halves and pieces on a dark surface",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "coconut-products-coconut-range-high-fat-desiccated-coconut-fine-and-medium",
      name: "High-Fat Desiccated Coconut \u2014 Fine & Medium",
      category: "coconut-products",
      group: "Coconut Range",
      description: "",
      image: "/images/coconut.webp",
      imageAlt: "Fresh coconut halves and pieces on a dark surface",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "coconut-products-coconut-range-desiccated-coconut-flakes",
      name: "Desiccated Coconut Flakes",
      category: "coconut-products",
      group: "Coconut Range",
      description: "",
      image: "/images/coconut.webp",
      imageAlt: "Fresh coconut halves and pieces on a dark surface",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "coconut-products-coconut-range-coconut-cream-powder",
      name: "Coconut Cream Powder",
      category: "coconut-products",
      group: "Coconut Range",
      description: "",
      image: "/images/coconut.webp",
      imageAlt: "Fresh coconut halves and pieces on a dark surface",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "coconut-products-coconut-range-coconut-sugar",
      name: "Coconut Sugar",
      category: "coconut-products",
      group: "Coconut Range",
      description: "",
      image: "/images/coconut.webp",
      imageAlt: "Fresh coconut halves and pieces on a dark surface",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "coconut-products-coconut-range-toasted-coconut-paste",
      name: "Toasted Coconut Paste",
      category: "coconut-products",
      group: "Coconut Range",
      description: "",
      image: "/images/coconut.webp",
      imageAlt: "Fresh coconut halves and pieces on a dark surface",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "coconut-products-coconut-range-virgin-coconut-oil",
      name: "Virgin Coconut Oil",
      category: "coconut-products",
      group: "Coconut Range",
      description: "",
      image: "/images/coconut.webp",
      imageAlt: "Fresh coconut halves and pieces on a dark surface",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "coconut-products-coconut-range-aseptic-coconut-milk-and-water",
      name: "Aseptic Coconut Milk & Water",
      category: "coconut-products",
      group: "Coconut Range",
      description: "",
      image: "/images/coconut.webp",
      imageAlt: "Fresh coconut halves and pieces on a dark surface",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "coffee-cocoa-coffee-spray-dried-instant-coffee",
      name: "Spray-Dried Instant Coffee",
      category: "coffee-cocoa",
      group: "Coffee",
      description: "",
      image: "/images/coffee.webp",
      imageAlt: "Roasted coffee beans on dark stone",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "coffee-cocoa-coffee-agglomerated-instant-coffee",
      name: "Agglomerated Instant Coffee",
      category: "coffee-cocoa",
      group: "Coffee",
      description: "",
      image: "/images/coffee.webp",
      imageAlt: "Roasted coffee beans on dark stone",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "coffee-cocoa-coffee-decaffeinated-instant-coffee",
      name: "Decaffeinated Instant Coffee",
      category: "coffee-cocoa",
      group: "Coffee",
      description: "",
      image: "/images/coffee.webp",
      imageAlt: "Roasted coffee beans on dark stone",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "coffee-cocoa-coffee-instant-and-micro-ground-coffee",
      name: "Instant & Micro-Ground Coffee",
      category: "coffee-cocoa",
      group: "Coffee",
      description: "",
      image: "/images/coffee.webp",
      imageAlt: "Roasted coffee beans on dark stone",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "coffee-cocoa-coffee-flavoured-instant-coffee",
      name: "Flavoured Instant Coffee",
      category: "coffee-cocoa",
      group: "Coffee",
      description: "",
      image: "/images/coffee.webp",
      imageAlt: "Roasted coffee beans on dark stone",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "coffee-cocoa-coffee-coffee-extract",
      name: "Coffee Extract",
      category: "coffee-cocoa",
      group: "Coffee",
      description: "",
      image: "/images/coffee.webp",
      imageAlt: "Roasted coffee beans on dark stone",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "coffee-cocoa-coffee-coffee-oil",
      name: "Coffee Oil",
      category: "coffee-cocoa",
      group: "Coffee",
      description: "",
      image: "/images/coffee.webp",
      imageAlt: "Roasted coffee beans on dark stone",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "coffee-cocoa-coffee-raw-caffeine",
      name: "Raw Caffeine",
      category: "coffee-cocoa",
      group: "Coffee",
      description: "",
      image: "/images/coffee.webp",
      imageAlt: "Roasted coffee beans on dark stone",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "coffee-cocoa-coffee-naturally-decaffeinated-green-coffee",
      name: "Naturally Decaffeinated Green Coffee",
      category: "coffee-cocoa",
      group: "Coffee",
      description: "",
      image: "/images/coffee.webp",
      imageAlt: "Roasted coffee beans on dark stone",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "coffee-cocoa-cocoa-cocoa-powder",
      name: "Cocoa Powder",
      category: "coffee-cocoa",
      group: "Cocoa",
      description: "",
      image: "/images/coffee.webp",
      imageAlt: "Roasted coffee beans on dark stone",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "dairy-ingredients-dairy-range-whole-milk-powder",
      name: "Whole Milk Powder",
      category: "dairy-ingredients",
      group: "Dairy Range",
      description: "",
      image: "/images/dairy.webp",
      imageAlt: "Fresh milk pouring into a glass against black",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "dairy-ingredients-dairy-range-skimmed-milk-powder",
      name: "Skimmed Milk Powder",
      category: "dairy-ingredients",
      group: "Dairy Range",
      description: "",
      image: "/images/dairy.webp",
      imageAlt: "Fresh milk pouring into a glass against black",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "dairy-ingredients-dairy-range-fat-filled-milk-powder",
      name: "Fat-Filled Milk Powder",
      category: "dairy-ingredients",
      group: "Dairy Range",
      description: "",
      image: "/images/dairy.webp",
      imageAlt: "Fresh milk pouring into a glass against black",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "dairy-ingredients-dairy-range-milk-stabilizers-and-emulsifiers",
      name: "Milk Stabilizers & Emulsifiers",
      category: "dairy-ingredients",
      group: "Dairy Range",
      description: "",
      image: "/images/dairy.webp",
      imageAlt: "Fresh milk pouring into a glass against black",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "dairy-ingredients-dairy-range-unsalted-sweet-cream-lactic-butter",
      name: "Unsalted Sweet Cream Lactic Butter",
      category: "dairy-ingredients",
      group: "Dairy Range",
      description: "",
      image: "/images/dairy.webp",
      imageAlt: "Fresh milk pouring into a glass against black",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "dairy-ingredients-dairy-range-cheese-powder",
      name: "Cheese Powder",
      category: "dairy-ingredients",
      group: "Dairy Range",
      description: "",
      image: "/images/dairy.webp",
      imageAlt: "Fresh milk pouring into a glass against black",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "dairy-ingredients-dairy-range-curd-powder",
      name: "Curd Powder",
      category: "dairy-ingredients",
      group: "Dairy Range",
      description: "",
      image: "/images/dairy.webp",
      imageAlt: "Fresh milk pouring into a glass against black",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "dairy-ingredients-dairy-range-yoghurt-powder",
      name: "Yoghurt Powder",
      category: "dairy-ingredients",
      group: "Dairy Range",
      description: "",
      image: "/images/dairy.webp",
      imageAlt: "Fresh milk pouring into a glass against black",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "dairy-ingredients-dairy-range-whey-protein-powder",
      name: "Whey Protein Powder",
      category: "dairy-ingredients",
      group: "Dairy Range",
      description: "",
      image: "/images/dairy.webp",
      imageAlt: "Fresh milk pouring into a glass against black",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "dairy-ingredients-dairy-range-soy-milk-powder",
      name: "Soy Milk Powder",
      category: "dairy-ingredients",
      group: "Dairy Range",
      description: "",
      image: "/images/dairy.webp",
      imageAlt: "Fresh milk pouring into a glass against black",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "fruit-preparations-applications-dairy-products",
      name: "Dairy products",
      category: "fruit-preparations",
      group: "Applications",
      description: "",
      image: "/images/berries.webp",
      imageAlt: "Raspberries reflected on a black surface",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "fruit-preparations-applications-ice-cream",
      name: "Ice cream",
      category: "fruit-preparations",
      group: "Applications",
      description: "",
      image: "/images/berries.webp",
      imageAlt: "Raspberries reflected on a black surface",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "fruit-preparations-applications-beverages",
      name: "Beverages",
      category: "fruit-preparations",
      group: "Applications",
      description: "",
      image: "/images/berries.webp",
      imageAlt: "Raspberries reflected on a black surface",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "fruit-preparations-applications-bakery-products",
      name: "Bakery products",
      category: "fruit-preparations",
      group: "Applications",
      description: "",
      image: "/images/berries.webp",
      imageAlt: "Raspberries reflected on a black surface",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "fruit-preparations-applications-desserts",
      name: "Desserts",
      category: "fruit-preparations",
      group: "Applications",
      description: "",
      image: "/images/berries.webp",
      imageAlt: "Raspberries reflected on a black surface",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "fruit-preparations-applications-confectionery",
      name: "Confectionery",
      category: "fruit-preparations",
      group: "Applications",
      description: "",
      image: "/images/berries.webp",
      imageAlt: "Raspberries reflected on a black surface",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "spray-dried-powders-fruit-powders-ripe-mango",
      name: "Ripe Mango",
      category: "spray-dried-powders",
      group: "Fruit Powders",
      description: "",
      image: "/images/powder.webp",
      imageAlt: "Fresh mangoes, a source fruit for the fruit powder range",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "spray-dried-powders-fruit-powders-raw-mango",
      name: "Raw Mango",
      category: "spray-dried-powders",
      group: "Fruit Powders",
      description: "",
      image: "/images/powder.webp",
      imageAlt: "Fresh mangoes, a source fruit for the fruit powder range",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "spray-dried-powders-fruit-powders-orange",
      name: "Orange",
      category: "spray-dried-powders",
      group: "Fruit Powders",
      description: "",
      image: "/images/powder.webp",
      imageAlt: "Fresh mangoes, a source fruit for the fruit powder range",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "spray-dried-powders-fruit-powders-tamarind",
      name: "Tamarind",
      category: "spray-dried-powders",
      group: "Fruit Powders",
      description: "",
      image: "/images/powder.webp",
      imageAlt: "Fresh mangoes, a source fruit for the fruit powder range",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "spray-dried-powders-fruit-powders-pineapple",
      name: "Pineapple",
      category: "spray-dried-powders",
      group: "Fruit Powders",
      description: "",
      image: "/images/powder.webp",
      imageAlt: "Fresh mangoes, a source fruit for the fruit powder range",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "spray-dried-powders-fruit-powders-pomegranate",
      name: "Pomegranate",
      category: "spray-dried-powders",
      group: "Fruit Powders",
      description: "",
      image: "/images/powder.webp",
      imageAlt: "Fresh mangoes, a source fruit for the fruit powder range",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "spray-dried-powders-fruit-powders-ripe-papaya",
      name: "Ripe Papaya",
      category: "spray-dried-powders",
      group: "Fruit Powders",
      description: "",
      image: "/images/powder.webp",
      imageAlt: "Fresh mangoes, a source fruit for the fruit powder range",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "spray-dried-powders-fruit-powders-raw-papaya",
      name: "Raw Papaya",
      category: "spray-dried-powders",
      group: "Fruit Powders",
      description: "",
      image: "/images/powder.webp",
      imageAlt: "Fresh mangoes, a source fruit for the fruit powder range",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "spray-dried-powders-fruit-powders-sweet-lime",
      name: "Sweet Lime",
      category: "spray-dried-powders",
      group: "Fruit Powders",
      description: "",
      image: "/images/powder.webp",
      imageAlt: "Fresh mangoes, a source fruit for the fruit powder range",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "spray-dried-powders-fruit-powders-ripe-banana",
      name: "Ripe Banana",
      category: "spray-dried-powders",
      group: "Fruit Powders",
      description: "",
      image: "/images/powder.webp",
      imageAlt: "Fresh mangoes, a source fruit for the fruit powder range",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "spray-dried-powders-fruit-powders-raw-banana",
      name: "Raw Banana",
      category: "spray-dried-powders",
      group: "Fruit Powders",
      description: "",
      image: "/images/powder.webp",
      imageAlt: "Fresh mangoes, a source fruit for the fruit powder range",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "spray-dried-powders-fruit-powders-black-grape",
      name: "Black Grape",
      category: "spray-dried-powders",
      group: "Fruit Powders",
      description: "",
      image: "/images/powder.webp",
      imageAlt: "Fresh mangoes, a source fruit for the fruit powder range",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "spray-dried-powders-fruit-powders-guava",
      name: "Guava",
      category: "spray-dried-powders",
      group: "Fruit Powders",
      description: "",
      image: "/images/powder.webp",
      imageAlt: "Fresh mangoes, a source fruit for the fruit powder range",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "spray-dried-powders-fruit-powders-strawberry",
      name: "Strawberry",
      category: "spray-dried-powders",
      group: "Fruit Powders",
      description: "",
      image: "/images/powder.webp",
      imageAlt: "Fresh mangoes, a source fruit for the fruit powder range",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "spray-dried-powders-fruit-powders-apple",
      name: "Apple",
      category: "spray-dried-powders",
      group: "Fruit Powders",
      description: "",
      image: "/images/powder.webp",
      imageAlt: "Fresh mangoes, a source fruit for the fruit powder range",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "spray-dried-powders-fruit-powders-watermelon",
      name: "Watermelon",
      category: "spray-dried-powders",
      group: "Fruit Powders",
      description: "",
      image: "/images/powder.webp",
      imageAlt: "Fresh mangoes, a source fruit for the fruit powder range",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "spray-dried-powders-fruit-powders-cranberry",
      name: "Cranberry",
      category: "spray-dried-powders",
      group: "Fruit Powders",
      description: "",
      image: "/images/powder.webp",
      imageAlt: "Fresh mangoes, a source fruit for the fruit powder range",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "spray-dried-powders-fruit-powders-blueberry",
      name: "Blueberry",
      category: "spray-dried-powders",
      group: "Fruit Powders",
      description: "",
      image: "/images/powder.webp",
      imageAlt: "Fresh mangoes, a source fruit for the fruit powder range",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "spray-dried-powders-fruit-powders-raspberry",
      name: "Raspberry",
      category: "spray-dried-powders",
      group: "Fruit Powders",
      description: "",
      image: "/images/powder.webp",
      imageAlt: "Fresh mangoes, a source fruit for the fruit powder range",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "spray-dried-powders-specialty-powders-honey",
      name: "Honey",
      category: "spray-dried-powders",
      group: "Specialty Powders",
      description: "",
      image: "/images/powder.webp",
      imageAlt: "Fresh mangoes, a source fruit for the fruit powder range",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "spray-dried-powders-specialty-powders-vinegar",
      name: "Vinegar",
      category: "spray-dried-powders",
      group: "Specialty Powders",
      description: "",
      image: "/images/powder.webp",
      imageAlt: "Fresh mangoes, a source fruit for the fruit powder range",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "spray-dried-powders-specialty-powders-apple-cider-vinegar",
      name: "Apple Cider Vinegar",
      category: "spray-dried-powders",
      group: "Specialty Powders",
      description: "",
      image: "/images/powder.webp",
      imageAlt: "Fresh mangoes, a source fruit for the fruit powder range",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "spray-dried-powders-specialty-powders-jaggery",
      name: "Jaggery",
      category: "spray-dried-powders",
      group: "Specialty Powders",
      description: "",
      image: "/images/powder.webp",
      imageAlt: "Fresh mangoes, a source fruit for the fruit powder range",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "spray-dried-powders-specialty-powders-coconut-milk",
      name: "Coconut Milk",
      category: "spray-dried-powders",
      group: "Specialty Powders",
      description: "",
      image: "/images/powder.webp",
      imageAlt: "Fresh mangoes, a source fruit for the fruit powder range",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "spray-dried-powders-specialty-powders-coconut-water",
      name: "Coconut Water",
      category: "spray-dried-powders",
      group: "Specialty Powders",
      description: "",
      image: "/images/powder.webp",
      imageAlt: "Fresh mangoes, a source fruit for the fruit powder range",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "spray-dried-powders-specialty-powders-amla",
      name: "Amla",
      category: "spray-dried-powders",
      group: "Specialty Powders",
      description: "",
      image: "/images/powder.webp",
      imageAlt: "Fresh mangoes, a source fruit for the fruit powder range",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "spray-dried-powders-natural-colour-powders-caramel",
      name: "Caramel",
      category: "spray-dried-powders",
      group: "Natural Colour Powders",
      description: "",
      image: "/images/powder.webp",
      imageAlt: "Fresh mangoes, a source fruit for the fruit powder range",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "spray-dried-powders-natural-colour-powders-orange-annatto",
      name: "Orange Annatto",
      category: "spray-dried-powders",
      group: "Natural Colour Powders",
      description: "",
      image: "/images/powder.webp",
      imageAlt: "Fresh mangoes, a source fruit for the fruit powder range",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "spray-dried-powders-natural-colour-powders-yellow-annatto",
      name: "Yellow Annatto",
      category: "spray-dried-powders",
      group: "Natural Colour Powders",
      description: "",
      image: "/images/powder.webp",
      imageAlt: "Fresh mangoes, a source fruit for the fruit powder range",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "spray-dried-powders-natural-colour-powders-beetroot",
      name: "Beetroot",
      category: "spray-dried-powders",
      group: "Natural Colour Powders",
      description: "",
      image: "/images/powder.webp",
      imageAlt: "Fresh mangoes, a source fruit for the fruit powder range",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "food-colours-natural-colour-range-beetroot",
      name: "Beetroot",
      category: "food-colours",
      group: "Natural Colour Range",
      description: "",
      image: "/images/colors.webp",
      imageAlt: "Deep red dried hibiscus flowers, a botanical colour source",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "food-colours-natural-colour-range-black-carrot",
      name: "Black Carrot",
      category: "food-colours",
      group: "Natural Colour Range",
      description: "",
      image: "/images/colors.webp",
      imageAlt: "Deep red dried hibiscus flowers, a botanical colour source",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "food-colours-natural-colour-range-orange-carrot",
      name: "Orange Carrot",
      category: "food-colours",
      group: "Natural Colour Range",
      description: "",
      image: "/images/colors.webp",
      imageAlt: "Deep red dried hibiscus flowers, a botanical colour source",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "food-colours-natural-colour-range-safflower",
      name: "Safflower",
      category: "food-colours",
      group: "Natural Colour Range",
      description: "",
      image: "/images/colors.webp",
      imageAlt: "Deep red dried hibiscus flowers, a botanical colour source",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "food-colours-natural-colour-range-spirulina",
      name: "Spirulina",
      category: "food-colours",
      group: "Natural Colour Range",
      description: "",
      image: "/images/colors.webp",
      imageAlt: "Deep red dried hibiscus flowers, a botanical colour source",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "food-colours-natural-colour-range-chokeberry",
      name: "Chokeberry",
      category: "food-colours",
      group: "Natural Colour Range",
      description: "",
      image: "/images/colors.webp",
      imageAlt: "Deep red dried hibiscus flowers, a botanical colour source",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "food-colours-natural-colour-range-elderberry",
      name: "Elderberry",
      category: "food-colours",
      group: "Natural Colour Range",
      description: "",
      image: "/images/colors.webp",
      imageAlt: "Deep red dried hibiscus flowers, a botanical colour source",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "food-colours-natural-colour-range-black-currant",
      name: "Black Currant",
      category: "food-colours",
      group: "Natural Colour Range",
      description: "",
      image: "/images/colors.webp",
      imageAlt: "Deep red dried hibiscus flowers, a botanical colour source",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "food-colours-natural-colour-range-red-radish",
      name: "Red Radish",
      category: "food-colours",
      group: "Natural Colour Range",
      description: "",
      image: "/images/colors.webp",
      imageAlt: "Deep red dried hibiscus flowers, a botanical colour source",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "food-colours-natural-colour-range-purple-potato",
      name: "Purple Potato",
      category: "food-colours",
      group: "Natural Colour Range",
      description: "",
      image: "/images/colors.webp",
      imageAlt: "Deep red dried hibiscus flowers, a botanical colour source",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "food-colours-natural-colour-range-dried-apple",
      name: "Dried Apple",
      category: "food-colours",
      group: "Natural Colour Range",
      description: "",
      image: "/images/colors.webp",
      imageAlt: "Deep red dried hibiscus flowers, a botanical colour source",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "food-colours-natural-colour-range-spirulina-and-safflower",
      name: "Spirulina and Safflower",
      category: "food-colours",
      group: "Natural Colour Range",
      description: "",
      image: "/images/colors.webp",
      imageAlt: "Deep red dried hibiscus flowers, a botanical colour source",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    },
    {
      id: "food-colours-natural-colour-range-hibiscus",
      name: "Hibiscus",
      category: "food-colours",
      group: "Natural Colour Range",
      description: "",
      image: "/images/colors.webp",
      imageAlt: "Deep red dried hibiscus flowers, a botanical colour source",
      specifications: "",
      partner: "",
      status: "published",
      version: 0,
      updatedAt: null
    }
  ]
};

// customer-and-backend/lib/ingredients.ts
import { z } from "zod";
var ingredientCategories = ingredients_seed_default.categories;
async function getCategories() {
  return await categoryRecords();
}
var ingredientSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160),
  name: z.string().trim().min(2).max(150),
  category: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160),
  group: z.string().trim().min(2).max(100),
  description: z.string().trim().max(2500),
  image: z.string().refine((v) => /^\/images\/[a-zA-Z0-9/_-]+\.(?:webp|png|jpg)$/.test(v) || /^\/api\/media\/[a-f0-9-]+\.(?:webp|png|jpg)$/.test(v), "Choose a catalogue image or upload a photo."),
  imageAlt: z.string().trim().min(2).max(200),
  specifications: z.string().trim().max(3e3),
  partner: z.enum(["", "ECOM", "Foods & Inns", "Medibel", "Appco", "Zentis"]),
  status: z.enum(["draft", "published", "archived"])
});
async function getIngredients(includeUnpublished = false) {
  const rows = await ingredientRecords();
  return rows.map((row) => ({ ...row.data, id: row.id, status: row.status, version: row.version, updatedAt: row.updatedAt })).filter((p) => includeUnpublished || p.status === "published");
}
async function ingredientRevision(products, categories2 = []) {
  const raw = products.map((p) => `${p.id}:${p.version}:${p.status}`).sort().join("|") + "|" + JSON.stringify(categories2);
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return [...new Uint8Array(hash)].map((v) => v.toString(16).padStart(2, "0")).join("");
}

// customer-and-backend/app/api/ingredients/route.ts
import { z as z2 } from "zod";
var dynamic = "force-dynamic";
var noStore = { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
async function GET(req) {
  try {
    const admin = new URL(req.url).searchParams.get("admin") === "1";
    if (admin && !await isAdmin(req)) return Response.json({ error: "Administrator access required." }, { status: 403, headers: noStore });
    const [ingredients, categories2] = await Promise.all([getIngredients(admin), getCategories()]);
    return Response.json({ ingredients, categories: categories2, revision: await ingredientRevision(ingredients, categories2), serverTime: (/* @__PURE__ */ new Date()).toISOString(), storage: databaseProvider() }, { headers: noStore });
  } catch (e) {
    return failure(e);
  }
}
var inputSchema = z2.object({ ingredient: ingredientSchema, expectedVersion: z2.number().int().min(0), create: z2.boolean() });
async function POST(req) {
  try {
    if (!sameOrigin(req) || !await isAdmin(req)) return Response.json({ error: "Administrator access required." }, { status: 403, headers: noStore });
    if (catalogueReadOnly()) return migrationInProgress();
    if (Number(req.headers.get("content-length")) > 24e3) return Response.json({ error: "Ingredient details are too long." }, { status: 413 });
    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Send valid ingredient details." }, { status: 400 });
    }
    const parsed = inputSchema.safeParse(body);
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message || "Please check the ingredient details." }, { status: 400 });
    const { ingredient, expectedVersion, create } = parsed.data;
    if (!(await getCategories()).some((c) => c.id === ingredient.category)) return Response.json({ error: "Choose an existing ingredient category." }, { status: 400 });
    const all = await getIngredients(true), current = all.find((p) => p.id === ingredient.id);
    if (create && current) return Response.json({ error: "This ingredient already exists. Open it to edit instead." }, { status: 409 });
    if (!create && !current) return Response.json({ error: "This ingredient no longer exists. Refresh the catalogue." }, { status: 404 });
    if ((current?.version ?? 0) !== expectedVersion) return Response.json({ error: "This ingredient changed in another session. Refresh before saving so those changes are preserved." }, { status: 409 });
    const duplicate = all.find((p) => p.id !== ingredient.id && p.category === ingredient.category && p.group.toLowerCase() === ingredient.group.toLowerCase() && p.name.toLowerCase() === ingredient.name.toLowerCase());
    if (duplicate) return Response.json({ error: "An ingredient with this name already exists in this group." }, { status: 409 });
    const now = (/* @__PURE__ */ new Date()).toISOString(), version = expectedVersion + 1;
    const saved = await saveIngredientRecord(ingredient.id, ingredient, ingredient.status, expectedVersion, now, create);
    if (!saved) return Response.json({ error: "Another administrator saved first. Refresh this ingredient and try again." }, { status: 409 });
    return Response.json({ ingredient: { ...ingredient, version, updatedAt: now }, savedAt: now }, { headers: noStore });
  } catch (e) {
    return failure(e);
  }
}
async function DELETE(req) {
  try {
    if (!sameOrigin(req) || !await isAdmin(req)) return Response.json({ error: "Administrator access required." }, { status: 403, headers: noStore });
    if (catalogueReadOnly()) return migrationInProgress();
    const body = await req.json().catch(() => null);
    if (typeof body === "object" && body !== null && "all" in body && body.all === true) {
      if (!("confirmation" in body) || body.confirmation !== "DELETE ALL PRODUCTS") return Response.json({ error: "Confirm deletion of all products." }, { status: 400 });
      await deleteAllProducts();
      return Response.json({ deletedAll: true }, { headers: noStore });
    }
    const parsed = z2.object({ id: z2.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160), expectedVersion: z2.number().int().min(0) }).safeParse(body);
    if (!parsed.success) return Response.json({ error: "Choose a product and its current version." }, { status: 400 });
    const current = (await getIngredients(true)).find((p) => p.id === parsed.data.id);
    if (!current) return Response.json({ error: "This product has already been deleted." }, { status: 404 });
    if (!await deleteIngredientRecord(current.id, parsed.data.expectedVersion)) return Response.json({ error: "This product changed in another session. Refresh before deleting." }, { status: 409 });
    return Response.json({ deleted: true, id: current.id }, { headers: noStore });
  } catch (e) {
    return failure(e);
  }
}

// customer-and-backend/app/api/categories/route.ts
var route_exports2 = {};
__export(route_exports2, {
  DELETE: () => DELETE2,
  GET: () => GET2,
  PATCH: () => PATCH,
  POST: () => POST2
});
import { z as z3 } from "zod";
var schema = z3.object({
  id: z3.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160),
  title: z3.string().trim().min(2).max(100),
  shortTitle: z3.string().trim().min(2).max(100),
  description: z3.string().trim().max(1500),
  image: z3.string().regex(/^\/(?:images\/[a-zA-Z0-9/_-]+\.(?:webp|png|jpg)|api\/media\/[a-f0-9-]+\.(?:webp|png|jpg))$/),
  imageAlt: z3.string().trim().min(2).max(200),
  imageCaption: z3.string().trim().max(150),
  groups: z3.array(z3.string().trim().min(2).max(100)).min(1).max(30)
});
async function GET2() {
  try {
    return Response.json({ categories: await getCategories() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}
async function POST2(req) {
  try {
    if (!sameOrigin(req) || !await isAdmin(req)) return Response.json({ error: "Administrator access required." }, { status: 403 });
    if (catalogueReadOnly()) return migrationInProgress();
    if (Number(req.headers.get("content-length")) > 12e3) return Response.json({ error: "Category details are too long." }, { status: 413 });
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message || "Complete the category details." }, { status: 400 });
    if (!await createCategory(parsed.data)) return Response.json({ error: "A category with this name already exists." }, { status: 409 });
    return Response.json({ category: { ...parsed.data, version: 1 } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}
async function PATCH(req) {
  try {
    if (!sameOrigin(req) || !await isAdmin(req)) return Response.json({ error: "Administrator access required." }, { status: 403 });
    if (catalogueReadOnly()) return migrationInProgress();
    const parsed = z3.object({ category: schema, expectedVersion: z3.number().int().min(1) }).safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Complete the category details and refresh its current version." }, { status: 400 });
    const version = await updateCategory(parsed.data.category, parsed.data.expectedVersion);
    if (version === null) return Response.json({ error: "This category changed or was deleted. Refresh before saving." }, { status: 409 });
    return Response.json({ category: { ...parsed.data.category, version } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "23505") return Response.json({ error: "A category with this name already exists." }, { status: 409 });
    return failure(error);
  }
}
async function DELETE2(req) {
  try {
    if (!sameOrigin(req) || !await isAdmin(req)) return Response.json({ error: "Administrator access required." }, { status: 403 });
    if (catalogueReadOnly()) return migrationInProgress();
    const parsed = z3.object({ id: z3.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160), expectedVersion: z3.number().int().min(1), deleteIngredients: z3.boolean(), confirmation: z3.literal("DELETE CATEGORY") }).safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Confirm the category deletion and its current version." }, { status: 400 });
    const result = await deleteCategory(parsed.data.id, parsed.data.expectedVersion, parsed.data.deleteIngredients);
    if (!result.deleted) return Response.json({ error: "The category changed, was deleted, or still contains ingredients. Refresh and confirm whether to remove its ingredients too." }, { status: 409 });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}

// customer-and-backend/app/api/products/route.ts
var route_exports3 = {};
__export(route_exports3, {
  GET: () => GET3,
  POST: () => POST3
});

// customer-and-backend/lib/catalogue.ts
var categories = [
  { id: "fruit", name: "Juice, purees & concentrates", short: "Fruit ingredients", color: "#f5b956", image: "/images/fruit.webp", text: "Fruit-forward possibilities, from the first sip to the last spoonful.", apps: ["Beverages", "Dairy", "Bakery", "Desserts"] },
  { id: "coconut", name: "Coconut products", short: "Coconut", color: "#d6dfb9", image: "/images/coconut.webp", text: "A versatile tropical ingredient, in the format your recipe needs.", apps: ["Beverages", "Bakery", "Desserts", "Confectionery"] },
  { id: "cocoa", name: "Cocoa powder", short: "Cocoa", color: "#c69b80", image: "/images/cocoa.webp", text: "The starting point for rich chocolate flavour.", apps: ["Beverages", "Bakery", "Dairy", "Confectionery"] },
  { id: "coffee", name: "Coffee ingredients", short: "Coffee", color: "#d8b79e", image: "/images/coffee.webp", text: "A world of coffee formats for your next creation.", apps: ["Beverages", "Dairy", "Desserts"] },
  { id: "dairy", name: "Dairy ingredient solutions", short: "Dairy ingredients", color: "#dce4ef", image: "/images/dairy.webp", text: "Foundations for texture, taste and everyday favourites.", apps: ["Dairy", "Bakery", "Beverages", "Desserts"] },
  { id: "preparations", name: "Fruit preparations", short: "Fruit preparations", color: "#e8a2ae", image: "/images/preparations.webp", text: "Fruit at the heart of dairy, bakery and dessert applications.", apps: ["Dairy", "Ice cream", "Beverages", "Desserts", "Bakery", "Confectionery"] },
  { id: "powders", name: "Fruit & specialty powders", short: "Fruit & specialty powders", color: "#e7c1de", image: "/images/powders.webp", text: "The character of familiar ingredients in convenient powder formats.", apps: ["Beverages", "Bakery", "Desserts", "Confectionery"] },
  { id: "colours", name: "Natural food colours", short: "Food colours", color: "#c3afd9", image: "/images/colours.webp", text: "Explore a palette inspired by fruits, roots and plants.", apps: ["Beverages", "Dairy", "Bakery", "Confectionery"] }
];
var lists = {
  fruit: ["Mango pulp & puree", "Guava concentrate & pulp", "Tomato paste", "Dehydrated tomato flakes", "Chilli puree & pastes", "Ginger puree", "Garlic paste", "Orange juice concentrate", "Apple concentrate, puree & NFC", "Grape concentrates", "Pineapple concentrate", "Mixed fruit concentrate", "Strawberry puree", "Pomegranate concentrate", "Apricot products", "Pear concentrate & puree", "Peach concentrate & puree"],
  coconut: ["Low-fat desiccated coconut", "High-fat desiccated coconut", "Coconut flakes", "Coconut cream powder", "Coconut sugar", "Toasted coconut paste", "Virgin coconut oil", "Aseptic coconut milk", "Aseptic coconut water"],
  cocoa: ["Cocoa powder"],
  coffee: ["Spray-dried instant coffee", "Agglomerated instant coffee", "Decaffeinated instant coffee", "Instant & micro-ground coffee", "Flavoured instant coffee", "Coffee extract", "Coffee oil", "Raw caffeine", "Naturally decaffeinated green coffee"],
  dairy: ["Whole milk powder", "Skimmed milk powder", "Fat-filled milk powder", "Milk stabilizers & emulsifiers", "Butter", "Cheese powder", "Curd powder", "Yoghurt powder", "Whey protein powder", "Soy milk powder"],
  preparations: ["Fruit preparations for dairy", "Fruit preparations for ice cream", "Fruit preparations for beverages", "Fruit preparations for desserts", "Fruit preparations for bakery", "Fruit preparations for confectionery", "Fruit toppings", "Fruit variegates"],
  powders: ["Ripe mango powder", "Raw mango powder", "Orange powder", "Tamarind powder", "Pineapple powder", "Pomegranate powder", "Papaya powder", "Sweet lime powder", "Banana powder", "Black grape powder", "Guava powder", "Strawberry powder", "Apple powder", "Watermelon powder", "Cranberry powder", "Blueberry powder", "Raspberry powder", "Honey powder", "Vinegar powder", "Apple cider vinegar powder", "Jaggery powder", "Coconut milk powder", "Coconut water powder", "Amla powder"],
  colours: ["Caramel colour powder", "Orange annatto powder", "Yellow annatto powder", "Beetroot colour", "Black carrot colour", "Orange carrot colour", "Safflower colour", "Spirulina colour", "Chokeberry colour", "Elderberry colour", "Black currant colour", "Red radish colour", "Purple potato colour", "Dried apple colour", "Spirulina & safflower colour", "Hibiscus colour"]
};
var slugify = (s) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
var seedProducts = categories.flatMap((c) => lists[c.id].map((name) => ({ id: slugify(name), name, category: c.id, image: c.image, description: `${name} from LYCA's ${c.name.toLowerCase()} portfolio. Discuss your application, required format and destination with our ingredient sourcing team.`, forms: name.includes("powder") ? "Powder" : name.includes("concentrate") ? "Concentrate / formats on enquiry" : name.includes("puree") ? "Puree / formats on enquiry" : "Confirm available formats with LYCA", applications: c.apps, details: c.id === "colours" ? "Colour shade, pH range, light stability and heat stability depend on the selected product. Request the technical data sheet for your formulation." : "Request product specifications, origin, packaging, minimum order quantity, shelf life and sample availability for your intended application." })));

// customer-and-backend/app/api/products/route.ts
import { z as z4 } from "zod";
var ProductSchema = z4.object({ id: z4.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100), name: z4.string().min(2).max(150), category: z4.enum(categories.map((c) => c.id)), description: z4.string().min(10).max(2500), image: z4.string().regex(/^\/(?:images\/[-\w.]+|api\/media\/[a-f0-9-]+\.(?:webp|png|jpg))$/), forms: z4.string().min(2).max(200), applications: z4.array(z4.enum(["Beverages", "Dairy", "Ice cream", "Bakery", "Confectionery", "Desserts"])).min(1).max(6), details: z4.string().max(3e3), archived: z4.boolean().optional() });
async function GET3(req) {
  try {
    const admin = new URL(req.url).searchParams.get("admin") === "1";
    if (admin && !await isAdmin(req)) return Response.json({ error: "Administrator access required" }, { status: 403 });
    return Response.json({ products: await catalogue(admin) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return failure(e);
  }
}
async function POST3(req) {
  try {
    if (!sameOrigin(req) || !await isAdmin(req)) return Response.json({ error: "Administrator access required" }, { status: 403 });
    if (catalogueReadOnly()) return migrationInProgress();
    const parsed = ProductSchema.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: "Please complete all product fields and select a valid image." }, { status: 400 });
    const p = parsed.data;
    await saveProductRecord(p.id, p, !!p.archived);
    return Response.json({ product: p });
  } catch (e) {
    return failure(e);
  }
}

// customer-and-backend/app/api/settings/route.ts
var route_exports4 = {};
__export(route_exports4, {
  GET: () => GET4,
  POST: () => POST4
});
import { z as z5 } from "zod";
async function GET4() {
  try {
    return Response.json(await getSettings(), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return failure(e);
  }
}
async function POST4(req) {
  try {
    if (!sameOrigin(req) || !await isAdmin(req)) return Response.json({ error: "Administrator access required" }, { status: 403 });
    if (catalogueReadOnly()) return migrationInProgress();
    const schema2 = z5.object({ serviceId: z5.string().max(150), templateId: z5.string().max(150), publicKey: z5.string().max(200), responsePromise: z5.string().max(250) });
    const p = schema2.safeParse(await req.json());
    if (!p.success) return Response.json({ error: "Invalid settings" }, { status: 400 });
    await savePublicSettings(p.data);
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}

// customer-and-backend/app/api/catalogue/route.ts
var route_exports5 = {};
__export(route_exports5, {
  GET: () => GET6,
  dynamic: () => dynamic2
});

// vercel-runtime/media.mjs
var media_exports = {};
__export(media_exports, {
  GET: () => GET5,
  blobBucket: () => blobBucket
});
import { head, put, BlobNotFoundError } from "@vercel/blob";
var validKey = /^[a-f0-9-]+\.(?:webp|png|jpg)$/;
function blobBucket(token) {
  return {
    async put(key, bytes, metadata) {
      if (!validKey.test(key) || !token) throw new Error("Photo storage is not configured.");
      await put("lyca/media/" + key, bytes, {
        token,
        access: "public",
        addRandomSuffix: false,
        contentType: metadata.httpMetadata.contentType,
        cacheControlMaxAge: 31536e3
      });
    },
    async url(key) {
      if (!validKey.test(key) || !token) return null;
      try {
        return (await head("lyca/media/" + key, { token })).url;
      } catch (error) {
        if (error instanceof BlobNotFoundError) return null;
        throw error;
      }
    }
  };
}
async function GET5(_request, { params }) {
  const { key } = await params;
  if (!validKey.test(key)) return new Response("Not found", { status: 404 });
  try {
    const url = await requestContext.getStore().environment.BUCKET.url(key);
    if (!url) return new Response("Not found", { status: 404 });
    return new Response(null, { status: 307, headers: {
      Location: url,
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff"
    } });
  } catch {
    return Response.json({ error: "Photo storage is temporarily unavailable." }, { status: 503 });
  }
}

// customer-and-backend/app/api/catalogue/route.ts
var dynamic2 = "force-dynamic";
async function GET6(req) {
  const image = new URL(req.url).searchParams.get("image");
  if (image) {
    if (!/^[a-f0-9-]+\.(?:webp|png|jpg)$/.test(image)) return Response.json({ error: "Invalid image reference." }, { status: 400 });
    return GET5(req, { params: Promise.resolve({ key: image }) });
  }
  return GET(new Request(new URL("/api/ingredients", req.url), { headers: req.headers }));
}

// customer-and-backend/app/api/upload/route.ts
var route_exports6 = {};
__export(route_exports6, {
  POST: () => POST5
});
async function POST5(req) {
  try {
    if (!sameOrigin(req) || !await isAdmin(req)) return Response.json({ error: "Administrator access required" }, { status: 403 });
    if (Number(req.headers.get("content-length")) > 6 * 1024 * 1024) return Response.json({ error: "Image must be smaller than 5 MB." }, { status: 413 });
    const data = await req.formData();
    const f = data.get("image");
    if (!(f instanceof File) || f.size > 5 * 1024 * 1024) return Response.json({ error: "Choose a JPEG, PNG or WebP image under 5 MB." }, { status: 400 });
    const bytes = new Uint8Array(await f.arrayBuffer());
    let ext = "";
    if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) ext = "jpg";
    else if (bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) ext = "png";
    else if (new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP") ext = "webp";
    if (!ext) return Response.json({ error: "Unsupported image format." }, { status: 400 });
    const key = `${crypto.randomUUID()}.${ext}`;
    await bucket().put(key, bytes, { httpMetadata: { contentType: `image/${ext === "jpg" ? "jpeg" : ext}` } });
    return Response.json({ url: `/api/media/${key}` });
  } catch (e) {
    return failure(e);
  }
}

// vercel-runtime/handler.mjs
import { neon as neon2 } from "@neondatabase/serverless";

// vercel-runtime/auth.mjs
import { createHmac, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
var scrypt = promisify(nodeScrypt);
var COOKIE = "__Host-lyca_admin";
var SESSION_SECONDS = 8 * 60 * 60;
var noStore2 = {
  "Cache-Control": "private, no-store",
  "Content-Type": "text/html; charset=utf-8",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
};
function validPasswordHash(value = "") {
  return /^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(value);
}
async function checkPassword(password, encoded) {
  if (!validPasswordHash(encoded)) return false;
  const [, salt, expected] = encoded.split(":");
  const actual = await scrypt(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(expected, "hex"));
}
function configured(env2) {
  return !!env2.ADMIN_EMAIL?.trim() && validPasswordHash(env2.ADMIN_PASSWORD_HASH) && env2.SESSION_SECRET?.length >= 32;
}
function signature(value, env2) {
  return createHmac("sha256", env2.SESSION_SECRET).update(env2.ADMIN_PASSWORD_HASH).update("\0").update(value).digest("base64url");
}
function createSession(env2, origin, now = Date.now()) {
  const data = Buffer.from(JSON.stringify({
    email: env2.ADMIN_EMAIL.trim().toLowerCase(),
    origin,
    exp: Math.floor(now / 1e3) + SESSION_SECONDS,
    nonce: randomBytes(16).toString("hex")
  })).toString("base64url");
  return `${data}.${signature(data, env2)}`;
}
function sessionUser(request, env2, now = Date.now()) {
  if (!configured(env2)) return null;
  const token = request.headers.get("cookie")?.split(";").map((v) => v.trim()).find((v) => v.startsWith(COOKIE + "="))?.slice(COOKIE.length + 1);
  if (!token || token.length > 2048) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const expected = Buffer.from(signature(parts[0], env2));
  const received = Buffer.from(parts[1]);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const data = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    if (data.exp <= Math.floor(now / 1e3) || data.exp > Math.floor(now / 1e3) + SESSION_SECONDS || data.origin !== new URL(request.url).origin || data.email !== env2.ADMIN_EMAIL.trim().toLowerCase()) return null;
    return { userId: "lyca-vercel-owner", email: data.email, displayName: "LYCA administrator", fullName: null };
  } catch {
    return null;
  }
}
function sameOrigin2(request) {
  return request.headers.get("origin") === new URL(request.url).origin && request.headers.get("sec-fetch-site") !== "cross-site";
}
function page(message = "", logout = false, status = 200) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>LYCA administrator</title><style>*{box-sizing:border-box}body{margin:0;background:#fcfbfe;color:#302439;font:16px/1.6 system-ui}main{max-width:460px;margin:10vh auto;padding:32px;background:#fff;border:1px solid #dfd7e6;border-radius:18px}h1{line-height:1.15}label{display:block;margin:18px 0}input,button{font:inherit;width:100%;padding:12px;border-radius:8px;border:1px solid #cfc6da}button{background:#48335f;color:white;cursor:pointer}a{color:#48335f}.message{color:#9b2339}</style></head><body><main><p>LYCA INGREDIENT STUDIO</p><h1>${logout ? "Sign out" : "Administrator sign-in"}</h1>${message ? `<p class="message" role="alert">${message}</p>` : ""}<form method="post" action="${logout ? "/logout" : "/login"}">${logout ? "<p>Sign out of this browser?</p>" : '<label>Email<input name="email" type="email" autocomplete="username" required maxlength="254"></label><label>Password<input name="password" type="password" autocomplete="current-password" required maxlength="256"></label>'}<button>${logout ? "Sign out" : "Sign in"}</button></form><p><a href="/">Back to admin</a></p></main></body></html>`, { status, headers: noStore2 });
}
async function attemptsAllowed(request, env2, sql) {
  const ip = request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for") || "unknown";
  const keys = ["ip:" + ip.split(",")[0].trim(), "account:" + env2.ADMIN_EMAIL.trim().toLowerCase()].map((value) => createHmac("sha256", env2.SESSION_SECRET).update(value).digest("hex"));
  const results = await sql.transaction([
    ...keys.map((bucket2) => sql.query(`INSERT INTO lyca.admin_login_attempts (bucket,window_start,attempts)
      VALUES ($1,now(),1) ON CONFLICT (bucket) DO UPDATE SET
      attempts=CASE WHEN lyca.admin_login_attempts.window_start < now()-interval '15 minutes' THEN 1 ELSE lyca.admin_login_attempts.attempts+1 END,
      window_start=CASE WHEN lyca.admin_login_attempts.window_start < now()-interval '15 minutes' THEN now() ELSE lyca.admin_login_attempts.window_start END
      RETURNING attempts`, [bucket2])),
    sql.query("DELETE FROM lyca.admin_login_attempts WHERE window_start < now()-interval '1 day'")
  ]);
  return Number(results[0][0].attempts) <= 10 && Number(results[1][0].attempts) <= 40;
}
async function authentication(request, env2, sql, pathname) {
  const logout = pathname === "/logout" || pathname === "/signout-with-chatgpt";
  if (!["GET", "POST", "HEAD"].includes(request.method)) return new Response("Method not allowed", { status: 405 });
  if (request.method !== "POST") return page("", logout);
  if (!sameOrigin2(request)) return new Response("Forbidden", { status: 403 });
  if (logout) return new Response(null, { status: 303, headers: {
    Location: "/",
    "Cache-Control": "no-store",
    "Set-Cookie": `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
  } });
  if (!configured(env2)) return page("Administrator sign-in is not configured. Follow VERCEL-DEPLOY.md.", false, 503);
  const body = await request.formData().catch(() => null);
  const email = body?.get("email"), password = body?.get("password");
  if (typeof email !== "string" || typeof password !== "string" || email.length > 254 || password.length > 256) return page("Enter your email and password.", false, 400);
  try {
    if (!await attemptsAllowed(request, env2, sql)) {
      const response = page("Too many sign-in attempts. Try again in 15 minutes.", false, 429);
      response.headers.set("Retry-After", "900");
      return response;
    }
    const validPassword = await checkPassword(password, env2.ADMIN_PASSWORD_HASH);
    if (!validPassword || email.trim().toLowerCase() !== env2.ADMIN_EMAIL.trim().toLowerCase()) return page("Email or password is incorrect.", false, 401);
    return new Response(null, { status: 303, headers: {
      Location: "/",
      "Cache-Control": "no-store",
      "Set-Cookie": `${COOKIE}=${createSession(env2, new URL(request.url).origin)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`
    } });
  } catch {
    return page("Sign-in is temporarily unavailable. Check the database settings and run VERCEL-SETUP.sql.", false, 503);
  }
}

// vercel-runtime/handler.mjs
var routes = { ingredients: route_exports, categories: route_exports2, products: route_exports3, settings: route_exports4, catalogue: route_exports5, upload: route_exports6 };
var PHOTO_LIMIT = 4 * 1024 * 1024;
var errorResponse = (error, status) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
async function limitedRequest(request, url, limit) {
  const headers = new Headers(request.headers);
  for (const name of [...headers.keys()]) if (name.startsWith("oai-") || name === "x-lyca-admin-key") headers.delete(name);
  if (["GET", "HEAD"].includes(request.method)) return new Request(url, { method: request.method, headers });
  if (Number(headers.get("content-length")) > limit) throw Object.assign(new Error("Request too large."), { status: 413 });
  const reader = request.body?.getReader();
  const chunks = [];
  let length = 0;
  if (reader) for (; ; ) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > limit) {
      await reader.cancel();
      throw Object.assign(new Error("Request too large."), { status: 413 });
    }
    chunks.push(value);
  }
  headers.delete("content-length");
  return new Request(url, { method: request.method, headers, body: Buffer.concat(chunks) });
}
function customerRedirect(pathname, url, environment) {
  if (!environment.CUSTOMER_SITE_URL) return errorResponse("Set CUSTOMER_SITE_URL in the admin Vercel project to open the customer website.", 503);
  const destination = new URL(environment.CUSTOMER_SITE_URL);
  if (destination.protocol !== "https:" || destination.username || destination.password || destination.pathname !== "/" || destination.search || destination.hash) return errorResponse("CUSTOMER_SITE_URL must be the HTTPS customer website origin.", 503);
  destination.pathname = "/" + pathname.replace(/^\/customer\/?/, "").replace(/^\/+/, "");
  destination.search = url.search;
  return new Response(null, { status: 307, headers: { Location: destination.href, "Cache-Control": "no-store" } });
}
function createApplication({ env: env2, sql, blob } = {}) {
  return async function application(incoming) {
    try {
      const environment = { ...typeof env2 === "function" ? env2() : env2 || process.env };
      const role = environment.LYCA_SITE_ROLE;
      if (!["admin", "customer"].includes(role)) return errorResponse("Set LYCA_SITE_ROLE to admin or customer in this Vercel project, then redeploy.", 503);
      const url = new URL(incoming.url);
      const rewritten = url.searchParams.get("__lyca_path");
      if (rewritten) {
        url.pathname = rewritten;
        url.searchParams.delete("__lyca_path");
      }
      const pathname = url.pathname;
      if (role === "admin" && /^\/customer(?:\/|$)/.test(pathname)) return customerRedirect(pathname, url, environment);
      const isAuth = ["/login", "/logout", "/signin-with-chatgpt", "/signout-with-chatgpt"].includes(pathname);
      if (!isAuth && !pathname.startsWith("/api/")) return new Response("Not found", { status: 404 });
      if (role !== "admin" && isAuth) return new Response("Not found", { status: 404 });
      const isRead = ["GET", "HEAD"].includes(incoming.method);
      if (!isRead && !sameOrigin2(new Request(url, { headers: incoming.headers }))) return errorResponse("A same-origin request is required.", 403);
      const request = await limitedRequest(incoming, url, pathname === "/api/upload" ? PHOTO_LIMIT + 16384 : isAuth ? 8192 : 65536);
      const user = role === "admin" ? sessionUser(request, environment) : null;
      if (pathname === "/api/admin") {
        if (!isRead) return new Response("Method not allowed", { status: 405 });
        const response = Response.json({
          signedIn: !!user,
          admin: !!user,
          needsSetup: role === "admin" && !configured(environment),
          uploadMaxMB: 4
        }, { headers: { "Cache-Control": "no-store" } });
        return request.method === "HEAD" ? new Response(null, { headers: response.headers }) : response;
      }
      if (!isAuth && !isRead && (role !== "admin" || !user)) return errorResponse("Administrator access required.", 403);
      if (!environment.DATABASE_URL?.startsWith("postgres")) return errorResponse("The Neon DATABASE_URL is not configured.", 503);
      const database = sql || neon2(environment.DATABASE_URL, { fetchOptions: { signal: AbortSignal.timeout(15e3) } });
      if (isAuth) return await authentication(request, environment, database, pathname);
      if (pathname === "/api/upload" && !isRead) {
        const form = await request.clone().formData().catch(() => null);
        const image = form?.get("image");
        if (!(image instanceof File) || image.size > PHOTO_LIMIT) return errorResponse("Choose a JPEG, PNG or WebP image up to 4 MB.", 400);
      }
      const match = /^\/api\/media\/([a-f0-9-]+\.(?:webp|png|jpg))$/.exec(pathname);
      const route = match ? media_exports : routes[pathname.slice("/api/".length)];
      if (!route) return new Response("Not found", { status: 404 });
      const method = request.method === "HEAD" ? "GET" : request.method;
      if (!route[method]) return new Response("Method not allowed", { status: 405 });
      const context = { user, sql: database, environment: {
        DATABASE_URL: environment.DATABASE_URL,
        CATALOGUE_DATABASE: "postgresql",
        CATALOGUE_READ_ONLY: role === "customer" ? "true" : environment.CATALOGUE_READ_ONLY || "false",
        ADMIN_EMAIL: role === "admin" ? environment.ADMIN_EMAIL : void 0,
        BUCKET: blob || blobBucket(environment.BLOB_READ_WRITE_TOKEN)
      } };
      return await requestContext.run(context, async () => {
        const response = await route[method](request, match ? { params: Promise.resolve({ key: match[1] }) } : void 0);
        if (!response.headers.has("Cache-Control")) response.headers.set("Cache-Control", "no-store");
        response.headers.set("X-Content-Type-Options", "nosniff");
        return request.method === "HEAD" ? new Response(null, { status: response.status, headers: response.headers }) : response;
      });
    } catch (error) {
      if (error?.status === 413) return errorResponse("Request is too large. Photos must be up to 4 MB.", 413);
      console.error("Vercel service error", { code: typeof error?.code === "string" ? error.code : "unavailable" });
      return errorResponse("This service is temporarily unavailable. Check the Vercel environment settings and database setup.", 503);
    }
  };
}
export {
  createApplication
};
