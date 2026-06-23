ALTER TABLE "purchase_orders" ADD COLUMN "billing_client_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_billing_client_id_clients_id_fk" FOREIGN KEY ("billing_client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
