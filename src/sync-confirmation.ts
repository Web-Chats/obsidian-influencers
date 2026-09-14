import { App, Modal, Setting } from 'obsidian';

export type SyncMode = 'download' | 'send';

const COPY = {
	download: {
		title: 'Download cards from Jira?',
		description: 'Jira → Obsidian. This will download the registry and refresh local influencer notes. Local changes will not be sent.',
		confirm: 'Download from Jira',
	},
	send: {
		title: 'Send changes to Jira?',
		description: 'Obsidian → Jira. This will send pending comments and changes to the six allowed fields, then refresh local notes. Version conflicts will not be overwritten.',
		confirm: 'Send to Jira',
	},
} as const;

export class SyncConfirmationModal extends Modal {
	private resolved = false;

	constructor(
		app: App,
		private readonly mode: SyncMode,
		private readonly resolve: (confirmed: boolean) => void,
	) {
		super(app);
	}

	onOpen(): void {
		const copy = COPY[this.mode];
		this.setTitle(copy.title);
		this.contentEl.createEl('p', { text: copy.description });
		new Setting(this.contentEl)
			.addButton((button) => button
				.setButtonText('Cancel')
				.onClick(() => this.finish(false)))
			.addButton((button) => {
				button
					.setButtonText(copy.confirm)
					.onClick(() => this.finish(true));
				if (this.mode === 'send') {
					button.setWarning();
				} else {
					button.setCta();
				}
			});
	}

	onClose(): void {
		this.contentEl.empty();
		if (!this.resolved) {
			this.resolved = true;
			this.resolve(false);
		}
	}

	private finish(confirmed: boolean): void {
		if (this.resolved) {
			return;
		}
		this.resolved = true;
		this.resolve(confirmed);
		this.close();
	}
}

export function confirmSync(app: App, mode: SyncMode): Promise<boolean> {
	return new Promise((resolve) => new SyncConfirmationModal(app, mode, resolve).open());
}
