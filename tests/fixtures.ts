import type { Influencer, InfluencerDetails } from '../src/types';

export function influencer(overrides: Partial<Influencer> = {}): Influencer {
	return {
		id: 42,
		version: 7,
		displayName: 'Travel Kate',
		realName: 'Kate Smith',
		genderId: null,
		countryId: 17,
		primaryAudienceCountryId: 17,
		additionalAudienceCountryIds: [],
		deliveryCountryId: 17,
		languageIds: [2],
		categoryIds: [4],
		communicationEmployeeIds: [12],
		agencyId: 27,
		email: 'old@example.com',
		messenger: '@travelkate',
		agencyManager: 'Olena',
		commercialOfferUrl: 'https://example.com/offer',
		internalRating: 4,
		comment: 'Legacy note',
		status: 'ACTIVE',
		country: { id: 17, name: 'Poland', status: 'ACTIVE' },
		agency: { id: 27, name: 'WOW Agency', status: 'ACTIVE' },
		rating: 4.3,
		campaignsCount: 5,
		brands: [{ id: 4, name: 'AENO', status: 'ACTIVE' }],
		platforms: [{ id: 2, name: 'Instagram', code: 'instagram', status: 'ACTIVE' }],
		minimumPrice: '250',
		dataUpdatedAt: '2026-09-11T08:00:00+03:00',
		...overrides,
	};
}

export const emptyDetails: InfluencerDetails = {
	accounts: [],
	participations: [],
	comments: [],
};
