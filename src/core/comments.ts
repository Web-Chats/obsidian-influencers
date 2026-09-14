import type { EditableChanges } from '../types';

export const COMMENTS_MARKER = '<!-- comments -->';
export const CONFLICT_HEADING = '## Не отправлено (конфликт)';

function splitAfterMarker(content: string): { before: string; pending: string; suffix: string } | null {
	const normalized = content.replace(/\r\n/g, '\n');
	const markerIndex = normalized.indexOf(COMMENTS_MARKER);
	if (markerIndex === -1) {
		return null;
	}
	const start = markerIndex + COMMENTS_MARKER.length;
	const afterMarker = normalized.slice(start);
	const conflictIndex = afterMarker.indexOf(`\n${CONFLICT_HEADING}`);
	return {
		before: normalized.slice(0, start),
		pending: conflictIndex === -1 ? afterMarker : afterMarker.slice(0, conflictIndex),
		suffix: conflictIndex === -1 ? '' : afterMarker.slice(conflictIndex + 1),
	};
}

export function extractPendingComment(content: string): string {
	return splitAfterMarker(content)?.pending.trim() ?? '';
}

export function clearPendingComment(content: string): string {
	const parts = splitAfterMarker(content);
	if (!parts) {
		return content;
	}
	const suffix = parts.suffix ? `\n\n${parts.suffix.trim()}\n` : '\n';
	return `${parts.before}${suffix}`;
}

export function formatConflictBlock(changes: EditableChanges): string {
	const lines = Object.entries(changes).map(([field, value]) => (
		`- \`${field}\`: \`${JSON.stringify(value)}\``
	));
	return `${CONFLICT_HEADING}\n\nЛокальные изменения не отправлены автоматически:\n\n${lines.join('\n')}\n`;
}
