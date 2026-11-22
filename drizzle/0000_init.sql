CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text,
	`summary` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `banners` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`subtitle` text DEFAULT '' NOT NULL,
	`cta_label` text DEFAULT '' NOT NULL,
	`href` text DEFAULT '/' NOT NULL,
	`image_desktop` text,
	`image_mobile` text,
	`background` text DEFAULT '#0000ff' NOT NULL,
	`foreground` text DEFAULT '#ffffff' NOT NULL,
	`starts_at` text,
	`ends_at` text,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`parent_id` text,
	`icon` text,
	`image` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`hidden` integer DEFAULT false NOT NULL,
	`show_on_home` integer DEFAULT true NOT NULL,
	`show_in_menu` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_uq` ON `categories` (`slug`);--> statement-breakpoint
CREATE INDEX `categories_parent_idx` ON `categories` (`parent_id`);--> statement-breakpoint
CREATE TABLE `coupons` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`type` text NOT NULL,
	`value` integer DEFAULT 0 NOT NULL,
	`min_subtotal` integer DEFAULT 0 NOT NULL,
	`category_ids` text DEFAULT '[]' NOT NULL,
	`first_order_only` integer DEFAULT false NOT NULL,
	`usage_limit` integer,
	`per_customer_limit` integer,
	`used_count` integer DEFAULT 0 NOT NULL,
	`starts_at` text,
	`ends_at` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coupons_code_uq` ON `coupons` (`code`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`phone` text NOT NULL,
	`name` text NOT NULL,
	`district` text,
	`vip` integer DEFAULT false NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_phone_uq` ON `customers` (`phone`);--> statement-breakpoint
CREATE TABLE `delivery_slots` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`capacity` integer,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `delivery_zones` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`region` text NOT NULL,
	`fee` integer NOT NULL,
	`eta_hours` integer DEFAULT 24 NOT NULL,
	`khoroo_count` integer DEFAULT 1 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `home_sections` (
	`key` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`config` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `order_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` text NOT NULL,
	`type` text NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`from_status` text,
	`to_status` text,
	`actor` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `order_events_order_idx` ON `order_events` (`order_id`);--> statement-breakpoint
CREATE TABLE `order_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`variant_id` text,
	`title` text NOT NULL,
	`variant_name` text,
	`sku` text,
	`unit_price` integer NOT NULL,
	`quantity` integer NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `order_lines_order_idx` ON `order_lines` (`order_id`);--> statement-breakpoint
CREATE INDEX `order_lines_product_idx` ON `order_lines` (`product_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text,
	`customer_name` text NOT NULL,
	`phone` text NOT NULL,
	`district` text NOT NULL,
	`zone_id` text,
	`khoroo` integer,
	`address` text DEFAULT '' NOT NULL,
	`delivery_note` text DEFAULT '' NOT NULL,
	`delivery_date` text,
	`delivery_slot` text,
	`payment` text NOT NULL,
	`payment_status` text DEFAULT 'pending' NOT NULL,
	`status` text NOT NULL,
	`subtotal` integer NOT NULL,
	`discount` integer DEFAULT 0 NOT NULL,
	`coupon_code` text,
	`delivery_fee` integer NOT NULL,
	`total` integer NOT NULL,
	`ebarimt_type` text DEFAULT 'person' NOT NULL,
	`ebarimt_reg_no` text,
	`driver_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`zone_id`) REFERENCES `delivery_zones`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`driver_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `orders_created_idx` ON `orders` (`created_at`);--> statement-breakpoint
CREATE INDEX `orders_status_idx` ON `orders` (`status`);--> statement-breakpoint
CREATE INDEX `orders_phone_idx` ON `orders` (`phone`);--> statement-breakpoint
CREATE INDEX `orders_customer_idx` ON `orders` (`customer_id`);--> statement-breakpoint
CREATE INDEX `orders_driver_idx` ON `orders` (`driver_id`);--> statement-breakpoint
CREATE TABLE `product_variants` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`option` text NOT NULL,
	`name` text NOT NULL,
	`price` integer NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	`sku` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `variants_product_idx` ON `product_variants` (`product_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `variants_sku_uq` ON `product_variants` (`sku`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`brand` text DEFAULT '' NOT NULL,
	`category_id` text NOT NULL,
	`subcategory_id` text,
	`price` integer NOT NULL,
	`compare_at_price` integer,
	`cost` integer,
	`sku` text,
	`barcode` text,
	`rating` real DEFAULT 0 NOT NULL,
	`review_count` integer DEFAULT 0 NOT NULL,
	`image` text DEFAULT '' NOT NULL,
	`gallery` text DEFAULT '[]' NOT NULL,
	`badge` text,
	`stock` integer DEFAULT 0 NOT NULL,
	`low_stock_alert` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`publish_at` text,
	`featured` integer DEFAULT false NOT NULL,
	`warranty_months` integer DEFAULT 12 NOT NULL,
	`weight_kg` real,
	`oversized` integer DEFAULT false NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`features` text DEFAULT '[]' NOT NULL,
	`specs` text DEFAULT '[]' NOT NULL,
	`keywords` text DEFAULT '[]' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`subcategory_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `products_category_idx` ON `products` (`category_id`);--> statement-breakpoint
CREATE INDEX `products_subcategory_idx` ON `products` (`subcategory_id`);--> statement-breakpoint
CREATE INDEX `products_status_idx` ON `products` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `products_sku_uq` ON `products` (`sku`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `staff` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`name` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`role` text NOT NULL,
	`password_hash` text,
	`phone` text,
	`zone_ids` text DEFAULT '[]' NOT NULL,
	`two_factor_enabled` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`last_login_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_username_uq` ON `staff` (`username`);