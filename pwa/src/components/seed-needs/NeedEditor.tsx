'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { saveNeedRecord } from '@/lib/seed-needs-data';
import { EVIDENCE_LABEL, MATCH_LABEL, type NeedDataset, type NeedKind, type SeedNeedsData, type MarketNeed, type CompanyNeed, type SeedNeedMatch } from '@/lib/seed-needs';
import styles from './seed-needs.module.css';

export type EditorSelection = { kind: NeedKind; record?: MarketNeed | CompanyNeed | SeedNeedMatch; marketId?: string; companyId?: string };
type Field = { key: string; label: string; hint?: string; required?: boolean; short?: boolean; type?: 'date' | 'url' };
const MARKET_FIELDS: Field[] = [
  { key: 'title', label: '市場ニーズ', required: true, short: true }, { key: 'target_user', label: '誰が困っているか', short: true },
  { key: 'problem', label: '課題・困りごと' }, { key: 'current_solution', label: '現在の解決方法・代替手段' },
  { key: 'desired_outcome', label: '実現したい変化・判断基準' },
];
const COMPANY_FIELDS: Field[] = [
  { key: 'title', label: '企業としてのニーズ', required: true, short: true },
  { key: 'company_name', label: '企業名・仮の企業像', short: true, hint: '未確認の企業像は「仮の企業像」と明示' },
  { key: 'business_area', label: '事業領域・顧客' }, { key: 'strengths', label: '得意技術・活用できる資産' },
  { key: 'strategic_intent', label: '目指す事業・方針' }, { key: 'missing_capability', label: '不足する技術・検証事項' },
  { key: 'constraints', label: '採用条件・制約' },
];
const MATCH_FIELDS: Field[] = [
  { key: 'rationale', label: 'このシーズと結ぶ理由' }, { key: 'research_question', label: '追加研究・PoCで確かめる問い' },
  { key: 'experiment', label: '試すこと・実験案' }, { key: 'success_criteria', label: '判定基準', hint: '未確認の数値は仮定で埋めない' },
  { key: 'funding_note', label: '費用・予算・実施条件' }, { key: 'next_action', label: '次に確認すること' },
  { key: 'owner_name', label: '次の担当', short: true }, { key: 'due_on', label: '確認期限', type: 'date', short: true },
];
const EVIDENCE_FIELDS: Field[] = [
  { key: 'evidence_note', label: '根拠・ヒアリング記録', hint: '誰の発言か、仮説か、確認できた範囲を記録' },
  { key: 'source_url', label: '出典URL', type: 'url', short: true }, { key: 'observed_on', label: '情報の確認日', type: 'date', short: true },
];
const KIND_LABEL = { market: '市場ニーズ', company: '企業ニーズ', match: '組み合わせ' };

export function NeedEditor({ selection, dataset, data, onClose, onSaved }: {
  selection: EditorSelection; dataset: NeedDataset; data: SeedNeedsData; onClose: () => void;
  onSaved: (kind: NeedKind, record: MarketNeed | CompanyNeed | SeedNeedMatch) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [seedQuery, setSeedQuery] = useState('');
  const [seedId, setSeedId] = useState((selection.record as SeedNeedMatch | undefined)?.seed_id ?? '');
  const { kind, record } = selection;
  const fields = kind === 'market' ? MARKET_FIELDS : kind === 'company' ? COMPANY_FIELDS : MATCH_FIELDS;
  const values = (record ?? {}) as Record<string, unknown>;
  const companies = data.companies.filter(x => x.dataset === dataset);
  const seeds = data.seeds.filter(x => x.id === seedId || `${x.title} ${x.org_name} ${x.researcher_name}`.toLowerCase().includes(seedQuery.toLowerCase()));
  const close = () => { if (!saving && (!dirty || window.confirm('保存していない変更を破棄する？'))) onClose(); };
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (!form.current) return;
    const fd = new FormData(form.current);
    const payload: Record<string, unknown> = { dataset };
    for (const field of [...fields, ...(kind === 'match' ? [] : EVIDENCE_FIELDS)]) {
      const value = String(fd.get(field.key) ?? '').trim();
      payload[field.key] = field.type === 'date' ? value || null : value;
    }
    if (kind === 'company') payload.market_need_id = String(fd.get('market_need_id') ?? '') || null;
    if (kind === 'match') {
      payload.company_need_id = String(fd.get('company_need_id') ?? ''); payload.seed_id = seedId;
      payload.status = dataset === 'example' ? 'hypothesis' : String(fd.get('status'));
      if (!payload.company_need_id || !seedId) { setError('企業ニーズとシーズを選択。'); return; }
    } else {
      payload.evidence_status = dataset === 'example' ? 'hypothesis' : String(fd.get('evidence_status'));
      if (payload.evidence_status === 'confirmed' && !payload.evidence_note) {
        setError('ヒアリング確認済にする場合は、確認相手・内容を根拠欄へ記録。');
        form.current.querySelector<HTMLTextAreaElement>('[name="evidence_note"]')?.focus(); return;
      }
    }
    setSaving(true);
    try { const saved = await saveNeedRecord(kind, payload, record); onSaved(kind, saved); }
    catch (e) { setError(e instanceof Error ? e.message : '保存に失敗。'); }
    finally { setSaving(false); }
  }
  function fieldView(field: Field) {
    return <label className={styles.field} key={field.key}>
      <span>{field.label}{field.required && <span className={styles.required}> *</span>}</span>
      {field.short ? <input name={field.key} type={field.type ?? 'text'} defaultValue={String(values[field.key] ?? '')} required={field.required} maxLength={field.key === 'title' ? 200 : 2000} />
        : <textarea name={field.key} rows={3} defaultValue={String(values[field.key] ?? '')} required={field.required} maxLength={5000} />}
      {field.hint && <small>{field.hint}</small>}
    </label>;
  }
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="need-editor-title" onCancel={e => { e.preventDefault(); close(); }}>
    <form ref={form} onSubmit={submit} onChange={() => setDirty(true)}>
      <div className={styles.dialogHeader}>
        <div><h2 id="need-editor-title">{KIND_LABEL[kind]}を{record ? '編集' : '追加'}</h2><p>{dataset === 'example' ? '記入例として保存。実在企業の確認済ニーズにはならない。' : '実際の蓄積に保存。未確認の内容は仮説として記録。'}</p></div>
        <button type="button" onClick={close} disabled={saving} className={styles.iconButton} aria-label="閉じる"><X size={20} /></button>
      </div>
      <fieldset disabled={saving} className={styles.formBody}>
        {kind === 'company' && <label className={styles.field}><span>元になる市場ニーズ</span><select name="market_need_id" defaultValue={String(values.market_need_id ?? selection.marketId ?? '')}><option value="">未接続・これから整理</option>{data.markets.filter(x => x.dataset === dataset).map(x => <option value={x.id} key={x.id}>{x.title}</option>)}</select></label>}
        {kind === 'match' && <div className={styles.formGrid}>
          <label className={styles.field}><span>企業ニーズ *</span><select name="company_need_id" required defaultValue={String(values.company_need_id ?? selection.companyId ?? '')}><option value="">選択</option>{companies.map(x => <option key={x.id} value={x.id}>{x.title}｜{x.company_name || '企業未特定'}</option>)}</select>{!companies.length && <small>先に「企業ニーズ」タブで追加</small>}</label>
          <div className={styles.field}><label htmlFor="need-seed-search">既存シーズを検索</label><input id="need-seed-search" value={seedQuery} onChange={e => setSeedQuery(e.target.value)} placeholder="技術名・機関・研究者" /><label htmlFor="need-seed-select">接続するシーズ *</label><select id="need-seed-select" required value={seedId} onChange={e => setSeedId(e.target.value)}><option value="">{seeds.length}件から選択</option>{seeds.map(x => <option value={x.id} key={x.id}>{x.title}｜{x.org_name}・{x.researcher_name}</option>)}</select></div>
        </div>}
        <div className={styles.formGrid}>{fields.map(fieldView)}</div>
        {kind !== 'match' && <><h3>根拠と確認状況</h3>{dataset !== 'example' && <label className={styles.field}><span>確認状況</span><select name="evidence_status" defaultValue={String(values.evidence_status ?? 'hypothesis')}>{Object.entries(EVIDENCE_LABEL).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>}<div className={styles.formGrid}>{EVIDENCE_FIELDS.map(fieldView)}</div></>}
        {kind === 'match' && dataset !== 'example' && <label className={styles.field}><span>段階</span><select name="status" defaultValue={String(values.status ?? 'hypothesis')}>{Object.entries(MATCH_LABEL).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>}
      </fieldset>
      <div className={styles.dialogFooter}>{error && <p role="alert" className={styles.error}>{error}</p>}<button type="button" className={styles.button} onClick={close} disabled={saving}>キャンセル</button><button type="submit" className={styles.primaryButton} disabled={saving}>{saving ? '保存中…' : '保存'}</button></div>
    </form>
  </dialog>;
}
