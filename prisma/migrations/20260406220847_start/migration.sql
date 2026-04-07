-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `max_user_id` BIGINT NOT NULL,
    `username` VARCHAR(255) NULL,
    `display_name` VARCHAR(255) NOT NULL,
    `is_bot` BOOLEAN NOT NULL DEFAULT false,
    `last_activity_time` BIGINT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_max_user_id_key`(`max_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `meal_entries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `image_id` VARCHAR(255) NOT NULL,
    `image_original_path` VARCHAR(500) NOT NULL,
    `image_compressed_path` VARCHAR(500) NOT NULL,
    `image_size_original` INTEGER NOT NULL,
    `image_size_compressed` INTEGER NOT NULL,
    `recognized_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `meal_entries_user_id_idx`(`user_id`),
    INDEX `meal_entries_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `nutrition_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `meal_entry_id` INTEGER NOT NULL,
    `product_name` VARCHAR(500) NOT NULL,
    `proteins` DECIMAL(8, 2) NOT NULL,
    `fats` DECIMAL(8, 2) NOT NULL,
    `carbs` DECIMAL(8, 2) NOT NULL,
    `calories` DECIMAL(10, 2) NOT NULL,
    `ai_provider` VARCHAR(50) NULL,
    `ai_model` VARCHAR(100) NULL,
    `ai_raw_response` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `nutrition_records_meal_entry_id_key`(`meal_entry_id`),
    INDEX `nutrition_records_meal_entry_id_idx`(`meal_entry_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `meal_entries` ADD CONSTRAINT `meal_entries_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `nutrition_records` ADD CONSTRAINT `nutrition_records_meal_entry_id_fkey` FOREIGN KEY (`meal_entry_id`) REFERENCES `meal_entries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
