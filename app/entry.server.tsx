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
 * The default handler logs the error alone. Drizzle wraps EVERY D1 failure in
 * a `DrizzleQueryError` whose message is the SQL it sent, and puts the D1
 * reason — the `D1_ERROR: ...` string, the one line that names the fault — in
 * `cause`. So the default logs a stack that says where, and never says what.
 *
 * The chain is walked rather than read once: a cause can carry its own.
 */
export const handleError: HandleErrorFunction = (error, { request }) => {
	// An aborted request errors on the way out. Nothing failed; the reader left.
	if (request.signal.aborted) return;

	// A route error response carries the real error under `error`; React
	// Router's own default handler unwraps it the same way.
	const thrown =
		isRouteErrorResponse(error) && "error" in error ? error.error : error;
	console.error(`${request.method} ${request.url}`, thrown);

	let cause: unknown = thrown instanceof Error ? thrown.cause : undefined;
	for (let depth = 1; cause !== undefined && depth <= 5; depth++) {
		console.error(`  cause[${depth}]:`, cause);
		cause = cause instanceof Error ? cause.cause : undefined;
	}
};
