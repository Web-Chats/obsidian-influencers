import {
	EDITABLE_FIELDS,
	type EditableChanges,
	type EditableField,
	type EditableValue,
	type EditableValues,
	type Influencer,
	type InfluencerUpdate,
} from '../types';

function hasOwn(object: object, key: PropertyKey): boolean {
	return Object.prototype.hasOwnProperty.call(object, key);
}

function normalizeLocalValue(field: EditableField, value: unknown): EditableValue {
	if (value === null || value === undefined || value === '') {
		return null;
	}
	if (field === 'internalRating') {
		const rating = typeof value === 'number' ? value : Number(value);
		if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
			throw new Error('internalRating must be null or an integer from 1 to 5.');
		}
		return rating;
	}
	if (typeof value !== 'string') {
		throw new Error(`${field} must be text or null.`);
	}
	return value.trim() || null;
}

export function editableValuesFromInfluencer(influencer: Influencer): EditableValues {
	return {
		realName: influencer.realName,
		email: influencer.email,
		messenger: influencer.messenger,
		agencyManager: influencer.agencyManager,
		commercialOfferUrl: influencer.commercialOfferUrl,
		internalRating: influencer.internalRating,
	};
}

export function detectEditableChanges(
	frontmatter: Record<string, unknown>,
	baseline: EditableValues,
): EditableChanges {
	const changes: EditableChanges = {};
	for (const field of EDITABLE_FIELDS) {
		if (!hasOwn(frontmatter, field)) {
			continue;
		}
		const localValue = normalizeLocalValue(field, frontmatter[field]);
		if (localValue !== baseline[field]) {
			changes[field] = localValue as never;
		}
	}
	return changes;
}

export function hasChanges(changes: EditableChanges): boolean {
	return Object.keys(changes).length > 0;
}

export function createInfluencerUpdate(
	remote: Influencer,
	changes: EditableChanges,
): InfluencerUpdate {
	return {
		displayName: remote.displayName,
		realName: hasOwn(changes, 'realName') ? changes.realName ?? null : remote.realName,
		genderId: remote.genderId,
		countryId: remote.countryId,
		primaryAudienceCountryId: remote.primaryAudienceCountryId,
		additionalAudienceCountryIds: remote.additionalAudienceCountryIds,
		deliveryCountryId: remote.deliveryCountryId,
		languageIds: remote.languageIds,
		categoryIds: remote.categoryIds,
		communicationEmployeeIds: remote.communicationEmployeeIds,
		agencyId: remote.agencyId,
		email: hasOwn(changes, 'email') ? changes.email ?? null : remote.email,
		messenger: hasOwn(changes, 'messenger') ? changes.messenger ?? null : remote.messenger,
		agencyManager: hasOwn(changes, 'agencyManager') ? changes.agencyManager ?? null : remote.agencyManager,
		commercialOfferUrl: hasOwn(changes, 'commercialOfferUrl')
			? changes.commercialOfferUrl ?? null
			: remote.commercialOfferUrl,
		internalRating: hasOwn(changes, 'internalRating')
			? changes.internalRating ?? null
			: remote.internalRating,
		comment: remote.comment,
		version: remote.version,
	};
}
