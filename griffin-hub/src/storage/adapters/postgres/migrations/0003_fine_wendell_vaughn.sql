ALTER TABLE "plans" RENAME TO "monitors";--> statement-breakpoint
ALTER TABLE "runs" RENAME COLUMN "plan_id" TO "monitor_id";--> statement-breakpoint
ALTER TABLE "runs" DROP CONSTRAINT "runs_plan_id_plans_id_fk";
--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_monitor_id_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE no action ON UPDATE no action;