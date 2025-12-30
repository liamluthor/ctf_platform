CREATE TABLE "challenge_containers" (
	"id" serial PRIMARY KEY NOT NULL,
	"challenge_id" integer NOT NULL,
	"container_id" integer NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "challenge_containers_challenge_id_container_id_unique" UNIQUE("challenge_id","container_id")
);
--> statement-breakpoint
CREATE TABLE "container_deployments" (
	"id" serial PRIMARY KEY NOT NULL,
	"container_id" integer NOT NULL,
	"instance_name" text NOT NULL,
	"platform" text NOT NULL,
	"platform_id" text,
	"status" text NOT NULL,
	"status_message" text,
	"internal_ip" text,
	"access_url" text,
	"last_health_check" timestamp,
	"health_status" text,
	"started_at" timestamp,
	"stopped_at" timestamp,
	"deployed_by" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "container_deployments_instance_name_unique" UNIQUE("instance_name")
);
--> statement-breakpoint
CREATE TABLE "container_env_vars" (
	"id" serial PRIMARY KEY NOT NULL,
	"container_id" integer NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"is_secret" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "container_env_vars_container_id_key_unique" UNIQUE("container_id","key")
);
--> statement-breakpoint
CREATE TABLE "container_port_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"deployment_id" integer NOT NULL,
	"container_port" integer NOT NULL,
	"host_port" integer NOT NULL,
	"protocol" text DEFAULT 'tcp' NOT NULL,
	"service_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "containers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"deployment_type" text NOT NULL,
	"registry_url" text,
	"image_name" text,
	"image_tag" text DEFAULT 'latest',
	"registry_username" text,
	"registry_password" text,
	"upload_filename" text,
	"upload_path" text,
	"upload_size" integer,
	"exposed_ports" text DEFAULT '[]' NOT NULL,
	"memory_limit" integer DEFAULT 512,
	"cpu_limit" integer DEFAULT 256,
	"created_by" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "containers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "challenge_containers" ADD CONSTRAINT "challenge_containers_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_containers" ADD CONSTRAINT "challenge_containers_container_id_containers_id_fk" FOREIGN KEY ("container_id") REFERENCES "public"."containers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "container_deployments" ADD CONSTRAINT "container_deployments_container_id_containers_id_fk" FOREIGN KEY ("container_id") REFERENCES "public"."containers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "container_deployments" ADD CONSTRAINT "container_deployments_deployed_by_users_id_fk" FOREIGN KEY ("deployed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "container_env_vars" ADD CONSTRAINT "container_env_vars_container_id_containers_id_fk" FOREIGN KEY ("container_id") REFERENCES "public"."containers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "container_port_mappings" ADD CONSTRAINT "container_port_mappings_deployment_id_container_deployments_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."container_deployments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "containers" ADD CONSTRAINT "containers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;