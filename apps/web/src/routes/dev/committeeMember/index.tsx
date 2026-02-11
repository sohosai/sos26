import type { Bureau } from "@sos26/shared";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
	createCommitteeMember,
	deleteCommitteeMember,
	listCommitteeMembers,
} from "@/lib/api/committee-member";
import { useAuthStore } from "@/lib/auth";

const BUREAU_OPTIONS: { value: Bureau; label: string }[] = [
	{ value: "FINANCE", label: "財務局" },
	{ value: "GENERAL_AFFAIRS", label: "総務局" },
	{ value: "PUBLIC_RELATIONS", label: "広報宣伝局" },
	{ value: "EXTERNAL", label: "渉外局" },
	{ value: "PROMOTION", label: "推進局" },
	{ value: "PLANNING", label: "総合計画局" },
	{ value: "STAGE_MANAGEMENT", label: "ステージ管理局" },
	{ value: "HQ_PLANNING", label: "本部企画局" },
	{ value: "INFO_SYSTEM", label: "情報メディアシステム局" },
	{ value: "INFORMATION", label: "案内所運営部会" },
];

export const Route = createFileRoute("/dev/committeeMember/")({
	component: CommitteeMemberDevPage,
});

function CommitteeMemberDevPage() {
	const { user, refreshUser } = useAuthStore();
	const [bureau, setBureau] = useState<Bureau>("INFO_SYSTEM");
	const [members, setMembers] = useState<
		Awaited<ReturnType<typeof listCommitteeMembers>>["committeeMembers"]
	>([]);
	const [status, setStatus] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const fetchMembers = useCallback(async () => {
		try {
			const response = await listCommitteeMembers();
			setMembers(response.committeeMembers);
		} catch (error) {
			console.error(error);
			setStatus("一覧取得に失敗しました");
		}
	}, []);

	useEffect(() => {
		fetchMembers();
	}, [fetchMembers]);

	const handleRegister = async () => {
		if (!user) {
			setStatus("ログインしてください");
			return;
		}
		setLoading(true);
		setStatus(null);
		try {
			await createCommitteeMember({
				userId: user.id,
				Bureau: bureau,
			});
			setStatus("委員メンバーに登録しました");
			await refreshUser();
			await fetchMembers();
		} catch (error) {
			console.error(error);
			setStatus("登録に失敗しました");
		} finally {
			setLoading(false);
		}
	};

	const handleDelete = async (id: string) => {
		setLoading(true);
		setStatus(null);
		try {
			await deleteCommitteeMember(id);
			setStatus("委員メンバーを削除しました");
			await refreshUser();
			await fetchMembers();
		} catch (error) {
			console.error(error);
			setStatus("削除に失敗しました");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div>
			<h1>委員メンバー管理（開発用）</h1>

			<section>
				<h2>自分を委員に登録</h2>
				<div>
					<label>
						局を選択:
						<select
							value={bureau}
							onChange={e => setBureau(e.target.value as Bureau)}
						>
							{BUREAU_OPTIONS.map(opt => (
								<option key={opt.value} value={opt.value}>
									{opt.label}
								</option>
							))}
						</select>
					</label>
				</div>
				<button onClick={handleRegister} disabled={loading} type="button">
					委員として登録
				</button>
			</section>

			<section>
				<h2>委員メンバー一覧</h2>
				<button onClick={fetchMembers} disabled={loading} type="button">
					更新
				</button>
				<table>
					<thead>
						<tr>
							<th>名前</th>
							<th>メール</th>
							<th>局</th>
							<th>委員長</th>
							<th>操作</th>
						</tr>
					</thead>
					<tbody>
						{members.map(m => (
							<tr key={m.id}>
								<td>{m.user.name}</td>
								<td>{m.user.email}</td>
								<td>
									{BUREAU_OPTIONS.find(o => o.value === m.Bureau)?.label ??
										m.Bureau}
								</td>
								<td>{m.isExecutive ? "Yes" : "No"}</td>
								<td>
									<button
										onClick={() => handleDelete(m.id)}
										disabled={loading}
										type="button"
									>
										削除
									</button>
								</td>
							</tr>
						))}
						{members.length === 0 && (
							<tr>
								<td colSpan={5}>メンバーなし</td>
							</tr>
						)}
					</tbody>
				</table>
			</section>

			{status && <p>{status}</p>}
		</div>
	);
}
