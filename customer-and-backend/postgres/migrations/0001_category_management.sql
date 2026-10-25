CREATE TABLE "lyca"."categories" (
	"id" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "category_title_unique" ON "lyca"."categories" USING btree (lower("data"->>'title'));