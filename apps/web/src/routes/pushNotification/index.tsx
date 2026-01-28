import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { enablePush, sendPush } from "../../lib/api/push";

export const Route = createFileRoute("/pushNotification/")({
	component: RouteComponent,
});

function RouteComponent() {
	const [title, setTitle] = useState("テスト通知");
	const [body, setBody] = useState("Push通知のテストです");
	const [status, setStatus] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const handleEnablePush = async () => {
		setLoading(true);
		setStatus(null);

		try {
			await enablePush();
			setStatus("✅ Push通知を有効化しました");
		} catch (error) {
			console.error(error);
			setStatus("❌ Push通知の有効化に失敗しました");
		} finally {
			setLoading(false);
		}
	};

	const handleSendPush = async () => {
		setLoading(true);
		setStatus(null);

		try {
			await sendPush({ title, body });
			setStatus("Push通知を送信しました");
		} catch (error) {
			console.error(error);
			setStatus("Push通知の送信に失敗しました");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div>
			<h1>Push通知テスト</h1>

			<section>
				<h2>① Push通知を有効化</h2>
				<button onClick={handleEnablePush} disabled={loading} type="button">
					許可 & 登録
				</button>
			</section>

			<section>
				<h2>② 通知内容</h2>

				<div>
					<label>
						タイトル
						<br />
						<input
							type="text"
							value={title}
							onChange={e => setTitle(e.target.value)}
						/>
					</label>
				</div>

				<div>
					<label>
						本文
						<br />
						<textarea
							value={body}
							onChange={e => setBody(e.target.value)}
							rows={3}
						/>
					</label>
				</div>
			</section>

			<section>
				<h2>③ 通知送信</h2>
				<button onClick={handleSendPush} disabled={loading} type="button">
					通知送信
				</button>
			</section>

			{status && <p>{status}</p>}
		</div>
	);
}
