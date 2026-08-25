import { env } from "cloudflare:workers";

import { createDb, type Db } from "../db";

/**
 * The D1 handle for one request.
 *
 * `cloudflare:workers` is the only way to reach a binding here. The v8 request
 * handler is built with `new RouterContextProvider()`, which removes the
 * `context.cloudflare.env` object the starter template's loaders read — see
 * the map notes on the four template edits.
 */
export function db(): Db {
	return createDb(env.DB);
}
