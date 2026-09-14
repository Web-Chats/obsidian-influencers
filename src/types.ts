export interface JiraUser {
	key: string;
	displayName: string;
}

export interface DictionaryRef {
	id: number;
	name: string;
	status: string;
	code?: string;
}

export interface MetaResponse {
	currentUser: JiraUser;
	permissions: {
		read: boolean;
		write: boolean;
		admin: boolean;
	};
	jiraTimeZone: string;
	apiVersion: string;
}

export interface AiCardContract {
	version: number;
	schema: Record<string, unknown>;
	prompt: string;
}

export interface Page<T> {
	items: T[];
	page: number;
	pageSize: number;
	totalItems: number;
	totalPages: number;
	sort: string[];
}

export interface Influencer {
	id: number;
	version: number;
	displayName: string;
	realName: string | null;
	genderId: number | null;
	countryId: number;
	primaryAudienceCountryId: number | null;
	additionalAudienceCountryIds: number[];
	deliveryCountryId: number;
	languageIds: number[];
	categoryIds: number[];
	communicationEmployeeIds: number[];
	agencyId: number | null;
	email: string | null;
	messenger: string | null;
	agencyManager: string | null;
	commercialOfferUrl: string | null;
	internalRating: number | null;
	comment: string | null;
	status: string;
	country?: DictionaryRef | null;
	agency?: DictionaryRef | null;
	rating?: number | null;
	campaignsCount?: number;
	brands?: DictionaryRef[];
	platforms?: DictionaryRef[];
	followersByPlatform?: Record<string, number>;
	accountUrlsByPlatform?: Record<string, string>;
	minimumPrice?: string | null;
	dataUpdatedAt?: string;
}

export interface InfluencerUpdate {
	displayName: string;
	realName: string | null;
	genderId: number | null;
	countryId: number;
	primaryAudienceCountryId: number | null;
	additionalAudienceCountryIds: number[];
	deliveryCountryId: number;
	languageIds: number[];
	categoryIds: number[];
	communicationEmployeeIds: number[];
	agencyId: number | null;
	email: string | null;
	messenger: string | null;
	agencyManager: string | null;
	commercialOfferUrl: string | null;
	internalRating: number | null;
	comment: string | null;
	version: number;
}

export interface InfluencerComment {
	id: number;
	influencerId: number;
	body: string;
	createdAt: string;
	createdBy: JiraUser;
}

export interface InfluencerAccount {
	id: number;
	platform?: DictionaryRef | null;
	nickname?: string | null;
	sourceUrl?: string | null;
	followers?: number | null;
	status?: string;
}

export interface InfluencerParticipation {
	id: number;
	campaign?: { id: number; name: string } | null;
	campaignName?: string;
	status?: string;
	costUsd?: string | null;
	campaignStartDate?: string | null;
}

export interface InfluencerDetails {
	accounts: InfluencerAccount[];
	participations: InfluencerParticipation[];
	comments: InfluencerComment[];
}

export const EDITABLE_FIELDS = [
	'realName',
	'email',
	'messenger',
	'agencyManager',
	'commercialOfferUrl',
	'internalRating',
] as const;

export type EditableField = (typeof EDITABLE_FIELDS)[number];
export type EditableValue = string | number | null;
export interface EditableValues {
	realName: string | null;
	email: string | null;
	messenger: string | null;
	agencyManager: string | null;
	commercialOfferUrl: string | null;
	internalRating: number | null;
}
export type EditableChanges = Partial<EditableValues>;

export interface SyncBaseline {
	version: number;
	fields: EditableValues;
}

export interface SyncState {
	baselines: Record<string, SyncBaseline>;
	pendingRefresh: Record<string, boolean>;
}

export interface SyncSettings {
	baseUrl: string;
	token: string;
	folder: string;
	intervalMinutes: number;
	writeBackEnabled: boolean;
}
