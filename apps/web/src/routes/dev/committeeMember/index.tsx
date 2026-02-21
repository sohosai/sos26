import type { Bureau, CommitteePermission } from "@sos26/shared";
import { bureauLabelMap } from "@sos26/shared";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
	createCommitteeMember,
	deleteCommitteeMember,
	grantCommitteeMemberPermission,
	listCommitteeMemberPermissions,
	listCommitteeMembers,
	revokeCommitteeMemberPermission,
} from "@/lib/api/committee-member";
import { useAuthStore } from "@/lib/auth";

const PERMISSION_OPTIONS: { value: CommitteePermission; label: string }[] = [
	{ value: "MEMBER_EDIT", label: "メンバー編集" },
	{ value: "NOTICE_DELIVER", label: "お知らせ配信" },
	{ value: "NOTICE_APPROVE", label: "お知らせ承認" },
	{ value: "FORM_DELIVER", label: "フォーム配信" },
];

const BUREAU_OPTIONS: { value: Bureau; label: string }[] = Object.entries(
	bureauLabelMap
).map(([value, label]) => ({ value: value as Bureau, label }));

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
	const [permissionsMap, setPermissionsMap] = useState<
		Record<string, CommitteePermission[]>
	>({});

	const fetchMembers = useCallback(async () => {
		try {
			const response = await listCommitteeMembers();
			setMembers(response.committeeMembers);
		} catch (error) {
			console.error(error);
			setStatus("一覧取得に失敗しました");
		}
	}, []);

	const fetchPermissions = useCallback(async (memberId: string) => {
		try {
			const response = await listCommitteeMemberPermissions(memberId);
			setPermissionsMap(prev => ({
				...prev,
				[memberId]: response.permissions.map(p => p.permission),
			}));
		} catch (error) {
			console.error(error);
		}
	}, []);

	const fetchAllPermissions = useCallback(
		async (
			memberList: Awaited<
				ReturnType<typeof listCommitteeMembers>
			>["committeeMembers"]
		) => {
			await Promise.all(memberList.map(m => fetchPermissions(m.id)));
		},
		[fetchPermissions]
	);

	useEffect(() => {
		fetchMembers();
	}, [fetchMembers]);

	useEffect(() => {
		if (members.length > 0) {
			fetchAllPermissions(members);
		}
	}, [members, fetchAllPermissions]);

	const handleTogglePermission = async (
		memberId: string,
		permission: CommitteePermission
	) => {
		setLoading(true);
		setStatus(null);
		const current = permissionsMap[memberId] ?? [];
		try {
			if (current.includes(permission)) {
				await revokeCommitteeMemberPermission(memberId, permission);
			} else {
				await grantCommitteeMemberPermission(memberId, { permission });
			}
			await fetchPermissions(memberId);
		} catch (error) {
			console.error(error);
			setStatus("権限の変更に失敗しました");
		} finally {
			setLoading(false);
		}
	};

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
							<th>権限</th>
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
									{PERMISSION_OPTIONS.map(opt => (
										<label
											key={opt.value}
											style={{ display: "block", whiteSpace: "nowrap" }}
										>
											<input
												type="checkbox"
												checked={(permissionsMap[m.id] ?? []).includes(
													opt.value
												)}
												onChange={() => handleTogglePermission(m.id, opt.value)}
												disabled={loading}
											/>
											{opt.label}
										</label>
									))}
								</td>
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
								<td colSpan={6}>メンバーなし</td>
							</tr>
						)}
					</tbody>
				</table>
			</section>

			{status && <p>{status}</p>}
		</div>
	);
}
