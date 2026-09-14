import { App, PluginSettingTab, Setting } from 'obsidian';
import type InfluencerSyncPlugin from './main';
import type { SyncSettings } from './types';

export const DEFAULT_SETTINGS: SyncSettings = {
	baseUrl: 'https://jira.example.com/rest/asbis-inf/2.0',
	token: '',
	folder: 'Influencers',
	intervalMinutes: 60,
	writeBackEnabled: true,
};

export class InfluencerSyncSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: InfluencerSyncPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Jira API address')
			.setDesc('Base URL ending in /rest/asbis-inf/2.0.')
			.addText((text) => text
				.setPlaceholder(DEFAULT_SETTINGS.baseUrl)
				.setValue(this.plugin.settings.baseUrl)
				.onChange(async (value) => {
					await this.plugin.updateSettings({ baseUrl: value.trim() });
				}));

		new Setting(containerEl)
			.setName('Personal access token')
			.setDesc('Stored only in the local Obsidian plugin data.')
			.addText((text) => {
				text.inputEl.type = 'password';
				text.inputEl.autocomplete = 'off';
				text.setValue(this.plugin.settings.token).onChange(async (value) => {
					await this.plugin.updateSettings({ token: value.trim() });
				});
			});

		new Setting(containerEl)
			.setName('Notes folder')
			.setDesc('One Markdown note is created for every influencer.')
			.addText((text) => text
				.setPlaceholder(DEFAULT_SETTINGS.folder)
				.setValue(this.plugin.settings.folder)
				.onChange(async (value) => {
					await this.plugin.updateSettings({ folder: value.trim() || DEFAULT_SETTINGS.folder });
				}));

		new Setting(containerEl)
			.setName('Synchronization interval')
			.setDesc('Minutes between scheduled runs; minimum 5.')
			.addText((text) => {
				text.inputEl.type = 'number';
				text.inputEl.min = '5';
				text.inputEl.step = '1';
				text.setValue(String(this.plugin.settings.intervalMinutes)).onChange(async (value) => {
					const parsed = Number.parseInt(value, 10);
					if (Number.isFinite(parsed)) {
						await this.plugin.updateSettings({ intervalMinutes: Math.max(5, parsed) });
					}
				});
			});

		new Setting(containerEl)
			.setName('Send local changes to Jira')
			.setDesc('Used only by the explicit send command. Jira permissions are checked before every run.')
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.writeBackEnabled)
				.onChange(async (value) => {
					await this.plugin.updateSettings({ writeBackEnabled: value });
				}));
	}
}
