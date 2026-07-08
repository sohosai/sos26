import { updateMapAppSettingEndpoint } from "@sos26/shared";
import { Hono } from "hono";
import { requirePermission } from "../lib/committee-permission";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middlewares/auth";
import type { AuthEnv } from "../types/auth-env";

export const committeeMapSettingsRoute = new Hono<AuthEnv>();

committeeMapSettingsRoute.use("*", requireAuth);

const DEFAULT_MAP_APP_SETTING = {
	isDescriptionEditable: true,
	isIconEditable: true,
	isMapImagesEditable: true,
	isOpenStatusEditable: false,
	isStockStatusEditable: false,
};

committeeMapSettingsRoute.get("/", async c => {
	const setting = await prisma.mapAppSetting.findUnique({
		where: { id: "GLOBAL" },
	});

	if (!setting) {
		return c.json({ setting: DEFAULT_MAP_APP_SETTING });
	}

	return c.json({
		setting: {
			isDescriptionEditable: setting.isDescriptionEditable,
			isIconEditable: setting.isIconEditable,
			isMapImagesEditable: setting.isMapImagesEditable,
			isOpenStatusEditable: setting.isOpenStatusEditable,
			isStockStatusEditable: setting.isStockStatusEditable,
		},
	});
});

committeeMapSettingsRoute.put("/", async c => {
	const user = c.get("user");
	await requirePermission(
		prisma,
		user.id,
		"MAP_APP_SETTING_EDIT",
		"マップアプリ設定変更権限がありません"
	);

	const body = await c.req.json().catch(() => ({}));
	const data = updateMapAppSettingEndpoint.request.parse(body);

	const updated = await prisma.mapAppSetting.upsert({
		where: { id: "GLOBAL" },
		update: data,
		create: {
			id: "GLOBAL",
			...DEFAULT_MAP_APP_SETTING,
			...data,
		},
	});

	return c.json({
		setting: {
			isDescriptionEditable: updated.isDescriptionEditable,
			isIconEditable: updated.isIconEditable,
			isMapImagesEditable: updated.isMapImagesEditable,
			isOpenStatusEditable: updated.isOpenStatusEditable,
			isStockStatusEditable: updated.isStockStatusEditable,
		},
	});
});
