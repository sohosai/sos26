import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
	CheckboxGroup,
	CheckboxGroupItem,
	RadioGroup,
	RadioGroupItem,
} from "@/components/patterns";
import {
	Button,
	Checkbox,
	Switch,
	TextArea,
	TextField,
} from "@/components/primitives";
import styles from "./index.module.scss";

export const Route = createFileRoute("/dev/ui/components/")({
	component: ComponentsPage,
	head: () => ({
		meta: [{ title: "コンポーネント一覧" }],
	}),
});

function ComponentsPage() {
	const [buttonLoading, setButtonLoading] = useState(false);
	const [checkboxChecked, setCheckboxChecked] = useState(false);
	const [switchChecked, setSwitchChecked] = useState(false);
	const [radioGroupValue, setRadioGroupValue] = useState("card");
	const [checkboxGroupValue, setCheckboxGroupValue] = useState(["tech"]);
	const [textFieldValue, setTextFieldValue] = useState("");
	const [textAreaValue, setTextAreaValue] = useState("");

	const handleButtonClick = () => {
		setButtonLoading(true);
		setTimeout(() => setButtonLoading(false), 2000);
	};

	return (
		<div className={styles.container}>
			<h1>コンポーネント一覧</h1>
			<p className={styles.description}>
				primitives / patterns コンポーネントのサンプル表示ページです。
			</p>

			<h2 className={styles.categoryTitle}>Primitives</h2>

			{/* Button */}
			<section className={styles.section}>
				<h3>Button</h3>
				<div className={styles.grid}>
					<div className={styles.item}>
						<h4>Intent</h4>
						<div className={styles.row}>
							<Button intent="primary">Primary</Button>
							<Button intent="secondary">Secondary</Button>
							<Button intent="danger">Danger</Button>
							<Button intent="ghost">Ghost</Button>
						</div>
					</div>
					<div className={styles.item}>
						<h4>Size</h4>
						<div className={styles.row}>
							<Button size="1">Size 1</Button>
							<Button size="2">Size 2</Button>
						</div>
					</div>
					<div className={styles.item}>
						<h4>Loading</h4>
						<div className={styles.row}>
							<Button loading={buttonLoading} onClick={handleButtonClick}>
								{buttonLoading ? "Loading..." : "Click me"}
							</Button>
						</div>
					</div>
					<div className={styles.item}>
						<h4>Disabled</h4>
						<div className={styles.row}>
							<Button disabled>Disabled</Button>
						</div>
					</div>
				</div>
			</section>

			{/* Checkbox (単体) */}
			<section className={styles.section}>
				<h3>Checkbox（単体）</h3>
				<div className={styles.grid}>
					<div className={styles.item}>
						<h4>Basic</h4>
						<div className={styles.stack}>
							<Checkbox
								label="利用規約に同意する"
								checked={checkboxChecked}
								onCheckedChange={setCheckboxChecked}
							/>
							<Checkbox label="デフォルトでチェック" defaultChecked />
							<Checkbox label="無効状態" disabled />
						</div>
					</div>
					<div className={styles.item}>
						<h4>Size</h4>
						<div className={styles.stack}>
							<Checkbox label="Size 1" size="1" />
							<Checkbox label="Size 2" size="2" />
						</div>
					</div>
				</div>
			</section>

			{/* Switch */}
			<section className={styles.section}>
				<h3>Switch</h3>
				<div className={styles.grid}>
					<div className={styles.item}>
						<h4>Basic</h4>
						<div className={styles.stack}>
							<Switch
								label="通知を受け取る"
								checked={switchChecked}
								onCheckedChange={setSwitchChecked}
							/>
							<Switch label="デフォルトでON" defaultChecked />
							<Switch label="無効状態" disabled />
						</div>
					</div>
					<div className={styles.item}>
						<h4>Size</h4>
						<div className={styles.stack}>
							<Switch label="Size 1" size="1" />
							<Switch label="Size 2" size="2" />
						</div>
					</div>
				</div>
			</section>

			{/* TextField */}
			<section className={styles.section}>
				<h3>TextField</h3>
				<div className={styles.grid}>
					<div className={styles.item}>
						<h4>Basic</h4>
						<div className={styles.stack}>
							<TextField
								label="ユーザー名"
								placeholder="入力してください"
								value={textFieldValue}
								onChange={setTextFieldValue}
							/>
							<TextField
								label="メールアドレス"
								type="email"
								placeholder="example@example.com"
								required
							/>
							<TextField label="パスワード" type="password" required />
						</div>
					</div>
					<div className={styles.item}>
						<h4>Error</h4>
						<div className={styles.stack}>
							<TextField
								label="エラー状態"
								error="入力値が不正です"
								defaultValue="invalid"
							/>
						</div>
					</div>
					<div className={styles.item}>
						<h4>Disabled</h4>
						<div className={styles.stack}>
							<TextField label="無効状態" disabled defaultValue="disabled" />
						</div>
					</div>
				</div>
			</section>

			{/* TextArea */}
			<section className={styles.section}>
				<h3>TextArea</h3>
				<div className={styles.grid}>
					<div className={styles.item}>
						<h4>Basic</h4>
						<div className={styles.stack}>
							<TextArea
								label="備考"
								placeholder="自由にご記入ください"
								value={textAreaValue}
								onChange={setTextAreaValue}
							/>
							<TextArea label="必須項目" required rows={3} />
						</div>
					</div>
					<div className={styles.item}>
						<h4>Error</h4>
						<div className={styles.stack}>
							<TextArea
								label="エラー状態"
								error="入力内容を確認してください"
								defaultValue="invalid content"
							/>
						</div>
					</div>
					<div className={styles.item}>
						<h4>Resize</h4>
						<div className={styles.stack}>
							<TextArea label="リサイズ不可" resize="none" />
							<TextArea label="水平方向のみ" resize="horizontal" />
						</div>
					</div>
				</div>
			</section>

			<h2 className={styles.categoryTitle}>Patterns</h2>

			{/* RadioGroup */}
			<section className={styles.section}>
				<h3>RadioGroup</h3>
				<div className={styles.grid}>
					<div className={styles.item}>
						<h4>Basic</h4>
						<RadioGroup
							label="お支払い方法"
							value={radioGroupValue}
							onValueChange={setRadioGroupValue}
						>
							<RadioGroupItem value="card">クレジットカード</RadioGroupItem>
							<RadioGroupItem value="bank">銀行振込</RadioGroupItem>
							<RadioGroupItem value="cash">代金引換</RadioGroupItem>
						</RadioGroup>
					</div>
					<div className={styles.item}>
						<h4>Required</h4>
						<RadioGroup label="配送方法" required defaultValue="standard">
							<RadioGroupItem value="standard">
								通常配送（3-5日）
							</RadioGroupItem>
							<RadioGroupItem value="express">お急ぎ便（1-2日）</RadioGroupItem>
						</RadioGroup>
					</div>
					<div className={styles.item}>
						<h4>Disabled Item</h4>
						<RadioGroup label="プラン選択" defaultValue="free">
							<RadioGroupItem value="free">無料プラン</RadioGroupItem>
							<RadioGroupItem value="pro">プロプラン</RadioGroupItem>
							<RadioGroupItem value="enterprise" disabled>
								エンタープライズ（準備中）
							</RadioGroupItem>
						</RadioGroup>
					</div>
				</div>
			</section>

			{/* CheckboxGroup */}
			<section className={styles.section}>
				<h3>CheckboxGroup</h3>
				<div className={styles.grid}>
					<div className={styles.item}>
						<h4>Basic</h4>
						<CheckboxGroup
							label="興味のある分野"
							value={checkboxGroupValue}
							onValueChange={setCheckboxGroupValue}
						>
							<CheckboxGroupItem value="tech">テクノロジー</CheckboxGroupItem>
							<CheckboxGroupItem value="design">デザイン</CheckboxGroupItem>
							<CheckboxGroupItem value="business">ビジネス</CheckboxGroupItem>
						</CheckboxGroup>
					</div>
					<div className={styles.item}>
						<h4>Required</h4>
						<CheckboxGroup label="通知設定" required defaultValue={["email"]}>
							<CheckboxGroupItem value="email">メール通知</CheckboxGroupItem>
							<CheckboxGroupItem value="push">プッシュ通知</CheckboxGroupItem>
							<CheckboxGroupItem value="sms">SMS通知</CheckboxGroupItem>
						</CheckboxGroup>
					</div>
					<div className={styles.item}>
						<h4>Disabled Item</h4>
						<CheckboxGroup label="利用可能な機能" defaultValue={["basic"]}>
							<CheckboxGroupItem value="basic">基本機能</CheckboxGroupItem>
							<CheckboxGroupItem value="advanced">高度な機能</CheckboxGroupItem>
							<CheckboxGroupItem value="beta" disabled>
								ベータ機能（準備中）
							</CheckboxGroupItem>
						</CheckboxGroup>
					</div>
				</div>
			</section>
		</div>
	);
}
