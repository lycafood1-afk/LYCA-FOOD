CREATE SCHEMA "lyca";
--> statement-breakpoint
CREATE TABLE "lyca"."ingredients" (
	"id" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ingredient_status" CHECK ("lyca"."ingredients"."status" IN ('draft','published','archived')),
	CONSTRAINT "ingredient_version" CHECK ("lyca"."ingredients"."version" >= 0)
);
--> statement-breakpoint
CREATE TABLE "lyca"."products" (
	"id" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"archived" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lyca"."settings" (
	"id" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
