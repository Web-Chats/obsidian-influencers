import { requestUrl, type RequestUrlParam } from 'obsidian';
import { JiraApiError, type JiraErrorEnvelope } from './core/api-error';
import { collectPages } from './core/pagination';
import type {
	AiCardContract,
	Influencer,
	InfluencerAccount,
	InfluencerComment,
	InfluencerParticipation,
	InfluencerUpdate,
	MetaResponse,
} from './types';

export interface InfluencerApi {
	getMeta(): Promise<MetaResponse>;
	getAiCardContract(): Promise<AiCardContract>;
	listInfluencers(): Promise<Influencer[]>;
	getInfluencer(id: number): Promise<Influencer>;
	updateInfluencer(id: number, update: InfluencerUpdate): Promise<Influencer>;
	listComments(id: number): Promise<InfluencerComment[]>;
	addComment(id: number, body: string): Promise<InfluencerComment>;
	listAccounts(id: number): Promise<InfluencerAccount[]>;
	listParticipations(id: number): Promise<InfluencerParticipation[]>;
}

export class RequestUrlInfluencerApi implements InfluencerApi {
	private readonly baseUrl: string;

	constructor(baseUrl: string, private readonly token: string) {
		this.baseUrl = baseUrl.replace(/\/+$/, '');
	}

	getMeta(): Promise<MetaResponse> {
		return this.request('GET', '/meta');
	}

	getAiCardContract(): Promise<AiCardContract> {
		return this.request('GET', '/ai/obsidian-card-contract');
	}

	listInfluencers(): Promise<Influencer[]> {
		return collectPages((page) => this.request(
			'GET',
			`/influencers?page=${page}&pageSize=200&sort=id%3Aasc`,
		));
	}

	getInfluencer(id: number): Promise<Influencer> {
		return this.request('GET', `/influencers/${id}`);
	}

	updateInfluencer(id: number, update: InfluencerUpdate): Promise<Influencer> {
		return this.request('PUT', `/influencers/${id}`, update);
	}

	listComments(id: number): Promise<InfluencerComment[]> {
		return collectPages((page) => this.request(
			'GET',
			`/influencers/${id}/comments?page=${page}&pageSize=200`,
		));
	}

	addComment(id: number, body: string): Promise<InfluencerComment> {
		return this.request('POST', `/influencers/${id}/comments`, { body });
	}

	listAccounts(id: number): Promise<InfluencerAccount[]> {
		return collectPages((page) => this.request(
			'GET',
			`/influencers/${id}/accounts?page=${page}&pageSize=200&sort=id%3Aasc`,
		));
	}

	listParticipations(id: number): Promise<InfluencerParticipation[]> {
		return collectPages((page) => this.request(
			'GET',
			`/influencers/${id}/participations?page=${page}&pageSize=200&sort=campaignStartDate%3Adesc%2Cid%3Aasc`,
		));
	}

	private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
		const headers: Record<string, string> = {
			Accept: 'application/json',
			Authorization: `Bearer ${this.token}`,
			Origin: new URL(this.baseUrl).origin,
		};
		const parameters: RequestUrlParam = {
			url: `${this.baseUrl}${path}`,
			method,
			headers,
			throw: false,
		};
		if (body !== undefined) {
			headers['Content-Type'] = 'application/json; charset=UTF-8';
			headers['X-Atlassian-Token'] = 'no-check';
			parameters.contentType = 'application/json';
			parameters.body = JSON.stringify(body);
		}
		const response = await requestUrl(parameters);
		let responseBody: unknown;
		try {
			responseBody = response.text ? JSON.parse(response.text) : undefined;
		} catch {
			responseBody = undefined;
		}
		if (response.status >= 200 && response.status < 300) {
			if (responseBody === undefined) {
				throw new JiraApiError(
					response.status,
					'INVALID_RESPONSE',
					`Jira returned a non-JSON response (${response.status}).`,
				);
			}
			return responseBody as T;
		}
		const error = responseBody && typeof responseBody === 'object'
			? responseBody as JiraErrorEnvelope
			: {};
		throw new JiraApiError(
			response.status,
			error.code ?? 'HTTP_ERROR',
			error.message
				?? (response.text.trim().slice(0, 300) || `Jira request failed (${response.status}).`),
			error.currentVersion ?? null,
			error.fieldErrors ?? {},
			error.requestId ?? null,
		);
	}
}
