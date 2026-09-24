/**
 * News stories behind the ticker. Every news key has a short article in `game:articles.<key>.<n>`
 * (`headline` and `body`, or `body_one`/`body_other` when the news has a count), using the same
 * params as the news line. The key is the news key without its `news.` prefix, so
 * `news.tender.awarded` → `articles.tender.awarded`, and crisis gossip `crises.x.gossip` →
 * `articles.crises.x.gossip`. Frequent news get more than one variant, picked by a hash of the item.
 */
export const ARTICLE_VARIANTS: Record<string, number> = {
  'tender.awarded': 3,
  'tender.frameworkAwarded': 2,
  'trend.started': 2,
  'firm.bankrupt': 2,
}

export const articleKey = (newsKey: string) => newsKey.replace(/^news\./, '')

export const articleVariants = (newsKey: string) => ARTICLE_VARIANTS[articleKey(newsKey)] ?? 1
