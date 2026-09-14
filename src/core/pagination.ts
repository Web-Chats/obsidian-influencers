import type { Page } from '../types';

export async function collectPages<T>(
	loadPage: (page: number) => Promise<Page<T>>,
): Promise<T[]> {
	const items: T[] = [];
	let pageNumber = 1;
	while (true) {
		const page = await loadPage(pageNumber);
		items.push(...page.items);
		if (pageNumber >= page.totalPages) {
			return items;
		}
		pageNumber += 1;
	}
}
