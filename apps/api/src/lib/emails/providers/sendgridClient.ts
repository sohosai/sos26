import { SpanStatusCode } from "@opentelemetry/api";
import sgMail from "@sendgrid/mail";
import { ZodError, z } from "zod";
import { tracer } from "../../../otel";
import { env } from "../../env";
import { Errors } from "../../error";
import { logIntegrationFailure } from "../../error-logging";

sgMail.setApiKey(env.SENDGRID_API_KEY);

const SendEmailInputSchema = z.object({
	to: z.email(),
	subject: z.string().min(1, "subject is required"),
	html: z.string().min(1, "html is required"),
	text: z.string().optional(),
});

export type SendEmailInput = z.infer<typeof SendEmailInputSchema>;

export async function sendEmail(input: SendEmailInput): Promise<void> {
	try {
		const parsed = SendEmailInputSchema.parse(input);

		// OTEL-003: メール送信（SendGrid）を計装する。
		// OTEL-103: 宛先メールアドレス等の個人情報は属性に含めない。
		await tracer.startActiveSpan("sendgrid.send", async span => {
			try {
				await sgMail.send({
					to: parsed.to,
					from: env.EMAIL_FROM,
					subject: parsed.subject,
					html: parsed.html,
					text: parsed.text,
					mailSettings: {
						sandboxMode: {
							enable: env.EMAIL_SANDBOX,
						},
					},
				});
			} catch (e) {
				span.recordException(e as Error);
				span.setStatus({ code: SpanStatusCode.ERROR });
				throw e;
			} finally {
				span.end();
			}
		});
	} catch (err) {
		// 入力値の不正はそのまま ZodError を返す
		if (err instanceof ZodError) {
			throw err;
		}

		// 外部サービスの失敗などは内部エラーとして正規化し、詳細は返さない
		logIntegrationFailure("Email", "SendGrid send", err);
		throw Errors.internal("メール送信に失敗しました");
	}
}
