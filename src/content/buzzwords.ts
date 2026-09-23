/** Buzzword ids. Display text lives in minigames.buzzwords.<id>. */
export const BUZZWORDS = [
  'agile', 'scalable', 'userJourney', 'genai', 'platformTeam', 'devsecops', 'dataDriven', 'sustainability',
  'cloudNative', 'microservices', 'zeroTrust', 'lowCode', 'productTeam', 'continuousDelivery', 'digitalTwin',
  'dataMesh', 'mvp', 'crossFunctional', 'valueStream', 'observability', 'serverless', 'userCentric',
  'selfService', 'innovation', 'synergy', 'blockchain', 'holistic', 'endToEnd',
] as const

export type Buzzword = (typeof BUZZWORDS)[number]
