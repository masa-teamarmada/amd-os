import SwiftUI

// MARK: - HUD Cockpit (Demo)
//
// 設定画面から fullScreenCover で開く没入型 HUD コックピット。
// データは Supabase の実データ（active projects + cockpit data）を集計して表示する。
// 見た目はサイバー / ネオン HUD テイスト。デモ用途だが数値は本物。

// MARK: Palette

private enum HUD {
    static let bg0   = Color(r: 4,   g: 8,   b: 18)
    static let bg1   = Color(r: 8,   g: 18,  b: 38)
    static let cyan  = Color(r: 0,   g: 229, b: 255)
    static let blue  = Color(r: 0,   g: 130, b: 227)
    static let mint  = Color(r: 64,  g: 255, b: 196)
    static let amber = Color(r: 255, g: 184, b: 64)
    static let red   = Color(r: 255, g: 92,  b: 112)
    static let line  = Color(r: 0,   g: 229, b: 255).opacity(0.22)
    static let ink   = Color(r: 198, g: 236, b: 255)
    static let inkSub = Color(r: 120, g: 168, b: 200)
}

// MARK: View models

private struct HUDProject: Identifiable {
    let id: String
    let code: String
    let name: String
    let progress: Double      // 0...1
    let pts: Int
    let status: String        // ON TRACK / AT RISK / AHEAD / COMPLETE
    var statusColor: Color {
        switch status {
        case "AHEAD":    return HUD.mint
        case "AT RISK":  return HUD.amber
        case "COMPLETE": return HUD.blue
        default:          return HUD.cyan
        }
    }
}

private struct HUDMetric: Identifiable {
    let id = UUID()
    let label: String
    let value: String
    let unit: String
    let trend: Double
    let tint: Color
}

private struct HUDMember: Identifiable {
    let id = UUID()
    let name: String
    let pt: Int
    let yen: Int
}

private struct HUDSnapshot {
    let overall: Double
    let projectCount: Int
    let clearedMs: Int
    let totalMs: Int
    let atRisk: Int
    let metrics: [HUDMetric]
    let projects: [HUDProject]
    let members: [HUDMember]
    let ticker: [String]
}

// MARK: - ViewModel

@MainActor
private final class CockpitHUDViewModel: ObservableObject {
    enum Phase {
        case loading
        case error(String)
        case empty
        case ready(HUDSnapshot)
    }

    @Published var phase: Phase = .loading

    func load() async {
        phase = .loading
        do {
            let projects = try await SupabaseService.shared.fetchActiveProjects()
            if projects.isEmpty {
                phase = .empty
                return
            }
            // 各 PJ の cockpit data を並列取得（失敗した PJ はスキップ）
            let datas: [CockpitData] = await withTaskGroup(of: CockpitData?.self) { group in
                for p in projects {
                    group.addTask {
                        try? await SupabaseService.shared.fetchCockpitData(projectId: p.projectId)
                    }
                }
                var acc: [CockpitData] = []
                for await d in group { if let d { acc.append(d) } }
                return acc
            }
            if datas.isEmpty {
                phase = .empty
                return
            }
            phase = .ready(Self.build(from: datas))
        } catch {
            phase = .error(error.localizedDescription)
        }
    }

    // MARK: aggregation

    private static func build(from datas: [CockpitData]) -> HUDSnapshot {
        var projects: [HUDProject] = []
        var memberAgg: [String: (pt: Double, yen: Double)] = [:]
        var totalPts = 0
        var sumBudget = 0.0
        var clearedMsAll = 0
        var totalMsAll = 0
        var weightedProgress = 0.0   // Σ pts*progress
        var weightSum = 0.0
        var weightedExpected = 0.0
        var atRisk = 0

        for data in datas {
            let ms = data.milestones
            let msPoints = ms.reduce(0) { $0 + $1.points }
            let progress: Double = {
                guard msPoints > 0 else {
                    // ポイント無ければ単純平均
                    guard !ms.isEmpty else { return 0 }
                    return ms.reduce(0.0) { $0 + $1.currentProgressPct } / Double(ms.count) / 100.0
                }
                let acc = ms.reduce(0.0) { $0 + Double($1.points) * $1.currentProgressPct }
                return acc / Double(msPoints) / 100.0
            }()
            let pts = data.planCycle?.totalPoints ?? msPoints
            let cleared = ms.filter { $0.currentProgressPct >= 99.5 }.count
            let total = ms.count
            clearedMsAll += cleared
            totalMsAll += total

            let cur = data.monthlyCards.first(where: { $0.isCurrent }) ?? data.monthlyCards.first
            let expectedPct = cur?.expectedPct   // 0...100 想定

            // ステータス判定
            let progPct = progress * 100
            let status: String
            if total > 0 && cleared == total {
                status = "COMPLETE"
            } else if let exp = expectedPct, exp > 0 {
                let delta = progPct - exp
                if delta >= 5 { status = "AHEAD" }
                else if delta <= -8 { status = "AT RISK" }
                else { status = "ON TRACK" }
            } else {
                status = progPct >= 60 ? "AHEAD" : "ON TRACK"
            }
            if status == "AT RISK" { atRisk += 1 }

            // メンバー報酬集計（当月カード）
            for r in cur?.memberRewards ?? [] {
                var e = memberAgg[r.memberName] ?? (0, 0)
                e.pt += r.earnedPt
                e.yen += r.estimatedRewardYen
                memberAgg[r.memberName] = e
            }

            sumBudget += cur?.budgetYen ?? 0
            totalPts += pts
            let w = Double(max(pts, 1))
            weightedProgress += w * progress
            weightSum += w
            weightedExpected += w * ((expectedPct ?? progPct) / 100.0)

            projects.append(HUDProject(
                id: data.project.projectId,
                code: data.project.projectId.uppercased(),
                name: data.project.projectName,
                progress: progress,
                pts: pts,
                status: status
            ))
        }

        projects.sort { $0.progress > $1.progress }

        let overall = weightSum > 0 ? weightedProgress / weightSum : 0
        let overallExpected = weightSum > 0 ? weightedExpected / weightSum : 0
        let velocity = overallExpected > 0 ? overall / overallExpected * 100 : 100

        let members = memberAgg
            .map { HUDMember(name: $0.key, pt: Int($0.value.pt.rounded()), yen: Int($0.value.yen.rounded())) }
            .sorted { $0.pt > $1.pt }
            .prefix(6)
            .map { $0 }

        let metrics: [HUDMetric] = [
            .init(label: "ACTIVE PJ",    value: "\(datas.count)", unit: "", trend: 0.4, tint: HUD.cyan),
            .init(label: "TOTAL POINTS", value: groupedInt(totalPts), unit: "pt", trend: 0.6, tint: HUD.mint),
            .init(label: "MONTH BUDGET", value: String(format: "%.1f", sumBudget / 1_000_000), unit: "M¥", trend: 0.2, tint: HUD.blue),
            .init(label: "MS CLEARED",   value: "\(clearedMsAll)", unit: "/\(totalMsAll)", trend: 0.5, tint: HUD.cyan),
            .init(label: "AT RISK",      value: "\(atRisk)", unit: "PJ", trend: atRisk > 0 ? -0.4 : 0.2, tint: atRisk > 0 ? HUD.amber : HUD.mint),
            .init(label: "VELOCITY",     value: String(format: "%.0f", velocity), unit: "%", trend: velocity >= 100 ? 0.6 : -0.3, tint: velocity >= 100 ? HUD.mint : HUD.amber),
        ]

        // ティッカー（実データから生成）
        var ticker: [String] = ["\(datas.count) PROJECTS ONLINE · OVERALL \(Int((overall*100).rounded()))%"]
        for p in projects.prefix(8) {
            let mark: String
            switch p.status {
            case "AHEAD":    mark = "▲ AHEAD"
            case "AT RISK":  mark = "⚠ AT RISK"
            case "COMPLETE": mark = "✓ COMPLETE"
            default:          mark = "● ON TRACK"
            }
            ticker.append("\(p.code) \(p.name)  \(Int((p.progress*100).rounded()))%  \(mark)")
        }
        ticker.append(String(format: "MONTH BUDGET ¥%@", groupedInt(Int(sumBudget))))
        ticker.append("MS CLEARED \(clearedMsAll)/\(totalMsAll)")

        return HUDSnapshot(
            overall: overall,
            projectCount: datas.count,
            clearedMs: clearedMsAll,
            totalMs: totalMsAll,
            atRisk: atRisk,
            metrics: metrics,
            projects: projects,
            members: members,
            ticker: ticker
        )
    }

    private static func groupedInt(_ v: Int) -> String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.groupingSeparator = ","
        return f.string(from: NSNumber(value: v)) ?? "\(v)"
    }
}

// MARK: - Root

struct CockpitHUDView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var vm = CockpitHUDViewModel()

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
            statusScreen(t: t, title: "ESTABLISHING UPLINK", subtitle: "SYNCING LIVE DATA" + dots(t: t), tint: HUD.cyan, spinning: true)
        case .empty:
            statusScreen(t: t, title: "NO ACTIVE PROJECTS", subtitle: "STANDBY", tint: HUD.amber, spinning: false)
        case .error(let msg):
            VStack(spacing: 14) {
                statusScreen(t: t, title: "DATA LINK FAILED", subtitle: msg, tint: HUD.red, spinning: false)
                Button { Task { await vm.load() } } label: {
                    Text("RETRY")
                        .font(.system(size: 12, weight: .bold, design: .monospaced))
                        .tracking(2)
                        .foregroundStyle(HUD.bg0)
                        .padding(.horizontal, 22).padding(.vertical, 9)
                        .background(HUD.cyan)
                        .clipShape(Capsule())
                }
            }
        case .ready(let snap):
            dashboard(snap: snap, t: t)
        }
    }

    private func dots(t: Double) -> String {
        String(repeating: ".", count: Int(t.truncatingRemainder(dividingBy: 1.2) / 0.4) + 1)
    }

    // MARK: Status (loading/error/empty)

    private func statusScreen(t: Double, title: String, subtitle: String, tint: Color, spinning: Bool) -> some View {
        VStack(spacing: 16) {
            ZStack {
                Circle().stroke(tint.opacity(0.15), lineWidth: 3).frame(width: 86, height: 86)
                Circle()
                    .trim(from: 0, to: 0.28)
                    .stroke(tint, style: StrokeStyle(lineWidth: 3, lineCap: .round))
                    .frame(width: 86, height: 86)
                    .rotationEffect(.degrees(spinning ? t * 220 : 0))
                    .shadow(color: tint.opacity(0.8), radius: 8)
                Image(systemName: spinning ? "dot.radiowaves.left.and.right" : "exclamationmark.triangle")
                    .font(.system(size: 26, weight: .semibold))
                    .foregroundStyle(tint)
            }
            Text(title)
                .font(.system(size: 16, weight: .heavy, design: .monospaced))
                .tracking(2)
                .foregroundStyle(HUD.ink)
            Text(subtitle)
                .font(.system(size: 10, weight: .semibold, design: .monospaced))
                .tracking(1.2)
                .foregroundStyle(HUD.inkSub)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: Dashboard

    private func dashboard(snap: HUDSnapshot, t: Double) -> some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 18) {
                header(t: t)
                HStack(alignment: .top, spacing: 16) {
                    gaugePanel(snap: snap, t: t)
                    metricGrid(snap: snap)
                }
                projectsPanel(snap: snap, t: t)
                if !snap.members.isEmpty { membersPanel(snap: snap) }
                ticker(snap: snap, t: t)
                Color.clear.frame(height: 24)
            }
            .padding(.horizontal, 18)
            .padding(.top, 64)
            .padding(.bottom, 12)
        }
    }

    // MARK: Background

    private func background(t: Double, size: CGSize) -> some View {
        ZStack {
            LinearGradient(colors: [HUD.bg1, HUD.bg0], startPoint: .top, endPoint: .bottom)
            RadialGradient(
                colors: [HUD.blue.opacity(0.20 + 0.05 * sin(t * 0.6)), .clear],
                center: .center, startRadius: 10, endRadius: max(size.width, size.height) * 0.7
            )
            gridCanvas(size: size)
        }
    }

    private func gridCanvas(size: CGSize) -> some View {
        Canvas { ctx, sz in
            let step: CGFloat = 38
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
        let y = (t.truncatingRemainder(dividingBy: 4) / 4) * h
        return LinearGradient(colors: [.clear, HUD.cyan.opacity(0.10), .clear], startPoint: .top, endPoint: .bottom)
            .frame(height: 120)
            .offset(y: y - h / 2)
            .blendMode(.screen)
            .allowsHitTesting(false)
    }

    // MARK: Header

    private func header(t: Double) -> some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 8) {
                    Circle().fill(HUD.mint).frame(width: 8, height: 8)
                        .shadow(color: HUD.mint, radius: 4 + 2 * sin(t * 3))
                    Text("AMD OS // TACTICAL COCKPIT")
                        .font(.system(size: 13, weight: .bold, design: .monospaced))
                        .tracking(2)
                        .foregroundStyle(HUD.ink)
                }
                Text("SYSTEM NOMINAL · LIVE FEED")
                    .font(.system(size: 9, weight: .semibold, design: .monospaced))
                    .tracking(1.5)
                    .foregroundStyle(HUD.inkSub)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(clock())
                    .font(.system(size: 17, weight: .bold, design: .monospaced))
                    .foregroundStyle(HUD.cyan)
                    .shadow(color: HUD.cyan.opacity(0.7), radius: 6)
                Text("JST · LIVE")
                    .font(.system(size: 9, weight: .semibold, design: .monospaced))
                    .tracking(1.5)
                    .foregroundStyle(HUD.inkSub)
            }
        }
        .padding(.bottom, 2)
    }

    // MARK: Gauge

    private func gaugePanel(snap: HUDSnapshot, t: Double) -> some View {
        panel {
            VStack(spacing: 10) {
                Text("OVERALL EXECUTION")
                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                    .tracking(2)
                    .foregroundStyle(HUD.inkSub)
                ZStack {
                    tickRing().rotationEffect(.degrees(t * 8))
                    Circle().stroke(HUD.cyan.opacity(0.12), lineWidth: 10).padding(26)
                    Circle()
                        .trim(from: 0, to: max(0.001, snap.overall))
                        .stroke(
                            AngularGradient(colors: [HUD.blue, HUD.cyan, HUD.mint], center: .center),
                            style: StrokeStyle(lineWidth: 10, lineCap: .round)
                        )
                        .rotationEffect(.degrees(-90))
                        .padding(26)
                        .shadow(color: HUD.cyan.opacity(0.8), radius: 8)
                    VStack(spacing: 0) {
                        Text(String(format: "%.1f", snap.overall * 100))
                            .font(.system(size: 38, weight: .heavy, design: .monospaced))
                            .foregroundStyle(HUD.ink)
                            .shadow(color: HUD.cyan.opacity(0.6), radius: 6)
                        Text("% COMPLETE")
                            .font(.system(size: 9, weight: .bold, design: .monospaced))
                            .tracking(2)
                            .foregroundStyle(HUD.inkSub)
                    }
                }
                .frame(width: 170, height: 170)

                HStack(spacing: 14) {
                    miniStat("PROJECTS", "\(snap.projectCount)", HUD.cyan)
                    miniStat("CLEARED", "\(snap.clearedMs)/\(snap.totalMs)", HUD.mint)
                    miniStat("AT RISK", "\(snap.atRisk)", snap.atRisk > 0 ? HUD.amber : HUD.mint)
                }
            }
            .frame(maxWidth: .infinity)
        }
    }

    private func tickRing() -> some View {
        Canvas { ctx, sz in
            let c = CGPoint(x: sz.width / 2, y: sz.height / 2)
            let r = min(sz.width, sz.height) / 2 - 2
            for i in 0..<60 {
                let ang = Double(i) / 60 * 2 * .pi
                let long = i % 5 == 0
                let r0 = r - (long ? 10 : 5)
                let p0 = CGPoint(x: c.x + cos(ang) * r0, y: c.y + sin(ang) * r0)
                let p1 = CGPoint(x: c.x + cos(ang) * r, y: c.y + sin(ang) * r)
                var path = Path(); path.move(to: p0); path.addLine(to: p1)
                ctx.stroke(path, with: .color(HUD.cyan.opacity(long ? 0.55 : 0.22)), lineWidth: long ? 1.5 : 0.8)
            }
        }
    }

    private func miniStat(_ label: String, _ value: String, _ tint: Color) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(size: 15, weight: .bold, design: .monospaced))
                .foregroundStyle(tint)
                .lineLimit(1).minimumScaleFactor(0.6)
            Text(label)
                .font(.system(size: 8, weight: .semibold, design: .monospaced))
                .tracking(1.2)
                .foregroundStyle(HUD.inkSub)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: Metric grid

    private func metricGrid(snap: HUDSnapshot) -> some View {
        let cols = [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]
        return LazyVGrid(columns: cols, spacing: 10) {
            ForEach(snap.metrics) { m in
                panel(padding: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(m.label)
                            .font(.system(size: 9, weight: .bold, design: .monospaced))
                            .tracking(1.2)
                            .foregroundStyle(HUD.inkSub)
                        HStack(alignment: .firstTextBaseline, spacing: 3) {
                            Text(m.value)
                                .font(.system(size: 24, weight: .heavy, design: .monospaced))
                                .foregroundStyle(m.tint)
                                .shadow(color: m.tint.opacity(0.5), radius: 5)
                                .lineLimit(1).minimumScaleFactor(0.5)
                            Text(m.unit)
                                .font(.system(size: 10, weight: .bold, design: .monospaced))
                                .foregroundStyle(HUD.inkSub)
                        }
                        sparkline(trend: m.trend, tint: m.tint).frame(height: 16)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }

    private func sparkline(trend: Double, tint: Color) -> some View {
        Canvas { ctx, sz in
            var path = Path()
            let n = 16
            for i in 0...n {
                let x = sz.width * CGFloat(i) / CGFloat(n)
                let base = sin(Double(i) * 0.9) * 0.5 + 0.5
                let drift = Double(i) / Double(n) * trend
                let yv = max(0, min(1, base * 0.5 + drift * 0.5 + 0.25))
                let y = sz.height * (1 - CGFloat(yv))
                if i == 0 { path.move(to: .init(x: x, y: y)) } else { path.addLine(to: .init(x: x, y: y)) }
            }
            ctx.stroke(path, with: .color(tint.opacity(0.85)), lineWidth: 1.5)
        }
    }

    // MARK: Projects

    private func projectsPanel(snap: HUDSnapshot, t: Double) -> some View {
        panel {
            VStack(alignment: .leading, spacing: 12) {
                panelTitle("PROJECT GRID", trailing: "\(snap.projects.count) ACTIVE")
                ForEach(Array(snap.projects.enumerated()), id: \.element.id) { idx, p in
                    projectRow(p, t: t)
                    if idx != snap.projects.count - 1 {
                        Rectangle().fill(HUD.line).frame(height: 0.5)
                    }
                }
            }
        }
    }

    private func projectRow(_ p: HUDProject, t: Double) -> some View {
        VStack(spacing: 6) {
            HStack(spacing: 10) {
                Text(p.code)
                    .font(.system(size: 11, weight: .heavy, design: .monospaced))
                    .foregroundStyle(HUD.bg0)
                    .padding(.horizontal, 6).padding(.vertical, 3)
                    .background(p.statusColor)
                    .clipShape(RoundedRectangle(cornerRadius: 4))
                Text(p.name)
                    .font(.system(size: 13, weight: .semibold, design: .monospaced))
                    .foregroundStyle(HUD.ink)
                    .lineLimit(1)
                Spacer(minLength: 6)
                Text(p.status)
                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                    .tracking(1)
                    .foregroundStyle(p.statusColor)
                Text("\(p.pts)pt")
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
                    Capsule().fill(Color.white.opacity(0.5))
                        .frame(width: 18).blur(radius: 5)
                        .offset(x: max(0, hx - 9))
                        .mask(Capsule().frame(width: g.size.width * max(0.02, p.progress)))
                }
            }
            .frame(height: 7)
        }
    }

    // MARK: Members

    private func membersPanel(snap: HUDSnapshot) -> some View {
        panel {
            VStack(alignment: .leading, spacing: 12) {
                panelTitle("REWARD ALLOCATION", trailing: "EST. THIS MONTH")
                ForEach(snap.members) { m in
                    HStack(spacing: 10) {
                        Image(systemName: "person.fill")
                            .font(.system(size: 11))
                            .foregroundStyle(HUD.cyan)
                            .frame(width: 22, height: 22)
                            .background(HUD.cyan.opacity(0.12))
                            .clipShape(Circle())
                        Text(m.name)
                            .font(.system(size: 12, weight: .semibold, design: .monospaced))
                            .foregroundStyle(HUD.ink)
                            .lineLimit(1)
                        Spacer(minLength: 6)
                        Text("\(m.pt)pt")
                            .font(.system(size: 12, weight: .bold, design: .monospaced))
                            .foregroundStyle(HUD.mint)
                        Text("¥\(groupedInt(m.yen))")
                            .font(.system(size: 12, weight: .bold, design: .monospaced))
                            .foregroundStyle(HUD.cyan)
                            .frame(width: 82, alignment: .trailing)
                    }
                }
            }
        }
    }

    // MARK: Ticker

    private func ticker(snap: HUDSnapshot, t: Double) -> some View {
        let joined = snap.ticker.joined(separator: "      ◇      ")
        let full = joined + "      ◇      " + joined
        return panel(padding: 10) {
            HStack(spacing: 8) {
                Text("LIVE")
                    .font(.system(size: 9, weight: .heavy, design: .monospaced))
                    .foregroundStyle(HUD.bg0)
                    .padding(.horizontal, 5).padding(.vertical, 2)
                    .background(HUD.red)
                    .clipShape(RoundedRectangle(cornerRadius: 3))
                GeometryReader { g in
                    let span = g.size.width
                    let off = -(t.truncatingRemainder(dividingBy: 28) / 28) * span
                    Text(full)
                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                        .foregroundStyle(HUD.inkSub)
                        .lineLimit(1).fixedSize()
                        .offset(x: off)
                        .frame(width: span, alignment: .leading)
                        .clipped()
                }
                .frame(height: 16)
            }
        }
    }

    // MARK: Chrome

    private var closeButton: some View {
        VStack {
            HStack {
                Spacer()
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(HUD.ink)
                        .frame(width: 38, height: 38)
                        .background(HUD.cyan.opacity(0.10))
                        .overlay(Circle().stroke(HUD.cyan.opacity(0.5), lineWidth: 1))
                        .clipShape(Circle())
                }
                .padding(.trailing, 18)
                .padding(.top, 14)
            }
            Spacer()
        }
    }

    private func cornerBrackets(size: CGSize) -> some View {
        Canvas { ctx, sz in
            let len: CGFloat = 22
            let inset: CGFloat = 8
            let corners: [(CGPoint, CGFloat, CGFloat)] = [
                (.init(x: inset, y: inset), 1, 1),
                (.init(x: sz.width - inset, y: inset), -1, 1),
                (.init(x: inset, y: sz.height - inset), 1, -1),
                (.init(x: sz.width - inset, y: sz.height - inset), -1, -1),
            ]
            for (pt, dx, dy) in corners {
                var path = Path()
                path.move(to: .init(x: pt.x + len * dx, y: pt.y))
                path.addLine(to: pt)
                path.addLine(to: .init(x: pt.x, y: pt.y + len * dy))
                ctx.stroke(path, with: .color(HUD.cyan.opacity(0.6)), lineWidth: 1.5)
            }
        }
        .allowsHitTesting(false)
    }

    // MARK: Reusable

    private func panel<Content: View>(padding: CGFloat = 16, @ViewBuilder _ content: () -> Content) -> some View {
        content()
            .padding(padding)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(HUD.cyan.opacity(0.04))
                    .background(RoundedRectangle(cornerRadius: 12).fill(HUD.bg0.opacity(0.55)))
            )
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(HUD.line, lineWidth: 1))
    }

    private func panelTitle(_ title: String, trailing: String) -> some View {
        HStack {
            HStack(spacing: 6) {
                Rectangle().fill(HUD.cyan).frame(width: 3, height: 12)
                Text(title)
                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                    .tracking(1.5)
                    .foregroundStyle(HUD.ink)
            }
            Spacer()
            Text(trailing)
                .font(.system(size: 9, weight: .bold, design: .monospaced))
                .tracking(1)
                .foregroundStyle(HUD.inkSub)
        }
    }

    // MARK: Helpers

    private func clock() -> String {
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.timeZone = TimeZone(identifier: "Asia/Tokyo")
        fmt.dateFormat = "HH:mm:ss"
        return fmt.string(from: Date())
    }

    private func groupedInt(_ v: Int) -> String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.groupingSeparator = ","
        return f.string(from: NSNumber(value: v)) ?? "\(v)"
    }
}

#Preview {
    CockpitHUDView()
}
