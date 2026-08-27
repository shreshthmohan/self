import type {
	EntryContext,
	HandleErrorFunction,
	RouterContextProvider,
} from "react-router";
import { isRouteErrorResponse, ServerRouter } from "react-router";
import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";

export default async function handleRequest(
	request: Request,
	responseStatusCode: number,
	responseHeaders: Headers,
	routerContext: EntryContext,
	_loadContext: RouterContextProvider,
) {
	let shellRendered = false;
	const userAgent = request.headers.get("user-agent");

	const body = await renderToReadableStream(
		<ServerRouter context={routerContext} url={request.url} />,
		{
			onError(error: unknown) {
				responseStatusCode = 500;
				// Log streaming rendering errors from inside the shell.  Don't log
				// errors encountered during initial shell rendering since they'll
				// reject and get logged in handleDocumentRequest.
				if (shellRendered) {
					console.error(error);
				}
			},
		},
	);
	shellRendered = true;

	// Ensure requests from bots and SPA Mode renders wait for all content to load before responding
	// https://react.dev/reference/react-dom/server/renderToPipeableStream#waiting-for-all-content-to-load-for-crawlers-and-static-generation
	if ((userAgent && isbot(userAgent)) || routerContext.isSpaMode) {
		await body.allReady;
	}

	responseHeaders.set("Content-Type", "text/html");
	return new Response(body, {
		headers: responseHeaders,
		status: responseStatusCode,
	});
}

/**
 * Every loader and action error arrives here, including the ones React Router
 * catches and renders as a 500.
 *
 * The default handler passes the error object to `console.error` and stops
 * there. Two things hide behind that:
 *
 *   - Drizzle wraps EVERY D1 failure in a `DrizzleQueryError` whose own
 *     message is the SQL it sent. The D1 reason is in `cause`, and D1 nests a
 *     second `cause` under that (`cloudflare-internal:d1-api`, `_sendOrThrow`).
 *   - A log reader that renders `stack` and not `message` drops the reason
 *     even once the chain is walked, because a stack carries no message line
 *     of its own.
 *
 * So the chain is read to a depth of five and each link is FORMATTED AS TEXT.
 * The line holds the name, the message, and the first stack frame; a message
 * in a string cannot be dropped by whatever reads the log.
 */
const describe = (value: unknown): string => {
	if (!(value instanceof Error)) return String(value);
	// The frame is the useful half of a stack here. The whole chain shares one
	// call path, so five repeats of it bury the five messages.
	const frame = value.stack?.split("\n")[1]?.trim() ?? "";
	return `${value.name}: ${value.message}${frame ? ` | ${frame}` : ""}`;
};

export const handleError: HandleErrorFunction = (error, { request }) => {
	// An aborted request errors on the way out. Nothing failed; the reader left.
	if (request.signal.aborted) return;

	// A route error response carries the real error under `error`; React
	// Router's own default handler unwraps it the same way.
	const thrown =
		isRouteErrorResponse(error) && "error" in error ? error.error : error;

	const chain: string[] = [describe(thrown)];
	let cause: unknown = thrown instanceof Error ? thrown.cause : undefined;
	for (let depth = 1; cause !== undefined && depth <= 5; depth++) {
		chain.push(`cause[${depth}] ${describe(cause)}`);
		cause = cause instanceof Error ? cause.cause : undefined;
	}

	console.error(`${request.method} ${request.url} :: ${chain.join(" <- ")}`);
	// The stack goes out separately, so the line above stays readable and the
	// call path is still there when it is needed.
	if (thrown instanceof Error) console.error(thrown);
};
