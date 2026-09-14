import { describe, expect, it } from 'vitest';
import type { InfluencerApi } from '../src/api';
import { JiraApiError } from '../src/core/api-error';
import { editableValuesFromInfluencer } from '../src/core/changes';
import { extractPendingComment } from '../src/core/comments';
import { parseNote } from '../src/core/frontmatter';
import { renderInfluencerNote } from '../src/core/render';
import type { NoteFile, NoteStore } from '../src/note-store';
import { InfluencerSyncService, ReadPermissionError } from '../src/sync';
import type {
	Influencer,
	InfluencerComment,
	InfluencerUpdate,
	MetaResponse,
	SyncSettings,
	SyncState,
} from '../src/types';
import { emptyDetails, influencer } from './fixtures';

const settings: SyncSettings = {
	baseUrl: 'http://localhost/rest/asbis-inf/2.0',
	token: 'test-only',
	folder: 'Influencers',
	intervalMinutes: 60,
	writeBackEnabled: true,
};

class MemoryNoteStore implements NoteStore {
	constructor(public files: NoteFile[]) {}
	public aiContracts = 0;
	async prepare(): Promise<void> {}
	async writeAiContract(): Promise<void> {
		this.aiContracts += 1;
	}
	async listNotes(): Promise<NoteFile[]> {
		return this.files.map((file) => ({ ...file }));
	}
	async write(existing: NoteFile | null, desiredPath: string, content: string): Promise<NoteFile> {
		const next = { path: desiredPath, content };
		if (existing) {
			const index = this.files.findIndex((file) => file.path === existing.path);
			if (index === -1) {
				throw new Error('Missing memory note');
			}
			this.files[index] = next;
		} else {
			this.files.push(next);
		}
		return next;
	}
}

class FakeApi implements InfluencerApi {
	permissions: MetaResponse['permissions'] = { read: true, write: true, admin: false };
	listed: Influencer[] = [influencer()];
	getQueue: Influencer[] = [];
	updates: InfluencerUpdate[] = [];
	postedComments: string[] = [];
	updateError: unknown = null;
	failDetails = false;
	failAiContract = false;

	async getMeta(): Promise<MetaResponse> {
		return {
			currentUser: { key: 'test', displayName: 'Test User' },
			permissions: this.permissions,
			jiraTimeZone: 'Europe/Kyiv',
			apiVersion: '2.0',
		};
	}
	async getAiCardContract() {
		if (this.failAiContract) throw new Error('Contract endpoint unavailable');
		return {
			version: 1,
			schema: {
				$comment: 'Managed by Influencer Sync; source: Jira /ai/obsidian-card-contract',
				properties: { changes: { properties: {
					realName: {}, email: {}, messenger: {}, agencyManager: {},
					commercialOfferUrl: {}, internalRating: {},
				} } },
			},
			prompt: '<!-- Managed by Influencer Sync; source: Jira /ai/obsidian-card-contract -->',
		};
	}
	async listInfluencers(): Promise<Influencer[]> {
		return this.listed;
	}
	async getInfluencer(): Promise<Influencer> {
		const next = this.getQueue.shift();
		if (!next) throw new Error('Unexpected GET influencer');
		return next;
	}
	async updateInfluencer(_id: number, update: InfluencerUpdate): Promise<Influencer> {
		this.updates.push(update);
		if (this.updateError) throw this.updateError;
		return influencer({ ...update, id: 42, version: update.version + 1, status: 'ACTIVE' });
	}
	async listComments(): Promise<InfluencerComment[]> {
		return this.postedComments.map((body, index) => ({
			id: index + 1,
			influencerId: 42,
			body,
			createdAt: '2026-09-11T08:00:00+03:00',
			createdBy: { key: 'test', displayName: 'Test User' },
		}));
	}
	async addComment(_id: number, body: string): Promise<InfluencerComment> {
		this.postedComments.push(body);
		return (await this.listComments())[0]!;
	}
	async listAccounts(): Promise<[]> {
		if (this.failDetails) throw new Error('Detail read failed');
		return [];
	}
	async listParticipations(): Promise<[]> {
		return [];
	}
}

function initialState(remote: Influencer): SyncState {
	return {
		baselines: {
			[String(remote.id)]: {
				version: remote.version,
				fields: editableValuesFromInfluencer(remote),
			},
		},
		pendingRefresh: {},
	};
}

function noteFor(remote: Influencer, pending = ''): NoteFile {
	return {
		path: `Influencers/${remote.id} ${remote.displayName}.md`,
		content: renderInfluencerNote(remote, emptyDetails, '2026-09-11T05:00:00.000Z', pending),
	};
}

describe('version conflicts', () => {
	it('does not retry PUT and keeps local edits outside the refreshed card', async () => {
		const original = influencer();
		const localNote = noteFor(original);
		localNote.content = localNote.content.replace('email: "old@example.com"', 'email: "local@example.com"');
		const latest = influencer({ version: 8, messenger: '@changed-by-someone-else' });
		const api = new FakeApi();
		api.getQueue = [original, latest];
		api.updateError = new JiraApiError(409, 'VERSION_CONFLICT', 'Version conflict', 8);
		const notes = new MemoryNoteStore([localNote]);
		const conflicts: string[] = [];
		const state = initialState(original);

		const result = await new InfluencerSyncService(api, notes, settings, state, {
			onConflict: (name) => conflicts.push(name),
			onError: (message) => { throw new Error(message); },
		}).sync();

		expect(api.updates).toHaveLength(1);
		expect(api.updates[0]?.version).toBe(7);
		expect(result.conflicts).toBe(1);
		expect(conflicts).toEqual(['Travel Kate']);
		const saved = notes.files[0]!.content;
		const frontmatter = parseNote(saved).frontmatter;
		expect(frontmatter.version).toBe(8);
		expect(frontmatter.email).toBe('old@example.com');
		expect(frontmatter.messenger).toBe('@changed-by-someone-else');
		expect(saved).toContain('## Не отправлено (конфликт)');
		expect(saved).toContain('`email`: `"local@example.com"`');
	});
});

describe('comment delivery', () => {
	it('checkpoints a successful POST so a later failure cannot resend it', async () => {
		const remote = influencer();
		const api = new FakeApi();
		api.failDetails = true;
		const notes = new MemoryNoteStore([noteFor(remote, 'Send exactly once')]);
		const errors: string[] = [];
		const state = initialState(remote);
		const service = () => new InfluencerSyncService(api, notes, settings, state, {
			onConflict: () => {},
			onError: (message) => errors.push(message),
		});

		const first = await service().sync();
		expect(first.errors).toBe(1);
		expect(api.postedComments).toEqual(['Send exactly once']);
		expect(extractPendingComment(notes.files[0]!.content)).toBe('');
		expect(state.pendingRefresh['42']).toBe(true);

		api.failDetails = false;
		const second = await service().sync();
		expect(second.errors).toBe(0);
		expect(api.postedComments).toEqual(['Send exactly once']);
		expect(state.pendingRefresh['42']).toBeUndefined();
		expect(notes.files[0]!.content).toContain('Send exactly once');
	});
});

describe('permissions', () => {
	it('stops before listing notes without read permission', async () => {
		const api = new FakeApi();
		api.permissions.read = false;
		const service = new InfluencerSyncService(
			api,
			new MemoryNoteStore([]),
			settings,
			{ baselines: {}, pendingRefresh: {} },
			{ onConflict: () => {}, onError: () => {} },
		);
		await expect(service.sync()).rejects.toBeInstanceOf(ReadPermissionError);
	});

	it('keeps pending writes local when Jira grants read only', async () => {
		const remote = influencer();
		const api = new FakeApi();
		api.permissions.write = false;
		const notes = new MemoryNoteStore([noteFor(remote, 'Keep local')]);
		const result = await new InfluencerSyncService(
			api,
			notes,
			settings,
			initialState(remote),
			{ onConflict: () => {}, onError: () => {} },
		).sync();
		expect(result.writeAllowed).toBe(false);
		expect(api.postedComments).toEqual([]);
		expect(extractPendingComment(notes.files[0]!.content)).toBe('Keep local');
	});
});

describe('AI contract download', () => {
	it('reports a contract failure without stopping card synchronization', async () => {
		const api = new FakeApi();
		api.failAiContract = true;
		const notes = new MemoryNoteStore([]);
		const errors: string[] = [];
		const result = await new InfluencerSyncService(
			api,
			notes,
			settings,
			{ baselines: {}, pendingRefresh: {} },
			{ onConflict: () => {}, onError: (message) => errors.push(message) },
		).sync();

		expect(result.created).toBe(1);
		expect(result.errors).toBe(1);
		expect(errors).toEqual(['AI contract: Contract endpoint unavailable']);
	});
});
