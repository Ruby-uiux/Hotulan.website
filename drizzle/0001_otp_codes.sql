CREATE TABLE `otp_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`phone` text NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`consumed_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `otp_phone_created_idx` ON `otp_codes` (`phone`,`created_at`);