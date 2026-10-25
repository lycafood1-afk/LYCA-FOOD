-- LYCA PostgreSQL setup: repeatable; never restores deleted products or categories.
BEGIN;
CREATE SCHEMA IF NOT EXISTS "lyca";

CREATE TABLE IF NOT EXISTS "lyca"."ingredients" (
	"id" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ingredient_status" CHECK ("lyca"."ingredients"."status" IN ('draft','published','archived')),
	CONSTRAINT "ingredient_version" CHECK ("lyca"."ingredients"."version" >= 0)
);

CREATE TABLE IF NOT EXISTS "lyca"."products" (
	"id" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"archived" boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS "lyca"."settings" (
	"id" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS "lyca"."categories" (
	"id" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "category_title_unique" ON "lyca"."categories" USING btree (lower("data"->>'title'));
CREATE TABLE IF NOT EXISTS "lyca"."catalogue_metadata" (
	"id" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);

ALTER TABLE "lyca"."categories" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;
WITH first_run AS (
 INSERT INTO lyca.catalogue_metadata (id,value) VALUES ('category-defaults-v1','{"initialized":true}'::jsonb)
 ON CONFLICT DO NOTHING RETURNING id
) INSERT INTO lyca.categories (id,data,sort_order)
 SELECT id,data,sort_order FROM jsonb_to_recordset('[{"id": "juice-concentrates", "data": {"id": "juice-concentrates", "title": "Juice Concentrates, Purees, Pulps & Pastes", "shortTitle": "Juice & Fruit Ingredients", "description": "", "image": "/images/mango.webp", "imageAlt": "Mango juice and freshly sliced mango against a dark backdrop", "imageCaption": "JUICE & FRUIT INGREDIENTS", "groups": [{"name": "Mango", "items": ["Alphonso Mango Pulp", "Totapuri Mango Pulp / Concentrate", "Kesar Mango Pulp", "Sindhura Mango Pulp", "Tommy Atkins Mango Puree", "Magdalena Mango Puree"]}, {"name": "Guava", "items": ["White Guava Juice Concentrate / Pulp", "Pink Guava Juice Concentrate / Pulp"]}, {"name": "Tomato", "items": ["Tomato Paste 36–38 (CB & HB)", "Tomato Paste 30–32 (CB & HB)", "Tomato Paste 28–30 (CB & HB)", "Dehydrated Tomato Flakes"]}, {"name": "Chilli, Pepper, Ginger & Garlic", "items": ["Red and Green Chilli Puree", "Cayenne Pepper Paste", "Fermented Red Chilli Paste", "Red and Green Ripened Chilli Paste", "Ginger Puree", "Garlic Paste"]}, {"name": "Other Concentrates & Purees", "items": ["Frozen Concentrated Orange Juice", "Apple Juice Concentrate / Puree / NFC", "Red Grape Juice Concentrate", "White Grape Juice Concentrate", "Sweetening Compound", "Low Acid White Grape Juice Concentrate", "Pineapple Juice Concentrate", "Deionized Pineapple Juice Concentrate", "Mixed Fruit Juice Concentrate", "Strawberry Puree", "Pomegranate Juice Concentrate", "Apricot Puree / Diced / Halves / Juice Concentrate", "Pear and Peach Juice Concentrate / Puree"]}], "note": "Brochure packaging formats include aseptic packs, aseptic bins, cans, frozen products, and concentrates. Sizes vary by format, and availability should be confirmed for each product."}, "sort_order": 0}, {"id": "coconut-products", "data": {"id": "coconut-products", "title": "Coconut Products", "shortTitle": "Coconut Products", "description": "", "image": "/images/coconut.webp", "imageAlt": "Fresh coconut halves and pieces on a dark surface", "imageCaption": "COCONUT PRODUCTS", "groups": [{"name": "Coconut Range", "items": ["Low-Fat Desiccated Coconut — Fine & Medium", "High-Fat Desiccated Coconut — Fine & Medium", "Desiccated Coconut Flakes", "Coconut Cream Powder", "Coconut Sugar", "Toasted Coconut Paste", "Virgin Coconut Oil", "Aseptic Coconut Milk & Water"]}]}, "sort_order": 1}, {"id": "coffee-cocoa", "data": {"id": "coffee-cocoa", "title": "Coffee & Cocoa", "shortTitle": "Coffee & Cocoa", "description": "", "image": "/images/coffee.webp", "imageAlt": "Roasted coffee beans on dark stone", "imageCaption": "COFFEE & COCOA", "groups": [{"name": "Coffee", "items": ["Spray-Dried Instant Coffee", "Agglomerated Instant Coffee", "Decaffeinated Instant Coffee", "Instant & Micro-Ground Coffee", "Flavoured Instant Coffee", "Coffee Extract", "Coffee Oil", "Raw Caffeine", "Naturally Decaffeinated Green Coffee"]}, {"name": "Cocoa", "items": ["Cocoa Powder"]}]}, "sort_order": 2}, {"id": "dairy-ingredients", "data": {"id": "dairy-ingredients", "title": "Dairy Ingredients", "shortTitle": "Dairy Ingredients", "description": "", "image": "/images/dairy.webp", "imageAlt": "Fresh milk pouring into a glass against black", "imageCaption": "DAIRY INGREDIENTS", "groups": [{"name": "Dairy Range", "items": ["Whole Milk Powder", "Skimmed Milk Powder", "Fat-Filled Milk Powder", "Milk Stabilizers & Emulsifiers", "Unsalted Sweet Cream Lactic Butter", "Cheese Powder", "Curd Powder", "Yoghurt Powder", "Whey Protein Powder", "Soy Milk Powder"]}]}, "sort_order": 3}, {"id": "fruit-preparations", "data": {"id": "fruit-preparations", "title": "Fruit Preparations", "shortTitle": "Fruit Preparations", "description": "", "image": "/images/berries.webp", "imageAlt": "Raspberries reflected on a black surface", "imageCaption": "FRUIT PREPARATIONS", "groups": [{"name": "Applications", "items": ["Dairy products", "Ice cream", "Beverages", "Bakery products", "Desserts", "Confectionery"]}]}, "sort_order": 4}, {"id": "spray-dried-powders", "data": {"id": "spray-dried-powders", "title": "Spray-Dried Powders", "shortTitle": "Spray-Dried Powders", "description": "", "image": "/images/powder.webp", "imageAlt": "Fresh mangoes, a source fruit for the fruit powder range", "imageCaption": "SPRAY-DRIED POWDERS", "groups": [{"name": "Fruit Powders", "items": ["Ripe Mango", "Raw Mango", "Orange", "Tamarind", "Pineapple", "Pomegranate", "Ripe Papaya", "Raw Papaya", "Sweet Lime", "Ripe Banana", "Raw Banana", "Black Grape", "Guava", "Strawberry", "Apple", "Watermelon", "Cranberry", "Blueberry", "Raspberry"]}, {"name": "Specialty Powders", "items": ["Honey", "Vinegar", "Apple Cider Vinegar", "Jaggery", "Coconut Milk", "Coconut Water", "Amla"]}, {"name": "Natural Colour Powders", "items": ["Caramel", "Orange Annatto", "Yellow Annatto", "Beetroot"]}]}, "sort_order": 5}, {"id": "food-colours", "data": {"id": "food-colours", "title": "Food Colours", "shortTitle": "Food Colours", "description": "", "image": "/images/colors.webp", "imageAlt": "Deep red dried hibiscus flowers, a botanical colour source", "imageCaption": "FOOD COLOURS", "groups": [{"name": "Natural Colour Range", "items": ["Beetroot", "Black Carrot", "Orange Carrot", "Safflower", "Spirulina", "Chokeberry", "Elderberry", "Black Currant", "Red Radish", "Purple Potato", "Dried Apple", "Spirulina and Safflower", "Hibiscus"]}]}, "sort_order": 6}]'::jsonb) AS records(id text,data jsonb,sort_order integer)
 WHERE EXISTS(SELECT 1 FROM first_run) ON CONFLICT DO NOTHING;
INSERT INTO lyca.settings (id,value) VALUES ('public','{"serviceId":"","templateId":"","publicKey":"","responsePromise":""}'::jsonb) ON CONFLICT DO NOTHING;
COMMIT;
SELECT count(*) AS products FROM lyca.ingredients;
SELECT id,data->>'title' AS category,version FROM lyca.categories ORDER BY sort_order,id;
