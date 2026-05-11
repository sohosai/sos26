self.addEventListener("install", () => {
	self.skipWaiting();
});

self.addEventListener("activate", event => {
	event.waitUntil(self.clients.claim());
});

const downloadMap = new Map();

self.onmessage = event => {
	if (event.data === "ping") {
		return;
	}

	const data = event.data;
	const downloadUrl =
		data.url ||
		self.registration.scope +
			Math.random() +
			"/" +
			(typeof data === "string" ? data : data.filename);
	const port = event.ports[0];
	const metadata = {
		stream: null,
		data: data,
		port: port,
	};

	if (event.data.readableStream) {
		metadata.stream = event.data.readableStream;
	} else if (event.data.transferringReadable) {
		port.onmessage = evt => {
			port.onmessage = null;
			metadata.stream = evt.data.readableStream;
		};
	} else {
		metadata.stream = createStream(port);
	}

	downloadMap.set(downloadUrl, metadata);
	port.postMessage({ download: downloadUrl });
};

function createStream(port) {
	return new ReadableStream({
		start(controller) {
			port.onmessage = ({ data }) => {
				if (data === "end") {
					return controller.close();
				}

				if (data === "abort") {
					controller.error("Aborted the download");
					return;
				}

				controller.enqueue(data);
			};
		},
		cancel(reason) {
			console.error("user aborted", reason);
			port.postMessage({ abort: true });
		},
	});
}

self.onfetch = event => {
	const url = event.request.url;

	if (url.endsWith("/ping")) {
		return event.respondWith(new Response("pong"));
	}

	const hijacked = downloadMap.get(url);

	if (!hijacked) return;

	const { stream, data, port } = hijacked;

	downloadMap.delete(url);

	const responseHeaders = new Headers({
		"Content-Type": "application/octet-stream; charset=utf-8",
		"Content-Security-Policy": "default-src 'none'",
		"X-Content-Security-Policy": "default-src 'none'",
		"X-WebKit-CSP": "default-src 'none'",
		"X-XSS-Protection": "1; mode=block",
		"Cross-Origin-Embedder-Policy": "require-corp",
	});

	const headers = new Headers(data.headers || {});

	if (headers.has("Content-Length")) {
		responseHeaders.set("Content-Length", headers.get("Content-Length"));
	}

	if (headers.has("Content-Disposition")) {
		responseHeaders.set(
			"Content-Disposition",
			headers.get("Content-Disposition")
		);
	}

	if (data.size) {
		console.warn("Deprecated");
		responseHeaders.set("Content-Length", data.size);
	}

	let fileName = typeof data === "string" ? data : data.filename;
	if (fileName) {
		console.warn("Deprecated");
		fileName = encodeURIComponent(fileName)
			.replace(/['()]/g, escape)
			.replace(/\*/g, "%2A");
		responseHeaders.set(
			"Content-Disposition",
			`attachment; filename*=UTF-8''${fileName}`
		);
	}

	event.respondWith(new Response(stream, { headers: responseHeaders }));

	port.postMessage({ debug: "Download started" });
};

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
