import { env } from "cloudflare:workers";

/**
 * Magic-link mail, over a plain `fetch` to Resend. No SDK: one POST with a
 * JSON body needs no library, and a library is one more version to hold.
 * See ADR 0008.
 */
const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** A subdomain, so the apex zone that serves the site keeps its reputation. */
const FROM = "Shreshth <auth@send.shreshth.dev>";
const REPLY_TO = "shreshthmohan@hey.com";

/**
 * A failure of the Resend API itself, as against a refused address.
 *
 * The two are told apart on purpose. An unknown address gets the same generic
 * notice as every other unpermitted request, because saying more would make an
 * existence oracle. A transport failure happens either side of that check and
 * so leaks nothing, and hiding it strands the only person who can fix it.
 */
export class MailTransportError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "MailTransportError";
	}
}

export async function sendMagicLinkEmail(args: {
	email: string;
	url: string;
}): Promise<void> {
	// Local development does not send. The operator copies the URL from the
	// Worker console. `dev` and `main` both send for real.
	if (import.meta.env.DEV) {
		console.log(`\n  magic link for ${args.email}:\n  ${args.url}\n`);
		return;
	}

	// Plain text, the URL on its own line, no button. A button is a link a
	// reader cannot inspect before clicking and a filter cannot read.
	const body = {
		from: FROM,
		to: [args.email],
		reply_to: REPLY_TO,
		subject: "Your sign-in link",
		text: [
			"Open this link to sign in. It expires in 15 minutes and works once.",
			"",
			args.url,
			"",
			"If you did not ask for this, ignore it.",
		].join("\n"),
	};

	let response: Response;
	try {
		response = await fetch(RESEND_ENDPOINT, {
			method: "POST",
			headers: {
				authorization: `Bearer ${env.RESEND_API_KEY}`,
				"content-type": "application/json",
			},
			body: JSON.stringify(body),
		});
	} catch (cause) {
		console.error("resend: request failed", cause);
		throw new MailTransportError("The mail service could not be reached.");
	}

	if (!response.ok) {
		// The address is never logged with the failure — Workers Logs is not the
		// place to accumulate addresses that tried to sign in.
		console.error(`resend: ${response.status} ${await response.text()}`);
		throw new MailTransportError("The mail service refused the message.");
	}
}
