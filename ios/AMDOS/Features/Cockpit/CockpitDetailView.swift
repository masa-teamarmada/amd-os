import SwiftUI

struct CockpitDetailView: View {
    let project: SupabaseProject

    @EnvironmentObject private var authService: AuthService

    @State private var cockpitData: CockpitData?
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var selectedCard: CockpitMonthCard?
    @State private var showMsEdit = false
    @State private var showMsManagement = false
    @State private var isAdmin = false
    @State private var showFixPlanConfirm = false
    @State private var isFixingPlan = false
    @State private var fixPlanError: String?

    var body: some View {
        ZStack {
            AMD.bgPage.ignoresSafeArea()
            Group {
                if isLoading {
                    ProgressView("読み込み中...")
                } else if let err = errorMessage {
                    errorBody(err)
                } else if let data = cockpitData {
                    contentBody(data)
                }
            }
        }
        .navigationTitle(project.projectName)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Menu {
                    Button {
                        showMsEdit = true
                    } label: {
                        Label("当月進捗を更新", systemImage: "slider.horizontal.3")
                    }

                    Button {
                        showMsManagement = true
                    } label: {
                        Label("MS管理", systemImage: "square.and.pencil")
                    }
                } label: {
                    Image(systemName: "slider.horizontal.3")
                }
                .disabled(cockpitData?.milestones.isEmpty ?? true)
            }
        }
        .sheet(item: $selectedCard) { card in
            MonthlyModal(
                projectId: project.projectId,
                projectName: project.projectName,
                monthCard: card
            )
        }
        .sheet(isPresented: $showMsEdit) {
            if let data = cockpitData {
                MsProgressEditSheet(
                    projectId: project.projectId,
                    milestones: data.milestones,
                    onSaved: { Task { await loadData() } }
                )
            }
        }
        .sheet(isPresented: $showMsManagement) {
            if let data = cockpitData, let planCycleId = data.planCycle?.planCycleId {
                MilestoneManagementSheet(
                    planCycleId: planCycleId,
                    milestones: data.milestones,
                    onSaved: { Task { await loadData() } }
                )
            }
        }
        .task { await loadData() }
        .refreshable { await loadData() }
    }

    // MARK: - Content

    private func contentBody(_ data: CockpitData) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                // Client label
                if let client = project.clientName, !client.isEmpty {
                    Text(client)
                        .font(.system(size: 11, weight: .bold))
                        .tracking(1.4)
                        .textCase(.uppercase)
                        .foregroundStyle(AMD.textTertiary)
                        .padding(.horizontal, 20)
                        .padding(.top, 20)
                        .padding(.bottom, 4)
                }

                // Plan cycle + milestones card
                if let plan = data.planCycle {
                    planCard(plan, milestones: data.milestones)
                        .padding(.horizontal, 16)
                        .padding(.top, 12)
                } else {
                    noPlanBanner
                        .padding(.horizontal, 16)
                        .padding(.top, 12)
                }

                // Monthly cards header
                Text("月次進捗")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(AMD.textSub)
                    .padding(.horizontal, 20)
                    .padding(.top, 28)
                    .padding(.bottom, 8)

                if data.monthlyCards.isEmpty {
                    Text("データなし")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 20)
                } else {
                    VStack(spacing: 10) {
                        ForEach(data.monthlyCards) { card in
                            MonthCardView(card: card) {
                                selectedCard = card
                            }
                            .padding(.horizontal, 16)
                        }
                    }
                }

                Spacer(minLength: 40)
            }
        }
    }

    // MARK: - Plan Card

    private func planCard(_ plan: CockpitPlanCycle, milestones: [CockpitMilestone]) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            // Period + total points
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        Text("バリュープラン")
                            .font(.caption)
                            .foregroundStyle(AMD.textTertiary)
                        planStatusBadge(plan)
                    }
                    Text(plan.displayPeriod)
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundStyle(AMD.text)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text("総ポイント")
                        .font(.caption)
                        .foregroundStyle(AMD.textTertiary)
                    Text("\(plan.totalPoints) pt")
                        .font(.title3)
                        .fontWeight(.bold)
                        .foregroundStyle(AMD.blue)
                        .monospacedDigit()
                }
            }

            if milestones.isEmpty {
                Text("MSが登録されていません")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                Divider()
                VStack(spacing: 10) {
                    ForEach(milestones) { ms in
                        milestoneRow(ms)
                    }
                }
            }

            // Admin-only: 「プランを確定する」ボタン (active/confirmed/draft の時だけ)
            if isAdmin && plan.isFixable {
                Divider()
                VStack(alignment: .leading, spacing: 6) {
                    Button {
                        showFixPlanConfirm = true
                    } label: {
                        HStack {
                            if isFixingPlan {
                                ProgressView()
                                    .controlSize(.small)
                            } else {
                                Image(systemName: "checkmark.seal.fill")
                            }
                            Text(isFixingPlan ? "確定中..." : "プランを確定する")
                                .font(.subheadline)
                                .fontWeight(.semibold)
                        }
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(AMD.blue)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                    .buttonStyle(.plain)
                    .disabled(isFixingPlan)
                    Text("確定すると報酬サマリ（メンバー獲得pt / 想定報酬）が計算されます。")
                        .font(.caption2)
                        .foregroundStyle(AMD.textTertiary)
                    if let err = fixPlanError {
                        Text(err)
                            .font(.caption2)
                            .foregroundStyle(.red)
                    }
                }
            }

            // Edit hint
            if !milestones.isEmpty {
                HStack {
                    Spacer()
                    Button {
                        showMsEdit = true
                    } label: {
                        Label("進捗を更新", systemImage: "pencil")
                            .font(.caption)
                            .foregroundStyle(AMD.blue)
                    }
                }
            }
        }
        .padding(16)
        .background(AMD.card)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .confirmationDialog(
            "プランを確定する？",
            isPresented: $showFixPlanConfirm,
            titleVisibility: .visible
        ) {
            Button("確定する") {
                Task { await fixPlan(plan) }
            }
            Button("キャンセル", role: .cancel) {}
        } message: {
            Text("確定すると編集モードが終了し、報酬サマリ（メンバー獲得pt / 想定報酬）が計算されます。あとで MS の追加・編集も可能です。")
        }
    }

    @ViewBuilder
    private func planStatusBadge(_ plan: CockpitPlanCycle) -> some View {
        let (bg, fg): (Color, Color) = {
            switch plan.status {
            case "fixed":     return (Color.green.opacity(0.12), .green)
            case "confirmed": return (Color.blue.opacity(0.12), AMD.blue)
            case "draft":     return (Color.gray.opacity(0.12), AMD.textSub)
            default:          return (Color.orange.opacity(0.12), .orange) // active 含む
            }
        }()
        Text(plan.statusLabel)
            .font(.system(size: 10, weight: .semibold))
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(bg)
            .foregroundStyle(fg)
            .clipShape(RoundedRectangle(cornerRadius: 4))
    }

    private func fixPlan(_ plan: CockpitPlanCycle) async {
        isFixingPlan = true
        fixPlanError = nil
        do {
            try await SupabaseService.shared.fixPlanCycle(planCycleId: plan.planCycleId)
            await loadData()
        } catch {
            fixPlanError = "確定に失敗しました: \(error.localizedDescription)"
        }
        isFixingPlan = false
    }

    private func milestoneRow(_ ms: CockpitMilestone) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 6) {
                Text(ms.tagLabel)
                    .font(.system(size: 10, weight: .medium))
                    .padding(.horizontal, 5)
                    .padding(.vertical, 2)
                    .background(ms.tagColor.opacity(0.12))
                    .foregroundStyle(ms.tagColor)
                    .clipShape(RoundedRectangle(cornerRadius: 4))
                Text(ms.title)
                    .font(.subheadline)
                    .lineLimit(1)
                Spacer()
                if let targetYm = ms.targetYm, !targetYm.isEmpty {
                    Text(ymDisplay(targetYm))
                        .font(.caption)
                        .foregroundStyle(AMD.textTertiary)
                }
                Text("\(Int(ms.currentProgressPct))%")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .monospacedDigit()
                Text("/ \(ms.points)pt")
                    .font(.caption)
                    .foregroundStyle(AMD.textSub)
            }
            ProgressView(value: ms.currentProgressPct, total: 100)
                .tint(ms.tagColor)
            if !ms.subItems.isEmpty {
                Text("\(ms.subItems.filter(\.isDone).count)/\(ms.subItems.count) サブ項目完了")
                    .font(.caption)
                    .foregroundStyle(AMD.textSub)
            }
        }
    }

    private var noPlanBanner: some View {
        HStack(spacing: 10) {
            Image(systemName: "info.circle")
                .foregroundStyle(AMD.textSub)
            Text("バリュープランが未設定です")
                .font(.subheadline)
                .foregroundStyle(AMD.textSub)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AMD.bgDeep)
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    // MARK: - Error

    private func errorBody(_ message: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 48))
                .foregroundStyle(.orange)
            Text(message)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button("再読み込み") { Task { await loadData() } }
                .buttonStyle(.borderedProminent)
        }
        .padding()
    }

    // MARK: - Data

    private func loadData() async {
        isLoading = true
        errorMessage = nil
        do {
            cockpitData = try await SupabaseService.shared.fetchCockpitData(projectId: project.projectId)
        } catch {
            errorMessage = error.localizedDescription
        }
        if let email = authService.userEmail {
            isAdmin = (try? await SupabaseService.shared.fetchIsAdmin(email: email)) ?? false
        }
        isLoading = false
    }
}

// MARK: - Month Card View

struct MonthCardView: View {
    let card: CockpitMonthCard
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 10) {
                // Header row
                HStack(alignment: .top, spacing: 8) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(card.displayYm)
                            .font(.headline)
                            .foregroundStyle(AMD.text)
                        if card.isCurrent {
                            Text("当月")
                                .font(.system(size: 10, weight: .semibold))
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(AMD.blueTint)
                                .foregroundStyle(AMD.blue)
                                .clipShape(RoundedRectangle(cornerRadius: 4))
                        }
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 2) {
                        if let budget = card.budgetYen, budget > 0 {
                            Text("¥\(Int(budget).formatted())")
                                .font(.subheadline)
                                .fontWeight(.semibold)
                                .monospacedDigit()
                                .foregroundStyle(AMD.text)
                        }
                        if card.totalMonthlyPt > 0 {
                            Text(String(format: "+%.1f pt", card.totalMonthlyPt))
                                .font(.caption)
                                .foregroundStyle(AMD.blue)
                        }
                    }
                    Image(systemName: "chevron.right")
                        .font(.caption2)
                        .foregroundStyle(AMD.textQuat)
                }

                // MS progress mini-bars
                let visibleItems = card.msItems.filter { $0.cumulativePct > 0 || $0.monthlyPct > 0 }
                if !visibleItems.isEmpty {
                    VStack(spacing: 5) {
                        ForEach(visibleItems.prefix(4)) { item in
                            msMiniRow(item)
                        }
                    }
                }

                // Report status badge
                if let repStatus = card.reportStatus {
                    reportBadge(repStatus)
                }
            }
            .padding(14)
            .background(AMD.card)
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
    }

    private func msMiniRow(_ item: MonthMsItem) -> some View {
        HStack(spacing: 8) {
            Text(item.title)
                .font(.system(size: 11))
                .foregroundStyle(AMD.textSub)
                .lineLimit(1)
                .frame(maxWidth: 110, alignment: .leading)
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(AMD.bgDeep)
                        .frame(height: 5)
                    // Cumulative (prior months)
                    let priorW = geo.size.width * CGFloat(max(0, item.cumulativePct - item.monthlyPct) / 100)
                    RoundedRectangle(cornerRadius: 2)
                        .fill(AMD.blue.opacity(0.35))
                        .frame(width: priorW, height: 5)
                    // This month addition
                    let totalW = geo.size.width * CGFloat(min(item.cumulativePct, 100) / 100)
                    RoundedRectangle(cornerRadius: 2)
                        .fill(AMD.blue)
                        .frame(width: totalW, height: 5)
                }
            }
            .frame(height: 5)
            Text("\(Int(item.cumulativePct))%")
                .font(.system(size: 11))
                .monospacedDigit()
                .foregroundStyle(AMD.textSub)
                .frame(width: 30, alignment: .trailing)
        }
    }

    private func reportBadge(_ status: String) -> some View {
        let (label, icon, color): (String, String, Color) = {
            switch status {
            case "draft":    return ("下書き", "doc.text", .orange)
            case "approved": return ("承認済", "checkmark.circle.fill", .green)
            case "submitted": return ("提出済", "paperplane.fill", AMD.blue)
            default:          return (status, "doc", .secondary)
            }
        }()
        return HStack(spacing: 4) {
            Image(systemName: icon).font(.system(size: 10))
            Text(label).font(.system(size: 11, weight: .medium))
        }
        .padding(.horizontal, 7)
        .padding(.vertical, 3)
        .background(color.opacity(0.1))
        .foregroundStyle(color)
        .clipShape(RoundedRectangle(cornerRadius: 5))
    }
}
