CREATE TABLE `attendance` (
	`attendance_uuid` text PRIMARY KEY NOT NULL,
	`student_uuid` text NOT NULL,
	`lesson_uuid` text NOT NULL,
	`status` integer NOT NULL,
	FOREIGN KEY (`student_uuid`) REFERENCES `student`(`student_uuid`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lesson_uuid`) REFERENCES `lesson`(`lesson_uuid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `lesson` (
	`lesson_uuid` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`teacher_uuid` text NOT NULL,
	`status` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`teacher_uuid`) REFERENCES `teacher`(`teacher_uuid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `regilesson` (
	`regilesson_uuid` text PRIMARY KEY NOT NULL,
	`student_uuid` text NOT NULL,
	`lesson_uuid` text NOT NULL,
	FOREIGN KEY (`student_uuid`) REFERENCES `student`(`student_uuid`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lesson_uuid`) REFERENCES `lesson`(`lesson_uuid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `student` (
	`student_uuid` text PRIMARY KEY NOT NULL,
	`student_id` integer NOT NULL,
	`device_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `teacher` (
	`teacher_uuid` text PRIMARY KEY NOT NULL,
	`teacher_id` integer NOT NULL,
	`name` text NOT NULL,
	`password` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `student_student_id_unique` ON `student` (`student_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `student_device_id_unique` ON `student` (`device_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `student_email_unique` ON `student` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `teacher_teacher_id_unique` ON `teacher` (`teacher_id`);