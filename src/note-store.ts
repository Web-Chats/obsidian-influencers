import { normalizePath, TFile, TFolder, type Vault } from 'obsidian';
import { AI_CONTRACT_MARKER, renderAiContractFiles } from './core/ai-contract';
import { normalizeFolder } from './core/paths';
import type { AiCardContract } from './types';

export interface NoteFile {
	path: string;
	content: string;
}

export interface NoteStore {
	prepare(): Promise<void>;
	writeAiContract(contract: AiCardContract): Promise<void>;
	listNotes(): Promise<NoteFile[]>;
	write(existing: NoteFile | null, desiredPath: string, content: string): Promise<NoteFile>;
}

export class ObsidianNoteStore implements NoteStore {
	private readonly folder: string;

	constructor(private readonly vault: Vault, folder: string) {
		this.folder = normalizePath(normalizeFolder(folder));
	}

	async prepare(): Promise<void> {
		const parts = this.folder.split('/');
		let current = '';
		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			const entry = this.vault.getAbstractFileByPath(current);
			if (entry instanceof TFile) {
				throw new Error(`Cannot create notes folder: ${current} is a file.`);
			}
			if (!(entry instanceof TFolder)) {
				await this.vault.createFolder(current);
			}
		}
	}

	async listNotes(): Promise<NoteFile[]> {
		const prefix = `${this.folder}/`;
		const files = this.vault.getMarkdownFiles().filter((file) => file.path.startsWith(prefix));
		return Promise.all(files.map(async (file) => ({
			path: file.path,
			content: await this.vault.read(file),
		})));
	}

	async writeAiContract(contract: AiCardContract): Promise<void> {
		const files = renderAiContractFiles(contract);
		const folder = `${this.folder}/_AI`;
		const folderEntry = this.vault.getAbstractFileByPath(folder);
		if (folderEntry instanceof TFile) {
			throw new Error(`Cannot create AI contract folder: ${folder} is a file.`);
		}
		if (!(folderEntry instanceof TFolder)) {
			await this.vault.createFolder(folder);
		}
		const writes = [
			{ path: `${folder}/influencer-card.schema.json`, content: files.schema },
			{ path: `${folder}/AI-INSTRUCTIONS.md`, content: files.prompt },
		];
		const existing = await Promise.all(writes.map(async (write) => {
			const entry = this.vault.getAbstractFileByPath(write.path);
			if (entry instanceof TFolder) {
				throw new Error(`Refusing to overwrite folder: ${write.path}`);
			}
			if (!(entry instanceof TFile)) {
				return null;
			}
			const content = await this.vault.read(entry);
			if (!content.includes(AI_CONTRACT_MARKER)) {
				throw new Error(`Refusing to overwrite unmanaged file: ${write.path}`);
			}
			return { entry, content };
		}));
		for (let index = 0; index < writes.length; index += 1) {
			const write = writes[index]!;
			const current = existing[index];
			if (!current) {
				await this.vault.create(write.path, write.content);
			} else if (current.content !== write.content) {
				await this.vault.modify(current.entry, write.content);
			}
		}
	}

	async write(existing: NoteFile | null, desiredPath: string, content: string): Promise<NoteFile> {
		let file: TFile;
		if (existing) {
			const entry = this.vault.getAbstractFileByPath(existing.path);
			if (!(entry instanceof TFile)) {
				throw new Error(`Influencer note disappeared: ${existing.path}`);
			}
			file = entry;
			if (file.path !== desiredPath) {
				const collision = this.vault.getAbstractFileByPath(desiredPath);
				if (collision) {
					throw new Error(`Refusing to overwrite existing note: ${desiredPath}`);
				}
				await this.vault.rename(file, desiredPath);
			}
			if (existing.content !== content || existing.path !== desiredPath) {
				await this.vault.modify(file, content);
			}
		} else {
			if (this.vault.getAbstractFileByPath(desiredPath)) {
				throw new Error(`Refusing to overwrite existing note: ${desiredPath}`);
			}
			file = await this.vault.create(desiredPath, content);
		}
		return { path: file.path, content };
	}
}
