import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";

const searchSchema = z.object({
	q: z.string().optional().catch(undefined),
	page: z.number().int().positive().default(1).catch(1),
});

export const Route = createFileRoute("/dev/search/")({
	validateSearch: searchSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { q, page } = Route.useSearch();

	return (
		<div>
			<h1>検索ページ</h1>
			<p>検索キーワード: {q ?? "なし"}</p>
			<p>ページ: {page}</p>

			<h2>Link サンプル</h2>
			<ul>
				{/* 検索パラメータを直接指定 */}
				<li>
					<Link to="/dev/search" search={{ q: "test", page: 2 }}>
						固定値: q=test, page=2
					</Link>
				</li>

				{/* 前の値を引き継いで page だけ更新 */}
				<li>
					<Link
						to="/dev/search"
						search={prev => ({ ...prev, page: (prev.page ?? 1) + 1 })}
					>
						次のページへ (page={page} → {(page ?? 1) + 1})
					</Link>
				</li>

				{/* 前の値を引き継いで page だけ更新 */}
				<li>
					<Link
						to="/dev/search"
						search={prev => ({
							...prev,
							page: Math.max(1, (prev.page ?? 1) - 1),
						})}
					>
						前のページへ (page={page} → {Math.max(1, (page ?? 1) - 1)})
					</Link>
				</li>

				{/* 検索キーワードをリセット */}
				<li>
					<Link to="/dev/search" search={{ q: undefined, page: 1 }}>
						検索をリセット
					</Link>
				</li>
			</ul>
		</div>
	);
}
