import { relations } from 'drizzle-orm';
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

// テーブル定義
// テーブル名: student
// 生徒を管理するテーブル
const student = sqliteTable('student', {
	student_uuid: text('student_uuid').primaryKey().notNull(),
	student_id: integer('student_id').notNull().unique(),
	device_id: text('device_id').notNull().unique(),
	name: text('name').notNull(),
});

// テーブル名: teacher
// 教師を管理するテーブル
const teacher = sqliteTable('teacher', {
	teacher_uuid: text('teacher_uuid').primaryKey().notNull(),
	teacher_id: integer('teacher_id').notNull().unique(),
	name: text('name').notNull(),
});

// テーブル名: lesson
// 授業を管理するテーブル
const lesson = sqliteTable('lesson', {
	lesson_uuid: text('lesson_uuid').primaryKey().notNull(),
	name: text('name').notNull(),
	teacher_uuid: text('teacher_uuid')
		.references(() => teacher.teacher_uuid)
		.notNull(),
	status: integer('status').notNull().default(0),
});

// テーブル名: regilesson
// 登録された授業を管理するテーブル
const regilesson = sqliteTable('regilesson', {
	regilesson_uuid: text('regilesson_uuid').primaryKey().notNull(),
	student_uuid: text('student_uuid')
		.notNull()
		.references(() => student.student_uuid),
	lesson_uuid: text('lesson_uuid')
		.notNull()
		.references(() => lesson.lesson_uuid),
});

// テーブル名: attendance
// 出席を管理するテーブル
const attendance = sqliteTable('attendance', {
	attendance_uuid: text('attendance_uuid').primaryKey().notNull(),
	student_uuid: text('student_uuid')
		.notNull()
		.references(() => student.student_uuid),
	lesson_uuid: text('lesson_uuid')
		.notNull()
		.references(() => lesson.lesson_uuid),
	status: integer('status').notNull(),
});

// 生徒の持つリレーション
const student_relation = relations(student, ({ many }) => ({
	regilessons: many(regilesson),
	attendances: many(attendance),
}));

// 教師の持つリレーション
const teacher_relation = relations(teacher, ({ many }) => ({
	lessons: many(lesson),
}));

// 授業の持つリレーション
const lesson_relation = relations(lesson, ({ one, many }) => ({
	posts: many(attendance),
	teacher: one(teacher, {
		fields: [lesson.teacher_uuid],
		references: [teacher.teacher_uuid],
	}),
}));

// 登録された授業の持つリレーション
const regilesson_relation = relations(regilesson, ({ one }) => ({
	student: one(student, {
		fields: [regilesson.student_uuid],
		references: [student.student_uuid],
	}),
	lesson: one(lesson, {
		fields: [regilesson.lesson_uuid],
		references: [lesson.lesson_uuid],
	}),
}));

// 出席の持つリレーション
const attendance_relation = relations(attendance, ({ one }) => ({
	student: one(student, {
		fields: [attendance.student_uuid],
		references: [student.student_uuid],
	}),
	lesson: one(lesson, {
		fields: [attendance.lesson_uuid],
		references: [lesson.lesson_uuid],
	}),
}));

export {
	student,
	teacher,
	lesson,
	regilesson,
	attendance,
	student_relation,
	teacher_relation,
	lesson_relation,
	regilesson_relation,
	attendance_relation,
};
