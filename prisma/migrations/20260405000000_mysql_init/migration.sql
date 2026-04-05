-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `whatsapp_accounts` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phoneNumber` VARCHAR(191) NOT NULL,
    `phoneNumberId` VARCHAR(191) NOT NULL,
    `wabaId` VARCHAR(191) NOT NULL,
    `accessToken` TEXT NOT NULL,
    `appSecret` TEXT NOT NULL,
    `verifyToken` TEXT NOT NULL,
    `chatwootInboxId` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `whatsapp_accounts_phoneNumberId_key`(`phoneNumberId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `webhook_destinations` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'custom',
    `url` TEXT NOT NULL,
    `headers` TEXT NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `account_destinations` (
    `id` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `destinationId` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `account_destinations_accountId_destinationId_key`(`accountId`, `destinationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `messages` (
    `id` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `direction` VARCHAR(191) NOT NULL,
    `waMessageId` VARCHAR(191) NULL,
    `fromNumber` VARCHAR(191) NULL,
    `toNumber` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL,
    `content` JSON NOT NULL,
    `mediaLocalPath` TEXT NULL,
    `mediaUrl` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'received',
    `rawPayload` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `messages_waMessageId_key`(`waMessageId`),
    INDEX `messages_accountId_createdAt_idx`(`accountId`, `createdAt`),
    INDEX `messages_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `delivery_attempts` (
    `id` VARCHAR(191) NOT NULL,
    `messageId` VARCHAR(191) NOT NULL,
    `destinationId` VARCHAR(191) NOT NULL,
    `attemptNumber` INTEGER NOT NULL DEFAULT 1,
    `status` VARCHAR(191) NOT NULL,
    `statusCode` INTEGER NULL,
    `responseBody` TEXT NULL,
    `errorMessage` TEXT NULL,
    `nextRetryAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `delivery_attempts_status_nextRetryAt_idx`(`status`, `nextRetryAt`),
    INDEX `delivery_attempts_messageId_idx`(`messageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `account_destinations` ADD CONSTRAINT `account_destinations_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `whatsapp_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `account_destinations` ADD CONSTRAINT `account_destinations_destinationId_fkey` FOREIGN KEY (`destinationId`) REFERENCES `webhook_destinations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `whatsapp_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `delivery_attempts` ADD CONSTRAINT `delivery_attempts_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `messages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `delivery_attempts` ADD CONSTRAINT `delivery_attempts_destinationId_fkey` FOREIGN KEY (`destinationId`) REFERENCES `webhook_destinations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
