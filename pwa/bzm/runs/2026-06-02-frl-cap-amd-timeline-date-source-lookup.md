# FRL_cap_amd timeline date source lookup

作成日: 2026-06-02 JST
Owner: BZM司令塔 / frl_cap_amd timeline date source lookup worker
Scope: p04 KT / p09 JC / p11 BWE / p06 CTB の timeline row candidate 用 date/source confidence 整理

## scope_guard

この lookup は `frl_cap_amd_timeline_row_source_pack` の未解決 date/source を read-only で確認したもの。

DB write / DDL / migration / extractor 実装 / deploy / score 再計算はしていない。`frl_cap_amd` の正式値、0-9 score 表、R_net 値付け、PRS 正式採用、現行 7 軸 AMD Score 置換、過去 score 再計算には使わない。

## source_boundary

| source_type | 使い方 |
|---|---|
| public | 公開ページ/PDF。Textbook/public proof に使いやすいが、代表者などは更新遅れや過渡期混在に注意。 |
| internal_knowledge | `/Users/masa/projects/knowledge/*.md`。まさ口述や内部認識を含む。BZM internal / source hygiene 用。 |
| live_db_readonly | Supabase REST read-only。`projects`, `project_knowledge`, `project_members`, `project_founding_members`, `amd_score_inputs`, `source_cache`, `monthly_reports`, `project_meeting_summaries` を参照。DB writeなし。 |
| private_source | Gmail / Slack / Drive / gmeet minutes / SmartRound。source id だけ成果物に残し、秘密値・全文・添付本文は書かない。public 利用前に sanitization 必須。 |

## source_inventory

| source_id_or_path | source_type | status | used_for |
|---|---|---|---|
| `/Users/masa/projects/knowledge/KT.md` | internal_knowledge | found | KT COO派遣型、体制構築、関与終結、Adam後続成果の境界。 |
| `/Users/masa/projects/knowledge/jc.md` | internal_knowledge | found | JC AMD関与起点候補、deep pivot、2026-03関与終結、野田先生接続。 |
| `/Users/masa/projects/knowledge/BWE.md` | internal_knowledge | found | BWE 2024-04関与開始、2025-04-28設立、2026-04-30退任/移譲、まり/はる境界。 |
| `/Users/masa/projects/knowledge/ctb.md` | internal_knowledge | found | CTB COO参画、資金調達失敗後の一旦退任、AMED後の軽関与。 |
| `pwa/bzm/runs/2026-06-02-frl-cap-amd-timeline-row-source-pack.md` | internal_doc | found | 既存 row proposal と still_missing。 |
| `pwa/spec/4-1-frl-ces-current-spec.md` | spec | found | historical PJ は timeline-specific row で別途整理する現行仕様。 |
| `pwa/design/db_schema.md` | spec | found | 参照テーブル/列確認。 |
| `projects` live rows | live_db_readonly | found | p04/p06/p09/p11 の `start_ym`, `end_ym`, current status。 |
| `project_knowledge` live rows | live_db_readonly | found_with_conflict | JC `AMD 参画開始日=2025-11-01` など。自動同期由来で他sourceと衝突あり。 |
| `project_members` live rows | live_db_readonly | found | JC まさ `join_ym=202312`、BWE/CTB current member rows。ただし role date としては粗い。 |
| `amd_score_inputs` live rows | live_db_readonly | found | 既存 timeline evaluated_at 候補の存在確認。正式値ではない。 |
| `source_cache` live rows | live_db_readonly/private_source | found | JC/BWE/CTB の Gmail/Slack/Drive/gmeet snippets。KTは該当なし。 |
| Gmail thread `19de1bd1983aabab` | private_source | found_primary_like | BWE 第4回臨時株主総会、招集通知添付、5/11全議案承認・山地取締役辞任報告。 |
| Gmail messages `19e009dfc93aeed6`, `19e009df0625b79f` | private_source | found_primary_like | BWE SmartRound 委任状。2026-05-09臨時株主総会、山地->吉﨑への議決権委任、株式譲渡承認議案。 |
| source_cache `p11_gmail_thread_19ce6a36b780b877` | private_source | found | BWE 三者共同研究契約、創業者株式整理、4/8 VC面談、3/31押印完了。 |
| source_cache `p11_slack_1774846005_526589` | private_source | found | 2026-03-30時点で「代表権は喪失、SIPのBWE代表として名前を書くのは可」。 |
| source_cache `p09_gmeet_minutes_19cd6576eb53748f` | private_source | found | 2026-03-10 研究開発MTG。野田先生連携計画、流動層技術、NEDO助成金方針。 |
| source_cache `p09_gmeet_minutes_19d19a9f41cfc6df` | private_source | found | 2026-03-23 JOYCLE<>野田先生。共同研究費/覚書方向。 |
| source_cache `p09_gmail_19d3c410fcf29e8b` | private_source | found | 2026-03-30 群馬大野田先生宛の連絡。日常連携/学生協力。 |
| source_cache `p06` monthly reports / Slack snippets | private_source/live_db_readonly | found | CTB AMED事務支援開始/再始動境界。COO exact date ではない。 |
| Blue Water Energy public PDF `https://www.u-rings.jp/cms/wp-content/uploads/2025/08/%E4%BC%9A%E7%A4%BE%E6%A6%82%E8%A6%81%EF%BC%88BWE%E7%A4%BE%EF%BC%89.pdf` | public | found | BWE 2025-04-28設立、代表者 山地正洋、吉﨑COO。 |
| Blue Water Energy official page `https://www.bluewaterenergy.jp/blank-2` | public | found_conflicting_current | Core memberでは吉﨑CEO、company profileでは山地代表者が混在。 |
| CrestecBio official `https://crestecbio.com/about_us/` | public | found | CTB 2021-12-09創業、代表取締役 丸島愛樹。COO/AMD dateなし。 |
| CrestecBio AMED news `https://crestecbio.com/topic/?p=98` | public | found | 2024-12-27 AMED S2採択。light support境界の外部anchor。 |

## p04_kt

| date_target | found_source | source_id_or_path | source_status | confidence | recommended_evaluated_at | notes_update_candidate | still_missing | do_not_infer |
|---|---|---|---|---|---|---|---|---|
| まさCOO参画開始 | `projects.start_ym=202304`; knowledge says VC requested AMD to join as COO | live `projects` row p04; `/Users/masa/projects/knowledge/KT.md` | internal/DB found, not primary | low_to_medium | `2023-04-01` only as provisional internal timeline anchor, not exact officer start | `support_start_at_candidate=2023-04-01; source=projects.start_ym; role_source=knowledge/KT.md; confidence=low_to_medium` | COO appointment/contract/board/email primary source; whether `start_ym` means COO参画 or OS project start | Do not call 2023-04-01 exact COO appointment date. |
| COO/AMD支援終了 | knowledge says AMD ended after management structure started working; KT is current `status=ended`; no exact end date | `/Users/masa/projects/knowledge/KT.md`; live `projects.status=ended`; `source_cache p04 count=0` | missing exact | low | no exact date; use `exact_support_end_at_missing` | `support_end_at=missing; relationship_state=support_ended_but_company_active` | COO退任日、契約終了日、支援終了メール/議事録 | Do not use Adam sale or Series A as AMD support end date. |
| 体制構築完了 | knowledge states management structure was built and then AMD ended; public sources show post-AMD company outcomes | `/Users/masa/projects/knowledge/KT.md`; KT public sources in knowledge | internal narrative only | low | no evaluated_at until primary source found | `structure_building_completed_source=knowledge_only; public outcome source is after-boundary only` | Board/VC/client source saying team can run without AMD | Do not infer structure completion from 2024-03 Adam sales or 2024-05 Series A. |

### p04_kt_judgement

KT は今回の lookup で exact date を埋められなかった。`projects.start_ym=202304` は internal system anchor としては使えるが、COO就任 primary source ではない。timeline row は `candidate_only` のまま、`evaluated_at=2023-04-01?` ではなく `support_start_anchor=2023-04` と書くのが安全。

## p09_jc

| date_target | found_source | source_id_or_path | source_status | confidence | recommended_evaluated_at | notes_update_candidate | still_missing | do_not_infer |
|---|---|---|---|---|---|---|---|---|
| AMD関与開始 exact date | DB has `projects.start_ym=202312`; `project_members` has まさ `join_ym=202312`; `project_knowledge` has `AMD 参画開始日=2025-11-01`; knowledge says 2023-XX | live `projects`, `project_members`, `project_knowledge`; `/Users/masa/projects/knowledge/jc.md` | conflicting | low | no exact date; possible anchors: `2023-12-01` contractual/OS start, `2024-01-01` deep pivot, `2025-11-01` DB basic fact likely support-start backfill | `support_start_at=conflicting; DB projects start_ym 202312; project_knowledge AMD参画開始日 2025-11-01 conflicts with knowledge 2023-XX` | contract start, first invoice, first AMD email/meeting, explanation for 2025-11 backfill | Do not adopt `2025-11-01` as exact AMD relationship start without hygiene review. |
| deep pivot start | Existing XRL/knowledge says 2024-01; source_cache 2026-03 confirms active 野田/流動層 work but not original start | `/Users/masa/projects/knowledge/jc.md`; `pwa/scripts/migrations/007_ventures_xrl_log_seeds.sql`; source_cache `p09_gmeet_minutes_19cd6576eb53748f`, `p09_gmeet_minutes_19d19a9f41cfc6df` | found as timeline anchor, primary for 2026 work only | medium | `2024-01-01` as deep_pivot_start candidate; `2026-03-10/23` as late-stage source confirmations | `deep_pivot_start_candidate=2024-01-01; late evidence shows 野田/流動層 route still active in 2026-03` | first 野田先生 introduction/共同研究 start source around 2024-01 | Do not treat 2026-03 gmeet as proof that deep pivot started in 2026. |
| 2026-03 support end | `projects.end_ym=202603`; knowledge says AMD関与終結 2026-03; source_cache still shows March active R&D/support | live `projects`; `/Users/masa/projects/knowledge/jc.md`; source_cache March 2026 rows | found month-level, exact day missing | medium | `2026-03-31` as support_end_snapshot candidate; `2026-03-01` already exists in `amd_score_inputs` | `support_end_at_month=2026-03; evaluated_at_candidate=2026-03-31 for end snapshot; current row after 2026-03 must not include AMD contribution` | exact termination/resignation email, final invoice/contract close, formal support-end primary source | Do not infer support ended on 2026-03-01 only because `amd_score_inputs` has a row that day. |
| 野田先生接続 / AMD role | project_knowledge and source_cache confirm 野田先生/群馬大共同研究 and March meetings; knowledge attributes connection to AMD | source_cache `p09_gmail_19d3c410fcf29e8b`, `p09_gmail_19cd552e39798caa`, `p09_gmeet_minutes_19d19a9f41cfc6df`; `/Users/masa/projects/knowledge/jc.md` | found, private | medium | use as notes evidence, not date start | `amd_role_source=private_source_cache; 野田先生 is university collaborator, not JC employee; AMD role remains internal attribution pending first-intro source` | first-intro source proving AMD created connection; role source for うめ/きよ | Do not classify 野田先生 as JC employee or AMD member. |

### p09_jc_judgement

JC は `2026-03` support end month の confidence は medium。開始日は衝突が強く、`2023-12`, `2024-01`, `2025-11` を分ける必要がある。timeline row candidate は `2024-01-01 deep_pivot_start` と `2026-03-31 support_end_snapshot` の2点を候補化し、AMD relationship start exact date は missing のままにする。

## p11_bwe

| date_target | found_source | source_id_or_path | source_status | confidence | recommended_evaluated_at | notes_update_candidate | still_missing | do_not_infer |
|---|---|---|---|---|---|---|---|---|
| 2024-04 SIP内関与開始 | knowledge says AMD involvement started 2024-04; live `projects.start_ym=202404`; BWE is SIP-origin | `/Users/masa/projects/knowledge/BWE.md`; live `projects.start_ym=202404` | found internal/DB | medium | `2024-04-01` as SIP/AMD support start anchor | `support_start_at_candidate=2024-04-01; source=knowledge + projects.start_ym; before_zero=true` | primary request from Cabinet Office/SIP or first contract/email | Do not use `project_ventures.amd_support_started_at=2026-02-01`; it conflicts with knowledge and projects row. |
| 2025-04-28 founding | Public PDF states 2025-04-28; knowledge agrees; gBiz/third-party pages show法人番号指定 2025-05-01 but not incorporation date | public PDF; `/Users/masa/projects/knowledge/BWE.md`; Gビズ/法人番号-derived pages | found public | high | `2025-04-28` founding_snapshot | `founding_at=2025-04-28; public_source=ube/u-rings PDF; representative_at_founding=山地正洋 in public PDF` | 登記簿 primary if legal incorporation date needs absolute proof | Do not replace with DB `project_ventures.founded_at=2019-04-01`; that row is stale/hygiene issue. |
| まさCEO/代表期間 | Public PDF lists representative 山地正洋 and team page has 山地 as CEO/representative in company profile; source_cache 2026-03-30 says representative authority already lost but SIP representative name acceptable | public PDF; official page; source_cache `p11_slack_1774846005_526589` | found with public-current conflict | medium | start: `2025-04-28`; end boundary before or at `2026-03-30` for representative authority loss; use `2026-04-30` for director resignation/transfer snapshot | `masa_representative_period=2025-04-28 to before_or_on_2026-03-30?; director_transfer_snapshot=2026-04-30/2026-05-09` | 登記履歴 for代表取締役変更日; resignation letter date; exact representative authority loss date | Do not assert 2026-04-30 as representative authority loss; evidence says by 2026-03-30 representative authority was already lost. |
| 2026-04-30退任/移譲 primary source | Gmail thread says 2026-05-01 invite from 吉﨑 as representative; 2026-05-11 follow-up reports all agenda approved and 山地取締役 resignation as 2026-05-09 or 2026-04-30; SmartRound proxy proves 2026-05-09 GM and stock transfer approval agenda | Gmail thread `19de1bd1983aabab`; messages `19e15090a40e7f65`, `19e009dfc93aeed6`, `19e009df0625b79f`; `/Users/masa/projects/knowledge/BWE.md` | found private primary-like | high for GM/stock transfer; medium for effective resignation date due wording ambiguity | `2026-04-30` as transfer/retirement candidate; `2026-05-09` as shareholder meeting approval snapshot | `support_end_at_candidate=2026-04-30; governance_confirmation_at=2026-05-09; source=Gmail/SmartRound private; wording says 本日または令和8年4月30日付` | final minutes /登記変更履歴 / resignation acceptance | Do not state legal resignation effective date as settled without final minutes or registry. |
| まり/はる handling | Knowledge and later DB `project_founding_members` classify 吉﨑 as BWE startup/representative, not AMD contribution row; public current page has 吉﨑 CEO; source says stock aggregation to 吉﨑 | `/Users/masa/projects/knowledge/BWE.md`; live `project_founding_members`; official page; Gmail thread `19de1bd1983aabab` | found | high for 吉﨑 as BWE-side current CEO; medium for はる COO role | use `2026-04-30 transfer_snapshot` / `2026-05-09 governance confirmation` | `まり/はる are AMD members personally, but timeline row should separate AMD-provided launch support from卒業先経営チーム; 吉﨑 after transfer belongs to BWE active team` | はるの正式役職/source; employment/appointment dates | Do not countまり/はる as AMD-side `frl_cap_amd` after transfer merely because they are AMD members. |

### p11_bwe_judgement

BWE は今回一番 source confidence が高い。public proof と private primary-like source を分けると、次の整理が安全。

- founding snapshot: `2025-04-28`, public source confidence high。
- AMD/SIP support start anchor: `2024-04-01`, internal/DB confidence medium。
- まさ representative period: start is `2025-04-28` high/medium、end is unresolved。`2026-03-30` 時点で代表権喪失を示す Slack source があるため、代表権喪失を `2026-04-30` と推測してはいけない。
- transfer/governance snapshot: `2026-04-30` candidate + `2026-05-09` GM confirmation。取締役退任は Gmail上 high, legal effective dateは final minutes/registry待ち。

## p06_ctb

| date_target | found_source | source_id_or_path | source_status | confidence | recommended_evaluated_at | notes_update_candidate | still_missing | do_not_infer |
|---|---|---|---|---|---|---|---|---|
| COO参画開始 | `projects.start_ym=202306`; knowledge says after 0 COO参画 after small animal test; monthly_reports show activity from 2024-06/07 but likely later OS data | live `projects`; `/Users/masa/projects/knowledge/ctb.md`; monthly_reports p06 | found as DB anchor, not primary | medium for AMD project start, low for exact COO appointment | `2023-06-01` as internal support start anchor only | `support_start_at_candidate=2023-06-01; source=projects.start_ym; role=COO from knowledge; confidence=medium/low` | COO appointment/contract/board source; whether `start_ym=202306` means COO start | Do not use CTB incorporation 2021-12-09 as AMD COO start. |
| COO退任/支援終了 | knowledge says funding failed/funds depleted, then まさ COO退任; current DB has frozen from 202605; no exact COO exit | `/Users/masa/projects/knowledge/ctb.md`; migration `112_ctb_frl_cap_amd_frozen_correction.sql`; `amd_score_inputs` current row | missing exact | low | no exact date; use `exact_coo_exit_at_missing` | `coo_exit_at=missing; historical row can end before AMED light-support phase` | resignation/contract end/board source; funding-depletion date | Do not infer COO exit from 2024-12 AMED adoption or 2025-01 restart. |
| AMED採択後 light support境界 | public CTB news says AMED S2採択 2024-12-27; monthly report 2025-01 says AMED adoption caused project restart; 2025-02 says AMED事務支援 scope clarified; knowledge says after AMED only office/admin support | CTB public news `https://crestecbio.com/topic/?p=98`; monthly_reports `MR_p06_202501`, `MR_p06_202502`; `/Users/masa/projects/knowledge/ctb.md` | found | high for AMED採択 date; medium for light-support start month | `2025-01-01` restart snapshot or `2025-02-01` scope-clarified snapshot; current row guard remains `2026-05-07` | `light_support_after_amed=true; amed_awarded_at=2024-12-27; light_support_start_candidate=2025-01/2025-02; do_not_count_as_current_F_cap` | contract scope for AMED事務支援, exact restart date | Do not treat AMED事務対応 as current active COO/F_cap contribution. |

### p06_ctb_judgement

CTB は `support_start_at=2023-06-01` を internal anchor として置けるが、COO exact date は missing。AMED後の light support 境界は `2024-12-27` 採択、`2025-01` 再始動、`2025-02` 事務支援 scope clarified の3段で書くと安全。current correction `frl_cap=3`, `frl_cap_amd=0` は維持。

## cross_project_conflicts

| conflict | observed | recommendation |
|---|---|---|
| JC start dates | `knowledge: 2023-XX`, `projects.start_ym=202312`, `project_members.masa.join_ym=202312`, `project_knowledge.AMD参画開始日=2025-11-01` | `2025-11-01` は basic_facts_sync/backfill由来の可能性があるため date sourceとして採用しない。OS/DB hygieneに回す。 |
| BWE representative | public PDF/company profile still shows 山地代表者; official page/core member and private Gmail show 吉﨑 representative by 2026-05 | timelineでは「public source conflict」として分ける。public pageだけで current representative transitionを確定しない。 |
| BWE `project_ventures.founded_at=2019-04-01` | public/knowledge says 2025-04-28 | DB hygiene issue。timeline row sourceには使わない。 |
| BWE `project_ventures.amd_support_started_at=2026-02-01` | knowledge/projects says 2024-04 | DB hygiene issue。timeline row sourceには使わない。 |
| CTB `project_ventures.founded_at=2023-04-01` | CTB official says 2021-12-09 | DB hygiene issue。AMD COO/support dateには使わない。 |
| KT exact support dates | no source_cache / no primary found | Missingのまま。public後続成果から逆算しない。 |

## recommended_timeline_candidate_dates

| PJ | row_type | recommended_evaluated_at | confidence | source posture |
|---|---|---|---|---|
| p04 KT | `amd_coo_structure_building` | no exact; provisional anchor `2023-04-01` only if notes say `support_start_anchor` | low_to_medium | internal only; primary missing |
| p09 JC | `amd_deep_pivot_attempt` | `2024-01-01` deep_pivot_start candidate | medium | internal + seed/migration + later private confirmations |
| p09 JC | `support_end_snapshot` | `2026-03-31` candidate | medium | DB end_ym + knowledge; exact day missing |
| p11 BWE | `sip_support_start` | `2024-04-01` | medium | internal + projects start_ym |
| p11 BWE | `founding_snapshot` | `2025-04-28` | high | public PDF + knowledge |
| p11 BWE | `transfer_snapshot` | `2026-04-30` candidate, with `2026-05-09` governance confirmation | high for event, medium for legal effective date | Gmail/SmartRound private; final minutes/registry still missing |
| p06 CTB | `amd_coo_pre_amed_case` | no exact; provisional anchor `2023-06-01` only if notes say `projects.start_ym` | medium for support anchor, low for COO exact |
| p06 CTB | `amed_light_support_boundary` | `2024-12-27` AMED採択, `2025-01-01` restart, `2025-02-01` scope clarified | high/medium | public AMED adoption + monthly reports + knowledge |

## still_missing_next_lookup

| PJ | missing |
|---|---|
| KT | COO appointment/contract/board/email source; COO退任/支援終了 source; VC request primary source; structure-building completion evidence. |
| JC | First AMD engagement source; first 野田先生 introduction source around 2024-01; exact 2026-03 support-end document; role source for うめ/きよ if they remain candidate. |
| BWE | 登記履歴 or final minutes for representative authority loss and director resignation effective date; resignation letter; はる formal role/appointment source. |
| CTB | COO appointment/contract/board source; COO退任 date/source; AMED事務支援 contract/scope source. |

## do_not_use_as

- `frl_cap_amd` formal values.
- 0-9 score table.
- R_net value assignment.
- PRS adoption proof.
- current row update instruction.
- public proof without sanitizing private/internal sources.
- DB hygiene correction instruction. Conflicting DB dates are noted only for OS/DB hygiene handoff.
