import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import {
	student,
	teacher,
	lesson,
	regilesson,
	attendance,
	// student_relation,
	teacher_relation,
	lesson_relation,
	regilesson_relation,
	attendance_relation,
} from './schema';
import { and, eq, inArray, or } from 'drizzle-orm';
import { ulid } from 'ulidx';
import { jwt, sign } from 'hono/jwt';
import { cors } from 'hono/cors';
import { compare, genSalt, hash } from 'bcryptjs';
import { sendAttendeeEmail } from './util';
import { allow_path_list, student_path_list, teacher_path_list } from './path_list';

type Bindings = {
	DB: D1Database;
	KV: KVNamespace;
	RESEND_API_KEY: string;
	JWT_SECRET_KEY: string;
};

type JWTPayload = {
	type: 'student' | 'teacher';
	student_uuid?: string;
	teacher_uuid?: string;
	name: string;
};

const app_hono = new Hono<{ Bindings: Bindings }>();

// テスト用のエンドポイント
app_hono.get('/', async (c) => {
	const db = drizzle(c.env.DB, {
		schema: {
			student: student,
		},
	});
	const result = await db.query.student.findMany({
		// カラムはstudent_id, nameのみを取得する
		columns: {
			student_id: true,
			name: true,
		},
	});
	return c.json(result, 200);
});

app_hono.use(
	'*',
	cors({
		origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'https://pbl-page.pages.dev'],
		allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
		allowHeaders: ['Authorization', 'Content-Type'],
		exposeHeaders: ['Authorization'],
		maxAge: 86400,
	})
);

// 認証を設定するミドルウェア
app_hono.use('*', async (c, next) => {
	console.debug('[*] 認証を設定するミドルウェアを実行しています。');
	// 認証の必要ないエンドポイントはスキップする
	const path = c.req.path;

	// もしオブジェクトにパスが存在し、かつメソッドが一致する場合はスキップする
	if (allow_path_list.some((allow_path) => allow_path.path === path && allow_path.method === c.req.method)) {
		// 認証をスキップする
		console.log('[*] 認証をスキップします。');
		await next();
		return;
	}

	// 認証を行う
	await jwt({
		secret: c.env.JWT_SECRET_KEY,
		alg: 'HS256',
	})(c, async () => {});
	// ペイロードを取得する
	const payload = c.get('jwtPayload') as JWTPayload;

	console.debug('[*] ペイロードを表示します。', payload);

	if (payload.type === 'student') {
		console.debug('[*] 生徒として認証します。');
		// 生徒としてアクセスできるエンドポイントのみ許可する
		if (!student_path_list.some((student_path) => student_path.path === path && student_path.method === c.req.method)) {
			console.debug('[!] 生徒としてアクセスできないエンドポイントです。');
			return c.json(
				{
					error: '生徒としてアクセスできないエンドポイントです',
				},
				403
			);
		}
	} else if (payload.type === 'teacher') {
		console.debug('[*] 教師として認証します。');
		// 教師としてアクセスできるエンドポイントのみ許可する
		if (!teacher_path_list.some((teacher_path) => teacher_path.path === path && teacher_path.method === c.req.method)) {
			console.debug('[!] 教師としてアクセスできないエンドポイントです。');
			return c.json(
				{
					error: '教師としてアクセスできないエンドポイントです',
				},
				403
			);
		}
	} else {
		console.debug('[!] 認証に失敗しました。');
		return c.json(
			{
				error: '認証に失敗しました',
			},
			403
		);
	}

	console.debug('[*] 認証に成功しました。');
	// 処理を続行する
	await next();
});

// 生徒は基本的に学籍番号IDでリクエストを行う
// UUIDは内部でのみ使用

// 生徒を追加する
// ペイロードとして、生徒の名前、生徒番号、デバイスIDを受け取る
app_hono.post('/students', async (c) => {
	const db = drizzle(c.env.DB);
	const { name, student_id, device_id, email, password } = await c.req.json<{
		name: string;
		student_id: number;
		device_id: string;
		email: string;
		password: string;
	}>();

	console.debug('[*] 生徒の名前', name);
	console.debug('[*] 生徒番号', student_id);
	console.debug('[*] デバイスID', device_id);

	// UUIDを生成する
	const student_ulid = ulid();

	// パスワードを生成する
	const password_hash = await hash(password, 8);

	// データベースに生徒を追加する
	const result = await db.insert(student).values({ student_uuid: student_ulid, name, student_id, device_id, email, password_hash });

	// エラーがあればエラーを返す
	if (result.error) {
		console.error('[!] 生徒の追加に失敗しました。', result.error);
		return c.json(
			{
				error: '生徒の追加に失敗しました',
			},
			400
		);
	}

	return c.json(
		{
			student_uuid: student_ulid,
		},
		200
	);
});

// 教師を追加する
// 教師も基本的に教員番号IDでリクエストを行う
// ペイロードとして、教師の名前、教師番号を受け取る
app_hono.post('/teachers', async (c) => {
	const db = drizzle(c.env.DB);
	const { name, teacher_id, password } = await c.req.json<{
		name: string;
		teacher_id: number;
		password: string;
	}>();

	console.debug('[*] 教師の名前', name);
	console.debug('[*] 教員番号', teacher_id);

	// UUIDを生成する
	const teacher_ulid = ulid();

	// パスワードを生成する
	const password_hash = await hash(password, await genSalt());

	// データベースに教師を追加する
	const result = await db.insert(teacher).values({ teacher_uuid: teacher_ulid, name, teacher_id, password_hash });

	// エラーがあればエラーを返す
	if (result.error) {
		console.error('[!] 教師の追加に失敗しました。', result.error);
		return c.json(
			{
				error: '教師の追加に失敗しました',
			},
			400
		);
	}

	return c.json(
		{
			teacher_uuid: teacher_ulid,
		},
		200
	);
});

// [認証なし] 生徒としてログインするエンドポイント
app_hono.post('/students/login', async (c) => {
	const db = drizzle(c.env.DB, {
		schema: {
			student: student,
		},
	});

	// ペイロードとして、生徒番号とパスワードを受け取る
	const { student_id, password } = await c.req.json<{
		student_id: number;
		password: string;
	}>();

	// 生徒番号から生徒を取得する
	const result = await db.query.student.findFirst({
		where: eq(student.student_id, student_id),
		columns: {
			student_uuid: true,
			name: true,
			password_hash: true,
		},
	});

	if (!result) {
		console.debug('[!] 生徒が存在しません。');
		return c.json(
			{
				error: '生徒が存在しません',
			},
			404
		);
	}

	// パスワードが一致するか確認する
	const is_match = await compare(password, result.password_hash);

	// パスワードが一致しなければエラーを返す
	if (!is_match) {
		console.debug('[!]パスワードが一致しません。');
		return c.json(
			{
				error: 'パスワードが一致しません',
			},
			400
		);
	}

	// JWTを生成する
	const token = await sign(
		{
			type: 'student',
			student_uuid: result.student_uuid,
			name: result.name,
		},
		c.env.JWT_SECRET_KEY,
		'HS256'
	);

	// JWTを付与
	c.header('Authorization', `Bearer ${token}`);

	return c.json(
		{
			message: '認証に成功しました',
		},
		200
	);
});

// [認証なし] 教師としてログインするエンドポイント
app_hono.post('/teachers/login', async (c) => {
	const db = drizzle(c.env.DB, {
		schema: {
			teacher: teacher,
		},
	});

	// ペイロードとして、教員番号とパスワードを受け取る
	const { teacher_id, password } = await c.req.json<{
		teacher_id: number;
		password: string;
	}>();

	// 教員番号から教員を取得する
	const result = await db.query.teacher.findFirst({
		where: eq(teacher.teacher_id, teacher_id),
		columns: {
			teacher_uuid: true,
			name: true,
			password_hash: true,
		},
	});

	if (!result) {
		console.debug('[!] 教員が存在しません。');
		return c.json(
			{
				error: '教員が存在しません',
			},
			404
		);
	}

	// パスワードが一致するか確認する
	const is_match = await compare(password, result.password_hash);

	// パスワードが一致しなければエラーを返す
	if (!is_match) {
		console.debug('[!]パスワードが一致しません。');
		return c.json(
			{
				error: 'パスワードが一致しません',
			},
			400
		);
	}

	// JWTを生成する
	const token = await sign(
		{
			type: 'teacher',
			teacher_uuid: result.teacher_uuid,
			name: result.name,
		},
		c.env.JWT_SECRET_KEY,
		'HS256'
	);

	// JWTを付与
	c.header('Authorization', `Bearer ${token}`);

	return c.json(
		{
			message: '認証に成功しました',
		},
		200
	);
});

// [認証生徒] 自身を取得する
app_hono.get('/students/me', async (c) => {
	const payload = c.get('jwtPayload') as JWTPayload;

	if (payload.type !== 'student') {
		console.debug('[!] ログインユーザが生徒ではありません。');
		return c.json(
			{
				error: 'ログインユーザが生徒ではありません',
			},
			403
		);
	}

	if (!payload.student_uuid) {
		console.debug('[!] 生徒が存在しません。');
		return c.json(
			{
				error: '生徒が存在しません',
			},
			403
		);
	}

	const db = drizzle(c.env.DB, {
		schema: {
			student: student,
		},
	});

	const result = await db.query.student.findFirst({
		where: eq(student.student_uuid, payload.student_uuid),
		columns: {
			student_uuid: true,
			student_id: true,
			name: true,
			device_id: true,
			email: true,
		},
	});

	if (!result) {
		console.debug('[!] 生徒が存在しません。');
		return c.json(
			{
				error: '生徒が存在しません',
			},
			404
		);
	}

	return c.json(result, 200);
});

// [認証教師] 自身を取得する
app_hono.get('/teachers/me', async (c) => {
	const payload = c.get('jwtPayload') as JWTPayload;

	if (payload.type !== 'teacher') {
		console.debug('[!] ログインユーザが教師ではありません。');
		return c.json(
			{
				error: 'ログインユーザが教師ではありません',
			},
			403
		);
	}

	if (!payload.teacher_uuid) {
		console.debug('[!] 教師が存在しません。');
		return c.json(
			{
				error: '教師が存在しません',
			},
			403
		);
	}

	const db = drizzle(c.env.DB, {
		schema: {
			teacher: teacher,
		},
	});

	const result = await db.query.teacher.findFirst({
		where: eq(teacher.teacher_uuid, payload.teacher_uuid),
		columns: {
			teacher_uuid: true,
			teacher_id: true,
			name: true,
		},
	});

	if (!result) {
		console.debug('[!] 教師が存在しません。');
		return c.json(
			{
				error: '教師が存在しません',
			},
			404
		);
	}

	return c.json(result, 200);
});

// [認証教師] 生徒の一覧を取得する
app_hono.get('/students', async (c) => {
	const db = drizzle(c.env.DB, {
		schema: {
			student: student,
		},
	});

	const result = await db.query.student.findMany({
		columns: {
			student_uuid: true,
			student_id: true,
			name: true,
			email: true,
			device_id: true,
		},
	});

	return c.json(result, 200);
});

// [認証教師] 教師の一覧を取得する
app_hono.get('/teachers', async (c) => {
	const db = drizzle(c.env.DB, {
		schema: {
			teacher: teacher,
		},
	});
	const result = await db.query.teacher.findMany({
		columns: {
			teacher_uuid: true,
			teacher_id: true,
			name: true,
		},
	});

	return c.json(result, 200);
});

// [認証教師] 特定の生徒を取得する
// uuidで指定する
app_hono.get('/students/:student_uuid', async (c) => {
	const db = drizzle(c.env.DB, {
		schema: {
			student: student,
		},
	});

	const student_uuid = c.req.param().student_uuid;
	const result = await db.query.student.findFirst({
		where: eq(student.student_uuid, student_uuid),
		columns: {
			student_uuid: true,
			student_id: true,
			name: true,
			email: true,
			device_id: true,
		},
	});

	if (!result) {
		console.debug('[!] 生徒が存在しません。');
		return c.json(
			{
				error: '生徒が存在しません',
			},
			404
		);
	}

	return c.json(result, 200);
});

// [認証教師] 特定の教師を取得する
// uuidで指定する
app_hono.get('/teachers/:teacher_uuid', async (c) => {
	const db = drizzle(c.env.DB, {
		schema: {
			teacher: teacher,
		},
	});

	const teacher_uuid = c.req.param().teacher_uuid;
	const result = await db.query.teacher.findFirst({
		where: eq(teacher.teacher_uuid, teacher_uuid),
		columns: {
			teacher_uuid: true,
			teacher_id: true,
			name: true,
		},
	});

	if (!result) {
		console.debug('[!] 教師が存在しません。');
		return c.json(
			{
				error: '教師が存在しません',
			},
			404
		);
	}

	return c.json(result, 200);
});

// [認証教師] 授業を追加する
app_hono.post('/lessons', async (c) => {
	const payload = c.get('jwtPayload') as JWTPayload;

	if (payload.type !== 'teacher') {
		console.debug('[!] ログインユーザが教師ではありません。');
		return c.json(
			{
				error: 'ログインユーザが教師ではありません',
			},
			403
		);
	}

	if (!payload.teacher_uuid) {
		console.debug('[!] 教師が存在しません。');
		return c.json(
			{
				error: '教師が存在しません',
			},
			403
		);
	}

	// ログイン教師のUUIDを取得する
	const teacher_uuid = payload.teacher_uuid;

	const db = drizzle(c.env.DB);

	const { name } = await c.req.json<{
		name: string;
	}>();

	// UUIDを生成する
	const lesson_ulid = ulid();

	// teacherテーブルからteacher_uuidを取得し、lessonsテーブルに追加する
	const result = await db.insert(lesson).values({ lesson_uuid: lesson_ulid, name, teacher_uuid });

	// エラーがあればエラーを返す
	if (result.error) {
		console.error('[!] 授業の追加に失敗しました。', result.error);
		return c.json(
			{
				error: '授業の追加に失敗しました',
			},
			400
		);
	}

	return c.json(
		{
			lesson_uuid: lesson_ulid,
		},
		200
	);
});

// [認証教師] 自身の受け持つ授業の一覧を取得する
app_hono.get('/teachers/me/lessons', async (c) => {
	const payload = c.get('jwtPayload') as JWTPayload;

	if (payload.type !== 'teacher') {
		console.debug('[!] ログインユーザが教師ではありません。');
		return c.json(
			{
				error: 'ログインユーザが教師ではありません',
			},
			403
		);
	}

	if (!payload.teacher_uuid) {
		console.debug('[!] 教師が存在しません。');
		return c.json(
			{
				error: '教師が存在しません',
			},
			403
		);
	}

	const db = drizzle(c.env.DB, {
		schema: {
			lesson: lesson,
			teacher: teacher,
			teacher_relation: teacher_relation,
		},
	});

	const result = await db.query.lesson.findMany({
		where: eq(lesson.teacher_uuid, payload.teacher_uuid),
		columns: {
			lesson_uuid: true,
			teacher_uuid: true,
			name: true,
			status: true,
		},
	});

	return c.json(result, 200);
});

// [認証生徒][認証教師] 特定の授業を取得する
// 教師の情報も取得する
app_hono.get('/lessons/:lesson_uuid', async (c) => {
	const db = drizzle(c.env.DB, {
		schema: {
			lesson: lesson,
			teacher: teacher,
			lesson_relation: lesson_relation,
		},
	});

	const lesson_uuid = c.req.param().lesson_uuid;
	const result = await db.query.lesson.findFirst({
		where: eq(lesson.lesson_uuid, lesson_uuid),
		columns: {
			lesson_uuid: true,
			name: true,
			status: true,
		},
		with: {
			teacher: true,
		},
	});

	if (!result) {
		console.debug('[!] 授業が存在しません。');
		return c.json(
			{
				error: '授業が存在しません',
			},
			404
		);
	}

	return c.json(result, 200);
});

// [認証教師] 特定の教師の授業の一覧を取得する
app_hono.get('/teachers/:teacher_uuid/lessons', async (c) => {
	const db = drizzle(c.env.DB, {
		schema: {
			lesson: lesson,
			teacher: teacher,
			lesson_relation: lesson_relation,
		},
	});

	const teacher_uuid = c.req.param().teacher_uuid;
	const result = await db.query.lesson.findMany({
		where: eq(lesson.teacher_uuid, teacher_uuid),
		columns: {
			lesson_uuid: true,
			name: true,
			status: true,
		},
		with: {
			teacher: true,
		},
	});

	return c.json(result, 200);
});

// [認証生徒] 自分の履修している授業の一覧を取得する
app_hono.get('/students/me/join-lessons', async (c) => {
	const payload = c.get('jwtPayload') as JWTPayload;

	if (payload.type !== 'student') {
		console.debug('[!] ログインユーザが生徒ではありません。');
		return c.json(
			{
				error: 'ログインユーザが生徒ではありません',
			},
			403
		);
	}

	if (!payload.student_uuid) {
		console.debug('[!] 生徒が存在しません。');
		return c.json(
			{
				error: '生徒が存在しません',
			},
			403
		);
	}

	const db = drizzle(c.env.DB, {
		schema: {
			regilesson: regilesson,
			regilesson_relation: regilesson_relation,
			lesson: lesson,
			lesson_relation: lesson_relation,
			teacher: teacher,
			teacher_relation: teacher_relation,
		},
	});

	const result = await db.query.regilesson.findMany({
		where: eq(regilesson.student_uuid, payload.student_uuid),
		columns: {
			regilesson_uuid: true,
		},
		with: {
			lesson: {
				columns: {
					lesson_uuid: true,
					name: true,
					status: true,
				},
				with: {
					teacher: true,
				},
			},
		},
	});

	return c.json(result, 200);
});

// [認証教師] 特定の生徒の履修している授業の一覧を取得する
app_hono.get('/students/:student_uuid/join-lessons', async (c) => {
	const db = drizzle(c.env.DB, {
		schema: {
			regilesson: regilesson,
			regilesson_relation: regilesson_relation,
			lesson: lesson,
			lesson_relation: lesson_relation,
			teacher: teacher,
			teacher_relation: teacher_relation,
		},
	});

	const student_uuid = c.req.param().student_uuid;

	const result = await db.query.regilesson.findMany({
		where: eq(regilesson.student_uuid, student_uuid),
		columns: {
			regilesson_uuid: true,
		},
		with: {
			lesson: {
				columns: {
					lesson_uuid: true,
					name: true,
					status: true,
				},
				with: {
					teacher: true,
				},
			},
		},
	});

	return c.json(result, 200);
});

// [認証生徒] 自分の出席状況を取得する
app_hono.get('/students/me/attendances', async (c) => {
	const payload = c.get('jwtPayload') as JWTPayload;

	if (payload.type !== 'student') {
		console.debug('[!] ログインユーザが生徒ではありません。');
		return c.json(
			{
				error: 'ログインユーザが生徒ではありません',
			},
			403
		);
	}

	if (!payload.student_uuid) {
		console.debug('[!] 生徒が存在しません。');
		return c.json(
			{
				error: '生徒が存在しません',
			},
			403
		);
	}

	const db = drizzle(c.env.DB, {
		schema: {
			attendance: attendance,
			attendance_relation: attendance_relation,
			lesson: lesson,
			lesson_relation: lesson_relation,
			teacher: teacher,
			teacher_relation: teacher_relation,
		},
	});

	const result = await db.query.attendance.findMany({
		where: eq(attendance.student_uuid, payload.student_uuid),
		columns: {
			attendance_uuid: true,
			status: true,
		},
		with: {
			lesson: {
				columns: {
					lesson_uuid: true,
					name: true,
					status: true,
				},
				with: {
					teacher: true,
				},
			},
		},
	});

	return c.json(result, 200);
});

// [認証教師] 特定の生徒の出席状況を取得する
app_hono.get('/students/:student_uuid/attendances', async (c) => {
	const db = drizzle(c.env.DB, {
		schema: {
			attendance: attendance,
			attendance_relation: attendance_relation,
			lesson: lesson,
			lesson_relation: lesson_relation,
			teacher: teacher,
			teacher_relation: teacher_relation,
		},
	});

	const student_uuid = c.req.param().student_uuid;
	const result = await db.query.attendance.findMany({
		where: eq(attendance.student_uuid, student_uuid),
		columns: {
			attendance_uuid: true,
			status: true,
		},
		with: {
			lesson: {
				columns: {
					lesson_uuid: true,
					name: true,
					status: true,
				},
				with: {
					teacher: true,
				},
			},
		},
	});

	return c.json(result, 200);
});

// [認証教師] 特定の授業の出席状況を取得する
app_hono.get('/lessons/:lesson_uuid/attendances', async (c) => {
	const db = drizzle(c.env.DB, {
		schema: {
			attendance: attendance,
			attendance_relation: attendance_relation,
			student: student,
		},
	});

	const lesson_uuid = c.req.param().lesson_uuid;
	const result = await db.query.attendance.findMany({
		where: eq(attendance.lesson_uuid, lesson_uuid),
		columns: {
			attendance_uuid: true,
			status: true,
		},
		with: {
			student: {
				columns: {
					name: true,
					student_uuid: true,
					student_id: true,
				},
			},
		},
	});

	return c.json(result, 200);
});

// [認証生徒] 授業に参加する
app_hono.post('/join-lessons', async (c) => {
	const payload = c.get('jwtPayload') as JWTPayload;

	if (payload.type !== 'student') {
		console.debug('[!] ログインユーザが生徒ではありません。');
		return c.json(
			{
				error: 'ログインユーザが生徒ではありません',
			},
			403
		);
	}

	if (!payload.student_uuid) {
		console.debug('[!] 生徒が存在しません。');
		return c.json(
			{
				error: '生徒が存在しません',
			},
			403
		);
	}

	// ログイン生徒のUUIDを取得する
	const student_uuid = payload.student_uuid;

	const db = drizzle(c.env.DB, {
		schema: {
			lesson: lesson,
		},
	});

	const { lesson_uuid } = await c.req.json<{
		lesson_uuid: string;
	}>();

	// UUIDを生成する
	const regilesson_ulid = ulid();

	// 該当する授業が存在するか確認する
	const lesson_detail = await db.query.lesson.findFirst({
		where: eq(lesson.lesson_uuid, lesson_uuid),
		columns: {
			status: true,
		},
	});

	if (!lesson_detail) {
		console.debug('[!] 授業が存在しません。');
		return c.json(
			{
				error: '授業が存在しません',
			},
			404
		);
	}

	// 授業が開講前でないときはエラーを返す
	if (lesson_detail.status !== 0) {
		console.debug('[!] 授業が開講前ではありません。');
		return c.json(
			{
				error: '授業が開講前ではありません',
			},
			403
		);
	}

	// データベースに履修を登録する
	const result = await db.insert(regilesson).values({ regilesson_uuid: regilesson_ulid, student_uuid, lesson_uuid });

	// エラーがあればエラーを返す
	if (result.error) {
		console.error('[!] 履修の追加に失敗しました。', result.error);
		return c.json(
			{
				error: '履修の追加に失敗しました',
			},
			400
		);
	}

	return c.json(
		{
			join_lesson_uuid: regilesson_ulid,
		},
		200
	);
});

// [認証教師] 特定の授業を開始する
app_hono.post('/lessons/start', async (c) => {
	const db = drizzle(c.env.DB, {
		schema: {
			lesson: lesson,
			regilesson: regilesson,
		},
	});
	const { lesson_uuid } = await c.req.json<{
		lesson_uuid: string;
	}>();

	// まず、JWTのペイロードを取得する
	const payload = c.get('jwtPayload') as JWTPayload;

	if (payload.type !== 'teacher') {
		console.debug('[!] ログインユーザが教師ではありません。');
		return c.json(
			{
				error: 'ログインユーザが教師ではありません',
			},
			403
		);
	}

	if (!payload.teacher_uuid) {
		console.debug('[!] 教師が存在しません。');
		return c.json(
			{
				error: '教師が存在しません',
			},
			403
		);
	}

	// 授業の内容を取得する
	const lesson_detail = await db.query.lesson.findFirst({
		where: eq(lesson.lesson_uuid, lesson_uuid),
		columns: {
			lesson_uuid: true,
			teacher_uuid: true,
			status: true,
		},
	});

	if (!lesson_detail) {
		console.debug('[!] 授業が存在しません。');
		return c.json(
			{
				error: '授業が存在しません',
			},
			404
		);
	}

	// 自身が紐づいている教師でない場合はエラーを返す
	if (lesson_detail.teacher_uuid !== payload.teacher_uuid) {
		console.debug('[!] 自身が担当していない授業です。');
		return c.json(
			{
				error: '自身が担当していない授業です',
			},
			403
		);
	}

	// すでに開始している授業の場合はエラーを返す
	if (lesson_detail.status !== 0) {
		console.debug('[!] すでに開始している授業です。');
		return c.json(
			{
				error: 'すでに開始している授業です',
			},
			403
		);
	}

	// 授業の状態を開始に変更する
	const result = await db.update(lesson).set({ status: 1 }).where(eq(lesson.lesson_uuid, lesson_uuid)).execute();

	if (result.error) {
		console.error('[!] 授業の開始に失敗しました。', result.error);
		return c.json(
			{
				error: '授業の開始に失敗しました',
			},
			400
		);
	}

	console.debug('[*] 授業を開始する', result);

	// 次に、出席テーブルをすべて初期化する
	// 当該授業に履修している生徒のリストを取得する
	// 次に、授業に紐づいている生徒のIDのリストを取得する
	const student_list = await db.query.regilesson.findMany({
		where: eq(regilesson.lesson_uuid, lesson_uuid),
		columns: {
			student_uuid: true,
		},
	});

	if (student_list.length !== 0) {
		console.debug('[*] 当該授業に履修している生徒のリスト', student_list);

		// 出席テーブルに追加するデータの生成
		const attendance_list = student_list.map((student) => {
			return {
				attendance_uuid: ulid(),
				student_uuid: student.student_uuid,
				lesson_uuid: lesson_uuid,
				status: 0,
			};
		});

		console.debug('[*] 出席テーブルに追加するデータ', attendance_list);

		// もし生徒がいれば出席テーブルを作成

		console.debug('[*] 出席テーブルを初期化します。');

		await db.insert(attendance).values(attendance_list).execute();

		if (result.error) {
			console.error('[!] 出席テーブルの初期化に失敗しました。', result.error);
			return c.json(
				{
					error: '出席テーブルの初期化に失敗しました',
				},
				400
			);
		}
	}

	return c.json({
		message: 'ok',
	});
});

// [認証なし] 出席リクエストを受信する
// デバイスIDのリストを受け取ることになる
app_hono.post('/attendances-endpoint', async (c) => {
	const db = drizzle(c.env.DB, {
		schema: {
			lesson: lesson,
		},
	});

	const { device_ids } = await c.req.json<{
		device_ids: string[];
	}>();

	// 開講している授業を取得する
	const lesson_list = await db.query.lesson.findMany({
		where: eq(lesson.status, 1),
		columns: {
			lesson_uuid: true,
		},
	});

	// 開講している授業がなければエラーを返す
	if (lesson_list.length === 0) {
		console.error('[!] 開講している授業がありません。');
		return c.json(
			{
				error: '開講している授業がありません',
			},
			404
		);
	}

	console.debug('[*] 開講している授業のリスト', lesson_list);

	// 開講している授業が複数あればそれぞれに対して出席状況を更新する
	for (const lesson of lesson_list) {
		// 授業のUUIDを取得する
		const lesson_uuid = lesson.lesson_uuid;

		console.debug('[*] 授業のUUID', lesson_uuid);

		console.debug('[*] デバイスIDのリスト', device_ids);

		// それぞれに対してkvストアを更新する
		for (const device_id of device_ids) {
			const attendance_key = `attendance:${lesson_uuid}:${device_id}`;
			console.debug('[*] 出席情報のキー', attendance_key);
			await c.env.KV.put(attendance_key, 'true');
		}
	}

	return c.json(
		{
			message: '出席リクエストを受け付けました',
		},
		200
	);
});

// [認証教師] 特定の授業を終了する
app_hono.post('/lessons/end', async (c) => {
	const db = drizzle(c.env.DB, {
		schema: {
			regilesson: regilesson,
			regilesson_relation: regilesson_relation,
			student: student,
			attendance: attendance,
			lesson: lesson,
		},
	});

	const { lesson_uuid } = await c.req.json<{
		lesson_uuid: string;
	}>();

	// キーバリューストアからデバイスIDのリストを取得する
	console.debug('[*] キーバリューストアからデバイスIDのリストを取得します。');

	const device_id_kv_list = await c.env.KV.list({ prefix: `attendance:${lesson_uuid}` });

	console.debug('[*] キーバリューストアから取得したデバイスIDのリスト', device_id_kv_list);

	const device_id_list = device_id_kv_list.keys.map((key) => {
		return {
			name: key.name.split(':')[2],
		};
	});

	console.debug('[*] デバイスIDのリスト', device_id_list);

	// 次に、授業に紐づいている生徒のIDのリストを取得する
	const student_list = await db.query.regilesson.findMany({
		where: eq(regilesson.lesson_uuid, lesson_uuid),
		columns: {},
		with: {
			student: {
				columns: {
					student_uuid: true,
					device_id: true,
				},
			},
		},
	});

	console.debug('[*] 授業に紐づいている生徒のIDのリスト', student_list);

	// また、出席が既に完了している生徒のリストを取得する
	const attendance_list = await db.query.attendance.findMany({
		where: and(eq(attendance.lesson_uuid, lesson_uuid), eq(attendance.status, 1)),
		columns: {
			student_uuid: true,
		},
	});

	console.debug('[*] 出席が既に完了している生徒のリスト', attendance_list);

	// 生徒のIDのリストとデバイスIDのリストを突合し、一致した生徒のリストを取得する
	// ただし、出席が既に完了している生徒は除外する
	const student_attendance_list = student_list.filter((student) => {
		return (
			// 該当するデバイスIDのリストに含まれているか
			device_id_list.some((device_id) => {
				return student.student.device_id === device_id.name;
			}) &&
			// かつ、出席がまだ完了していないか
			!attendance_list.some((attendance) => attendance.student_uuid === student.student.student_uuid)
		);
	});

	console.debug('[*] 今回出席した生徒のリスト', student_attendance_list);

	// もし出席した生徒がいれば出席テーブルを更新する

	if (student_attendance_list.length !== 0) {
		// 出席したことを登録する
		const result = await db
			.update(attendance)
			.set({ status: 1 })
			.where(
				inArray(
					attendance.student_uuid,
					student_attendance_list.map((student) => student.student.student_uuid)
				)
			)
			.execute();

		if (result.error) {
			console.error('[!] 出席の登録に失敗しました。', result.error);
			return c.json(
				{
					error: '出席の登録に失敗しました',
				},
				400
			);
		}
	}

	// ここまではバッチ処理と同じ処理であり、他の悪意ある教師によってリクエストされても許容される処理内容である

	// では、JWTのペイロードを取得する
	const payload = c.get('jwtPayload') as JWTPayload;

	if (payload.type !== 'teacher') {
		console.debug('[!] ログインユーザが教師ではありません。');
		return c.json(
			{
				error: 'ログインユーザが教師ではありません',
			},
			403
		);
	}

	if (!payload.teacher_uuid) {
		console.debug('[!] 教師が存在しません。');
		return c.json(
			{
				error: '教師が存在しません',
			},
			403
		);
	}

	// 授業の内容を取得する
	const lesson_detail = await db.query.lesson.findFirst({
		where: eq(lesson.lesson_uuid, lesson_uuid),
		columns: {
			lesson_uuid: true,
			teacher_uuid: true,
			status: true,
		},
	});

	if (!lesson_detail) {
		console.debug('[!] 授業が存在しません。');
		return c.json(
			{
				error: '授業が存在しません',
			},
			404
		);
	}

	// 自身が紐づいている教師でない場合はエラーを返す
	if (lesson_detail.teacher_uuid !== payload.teacher_uuid) {
		console.debug('[!] 自身が担当していない授業です。');
		return c.json(
			{
				error: '自身が担当していない授業です',
			},
			403
		);
	}

	// 現在開講されていない場合はエラーを返す
	if (lesson_detail.status !== 1) {
		console.debug('[!] 現在開講されていない授業です。');
		return c.json(
			{
				error: '現在開講されていない授業です',
			},
			403
		);
	}

	// 授業が終了するので、キーバリューストアからデバイスIDのリストを削除する
	// キーバリューストアからデバイスIDのリストを削除する
	for (const device_id of device_id_list) {
		const attendance_key = `attendance:${lesson_uuid}:${device_id.name}`;
		console.debug('[*] 出席情報のキー', attendance_key);
		await c.env.KV.delete(attendance_key);
	}

	// 授業の状態を終了に変更する
	const result_lesson = await db.update(lesson).set({ status: 2 }).where(eq(lesson.lesson_uuid, lesson_uuid)).execute();

	if (result_lesson.error) {
		console.error('[!] 授業の終了に失敗しました。', result_lesson.error);
		return c.json(
			{
				error: '授業の終了に失敗しました',
			},
			400
		);
	}

	// すでに出席していた生徒と、今回出席した生徒のリストを結合
	const student_nortification_list = student_attendance_list
		.map((student) => student.student.student_uuid)
		.concat(student_attendance_list.map((student) => student.student.student_uuid));

	// もし生徒がいればメール送信処理を行う
	if (student_nortification_list.length !== 0) {
		// 今回該当する生徒のリストを取得する
		const student_email_list = await db.query.student.findMany({
			where: inArray(student.student_uuid, student_nortification_list),
			columns: {
				email: true,
			},
		});

		console.debug('[*] 今回該当する生徒のリスト', student_nortification_list);

		// それぞれemailを送信する
		for (const student of student_email_list) {
			const email = student.email;
			const result = await fetch('https://api.resend.com/emails', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${c.env.RESEND_API_KEY}`,
				},
				body: JSON.stringify({
					from: 'calloc134 <calloc134@calloc.tech>',
					to: [email],
					subject: '出席が完了しました',
					text: '出席が完了しました',
				}),
			});

			if (result.status !== 200) {
				console.error('[!] メールの送信に失敗しました。');
				console.error(await result.text());
			}
		}
	}

	return c.json(
		{
			message: '授業を正常に終了しました',
		},
		200
	);
});

// スケジューリングされた関数
const scheduled = async (_: ScheduledEvent, env: Bindings, __: ExecutionContext) => {
	const db = drizzle(env.DB, {
		schema: {
			regilesson: regilesson,
			regilesson_relation: regilesson_relation,
			student: student,
			lesson: lesson,
			attendance: attendance,
		},
	});

	// 現在開講されている授業を取得する
	const lesson_list = await db.query.lesson.findMany({
		where: eq(lesson.status, 1),
		columns: {
			lesson_uuid: true,
		},
	});

	// 存在しなければ終了
	if (lesson_list.length === 0) {
		console.debug('[*] 開講している授業がありません。');
		return;
	}

	// 授業毎に出席状況を更新する
	for (const lesson of lesson_list) {
		const lesson_uuid = lesson.lesson_uuid;

		// キーバリューストアからデバイスIDのリストを取得する
		console.debug('[*] キーバリューストアからデバイスIDのリストを取得します。');

		const device_id_kv_list = await env.KV.list({ prefix: `attendance:${lesson_uuid}` });

		console.debug('[*] キーバリューストアから取得したデバイスIDのリスト', device_id_kv_list);

		const device_id_list = device_id_kv_list.keys.map((key) => {
			return {
				name: key.name.split(':')[2],
			};
		});

		console.debug('[*] デバイスIDのリスト', device_id_list);

		// 次に、授業に紐づいている生徒のIDのリストを取得する
		const student_list = await db.query.regilesson.findMany({
			where: eq(regilesson.lesson_uuid, lesson_uuid),
			columns: {},
			with: {
				student: {
					columns: {
						student_uuid: true,
						device_id: true,
					},
				},
			},
		});

		console.debug('[*] 授業に紐づいている生徒のIDのリスト', student_list);

		// また、出席が既に完了している生徒のリストを取得する
		const attendance_list = await db.query.attendance.findMany({
			where: and(eq(attendance.lesson_uuid, lesson_uuid), eq(attendance.status, 1)),
			columns: {
				student_uuid: true,
			},
		});

		console.debug('[*] 出席が既に完了している生徒のリスト', attendance_list);

		// 生徒のIDのリストとデバイスIDのリストを突合し、一致した生徒のリストを取得する
		// ただし、出席が既に完了している生徒は除外する
		const student_attendance_list = student_list.filter((student) => {
			return (
				// 該当するデバイスIDのリストに含まれているか
				device_id_list.some((device_id) => {
					return student.student.device_id === device_id.name;
				}) &&
				// かつ、出席がまだ完了していないか
				!attendance_list.some((attendance) => attendance.student_uuid === student.student.student_uuid)
			);
		});

		console.debug('[*] 今回出席した生徒のリスト', student_attendance_list);

		// もし出席した生徒がいれば出席テーブルを更新する
		if (student_attendance_list.length !== 0) {
			// 出席した生徒のリストを取得する
			const result = await db
				.update(attendance)
				.set({ status: 1 })
				.where(
					inArray(
						attendance.student_uuid,
						student_attendance_list.map((student) => student.student.student_uuid)
					)
				)
				.execute();

			if (result.error) {
				console.error('[!] 出席の登録に失敗しました。', result.error);
			}
		}

		const student_nortification_list = student_attendance_list.map((student) => student.student.student_uuid);

		if (student_nortification_list.length !== 0) {
			// 今回該当する生徒のリストを取得する
			const student_email_list = await db.query.student.findMany({
				where: inArray(student.student_uuid, student_nortification_list),
				columns: {
					email: true,
				},
			});

			console.debug('[*] 今回該当する生徒のリスト', student_email_list);

			// それぞれemailを送信する
			for (const student of student_email_list) {
				const result = await sendAttendeeEmail({
					to: student.email,
					resend_api_key: env.RESEND_API_KEY,
				});

				if (!result) {
					console.error('[!] メールの送信に失敗しました。');
				}

				console.debug('[*] メールの送信に成功しました。');
			}
		}
	}
};

export default {
	fetch: app_hono.fetch,
	scheduled: scheduled,
};
