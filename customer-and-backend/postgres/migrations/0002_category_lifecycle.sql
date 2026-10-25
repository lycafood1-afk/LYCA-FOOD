CREATE TABLE "lyca"."catalogue_metadata" (
	"id" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lyca"."categories" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;