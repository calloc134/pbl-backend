const sendAttendeeEmail = async ({ to, resend_api_key }: { to: string; resend_api_key: string }) => {
	// 現在の時刻を取得
	const now = new Date();
	const year = now.getFullYear();
	const month = now.getMonth() + 1;
	const date = now.getDate();
	const hour = now.getHours();
	const minute = now.getMinutes();
	const second = now.getSeconds();

	// 現在の時刻を文字列に変換
	const nowString = `${year}/${month}/${date} ${hour}:${minute}:${second}`;

	const result = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${resend_api_key}`,
		},
		body: JSON.stringify({
			from: '出席管理システム <attendance@calloc.tech>',
			to: [to],
			subject: '出席が完了しました',
			text: `出席管理システムからの自動送信メールです。\n\n${nowString}に出席が完了しました。\n\n出席管理システムをご利用いただきありがとうございます。`,
		}),
	});

	if (result.status !== 200) {
		return false;
	}

	return true;
};

export { sendAttendeeEmail };
