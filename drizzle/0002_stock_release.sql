ALTER TABLE `orders` ADD `stock_released_at` text;--> statement-breakpoint
CREATE INDEX `orders_reservation_idx` ON `orders` (`payment`,`payment_status`,`status`,`created_at`);--> statement-breakpoint
-- Orders cancelled before this column existed already had their stock put back.
UPDATE `orders` SET `stock_released_at` = `updated_at` WHERE `status` = 'cancelled';
