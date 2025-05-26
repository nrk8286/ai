CREATE TABLE `Chat` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`title` text NOT NULL,
	`userId` text NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `Document` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`title` text NOT NULL,
	`content` text,
	`kind` text DEFAULT 'text' NOT NULL,
	`userId` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `Message_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`chatId` text NOT NULL,
	`role` text NOT NULL,
	`parts` text NOT NULL,
	`attachments` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`chatId`) REFERENCES `Chat`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `Message` (
	`id` text PRIMARY KEY NOT NULL,
	`chatId` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`chatId`) REFERENCES `Chat`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `Suggestion` (
	`id` text PRIMARY KEY NOT NULL,
	`documentId` text NOT NULL,
	`documentCreatedAt` integer NOT NULL,
	`originalText` text NOT NULL,
	`suggestedText` text NOT NULL,
	`description` text,
	`isResolved` integer DEFAULT 0 NOT NULL,
	`userId` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`documentId`) REFERENCES `Document`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `User` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password` text
);
--> statement-breakpoint
CREATE TABLE `Vote_v2` (
	`chatId` text NOT NULL,
	`messageId` text NOT NULL,
	`isUpvoted` integer NOT NULL,
	FOREIGN KEY (`chatId`) REFERENCES `Chat`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`messageId`) REFERENCES `Message_v2`(`id`) ON UPDATE no action ON DELETE no action
);
