-- Ratings and review counts came from the original catalogue and the demo data, not from
-- customers (flaw #17). Reset them; the columns stay for a real review system later.
UPDATE `products` SET `rating` = 0, `review_count` = 0;
