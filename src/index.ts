import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import {
	attendances,
	join_lessons,
	lesson_join_lessons,
	lessons,
	student_join_lessons,
	students,
	teacher_lessons,
	teachers,
} from './schema';
import { eq } from 'drizzle-orm';
import { ulid } from 'ulidx';

type Bindings = {
	DB: D1Database;
	KV: KVNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

// テスト用のエンドポイント
app.get('/', async (c) => {
	const db = drizzle(c.env.DB);
	const result = await db.select().from(students).all();
	return c.json(result, 200);
});

// 生徒は基本的に学籍番号IDでリクエストを行う
// UUIDは内部でのみ使用

// 生徒を追加する
// ペイロードとして、生徒の名前、生徒番号、デバイスIDを受け取る
app.post('/students', async (c) => {
	const db = drizzle(c.env.DB);
	const { name, student_id, device_id } = await c.req.json<{
		name: string;
		student_id: number;
		device_id: string;
	}>();

	console.debug('生徒の名前', name);
	console.debug('生徒番号', student_id);
	console.debug('デバイスID', device_id);

	// UUIDを生成する
	const student_ulidx = ulid();

	// データベースに生徒を追加する
	const result = await db.insert(students).values({ student_uuid: student_ulidx, name, student_id, device_id });

	// エラーがあればエラーを返す
	if (result.error) {
		return c.json(
			{
				error: result.error,
			},
			400
		);
	}

	return c.json(
		{
			student_uuid: student_ulidx,
		},
		200
	);
});

// 先生を追加する
// 先生も基本的に教員番号IDでリクエストを行う
// ペイロードとして、先生の名前、先生番号を受け取る
app.post('/teachers', async (c) => {
	const db = drizzle(c.env.DB);
	const { name, teacher_id } = await c.req.json<{
		name: string;
		teacher_id: number;
	}>();

	console.debug('先生の名前', name);
	console.debug('先生番号', teacher_id);

	// UUIDを生成する
	const teacher_ulidx = ulid();

	// データベースに先生を追加する
	const result = await db.insert(teachers).values({ teacher_uuid: teacher_ulidx, name, teacher_id });

	// エラーがあればエラーを返す
	if (result.error) {
		return c.json(
			{
				error: result.error,
			},
			400
		);
	}

	return c.json(
		{
			teacher_uuid: teacher_ulidx,
		},
		200
	);
});

// すべての生徒を取得する
app.get('/students', async (c) => {
	const db = drizzle(c.env.DB);
	const result = await db
		.select({
			student_uuid: students.student_uuid,
			student_id: students.student_id,
			name: students.name,
			device_id: students.device_id,
		})
		.from(students)
		.all();

	return c.json(result, 200);
});

// すべての先生を取得する
app.get('/teachers', async (c) => {
	const db = drizzle(c.env.DB, {
		schema: {
			teachers: teachers,
		},
	});
	const result = await db.query.teachers.findMany();

	return c.json(result, 200);
});

// 一人の生徒を取得する
// uuidで指定する
app.get('/students/:student_uuid', async (c) => {
	const db = drizzle(c.env.DB, {
		schema: {
			students: students,
		},
	});

	const student_uuid = c.req.param().student_uuid;
	const result = await db.query.students.findFirst({
		where: eq(students.student_uuid, student_uuid),
	});

	return c.json(result, 200);
});

// 一人の先生を取得する
// uuidで指定する
app.get('/teachers/:teacher_uuid', async (c) => {
	const db = drizzle(c.env.DB, {
		schema: {
			teachers: teachers,
		},
	});

	const teacher_uuid = c.req.param().teacher_uuid;
	const result = await db.query.teachers.findFirst({
		where: eq(teachers.teacher_uuid, teacher_uuid),
	});

	return c.json(result, 200);
});

// 授業を追加する
app.post('/lessons', async (c) => {
	const db = drizzle(c.env.DB);

	const { name, teacher_uuid } = await c.req.json<{
		name: string;
		teacher_uuid: string;
	}>();

	// UUIDを生成する
	const lesson_ulidx = ulid();

	// teacherテーブルからteacher_uuidを取得し、lessonsテーブルに追加する
	const result = await db.insert(lessons).values({ lesson_uuid: lesson_ulidx, name, teacher_uuid });

	// エラーがあればエラーを返す
	if (result.error) {
		return c.json(
			{
				error: result.error,
			},
			400
		);
	}

	return c.json(
		{
			lesson_uuid: lesson_ulidx,
		},
		200
	);
});

// 授業の詳細を取得する
// 教師の情報も取得する
app.get('/lessons/:lesson_uuid', async (c) => {
	const db = drizzle(c.env.DB, {
		schema: {
			lessons: lessons,
			teachers: teachers,
			lessons_teacher_lessons: teacher_lessons,
		},
	});

	const lesson_uuid = c.req.param().lesson_uuid;
	const result = await db.query.lessons.findFirst({
		where: eq(lessons.lesson_uuid, lesson_uuid),
		with: {
			teacher_lessons: true,
		},
	});

	return c.json(result, 200);
});

// 生徒が履修している授業の一覧を取得する
app.get('/students/:student_uuid/join-lessons', async (c) => {
	const db = drizzle(c.env.DB, {
		schema: {
			join_lessons: join_lessons,
			lessons: lessons,
			lessons_join_lessons: lesson_join_lessons,
		},
	});

	const student_uuid = c.req.param().student_uuid;

	const result = await db.query.join_lessons.findMany({
		where: eq(join_lessons.student_uuid, student_uuid),
		with: {
			lesson_join_lessons: true,
		},
	});

	return c.json(result, 200);
});

// 生徒の授業毎の出席状況を取得する
app.get('/students/:student_uuid/attendances', async (c) => {
	const db = drizzle(c.env.DB);
	const student_uuid = c.req.param().student_uuid;
	const result = await db
		.select({
			attendance_uuid: attendances.attendance_uuid,
			student_uuid: attendances.student_uuid,
			lesson_uuid: attendances.lesson_uuid,
			status: attendances.status,
		})
		.from(attendances)
		.where(eq(attendances.student_uuid, student_uuid));

	return c.json(result, 200);
});

// 特定の授業の、生徒毎の出席状況を取得する
app.get('/lessons/:lesson_uuid/attendances', async (c) => {
	const db = drizzle(c.env.DB);
	const lesson_uuid = c.req.param().lesson_uuid;
	const result = await db
		.select({
			attendance_uuid: attendances.attendance_uuid,
			student_uuid: attendances.student_uuid,
			lesson_uuid: attendances.lesson_uuid,
			status: attendances.status,
		})
		.from(attendances)
		.where(eq(attendances.lesson_uuid, lesson_uuid));

	return c.json(result, 200);
});

// 生徒が履修を登録する
app.post('/join-lessons', async (c) => {
	const db = drizzle(c.env.DB);

	const { student_uuid, lesson_uuid } = await c.req.json<{
		student_uuid: string;
		lesson_uuid: string;
	}>();

	// UUIDを生成する
	const join_lesson_ulidx = ulid();

	// データベースに履修を登録する
	const result = await db.insert(join_lessons).values({ join_lesson_uuid: join_lesson_ulidx, student_uuid, lesson_uuid });

	// エラーがあればエラーを返す
	if (result.error) {
		return c.json(
			{
				error: result.error,
			},
			400
		);
	}

	return c.json(
		{
			join_lesson_uuid: join_lesson_ulidx,
		},
		200
	);
});

// 授業を開始する
app.post('/lessons/:lesson_uuid/start', async (c) => {
	const db = drizzle(c.env.DB);
	const lesson_uuid = c.req.param().lesson_uuid;
	const result = await db.update(lessons).set({ status: 1 }).where(eq(lessons.lesson_uuid, lesson_uuid)).execute();

	console.debug('授業を開始する', result);

	if (result.error) {
		return c.json(
			{
				error: result.error,
			},
			400
		);
	}

	return c.json({
		message: 'ok',
	});
});

// 出席リクエストを受信する
// デバイスIDのリストを受け取ることになる
app.post('/attendances-endpoint', async (c) => {
	const db = drizzle(c.env.DB);
	const { device_ids } = await c.req.json<{
		device_ids: string[];
	}>();

	// 開講している授業を取得する
	const lesson_list = await db.select().from(lessons).where(eq(lessons.status, 1)).all();

	// 開講している授業がなければエラーを返す
	if (lesson_list.length === 0) {
		console.error('開講している授業がない');
		return c.json(
			{
				error: 'lesson not found',
			},
			404
		);
	}

	// 開講している授業が複数あればそれぞれに対して出席状況を更新する
	for (const lesson of lesson_list) {
		// 授業のUUIDを取得する
		const lesson_uuid = lesson.lesson_uuid;

		console.debug('授業のUUID', lesson_uuid);

		console.debug('デバイスIDのリスト', device_ids);

		// それぞれに対してkvストアを更新する
		for (const device_id of device_ids) {
			const attendance_key = `attendance:${lesson_uuid}:${device_id}`;
			console.debug('出席情報のキー', attendance_key);
			await c.env.KV.put(attendance_key, 'true');
		}
	}

	return c.json(
		{
			message: 'ok',
		},
		200
	);
});

// キーバリューストアが正常に動作するかを確認するためのエンドポイント
app.get('/kv-test', async (c) => {
	const device_id = 'test';

	const attendance_key = `attendance:test:${device_id}`;

	// 値を導入
	await c.env.KV.put(attendance_key, 'true');

	// 値を取得
	const attendance = await c.env.KV.get(attendance_key);

	if (!attendance) {
		return c.json(
			{
				message: 'kv test failed',
			},
			400
		);
	}

	return c.json(
		{
			message: attendance,
		},
		200
	);
});

// 授業を終了する
app.post('/lessons/:lesson_uuid/end', async (c) => {
	const db = drizzle(c.env.DB, {
		schema: {
			join_lessons: join_lessons,
			students: students,
			student_join_lessons: student_join_lessons,
		},
	});

	const lesson_uuid = c.req.param().lesson_uuid;

	// キーバリューストアからデバイスIDのリストを取得する
	console.debug('キーバリューストアからデバイスIDのリストを取得する');

	const device_id_kv_list = await c.env.KV.list({ prefix: `attendance:${lesson_uuid}` });

	console.debug('キーバリューストアから取得したデバイスIDのリスト', device_id_kv_list);

	const device_id_list = device_id_kv_list.keys.map((key) => {
		return {
			name: key.name.split(':')[2],
		};
	});

	console.debug('デバイスIDのリスト', device_id_list);

	// 次に、授業に紐づいている生徒のIDのリストを取得する
	const student_list = await db.query.join_lessons.findMany({
		where: eq(join_lessons.lesson_uuid, lesson_uuid),
		with: {
			student_join_lessons: true,
		},
	});

	// デバイスIDから生徒のIDを取得してそれらで出席情報をinsertするクエリ呼び出し
	const data = student_list.map((student) => {
		const student_uuid = student.student_uuid;
		const device_id = device_id_list.find((device_id) => device_id.name === student.student_join_lessons.device_id);
		const attendance_ulidx = ulid();
		return {
			attendance_uuid: attendance_ulidx,
			student_uuid,
			lesson_uuid,
			status: device_id ? 1 : -1,
		};
	});
	await db.insert(attendances).values(data).execute();

	// 授業のステータスを終了にする
	await db.update(lessons).set({ status: 2 }).where(eq(lessons.lesson_uuid, lesson_uuid)).execute();

	return c.json(
		{
			message: 'ok',
		},
		200
	);
});

export default app;
