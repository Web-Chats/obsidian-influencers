import { buildNote } from './frontmatter';
import { COMMENTS_MARKER, formatConflictBlock } from './comments';
import type {
	EditableChanges,
	Influencer,
	InfluencerAccount,
	InfluencerComment,
	InfluencerDetails,
	InfluencerParticipation,
} from '../types';

const FRONTMATTER_ORDER = [
	'influencerId',
	'version',
	'syncedAt',
	'status',
	'country',
	'agency',
	'rating',
	'campaignsCount',
	'displayName',
	'realName',
	'email',
	'messenger',
	'agencyManager',
	'commercialOfferUrl',
	'internalRating',
] as const;

function text(value: string | number | boolean | null | undefined): string {
	if (value === null || value === undefined || value === '') {
		return '—';
	}
	return String(value);
}

function inline(value: string | number | boolean | null | undefined): string {
	return text(value).replace(/([\\`*_[\]<>])/g, '\\$1').replace(/\r?\n/g, ' ');
}

function tableCell(value: string | number | boolean | null | undefined): string {
	return inline(value).replace(/\|/g, '\\|');
}

function renderAccounts(accounts: InfluencerAccount[]): string {
	if (accounts.length === 0) {
		return '_No channels._';
	}
	const rows = accounts.map((account) => [
		account.platform?.name,
		account.nickname,
		account.followers,
		account.sourceUrl,
		account.status,
	].map(tableCell).join(' | '));
	return ['Platform | Account | Followers | URL | Status', '--- | --- | ---: | --- | ---', ...rows].join('\n');
}

function renderParticipations(participations: InfluencerParticipation[]): string {
	if (participations.length === 0) {
		return '_No campaigns._';
	}
	const rows = participations.map((participation) => [
		participation.campaign?.name ?? participation.campaignName,
		participation.campaignStartDate,
		participation.status,
		participation.costUsd,
	].map(tableCell).join(' | '));
	return ['Campaign | Start | Status | Cost, USD', '--- | --- | --- | ---:', ...rows].join('\n');
}

function renderComments(comments: InfluencerComment[]): string {
	if (comments.length === 0) {
		return '_No comments yet._';
	}
	return comments.map((comment) => {
		const quote = comment.body.split(/\r?\n/).map((line) => `> ${line}`).join('\n');
		return `### ${inline(comment.createdAt)} — ${inline(comment.createdBy.displayName)}\n\n${quote}`;
	}).join('\n\n');
}

export function renderInfluencerNote(
	influencer: Influencer,
	details: InfluencerDetails,
	syncedAt: string,
	pendingComment = '',
	conflictChanges?: EditableChanges,
): string {
	const frontmatter: Record<string, unknown> = {
		influencerId: influencer.id,
		version: influencer.version,
		syncedAt,
		status: influencer.status,
		country: influencer.country?.name ?? null,
		agency: influencer.agency?.name ?? null,
		rating: influencer.rating ?? null,
		campaignsCount: influencer.campaignsCount ?? 0,
		displayName: influencer.displayName,
		realName: influencer.realName,
		email: influencer.email,
		messenger: influencer.messenger,
		agencyManager: influencer.agencyManager,
		commercialOfferUrl: influencer.commercialOfferUrl,
		internalRating: influencer.internalRating,
	};
	const brands = influencer.brands?.map((brand) => brand.name).join(', ') || '—';
	const platforms = influencer.platforms?.map((platform) => platform.name).join(', ') || '—';
	let body = `# ${inline(influencer.displayName)}\n\n`
		+ `## Profile\n\n`
		+ `- Status: ${inline(influencer.status)}\n`
		+ `- Real name: ${inline(influencer.realName)}\n`
		+ `- Country: ${inline(influencer.country?.name)}\n`
		+ `- Agency: ${inline(influencer.agency?.name)}\n`
		+ `- Agency manager: ${inline(influencer.agencyManager)}\n`
		+ `- Email: ${inline(influencer.email)}\n`
		+ `- Messenger: ${inline(influencer.messenger)}\n`
		+ `- Campaign rating: ${inline(influencer.rating)}\n`
		+ `- Internal rating: ${inline(influencer.internalRating)}\n`
		+ `- Campaigns: ${inline(influencer.campaignsCount ?? 0)}\n`
		+ `- Brands: ${inline(brands)}\n`
		+ `- Platforms: ${inline(platforms)}\n`
		+ `- Minimum price, USD: ${inline(influencer.minimumPrice)}\n`
		+ `- Commercial offer: ${inline(influencer.commercialOfferUrl)}\n`
		+ `- Data updated: ${inline(influencer.dataUpdatedAt)}\n\n`
		+ `## Channels\n\n${renderAccounts(details.accounts)}\n\n`
		+ `## Campaigns\n\n${renderParticipations(details.participations)}\n\n`
		+ `## Comments\n\n${renderComments(details.comments)}\n\n`
		+ `${COMMENTS_MARKER}\n`;
	if (pendingComment) {
		body += `\n${pendingComment.trim()}\n`;
	}
	if (conflictChanges && Object.keys(conflictChanges).length > 0) {
		body += `\n${formatConflictBlock(conflictChanges)}`;
	}
	return buildNote(frontmatter, body, FRONTMATTER_ORDER);
}
