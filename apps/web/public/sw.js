self.addEventListener("push", event => {
	let data;

	try {
		data = event.data.json();
	} catch (e) {
		console.error("[SW] Push payload parse failed", e);
		return; // パースが失敗したら、通知は表示しない
	}

	const {
		title,
		body,
		icon,
		badge,
		image,
		lang,
		tag,
		renotify,
		requireInteraction,
		silent,
		timestamp,
		vibrate,
		actions,
		data: payloadData,
		dir,
	} = data;

	event.waitUntil(
		self.registration
			.showNotification(title, {
				body,
				icon,
				badge,
				image,
				lang,
				tag,
				renotify,
				requireInteraction,
				silent,
				timestamp,
				vibrate,
				actions,
				data: payloadData,
				dir,
			})
			.catch(err => console.error("[SW] showNotification failed", err))
	);
});

self.addEventListener("notificationclick", event => {
	event.notification.close();

	const url = event.notification?.data?.url;
	if (!url || typeof url !== "string") {
		return;
	}

	event.waitUntil(
		clients
			.matchAll({ type: "window", includeUncontrolled: true })
			.then(clientList => {
				for (const client of clientList) {
					if (client.url === url && "focus" in client) {
						return client.focus();
					}
				}
				if (clients.openWindow) {
					return clients.openWindow(url);
				}
			})
			.catch(err => console.error("[SW] notificationclick failed", err))
	);
});
