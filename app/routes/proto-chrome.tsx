/**
 * PROTOTYPE — issue #71, "Site chrome and design tokens". Throwaway. This file
 * never reaches `main`; only the decisions it settles do.
 *
 * Settled, and therefore FIXED here rather than switchable: the headings are
 * Fraunces and nothing else loads a webfont; the greys are Tailwind's stone
 * scale; codeuncode's animated backdrop is dropped; the header is a full-width
 * rule with no fill; the footer carries links on a plain rule.
 *
 * Two axes are left open, because each is a thing you have to look at:
 *
 *   ?body=system|karla       is a 0 KB system stack good enough for prose?
 *   ?palette=stone|tusker    what does dropping the cream actually cost?
 *
 * The tokens all live in `app/app.css`. Reading this page IS reading them.
 */
import type { Route } from "./+types/proto-chrome";

const BODY = ["system", "karla"];
const PALETTE = ["stone", "tusker"];

export function loader({ request }: Route.LoaderArgs) {
	const p = new URL(request.url).searchParams;
	const pick = (k: string, list: string[]) =>
		list.includes(p.get(k) ?? "") ? (p.get(k) as string) : list[0];
	return { body: pick("body", BODY), palette: pick("palette", PALETTE) };
}

export function meta() {
	return [{ title: "Chrome prototype — #71" }];
}

export default function ProtoChrome({ loaderData }: Route.ComponentProps) {
	return (
		<div
			data-body={loaderData.body}
			data-palette={loaderData.palette}
			className="min-h-screen pb-32"
		>
			<Header />

			<main className="mx-auto max-w-2xl px-4 py-10">
				<p className="text-sm text-muted">
					<a className="underline" href="/proto-chrome">
						All entries
					</a>
					{" · "}
					<a className="underline" href="/proto-chrome">
						Edit
					</a>
				</p>

				<article className="mt-6">
					<h1 className="text-4xl">Why the editor is a textarea first</h1>
					<p className="mt-2 text-sm text-dim">decision · 12 August 2026</p>

					<nav className="mt-8 border-l-2 border-border pl-4">
						<h2 className="font-sans text-xs tracking-widest text-dim uppercase">
							On this page
						</h2>
						<ul className="mt-2 space-y-1 text-sm">
							<li>
								<a className="underline" href="#context">
									Context
								</a>
							</li>
							<li>
								<a className="underline" href="#decision">
									Decision
								</a>
							</li>
							<li>
								<a className="underline" href="#cost">
									What it costs
								</a>
							</li>
						</ul>
					</nav>

					<section className="mt-10">
						<h2 id="context" className="text-2xl">
							Context
						</h2>
						<div className="prose mt-3">
							<p>
								Every route on this site renders with JavaScript off, and every
								mutation submits with JavaScript off. That rule is not about the
								reader who disables scripts. It is about the hydration gap: the
								server sends HTML before the runtime arrives, and in that window
								a link that is not a link and a button that is not a button do
								nothing at all.
							</p>
							<p>
								A rich-text editor breaks the rule twice. It replaces the field
								with a contenteditable surface that holds no value a form can
								post, and it holds the document in a shape only its own
								serialiser understands. Turn the runtime off and the page is a
								box you cannot type into, wired to a form that would send
								nothing if you could.
							</p>
							<blockquote>
								Losing content is allowed. Losing it without being asked is not.
							</blockquote>
						</div>
					</section>

					<section className="mt-10">
						<h2 id="decision" className="text-2xl">
							Decision
						</h2>
						<div className="prose mt-3">
							<p>
								Markdown is the stored value. A named{" "}
								<code>&lt;textarea&gt;</code> in a real form is the editor.
								TipTap loads lazily and takes over that same field, so the
								enhancement is additive and the field never stops being the
								thing the form posts.
							</p>
							<p>A fidelity gate guards the handover. On mount it:</p>
							<ul>
								<li>parses the stored markdown into the editor document,</li>
								<li>serialises that document straight back to markdown,</li>
								<li>
									renders <em>both</em> strings through <code>marked</code>, and
								</li>
								<li>compares the rendered HTML, not the bytes.</li>
							</ul>
							<p>
								It enhances only if a reader would see the same page. A refusal
								keeps the textarea and offers the author the diff.
							</p>
							<pre>
								<code>{`const before = marked(stored)
const after = marked(serialize(parse(stored)))
if (before !== after) return keepTextarea(diff(before, after))`}</code>
							</pre>
							<p>
								Byte equality was measured first and rejected. Serialisation
								pads table columns and adds a trailing newline, so it refuses
								plain prose and still cannot tell a lost table from a padded
								one. See <a href="#cost">what it costs</a> for the numbers.
							</p>
						</div>
					</section>

					<section className="mt-10">
						<h2 id="cost" className="text-2xl">
							What it costs
						</h2>
						<div className="prose mt-3">
							<p>
								TipTap is 146 kB gzip against a bare React build. It arrives as
								a lazy chunk, so first paint pays about 4 kB and a read page
								pays nothing at all. The alternative that lost, a full markdown
								editor component, measured 357 kB — the research note that
								claimed 6 kB was wrong by sixty times.
							</p>
							<h3 className="mt-6 text-lg">A note on the numbers</h3>
							<p>
								Every figure here came off a real deploy, not a local build. The
								edge compresses as a stream at a lower setting than{" "}
								<code>zlib</code> uses by default, so local gzip readings run
								optimistic by a wide margin at every length.
							</p>
						</div>
					</section>
				</article>

				<h2 className="mt-16 text-2xl">More entries</h2>
				<ul className="mt-4 space-y-5">
					{[
						["How the site gets its owner", "decision"],
						["Write the thing that is hard to say", "ethos"],
						["Rate limits belong in two layers", "decision"],
					].map(([title, kind]) => (
						<li key={title}>
							<h3 className="text-xl">
								<a
									className="underline decoration-border underline-offset-4"
									href="/proto-chrome"
								>
									{title}
								</a>
							</h3>
							<p className="mt-1 text-sm text-muted">{kind}</p>
						</li>
					))}
				</ul>
			</main>

			<Footer />
			<Bar current={loaderData} />
		</div>
	);
}

/** A full-width rule, no fill. Title home, owner-only New entry, Log out. */
function Header() {
	return (
		<header className="border-b border-border py-4">
			<div className="mx-auto flex max-w-2xl items-baseline gap-4 px-4">
				<a href="/proto-chrome" className="font-serif text-xl">
					shreshth.dev
				</a>
				<nav className="ml-auto flex items-baseline gap-4 text-sm">
					<a className="underline" href="/proto-chrome">
						New entry
					</a>
					<form method="post" action="/logout">
						<button type="submit" className="underline">
							Log out
						</button>
					</form>
				</nav>
			</div>
		</header>
	);
}

/** Links, on a plain rule — no surface fill. */
function Footer() {
	return (
		<footer className="mx-auto mt-16 max-w-2xl border-t border-border px-4 py-8">
			<div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
				<span className="text-dim">Shreshth Mohan</span>
				<a className="ml-auto underline" href="/proto-chrome">
					Feed
				</a>
				<a className="underline" href="/proto-chrome">
					GitHub
				</a>
				<a className="underline" href="/proto-chrome">
					Source
				</a>
			</div>
		</footer>
	);
}

function Bar({ current }: { current: Record<string, string> }) {
	const row = (axis: string, values: string[]) => (
		<div key={axis} className="flex flex-wrap items-baseline gap-2">
			<span className="w-16 shrink-0 text-dim">{axis}</span>
			{values.map((val) => (
				<a
					key={val}
					href={`/proto-chrome?${new URLSearchParams({ ...current, [axis]: val })}`}
					className={
						current[axis] === val
							? "rounded bg-accent px-2 py-0.5 text-accent-ink"
							: "rounded border border-border px-2 py-0.5"
					}
				>
					{val}
				</a>
			))}
		</div>
	);

	return (
		<div className="fixed inset-x-0 bottom-0 border-t border-border bg-surface-2/95 backdrop-blur">
			<div className="mx-auto max-w-3xl space-y-1.5 px-4 py-3 font-mono text-xs">
				{row("body", BODY)}
				{row("palette", PALETTE)}
				<p className="pt-1 text-dim">
					Webfont on the wire: Fraunces roman, 67.4 KB. Body and mono are
					system faces, 0 KB. Karla would add 48.8 KB. The site ships 152.8 KB
					of Inter today.
				</p>
			</div>
		</div>
	);
}
