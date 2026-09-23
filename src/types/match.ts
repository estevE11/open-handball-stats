import { z } from 'zod';

export const attackPhases = ['STATIC', 'COUNTERATTACK', 'COUNTERATTACK_ATTEMPTED'] as const;
export const defenseSystems = ['6:0', '5:1', '4:2', '3:2:1', '3:3', 'MAN_TO_MAN', 'OTHER'] as const;
export const technicalFaults = ['TRAVELING', 'STEPPING', 'BAD_PASS', 'OFFENSIVE_FOUL', 'OTHER'] as const;
export const sanctions = ['TWO_MINUTES', 'YELLOW', 'RED', 'BLUE'] as const;
export const eventTypes = ['GOAL', 'GK_SAVE', 'SHOT_OUT', 'STEAL', 'TECHNICAL_FAULT', 'REBOUND_REGAINED', 'PENALTY_7M', 'SANCTION', 'POSSESSION_SWITCH'] as const;
export type Language = 'en' | 'es';
export type AttackPhase = typeof attackPhases[number];
export type DefenseSystem = typeof defenseSystems[number];
export type TechnicalFaultType = typeof technicalFaults[number];
export type SanctionType = typeof sanctions[number];
export type EventType = typeof eventTypes[number];
export type TeamId = 'home' | 'away';
const text = z.string().trim().min(1).max(200);
const seconds = z.number().finite().min(0).max(604800);
export const eventSchema = z.object({
  id: text, matchId: text, possessionIndex: z.number().int().positive(),
  period: z.number().int().min(1).max(20), gameTimeSeconds: seconds,
  realTimestamp: z.number().int().min(0).max(8640000000000000),
  attackingTeamName: text, defendingTeamName: text,
  attackingTeamId: z.enum(['home', 'away']).optional(),
  attackPhase: z.enum(attackPhases), defenseSystem: z.enum(defenseSystems),
  eventType: z.enum(eventTypes), subType: z.enum([...technicalFaults, ...sanctions]).optional(),
  sanctionTeamId: z.enum(['home', 'away']).optional(),
  isPossessionFlipped: z.boolean(), notes: z.string().max(2000).optional(),
});
const teamSchema = z.object({ name: text, color: z.string().regex(/^#[0-9a-f]{6}$/i), currentDefense: z.enum(defenseSystems) });
export const matchSchema = z.object({
  schemaVersion: z.literal(1).default(1), id: text, matchName: text,
  date: z.string().refine(value => Number.isFinite(Date.parse(value))), competition: z.string().max(200).optional(),
  homeTeam: teamSchema, awayTeam: teamSchema,
  currentAttackingTeamId: z.enum(['home', 'away']), currentPossessionIndex: z.number().int().positive(),
  attackPhase: z.enum(attackPhases).default('STATIC'),
  period: z.number().int().min(1).max(20).default(1),
  gameTimeSeconds: seconds.default(0),
  clockStartedAt: z.number().finite().min(0).max(8640000000000000).nullable().default(null),
  events: z.array(eventSchema).max(100000),
}).superRefine((match, ctx) => {
  const bad = (message: string) => ctx.addIssue({ code: 'custom', message });
  if (match.homeTeam.name === match.awayTeam.name) bad('Team names must differ.');
  if (new Set(match.events.map(event => event.id)).size !== match.events.length) bad('Duplicate event identifiers.');
  for (const event of match.events) {
    if (event.matchId !== match.id) bad('Event belongs to another match.');
    if (event.possessionIndex > match.currentPossessionIndex || event.period > match.period) bad('Event exceeds current match state.');
    const names = [match.homeTeam.name, match.awayTeam.name];
    if (!names.includes(event.attackingTeamName) || !names.includes(event.defendingTeamName) || event.attackingTeamName === event.defendingTeamName) bad('Invalid event teams.');
    if (event.attackingTeamId && match[event.attackingTeamId === 'home' ? 'homeTeam' : 'awayTeam'].name !== event.attackingTeamName) bad('Inconsistent team identifier.');
    const flips = ['GOAL','GK_SAVE','SHOT_OUT','STEAL','TECHNICAL_FAULT','POSSESSION_SWITCH'].includes(event.eventType);
    if (event.isPossessionFlipped !== flips) bad('Invalid possession behavior.');
    if (event.eventType === 'TECHNICAL_FAULT' && !technicalFaults.includes(event.subType as TechnicalFaultType)) bad('Missing technical fault subtype.');
    if (event.eventType === 'SANCTION' && (!sanctions.includes(event.subType as SanctionType) || !event.sanctionTeamId)) bad('Missing sanction details.');
    if (!['TECHNICAL_FAULT', 'SANCTION'].includes(event.eventType) && event.subType) bad('Unexpected subtype.');
  }
});
export type MatchEvent = z.infer<typeof eventSchema>;
export type MatchSession = z.infer<typeof matchSchema>;
