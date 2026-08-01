/**
 * Google Translate Patch
 *
 * Google 翻訳等の外部ツールによる DOM 改変と、React の仮想 DOM reconciler の
 * 競合を防ぐためのパッチです。
 *
 * 翻訳ツールはテキストノードを <font> タグでラップし、React の仮想 DOM と
 * 実際の DOM 構造をずらせます。その結果、React が removeChild / insertBefore
 * を実行しようとして、"The node to be removed is not a child of this node"
 * といったエラーが発生します。
 *
 * このパッチは、これらのメソッドを安全にラップし、対象のノードが実際に
 * 指定された親の子でない場合は、document.body 以下のツリーから
 * 該当ノードを探して代わりに操作することで、エラーを回避します。
 *
 * ## 動作原理
 *
 * 1. `Node.prototype.removeChild(node)` をラップ
 *    - `this.contains(node)` が false の場合、document.body から DFS で探索
 *    - 見つかった親ノードに対して removeChild を実行
 *    - 見つからない場合は警告を出して静かに失敗（クラッシュさせない）
 *
 * 2. `Node.prototype.insertBefore(newNode, refNode)` をラップ
 *    - `this.contains(refNode)` が false の場合、document.body から DFS で探索
 *    - 見つかった親ノードに対して insertBefore を実行
 *
 * ## 注意
 * - このパッチはアプリケーション初期化前に一度だけ実行すること
 * - グローバルな副作用を持つため、テスト環境でも適用される
 */

/**
 * document.body 以下から指定されたノードを含む親要素を探索する。
 */
function findParentContainingNode(root: Node, target: Node): Node | null {
	const stack: Node[] = [root];
	while (stack.length > 0) {
		const current = stack.pop();
		if (!current) {
			continue;
		}
		// NodeList は live なので Array.from でスナップショットを取得
		const children = Array.from(current.childNodes);
		for (const child of children) {
			if (child === target) {
				return current;
			}
			stack.push(child);
		}
	}
	return null;
}

function patchRemoveChild(): void {
	const originalRemoveChild = Node.prototype.removeChild;
	Node.prototype.removeChild = function <T extends Node>(
		this: Node,
		child: T
	): T {
		if (this.contains(child)) {
			return originalRemoveChild.call(this, child) as T;
		}

		const actualParent =
			child.parentNode ??
			(child.parentElement as Node | null) ??
			findParentContainingNode(document.body, child);

		if (actualParent) {
			return originalRemoveChild.call(actualParent, child) as T;
		}

		console.warn(
			"[GoogleTranslatePatch] removeChild: node not found in document body",
			child
		);
		return child;
	};
}

function patchInsertBefore(): void {
	const originalInsertBefore = Node.prototype.insertBefore;
	Node.prototype.insertBefore = function <T extends Node>(
		this: Node,
		newChild: T,
		refChild: Node | null
	): T {
		if (refChild === null || this.contains(refChild)) {
			return originalInsertBefore.call(this, newChild, refChild) as T;
		}

		const actualParent =
			refChild.parentNode ??
			(refChild.parentElement as Node | null) ??
			findParentContainingNode(document.body, refChild);

		if (actualParent) {
			return originalInsertBefore.call(actualParent, newChild, refChild) as T;
		}

		console.warn(
			"[GoogleTranslatePatch] insertBefore: refNode not found in document body",
			refChild
		);
		return newChild;
	};
}

function patchReplaceChild(): void {
	const originalReplaceChild = Node.prototype.replaceChild;
	Node.prototype.replaceChild = function <T extends Node>(
		this: Node,
		newChild: Node,
		oldChild: T
	): T {
		if (this.contains(oldChild)) {
			return originalReplaceChild.call(this, newChild, oldChild) as T;
		}

		const actualParent =
			oldChild.parentNode ??
			(oldChild.parentElement as Node | null) ??
			findParentContainingNode(document.body, oldChild);

		if (actualParent) {
			return originalReplaceChild.call(actualParent, newChild, oldChild) as T;
		}

		console.warn(
			"[GoogleTranslatePatch] replaceChild: oldNode not found in document body",
			oldChild
		);
		return oldChild;
	};
}

/**
 * Google 翻訳による DOM 改変と React の競合を防ぐパッチを適用する。
 * アプリケーション初期化前に呼び出すこと。
 */
export function applyGoogleTranslatePatch(): void {
	if (typeof window === "undefined" || typeof document === "undefined") {
		return;
	}

	// 二重適用を防ぐ
	if (
		(window as unknown as Record<string, unknown>).__sos26TranslatePatchApplied
	) {
		return;
	}
	(window as unknown as Record<string, unknown>).__sos26TranslatePatchApplied =
		true;

	patchRemoveChild();
	patchInsertBefore();
	patchReplaceChild();
}
