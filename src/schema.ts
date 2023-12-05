import { relations } from 'drizzle-orm';
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

// テーブル定義

// 生徒テーブル
// テーブル名: students
// カラム: id, name, device_id

// 教師テーブル
// テーブル名: teachers
// カラム: id, name

// 授業テーブル
// テーブル名: lessons
// カラム: id, name, teacher_id

// 出席テーブル
// テーブル名: attendances
// カラム: id, student_id, lesson_id, status

// テーブル定義
// テーブル名: students
const students = sqliteTable('students', {
	student_uuid: text('student_uuid').primaryKey().notNull(),
	student_id: integer('student_id').notNull().unique(),
	device_id: text('device_id').notNull().unique(),
	name: text('name').notNull(),
});

// テーブル名: teachers
const teachers = sqliteTable('teachers', {
	teacher_uuid: text('teacher_uuid').primaryKey().notNull(),
	teacher_id: integer('teacher_id').notNull().unique(),
	name: text('name').notNull(),
});

// テーブル名: lessons
const lessons = sqliteTable('lessons', {
	lesson_uuid: text('lesson_uuid').primaryKey().notNull(),
	name: text('name').notNull(),
	teacher_uuid: text('teacher_uuid')
		.references(() => teachers.teacher_uuid)
		.notNull(),
	status: integer('status').notNull().default(0),
});

// 授業と教師の関係
const teacher_lessons = relations(lessons, ({ one }) => ({
	teacher_lessons: one(teachers, {
		fields: [lessons.teacher_uuid],
		references: [teachers.teacher_uuid],
	}),
}));

// テーブル名: join_lessons
// 履修登録を行うテーブル
const join_lessons = sqliteTable('join_lessons', {
	join_lesson_uuid: text('join_lesson_uuid').primaryKey().notNull(),
	student_uuid: text('student_uuid')
		.notNull()
		.references(() => students.student_uuid),
	lesson_uuid: text('lesson_uuid')
		.notNull()
		.references(() => lessons.lesson_uuid),
});

// 生徒と履修登録の関係
const student_join_lessons = relations(join_lessons, ({ one }) => ({
	student_join_lessons: one(students, {
		fields: [join_lessons.student_uuid],
		references: [students.student_uuid],
	}),
}));

// 授業と履修登録の関係
const lesson_join_lessons = relations(join_lessons, ({ one }) => ({
	lesson_join_lessons: one(lessons, {
		fields: [join_lessons.lesson_uuid],
		references: [lessons.lesson_uuid],
	}),
}));

// テーブル名: attendances
const attendances = sqliteTable('attendances', {
	attendance_uuid: text('attendance_uuid').primaryKey().notNull(),
	student_uuid: text('student_uuid')
		.notNull()
		.references(() => students.student_uuid),
	lesson_uuid: text('lesson_uuid')
		.notNull()
		.references(() => lessons.lesson_uuid),
	status: integer('status').notNull(),
});

// 生徒と出席の関係
const student_attendances = relations(attendances, ({ one }) => ({
	student_attendances: one(students, {
		fields: [attendances.student_uuid],
		references: [students.student_uuid],
	}),
}));

// 授業と出席の関係
const lesson_attendances = relations(attendances, ({ one }) => ({
	lesson_attendances: one(lessons, {
		fields: [attendances.lesson_uuid],
		references: [lessons.lesson_uuid],
	}),
}));

export {
	students,
	teachers,
	lessons,
	attendances,
	join_lessons,
	teacher_lessons,
	student_join_lessons,
	lesson_join_lessons,
	student_attendances,
	lesson_attendances,
};
