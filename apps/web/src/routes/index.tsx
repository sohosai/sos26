import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { Button } from "@/components/primitives";
import { listUsers } from "@/lib/api/user";
import { type ClientErrorClass, isClientError } from "@/lib/http/error";

export const Route = createFileRoute("/")({
	component: Index,
	head: () => ({
		meta: [
			{
				title: "雙峰祭オンラインシステム",
			},
			{
				name: "description",
				content: "Sohosai Online System",
			},
		],
	}),
});

/**
 * ClientErrorClass をユーザーフレンドリーなメッセージに変換
 */
function formatErrorMessage(err: ClientErrorClass): string {
	if (err.code) {
		return `${err.code}: ${err.apiError?.error.message}`;
	}
	return err.message;
}

function Index() {
	const [loading, setLoading] = useState(false);
	const [output, setOutput] = useState<string>("結果がここに表示されます");

	const handleFetchUsers = useCallback(async () => {
		setLoading(true);
		setOutput("Loading...");
		try {
			// 成功時: User[] が返る
			// 失敗時: ClientError が throw される
			const users = await listUsers();
			setOutput(JSON.stringify(users, null, 2));
		} catch (error) {
			if (isClientError(error)) {
				setOutput(`Error: ${formatErrorMessage(error)}`);
			} else {
				setOutput("Unknown error occurred");
			}
		} finally {
			setLoading(false);
		}
	}, []);

	return (
		<div>
			<h1>Welcome Sohosai Online System!</h1>
			<div>
				<Button onClick={handleFetchUsers} loading={loading}>
					ユーザー一覧を取得
				</Button>
			</div>
			<div>
				API: {import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000"}
			</div>
			<pre>{output}</pre>
		</div>
	);
}
