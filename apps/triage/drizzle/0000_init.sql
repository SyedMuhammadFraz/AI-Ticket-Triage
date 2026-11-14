CREATE TYPE "public"."actor_type" AS ENUM('customer', 'ai', 'agent', 'system');--> statement-breakpoint
CREATE TYPE "public"."category" AS ENUM('account_access', 'billing', 'cancellation', 'plan_change', 'refund', 'technical', 'other');--> statement-breakpoint
CREATE TYPE "public"."draft_status" AS ENUM('pending', 'approved', 'discarded');--> statement-breakpoint
CREATE TYPE "public"."review_reason" AS ENUM('no_kb_match', 'low_confidence', 'suspicious_instructions', 'insufficient_context', 'invalid_citation', 'unsafe_draft');--> statement-breakpoint
CREATE TYPE "public"."ticket_source" AS ENUM('web_form', 'seed', 'webhook');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('queued', 'processing', 'draft_ready', 'needs_review', 'failed', 'sent', 'escalated');--> statement-breakpoint
CREATE TYPE "public"."tier" AS ENUM('free', 'pro', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."urgency" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid,
	"actor_type" "actor_type" NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"ai_body" text NOT NULL,
	"final_body" text,
	"cited_article_ids" uuid[] NOT NULL,
	"status" "draft_status" DEFAULT 'pending' NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kb_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"category" "category" NOT NULL,
	"keywords" text DEFAULT '' NOT NULL,
	"body" text NOT NULL,
	"search" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', title), 'A') || setweight(to_tsvector('english', keywords), 'A') || setweight(to_tsvector('english', body), 'B')) STORED NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kb_articles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"draft_id" uuid,
	"body" text NOT NULL,
	"was_edited" boolean DEFAULT false NOT NULL,
	"sent_by" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" integer GENERATED ALWAYS AS IDENTITY (sequence name "tickets_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1001 CACHE 1),
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"customer_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"tier" "tier" NOT NULL,
	"source" "ticket_source" DEFAULT 'web_form' NOT NULL,
	"status" "ticket_status" DEFAULT 'queued' NOT NULL,
	"category" "category",
	"urgency" "urgency",
	"confidence" real,
	"triage_reason" text,
	"priority_score" integer DEFAULT 0 NOT NULL,
	"review_reasons" "review_reason"[] DEFAULT '{}' NOT NULL,
	"kb_matches" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"locked_at" timestamp with time zone,
	"submitter_ip_hash" text,
	"triaged_at" timestamp with time zone,
	"drafted_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tickets_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."drafts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_ticket_idx" ON "audit_events" USING btree ("ticket_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "drafts_one_pending_per_ticket" ON "drafts" USING btree ("ticket_id") WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX "kb_articles_search_idx" ON "kb_articles" USING gin ("search");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_one_per_ticket" ON "messages" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "tickets_queue_idx" ON "tickets" USING btree ("status","priority_score" DESC NULLS LAST,"created_at");--> statement-breakpoint
CREATE INDEX "tickets_rate_limit_idx" ON "tickets" USING btree ("submitter_ip_hash","created_at");