import SwiftUI

struct RoutineFlowView: View {
    let project: GASProject
    let initialTarget: RoutineNavigationTarget?

    @State private var flows: [RoutineFlow] = []
    @State private var visibleStepsByYm: [String: [RoutineStep]] = [:]
    @State private var ctbEstimateDraftMap: [String: Bool] = [:]
    @State private var reimbursementDoneMap: [String: Bool] = [:]
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var hasStartedInitialLoad = false

    init(project: GASProject, initialTarget: RoutineNavigationTarget? = nil) {
        self.project = project
        self.initialTarget = initialTarget
    }

    var body: some View {
        ZStack {
            AMD.bgPage.ignoresSafeArea()
            Group {
                if isLoading && flows.isEmpty {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let error = errorMessage {
                    errorView(error)
                } else if flows.isEmpty {
                    ContentUnavailableView(
                        "データなし",
                        systemImage: "hexagon",
                        description: Text("ルーティンデータがありません")
                    )
                } else {
                    flowContent
                }
            }
        }
        .navigationTitle(project.projectName)
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            guard !hasStartedInitialLoad else { return }
            hasStartedInitialLoad = true
            Task { await loadFlow() }
        }
        .refreshable { await loadFlow() }
    }

    private var flowContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                VStack(alignment: .leading, spacing: 4) {
                    if !project.clientName.isEmpty {
                        Text(project.clientName)
                            .font(.system(size: 11, weight: .bold))
                            .tracking(1.4)
                            .textCase(.uppercase)
                            .foregroundStyle(AMD.textTertiary)
                    }
                    Text(project.projectName)
                        .font(.system(size: 28, weight: .bold))
                        .tracking(-0.6)
                        .lineSpacing(0)
                        .foregroundStyle(AMD.text)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 20)
                .padding(.top, 16)
                .padding(.bottom, 14)

                if let mainFlow = flows.first(where: { $0.role == "main" }) {
                    HeroBannerView(flow: mainFlow)
                        .padding(.horizontal, 16)
                        .padding(.bottom, 24)
                }

                ForEach(flows) { flow in
                    StepSectionView(
                        flow: flow,
                        steps: visibleStepsByYm[flow.bizYm] ?? [],
                        projectId: project.projectId,
                        initialTarget: initialTarget,
                        onRefresh: { Task { await loadFlow() } }
                    )
                }
            }
            .padding(.bottom, 40)
        }
    }

    private func errorView(_ message: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.largeTitle)
                .foregroundColor(.orange)
            Text(message)
                .multilineTextAlignment(.center)
            Button("再試行") { Task { await loadFlow() } }
                .buttonStyle(.bordered)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func loadFlow() async {
        isLoading = true
        errorMessage = nil
        do {
            Task {
                await SupabaseService.shared.autoCompleteLegacyCycles(projectId: project.projectId)
            }

            let body = try await SupabaseService.shared.fetchRoutineFlow(projectId: project.projectId)
            if body.ok {
                let preparedFlows = body.flows.map { $0.bizYm <= "202512" ? forceAllStepsDone(in: $0) : $0 }
                let candidateFlows = project.isCTB
                    ? preparedFlows.filter { $0.bizYm > "202512" }
                    : preparedFlows
                let initialVisibleSteps = buildVisibleStepsMap(
                    flows: candidateFlows,
                    ctbEstimateDraftMap: [:],
                    reimbursementDoneMap: [:]
                )
                let visibleFlows = candidateFlows.filter { flow in
                    let steps = initialVisibleSteps[flow.bizYm] ?? []
                    return !steps.isEmpty && steps.contains { !$0.isDone }
                }

                flows = visibleFlows
                ctbEstimateDraftMap = [:]
                reimbursementDoneMap = [:]
                visibleStepsByYm = buildVisibleStepsMap(
                    flows: visibleFlows,
                    ctbEstimateDraftMap: [:],
                    reimbursementDoneMap: [:]
                )

                let visibleYms = visibleFlows.map(\.bizYm)
                Task {
                    var nextEstimateMap: [String: Bool] = [:]
                    if project.isCTB {
                        nextEstimateMap = (try? await SupabaseService.shared.fetchCTBEstimateDraftMap(
                            projectId: project.projectId,
                            yms: visibleYms
                        )) ?? [:]
                    }
                    let nextReimburseMap = (try? await SupabaseService.shared.fetchReimbursementCompletionMap(
                        projectId: project.projectId,
                        yms: visibleYms
                    )) ?? [:]
                    await MainActor.run {
                        let refreshedStepMap = buildVisibleStepsMap(
                            flows: visibleFlows,
                            ctbEstimateDraftMap: nextEstimateMap,
                            reimbursementDoneMap: nextReimburseMap
                        )
                        let filteredFlows = visibleFlows.filter { flow in
                            let steps = refreshedStepMap[flow.bizYm] ?? []
                            return !steps.isEmpty && steps.contains { !$0.isDone }
                        }
                        ctbEstimateDraftMap = nextEstimateMap
                        reimbursementDoneMap = nextReimburseMap
                        flows = filteredFlows
                        visibleStepsByYm = buildVisibleStepsMap(
                            flows: filteredFlows,
                            ctbEstimateDraftMap: nextEstimateMap,
                            reimbursementDoneMap: nextReimburseMap
                        )
                    }
                }
            } else {
                errorMessage = "データ取得に失敗しました"
            }
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func buildVisibleStepsMap(
        flows: [RoutineFlow],
        ctbEstimateDraftMap: [String: Bool],
        reimbursementDoneMap: [String: Bool]
    ) -> [String: [RoutineStep]] {
        Dictionary(uniqueKeysWithValues: flows.map { flow in
            (
                flow.bizYm,
                visibleRoutineSteps(
                    for: project.projectType,
                    in: flow,
                    ctbEstimateDraftMap: ctbEstimateDraftMap,
                    reimbursementDoneMap: reimbursementDoneMap
                )
            )
        })
    }
}

private struct AMDCapsule: View {
    enum Tone { case brand, tint, neutral, warn, overdue }

    let text: String
    let tone: Tone

    private var bg: Color {
        switch tone {
        case .brand:   return AMD.blue
        case .tint:    return AMD.blueTint
        case .neutral: return Color(r: 238, g: 241, b: 245)
        case .warn:    return Color(r: 255, g: 243, b: 219)
        case .overdue: return Color(r: 255, g: 240, b: 224)
        }
    }

    private var fg: Color {
        switch tone {
        case .brand:   return .white
        case .tint:    return AMD.blueDark
        case .neutral: return AMD.textSub
        case .warn:    return AMD.status("warn").ink
        case .overdue: return AMD.status("overdue").ink
        }
    }

    var body: some View {
        Text(text)
            .font(.system(size: 12, weight: .semibold))
            .tracking(0.2)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(bg)
            .foregroundStyle(fg)
            .clipShape(Capsule())
    }
}

private struct AMDStatusBadge: View {
    let status: String
    let index: Int
    var size: CGFloat = 32

    private var token: AMD.StatusToken { AMD.status(status) }

    var body: some View {
        ZStack {
            switch status {
            case "done":
                Circle().fill(token.bg)
                Image(systemName: "checkmark")
                    .font(.system(size: size * 0.42, weight: .bold))
                    .foregroundStyle(token.ink)

            case "current":
                Circle().fill(token.solid)
                    .shadow(color: AMD.blue.opacity(0.28), radius: 4, x: 0, y: 0)
                Text("\(index)")
                    .font(.system(size: size * 0.44, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(.white)

            case "warn", "overdue":
                Circle().fill(token.bg)
                Image(systemName: "exclamationmark")
                    .font(.system(size: size * 0.42, weight: .bold))
                    .foregroundStyle(token.ink)

            case "deferred":
                Circle().fill(token.bg)
                Image(systemName: "arrow.right")
                    .font(.system(size: size * 0.4, weight: .medium))
                    .foregroundStyle(token.ink)

            default:
                Circle().fill(AMD.bgPage)
                Circle()
                    .strokeBorder(AMD.textQuat, style: StrokeStyle(lineWidth: 1.5, dash: [4, 2]))
                Text("\(index)")
                    .font(.system(size: size * 0.44, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(token.ink)
            }
        }
        .frame(width: size, height: size)
    }
}

private struct HexShape: Shape {
    func path(in rect: CGRect) -> Path {
        let sx = rect.width / 24
        let sy = rect.height / 22
        var p = Path()
        p.move(to: CGPoint(x: 6.5 * sx, y: 1.5 * sy))
        p.addLine(to: CGPoint(x: 17.5 * sx, y: 1.5 * sy))
        p.addLine(to: CGPoint(x: 22.7 * sx, y: 10.5 * sy))
        p.addLine(to: CGPoint(x: 17.5 * sx, y: 19.5 * sy))
        p.addLine(to: CGPoint(x: 6.5 * sx, y: 19.5 * sy))
        p.addLine(to: CGPoint(x: 1.3 * sx, y: 10.5 * sy))
        p.closeSubpath()
        return p
    }
}

private struct HeroBannerView: View {
    let flow: RoutineFlow

    private var activeSteps: [RoutineStep] { flow.steps.filter { !$0.isDeferred } }
    private var doneCount: Int { activeSteps.filter(\.isDone).count }
    private var totalCount: Int { activeSteps.count }
    private var progressPct: Double { totalCount > 0 ? Double(doneCount) / Double(totalCount) : 0 }
    private var remainCount: Int { totalCount - doneCount }

    private var deadlineLabel: String? {
        guard let deadline = activeSteps.first(where: { !$0.isDone && $0.deadline != nil })?.deadline else {
            return nil
        }
        guard deadline.count >= 10 else { return nil }
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd"
        guard let date = fmt.date(from: String(deadline.prefix(10))) else { return nil }
        let days = Calendar.current.dateComponents([.day], from: .now, to: date).day ?? 0
        if days < 0 { return "期限超過 \(-days)日" }
        if days == 0 { return "今日が期限" }
        return "期限まで\(days)日"
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            RoundedRectangle(cornerRadius: 26)
                .fill(
                    LinearGradient(
                        colors: [AMD.blue, AMD.blueDark],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )

            HexShape()
                .stroke(.white.opacity(0.14), lineWidth: 22)
                .frame(width: 160, height: 147)
                .rotationEffect(.degrees(12))
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                .offset(x: 34, y: -24)
                .clipped()

            HexShape()
                .stroke(.white.opacity(0.09), lineWidth: 13)
                .frame(width: 95, height: 87)
                .rotationEffect(.degrees(-8))
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                .offset(x: -6, y: 54)
                .clipped()

            VStack(alignment: .leading, spacing: 0) {
                Text("月次ルーティン · \(flow.bizYm.ymDotFormatted)")
                    .font(.system(size: 11, weight: .bold))
                    .tracking(1.6)
                    .textCase(.uppercase)
                    .foregroundStyle(.white.opacity(0.75))

                HStack(alignment: .lastTextBaseline, spacing: 10) {
                    HStack(alignment: .lastTextBaseline, spacing: 1) {
                        Text("\(Int(progressPct * 100))")
                            .font(.system(size: 44, weight: .bold))
                            .monospacedDigit()
                        Text("%")
                            .font(.system(size: 22, weight: .semibold))
                            .opacity(0.85)
                    }
                    .foregroundStyle(.white)
                    .padding(.top, 8)

                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(doneCount)/\(totalCount) 完了")
                            .font(.system(size: 13, weight: .semibold))
                        Group {
                            if let label = deadlineLabel {
                                Text(label)
                            } else if remainCount > 0 {
                                Text("残 \(remainCount) ステップ")
                            }
                        }
                        .font(.system(size: 11))
                        .opacity(0.85)
                    }
                    .foregroundStyle(.white.opacity(0.82))
                    .padding(.top, 12)
                }

                if totalCount > 0 {
                    HStack(spacing: 3) {
                        ForEach(0..<totalCount, id: \.self) { i in
                            Capsule()
                                .fill(i < doneCount ? Color.white : Color.white.opacity(0.22))
                                .frame(height: 6)
                        }
                    }
                    .padding(.top, 12)
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 14)
            .padding(.bottom, 14)
        }
        .clipShape(RoundedRectangle(cornerRadius: 26))
        .shadow(color: AMD.blue.opacity(0.22), radius: 15, x: 0, y: 10)
    }
}

private struct StepSectionView: View {
    let flow: RoutineFlow
    let steps: [RoutineStep]
    let projectId: String
    let initialTarget: RoutineNavigationTarget?
    let onRefresh: () -> Void

    @State private var showInvoiceYmPicker = false
    private var activeSteps: [RoutineStep] { steps.filter { !$0.isDeferred } }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            sectionHeader
                .padding(.horizontal, 20)
                .padding(.top, 20)
                .padding(.bottom, 10)
                .sheet(isPresented: $showInvoiceYmPicker, onDismiss: onRefresh) {
                    InvoiceYmPickerSheet(
                        projectId: projectId,
                        bizYm: flow.bizYm,
                        currentInvoiceYm: flow.invoiceYm ?? flow.bizYm
                    )
                }

            VStack(spacing: 0) {
                ForEach(Array(activeSteps.enumerated()), id: \.element.id) { index, step in
                    StepRowView(
                        step: step,
                        stepNumber: index + 1,
                        isFirst: index == 0,
                        isLast: index == activeSteps.count - 1,
                        projectId: projectId,
                        bizYm: flow.bizYm,
                        autoOpen: flow.bizYm == initialTarget?.bizYm && initialTarget?.stepId == step.stepId,
                        onRefresh: onRefresh
                    )
                }
            }
            .background(Color(.systemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 26))
            .overlay {
                RoundedRectangle(cornerRadius: 26)
                    .strokeBorder(AMD.divider, lineWidth: 0.5)
            }
            .shadow(color: .black.opacity(0.04), radius: 1, x: 0, y: 1)
            .shadow(color: .black.opacity(0.06), radius: 12, x: 0, y: 8)
            .padding(.horizontal, 16)
            .padding(.bottom, 24)
        }
    }

    @ViewBuilder
    private var sectionHeader: some View {
        HStack(spacing: 8) {
            Text("\(flow.bizYm.ymDotFormatted)稼働分")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(AMD.text)
            Spacer()
            Button {
                showInvoiceYmPicker = true
            } label: {
                HStack(spacing: 3) {
                    Image(systemName: "arrow.triangle.2.circlepath")
                        .font(.system(size: 10, weight: .medium))
                    Text("請求月")
                        .font(.system(size: 11, weight: .medium))
                }
                .foregroundStyle(AMD.textTertiary)
            }
        }
    }
}

private enum StepSheet: Identifiable {
    case budget(String)
    case meeting
    case reportFix
    case invoiceIssue(String, BillingDocumentType)

    var id: String {
        switch self {
        case .budget(let ym): return "budget_\(ym)"
        case .meeting: return "meeting"
        case .reportFix: return "reportFix"
        case .invoiceIssue(let ym, let documentType): return "invoiceIssue_\(documentType.rawValue)_\(ym)"
        }
    }
}

private struct StepRowView: View {
    let step: RoutineStep
    let stepNumber: Int
    let isFirst: Bool
    let isLast: Bool
    let projectId: String
    let bizYm: String
    let autoOpen: Bool
    let onRefresh: () -> Void

    @EnvironmentObject private var authService: AuthService
    @EnvironmentObject private var navigation: AppNavigationState
    @State private var activeSheet: StepSheet?
    @State private var showInvoiceSendConfirm = false
    @State private var showPaymentConfirm = false
    @State private var showPayoutConfirm = false
    @State private var actionError: String?
    @State private var didAutoOpen = false

    var body: some View {
        Group {
            if step.isTappable {
                rowContent
                    .contentShape(Rectangle())
                    .onTapGesture(perform: handleTap)
            } else {
                rowContent
            }
        }
        .sheet(item: $activeSheet, onDismiss: onRefresh) { sheet in
            switch sheet {
            case .budget(let targetYm):
                BudgetStepView(projectId: projectId, bizYm: targetYm)
            case .meeting:
                MeetingStepView(step: step, projectId: projectId, bizYm: bizYm)
            case .reportFix:
                ReportFixStepView(step: step, projectId: projectId, bizYm: bizYm)
            case .invoiceIssue(let targetYm, let documentType):
                InvoiceStepView(step: step, projectId: projectId, bizYm: targetYm, documentType: documentType)
            }
        }
        .confirmationDialog("請求書、送付した？", isPresented: $showInvoiceSendConfirm, titleVisibility: .visible) {
            Button("送付した") { Task { await markInvoiceSent() } }
            Button("キャンセル", role: .cancel) {}
        } message: {
            Text("送付済みとしてチェックが入ります")
        }
        .confirmationDialog("入金確認した？", isPresented: $showPaymentConfirm, titleVisibility: .visible) {
            Button("確認した") { Task { await confirmPayment() } }
            Button("キャンセル", role: .cancel) {}
        } message: {
            Text("入金済みとしてチェックが入ります")
        }
        .confirmationDialog("報酬支払い、完了した？", isPresented: $showPayoutConfirm, titleVisibility: .visible) {
            Button("完了した") { Task { await markPayoutPaid() } }
            Button("キャンセル", role: .cancel) {}
        } message: {
            Text("報酬支払済みとしてチェックが入ります")
        }
        .alert("エラー", isPresented: .constant(actionError != nil)) {
            Button("OK") { actionError = nil }
        } message: {
            Text(actionError ?? "")
        }
        .onAppear {
            guard autoOpen, !didAutoOpen, step.isTappable else { return }
            didAutoOpen = true
            DispatchQueue.main.async {
                handleTap()
            }
        }
    }

    private var badgeStatus: String {
        if step.isDeferred { return "deferred" }
        if step.isDone { return "done" }
        switch step.status {
        case "current", "warn", "overdue":
            return step.status
        default:
            return "upcoming"
        }
    }

    private var connectorColor: Color {
        step.isDone ? AMD.blue.opacity(0.32) : Color(.systemGray5)
    }

    private var rowContent: some View {
        HStack(alignment: .top, spacing: 0) {
            VStack(spacing: 0) {
                Rectangle()
                    .fill(isFirst ? Color.clear : connectorColor)
                    .frame(width: 2, height: 14)

                AMDStatusBadge(status: badgeStatus, index: stepNumber)

                if isLast {
                    Spacer().frame(height: 14)
                } else {
                    Rectangle()
                        .fill(connectorColor)
                        .frame(width: 2)
                        .frame(maxHeight: .infinity)
                }
            }
            .frame(width: 44)
            .padding(.leading, 8)

            HStack(alignment: .center, spacing: 10) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(step.label)
                        .font(.system(size: 16, weight: step.status == "current" ? .semibold : .medium))
                        .tracking(-0.2)
                        .foregroundStyle(step.isDeferred ? AMD.textSub : AMD.text)
                        .fixedSize(horizontal: false, vertical: true)

                    if let subtitle = stepSubtitle {
                        HStack(spacing: 6) {
                            if step.status == "current" && !step.isDone {
                                Circle()
                                    .fill(AMD.blue)
                                    .frame(width: 6, height: 6)
                            }
                            Text(subtitle)
                                .font(.system(size: 12.5, weight: .medium))
                                .tracking(-0.1)
                                .foregroundStyle(subtitleColor)
                                .monospacedDigit()
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .opacity(step.isDeferred ? 0.72 : 1.0)

                if step.isTappable && !step.isDeferred {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(AMD.textQuat)
                }
            }
            .padding(.top, 14)
            .padding(.bottom, 14)
            .padding(.trailing, 16)
            .overlay(alignment: .bottom) {
                if !isLast {
                    Rectangle()
                        .fill(AMD.divider)
                        .frame(height: 0.5)
                }
            }
        }
    }

    private var stepSubtitle: String? {
        if step.isDeferred { return nil }
        if step.isDone {
            if let val = step.doneAt?.value as? String, val == "skipped" {
                if let dl = step.deadline, !dl.isEmpty {
                    return "スキップ · 期限 \(formatDeadline(dl))"
                }
                return "スキップ"
            }
            if let ds = step.doneAt?.displayString {
                if let dl = step.deadline, !dl.isEmpty {
                    return "完了 · \(ds) · 期限 \(formatDeadline(dl))"
                }
                return "完了 · \(ds)"
            }
            if let dl = step.deadline, !dl.isEmpty {
                return "完了 · 期限 \(formatDeadline(dl))"
            }
            return "完了"
        }
        if step.status == "current" {
            if let dl = step.deadline, !dl.isEmpty {
                return "進行中 · 期限 \(formatDeadline(dl))"
            }
            return "進行中"
        }
        if let dl = step.deadline, !dl.isEmpty {
            if step.status == "overdue" { return "期限超過 · \(formatDeadline(dl))" }
            if step.status == "warn" { return "要確認 · \(formatDeadline(dl))" }
            return "予定 · \(formatDeadline(dl))"
        }
        return nil
    }

    private var subtitleColor: Color {
        switch step.status {
        case "done":
            return AMD.status("done").ink
        case "current":
            return AMD.blue
        case "warn":
            return AMD.status("warn").ink
        case "overdue":
            return AMD.status("overdue").ink
        default:
            return AMD.textTertiary
        }
    }

    private func formatDeadline(_ s: String) -> String {
        let parts = s.prefix(10).split(separator: "-")
        if parts.count == 3, let m = Int(parts[1]), let d = Int(parts[2]) {
            return "\(m)/\(d)"
        }
        return s
    }

    private func handleTap() {
        switch step.stepId {
        case "budget":
            activeSheet = .budget(bizYm)
        case "estimateSend":
            activeSheet = .invoiceIssue(step.action ?? bizYm, .quotation)
        case "meeting":
            if step.isDone, let href = step.href, !href.isEmpty, let url = URL(string: href) {
                UIApplication.shared.open(url)
            } else {
                activeSheet = .meeting
            }
        case "reportFix":
            activeSheet = .reportFix
        case "reimburseConfirm":
            navigation.registrationPath = [.reimburse]
            navigation.selectedTab = .registration
        case "invoiceIssue":
            activeSheet = .invoiceIssue(bizYm, .invoice)
        case "invoiceSend":
            showInvoiceSendConfirm = true
        case "payoutNotice":
            // 支払通知書はメンバー単位の運用に変わったため、Admin fullScreenCover を直接開く
            // （admin 判定は MainTabView の isAdmin ゲート任せ、既存権限仕様のまま）
            navigation.requestAdminPresentation = true
        case "payment":
            showPaymentConfirm = true
        case "payout":
            showPayoutConfirm = true
        default:
            if let href = step.href, !href.isEmpty, let url = URL(string: href) {
                UIApplication.shared.open(url)
            } else if let url = makeCockpitURL(projectId: projectId) {
                UIApplication.shared.open(url)
            }
        }
    }

    private func markInvoiceSent() async {
        do {
            try await SupabaseService.shared.markInvoiceSent(projectId: projectId, ym: bizYm)
            onRefresh()
        } catch {
            actionError = error.localizedDescription
        }
    }

    private func confirmPayment() async {
        let email = authService.userEmail ?? ""
        do {
            try await SupabaseService.shared.confirmPayment(projectId: projectId, ym: bizYm, byEmail: email)
            onRefresh()
        } catch {
            actionError = error.localizedDescription
        }
    }

    private func markPayoutPaid() async {
        let email = authService.userEmail ?? ""
        do {
            try await SupabaseService.shared.markPayoutPaid(projectId: projectId, ym: bizYm, byEmail: email)
            onRefresh()
        } catch {
            actionError = error.localizedDescription
        }
    }
}

private extension String {
    var ymDotFormatted: String {
        guard count == 6 else { return self }
        return "\(prefix(4)).\(suffix(2))"
    }
}

private struct InvoiceYmPickerSheet: View {
    let projectId: String
    let bizYm: String
    let currentInvoiceYm: String

    @Environment(\.dismiss) private var dismiss
    @State private var selectedYm: String
    @State private var isSaving = false
    @State private var errorMessage: String?

    init(projectId: String, bizYm: String, currentInvoiceYm: String) {
        self.projectId = projectId
        self.bizYm = bizYm
        self.currentInvoiceYm = currentInvoiceYm
        _selectedYm = State(initialValue: currentInvoiceYm)
    }

    private var options: [(ym: String, label: String)] {
        guard bizYm.count == 6,
              let y = Int(bizYm.prefix(4)),
              let m = Int(bizYm.suffix(2)) else { return [] }
        return (0...6).map { delta in
            var ny = y
            var nm = m + delta
            while nm > 12 {
                nm -= 12
                ny += 1
            }
            let ym = String(format: "%04d%02d", ny, nm)
            let label = delta == 0 ? "\(ny)年\(nm)月（通常）" : "\(ny)年\(nm)月にまとめて請求"
            return (ym, label)
        }
    }

    var body: some View {
        NavigationStack {
            List {
                Section("請求月を選択") {
                    ForEach(options, id: \.ym) { opt in
                        Button {
                            selectedYm = opt.ym
                        } label: {
                            HStack {
                                Text(opt.label)
                                    .foregroundStyle(.primary)
                                Spacer()
                                if selectedYm == opt.ym {
                                    Image(systemName: "checkmark")
                                        .foregroundStyle(AMD.blue)
                                        .fontWeight(.semibold)
                                }
                            }
                        }
                    }
                }
                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .foregroundStyle(.red)
                            .font(.caption)
                    }
                }
            }
            .navigationTitle("\(bizYm.ymDotFormatted) 請求月変更")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("キャンセル") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("保存") { Task { await save() } }
                        .disabled(isSaving)
                }
            }
        }
    }

    private func save() async {
        isSaving = true
        do {
            try await SupabaseService.shared.updateInvoiceYm(
                projectId: projectId,
                ym: bizYm,
                invoiceYm: selectedYm
            )
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
            isSaving = false
        }
    }
}

private func makeCockpitURL(projectId: String) -> URL? {
    let base = "https://script.google.com/macros/s/AKfycbx4IgBEjrP8Ov-e5PhGi_3Z5-WOoEKCyNV-7S6s4iksto0qwD3c_fKiwJ-l4xn0zgir/exec"
    var comps = URLComponents(string: base)
    comps?.queryItems = [
        URLQueryItem(name: "page", value: "cockpit"),
        URLQueryItem(name: "projectId", value: projectId)
    ]
    return comps?.url
}
