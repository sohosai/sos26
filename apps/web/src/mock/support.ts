import { useSyncExternalStore } from "react";

// ─── 型定義 ───

export type Person = {
	id: string;
	name: string;
	role: "project" | "committee";
	projectName?: string;
	department?: string;
};

export type Form = {
	id: string;
	name: string;
};

export type InquiryStatus = "new" | "in_progress" | "resolved";

export type Message = {
	id: string;
	body: string;
	createdAt: Date;
	createdBy: Person;
	parentId: string | null;
};

export type Inquiry = {
	id: string;
	title: string;
	body: string;
	status: InquiryStatus;
	createdAt: Date;
	createdBy: Person;
	creatorRole: "project" | "committee";
	projectAssignees: Person[];
	committeeAssignees: Person[];
	relatedForm: Form | null;
	messages: Message[];
};

// ─── マスタデータ ───

const cm1: Person = {
	id: "cm-1",
	name: "田中 太郎",
	role: "committee",
	department: "総務局",
};
const cm2: Person = {
	id: "cm-2",
	name: "佐藤 次郎",
	role: "committee",
	department: "推進局",
};
const cm3: Person = {
	id: "cm-3",
	name: "鈴木 三郎",
	role: "committee",
	department: "総合計画局",
};
const cm4: Person = {
	id: "cm-4",
	name: "高橋 四郎",
	role: "committee",
	department: "総務局",
};

const pm1: Person = {
	id: "pm-1",
	name: "山田 花子",
	role: "project",
	projectName: "やきとり屋",
};
const pm2: Person = {
	id: "pm-2",
	name: "中村 美咲",
	role: "project",
	projectName: "クレープ工房",
};
const pm3: Person = {
	id: "pm-3",
	name: "小林 健太",
	role: "project",
	projectName: "写真部展示",
};

const form1: Form = { id: "form-1", name: "出展申請書" };
const form2: Form = { id: "form-2", name: "電力使用申請" };
const form3: Form = { id: "form-3", name: "テント貸出申請" };
const form4: Form = { id: "form-4", name: "騒音配慮確認書" };
const form5: Form = { id: "form-5", name: "飲食物提供届" };

export const committeMembers: Person[] = [cm1, cm2, cm3, cm4];
export const projectMembers: Person[] = [pm1, pm2, pm3];
export const availableForms: Form[] = [form1, form2, form3, form4, form5];

/** 実委側の現在のユーザー（モック） */
export const currentCommitteeUser: Person = cm1;
/** 企画側の現在のユーザー（モック） */
export const currentProjectUser: Person = pm1;

// ─── 初期データ ───

const initialInquiries: Inquiry[] = [
	{
		id: "inq-1",
		title: "テントの追加貸出について",
		body: "当日雨天の場合に備えて、テントの追加貸出は可能でしょうか？申請書の提出期限も教えていただきたいです。",
		status: "in_progress",
		createdAt: new Date("2025-10-01T09:30:00"),
		createdBy: pm1,
		creatorRole: "project",
		projectAssignees: [pm1],
		committeeAssignees: [cm1],
		relatedForm: form3,
		messages: [
			{
				id: "msg-1",
				body: "テントの追加貸出は可能です。申請書は10月15日までに提出をお願いします。",
				createdAt: new Date("2025-10-01T14:00:00"),
				createdBy: cm1,
				parentId: null,
			},
			{
				id: "msg-2",
				body: "ありがとうございます。サイズの指定はありますか？",
				createdAt: new Date("2025-10-02T10:00:00"),
				createdBy: pm1,
				parentId: "msg-1",
			},
			{
				id: "msg-3",
				body: "3m×3m のみとなります。必要数を申請書にご記入ください。",
				createdAt: new Date("2025-10-02T15:30:00"),
				createdBy: cm1,
				parentId: "msg-2",
			},
		],
	},
	{
		id: "inq-2",
		title: "電力の上限について確認",
		body: "ホットプレート2台を同時使用したいのですが、電力の上限を超えてしまいますか？",
		status: "new",
		createdAt: new Date("2025-10-05T11:00:00"),
		createdBy: pm2,
		creatorRole: "project",
		projectAssignees: [pm2],
		committeeAssignees: [],
		relatedForm: form2,
		messages: [],
	},
	{
		id: "inq-3",
		title: "騒音配慮確認書の記入方法",
		body: "騒音配慮確認書の「想定される最大音量」の欄はどのように記入すればよいでしょうか？測定器がない場合の目安を教えてください。",
		status: "in_progress",
		createdAt: new Date("2025-10-03T16:00:00"),
		createdBy: pm1,
		creatorRole: "project",
		projectAssignees: [pm1],
		committeeAssignees: [cm2],
		relatedForm: form4,
		messages: [
			{
				id: "msg-4",
				body: "目安として、通常の会話が60dB程度、大声が80dB程度です。スピーカー使用の場合は「80dB以上」とご記入ください。",
				createdAt: new Date("2025-10-04T09:00:00"),
				createdBy: cm2,
				parentId: null,
			},
		],
	},
	{
		id: "inq-4",
		title: "飲食物提供届の提出依頼",
		body: "飲食物を提供される企画について、飲食物提供届の提出をお願いいたします。提出期限は10月20日です。",
		status: "in_progress",
		createdAt: new Date("2025-10-06T10:00:00"),
		createdBy: cm1,
		creatorRole: "committee",
		projectAssignees: [pm1, pm3],
		committeeAssignees: [cm1],
		relatedForm: form5,
		messages: [
			{
				id: "msg-5",
				body: "承知しました。提出期限までに対応いたします。",
				createdAt: new Date("2025-10-06T14:00:00"),
				createdBy: pm1,
				parentId: null,
			},
		],
	},
	{
		id: "inq-5",
		title: "出展場所の変更希望",
		body: "当初申請した場所から変更を希望します。理由としては、隣接企画との動線の重複が懸念されるためです。",
		status: "resolved",
		createdAt: new Date("2025-09-25T13:00:00"),
		createdBy: pm1,
		creatorRole: "project",
		projectAssignees: [pm1],
		committeeAssignees: [cm3],
		relatedForm: form1,
		messages: [
			{
				id: "msg-6",
				body: "変更希望を承りました。調整の上、改めてご連絡いたします。",
				createdAt: new Date("2025-09-26T10:00:00"),
				createdBy: cm3,
				parentId: null,
			},
			{
				id: "msg-7",
				body: "調整の結果、B-12ブースへの変更が可能です。こちらでよろしいでしょうか？",
				createdAt: new Date("2025-09-28T11:00:00"),
				createdBy: cm3,
				parentId: "msg-6",
			},
			{
				id: "msg-8",
				body: "B-12ブースで問題ありません。ありがとうございます。",
				createdAt: new Date("2025-09-28T14:00:00"),
				createdBy: pm1,
				parentId: "msg-7",
			},
		],
	},
	{
		id: "inq-6",
		title: "看板のサイズ制限について",
		body: "企画の看板を設置したいのですが、サイズの制限はありますか？",
		status: "new",
		createdAt: new Date("2025-10-07T08:30:00"),
		createdBy: pm3,
		creatorRole: "project",
		projectAssignees: [pm3],
		committeeAssignees: [],
		relatedForm: null,
		messages: [],
	},
];

// ─── Store ───

let inquiries = structuredClone(initialInquiries);
let nextId = 7;
let nextMsgId = 9;
const listeners = new Set<() => void>();

function emitChange() {
	for (const listener of listeners) {
		listener();
	}
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

function getSnapshot(): Inquiry[] {
	return inquiries;
}

// ─── Actions ───

function addInquiry(params: {
	title: string;
	body: string;
	createdBy: Person;
	creatorRole: "project" | "committee";
	relatedForm: Form | null;
	projectAssignees: Person[];
	committeeAssignees: Person[];
}): Inquiry {
	const status: InquiryStatus =
		params.committeeAssignees.length > 0 && params.projectAssignees.length > 0
			? "in_progress"
			: "new";

	const inquiry: Inquiry = {
		id: `inq-${nextId++}`,
		title: params.title,
		body: params.body,
		status,
		createdAt: new Date(),
		createdBy: params.createdBy,
		creatorRole: params.creatorRole,
		projectAssignees: params.projectAssignees,
		committeeAssignees: params.committeeAssignees,
		relatedForm: params.relatedForm,
		messages: [],
	};
	inquiries = [inquiry, ...inquiries];
	emitChange();
	return inquiry;
}

function updateStatus(inquiryId: string, status: InquiryStatus) {
	inquiries = inquiries.map(inq =>
		inq.id === inquiryId ? { ...inq, status } : inq
	);
	emitChange();
}

function addMessage(
	inquiryId: string,
	body: string,
	createdBy: Person,
	parentId: string | null
) {
	const msg: Message = {
		id: `msg-${nextMsgId++}`,
		body,
		createdAt: new Date(),
		createdBy,
		parentId,
	};
	inquiries = inquiries.map(inq =>
		inq.id === inquiryId ? { ...inq, messages: [...inq.messages, msg] } : inq
	);
	emitChange();
}

function addAssignee(
	inquiryId: string,
	person: Person,
	side: "project" | "committee"
) {
	inquiries = inquiries.map(inq => {
		if (inq.id !== inquiryId) return inq;
		const key = side === "project" ? "projectAssignees" : "committeeAssignees";
		if (inq[key].some(p => p.id === person.id)) return inq;
		const updated = { ...inq, [key]: [...inq[key], person] };
		// 両方に担当者が揃ったら対応中に
		if (
			updated.status === "new" &&
			updated.committeeAssignees.length > 0 &&
			updated.projectAssignees.length > 0
		) {
			updated.status = "in_progress";
		}
		return updated;
	});
	emitChange();
}

function removeAssignee(
	inquiryId: string,
	personId: string,
	side: "project" | "committee"
) {
	inquiries = inquiries.map(inq => {
		if (inq.id !== inquiryId) return inq;
		const key = side === "project" ? "projectAssignees" : "committeeAssignees";
		const updated = { ...inq, [key]: inq[key].filter(p => p.id !== personId) };
		// どちらかの担当者が空になったら新規に戻す（解決済み以外）
		if (
			updated.status !== "resolved" &&
			(updated.committeeAssignees.length === 0 ||
				updated.projectAssignees.length === 0)
		) {
			updated.status = "new";
		}
		return updated;
	});
	emitChange();
}

// ─── Hook ───

export function useSupportStore() {
	const data = useSyncExternalStore(subscribe, getSnapshot);
	return {
		inquiries: data,
		addInquiry,
		updateStatus,
		addMessage,
		addAssignee,
		removeAssignee,
	};
}
