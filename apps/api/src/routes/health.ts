import { Hono } from "hono";

const healthRoute = new Hono();

healthRoute.get("/", c => {
	return c.body(null, 200);
});

export { healthRoute };
