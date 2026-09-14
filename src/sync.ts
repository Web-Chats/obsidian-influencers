import type { InfluencerApi } from './api';
import { humanizeError, isVersionConflict } from './core/api-error';
import { clearPendingComment, extractPendingComment } from './core/comments';
import {
	createInfluencerUpdate,
	detectEditableChanges,
	editableValuesFromInfluencer,
	hasChanges,
} from './core/changes';
import { parseNote } from './core/frontmatter';
import { notePath } from './core/paths';
import { renderInfluencerNote } from './core/render';
import type { NoteFile, NoteStore } from './note-store';
import type {
	EditableChanges,
	EditableValues,
	Influencer,
	InfluencerComment,
	InfluencerDetails,
	SyncSettings,
	SyncState,
} from './types';

export interface SyncReporter {
	onConflict(displayName: string): void;
	onError(message: string): void;
}

export interface SyncResult {
	total: number;
	created: number;
	updated: number;
	skipped: number;
	conflicts: number;
	errors: number;
	writeAllowed: boolean;
}

export class ReadPermissionError extends Error {
	constructor() {
		super('Jira did not grant read access to the influencer registry.');
		this.name = 'ReadPermissionError';
	}
}

function noteInfluencerId(note: NoteFile): number | null {
	const value = parseNote(note.content).frontmatter.influencerId;
	return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

function noteVersion(frontmatter: Record<string, unknown>): number | null {
	const value = frontmatter.version;
	return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

function unappliedChanges(changes: EditableChanges, remote: EditableValues): EditableChanges {
	const result: EditableChanges = {};
	for (const [field, value] of Object.entries(changes)) {
		const key = field as keyof EditableValues;
		if (value !== remote[key]) {
			result[key] = value as never;
		}
	}
	return result;
}

export class InfluencerSyncService {
	constructor(
		private readonly api: InfluencerApi,
		private readonly notes: NoteStore,
		private readonly settings: SyncSettings,
		private readonly state: SyncState,
		private readonly reporter: SyncReporter,
		private readonly now: () => Date = () => new Date(),
	) {}

	async sync(): Promise<SyncResult> {
		const meta = await this.api.getMeta();
		if (meta.permissions.read !== true) {
			throw new ReadPermissionError();
		}
		await this.notes.prepare();
		let aiContractErrors = 0;
		try {
			await this.notes.writeAiContract(await this.api.getAiCardContract());
		} catch (error) {
			aiContractErrors = 1;
			this.reporter.onError(`AI contract: ${humanizeError(error)}`);
		}
		const existingNotes = await this.notes.listNotes();
		const notesById = new Map<number, NoteFile>();
		const duplicateIds = new Set<number>();
		let indexErrors = 0;
		for (const note of existingNotes) {
			const id = noteInfluencerId(note);
			if (id === null) {
				continue;
			}
			if (notesById.has(id)) {
				duplicateIds.add(id);
				notesById.delete(id);
				indexErrors += 1;
				this.reporter.onError(`Multiple notes have influencerId ${id}; all were left unchanged.`);
			} else if (!duplicateIds.has(id)) {
				notesById.set(id, note);
			}
		}

		const influencers = await this.api.listInfluencers();
		const result: SyncResult = {
			total: influencers.length,
			created: 0,
			updated: 0,
			skipped: 0,
			conflicts: 0,
			errors: indexErrors + aiContractErrors,
			writeAllowed: meta.permissions.write === true,
		};
		for (const influencer of influencers) {
			if (duplicateIds.has(influencer.id)) {
				result.errors += 1;
				continue;
			}
			try {
				await this.syncInfluencer(influencer, notesById.get(influencer.id) ?? null, result);
			} catch (error) {
				result.errors += 1;
				this.reporter.onError(`${influencer.displayName}: ${humanizeError(error)}`);
			}
		}
		return result;
	}

	private async syncInfluencer(
		listed: Influencer,
		existing: NoteFile | null,
		result: SyncResult,
	): Promise<void> {
		const parsed = existing ? parseNote(existing.content) : { frontmatter: {}, body: '' };
		const localVersion = noteVersion(parsed.frontmatter);
		let pendingComment = existing ? extractPendingComment(existing.content) : '';
		let current = listed;
		let conflictChanges: EditableChanges | undefined;
		let mutationApplied = false;
		let postedComment: InfluencerComment | null = null;
		const storedBaseline = this.state.baselines[String(listed.id)];
		const baselineIsReliable = storedBaseline?.version === localVersion;
		const comparisonFields = baselineIsReliable
			? storedBaseline.fields
			: editableValuesFromInfluencer(listed);
		let localChanges = existing
			? detectEditableChanges(parsed.frontmatter, comparisonFields)
			: {};

		if (existing && this.settings.writeBackEnabled && result.writeAllowed) {
			if (pendingComment) {
				if (pendingComment.length > 4000) {
					throw new Error('The pending comment exceeds the Jira limit of 4000 characters.');
				}
				postedComment = await this.api.addComment(listed.id, pendingComment);
				existing = await this.notes.write(
					existing,
					existing.path,
					clearPendingComment(existing.content),
				);
				pendingComment = '';
				mutationApplied = true;
				this.state.pendingRefresh[String(listed.id)] = true;
			}

			if (hasChanges(localChanges)) {
				const fresh = await this.api.getInfluencer(listed.id);
				current = fresh;
				localChanges = unappliedChanges(localChanges, editableValuesFromInfluencer(fresh));
				if (hasChanges(localChanges) && localVersion !== fresh.version) {
					conflictChanges = localChanges;
				} else if (hasChanges(localChanges)) {
					try {
						current = await this.api.updateInfluencer(
							listed.id,
							createInfluencerUpdate(fresh, localChanges),
						);
						mutationApplied = true;
					} catch (error) {
						if (!isVersionConflict(error)) {
							throw error;
						}
						current = await this.api.getInfluencer(listed.id);
						conflictChanges = unappliedChanges(
							localChanges,
							editableValuesFromInfluencer(current),
						);
					}
				}
			}
		}

		if (
			existing
			&& localVersion !== current.version
			&& hasChanges(localChanges)
			&& !mutationApplied
			&& !conflictChanges
		) {
			conflictChanges = unappliedChanges(
				localChanges,
				editableValuesFromInfluencer(current),
			);
		}

		const needsRefresh = this.state.pendingRefresh[String(listed.id)] === true;
		const shouldRender = !existing
			|| localVersion !== current.version
			|| mutationApplied
			|| needsRefresh
			|| (conflictChanges !== undefined && hasChanges(conflictChanges));
		if (!shouldRender) {
			if (!storedBaseline && !hasChanges(localChanges)) {
				this.state.baselines[String(current.id)] = {
					version: current.version,
					fields: editableValuesFromInfluencer(current),
				};
			}
			result.skipped += 1;
			return;
		}

		const details = await this.loadDetails(current.id);
		if (postedComment && !details.comments.some((comment) => comment.id === postedComment?.id)) {
			details.comments.unshift(postedComment);
		}
		const content = renderInfluencerNote(
			current,
			details,
			this.now().toISOString(),
			pendingComment,
			conflictChanges,
		);
		await this.notes.write(existing, notePath(this.settings.folder, current.id, current.displayName), content);
		this.state.baselines[String(current.id)] = {
			version: current.version,
			fields: editableValuesFromInfluencer(current),
		};
		delete this.state.pendingRefresh[String(current.id)];
		if (!existing) {
			result.created += 1;
		} else {
			result.updated += 1;
		}
		if (conflictChanges && hasChanges(conflictChanges)) {
			result.conflicts += 1;
			this.reporter.onConflict(current.displayName);
		}
	}

	private async loadDetails(id: number): Promise<InfluencerDetails> {
		const [accounts, participations, comments] = await Promise.all([
			this.api.listAccounts(id),
			this.api.listParticipations(id),
			this.api.listComments(id),
		]);
		return { accounts, participations, comments };
	}
}
