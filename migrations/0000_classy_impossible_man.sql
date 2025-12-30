CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#8B1538' NOT NULL,
	"icon" text DEFAULT 'terminal' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "challenge_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"challenge_id" integer NOT NULL,
	"filename" text NOT NULL,
	"original_name" text NOT NULL,
	"path" text NOT NULL,
	"size" integer NOT NULL,
	"mime_type" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "challenges" (
	"id" serial PRIMARY KEY NOT NULL,
	"ctf_event_id" integer NOT NULL,
	"category_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"flag" text NOT NULL,
	"points" integer NOT NULL,
	"is_dynamic" boolean DEFAULT false NOT NULL,
	"min_points" integer,
	"decay" integer,
	"solve_count" integer DEFAULT 0 NOT NULL,
	"author_id" varchar(36),
	"is_hidden" boolean DEFAULT false NOT NULL,
	"release_time" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ctf_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"rules" text,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"registration_start" timestamp,
	"registration_end" timestamp,
	"is_team_based" boolean DEFAULT false NOT NULL,
	"max_team_size" integer,
	"scoreboard_frozen" boolean DEFAULT false NOT NULL,
	"scoreboard_freeze_time" timestamp,
	"is_published" boolean DEFAULT false NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"invite_code" varchar(8),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ctf_events_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "ctf_registrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"ctf_event_id" integer NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"team_id" integer,
	"registered_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ctf_registrations_ctf_event_id_user_id_unique" UNIQUE("ctf_event_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"value_type" text DEFAULT 'string' NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "platform_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" text NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "solves" (
	"id" serial PRIMARY KEY NOT NULL,
	"challenge_id" integer NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"team_id" integer,
	"ctf_event_id" integer NOT NULL,
	"points" integer NOT NULL,
	"is_first_blood" boolean DEFAULT false NOT NULL,
	"solved_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "solves_user_id_challenge_id_unique" UNIQUE("user_id","challenge_id")
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"challenge_id" integer NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"team_id" integer,
	"flag" text NOT NULL,
	"is_correct" boolean NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"team_id" integer NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "team_members_user_id_team_id_unique" UNIQUE("user_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"invite_code" varchar(8) NOT NULL,
	"captain_id" varchar(36) NOT NULL,
	"avatar_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "teams_name_unique" UNIQUE("name"),
	CONSTRAINT "teams_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"avatar_url" text,
	"bio" text,
	"is_banned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "challenge_files" ADD CONSTRAINT "challenge_files_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_ctf_event_id_ctf_events_id_fk" FOREIGN KEY ("ctf_event_id") REFERENCES "public"."ctf_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ctf_registrations" ADD CONSTRAINT "ctf_registrations_ctf_event_id_ctf_events_id_fk" FOREIGN KEY ("ctf_event_id") REFERENCES "public"."ctf_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ctf_registrations" ADD CONSTRAINT "ctf_registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ctf_registrations" ADD CONSTRAINT "ctf_registrations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solves" ADD CONSTRAINT "solves_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solves" ADD CONSTRAINT "solves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solves" ADD CONSTRAINT "solves_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solves" ADD CONSTRAINT "solves_ctf_event_id_ctf_events_id_fk" FOREIGN KEY ("ctf_event_id") REFERENCES "public"."ctf_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_captain_id_users_id_fk" FOREIGN KEY ("captain_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;