import { describe, expect, it, vi } from 'vitest';
import { renderAiContractFiles } from '../src/core/ai-contract';
import { humanizeError, JiraApiError } from '../src/core/api-error';
import { clearPendingComment, extractPendingComment } from '../src/core/comments';
import {
	createInfluencerUpdate,
	detectEditableChanges,
	editableValuesFromInfluencer,
} from '../src/core/changes';
import { buildNote, parseNote } from '../src/core/frontmatter';
import { collectPages } from '../src/core/pagination';
import { notePath, sanitizeFileName } from '../src/core/paths';
import { influencer } from './fixtures';

describe('AI contract', () => {
	it('accepts only the server contract for the six writable fields', () => {
		const contract = {
			version: 1,
			schema: {
				$comment: 'Managed by Influencer Sync; source: Jira /ai/obsidian-card-contract',
				properties: { changes: { properties: {
					realName: {}, email: {}, messenger: {}, agencyManager: {},
					commercialOfferUrl: {}, internalRating: {},
				} } },
			},
			prompt: '<!-- Managed by Influencer Sync; source: Jira /ai/obsidian-card-contract -->\nRules',
		};
		expect(renderAiContractFiles(contract).schema).toContain('"internalRating"');
		expect(() => renderAiContractFiles({
			...contract,
			schema: {
				...contract.schema,
				properties: { changes: { properties: {
					...contract.schema.properties.changes.properties,
					status: {},
				} } },
			},
		})).toThrow('whitelist');
	});
});

describe('frontmatter', () => {
	it('builds and parses scalar machine fields', () => {
		const note = buildNote({
			influencerId: 42,
			version: 7,
			email: 'kate@example.com',
			agency: null,
			rating: 4.3,
		}, '# Travel Kate\n', ['influencerId', 'version', 'email', 'agency', 'rating']);

		expect(parseNote(note)).toEqual({
			frontmatter: {
				influencerId: 42,
				version: 7,
				email: 'kate@example.com',
				agency: null,
				rating: 4.3,
			},
			body: '# Travel Kate\n',
		});
	});
});

describe('editable fields', () => {
	it('detects only the six allowed fields and builds an exact full PUT form', () => {
		const remote = influencer();
		const changes = detectEditableChanges({
			realName: 'Kate New',
			email: null,
			messenger: '@travelkate',
			agencyManager: 'Olena',
			commercialOfferUrl: 'https://example.com/offer',
			internalRating: 5,
			rating: 1,
			campaignsCount: 999,
			brands: ['forbidden'],
			platforms: ['forbidden'],
		}, editableValuesFromInfluencer(remote));

		expect(changes).toEqual({ realName: 'Kate New', email: null, internalRating: 5 });
		const update = createInfluencerUpdate(remote, changes);
		expect(update.email).toBeNull();
		expect(Object.keys(update).sort()).toEqual([
			'additionalAudienceCountryIds',
			'agencyId',
			'agencyManager',
			'categoryIds',
			'comment',
			'commercialOfferUrl',
			'communicationEmployeeIds',
			'countryId',
			'deliveryCountryId',
			'displayName',
			'email',
			'genderId',
			'internalRating',
			'languageIds',
			'messenger',
			'primaryAudienceCountryId',
			'realName',
			'version',
		].sort());
		expect(update).not.toHaveProperty('rating');
		expect(update).not.toHaveProperty('campaignsCount');
		expect(update).not.toHaveProperty('brands');
		expect(update).not.toHaveProperty('platforms');
		expect(update).not.toHaveProperty('followersByPlatform');
		expect(update).not.toHaveProperty('accountUrlsByPlatform');
		expect(update).not.toHaveProperty('minimumPrice');
	});
});

describe('pending comments', () => {
	it('extracts only text below the marker and clears it after POST', () => {
		const content = '# Card\n\n<!-- comments -->\n\nNew Jira comment\n\n'
			+ '## Не отправлено (конфликт)\n\n- `email`: `"local@example.com"`\n';
		expect(extractPendingComment(content)).toBe('New Jira comment');
		const cleared = clearPendingComment(content);
		expect(extractPendingComment(cleared)).toBe('');
		expect(cleared).toContain('## Не отправлено (конфликт)');
	});
});

describe('pagination and paths', () => {
	it('loads every page', async () => {
		const load = vi.fn(async (page: number) => ({
			items: [page],
			page,
			pageSize: 1,
			totalItems: 3,
			totalPages: 3,
			sort: ['id:asc'],
		}));
		expect(await collectPages(load)).toEqual([1, 2, 3]);
		expect(load).toHaveBeenCalledTimes(3);
	});

	it('sanitizes forbidden filename characters', () => {
		expect(sanitizeFileName('Kate: travel/Poland?')).toBe('Kate- travel-Poland-');
		expect(notePath('Influencers/', 42, 'Kate/Travel')).toBe('Influencers/42 Kate-Travel.md');
	});
});

describe('API errors', () => {
	it('preserves the Jira reason for a forbidden response', () => {
		expect(humanizeError(new JiraApiError(403, 'HTTP_ERROR', 'XSRF check failed')))
			.toContain('XSRF check failed');
	});
});
