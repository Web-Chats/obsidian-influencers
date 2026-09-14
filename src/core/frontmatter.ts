export interface ParsedNote {
	frontmatter: Record<string, unknown>;
	body: string;
}

const FRONTMATTER_LINE = /^([^:#][^:]*):(?:\s*(.*))?$/;

function parseScalar(raw: string): unknown {
	const value = raw.trim();
	if (value === '' || value === 'null' || value === '~') {
		return null;
	}
	if (value === 'true') {
		return true;
	}
	if (value === 'false') {
		return false;
	}
	if (/^-?\d+(?:\.\d+)?$/.test(value)) {
		return Number(value);
	}
	if (value.startsWith('"') || value.startsWith('[') || value.startsWith('{')) {
		try {
			return JSON.parse(value);
		} catch {
			return value;
		}
	}
	if (value.startsWith("'") && value.endsWith("'")) {
		return value.slice(1, -1).replace(/''/g, "'");
	}
	return value;
}

function serializeScalar(value: unknown): string {
	if (value === null || value === undefined) {
		return 'null';
	}
	if (typeof value === 'number' || typeof value === 'boolean') {
		return String(value);
	}
	return JSON.stringify(value);
}

export function parseNote(content: string): ParsedNote {
	const normalized = content.replace(/\r\n/g, '\n');
	if (!normalized.startsWith('---\n')) {
		return { frontmatter: {}, body: normalized };
	}
	const end = normalized.indexOf('\n---\n', 4);
	if (end === -1) {
		return { frontmatter: {}, body: normalized };
	}
	const frontmatter: Record<string, unknown> = {};
	for (const line of normalized.slice(4, end).split('\n')) {
		const match = line.match(FRONTMATTER_LINE);
		if (match?.[1]) {
			frontmatter[match[1].trim()] = parseScalar(match[2] ?? '');
		}
	}
	return {
		frontmatter,
		body: normalized.slice(end + 5),
	};
}

export function buildNote(
	frontmatter: Record<string, unknown>,
	body: string,
	keyOrder: readonly string[],
): string {
	const seen = new Set<string>();
	const lines: string[] = [];
	for (const key of keyOrder) {
		if (Object.prototype.hasOwnProperty.call(frontmatter, key)) {
			lines.push(`${key}: ${serializeScalar(frontmatter[key])}`);
			seen.add(key);
		}
	}
	for (const key of Object.keys(frontmatter).sort()) {
		if (!seen.has(key)) {
			lines.push(`${key}: ${serializeScalar(frontmatter[key])}`);
		}
	}
	return `---\n${lines.join('\n')}\n---\n${body}`;
}
