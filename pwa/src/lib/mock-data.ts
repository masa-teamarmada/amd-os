import type {
  Project,
  Member,
  ValuePlanCycle,
  ValueMilestone,
  MilestoneMonthlyProgress,
  BillingCycle,
  Task,
  TsukuyomiNudge,
  MonthlyReport,
} from "@/types/database";

// ============================================================
// Mock Members
// ============================================================
export const MOCK_MEMBERS: Member[] = [
  {
    id: "m1",
    member_id: "MBR001",
    code_name: "Ace",
    email: "masa@team-armada.jp",
    role: "CEO / PM",
    status: "active",
    slack_id: "U12345",
    is_admin: true,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
  {
    id: "m2",
    member_id: "MBR002",
    code_name: "Blade",
    email: "kyoko@team-armada.jp",
    role: "CFO",
    status: "active",
    slack_id: "U12346",
    is_admin: true,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
  {
    id: "m3",
    member_id: "MBR003",
    code_name: "Cipher",
    email: "dev1@team-armada.jp",
    role: "Engineer",
    status: "active",
    slack_id: "U12347",
    is_admin: false,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
  {
    id: "m4",
    member_id: "MBR004",
    code_name: "Delta",
    email: "dev2@team-armada.jp",
    role: "Designer",
    status: "active",
    slack_id: "U12348",
    is_admin: false,
    created_at: "2025-03-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
  {
    id: "m5",
    member_id: "MBR005",
    code_name: "Echo",
    email: "biz@team-armada.jp",
    role: "BizDev",
    status: "inactive",
    slack_id: null,
    is_admin: false,
    created_at: "2024-06-01T00:00:00Z",
    updated_at: "2026-02-01T00:00:00Z",
  },
];

// ============================================================
// Mock Projects
// ============================================================
export const MOCK_PROJECTS: Project[] = [
  {
    id: "p1",
    project_id: "PJ001",
    project_name: "QuantumLeap",
    client_name: "Nexus Corp",
    status: "active",
    slack_channel_id: "C001",
    drive_folder_id: "folder1",
    freee_partner_id: "FP001",
    start_ym: "202401",
    end_ym: null,
    contract_terms_json: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
  {
    id: "p2",
    project_id: "PJ002",
    project_name: "SkyForge",
    client_name: "Altitude Inc",
    status: "active",
    slack_channel_id: "C002",
    drive_folder_id: "folder2",
    freee_partner_id: "FP002",
    start_ym: "202404",
    end_ym: null,
    contract_terms_json: null,
    created_at: "2024-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
  {
    id: "p3",
    project_id: "PJ003",
    project_name: "DeepCurrent",
    client_name: "OceanTech Ltd",
    status: "active",
    slack_channel_id: "C003",
    drive_folder_id: "folder3",
    freee_partner_id: null,
    start_ym: "202501",
    end_ym: null,
    contract_terms_json: null,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
  {
    id: "p4",
    project_id: "PJ004",
    project_name: "NovaSeed",
    client_name: "Stellar Ventures",
    status: "sales",
    slack_channel_id: "C004",
    drive_folder_id: null,
    freee_partner_id: null,
    start_ym: "202603",
    end_ym: null,
    contract_terms_json: null,
    created_at: "2026-03-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
  {
    id: "p5",
    project_id: "PJ005",
    project_name: "IronPulse",
    client_name: "Forge Industries",
    status: "ended",
    slack_channel_id: "C005",
    drive_folder_id: "folder5",
    freee_partner_id: "FP005",
    start_ym: "202301",
    end_ym: "202512",
    contract_terms_json: null,
    created_at: "2023-01-01T00:00:00Z",
    updated_at: "2025-12-31T00:00:00Z",
  },
  {
    id: "p6",
    project_id: "PJ006",
    project_name: "ZeroPoint",
    client_name: "Void Systems",
    status: "frozen",
    slack_channel_id: null,
    drive_folder_id: null,
    freee_partner_id: null,
    start_ym: "202506",
    end_ym: null,
    contract_terms_json: null,
    created_at: "2025-06-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

// ============================================================
// Mock Plan Cycles & Milestones (for PJ001)
// ============================================================
export const MOCK_PLAN_CYCLE: ValuePlanCycle = {
  id: "pc1",
  plan_cycle_id: "PC001",
  project_id: "PJ001",
  status: "active",
  budget_yen: 12000000,
  total_points: 100,
  period_start_ym: "202604",
  period_end_ym: "202703",
  created_at: "2026-04-01T00:00:00Z",
};

export const MOCK_MILESTONES: ValueMilestone[] = [
  {
    id: "ms1",
    milestone_id: "MS001",
    plan_cycle_id: "PC001",
    title: "プロトタイプ完成・デモ実施",
    points: 25,
    tag: "normal",
    goal_level: "Must",
    is_active: true,
    success_criteria: "動作するプロトタイプを顧客にデモ",
    sort_order: 1,
  },
  {
    id: "ms2",
    milestone_id: "MS002",
    plan_cycle_id: "PC001",
    title: "量子ビット安定性 99.5% 達成",
    points: 30,
    tag: "normal",
    goal_level: "Must",
    is_active: true,
    success_criteria: "連続48時間のベンチマーク通過",
    sort_order: 2,
  },
  {
    id: "ms3",
    milestone_id: "MS003",
    plan_cycle_id: "PC001",
    title: "SDK v1.0 リリース",
    points: 20,
    tag: "normal",
    goal_level: "Want",
    is_active: true,
    success_criteria: "ドキュメント付きでGitHub公開",
    sort_order: 3,
  },
  {
    id: "ms4",
    milestone_id: "MS004",
    plan_cycle_id: "PC001",
    title: "月次定例・レポート",
    points: 15,
    tag: "routine",
    goal_level: null,
    is_active: true,
    success_criteria: null,
    sort_order: 4,
  },
  {
    id: "ms5",
    milestone_id: "MS005",
    plan_cycle_id: "PC001",
    title: "バッファ（リスク対応）",
    points: 10,
    tag: "buffer",
    goal_level: null,
    is_active: true,
    success_criteria: null,
    sort_order: 5,
  },
];

export const MOCK_PROGRESS: MilestoneMonthlyProgress[] = [
  { id: "mp1", milestone_key: "MS001", ym: "202604", progress_pct: 65, consumed_pt: 16.25, source: "manual", confirmed_at: "2026-04-08T10:00:00Z" },
  { id: "mp2", milestone_key: "MS002", ym: "202604", progress_pct: 40, consumed_pt: 12, source: "manual", confirmed_at: "2026-04-08T10:00:00Z" },
  { id: "mp3", milestone_key: "MS003", ym: "202604", progress_pct: 20, consumed_pt: 4, source: "manual", confirmed_at: null },
  { id: "mp4", milestone_key: "MS004", ym: "202604", progress_pct: 100, consumed_pt: 15, source: "routine_auto", confirmed_at: "2026-04-01T00:00:00Z" },
  { id: "mp5", milestone_key: "MS005", ym: "202604", progress_pct: 0, consumed_pt: 0, source: null, confirmed_at: null },
];

// ============================================================
// Mock Billing Cycles
// ============================================================
export const MOCK_BILLING_CYCLES: BillingCycle[] = [
  // PJ001 — current + past months
  {
    id: "bc1", project_id: "PJ001", ym: "202604", budget_yen: 1000000,
    status: "reported",
    meeting_start_at: "2026-04-03T10:00:00Z",
    report_fixed_at: null, invoice_sent_at: null, payment_confirmed_at: null,
    ms_progress_summary_json: null, member_allocations_json: null, reward_summary_json: null,
    created_at: "2026-04-01T00:00:00Z", updated_at: "2026-04-08T00:00:00Z",
  },
  {
    id: "bc1b", project_id: "PJ001", ym: "202603", budget_yen: 1000000,
    status: "payment_confirmed",
    meeting_start_at: "2026-03-05T10:00:00Z",
    report_fixed_at: "2026-03-15T09:00:00Z",
    invoice_sent_at: "2026-03-18T10:00:00Z",
    payment_confirmed_at: "2026-03-28T10:00:00Z",
    ms_progress_summary_json: null, member_allocations_json: null, reward_summary_json: null,
    created_at: "2026-03-01T00:00:00Z", updated_at: "2026-03-28T00:00:00Z",
  },
  {
    id: "bc1c", project_id: "PJ001", ym: "202602", budget_yen: 1000000,
    status: "payment_confirmed",
    meeting_start_at: "2026-02-04T10:00:00Z",
    report_fixed_at: "2026-02-14T09:00:00Z",
    invoice_sent_at: "2026-02-17T10:00:00Z",
    payment_confirmed_at: "2026-02-27T10:00:00Z",
    ms_progress_summary_json: null, member_allocations_json: null, reward_summary_json: null,
    created_at: "2026-02-01T00:00:00Z", updated_at: "2026-02-27T00:00:00Z",
  },
  {
    id: "bc1d", project_id: "PJ001", ym: "202601", budget_yen: 1000000,
    status: "payment_confirmed",
    meeting_start_at: "2026-01-08T10:00:00Z",
    report_fixed_at: "2026-01-15T09:00:00Z",
    invoice_sent_at: "2026-01-20T10:00:00Z",
    payment_confirmed_at: "2026-01-31T10:00:00Z",
    ms_progress_summary_json: null, member_allocations_json: null, reward_summary_json: null,
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-31T00:00:00Z",
  },
  // PJ002
  {
    id: "bc2", project_id: "PJ002", ym: "202604", budget_yen: 800000,
    status: "invoice_sent",
    meeting_start_at: "2026-04-02T14:00:00Z",
    report_fixed_at: "2026-04-05T09:00:00Z",
    invoice_sent_at: "2026-04-06T10:00:00Z",
    payment_confirmed_at: null,
    ms_progress_summary_json: null, member_allocations_json: null, reward_summary_json: null,
    created_at: "2026-04-01T00:00:00Z", updated_at: "2026-04-06T00:00:00Z",
  },
  // PJ003
  {
    id: "bc3", project_id: "PJ003", ym: "202604", budget_yen: 600000,
    status: "not_started",
    meeting_start_at: null,
    report_fixed_at: null, invoice_sent_at: null, payment_confirmed_at: null,
    ms_progress_summary_json: null, member_allocations_json: null, reward_summary_json: null,
    created_at: "2026-04-01T00:00:00Z", updated_at: "2026-04-01T00:00:00Z",
  },
];

// ============================================================
// Mock Tasks (for PJ001)
// ============================================================
export const MOCK_TASKS: Task[] = [
  { id: "t1", task_id: "T001", project_id: "PJ001", title: "量子制御UIのモック作成", description: null, status: "doing", assignee: "Cipher", priority: "high", created_at: "2026-04-05T00:00:00Z", updated_at: "2026-04-08T00:00:00Z" },
  { id: "t2", task_id: "T002", project_id: "PJ001", title: "エラーハンドリング改善", description: null, status: "todo", assignee: "Cipher", priority: "medium", created_at: "2026-04-06T00:00:00Z", updated_at: "2026-04-06T00:00:00Z" },
  { id: "t3", task_id: "T003", project_id: "PJ001", title: "ベンチマーク環境構築", description: null, status: "todo", assignee: "Delta", priority: "high", created_at: "2026-04-03T00:00:00Z", updated_at: "2026-04-03T00:00:00Z" },
  { id: "t4", task_id: "T004", project_id: "PJ001", title: "APIドキュメント v0.9 作成", description: null, status: "doing", assignee: "Ace", priority: "medium", created_at: "2026-04-01T00:00:00Z", updated_at: "2026-04-07T00:00:00Z" },
  { id: "t5", task_id: "T005", project_id: "PJ001", title: "Nexus社向けデモ資料", description: null, status: "pending", assignee: null, priority: "low", created_at: "2026-04-08T00:00:00Z", updated_at: "2026-04-08T00:00:00Z" },
  { id: "t6", task_id: "T006", project_id: "PJ001", title: "CI/CDパイプライン設定", description: null, status: "done", assignee: "Cipher", priority: "high", created_at: "2026-03-28T00:00:00Z", updated_at: "2026-04-02T00:00:00Z" },
  { id: "t7", task_id: "T007", project_id: "PJ001", title: "セキュリティ監査対応", description: null, status: "done", assignee: "Ace", priority: "high", created_at: "2026-03-25T00:00:00Z", updated_at: "2026-04-01T00:00:00Z" },
];

// ============================================================
// Mock Nudges
// ============================================================
export const MOCK_NUDGES: TsukuyomiNudge[] = [
  { id: "n1", project_id: "PJ001", ym: "202604", message: "Nexus社の田中さんから先週のデモについてフィードバックが来ています。確認をお勧めします。", status: "posted", posted_at: "2026-04-08T09:30:00Z" },
  { id: "n2", project_id: "PJ001", ym: "202604", message: "MS002（量子ビット安定性）の進捗が40%で、目標ペースより遅れ気味です。Cipherさんと状況確認してみては？", status: "ready", posted_at: null },
  { id: "n3", project_id: "PJ001", ym: "202604", message: "月次レポートがまだ未確定です。今月の締切は4/15です。", status: "ready", posted_at: null },
];

// ============================================================
// Mock Monthly Report
// ============================================================
export const MOCK_REPORT: MonthlyReport = {
  id: "r1",
  report_id: "RPT-PJ001-202604",
  project_id: "PJ001",
  ym: "202604",
  draft_content: `## 2026年4月 月次レポート — QuantumLeap

### 今月のハイライト
- プロトタイプv0.8が完成し、Nexus社にデモを実施。好評を得た
- 量子ビット安定性テストで新記録を達成（99.2%、目標99.5%まであと少し）
- SDK開発が本格始動。API設計のレビューを完了

### 進捗サマリー
| MS | 進捗 | コメント |
|---|---|---|
| プロトタイプ完成 | 65% | デモ実施済み、フィードバック反映中 |
| 量子ビット安定性 | 40% | 99.2%達成、冷却系の最適化が残り |
| SDK v1.0 | 20% | API設計完了、実装着手 |

### リスク・懸念
- 冷却装置の納期が2週間遅延の可能性あり
- Cipher の工数が他PJと重複している期間あり

### 来月のアクション
- 量子ビット安定性テストの48時間連続ラン実施
- SDK alpha版リリース（社内向け）
- Nexus社向け中間報告会の設定`,
  final_content: null,
  status: "pending",
  generated_at: "2026-04-08T05:00:00Z",
  fixed_at: null,
};
