import { Notice, Plugin } from 'obsidian';
import { RequestUrlInfluencerApi } from './api';
import { humanizeError } from './core/api-error';
import { ObsidianNoteStore } from './note-store';
import { DEFAULT_SETTINGS, InfluencerSyncSettingTab } from './settings';
import { InfluencerSyncService } from './sync';
import { confirmSync, type SyncMode } from './sync-confirmation';
import type { SyncSettings, SyncState } from './types';

interface StoredData {
	settings: SyncSettings;
	state: SyncState;
	lastSyncedAt: string | null;
}

const EMPTY_STATE: SyncState = {
	baselines: {},
	pendingRefresh: {},
};

export default class InfluencerSyncPlugin extends Plugin {
	settings: SyncSettings = { ...DEFAULT_SETTINGS };
	private state: SyncState = structuredClone(EMPTY_STATE);
	private lastSyncedAt: string | null = null;
	private statusBarItem!: HTMLElement;
	private intervalId: number | null = null;
	private syncing = false;
	private confirming = false;

	async onload(): Promise<void> {
		await this.loadPluginData();
		this.statusBarItem = this.addStatusBarItem();
		this.statusBarItem.setAttribute('role', 'button');
		this.statusBarItem.setAttribute('tabindex', '0');
		this.statusBarItem.setAttribute('aria-label', 'Download influencers from Jira');
		this.registerDomEvent(this.statusBarItem, 'click', () => void this.runSync('download'));
		this.registerDomEvent(this.statusBarItem, 'keydown', (event) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				void this.runSync('download');
			}
		});
		this.addCommand({
			id: 'download-from-jira',
			name: 'Download from Jira',
			callback: () => void this.runSync('download'),
		});
		this.addCommand({
			id: 'send-to-jira',
			name: 'Send local changes to Jira',
			callback: () => void this.runSync('send'),
		});
		this.addSettingTab(new InfluencerSyncSettingTab(this.app, this));
		this.updateStatusBar();
		this.scheduleSync();
	}

	onunload(): void {
		if (this.intervalId !== null) {
			window.clearInterval(this.intervalId);
		}
	}

	async updateSettings(update: Partial<SyncSettings>): Promise<void> {
		this.settings = {
			...this.settings,
			...update,
			intervalMinutes: Math.max(5, update.intervalMinutes ?? this.settings.intervalMinutes),
		};
		await this.savePluginData();
		this.scheduleSync();
	}

	private async runSync(mode: SyncMode): Promise<void> {
		if (this.syncing || this.confirming) {
			new Notice('Influencer synchronization is already running.');
			return;
		}
		if (!this.settings.baseUrl || !this.settings.token) {
			new Notice('Set the Jira API address and personal token first.');
			return;
		}
		if (mode === 'send' && !this.settings.writeBackEnabled) {
			new Notice('Enable write-back in the plugin settings before sending changes.');
			return;
		}
		this.confirming = true;
		const confirmed = await confirmSync(this.app, mode);
		this.confirming = false;
		if (!confirmed) {
			return;
		}
		this.syncing = true;
		this.statusBarItem.setText(`Influencers: ${mode === 'send' ? 'sending' : 'downloading'}…`);
		try {
			const service = new InfluencerSyncService(
				new RequestUrlInfluencerApi(this.settings.baseUrl, this.settings.token),
				new ObsidianNoteStore(this.app.vault, this.settings.folder),
				mode === 'send' ? this.settings : { ...this.settings, writeBackEnabled: false },
				this.state,
				{
					onConflict: (displayName) => {
						new Notice(`${displayName}: Jira changed the card; local edits were not sent.`);
					},
					onError: (message) => new Notice(message),
				},
			);
			const result = await service.sync();
			this.lastSyncedAt = new Date().toISOString();
			await this.savePluginData();
			new Notice(
				`${mode === 'send' ? 'Changes sent and notes refreshed' : 'Influencers downloaded'}: `
				+ `${result.created} created, ${result.updated} updated, `
				+ `${result.conflicts} conflicts, ${result.errors} errors.`,
			);
		} catch (error) {
			await this.savePluginData();
			new Notice(`Influencer synchronization stopped: ${humanizeError(error)}`);
		} finally {
			this.syncing = false;
			this.updateStatusBar();
		}
	}

	private scheduleSync(): void {
		if (this.intervalId !== null) {
			window.clearInterval(this.intervalId);
		}
		const milliseconds = Math.max(5, this.settings.intervalMinutes) * 60_000;
		this.intervalId = window.setInterval(() => void this.runSync('download'), milliseconds);
		this.registerInterval(this.intervalId);
	}

	private updateStatusBar(): void {
		if (!this.lastSyncedAt) {
			this.statusBarItem.setText('Influencers: not synchronized');
			return;
		}
		this.statusBarItem.setText(`Influencers: ${new Date(this.lastSyncedAt).toLocaleString()}`);
	}

	private async loadPluginData(): Promise<void> {
		const loaded = await this.loadData() as Partial<StoredData> | null;
		this.settings = {
			...DEFAULT_SETTINGS,
			...(loaded?.settings ?? {}),
		};
		this.settings.intervalMinutes = Math.max(5, this.settings.intervalMinutes || 60);
		this.state = {
			baselines: loaded?.state?.baselines ?? {},
			pendingRefresh: loaded?.state?.pendingRefresh ?? {},
		};
		this.lastSyncedAt = loaded?.lastSyncedAt ?? null;
	}

	private savePluginData(): Promise<void> {
		return this.saveData({
			settings: this.settings,
			state: this.state,
			lastSyncedAt: this.lastSyncedAt,
		} satisfies StoredData);
	}
}
