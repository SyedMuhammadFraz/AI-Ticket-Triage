CREATE TYPE "public"."webhook_delivery_status" AS ENUM('pending', 'delivered', 'dead');--> statement-breakpoint
ALTER TYPE "public"."ticket_source" ADD VALUE 'api';--> statement-breakpoint
CREATE TABLE "api_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"key_prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"scopes" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "api_clients_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "api_rate_limits" (
	"client_id" uuid NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "api_rate_limits_client_id_window_start_pk" PRIMARY KEY("client_id","window_start")
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endpoint_id" uuid NOT NULL,
	"ticket_id" uuid,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "webhook_delivery_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"last_status_code" integer,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"delivered_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_client_id" uuid NOT NULL,
	"url" text NOT NULL,
	"secret_ciphertext" text NOT NULL,
	"events" text[] NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kb_articles" ALTER COLUMN "category" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "tickets" ALTER COLUMN "category" SET DATA TYPE text;--> statement-breakpoint
-- Map the old SaaS categories onto the new commerce ones so existing rows survive the type change.
UPDATE "kb_articles" SET "category" = CASE "category" WHEN 'billing' THEN 'billing_invoices' WHEN 'cancellation' THEN 'order_changes' WHEN 'plan_change' THEN 'order_changes' WHEN 'refund' THEN 'returns_refunds' WHEN 'technical' THEN 'product_question' ELSE "category" END;--> statement-breakpoint
UPDATE "tickets" SET "category" = CASE "category" WHEN 'billing' THEN 'billing_invoices' WHEN 'cancellation' THEN 'order_changes' WHEN 'plan_change' THEN 'order_changes' WHEN 'refund' THEN 'returns_refunds' WHEN 'technical' THEN 'product_question' ELSE "category" END WHERE "category" IS NOT NULL;--> statement-breakpoint
DROP TYPE "public"."category";--> statement-breakpoint
CREATE TYPE "public"."category" AS ENUM('delivery', 'damaged_wrong_item', 'returns_refunds', 'billing_invoices', 'order_changes', 'account_access', 'product_question', 'other');--> statement-breakpoint
ALTER TABLE "kb_articles" ALTER COLUMN "category" SET DATA TYPE "public"."category" USING "category"::"public"."category";--> statement-breakpoint
ALTER TABLE "tickets" ALTER COLUMN "category" SET DATA TYPE "public"."category" USING "category"::"public"."category";--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "api_client_id" uuid;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "context" jsonb;--> statement-breakpoint
ALTER TABLE "api_rate_limits" ADD CONSTRAINT "api_rate_limits_client_id_api_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."api_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_endpoint_id_webhook_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."webhook_endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_api_client_id_api_clients_id_fk" FOREIGN KEY ("api_client_id") REFERENCES "public"."api_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "webhook_deliveries_due_idx" ON "webhook_deliveries" USING btree ("status","next_attempt_at");--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_api_client_id_api_clients_id_fk" FOREIGN KEY ("api_client_id") REFERENCES "public"."api_clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tickets_client_external_id" ON "tickets" USING btree ("api_client_id","external_id");