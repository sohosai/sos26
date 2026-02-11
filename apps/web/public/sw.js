self.addEventListener("push", event => {
	let data;

	try {
		data = event.data.json();
	} catch (e) {
		console.error("[SW] Push payload parse failed", e);
		return; // パースが失敗したら、通知は表示しない
	}

	event.waitUntil(
		self.registration
			.showNotification(data.title, {
				body: data.body,
			})
			.catch(err => console.error("[SW] showNotification failed", err))
	);
});
