// Headless part of CLAUDE-TESTING.md: everything that does not need the
// Obsidian window. Runs against the local Jira only, and only when INF_PAT is
// in the environment — the token is never printed and never written anywhere.
//
//   INF_PAT=… npx vitest run tests/live-localhost.test.ts
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AI_CONTRACT_MARKER, renderAiContractFiles } from '../src/core/ai-contract';
import { parseNote } from '../src/core/frontmatter';
import type { InfluencerApi } from '../src/api';
import type { NoteFile, NoteStore } from '../src/note-store';
import { InfluencerSyncService } from '../src/sync';
import type {
	AiCardContract,
	Influencer,
	InfluencerAccount,
	InfluencerComment,
	InfluencerParticipation,
	InfluencerUpdate,
	MetaResponse,
	SyncSettings,
	SyncState,
} from '../src/types';

const BASE = process.env.INF_BASE_URL ?? 'http://localhost/rest/asbis-inf/2.0';
const TOKEN = process.env.INF_PAT ?? '';
const live = TOKEN ? describe : describe.skip;

// The plugin talks through Obsidian's requestUrl; headless it is plain fetch.
class FetchApi implements InfluencerApi {
	constructor(private readonly baseUrl: string, private readonly token: string) {}

	private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
		const response = await fetch(`${this.baseUrl}${path}`, {
			method,
			headers: {
				Authorization: `Bearer ${this.token}`,
				Accept: 'application/json',
				// The same headers the plugin sends: a bare application/json is
				// refused by the Jersey 1 runtime with 415.
				...(body === undefined ? {} : {
					'Content-Type': 'application/json; charset=UTF-8',
					'X-Atlassian-Token': 'no-check',
				}),
			},
			body: body === undefined ? undefined : JSON.stringify(body),
		});
		const text = await response.text();
		if (!response.ok) {
			throw new Error(`${method} ${path} → ${response.status}: ${text.slice(0, 200)}`);
		}
		return (text ? JSON.parse(text) : null) as T;
	}

	private async listAll<T>(path: string): Promise<T[]> {
		const items: T[] = [];
		for (let page = 1; page <= 50; page += 1) {
			const separator = path.includes('?') ? '&' : '?';
			const response = await this.request<{ items: T[]; totalPages: number }>(
				'GET', `${path}${separator}page=${page}&pageSize=200`,
			);
			items.push(...(response.items ?? []));
			if (!response.totalPages || page >= response.totalPages) break;
		}
		return items;
	}

	getMeta(): Promise<MetaResponse> {
		return this.request<MetaResponse>('GET', '/meta');
	}

	getAiCardContract(): Promise<AiCardContract> {
		return this.request<AiCardContract>('GET', '/ai/obsidian-card-contract');
	}

	listInfluencers(): Promise<Influencer[]> {
		return this.listAll<Influencer>('/influencers');
	}

	getInfluencer(id: number): Promise<Influencer> {
		return this.request<Influencer>('GET', `/influencers/${id}`);
	}

	updateInfluencer(id: number, update: InfluencerUpdate): Promise<Influencer> {
		return this.request<Influencer>('PUT', `/influencers/${id}`, update);
	}

	listComments(id: number): Promise<InfluencerComment[]> {
		return this.listAll<InfluencerComment>(`/influencers/${id}/comments`);
	}

	addComment(id: number, body: string): Promise<InfluencerComment> {
		return this.request<InfluencerComment>('POST', `/influencers/${id}/comments`, { body });
	}

	listAccounts(id: number): Promise<InfluencerAccount[]> {
		return this.listAll<InfluencerAccount>(`/influencers/${id}/accounts`);
	}

	listParticipations(id: number): Promise<InfluencerParticipation[]> {
		return this.listAll<InfluencerParticipation>(`/influencers/${id}/participations`);
	}
}

class MemoryNoteStore implements NoteStore {
	public contracts: AiCardContract[] = [];

	constructor(public files: NoteFile[] = []) {}

	async prepare(): Promise<void> {}

	async writeAiContract(contract: AiCardContract): Promise<void> {
		// The real store renders the files; rendering is what can fail.
		renderAiContractFiles(contract);
		this.contracts.push(contract);
	}

	async listNotes(): Promise<NoteFile[]> {
		return this.files.map((file) => ({ ...file }));
	}

	async write(existing: NoteFile | null, desiredPath: string, content: string): Promise<NoteFile> {
		const next = { path: desiredPath, content };
		const index = existing ? this.files.findIndex((file) => file.path === existing.path) : -1;
		if (index >= 0) this.files[index] = next;
		else this.files.push(next);
		return next;
	}
}

const SETTINGS: SyncSettings = {
	baseUrl: BASE,
	token: 'unused-by-the-harness',
	folder: 'Influencers',
	intervalMinutes: 60,
	writeBackEnabled: true,
};

function freshState(): SyncState {
	return { baselines: {}, pendingRefresh: {} };
}

function reporter() {
	const errors: string[] = [];
	const conflicts: string[] = [];
	return {
		errors,
		conflicts,
		onError: (message: string) => { errors.push(message); },
		onConflict: (message: string) => { conflicts.push(message); },
	};
}

live('Jira → Obsidian contract, headless', () => {
	const api = new FetchApi(BASE, TOKEN);
	let subject: Influencer;
	let originalMessenger: string | null = null;

	beforeAll(async () => {
		const influencers = await api.listInfluencers();
		expect(influencers.length).toBeGreaterThan(0);
		// An influencer nobody else is editing right now: the last one by id.
		subject = influencers[influencers.length - 1]!;
		originalMessenger = subject.messenger ?? null;
	});

	afterAll(async () => {
		if (!subject) return;
		const current = await api.getInfluencer(subject.id);
		if ((current.messenger ?? null) === originalMessenger) return;
		await api.updateInfluencer(subject.id, {
			...toUpdate(current),
			messenger: originalMessenger,
			version: current.version,
		});
	});

	// Step 1 of the instruction: the contract itself.
	it('serves a contract with exactly the six write-back fields', async () => {
		const contract = await api.getAiCardContract();
		expect(contract.version).toBe(1);
		const changes = (contract.schema as Record<string, any>).properties.changes;
		expect(Object.keys(changes.properties).sort()).toEqual([
			'agencyManager', 'commercialOfferUrl', 'email', 'internalRating', 'messenger', 'realName',
		]);
		expect((contract.schema as Record<string, any>).additionalProperties).toBe(false);
		expect(changes.additionalProperties).toBe(false);
		expect(contract.prompt).toContain(AI_CONTRACT_MARKER);

		const files = renderAiContractFiles(contract);
		expect(files.schema).toContain(AI_CONTRACT_MARKER);
		expect(files.prompt).toContain(AI_CONTRACT_MARKER);
	});

	// Step 4: a file somebody else wrote is never overwritten. The rule lives in
	// the Obsidian store, so the module is loaded with a stubbed vault API.
	it('refuses to overwrite a file without the marker', async () => {
		vi.resetModules();
		class TFile { constructor(public path: string) {} }
		class TFolder { constructor(public path: string) {} }
		vi.doMock('obsidian', () => ({
			TFile, TFolder,
			normalizePath: (value: string) => value,
			requestUrl: async () => { throw new Error('not used'); },
		}));
		const { ObsidianNoteStore } = await import('../src/note-store');
		const written = new Map<string, string>();
		const folders = new Set<string>(['Influencers', 'Influencers/_AI']);
		const vault = {
			getAbstractFileByPath: (path: string) => {
				if (folders.has(path)) return new TFolder(path);
				return written.has(path) ? new TFile(path) : null;
			},
			createFolder: async (path: string) => { folders.add(path); },
			create: async (path: string, content: string) => { written.set(path, content); },
			modify: async (file: TFile, content: string) => { written.set(file.path, content); },
			read: async (file: TFile) => written.get(file.path) ?? '',
		};
		const store = new ObsidianNoteStore(vault as never, 'Influencers');
		const contract = await api.getAiCardContract();

		await store.writeAiContract(contract);
		expect([...written.keys()].sort()).toEqual([
			'Influencers/_AI/AI-INSTRUCTIONS.md',
			'Influencers/_AI/influencer-card.schema.json',
		]);

		// Writing the same contract twice changes nothing.
		const before = new Map(written);
		await store.writeAiContract(contract);
		expect([...written.entries()]).toEqual([...before.entries()]);

		written.set('Influencers/_AI/AI-INSTRUCTIONS.md', 'Мой собственный текст');
		await expect(store.writeAiContract(contract)).rejects.toThrow('Refusing to overwrite unmanaged file');
		expect(written.get('Influencers/_AI/AI-INSTRUCTIONS.md')).toBe('Мой собственный текст');
		vi.doUnmock('obsidian');
	});

	// Step 5: an edit in a note reaches Jira, and only the edited field moves.
	it('sends a messenger edited in the note and bumps the version by one', async () => {
		const notes = new MemoryNoteStore();
		const state = freshState();
		const first = reporter();
		const service = new InfluencerSyncService(api, notes, SETTINGS, state, first);
		const pulled = await service.sync();
		expect(first.errors).toEqual([]);
		expect(pulled.created).toBeGreaterThan(0);

		const note = notes.files.find((file) => parseNote(file.content).frontmatter.influencerId === subject.id);
		expect(note, 'заметка по выбранному инфлюенсеру').toBeTruthy();
		const before = await api.getInfluencer(subject.id);
		note!.content = note!.content.replace(
			/^messenger: .*$/mu, 'messenger: "@obsidian_ai_contract_test"',
		);

		const second = reporter();
		await new InfluencerSyncService(api, notes, SETTINGS, state, second).sync();
		expect(second.errors).toEqual([]);

		const after = await api.getInfluencer(subject.id);
		expect(after.messenger).toBe('@obsidian_ai_contract_test');
		expect(after.version).toBe(before.version + 1);
		expect(after.realName ?? null).toBe(before.realName ?? null);
		expect(after.email ?? null).toBe(before.email ?? null);
		expect(after.comment ?? null).toBe(before.comment ?? null);
		}, 120_000);

	// Step 6: a note that is behind the record never overwrites it.
	it('keeps a change made in Jira while the note was stale', async () => {
		const notes = new MemoryNoteStore();
		const state = freshState();
		await new InfluencerSyncService(api, notes, SETTINGS, state, reporter()).sync();
		const note = notes.files.find((file) => parseNote(file.content).frontmatter.influencerId === subject.id)!;

		// Local edit, not sent yet.
		note.content = note.content.replace(/^messenger: .*$/mu, 'messenger: "@from_the_note"');

		// Somebody else edits the same record in Jira.
		const current = await api.getInfluencer(subject.id);
		const elsewhere = await api.updateInfluencer(subject.id, {
			...toUpdate(current),
			messenger: '@from_jira',
			version: current.version,
		});

		const third = reporter();
		const result = await new InfluencerSyncService(api, notes, SETTINGS, state, third).sync();
		const final = await api.getInfluencer(subject.id);

		expect(final.messenger).toBe('@from_jira');
		expect(final.version).toBe(elsewhere.version);
		expect(result.conflicts).toBeGreaterThan(0);
		const conflicted = notes.files.find(
			(file) => parseNote(file.content).frontmatter.influencerId === subject.id,
		)!;
		expect(conflicted.content).toContain('@from_jira');
		}, 120_000);
});

function toUpdate(influencer: Influencer): InfluencerUpdate {
	return {
		displayName: influencer.displayName,
		realName: influencer.realName ?? null,
		genderId: influencer.genderId ?? null,
		countryId: influencer.countryId ?? null,
		primaryAudienceCountryId: influencer.primaryAudienceCountryId ?? null,
		additionalAudienceCountryIds: influencer.additionalAudienceCountryIds ?? [],
		deliveryCountryId: influencer.deliveryCountryId ?? null,
		languageIds: influencer.languageIds ?? [],
		categoryIds: influencer.categoryIds ?? [],
		communicationEmployeeIds: influencer.communicationEmployeeIds ?? [],
		agencyId: influencer.agencyId ?? null,
		email: influencer.email ?? null,
		messenger: influencer.messenger ?? null,
		agencyManager: influencer.agencyManager ?? null,
		commercialOfferUrl: influencer.commercialOfferUrl ?? null,
		internalRating: influencer.internalRating ?? null,
		comment: influencer.comment ?? null,
		version: influencer.version,
	} as InfluencerUpdate;
}
