import { updateMapAppSettingEndpoint } from "@sos26/shared";
import { Hono } from "hono";
import { prisma } from "../lib/prisma";
import { requireAuth, requireCommitteeMember } from "../middlewares/auth";
import type { AuthEnv } from "../types/auth-env";

export const committeeMapSettingsRoute = new Hono<AuthEnv>();

committeeMapSettingsRoute.use("*", requireAuth, requireCommitteeMember);

const DEFAULT_MAP_APP_SETTING = {
	isDescriptionEditable: true,
	isIconEditable: true,
	isMapImagesEditable: true,
	isOpenStatusEditable: true,
	isStockStatusEditable: true,
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
