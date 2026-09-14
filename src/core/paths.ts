export function normalizeFolder(folder: string): string {
	const segments = folder.replace(/\\/g, '/').split('/').filter(Boolean);
	if (segments.length === 0) {
		return 'Influencers';
	}
	if (segments.some((segment) => segment === '.' || segment === '..')) {
		throw new Error('The notes folder cannot contain . or .. segments.');
	}
	return segments.join('/');
}

export function sanitizeFileName(displayName: string): string {
	const withoutControlCharacters = Array.from(displayName.normalize('NFKC'))
		.map((character) => character.charCodeAt(0) < 32 ? '-' : character)
		.join('');
	const sanitized = withoutControlCharacters
		.replace(/[\\/:*?"<>|]/g, '-')
		.replace(/[[\]#^]/g, '-')
		.replace(/\s+/g, ' ')
		.replace(/-+/g, '-')
		.replace(/[. ]+$/g, '')
		.trim();
	return Array.from(sanitized || 'Influencer').slice(0, 120).join('');
}

export function notePath(folder: string, id: number, displayName: string): string {
	return `${normalizeFolder(folder)}/${id} ${sanitizeFileName(displayName)}.md`;
}
