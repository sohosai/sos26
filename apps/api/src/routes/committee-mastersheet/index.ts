import { Hono } from "hono";
import type { AuthEnv } from "../../types/auth-env";
import { accessRequestsRoute } from "./access-requests";
import { cellsRoute } from "./cells";
import { columnsRoute } from "./columns";
import { dataRoute } from "./data";
import { viewsRoute } from "./views";

const committeeMastersheetRoute = new Hono<AuthEnv>();

committeeMastersheetRoute.route("/", dataRoute);
committeeMastersheetRoute.route("/", columnsRoute);
committeeMastersheetRoute.route("/", cellsRoute);
committeeMastersheetRoute.route("/", accessRequestsRoute);
committeeMastersheetRoute.route("/", viewsRoute);

export { committeeMastersheetRoute };
