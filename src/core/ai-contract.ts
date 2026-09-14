import { EDITABLE_FIELDS, type AiCardContract } from '../types';

export const AI_CONTRACT_MARKER =
	'Managed by Influencer Sync; source: Jira /ai/obsidian-card-contract';

export interface AiContractFiles {
	schema: string;
	prompt: string;
}

export function renderAiContractFiles(contract: AiCardContract): AiContractFiles {
	if (!Number.isInteger(contract.version) || contract.version < 1) {
		throw new Error('Jira returned an invalid AI contract version.');
	}
	if (!contract.schema || typeof contract.schema !== 'object' || Array.isArray(contract.schema)) {
		throw new Error('Jira returned an invalid AI JSON Schema.');
	}
	if (contract.schema.$comment !== AI_CONTRACT_MARKER) {
		throw new Error('Jira returned an unmanaged AI JSON Schema.');
	}
	const properties = contract.schema.properties;
	const changes = properties && typeof properties === 'object' && !Array.isArray(properties)
		? (properties as Record<string, unknown>).changes
		: null;
	const changeProperties = changes && typeof changes === 'object' && !Array.isArray(changes)
		? (changes as Record<string, unknown>).properties
		: null;
	const fields = changeProperties && typeof changeProperties === 'object' && !Array.isArray(changeProperties)
		? Object.keys(changeProperties).sort()
		: [];
	if (fields.join('\n') !== [...EDITABLE_FIELDS].sort().join('\n')) {
		throw new Error('Jira AI contract does not match the write-back field whitelist.');
	}
	if (
		typeof contract.prompt !== 'string'
		|| !contract.prompt.includes(AI_CONTRACT_MARKER)
		|| contract.prompt.length > 50_000
	) {
		throw new Error('Jira returned an invalid AI prompt.');
	}
	const schema = `${JSON.stringify(contract.schema, null, 2)}\n`;
	if (new TextEncoder().encode(schema).length > 100_000) {
		throw new Error('Jira returned an AI JSON Schema larger than 100 KB.');
	}
	return {
		schema,
		prompt: contract.prompt.endsWith('\n') ? contract.prompt : `${contract.prompt}\n`,
	};
}
