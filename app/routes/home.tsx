import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "shreshth.dev" },
		{ name: "description", content: "Notes, decisions, and other records." },
	];
}

// A placeholder. Entry CRUD for decision and ethos (issue #52) replaces it
// with the real listing.
export default function Home() {
	return (
		<main>
			<h1 className="text-2xl font-semibold">shreshth.dev</h1>
			<p className="mt-2">The site is here. There is nothing to read yet.</p>
		</main>
	);
}
