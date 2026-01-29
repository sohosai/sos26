import { describe, expect, it } from "vitest";
import { tokenHashSchema, verificationTokenSchema } from "./token";

describe("verificationTokenSchema", () => {
	it("43文字以上のbase64url文字列を受け入れる", () => {
		const valid = "A".repeat(43); // base64url許可文字・最小長43
		expect(verificationTokenSchema.safeParse(valid).success).toBe(true);
	});

	it("42文字以下は拒否する", () => {
		const invalid = "A".repeat(42);
		expect(verificationTokenSchema.safeParse(invalid).success).toBe(false);
	});

	it("許可されない文字（+ / =）を含む場合は拒否する", () => {
		const withPlus = `${"A".repeat(42)}+`;
		const withSlash = `${"A".repeat(42)}/`;
		const withPad = `${"A".repeat(42)}=`;
		expect(verificationTokenSchema.safeParse(withPlus).success).toBe(false);
		expect(verificationTokenSchema.safeParse(withSlash).success).toBe(false);
		expect(verificationTokenSchema.safeParse(withPad).success).toBe(false);
	});
});

describe("tokenHashSchema", () => {
	it("64桁の小文字16進数を受け入れる", () => {
		const valid = "a".repeat(64);
		expect(tokenHashSchema.safeParse(valid).success).toBe(true);
	});

	it("長さが64以外は拒否する", () => {
		const short = "a".repeat(63);
		const long = "a".repeat(65);
		expect(tokenHashSchema.safeParse(short).success).toBe(false);
		expect(tokenHashSchema.safeParse(long).success).toBe(false);
	});

	it("大文字や非16進文字は拒否する", () => {
		const upper = "A".repeat(64);
		const nonHex = "g".repeat(64);
		expect(tokenHashSchema.safeParse(upper).success).toBe(false);
		expect(tokenHashSchema.safeParse(nonHex).success).toBe(false);
	});
});
