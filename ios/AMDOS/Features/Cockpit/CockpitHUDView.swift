import SwiftUI

// MARK: - HUD Control Center
//
// 設定 → 「HUD版コックピット」から fullScreenCover で開く没入型ダッシュボード。
// PWA /hud/dashboard (HudControlCenterDashboard) と同じコンテンツ構成・文言を、
// Supabase 直読みの実データで描画する（API 不要・会場ネット非依存）。
//
// パネル: AMD Management Score / System Status / Project Signal Board / Next Action Queue
// ※ Signal Board の M/X/F は AMD Score 計算エンジン依存のため、当面は月次ルーティン進捗で代替表示。

// MARK: Palette (PWA hud_visual_language.md 準拠)

private enum HUD {
    static let bg0   = Color(r: 2,   g: 8,   b: 18)    // void
    static let bg1   = Color(r: 6,   g: 24,  b: 39)    // deep navy
    static let cyan  = Color(r: 50,  g: 231, b: 255)   // #32e7ff cyan line
    static let cyanGlow = Color(r: 124, g: 248, b: 255)
    static let blue  = Color(r: 42,  g: 157, b: 255)   // #2a9dff data blue (X)
    static let mint  = Color(r: 64,  g: 255, b: 196)
    static let amber = Color(r: 255, g: 209, b: 90)    // #ffd15a
    static let coral = Color(r: 255, g: 95,  b: 126)   // #ff5f7e (F / warning)
    static let line  = Color(r: 50,  g: 231, b: 255).opacity(0.22)
    static let ink   = Color(r: 231, g: 251, b: 255)   // #e7fbff pale text
    static let inkSub = Color(r: 143, g: 185, b: 198)  // #8fb9c6 muted
}

// MARK: Snapshot models

private struct MgmtSnapshot {
    let ym: String
    let total: Double
    let initiative: Double
    let finance: Double
    let retention: Double
    let pipeline: Double
    let direction: Double
    let confidence: Double
}

private struct SignalProject: Identifiable {
    let id: String
    let code: String
    let name: String
    let status: String
    let routineDone: Int   // 0...4 (meeting/report/invoice/payment)
    let routineTotal: Int
    var progress: Double { routineTotal > 0 ? Double(routineDone) / Double(routineTotal) : 0 }
    var statusColor: Color {
        switch status.lowercased() {
        case "active": return HUD.cyan
        case "sales": return HUD.amber
        case "frozen": return HUD.coral
        case "ended": return HUD.inkSub
        default: return HUD.blue
        }
    }
}

private struct ActionItem: Identifiable {
    let id = UUID()
    let title: String
    let meta: String
    let periodLabel: String
    let tone: Color
}

private struct HudSnapshot {
    let management: MgmtSnapshot?
    let history: [Double]       // total_score 時系列
    let projects: [SignalProject]
    let billingCount: Int
    let actions: [ActionItem]
}

// MARK: - ViewModel

@MainActor
private final class HudViewModel: ObservableObject {
    enum Phase { case loading, error(String), ready(HudSnapshot) }
    @Published var phase: Phase = .loading

    func load() async {
        phase = .loading
        do {
            let ym = currentYm()
            async let projectsT = SupabaseService.shared.fetchActiveProjects()
            async let snapsT = SupabaseService.shared.fetchHudManagementSnapshots()
            async let billingT = SupabaseService.shared.fetchHudBillingCycles(ym: ym)
            async let reportsT = SupabaseService.shared.fetchHudMonthlyReports(ym: ym)

            let projects = try await projectsT
            let snaps = try await snapsT
            let billing = try await billingT
            let reports = try await reportsT

            phase = .ready(Self.build(projects: projects, snaps: snaps, billing: billing, reports: reports, ym: ym))
        } catch {
            phase = .error(error.localizedDescription)
        }
    }

    private static func build(
        projects: [SupabaseProject],
        snaps: [HudMgmtSnapshotRow],
        billing: [HudBillingRow],
        reports: [HudReportRow],
        ym: String
    ) -> HudSnapshot {
        // management: dedupe by ym keeping last (= 最新 updated)
        var byYm: [String: MgmtSnapshot] = [:]
        var order: [String] = []
        for r in snaps {
            guard let y = r.ym else { continue }
            if byYm[y] == nil { order.append(y) }
            byYm[y] = MgmtSnapshot(
                ym: y,
                total: r.total_score ?? 0,
                initiative: r.initiative_score ?? 0,
                finance: r.finance_score ?? 0,
                retention: r.retention_score ?? 0,
                pipeline: r.pipeline_score ?? 0,
                direction: r.direction_score ?? 0,
                confidence: r.confidence ?? 0
            )
        }
        let ordered = order.sorted().compactMap { byYm[$0] }
        let management = ordered.last
        let history = ordered.map(\.total)

        // billing done flags
        let reportDoneIds = Set(
            reports.filter { ($0.fixed_at != nil) || (($0.status ?? "").lowercased() == "fixed") }
                .compactMap { $0.project_id }
        )
        var billingByPj: [String: HudBillingRow] = [:]
        for b in billing { billingByPj[b.project_id] = b }

        func doneCount(_ b: HudBillingRow?) -> Int {
            guard let b else { return 0 }
            var n = 0
            if b.meeting_start_at != nil { n += 1 }
            if b.report_fixed_at != nil || reportDoneIds.contains(b.project_id) { n += 1 }
            if b.invoice_sent_at != nil { n += 1 }
            if b.payment_confirmed_at != nil { n += 1 }
            return n
        }

        // signal board projects
        let signalProjects: [SignalProject] = projects.map { p in
            let b = billingByPj[p.projectId]
            return SignalProject(
                id: p.projectId,
                code: p.projectId.uppercased(),
                name: p.projectName,
                status: p.status,
                routineDone: doneCount(b),
                routineTotal: 4
            )
        }.sorted { $0.progress > $1.progress }

        // next action queue (PWA buildMonthlyRoutineActions 相当)
        var actions: [ActionItem] = []
        for b in billing {
            let meta = "\(b.project_id.uppercased()) / PENDING"
            let period = monthLabel(b.ym ?? ym)
            let reportDone = b.report_fixed_at != nil || reportDoneIds.contains(b.project_id)
            if b.meeting_start_at == nil {
                actions.append(ActionItem(title: "報告会日程調整", meta: meta, periodLabel: period, tone: HUD.cyan))
            }
            if !reportDone {
                actions.append(ActionItem(title: "月次報告書FIX", meta: meta, periodLabel: period, tone: HUD.amber))
            }
            if b.invoice_sent_at == nil {
                actions.append(ActionItem(title: "請求書送付", meta: meta, periodLabel: period, tone: HUD.amber))
            }
            if b.payment_confirmed_at == nil && b.invoice_sent_at != nil {
                actions.append(ActionItem(title: "入金確認", meta: meta, periodLabel: period, tone: HUD.coral))
            }
        }

        return HudSnapshot(
            management: management,
            history: history,
            projects: signalProjects,
            billingCount: billing.count,
            actions: Array(actions.prefix(6))
        )
    }
}

private func monthLabel(_ ym: String) -> String {
    guard ym.count >= 6 else { return ym }
    return "\(ym.prefix(4)).\(ym.dropFirst(4).prefix(2))"
}

// MARK: - Root

struct CockpitHUDView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var vm = HudViewModel()

    var body: some View {
        TimelineView(.animation) { timeline in
            let t = timeline.date.timeIntervalSinceReferenceDate
            GeometryReader { geo in
                ZStack {
                    background(t: t, size: geo.size)
                    scanline(t: t, size: geo.size)
                    content(t: t)
                    cornerBrackets(size: geo.size)
                    closeButton
                }
                .frame(width: geo.size.width, height: geo.size.height)
            }
            .ignoresSafeArea()
        }
        .preferredColorScheme(.dark)
        .statusBarHidden(true)
        .task { await vm.load() }
    }

    @ViewBuilder
    private func content(t: Double) -> some View {
        switch vm.phase {
        case .loading:
            statusScreen(t: t, title: "ESTABLISHING UPLINK", subtitle: "SYNCING CONTROL CENTER", tint: HUD.cyan, spin: true)
        case .error(let msg):
            VStack(spacing: 16) {
                statusScreen(t: t, title: "DATA LINK FAILED", subtitle: msg, tint: HUD.coral, spin: false)
                Button { Task { await vm.load() } } label: {
                    Text("RETRY")
                        .font(.system(size: 12, weight: .bold, design: .monospaced)).tracking(2)
                        .foregroundStyle(HUD.bg0)
                        .padding(.horizontal, 22).padding(.vertical, 9)
                        .background(HUD.cyan).clipShape(Capsule())
                }
            }
        case .ready(let snap):
            dashboard(snap: snap, t: t)
        }
    }

    private func dashboard(snap: HudSnapshot, t: Double) -> some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 16) {
                header(t: t)
                managementPanel(snap: snap, t: t)
                systemStatusPanel(snap: snap)
                signalBoardPanel(snap: snap, t: t)
                if !snap.actions.isEmpty { actionQueuePanel(snap: snap) }
                footer()
                Color.clear.frame(height: 20)
            }
            .padding(.horizontal, 16)
            .padding(.top, 60)
            .padding(.bottom, 10)
        }
    }

    // MARK: Header

    private func header(t: Double) -> some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 8) {
                    Circle().fill(HUD.mint).frame(width: 8, height: 8)
                        .shadow(color: HUD.mint, radius: 4 + 2 * sin(t * 3))
                    Text("AMD OS // CONTROL CENTER")
                        .font(.system(size: 13, weight: .bold, design: .monospaced)).tracking(2)
                        .foregroundStyle(HUD.ink)
                }
                Text("STUDIO HUD · LIVE FEED")
                    .font(.system(size: 9, weight: .semibold, design: .monospaced)).tracking(1.5)
                    .foregroundStyle(HUD.inkSub)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(clock())
                    .font(.system(size: 17, weight: .bold, design: .monospaced))
                    .foregroundStyle(HUD.cyan).shadow(color: HUD.cyan.opacity(0.7), radius: 6)
                Text("JST · SECURE").font(.system(size: 9, weight: .semibold, design: .monospaced))
                    .tracking(1.5).foregroundStyle(HUD.inkSub)
            }
        }
    }

    // MARK: AMD Management Score

    private func managementPanel(snap: HudSnapshot, t: Double) -> some View {
        let m = snap.management
        let total = m?.total ?? 0
        return panel {
            VStack(spacing: 12) {
                panelTitle("AMD Management Score", trailing: "LIVE SCORE / AMD OS")
                ZStack {
                    tickRing().rotationEffect(.degrees(t * 7))
                    Circle().stroke(HUD.cyan.opacity(0.12), lineWidth: 11).padding(24)
                    Circle()
                        .trim(from: 0, to: max(0.001, total / 100))
                        .stroke(AngularGradient(colors: gaugeColors(total), center: .center),
                                style: StrokeStyle(lineWidth: 11, lineCap: .round))
                        .rotationEffect(.degrees(-90)).padding(24)
                        .shadow(color: statusColor(total).opacity(0.8), radius: 8)
                    VStack(spacing: 1) {
                        Text(String(format: "%.0f", total))
                            .font(.system(size: 44, weight: .heavy, design: .monospaced))
                            .foregroundStyle(HUD.ink).shadow(color: statusColor(total).opacity(0.6), radius: 6)
                        Text(statusLabel(total))
                            .font(.system(size: 11, weight: .black, design: .monospaced)).tracking(2)
                            .foregroundStyle(statusColor(total))
                        if let m {
                            Text("DIR \(Int(m.direction)) / \(ymShort(m.ym))")
                                .font(.system(size: 8, weight: .bold, design: .monospaced)).tracking(1)
                                .foregroundStyle(HUD.inkSub)
                        }
                    }
                }
                .frame(width: 180, height: 180)

                if snap.history.count >= 2 {
                    historyLine(snap.history).frame(height: 26)
                }

                if let m {
                    HStack(spacing: 6) {
                        subRing("先手力", m.initiative, HUD.cyan)
                        subRing("財務", m.finance, HUD.blue)
                        subRing("継続", m.retention, HUD.mint)
                        subRing("新規", m.pipeline, HUD.amber)
                        subRing("方向", m.direction, HUD.coral)
                    }
                    if m.confidence > 0 && m.confidence <= 0.6 {
                        Text("LOW CONF \(String(format: "%.0f", m.confidence * 100))%")
                            .font(.system(size: 8, weight: .bold, design: .monospaced)).tracking(1.5)
                            .foregroundStyle(HUD.amber)
                            .padding(.horizontal, 7).padding(.vertical, 2)
                            .overlay(Capsule().stroke(HUD.amber.opacity(0.5), lineWidth: 1))
                    }
                }
            }
            .frame(maxWidth: .infinity)
        }
    }

    private func gaugeColors(_ v: Double) -> [Color] {
        if v >= 75 { return [HUD.blue, HUD.cyan, HUD.mint] }
        if v >= 55 { return [HUD.blue, HUD.cyan, HUD.cyanGlow] }
        return [HUD.coral.opacity(0.7), HUD.amber, HUD.coral]
    }
    private func statusColor(_ v: Double) -> Color { v >= 75 ? HUD.mint : (v >= 55 ? HUD.cyan : HUD.coral) }
    private func statusLabel(_ v: Double) -> String { v >= 75 ? "GOOD" : (v >= 55 ? "WATCH" : "ALERT") }

    private func subRing(_ label: String, _ value: Double, _ tint: Color) -> some View {
        VStack(spacing: 4) {
            ZStack {
                Circle().stroke(tint.opacity(0.14), lineWidth: 4).frame(width: 44, height: 44)
                Circle().trim(from: 0, to: max(0.001, value / 100))
                    .stroke(tint, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                    .rotationEffect(.degrees(-90)).frame(width: 44, height: 44)
                    .shadow(color: tint.opacity(0.6), radius: 4)
                Text(String(format: "%.0f", value))
                    .font(.system(size: 13, weight: .heavy, design: .monospaced))
                    .foregroundStyle(HUD.ink)
            }
            Text(label)
                .font(.system(size: 9, weight: .bold, design: .monospaced))
                .foregroundStyle(HUD.inkSub)
        }
        .frame(maxWidth: .infinity)
    }

    private func historyLine(_ values: [Double]) -> some View {
        Canvas { ctx, sz in
            guard values.count >= 2 else { return }
            let maxV = max(values.max() ?? 100, 1)
            let minV = min(values.min() ?? 0, maxV)
            let span = max(maxV - minV, 1)
            var path = Path()
            for (i, v) in values.enumerated() {
                let x = sz.width * CGFloat(i) / CGFloat(values.count - 1)
                let y = sz.height * (1 - CGFloat((v - minV) / span)) * 0.9 + sz.height * 0.05
                if i == 0 { path.move(to: .init(x: x, y: y)) } else { path.addLine(to: .init(x: x, y: y)) }
            }
            ctx.stroke(path, with: .color(HUD.cyan.opacity(0.85)), lineWidth: 1.5)
            if let lastV = values.last {
                let x = sz.width
                let y = sz.height * (1 - CGFloat((lastV - minV) / span)) * 0.9 + sz.height * 0.05
                ctx.fill(Path(ellipseIn: CGRect(x: x - 3, y: y - 3, width: 6, height: 6)), with: .color(HUD.cyanGlow))
            }
        }
    }

    // MARK: System Status

    private func systemStatusPanel(snap: HudSnapshot) -> some View {
        panel(padding: 14) {
            VStack(alignment: .leading, spacing: 10) {
                panelTitle("System Status", trailing: "SYNC")
                statusRow("Data Pipeline", snap.projects.isEmpty ? "WAIT" : "OK", snap.projects.isEmpty ? HUD.amber : HUD.mint, dots: snap.projects.isEmpty ? 7 : 18)
                statusRow("Integration", "\(snap.billingCount) BC", HUD.cyan, dots: min(snap.billingCount, 18))
                statusRow("Security", "OK", HUD.mint, dots: 18)
                statusRow("Backup", "OK", HUD.mint, dots: 16)
            }
        }
    }

    private func statusRow(_ label: String, _ value: String, _ tint: Color, dots: Int) -> some View {
        HStack(spacing: 10) {
            Text(label)
                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                .foregroundStyle(HUD.inkSub).frame(width: 96, alignment: .leading)
            HStack(spacing: 2) {
                ForEach(0..<18, id: \.self) { i in
                    RoundedRectangle(cornerRadius: 1)
                        .fill(i < dots ? tint.opacity(0.9) : HUD.cyan.opacity(0.10))
                        .frame(width: 4, height: 7)
                }
            }
            Spacer(minLength: 4)
            Text(value)
                .font(.system(size: 11, weight: .bold, design: .monospaced))
                .foregroundStyle(tint)
        }
    }

    // MARK: Project Signal Board

    private func signalBoardPanel(snap: HudSnapshot, t: Double) -> some View {
        panel {
            VStack(alignment: .leading, spacing: 12) {
                panelTitle("Project Signal Board", trailing: "XFM_CORE")
                Text("M : Macrotrend   X : XRL   F : FRL")
                    .font(.system(size: 8, weight: .bold, design: .monospaced)).tracking(1)
                    .foregroundStyle(HUD.inkSub)
                ForEach(Array(snap.projects.enumerated()), id: \.element.id) { idx, p in
                    signalRow(p, t: t)
                    if idx != snap.projects.count - 1 {
                        Rectangle().fill(HUD.line).frame(height: 0.5)
                    }
                }
            }
        }
    }

    private func signalRow(_ p: SignalProject, t: Double) -> some View {
        VStack(spacing: 6) {
            HStack(spacing: 10) {
                Text(p.code)
                    .font(.system(size: 11, weight: .heavy, design: .monospaced))
                    .foregroundStyle(HUD.bg0)
                    .padding(.horizontal, 6).padding(.vertical, 3)
                    .background(p.statusColor).clipShape(RoundedRectangle(cornerRadius: 4))
                Text(p.name)
                    .font(.system(size: 13, weight: .semibold, design: .monospaced))
                    .foregroundStyle(HUD.ink).lineLimit(1)
                Spacer(minLength: 6)
                Text(p.status.uppercased())
                    .font(.system(size: 9, weight: .bold, design: .monospaced)).tracking(1)
                    .foregroundStyle(p.statusColor)
                Text("\(p.routineDone)/\(p.routineTotal)")
                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                    .foregroundStyle(HUD.inkSub)
            }
            GeometryReader { g in
                ZStack(alignment: .leading) {
                    Capsule().fill(HUD.cyan.opacity(0.10))
                    Capsule()
                        .fill(LinearGradient(colors: [p.statusColor.opacity(0.6), p.statusColor], startPoint: .leading, endPoint: .trailing))
                        .frame(width: g.size.width * max(0.02, p.progress))
                        .shadow(color: p.statusColor.opacity(0.7), radius: 4)
                    let hx = (t.truncatingRemainder(dividingBy: 2) / 2) * g.size.width * p.progress
                    Capsule().fill(Color.white.opacity(0.5)).frame(width: 16).blur(radius: 5)
                        .offset(x: max(0, hx - 8))
                        .mask(Capsule().frame(width: g.size.width * max(0.02, p.progress)))
                }
            }
            .frame(height: 7)
        }
    }

    // MARK: Next Action Queue

    private func actionQueuePanel(snap: HudSnapshot) -> some View {
        panel {
            VStack(alignment: .leading, spacing: 10) {
                panelTitle("Next Action Queue", trailing: "FILE_STACK")
                ForEach(Array(snap.actions.enumerated()), id: \.element.id) { idx, a in
                    HStack(spacing: 10) {
                        Rectangle().fill(a.tone).frame(width: 3, height: 30)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(a.title)
                                .font(.system(size: 13, weight: .bold, design: .monospaced))
                                .foregroundStyle(HUD.ink)
                            Text("\(a.meta) · \(a.periodLabel)")
                                .font(.system(size: 9, weight: .semibold, design: .monospaced))
                                .foregroundStyle(HUD.inkSub)
                        }
                        Spacer()
                        Text(String(format: "FILE_%02d", idx + 1))
                            .font(.system(size: 9, weight: .bold, design: .monospaced))
                            .foregroundStyle(a.tone.opacity(0.8))
                    }
                }
            }
        }
    }

    // MARK: Footer

    private func footer() -> some View {
        VStack(spacing: 3) {
            Rectangle().fill(HUD.line).frame(height: 0.5)
            HStack {
                Text("Data synchronized · \(clock())")
                    .font(.system(size: 9, weight: .semibold, design: .monospaced))
                    .foregroundStyle(HUD.inkSub)
                Spacer()
                Text("Team Armada / AMD OS HUD")
                    .font(.system(size: 9, weight: .semibold, design: .monospaced))
                    .foregroundStyle(HUD.inkSub)
            }
            .padding(.top, 4)
        }
    }

    // MARK: Status screen (loading / error)

    private func statusScreen(t: Double, title: String, subtitle: String, tint: Color, spin: Bool) -> some View {
        VStack(spacing: 16) {
            ZStack {
                Circle().stroke(tint.opacity(0.15), lineWidth: 3).frame(width: 86, height: 86)
                Circle().trim(from: 0, to: 0.28)
                    .stroke(tint, style: StrokeStyle(lineWidth: 3, lineCap: .round))
                    .frame(width: 86, height: 86)
                    .rotationEffect(.degrees(spin ? t * 220 : 0))
                    .shadow(color: tint.opacity(0.8), radius: 8)
                Image(systemName: spin ? "dot.radiowaves.left.and.right" : "exclamationmark.triangle")
                    .font(.system(size: 26, weight: .semibold)).foregroundStyle(tint)
            }
            Text(title).font(.system(size: 16, weight: .heavy, design: .monospaced)).tracking(2).foregroundStyle(HUD.ink)
            Text(subtitle).font(.system(size: 10, weight: .semibold, design: .monospaced)).tracking(1.2)
                .foregroundStyle(HUD.inkSub).multilineTextAlignment(.center).padding(.horizontal, 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: Background / chrome

    private func background(t: Double, size: CGSize) -> some View {
        ZStack {
            LinearGradient(colors: [HUD.bg1, HUD.bg0], startPoint: .top, endPoint: .bottom)
            RadialGradient(colors: [HUD.cyan.opacity(0.10 + 0.04 * sin(t * 0.6)), .clear],
                           center: .topLeading, startRadius: 10, endRadius: max(size.width, size.height) * 0.8)
            RadialGradient(colors: [HUD.coral.opacity(0.06), .clear],
                           center: .topTrailing, startRadius: 10, endRadius: max(size.width, size.height) * 0.6)
            gridCanvas(size: size)
        }
    }

    private func gridCanvas(size: CGSize) -> some View {
        Canvas { ctx, sz in
            let step: CGFloat = 34
            var path = Path()
            var x: CGFloat = 0
            while x <= sz.width { path.move(to: .init(x: x, y: 0)); path.addLine(to: .init(x: x, y: sz.height)); x += step }
            var y: CGFloat = 0
            while y <= sz.height { path.move(to: .init(x: 0, y: y)); path.addLine(to: .init(x: sz.width, y: y)); y += step }
            ctx.stroke(path, with: .color(HUD.cyan.opacity(0.05)), lineWidth: 0.5)
        }
    }

    private func scanline(t: Double, size: CGSize) -> some View {
        let h = size.height
        let y = (t.truncatingRemainder(dividingBy: 4.5) / 4.5) * h
        return LinearGradient(colors: [.clear, HUD.cyan.opacity(0.09), .clear], startPoint: .top, endPoint: .bottom)
            .frame(height: 120).offset(y: y - h / 2).blendMode(.screen).allowsHitTesting(false)
    }

    private func tickRing() -> some View {
        Canvas { ctx, sz in
            let c = CGPoint(x: sz.width / 2, y: sz.height / 2)
            let r = min(sz.width, sz.height) / 2 - 2
            for i in 0..<72 {
                let ang = Double(i) / 72 * 2 * .pi
                let long = i % 6 == 0
                let r0 = r - (long ? 9 : 4)
                let p0 = CGPoint(x: c.x + cos(ang) * r0, y: c.y + sin(ang) * r0)
                let p1 = CGPoint(x: c.x + cos(ang) * r, y: c.y + sin(ang) * r)
                var path = Path(); path.move(to: p0); path.addLine(to: p1)
                let col = (i % 9 == 0) ? HUD.coral.opacity(0.5) : HUD.cyan.opacity(long ? 0.5 : 0.2)
                ctx.stroke(path, with: .color(col), lineWidth: long ? 1.4 : 0.8)
            }
        }
    }

    private var closeButton: some View {
        VStack {
            HStack {
                Spacer()
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 14, weight: .bold)).foregroundStyle(HUD.ink)
                        .frame(width: 38, height: 38)
                        .background(HUD.cyan.opacity(0.10))
                        .overlay(Circle().stroke(HUD.cyan.opacity(0.5), lineWidth: 1))
                        .clipShape(Circle())
                }
                .padding(.trailing, 16).padding(.top, 14)
            }
            Spacer()
        }
    }

    private func cornerBrackets(size: CGSize) -> some View {
        Canvas { ctx, sz in
            let len: CGFloat = 22; let inset: CGFloat = 8
            let corners: [(CGPoint, CGFloat, CGFloat)] = [
                (.init(x: inset, y: inset), 1, 1),
                (.init(x: sz.width - inset, y: inset), -1, 1),
                (.init(x: inset, y: sz.height - inset), 1, -1),
                (.init(x: sz.width - inset, y: sz.height - inset), -1, -1),
            ]
            for (pt, dx, dy) in corners {
                var path = Path()
                path.move(to: .init(x: pt.x + len * dx, y: pt.y)); path.addLine(to: pt)
                path.addLine(to: .init(x: pt.x, y: pt.y + len * dy))
                ctx.stroke(path, with: .color(HUD.cyan.opacity(0.6)), lineWidth: 1.5)
            }
        }
        .allowsHitTesting(false)
    }

    private func panel<Content: View>(padding: CGFloat = 16, @ViewBuilder _ content: () -> Content) -> some View {
        content()
            .padding(padding)
            .background(
                RoundedRectangle(cornerRadius: 12).fill(HUD.cyan.opacity(0.04))
                    .background(RoundedRectangle(cornerRadius: 12).fill(HUD.bg0.opacity(0.55)))
            )
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(HUD.line, lineWidth: 1))
    }

    private func panelTitle(_ title: String, trailing: String) -> some View {
        HStack {
            HStack(spacing: 6) {
                Rectangle().fill(HUD.cyan).frame(width: 3, height: 12)
                Text(title)
                    .font(.system(size: 12, weight: .bold, design: .monospaced)).tracking(1)
                    .foregroundStyle(HUD.ink)
            }
            Spacer()
            Text(trailing)
                .font(.system(size: 9, weight: .bold, design: .monospaced)).tracking(1)
                .foregroundStyle(HUD.inkSub)
        }
    }

    private func clock() -> String {
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.timeZone = TimeZone(identifier: "Asia/Tokyo")
        fmt.dateFormat = "HH:mm:ss"
        return fmt.string(from: Date())
    }

    private func ymShort(_ ym: String) -> String {
        guard ym.count >= 6 else { return ym }
        return "\(ym.prefix(4)).\(ym.dropFirst(4).prefix(2))"
    }
}

#Preview {
    CockpitHUDView()
}
