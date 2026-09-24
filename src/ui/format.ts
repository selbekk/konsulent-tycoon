import type { TFunction } from 'i18next'
import { quarterLabel } from '../engine'
import type { NewsItem, Params } from '../engine'

const localeTag = (lng: string) => (lng === 'en' ? 'en-GB' : 'nb-NO')

export function formatMoney(n: number, lng: string, opts: { compact?: boolean } = {}): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '−' : ''
  if (opts.compact !== false && abs >= 1_000_000) {
    const v = (abs / 1_000_000).toLocaleString(localeTag(lng), { maximumFractionDigits: abs >= 100_000_000 ? 0 : 1 })
    return lng === 'en' ? `${sign}NOK ${v}M` : `${sign}${v} MNOK`
  }
  if (opts.compact !== false && abs >= 10_000) {
    const v = Math.round(abs / 1000).toLocaleString(localeTag(lng))
    return lng === 'en' ? `${sign}NOK ${v}k` : `${sign}${v}k`
  }
  const v = Math.round(abs).toLocaleString(localeTag(lng))
  return lng === 'en' ? `${sign}NOK ${v}` : `${sign}${v} kr`
}

export function formatPercent(n: number, lng: string, digits = 0): string {
  return (n * 100).toLocaleString(localeTag(lng), { maximumFractionDigits: digits }) + ' %'
}

export function formatNumber(n: number, lng: string, digits = 0): string {
  return n.toLocaleString(localeTag(lng), { maximumFractionDigits: digits })
}

export function formatQuarter(quarter: number): string {
  const { year, q } = quarterLabel(quarter)
  return `Q${q} ${year}`
}

/** Engine params are ids – turn them into display text. */
export function resolveParams(params: Params, t: TFunction, lng: string): Params {
  const out: Params = { ...params }
  if (typeof params.customer === 'string' && params.customer)
    out.customer = t(`content:customers.${params.customer}.name`)
  if (typeof params.trend === 'string') out.trend = t(`content:trends.${params.trend}.name`)
  if (typeof params.discipline === 'string') out.discipline = t(`ui:disciplines.${params.discipline}`).toLowerCase()
  if (typeof params.fine === 'number') out.fine = formatMoney(params.fine, lng)
  if (typeof params.mission === 'string') out.mission = t(`content:missions.${params.mission}.name`)
  // Why a tender was lost or won: factor ids (see BidFactor) become a short sentence.
  if (typeof params.weak === 'string') out.weak = t(`game:factors.weak.${params.weak}`)
  if (typeof params.strong === 'string') out.strong = t(`game:factors.strong.${params.strong}`)
  // A crisis title may itself name the customer, star or discipline, so it goes last.
  if (typeof params.crisis === 'string') out.crisis = t(`game:crises.${params.crisis}.title`, out)
  return out
}

export function newsText(item: Pick<NewsItem, 'key' | 'params'>, t: TFunction, lng: string): string {
  return t(`game:${item.key}`, resolveParams(item.params, t, lng))
}
