CREATE TYPE "public"."support_status" AS ENUM('submitted', 'received', 'in_review', 'answered', 'escalated');--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" integer GENERATED ALWAYS AS IDENTITY (sequence name "support_tickets_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 7001 CACHE 1),
	"user_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"order_id" uuid,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" "support_status" DEFAULT 'submitted' NOT NULL,
	"triage_ticket_id" uuid,
	"triage_number" integer,
	"sync_attempts" integer DEFAULT 0 NOT NULL,
	"last_sync_error" text,
	"reply_body" text,
	"replied_by" text,
	"replied_at" timestamp with time zone,
	"reply_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_tickets_number_unique" UNIQUE("number"),
	CONSTRAINT "support_tickets_triage_ticket_id_unique" UNIQUE("triage_ticket_id")
);
--> statement-breakpoint
CREATE TABLE "webhook_receipts" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "support_tickets_user_idx" ON "support_tickets" USING btree ("user_id","created_at" DESC NULLS LAST);