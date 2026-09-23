import { ArrowLeftRight, CornerDownLeft, Crosshair, Footprints, Hand, Shield, Target, Undo2, Zap, CircleDot, RectangleVertical } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useMatchStore } from '../../store/matchStore';
import { otherTeam, teamOf } from '../../lib/matchEngine';
import { attackPhases, defenseSystems, type EventType } from '../../types/match';
export function TaggingPanel({ onFault, onSanction }: { onFault: () => void; onSanction: () => void }) {
  const store = useMatchStore(); const { match } = store; const { t } = useTranslation();
  const attacker = teamOf(match, match.currentAttackingTeamId); const defender = teamOf(match, otherTeam(match.currentAttackingTeamId));
  const actions = [
    { type: 'GOAL', icon: Target, className: 'goal', help: 'goalHelp' },
    { type: 'GK_SAVE', icon: Hand, className: 'save', help: 'flipHelp' },
    { type: 'SHOT_OUT', icon: Crosshair, className: 'out', help: 'flipHelp' },
    { type: 'STEAL', icon: Zap, className: 'steal', help: 'flipHelp' },
    { type: 'TECHNICAL_FAULT', icon: Footprints, className: 'fault', help: 'faultHelp' },
    { type: 'REBOUND_REGAINED', icon: CornerDownLeft, className: 'rebound', help: 'retainHelp' },
  ] as const;
  return <section className="tagging-panel" aria-label={t('tagEvent')}>
    <div className="phase-panel"><div className="section-label"><span>{t('attackPhase')}</span><small>{t('phaseHelp')}</small></div>
      <div className="segmented phase" role="group" aria-label={t('attackPhase')}>{attackPhases.map(phase => <button key={phase} aria-pressed={match.attackPhase === phase} onClick={() => store.setPhase(phase)}>{t(phase)}</button>)}</div>
    </div>
    <div className="attacking-banner" aria-live="polite"><div className="attack-team"><span className="team-dot" style={{ background: attacker.color }}/><strong>{attacker.name}</strong><span>{t('attacking')}</span></div><ArrowLeftRight size={17}/><div className="defend-team"><span>{defender.name}</span><b>{defender.currentDefense === 'MAN_TO_MAN' || defender.currentDefense === 'OTHER' ? t(defender.currentDefense) : defender.currentDefense}</b><small>{t('defense')}</small></div></div>
    <div className="tag-heading"><div><h2>{t('tagEvent')}</h2><p>{t('actionHelp')}</p></div><span className="possession-badge">{t('possession')} <b>{String(match.currentPossessionIndex).padStart(2, '0')}</b></span></div>
    <div className="action-grid">{actions.map(({ type, icon: Icon, className, help }) => <button key={type} className={`action ${className}`} onClick={() => type === 'TECHNICAL_FAULT' ? onFault() : store.log(type as EventType)}>
      <div className="action-top"><Icon size={26} strokeWidth={1.6}/><span>{type === 'GOAL' ? '+1' : type === 'REBOUND_REGAINED' ? '↳' : '↔'}</span></div><strong>{t(type)}</strong><small>{t(help)}</small>
    </button>)}</div>
    <div className="secondary-actions"><button className="button secondary" onClick={() => store.log('PENALTY_7M')}><CircleDot size={18}/>{t('PENALTY_7M')}</button><button className="button secondary" onClick={onSanction}><RectangleVertical size={17}/>{t('SANCTION')}</button><button className="button plain switch" onClick={store.switchPossession}><ArrowLeftRight size={17}/>{t('manualSwitch')}</button></div>
    <div className="defense-panel"><div className="section-label"><span><Shield size={15}/>{t('defenseSystem')} <em>· {defender.name}</em></span><small>{t('defenseHelp')}</small></div><div className="segmented defense" role="group" aria-label={t('defenseSystem')}>{defenseSystems.map(system => <button key={system} aria-pressed={defender.currentDefense === system} onClick={() => store.setDefense(system)}>{system === 'MAN_TO_MAN' || system === 'OTHER' ? t(system) : system}</button>)}</div></div>
    <div className="tagging-bottom"><span>{t('allLocal')}</span><button className="button undo" disabled={!store.history.length} onClick={store.undo} title={t('undoHelp')}><Undo2 size={17}/>{t('undo')}</button></div>
  </section>;
}
