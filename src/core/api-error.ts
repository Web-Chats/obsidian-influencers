export interface JiraErrorEnvelope {
	code?: string;
	message?: string;
	fieldErrors?: Record<string, string>;
	details?: Record<string, unknown>;
	currentVersion?: number | null;
	requestId?: string;
}

export class JiraApiError extends Error {
	constructor(
		public readonly status: number,
		public readonly code: string,
		message: string,
		public readonly currentVersion: number | null = null,
		public readonly fieldErrors: Record<string, string> = {},
		public readonly requestId: string | null = null,
	) {
		super(message);
		this.name = 'JiraApiError';
	}
}

export function isVersionConflict(error: unknown): error is JiraApiError {
	return error instanceof JiraApiError
		&& error.status === 409
		&& error.code === 'VERSION_CONFLICT';
}

export function humanizeError(error: unknown): string {
	if (error instanceof JiraApiError) {
		if (error.status === 401) {
			return 'Jira rejected the token. Check the personal access token in settings.';
		}
		if (error.status === 403) {
			return `Jira denied this operation. Check the influencer access level. Jira response: ${error.message}`;
		}
		const fields = Object.values(error.fieldErrors).join('; ');
		return fields || error.message || `Jira request failed (${error.status}).`;
	}
	return error instanceof Error ? error.message : 'Unknown synchronization error.';
}
