// 認証なしでアクセスを許可するパスの列挙
// メソッドも含む
const allow_path_list = [
	{
		path: '/students',
		method: 'POST',
	},
	{
		path: '/teachers',
		method: 'POST',
	},
	{
		path: '/students/login',
		method: 'POST',
	},
	{
		path: '/teachers/login',
		method: 'POST',
	},
	{
		path: '/attendances-endpoint',
		method: 'POST',
	},
];

// 生徒として認証を設定するパスの列挙
// メソッドも含む
const student_path_list = [
	{
		path: '/students/me',
		method: 'GET',
	},
	{
		path: '/lessons/:lesson_uuid',
		method: 'GET',
	},
	{
		path: '/join-lessons',
		method: 'POST',
	},
	{
		path: '/students/me/join-lessons',
		method: 'GET',
	},
	{
		path: '/students/me/attendances',
		method: 'GET',
	},
];

// 先生として認証を設定するパスの列挙
// メソッドも含む
const teacher_path_list = [
	{
		path: '/teachers/me',
		method: 'GET',
	},
	{
		path: '/students',
		method: 'GET',
	},
	{
		path: '/students/:student_uuid',
		method: 'GET',
	},
	{
		path: '/teachers',
		method: 'GET',
	},
	{
		path: '/teachers/:teacher_uuid',
		method: 'GET',
	},
	{
		path: '/teachers/:teacher_uuid/lessons',
		method: 'GET',
	},
	{
		path: '/teachers/me/lessons',
		method: 'GET',
	},
	{
		path: '/lessons',
		method: 'POST',
	},
	{
		path: '/lessons/:lesson_uuid',
		method: 'GET',
	},
	{
		path: '/students/:student_uuid/join-lessons',
		method: 'GET',
	},
	{
		path: '/students/:student_uuid/attendances',
		method: 'GET',
	},
	{
		path: '/lessons/:lesson_uuid/attendances',
		method: 'GET',
	},
	{
		path: '/lessons/:lesson_uuid/start',
		method: 'POST',
	},
	{
		path: '/lessons/:lesson_uuid/end',
		method: 'POST',
	},
];

export { allow_path_list, student_path_list, teacher_path_list };
