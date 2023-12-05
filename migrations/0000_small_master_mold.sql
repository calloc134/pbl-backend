CREATE TABLE `attendances` (
	`attendance_uuid` text PRIMARY KEY NOT NULL,
	`student_uuid` text NOT NULL,
	`lesson_uuid` text NOT NULL,
	`status` integer NOT NULL,
	FOREIGN KEY (`student_uuid`) REFERENCES `students`(`student_uuid`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lesson_uuid`) REFERENCES `lessons`(`lesson_uuid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `join_lessons` (
	`join_lesson_uuid` text PRIMARY KEY NOT NULL,
	`student_uuid` text NOT NULL,
	`lesson_uuid` text NOT NULL,
	FOREIGN KEY (`student_uuid`) REFERENCES `students`(`student_uuid`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lesson_uuid`) REFERENCES `lessons`(`lesson_uuid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `lessons` (
	`lesson_uuid` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`teacher_uuid` text NOT NULL,
	`status` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`teacher_uuid`) REFERENCES `teachers`(`teacher_uuid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `students` (
	`student_uuid` text PRIMARY KEY NOT NULL,
	`student_id` integer NOT NULL,
	`device_id` text NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `teachers` (
	`teacher_uuid` text PRIMARY KEY NOT NULL,
	`teacher_id` integer NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `students_student_id_unique` ON `students` (`student_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `students_device_id_unique` ON `students` (`device_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `teachers_teacher_id_unique` ON `teachers` (`teacher_id`);