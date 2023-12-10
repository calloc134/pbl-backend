const sendAttendeeEmail = async ({ to, resend_api_key }: { to: string; resend_api_key: string }) => {
	const result = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${resend_api_key}`,
		},
		body: JSON.stringify({
			from: 'calloc134 <calloc134@calloc.tech>',
			to: [to],
			subject: '出席が完了しました',
			text: '出席が完了しました',
		}),
	});

	if (result.status !== 200) {
		return false;
	}

	return true;
};
