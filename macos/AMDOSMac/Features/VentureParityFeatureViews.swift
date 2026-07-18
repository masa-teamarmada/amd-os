import SwiftUI
import AppKit

/// WebGL OrbitControlsのNative置換。Canvas上の実3次元座標を透視投影し、
/// 左ドラッグ=旋回、Option+ドラッグ=平行移動、pinch/scroll=ズームに共通化する。
private struct AMDOSNativeOrbitCamera: Equatable {
    var yaw: Double
    var pitch: Double
    var zoom: CGFloat = 1
    var pan: CGSize = .zero

    static func cyberspacePreset(_ preset: String) -> Self {
        switch preset {
        case "M × X": return .init(yaw: 0, pitch: 0)
        case "X × F": return .init(yaw: .pi / 2, pitch: 0)
        case "M × F": return .init(yaw: 0, pitch: -.pi / 2 + 0.02)
        default: return .init(yaw: .pi / 4, pitch: -.pi / 6)
        }
    }

    static func timelinePreset(_ preset: String) -> Self {
        switch preset {
        case "T × SCORE": return .init(yaw: 0, pitch: 0)
        case "SU × SCORE": return .init(yaw: .pi / 2, pitch: 0)
        case "T × SU": return .init(yaw: 0, pitch: -.pi / 2 + 0.02)
        default: return .init(yaw: .pi / 4, pitch: -.pi / 6)
        }
    }

    func project(
        _ world: SIMD3<Double>,
        around center: SIMD3<Double>,
        in size: CGSize,
        scale: CGFloat
    ) -> CGPoint {
        let v = world - center
        let cosYaw = cos(yaw), sinYaw = sin(yaw)
        let horizontal = cosYaw * v.x + sinYaw * v.z
        let depthAfterYaw = -sinYaw * v.x + cosYaw * v.z
        let cosPitch = cos(pitch), sinPitch = sin(pitch)
        let vertical = cosPitch * v.y - sinPitch * depthAfterYaw
        let depth = sinPitch * v.y + cosPitch * depthAfterYaw
        let perspective = 1 / max(0.38, 1 + depth * 0.38)
        let adjusted = scale * zoom * CGFloat(perspective)
        return CGPoint(
            x: size.width / 2 + pan.width + CGFloat(horizontal) * adjusted,
            y: size.height / 2 + pan.height - CGFloat(vertical) * adjusted
        )
    }

    mutating func rotate(with translation: CGSize) {
        yaw += Double(translation.width) * 0.012
        pitch = min(.pi / 2 - 0.02, max(-.pi / 2 + 0.02, pitch - Double(translation.height) * 0.012))
    }

    mutating func pan(with translation: CGSize) {
        pan = CGSize(width: pan.width + translation.width, height: pan.height + translation.height)
    }

    mutating func adjustZoom(_ delta: CGFloat) {
        zoom = min(4.5, max(0.38, zoom * exp(delta * 0.006)))
    }
}

/// SwiftUIのMagnifyGestureだけではマウスホイールを受けられないため、
/// PWA OrbitControlsと同じくCanvas上のscrollだけをNative側でズームに消費する。
private struct AMDOSNativeCanvasScrollZoomCapture: NSViewRepresentable {
    let onScroll: (CGFloat) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(onScroll: onScroll) }

    func makeNSView(context: Context) -> NSView {
        let view = NSView(frame: .zero)
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor.clear.cgColor
        context.coordinator.view = view
        context.coordinator.installMonitor()
        return view
    }

    func updateNSView(_ view: NSView, context: Context) {
        context.coordinator.view = view
        context.coordinator.onScroll = onScroll
    }

    static func dismantleNSView(_ nsView: NSView, coordinator: Coordinator) {
        coordinator.removeMonitor()
    }

    final class Coordinator {
        weak var view: NSView?
        var onScroll: (CGFloat) -> Void
        private var monitor: Any?

        init(onScroll: @escaping (CGFloat) -> Void) { self.onScroll = onScroll }

        func installMonitor() {
            guard monitor == nil else { return }
            monitor = NSEvent.addLocalMonitorForEvents(matching: .scrollWheel) { [weak self] event in
                guard let self, let view = self.view, view.window != nil else { return event }
                let location = view.convert(event.locationInWindow, from: nil)
                guard view.bounds.contains(location) else { return event }
                let delta = event.hasPreciseScrollingDeltas ? event.scrollingDeltaY : event.deltaY * 10
                guard abs(delta) > 0.001 else { return event }
                self.onScroll(delta)
                return nil
            }
        }

        func removeMonitor() {
            if let monitor { NSEvent.removeMonitor(monitor) }
            monitor = nil
        }

        deinit { removeMonitor() }
    }
}

/// Timeline 3DのGizmoViewport相当。3軸の正面を選ぶと、PWAと同じ
/// T×SCORE / SU×SCORE / T×SU / 3D のカメラpresetへ戻す。
private struct AMDOSNativeTimelineAxisGizmo: View {
    let activePreset: String
    let onSelect: (String) -> Void

    var body: some View {
        VStack(alignment: .trailing, spacing: 5) {
            Text("AXIS")
                .font(.caption2.monospaced().weight(.semibold))
                .foregroundStyle(AMDOSDesign.muted)
            HStack(spacing: 4) {
                gizmoButton("T×S", preset: "T × SCORE")
                gizmoButton("SU×S", preset: "SU × SCORE")
                gizmoButton("T×SU", preset: "T × SU")
                gizmoButton("3D", preset: "3D")
            }
        }
        .padding(7)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 9))
        .overlay(RoundedRectangle(cornerRadius: 9).stroke(AMDOSDesign.border, lineWidth: 0.7))
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Timelineの視点軸")
    }

    private func gizmoButton(_ label: String, preset: String) -> some View {
        Button(label) { onSelect(preset) }
            .buttonStyle(.plain)
            .font(.caption2.monospaced().weight(activePreset == preset ? .bold : .regular))
            .foregroundStyle(activePreset == preset ? Color.white : AMDOSDesign.ink)
            .padding(.horizontal, 5)
            .padding(.vertical, 4)
            .background(activePreset == preset ? AMDOSDesign.blue : Color.clear, in: RoundedRectangle(cornerRadius: 5))
            .accessibilityLabel("\(label) 視点")
    }
}

private struct AMDOSNativeVentureProject: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let clientName: String?
    let status: String
    enum CodingKeys: String, CodingKey { case id = "project_id", name = "project_name", clientName = "client_name", status }
}

@MainActor
private final class AMDOSNativeVentureStore: ObservableObject {
    @Published var projects: [AMDOSNativeVentureProject] = []
    @Published var ventures: [AMDOSVentureRecord] = []
    @Published var xrl: [AMDOSVentureXRLLog] = []
    @Published var macro: [AMDOSMacroIndexLog] = []
    @Published var selectedId = ""
    @Published var state: AMDOSFeatureLoadState = .idle

    func load(ventureID: String? = nil) async {
        state = .loading
        do {
            async let projects = AMDOSRESTClient.shared.fetchTable(AMDOSNativeVentureProject.self, table: "projects", select: "project_id,project_name,client_name,status", order: "project_name", limit: 500)
            async let ventures = AMDOSRESTClient.shared.fetchTable(AMDOSVentureRecord.self, table: "project_ventures", select: "project_id,short_label,lane,founded_at,outcome_pattern,origin_org,origin_pi,amd_role,short_description,is_public", filters: ventureID.map { ["project_id": "eq.\($0)"] } ?? ["is_public": "eq.true"], order: "founded_at", limit: 500)
            async let macro = AMDOSRESTClient.shared.fetchTable(AMDOSMacroIndexLog.self, table: "macro_index_log", select: "lane,observed_at,index_value,policy_density,raw_signal_count", order: "observed_at", limit: 2_000)
            self.projects = try await projects
            self.ventures = try await ventures
            let ids = self.ventures.map(\.id)
            if let ventureID {
                self.xrl = try await AMDOSRESTClient.shared.fetchTable(AMDOSVentureXRLLog.self, table: "project_xrl_log", select: "id,project_id,observed_at,trl,brl,hrl,grl,srl,bottleneck,milestone_label,source_note", filters: ["project_id": "eq.\(ventureID)"], order: "observed_at", limit: 2_000)
            } else if ids.isEmpty {
                self.xrl = []
            } else {
                self.xrl = try await AMDOSRESTClient.shared.fetchTable(AMDOSVentureXRLLog.self, table: "project_xrl_log", select: "id,project_id,observed_at,trl,brl,hrl,grl,srl,bottleneck,milestone_label,source_note", filters: ["project_id": "in.(\(ids.joined(separator: ",")))"], order: "observed_at", limit: 2_000)
            }
            self.macro = try await macro
            selectedId = ventureID ?? (selectedId.isEmpty ? (self.ventures.first?.id ?? self.projects.first?.id ?? "") : selectedId)
            state = self.projects.isEmpty && self.ventures.isEmpty ? .empty : .loaded
        } catch { state = .failed(error.localizedDescription) }
    }

    func project(_ id: String?) -> AMDOSNativeVentureProject? { projects.first { $0.id == (id ?? selectedId) } }
    func venture(_ id: String?) -> AMDOSVentureRecord? { ventures.first { $0.id == (id ?? selectedId) } }
}

private struct AMDOSNativeProjectPicker: View {
    @ObservedObject var store: AMDOSNativeVentureStore
    var body: some View {
        Picker("PJ", selection: $store.selectedId) {
            Text("選んでね").tag("")
            ForEach(store.projects.filter { project in store.ventures.contains { venture in venture.id == project.id } }) { Text($0.name).tag($0.id) }
        }
    }
}

private struct AMDOSCyberspacePoint: Identifiable {
    let id: String
    let projectName: String
    let shortLabel: String
    let evaluatedAt: String
    let score: Double
    let bottleneck: String
    let phase: String
    let m: Double
    let x: Double
    let f: Double
    let sigma: Double
    let xLog: Double
    let frl: Double
}

struct AMDOSVentureCyberspaceNativeView: View {
    let onOpenAmdScoreDetail: (String) -> Void
    @StateObject private var store = AMDOSParityScoreStore()
    @State private var selectedID: String?
    @State private var projection = "ISO"
    @State private var camera = AMDOSNativeOrbitCamera.cyberspacePreset("ISO")

    private var points: [AMDOSCyberspacePoint] {
        store.data.ventures.compactMap { venture in
            guard let input = store.latestInput(for: venture.projectId) else { return nil }
            let result = AMDOSParityScoreMath.legacy(input, alpha: store.data.alpha)
            let xLog = (store.data.alpha["TRL"] ?? 0) * log10(max(0, input.trl ?? 0) + 1)
                + (store.data.alpha["BRL"] ?? 0) * log10(max(0, input.brl ?? 0) + 1)
                + (store.data.alpha["GRL"] ?? 0) * log10(max(0, input.grl ?? 0) + 1)
                + (store.data.alpha["SRL"] ?? 0) * log10(max(0, input.srl ?? 0) + 1)
                + (store.data.alpha["HRL"] ?? 0) * log10(max(0, input.hrl ?? 0) + 1)
            let m = min(1, log10(result.sigma + 1))
            let x = min(1, xLog / 3.2)
            let frl = AMDOSParityScoreMath.frl(input)
            let f = min(1, log10(max(0, frl) + 1))
            return .init(id: venture.projectId, projectName: store.projectName(venture.projectId), shortLabel: venture.shortLabel?.trimmedNonEmpty ?? String(store.projectName(venture.projectId).prefix(4)), evaluatedAt: input.evaluatedAt, score: result.score, bottleneck: result.bottleneck, phase: cyberspacePhase(result.score), m: m, x: x, f: f, sigma: result.sigma, xLog: xLog, frl: frl)
        }
    }

    private var selected: AMDOSCyberspacePoint? { points.first { $0.id == selectedID } }

    var body: some View {
        AMDOSPageScaffold(eyebrow: "CYBERSPACE", title: "Venture Cyberspace", subtitle: "PWAと同じ AMD Score = K·M·X·F のlog寄与空間。M=σ_SU、X=XRL5、F=FRLを正規化して表示する") {
            AMDOSStateNotice(state: store.state) { Task { await store.load() } }
            HStack {
                Picker("視点", selection: $projection) { Text("ISO").tag("ISO"); Text("M × X").tag("M × X"); Text("X × F").tag("X × F"); Text("M × F").tag("M × F") }.pickerStyle(.segmented)
                Button("視点を戻す") { camera = .cyberspacePreset(projection) }.buttonStyle(.bordered)
                Text("\(points.count) PJ · 平均 \(averageScore, specifier: "%.0f") · 最大 \(maxScore, specifier: "%.0f") · GO+ \(points.filter { $0.score >= 3500 }.count)").font(.caption.monospacedDigit()).foregroundStyle(AMDOSDesign.muted)
            }
            AMDOSCyberspacePlot(points: points, selectedID: $selectedID, projection: projection, camera: $camera)
            AMDOSSectionCard("等値面スコア", systemImage: "square.3.layers.3d") {
                HStack { ForEach([(300, "シーズ顕在化"), (1500, "立ち上げ準備期"), (3500, "GO 設立判定"), (15000, "スケール期"), (50000, "卒業期")], id: \.0) { shell in Text("S=\(shell.0) \(shell.1)").font(.caption) } }
            }
            if let selected {
                AMDOSSectionCard("⟨ TARGET LOCKED ⟩ \(selected.shortLabel.uppercased())", systemImage: "scope") {
                    Text(selected.projectName).font(.headline)
                    HStack { AMDOSMetricTile(label: "AMD Score", value: String(format: "%.0f", selected.score), detail: selected.phase); AMDOSMetricTile(label: "律速", value: selected.bottleneck, detail: "α/(X+1) 最大"); AMDOSMetricTile(label: "σ_SU", value: String(format: "%.2f", selected.sigma), detail: "M " + String(format: "%.2f", selected.m)); AMDOSMetricTile(label: "XRL5", value: String(format: "%.2f log", selected.xLog), detail: "X " + String(format: "%.2f", selected.x)); AMDOSMetricTile(label: "FRL", value: String(format: "%.1f", selected.frl), detail: "F " + String(format: "%.2f", selected.f)) }
                    HStack { Text("評価日 \(selected.evaluatedAt.prefix(10))").font(.caption).foregroundStyle(AMDOSDesign.muted); Spacer(); Button("AMD Score詳細を開く") { onOpenAmdScoreDetail(selected.id) }.buttonStyle(.bordered) }
                }
            }
        }
        .task { await store.load() }
        .onChange(of: projection) { _, next in camera = .cyberspacePreset(next) }
    }

    private var averageScore: Double { points.isEmpty ? 0 : points.map(\.score).reduce(0, +) / Double(points.count) }
    private var maxScore: Double { points.map(\.score).max() ?? 0 }
}

private func cyberspacePhase(_ score: Double) -> String {
    switch score {
    case ..<30: return "シーズ察知"
    case ..<300: return "シーズ顕在化"
    case ..<1_500: return "立ち上げ準備期"
    case ..<3_500: return "設立準備スタート"
    case ..<15_000: return "設立 GO"
    case ..<50_000: return "スケール期"
    default: return "卒業期"
    }
}

private struct AMDOSCyberspacePlot: View {
    let points: [AMDOSCyberspacePoint]
    @Binding var selectedID: String?
    let projection: String
    @Binding var camera: AMDOSNativeOrbitCamera
    @State private var dragStartCamera: AMDOSNativeOrbitCamera?
    @State private var magnifyStartZoom: CGFloat?
    var body: some View {
        GeometryReader { proxy in
            Canvas { context, size in
                let scale = max(1, min(size.width, size.height) * 0.62)
                let center = SIMD3<Double>(repeating: 0.5)
                drawCube(&context, size: size, center: center, scale: scale)
                for point in points {
                    let p = projected(point, size: size, scale: scale, center: center)
                    let selected = point.id == selectedID
                    let radius = 6 + CGFloat(point.x) * 11 + (selected ? 4 : 0)
                    let color = cyberspaceColor(point.phase)
                    context.fill(Path(ellipseIn: CGRect(x: p.x - radius, y: p.y - radius, width: radius * 2, height: radius * 2)), with: .color(color.opacity(selected ? 1 : 0.78)))
                    if selected { context.stroke(Path(ellipseIn: CGRect(x: p.x - radius - 3, y: p.y - radius - 3, width: (radius + 3) * 2, height: (radius + 3) * 2)), with: .color(AMDOSDesign.ink), lineWidth: 2) }
                    context.draw(Text(point.shortLabel.uppercased()).font(.caption2.weight(.bold)), at: .init(x: p.x, y: p.y - radius - 9))
                }
                let label = projection == "M × F" ? ("M = log10(σ_SU+1)", "F = log10(FRL+1)") : projection == "M × X" ? ("M = log10(σ_SU+1)", "X = XRL5 log / 3.2") : projection == "X × F" ? ("X = XRL5 log / 3.2", "F = log10(FRL+1)") : ("M / X / F 3D", "DRAG rotate · ⌥ DRAG pan · SCROLL zoom")
                context.draw(Text(label.0).font(.caption2).foregroundColor(AMDOSDesign.muted), at: .init(x: size.width / 2, y: size.height - 12))
                context.draw(Text(label.1).font(.caption2).foregroundColor(AMDOSDesign.muted), at: .init(x: 6, y: size.height / 2), anchor: .leading)
            }
            .contentShape(Rectangle())
            .gesture(SpatialTapGesture().onEnded { tap in
                let candidate = points.min { left, right in
                    let l = projected(left, size: proxy.size, scale: max(1, min(proxy.size.width, proxy.size.height) * 0.62), center: SIMD3<Double>(repeating: 0.5)), r = projected(right, size: proxy.size, scale: max(1, min(proxy.size.width, proxy.size.height) * 0.62), center: SIMD3<Double>(repeating: 0.5))
                    return hypot(l.x - tap.location.x, l.y - tap.location.y) < hypot(r.x - tap.location.x, r.y - tap.location.y)
                }
                selectedID = candidate?.id
            })
            .simultaneousGesture(orbitDrag)
            .simultaneousGesture(orbitMagnify)
            .background(AMDOSNativeCanvasScrollZoomCapture { camera.adjustZoom($0) }.allowsHitTesting(false))
        }
        .frame(minHeight: 440)
        .background(AMDOSDesign.panel, in: RoundedRectangle(cornerRadius: 14))
    }

    private var orbitDrag: some Gesture {
        DragGesture(minimumDistance: 2).onChanged { value in
            if dragStartCamera == nil { dragStartCamera = camera }
            guard var next = dragStartCamera else { return }
            if NSEvent.modifierFlags.contains(.option) { next.pan(with: value.translation) }
            else { next.rotate(with: value.translation) }
            camera = next
        }.onEnded { _ in dragStartCamera = nil }
    }

    private var orbitMagnify: some Gesture {
        MagnifyGesture().onChanged { value in
            if magnifyStartZoom == nil { magnifyStartZoom = camera.zoom }
            var next = camera
            next.zoom = min(4.5, max(0.38, (magnifyStartZoom ?? 1) * (1 + value.magnification)))
            camera = next
        }.onEnded { _ in magnifyStartZoom = nil }
    }

    private func world(_ point: AMDOSCyberspacePoint) -> SIMD3<Double> { .init(point.m, point.x, point.f) }

    private func projected(_ point: AMDOSCyberspacePoint, size: CGSize, scale: CGFloat, center: SIMD3<Double>) -> CGPoint {
        camera.project(world(point), around: center, in: size, scale: scale)
    }

    private func drawCube(_ context: inout GraphicsContext, size: CGSize, center: SIMD3<Double>, scale: CGFloat) {
        let vertices: [SIMD3<Double>] = [
            .init(0, 0, 0), .init(1, 0, 0), .init(1, 1, 0), .init(0, 1, 0),
            .init(0, 0, 1), .init(1, 0, 1), .init(1, 1, 1), .init(0, 1, 1)
        ]
        let edges = [(0, 1), (1, 2), (2, 3), (3, 0), (4, 5), (5, 6), (6, 7), (7, 4), (0, 4), (1, 5), (2, 6), (3, 7)]
        for (a, b) in edges {
            var line = Path()
            line.move(to: camera.project(vertices[a], around: center, in: size, scale: scale))
            line.addLine(to: camera.project(vertices[b], around: center, in: size, scale: scale))
            context.stroke(line, with: .color(AMDOSDesign.border.opacity(0.7)), lineWidth: 0.8)
        }
    }
}

private func cyberspaceColor(_ phase: String) -> Color {
    switch phase { case "シーズ察知": return .red; case "シーズ顕在化": return AMDOSDesign.muted; case "立ち上げ準備期": return .orange; case "設立準備スタート": return .yellow; case "設立 GO": return .blue; case "スケール期": return .green; default: return .purple }
}

private func latestBottleneck(_ rows: [AMDOSVentureXRLLog], id: String) -> String? { rows.filter { $0.projectId == id }.sorted { $0.observedAt > $1.observedAt }.first?.bottleneck }

private enum AMDOSOscillatorEffect: String, Sendable { case impulse, shift }

private struct AMDOSOscillatorPreset: Identifiable, Sendable {
    let id: String
    let label: String
    let description: String
    let target: String
    let magnitude: Double
    let effect: AMDOSOscillatorEffect
    let year: Int
    let month: Int
}

private struct AMDOSOscillatorEventInstance: Identifiable, Sendable {
    let id: String
    let preset: AMDOSOscillatorPreset
    let timeMonths: Int
}

/// PWA `CoupledOscillator` の Velocity Verlet 実装をそのまま Swift に移植する。
/// データベースに書かない理論sandboxなので、PWAと同じ決定論的な再計算だけを持つ。
private final class AMDOSCoupledOscillator {
    static let nodeIDs = ["P", "B", "I_R", "N", "V", "R"]
    static let masses: [String: Double] = ["P": 5, "B": 4, "I_R": 3, "N": 6, "V": 3.5, "R": 1]
    static let damping: [String: Double] = ["P": 0.20, "B": 0.25, "I_R": 0.25, "N": 0.15, "V": 0.30, "R": 0.45]
    static let bonds: [(String, String, Double)] = [
        ("P", "B", 2.5), ("B", "I_R", 2.5), ("I_R", "N", 1.8), ("N", "P", 1.0),
        ("N", "R", 1.5), ("N", "V", 1.2), ("N", "I_R", 0.8), ("R", "V", 1.5)
    ]
    private(set) var positions = Dictionary(uniqueKeysWithValues: nodeIDs.map { ($0, 0.0) })
    private var velocities = Dictionary(uniqueKeysWithValues: nodeIDs.map { ($0, 0.0) })
    private var externalForces = Dictionary(uniqueKeysWithValues: nodeIDs.map { ($0, 0.0) })
    private var equilibriumShifts = Dictionary(uniqueKeysWithValues: nodeIDs.map { ($0, 0.0) })

    func reset() {
        for id in Self.nodeIDs {
            positions[id] = 0; velocities[id] = 0; externalForces[id] = 0; equilibriumShifts[id] = 0
        }
    }

    func applyImpulse(target: String, magnitude: Double) { externalForces[target, default: 0] += magnitude }
    func applyShift(target: String, magnitude: Double) { equilibriumShifts[target, default: 0] += magnitude }

    private func acceleration() -> [String: Double] {
        var spring = Dictionary(uniqueKeysWithValues: Self.nodeIDs.map { ($0, 0.0) })
        for (from, to, k) in Self.bonds {
            let delta = (positions[to, default: 0] - equilibriumShifts[to, default: 0]) - (positions[from, default: 0] - equilibriumShifts[from, default: 0])
            spring[from, default: 0] += k * delta
            spring[to, default: 0] -= k * delta
        }
        return Dictionary(uniqueKeysWithValues: Self.nodeIDs.map { id in
            let force = spring[id, default: 0] + externalForces[id, default: 0] - (Self.damping[id] ?? 0) * velocities[id, default: 0] - 0.05 * (positions[id, default: 0] - equilibriumShifts[id, default: 0])
            return (id, force / (Self.masses[id] ?? 1))
        })
    }

    func step(_ dt: Double) {
        let acc1 = acceleration()
        for id in Self.nodeIDs {
            positions[id, default: 0] += velocities[id, default: 0] * dt + 0.5 * acc1[id, default: 0] * dt * dt
        }
        let acc2 = acceleration()
        for id in Self.nodeIDs {
            velocities[id, default: 0] += 0.5 * (acc1[id, default: 0] + acc2[id, default: 0]) * dt
            externalForces[id] = 0
        }
    }

    func macroIndex() -> Double {
        let weights: [String: Double] = ["P": 1, "B": 1, "I_R": 0.8, "N": 1.2, "V": 1, "R": 0.6]
        let sum = Self.nodeIDs.reduce(0.0) { $0 + (weights[$1] ?? 0) * (positions[$1] ?? 0) }
        let total = weights.values.reduce(0, +)
        return total == 0 ? 0 : sum / total
    }
}

private let amdOSOscillatorPresets: [AMDOSOscillatorPreset] = [
    .init(id: "blueled", label: "青色 LED 発見 (1993)", description: "Nの平衡を恒久シフト。発光ダイオード分野が新次元へ", target: "N", magnitude: 8, effect: .shift, year: 1993, month: 11),
    .init(id: "nakanishi", label: "中西先生 PMSQ 発見 (2007)", description: "Nの平衡を恒久シフト。透明モノリスエアロゲルの基盤論文", target: "N", magnitude: 6, effect: .shift, year: 2007, month: 1),
    .init(id: "lehman", label: "リーマンショック (2008)", description: "Vに大マイナスインパルス（一時的、回復に数年）", target: "V", magnitude: -10, effect: .impulse, year: 2008, month: 9),
    .init(id: "epbd", label: "EU EPBD recast (2010)", description: "Pを恒久シフト。建築物省エネ義務化の流れ", target: "P", magnitude: 4, effect: .shift, year: 2010, month: 5),
    .init(id: "earthquake", label: "東日本大震災 (2011)", description: "Pに一時的大インパルス", target: "P", magnitude: 10, effect: .impulse, year: 2011, month: 3),
    .init(id: "paris", label: "パリ協定 (2015)", description: "Pを恒久シフト。GX系の長期レジーム確立", target: "P", magnitude: 5, effect: .shift, year: 2015, month: 12),
    .init(id: "covid", label: "COVID-19 (2020)", description: "Rに大インパルス（流行）", target: "R", magnitude: 8, effect: .impulse, year: 2020, month: 3),
    .init(id: "covid_shift", label: "└ コロナ後 DX 常態化", description: "Rを恒久シフト（情報発信量の新常態）", target: "R", magnitude: 2, effect: .shift, year: 2020, month: 6),
    .init(id: "vc_boom", label: "VC ファンドブーム (2021)", description: "Vに大インパルス（一時的ピーク）", target: "V", magnitude: 8, effect: .impulse, year: 2021, month: 6),
    .init(id: "ira", label: "米 IRA 成立 (2022)", description: "Bを恒久シフト（海外モチベ予算の新レジーム）", target: "B", magnitude: 5, effect: .shift, year: 2022, month: 8),
    .init(id: "hormuz", label: "ホルムズ海峡封鎖 (仮想)", description: "Pに一時的大インパルス", target: "P", magnitude: 8, effect: .impulse, year: 2024, month: 6)
]

struct AMDOSVentureOscillatorNativeView: View {
    private static let startYear = 1990
    private static let stepsPerMonth = 20
    private static let defaultRangeMonths = 20 * 12
    @State private var rangeStart = AMDOSVentureOscillatorNativeView.monthIndex(year: 2007, month: 1)
    @State private var rangeEnd = AMDOSVentureOscillatorNativeView.monthIndex(year: 2027, month: 1)
    @State private var simTime = AMDOSVentureOscillatorNativeView.monthIndex(year: 2007, month: 1)
    @State private var appliedEvents: [AMDOSOscillatorEventInstance] = []
    @State private var positions = Dictionary(uniqueKeysWithValues: AMDOSCoupledOscillator.nodeIDs.map { ($0, 0.0) })
    @State private var macroIndex = 0.0

    var body: some View {
        AMDOSPageScaffold(eyebrow: "OSCILLATOR", title: "連成振動モデル", subtitle: "PWA CoupledOscillatorと同じ P / B / I_R / N / V / R、Velocity Verlet、年月スクラバー、外力・恒久シフト") {
            HStack(alignment: .top, spacing: 18) {
                VStack(alignment: .leading, spacing: 14) {
                    AMDOSSectionCard("\(monthLabel(simTime))", systemImage: "calendar.badge.clock") {
                        AMDOSCoupledOscillatorPlot(positions: positions)
                        Slider(value: Binding(get: { Double(simTime) }, set: { simTime = Int($0.rounded()); recompute() }), in: Double(rangeStart)...Double(rangeEnd), step: 1)
                        HStack {
                            Text(monthLabel(rangeStart)).font(.caption.monospaced())
                            Spacer()
                            Text("時間スクラバー（ドラッグして時刻を移動）").font(.caption).foregroundStyle(AMDOSDesign.muted)
                            Spacer()
                            Text(monthLabel(rangeEnd)).font(.caption.monospaced())
                        }
                        HStack {
                            Button("⏮ 開始") { simTime = rangeStart; recompute() }
                            Button("⏭ 終了") { simTime = rangeEnd; recompute() }
                            Spacer()
                            Text("M \(macroIndex, specifier: "%+.3f")").font(.headline.monospacedDigit()).foregroundStyle(macroIndex >= 0 ? AMDOSDesign.success : AMDOSDesign.warning)
                        }
                    }
                    if !appliedEvents.isEmpty {
                        AMDOSSectionCard("適用中イベント", systemImage: "bolt.fill") {
                            ForEach(appliedEvents.sorted { $0.timeMonths < $1.timeMonths }) { event in
                                HStack {
                                    Text(monthLabel(event.timeMonths)).font(.caption.monospaced())
                                    Text("\(event.preset.effect == .shift ? "🔀" : "⚡") \(event.preset.label)").font(.caption)
                                    Spacer()
                                }
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .topLeading)

                VStack(alignment: .leading, spacing: 12) {
                    AMDOSSectionCard("外力 E（イベント）", systemImage: "bolt.fill") {
                        Text("押すと該当年から20年の範囲にし、その範囲内の既存イベントを残して時系列で発火する。🔀=恒久シフト / ⚡=一時インパルス。")
                            .font(.caption).foregroundStyle(AMDOSDesign.muted)
                        ForEach(amdOSOscillatorPresets) { preset in
                            Button { apply(preset) } label: {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("\(preset.effect == .shift ? "🔀" : "⚡") \(preset.label)").font(.caption.weight(.semibold))
                                    Text("→ \(preset.target): \(preset.description)").font(.caption2).foregroundStyle(AMDOSDesign.muted)
                                }.frame(maxWidth: .infinity, alignment: .leading)
                            }
                            .buttonStyle(.plain)
                            .padding(7)
                            .background(preset.effect == .shift ? Color.purple.opacity(0.08) : AMDOSDesign.muted.opacity(0.06), in: RoundedRectangle(cornerRadius: 8))
                        }
                    }
                    Button("イベントをクリアして開始時刻に戻す") {
                        appliedEvents = []
                        simTime = rangeStart
                        recompute()
                    }
                    .buttonStyle(.bordered)
                }
                .frame(width: 330)
            }
        }
        .onAppear(perform: recompute)
    }

    private static func monthIndex(year: Int, month: Int) -> Int { (year - startYear) * 12 + (month - 1) }
    private func monthLabel(_ month: Int) -> String { "\(Self.startYear + month / 12)-\(String(format: "%02d", month % 12 + 1))" }

    private func apply(_ preset: AMDOSOscillatorPreset) {
        let eventTime = Self.monthIndex(year: preset.year, month: preset.month)
        let newEnd = eventTime + Self.defaultRangeMonths
        appliedEvents = appliedEvents.filter { $0.timeMonths >= eventTime && $0.timeMonths <= newEnd }
        appliedEvents.append(.init(id: UUID().uuidString, preset: preset, timeMonths: eventTime))
        rangeStart = eventTime
        rangeEnd = newEnd
        simTime = eventTime
        recompute()
    }

    private func recompute() {
        let oscillator = AMDOSCoupledOscillator()
        oscillator.reset()
        let targetSteps = max(0, (simTime - rangeStart) * Self.stepsPerMonth)
        let events = appliedEvents.compactMap { event -> (AMDOSOscillatorEventInstance, Int)? in
            let step = (event.timeMonths - rangeStart) * Self.stepsPerMonth
            return step >= 0 && step < targetSteps + Self.stepsPerMonth ? (event, step) : nil
        }.sorted { $0.1 < $1.1 }
        var cursor = 0
        for step in 0..<targetSteps {
            while cursor < events.count && events[cursor].1 == step {
                let event = events[cursor].0.preset
                if event.effect == .shift { oscillator.applyShift(target: event.target, magnitude: event.magnitude) }
                else { oscillator.applyImpulse(target: event.target, magnitude: event.magnitude) }
                cursor += 1
            }
            oscillator.step(1.0 / Double(Self.stepsPerMonth))
        }
        positions = oscillator.positions
        macroIndex = oscillator.macroIndex()
    }
}

private struct AMDOSCoupledOscillatorPlot: View {
    let positions: [String: Double]
    private let coordinate: [String: CGPoint] = [
        "P": .init(x: 0.50, y: 0.12), "B": .init(x: 0.87, y: 0.38), "V": .init(x: 0.73, y: 0.84),
        "R": .init(x: 0.27, y: 0.84), "I_R": .init(x: 0.13, y: 0.38), "N": .init(x: 0.50, y: 0.50)
    ]
    private let colors: [String: Color] = ["P": .blue, "B": .cyan, "I_R": .brown, "N": .red, "V": .green, "R": .orange]

    var body: some View {
        Canvas { context, size in
            func point(_ id: String) -> CGPoint {
                let anchor = coordinate[id] ?? .zero
                let displacement = min(max(positions[id] ?? 0, -8), 8)
                return .init(x: anchor.x * size.width, y: anchor.y * size.height - CGFloat(displacement / 16) * size.height * 0.48)
            }
            for (from, to, k) in AMDOSCoupledOscillator.bonds {
                var line = Path(); line.move(to: point(from)); line.addLine(to: point(to))
                context.stroke(line, with: .color(AMDOSDesign.border), lineWidth: CGFloat(0.8 + k * 0.45))
            }
            for id in AMDOSCoupledOscillator.nodeIDs {
                let p = point(id); let color = colors[id] ?? AMDOSDesign.blue; let radius: CGFloat = id == "N" ? 17 : 14
                context.fill(Path(ellipseIn: CGRect(x: p.x - radius, y: p.y - radius, width: radius * 2, height: radius * 2)), with: .color(color))
                context.draw(Text(id).font(.caption.weight(.bold)).foregroundColor(.white), at: p)
                context.draw(Text(String(format: "%+.2f", positions[id] ?? 0)).font(.caption2.monospacedDigit()).foregroundColor(AMDOSDesign.ink), at: .init(x: p.x, y: p.y + radius + 10))
            }
        }
        .frame(minHeight: 420)
        .background(AMDOSDesign.panel, in: RoundedRectangle(cornerRadius: 12))
    }
}

private struct AMDOSTripleHelixShock: Identifiable, Sendable {
    let id: String
    let emoji: String
    let label: String
    let description: String
    let input: [Double]
    let stateJump: [Double]?
}

private struct AMDOSTripleHelixScheduledShock: Identifiable, Sendable {
    let id: String
    var time: Int
    let shock: AMDOSTripleHelixShock
}

private struct AMDOSTripleHelixSimulation: Sendable {
    let states: [[Double]]
    let observations: [[Double]]
}

private let amdOSTripleHelixShocks: [AMDOSTripleHelixShock] = [
    .init(id: "ira", emoji: "🇺🇸", label: "IRA / 海外政策", description: "海外で大型政策 → 国内政府が反応 → 産業も追随", input: [2, 0, 0], stateJump: nil),
    .init(id: "earthquake", emoji: "🌊", label: "震災", description: "災害ショック → 政府が緊急予算、産業が再編", input: [0, 2, 0], stateJump: nil),
    .init(id: "hormuz", emoji: "⛽", label: "ホルムズ封鎖", description: "地政学ショック → エネルギー政策が動く", input: [0, 0, 2], stateJump: nil),
    .init(id: "breakthrough", emoji: "⚡", label: "ブレークスルー (中西 PMSQ 等)", description: "学アカデミアで突発的発明 → 学モメンタムにジャンプ", input: [0, 0, 0], stateJump: [1.8, 0, 0])
]

private enum AMDOSTripleHelixMath {
    static let steps = 240
    static let b = [[0.0, 0.05, 0.0], [0.1, 0.4, 0.2], [0.6, 0.5, 0.5]]
    static let c = [[0.05, 0.05, 0.95], [0.10, 0.05, 0.85], [0.10, 0.85, 0.10], [0.40, 0.35, 0.30], [0.70, 0.10, 0.40], [0.90, 0.05, 0.05]]
    static let q = [0.025, 0.03, 0.025]
    static let r = [0.05, 0.05, 0.06, 0.10, 0.05, 0.05]
    static let defaultA = [[0.92, -0.10, 0.20], [0.20, 0.92, -0.08], [-0.06, 0.18, 0.92]]

    static func multiply(_ matrix: [[Double]], _ vector: [Double]) -> [Double] {
        matrix.map { row in zip(row, vector).reduce(0) { $0 + $1.0 * $1.1 } }
    }

    static func simulate(a: [[Double]], shocks: [AMDOSTripleHelixScheduledShock]) -> AMDOSTripleHelixSimulation {
        var inputs = Array(repeating: Array(repeating: 0.0, count: 3), count: steps)
        var x0 = [0.0, 0.0, 0.0]
        for scheduled in shocks where scheduled.time >= 0 && scheduled.time < steps {
            for i in 0..<3 { inputs[scheduled.time][i] += scheduled.shock.input[i] }
            if scheduled.time == 0, let jump = scheduled.shock.stateJump { for i in 0..<3 { x0[i] += jump[i] } }
        }
        let lateJumps = shocks.filter { $0.time > 0 && $0.time < steps && $0.shock.stateJump != nil }
        var rng = AMDOSMulberry32(seed: 1234)
        func normal() -> Double { let u1 = max(rng.next(), 1e-12); let u2 = rng.next(); return sqrt(-2 * log(u1)) * cos(2 * .pi * u2) }
        var states = [x0]
        var observations: [[Double]] = [multiply(c, x0)]
        if lateJumps.isEmpty { observations[0] = zip(observations[0], r).map { $0.0 + $0.1 * normal() } }
        var x = x0
        for t in 0..<steps {
            let ax = multiply(a, x)
            let bu = multiply(b, inputs[t])
            var next = (0..<3).map { ax[$0] + bu[$0] + q[$0] * normal() }
            for scheduled in lateJumps where scheduled.time == t + 1 {
                guard let jump = scheduled.shock.stateJump else { continue }
                for i in 0..<3 { next[i] += jump[i] }
            }
            x = next
            states.append(x)
            var observed = multiply(c, x)
            for i in observed.indices { observed[i] += r[i] * normal() }
            observations.append(observed)
        }
        return .init(states: states, observations: observations)
    }

    static func eigen(_ a: [[Double]]) -> (values: [(Double, Double)], max: Double, stability: String, period: Double?, decay: Double?) {
        let a11 = a[0][0], a12 = a[0][1], a13 = a[0][2], a21 = a[1][0], a22 = a[1][1], a23 = a[1][2], a31 = a[2][0], a32 = a[2][1], a33 = a[2][2]
        let trace = a11 + a22 + a33
        let minors = (a11 * a22 - a12 * a21) + (a11 * a33 - a13 * a31) + (a22 * a33 - a23 * a32)
        let det = a11 * (a22 * a33 - a23 * a32) - a12 * (a21 * a33 - a23 * a31) + a13 * (a21 * a32 - a22 * a31)
        let b = -trace, c = minors, d = -det, shift = b / 3
        let p = c - b * b / 3
        let q = 2 * b * b * b / 27 - b * c / 3 + d
        let disc = -(4 * p * p * p + 27 * q * q)
        var values: [(Double, Double)] = []
        if abs(p) < 1e-12 && abs(q) < 1e-12 {
            values = Array(repeating: (-shift, 0), count: 3)
        } else if disc >= 0 {
            let radius = sqrt(-(p * p * p) / 27)
            let phi = acos(max(-1, min(1, -q / (2 * radius))))
            let magnitude = 2 * pow(radius, 1.0 / 3.0)
            for k in 0..<3 { values.append((magnitude * cos(phi / 3 + 2 * .pi * Double(k) / 3) - shift, 0)) }
        } else {
            let term = sqrt(q * q / 4 + p * p * p / 27)
            let u = signedCubeRoot(-q / 2 + term), v = signedCubeRoot(-q / 2 - term)
            values.append((u + v - shift, 0))
            values.append((-(u + v) / 2 - shift, (u - v) * sqrt(3) / 2))
            values.append((-(u + v) / 2 - shift, -(u - v) * sqrt(3) / 2))
        }
        let maxAbs = values.map { hypot($0.0, $0.1) }.max() ?? 0
        let stability = maxAbs < 0.999 ? "安定" : maxAbs > 1.001 ? "発散" : "境界"
        let complex = values.first { $0.1 > 0 }
        let period = complex.flatMap { atan2($0.1, $0.0) > 1e-9 ? 2 * .pi / atan2($0.1, $0.0) : nil }
        let decay = maxAbs > 0 && maxAbs < 1 ? -1 / log(maxAbs) : nil
        return (values, maxAbs, stability, period, decay)
    }
}

private struct AMDOSMulberry32 {
    private var value: UInt32
    init(seed: UInt32) { value = seed }
    mutating func next() -> Double {
        value &+= 0x6D2B79F5
        var t = value
        t = (t ^ (t >> 15)) &* (t | 1)
        t ^= t &+ ((t ^ (t >> 7)) &* (t | 61))
        return Double((t ^ (t >> 14))) / 4_294_967_296
    }
}

struct AMDOSVentureStateSpaceNativeView: View {
    @State private var a = AMDOSTripleHelixMath.defaultA
    @State private var shockTime = 120
    @State private var shocks: [AMDOSTripleHelixScheduledShock] = [.init(id: "initial-ira", time: 30, shock: amdOSTripleHelixShocks[0])]

    private var simulation: AMDOSTripleHelixSimulation { AMDOSTripleHelixMath.simulate(a: a, shocks: shocks) }
    private var sigma: [Double] { simulation.states.map { min($0[0], $0[1], $0[2]) } }
    private var goRanges: [(Int, Int)] {
        var ranges: [(Int, Int)] = []; var start: Int?
        for (index, value) in sigma.enumerated() {
            if value >= 0.4 { if start == nil { start = index } }
            else if start != nil { ranges.append((start!, index)); start = nil }
        }
        if let start { ranges.append((start, sigma.count - 1)) }
        return ranges
    }
    private var eigen: (values: [(Double, Double)], max: Double, stability: String, period: Double?, decay: Double?) { AMDOSTripleHelixMath.eigen(a) }

    var body: some View {
        AMDOSPageScaffold(eyebrow: "STATE SPACE", title: "Triple Helix 状態空間", subtitle: "PWA現行の n=3（学・産・官）/ m=6（P・B・V・R・I_R・N）/ p=3（海外政策・災害・地政学）を同じseedで再計算する") {
            HStack(alignment: .top, spacing: 10) {
                AMDOSTripleHelixSeriesPlot(series: stateSeries, colors: [.blue, .green, .red], labels: ["μ_A", "μ_I", "μ_G"], ranges: goRanges, title: "隠れ状態 μ_A / μ_I / μ_G")
                AMDOSTripleHelixSeriesPlot(series: [sigma], colors: [.green], labels: ["σ_SU = min(μ_A, μ_I, μ_G)"], ranges: goRanges, title: "立ち上げマクロシグナル θ=0.40", threshold: 0.4)
                AMDOSTripleHelixSeriesPlot(series: observationSeries, colors: [.red, .orange, .green, .brown, .cyan, .purple], labels: ["P", "B", "V", "R", "I_R", "N"], ranges: goRanges, title: "観測量 P / B / V / R / I_R / N")
            }
            HStack(alignment: .top, spacing: 16) {
                AMDOSTripleHelixTrajectoryPlot(states: simulation.states, sigma: sigma)
                AMDOSSectionCard("A 行列の固有値", systemImage: "circle.dashed") {
                    AMDOSTripleHelixEigenPlot(values: eigen.values, stability: eigen.stability)
                    ForEach(Array(eigen.values.enumerated()), id: \.offset) { index, value in
                        Text("λ\(index + 1)=\(value.0, specifier: "%.2f")\(value.1 == 0 ? "" : " \(value.1 >= 0 ? "+" : "−")\(abs(value.1), specifier: "%.2f")i")  |λ|=\(hypot(value.0, value.1), specifier: "%.2f")").font(.caption.monospacedDigit())
                    }
                    Text("\(eigen.stability) · max |λ| \(eigen.max, specifier: "%.3f")\(eigen.period.map { " · T≈\($0, specifier: "%.1f")" } ?? "")\(eigen.decay.map { " · τ≈\($0, specifier: "%.1f")" } ?? "")").font(.caption).foregroundStyle(eigen.stability == "安定" ? AMDOSDesign.success : AMDOSDesign.warning)
                }.frame(maxWidth: .infinity)
            }
            HStack(alignment: .top, spacing: 16) {
                AMDOSSectionCard("外生ショック（時刻指定）", systemImage: "bolt.fill") {
                    HStack { Text("時刻 t=\(shockTime)").font(.caption.monospaced()); Slider(value: Binding(get: { Double(shockTime) }, set: { shockTime = Int($0.rounded()) }), in: 0...Double(AMDOSTripleHelixMath.steps - 1), step: 1) }
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 130), spacing: 6)], alignment: .leading, spacing: 6) {
                        ForEach(amdOSTripleHelixShocks) { shock in Button("\(shock.emoji) \(shock.label)") { shocks.append(.init(id: UUID().uuidString, time: shockTime, shock: shock)) }.buttonStyle(.bordered) }
                    }
                    HStack { Button("Clear") { shocks = [] }; Button("Reset A") { a = AMDOSTripleHelixMath.defaultA } }
                    if shocks.isEmpty { Text("ショック未投入").font(.caption).foregroundStyle(AMDOSDesign.muted) }
                    ForEach($shocks) { $scheduled in
                        HStack {
                            Text("\(scheduled.shock.emoji) \(scheduled.shock.label)").font(.caption).lineLimit(1)
                            Slider(value: Binding(get: { Double(scheduled.time) }, set: { scheduled.time = Int($0.rounded()) }), in: 0...Double(AMDOSTripleHelixMath.steps - 1), step: 1)
                            Text("\(scheduled.time)").font(.caption.monospacedDigit())
                            Button("×") { shocks.removeAll { $0.id == scheduled.id } }.buttonStyle(.borderless)
                        }
                    }
                }.frame(maxWidth: .infinity)
                AMDOSSectionCard("A 行列（3×3）", systemImage: "square.grid.3x3") {
                    ForEach(0..<3, id: \.self) { i in
                        HStack {
                            Text(["μ_A", "μ_I", "μ_G"][i] + " →").frame(width: 46, alignment: .trailing).font(.caption)
                            ForEach(0..<3, id: \.self) { j in
                                VStack(spacing: 2) {
                                    Text("←\(["μ_A", "μ_I", "μ_G"][j])").font(.caption2).foregroundStyle(AMDOSDesign.muted)
                                    Slider(value: aBinding(i, j), in: i == j ? 0...1.1 : -0.5...0.5, step: 0.01)
                                    Text("\(a[i][j], specifier: "%.2f")").font(.caption2.monospacedDigit())
                                }
                            }
                        }
                    }
                }.frame(maxWidth: .infinity)
            }
        }
    }

    private var stateSeries: [[Double]] { (0..<3).map { axis in simulation.states.map { $0[axis] } } }
    private var observationSeries: [[Double]] { (0..<6).map { axis in simulation.observations.map { $0[axis] } } }
    private func aBinding(_ row: Int, _ column: Int) -> Binding<Double> { Binding(get: { a[row][column] }, set: { value in a[row][column] = value }) }
}

private func signedCubeRoot(_ value: Double) -> Double { value >= 0 ? pow(value, 1.0 / 3.0) : -pow(-value, 1.0 / 3.0) }

private struct AMDOSTripleHelixSeriesPlot: View {
    let series: [[Double]]; let colors: [Color]; let labels: [String]; let ranges: [(Int, Int)]; let title: String; var threshold: Double? = nil
    var body: some View {
        AMDOSSectionCard(title, systemImage: "chart.xyaxis.line") {
            Canvas { context, size in
                let left: CGFloat = 28, top: CGFloat = 18, bottom: CGFloat = 16
                let all = series.flatMap { $0 }; let maxAbs = max(0.5, all.map(abs).max() ?? 0.5) * 1.1
                let width = size.width - left - 6, height = size.height - top - bottom, mid = top + height / 2
                for (start, end) in ranges { let x1 = left + width * CGFloat(start) / CGFloat(max(1, (series.first?.count ?? 1) - 1)); let x2 = left + width * CGFloat(end) / CGFloat(max(1, (series.first?.count ?? 1) - 1)); context.fill(Path(CGRect(x: x1, y: top, width: x2 - x1, height: height)), with: .color(AMDOSDesign.success.opacity(0.15))) }
                var zero = Path(); zero.move(to: .init(x: left, y: mid)); zero.addLine(to: .init(x: size.width - 6, y: mid)); context.stroke(zero, with: .color(AMDOSDesign.border), lineWidth: 1)
                if let threshold { let y = mid - CGFloat(threshold / maxAbs) * height / 2; var path = Path(); path.move(to: .init(x: left, y: y)); path.addLine(to: .init(x: size.width - 6, y: y)); context.stroke(path, with: .color(AMDOSDesign.success), style: StrokeStyle(lineWidth: 1, dash: [4, 3])) }
                for (axis, values) in series.enumerated() where !values.isEmpty {
                    var path = Path(); for (index, value) in values.enumerated() { let x = left + width * CGFloat(index) / CGFloat(max(1, values.count - 1)); let y = mid - CGFloat(value / maxAbs) * height / 2; if index == 0 { path.move(to: .init(x: x, y: y)) } else { path.addLine(to: .init(x: x, y: y)) } }; context.stroke(path, with: .color(colors[axis]), lineWidth: axis == 0 && series.count == 1 ? 2.5 : 1.5)
                }
                var x: CGFloat = left + 2; for (index, label) in labels.enumerated() { context.draw(Text(label).font(.caption2).foregroundColor(colors[index]), at: .init(x: x, y: 8), anchor: .leading); x += CGFloat(label.count * 7 + 12) }
            }.frame(height: 130)
        }.frame(maxWidth: .infinity)
    }
}

private struct AMDOSTripleHelixTrajectoryPlot: View {
    let states: [[Double]]; let sigma: [Double]
    var body: some View {
        AMDOSSectionCard("状態軌道（μ_A × μ_I。色=σ_SU）", systemImage: "point.3.connected.trianglepath.dotted") {
            Canvas { context, size in
                let extent = max(1.0, states.flatMap { $0 }.map(abs).max() ?? 1) * 1.15
                func point(_ state: [Double]) -> CGPoint { .init(x: size.width / 2 + CGFloat(state[0] / extent) * size.width * 0.43, y: size.height / 2 - CGFloat(state[1] / extent) * size.height * 0.43) }
                var axis = Path(); axis.move(to: .init(x: 0, y: size.height / 2)); axis.addLine(to: .init(x: size.width, y: size.height / 2)); axis.move(to: .init(x: size.width / 2, y: 0)); axis.addLine(to: .init(x: size.width / 2, y: size.height)); context.stroke(axis, with: .color(AMDOSDesign.border), lineWidth: 1)
                for index in 0..<max(0, states.count - 1) { var path = Path(); path.move(to: point(states[index])); path.addLine(to: point(states[index + 1])); context.stroke(path, with: .color(sigma[index] >= 0.4 ? AMDOSDesign.success : AMDOSDesign.muted.opacity(0.65)), lineWidth: 1.4) }
                if let current = states.last { let p = point(current); context.fill(Path(ellipseIn: CGRect(x: p.x - 5, y: p.y - 5, width: 10, height: 10)), with: .color(AMDOSDesign.blue)) }
            }.frame(height: 250)
        }.frame(maxWidth: .infinity)
    }
}

private struct AMDOSTripleHelixEigenPlot: View {
    let values: [(Double, Double)]; let stability: String
    var body: some View {
        Canvas { context, size in
            let center = CGPoint(x: size.width / 2, y: size.height / 2); let radius = min(size.width, size.height) / 2 - 18
            var axes = Path(); axes.move(to: .init(x: 0, y: center.y)); axes.addLine(to: .init(x: size.width, y: center.y)); axes.move(to: .init(x: center.x, y: 0)); axes.addLine(to: .init(x: center.x, y: size.height)); context.stroke(axes, with: .color(AMDOSDesign.border), lineWidth: 1)
            context.stroke(Path(ellipseIn: CGRect(x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2)), with: .color(stability == "安定" ? AMDOSDesign.success : AMDOSDesign.warning), style: StrokeStyle(lineWidth: 1.5, dash: [4, 4]))
            for value in values { let point = CGPoint(x: center.x + CGFloat(value.0) * radius, y: center.y - CGFloat(value.1) * radius); context.fill(Path(ellipseIn: CGRect(x: point.x - 5, y: point.y - 5, width: 10, height: 10)), with: .color(value.1 == 0 ? AMDOSDesign.blue : .purple)) }
        }.frame(height: 170)
    }
}

struct AMDOSVentureSUNativeView: View {
    let ventureID: String?
    let onBack: () -> Void
    @StateObject private var store = AMDOSNativeVentureStore()
    var body: some View {
        AMDOSPageScaffold(eyebrow: "SU DETAIL", title: "SU詳細", subtitle: "PWA SuDetailViewのventure概要、XRL 5層、レーン別マクロ指数を同時に読む") {
            AMDOSStateNotice(state: store.state) { Task { await store.load() } }
            if ventureID == nil { AMDOSNativeProjectPicker(store: store) }
            if let project = store.project(store.selectedId), let venture = store.venture(store.selectedId) {
                AMDOSSectionCard(project.name, systemImage: "building.2") {
                    HStack { Text(ventureOutcome(venture.outcomePattern).emoji).font(.title2); Text(ventureOutcome(venture.outcomePattern).label).font(.caption).foregroundStyle(ventureOutcome(venture.outcomePattern).color); Spacer(); Button("← Venture Map") { onBack() }.buttonStyle(.borderless) }
                    Text([venture.lane.map(ventureLaneLabel), venture.originOrg, venture.originPi, venture.foundedAt.map { "設立 \($0.prefix(7))" }, project.status].compactMap { $0 }.joined(separator: " · ")).font(.caption).foregroundStyle(AMDOSDesign.muted)
                    if let description = venture.shortDescription?.trimmedNonEmpty { Text(description) }
                }
                AMDOSSectionCard("XRL 進捗 × マクロ指数", systemImage: "chart.xyaxis.line") {
                    AMDOSVentureDetailPlot(xrl: store.xrl.filter { $0.projectId == project.id }, macro: store.macro.filter { $0.lane == venture.lane }, foundedAt: venture.foundedAt)
                    Text("左軸=XRLレベル (1–9) / 右軸=マクロ指数 (0–1)。TRL / BRL / HRLと、同じレーンのマクロ指数を重ねる。").font(.caption).foregroundStyle(AMDOSDesign.muted)
                }
                AMDOSSectionCard("マイルストーン年表", systemImage: "list.bullet.rectangle") {
                    let rows = store.xrl.filter { $0.projectId == project.id }
                    if rows.isEmpty { Text("XRLデータがありません").foregroundStyle(AMDOSDesign.muted) }
                    ForEach(rows) { row in AMDOSLineItem(title: row.observedAt, subtitle: "TRL \(row.trl.map { String(format: "%.0f", $0) } ?? "—") · BRL \(row.brl.map { String(format: "%.0f", $0) } ?? "—") · HRL \(row.hrl.map { String(format: "%.0f", $0) } ?? "—") · \(row.milestoneLabel ?? "")", status: row.bottleneck ?? "—") }
                }
            }
        }.task(id: ventureID) { await store.load(ventureID: ventureID) }
    }
}

private func ventureLaneLabel(_ lane: String) -> String {
    ["gx_energy": "GX / エネルギー", "gx_circular": "GX / サーキュラー", "materials": "素材 / ナノマテリアル", "life": "ライフ / 医療", "robo": "ロボ / 農・モビリティ"][lane] ?? lane
}

private func ventureOutcome(_ pattern: String?) -> (emoji: String, label: String, color: Color) {
    switch pattern {
    case "rocket": return ("🚀", "離陸中", Color(red: 0.055, green: 0.647, blue: 0.914))
    case "lifted": return ("✈️", "離陸完了（AMD関与継続）", .green)
    case "deep_pivot": return ("🔄", "後付けdeep化", .purple)
    case "burnout": return ("🔥", "燃え尽き（XRL不足）", .red)
    case "ue_fail": return ("💀", "UE失敗", AMDOSDesign.muted)
    default: return ("•", pattern?.trimmedNonEmpty ?? "未分類", AMDOSDesign.muted)
    }
}

private struct AMDOSVentureDetailPlot: View {
    let xrl: [AMDOSVentureXRLLog]
    let macro: [AMDOSMacroIndexLog]
    let foundedAt: String?

    var body: some View {
        Canvas { context, size in
            let rows = xrl.sorted { $0.observedAt < $1.observedAt }
            let founded = foundedAt.map(decimalYear)
            let defaultYear = Double(Calendar.current.component(.year, from: .now))
            let base = founded ?? rows.first.map { decimalYear($0.observedAt) } ?? defaultYear
            let minimum = max(2009, floor(base) - 2)
            let maximum = minimum + max(8, ceil(base) - minimum + 6)
            let left: CGFloat = 42, right: CGFloat = 40, top: CGFloat = 20, bottom: CGFloat = 26
            let width = max(1, size.width - left - right), height = max(1, size.height - top - bottom)
            func x(_ year: Double) -> CGFloat { left + CGFloat((year - minimum) / max(1, maximum - minimum)) * width }
            func yXRL(_ value: Double) -> CGFloat { top + height * (1 - CGFloat(value / 9)) }
            func yMacro(_ value: Double) -> CGFloat { top + height * (1 - CGFloat(value)) }
            for level in 1...9 { let y = yXRL(Double(level)); var path = Path(); path.move(to: .init(x: left, y: y)); path.addLine(to: .init(x: size.width - right, y: y)); context.stroke(path, with: .color(AMDOSDesign.border.opacity(0.5)), lineWidth: 0.6); context.draw(Text("\(level)").font(.caption2).foregroundColor(AMDOSDesign.muted), at: .init(x: left - 8, y: y), anchor: .trailing) }
            for year in Int(minimum)...Int(maximum) { context.draw(Text("\(year)").font(.caption2).foregroundColor(AMDOSDesign.muted), at: .init(x: x(Double(year)), y: size.height - 9)) }
            if let founded { var path = Path(); path.move(to: .init(x: x(founded), y: top)); path.addLine(to: .init(x: x(founded), y: top + height)); context.stroke(path, with: .color(AMDOSDesign.warning), style: StrokeStyle(lineWidth: 1.5, dash: [4, 2])) }
            let macroPoints = macro.sorted { $0.observedAt < $1.observedAt }.map { (x(decimalYear($0.observedAt)), yMacro($0.indexValue)) }
            draw(&context, points: macroPoints, color: .gray, dash: [5, 3], width: 1.5)
            drawAxis(&context, rows: rows, value: \.trl, color: AMDOSDesign.blue, x: x, y: yXRL)
            drawAxis(&context, rows: rows, value: \.brl, color: AMDOSDesign.warning, x: x, y: yXRL)
            drawAxis(&context, rows: rows, value: \.hrl, color: AMDOSDesign.success, x: x, y: yXRL)
        }
        .frame(minHeight: 300)
        .background(AMDOSDesign.panel, in: RoundedRectangle(cornerRadius: 12))
    }

    private func decimalYear(_ iso: String) -> Double {
        let parts = iso.split(separator: "-")
        guard let year = Double(parts.first ?? ""), parts.count > 1, let month = Double(parts[1]) else { return 2020 }
        return year + (month - 1) / 12
    }

    private func draw(_ context: inout GraphicsContext, points: [(CGFloat, CGFloat)], color: Color, dash: [CGFloat], width: CGFloat) {
        guard points.count > 1 else { return }
        var path = Path(); for (index, point) in points.enumerated() { if index == 0 { path.move(to: .init(x: point.0, y: point.1)) } else { path.addLine(to: .init(x: point.0, y: point.1)) } }
        context.stroke(path, with: .color(color), style: StrokeStyle(lineWidth: width, lineCap: .round, lineJoin: .round, dash: dash))
    }

    private func drawAxis(_ context: inout GraphicsContext, rows: [AMDOSVentureXRLLog], value: KeyPath<AMDOSVentureXRLLog, Double?>, color: Color, x: (Double) -> CGFloat, y: (Double) -> CGFloat) {
        let points = rows.compactMap { row -> (CGFloat, CGFloat)? in guard let value = row[keyPath: value] else { return nil }; return (x(decimalYear(row.observedAt)), y(value)) }
        draw(&context, points: points, color: color, dash: [], width: 2.2)
        for point in points { context.fill(Path(ellipseIn: CGRect(x: point.0 - 4, y: point.1 - 4, width: 8, height: 8)), with: .color(color)) }
    }
}

struct AMDOSVentureTimelineNativeView: View {
    let onOpenVenture: (String) -> Void
    @StateObject private var store = AMDOSNativeVentureStore()
    @State private var selectedVentureID: String?
    @State private var projection = "3D"
    @State private var camera = AMDOSNativeOrbitCamera.timelinePreset("3D")
    var body: some View {
        AMDOSPageScaffold(eyebrow: "TIMELINE 3D", title: "Timeline 3D", subtitle: "PWAと同じ公開SU × XRL 5層（TRL / BRL / HRL / GRL / SRL）の積層時系列。選ぶとSU詳細を開ける") {
            AMDOSStateNotice(state: store.state) { Task { await store.load() } }
            HStack {
                Picker("視点", selection: $projection) { Text("T × SCORE").tag("T × SCORE"); Text("3D").tag("3D"); Text("SU × SCORE").tag("SU × SCORE"); Text("T × SU").tag("T × SU") }.pickerStyle(.segmented)
                Button("視点を戻す") { camera = .timelinePreset(projection) }.buttonStyle(.bordered)
            }
            AMDOSVentureTimelineStackedPlot(
                ventures: store.ventures,
                projects: store.projects,
                xrl: store.xrl,
                selectedID: $selectedVentureID,
                projection: projection,
                camera: $camera,
                onSelectPreset: { projection = $0 }
            )
            if let selectedVentureID, let venture = store.ventures.first(where: { $0.id == selectedVentureID }) {
                let project = store.projects.first { $0.id == venture.id }
                let rows = store.xrl.filter { $0.projectId == venture.id }
                AMDOSSectionCard(project?.name ?? venture.shortLabel ?? venture.id, systemImage: "scope") {
                    HStack { Text([venture.lane.map(ventureLaneLabel), venture.foundedAt, venture.outcomePattern].compactMap { $0 }.joined(separator: " · ")).font(.caption); Spacer(); Button("SU詳細を開く") { onOpenVenture(venture.id) }.buttonStyle(.bordered) }
                    if rows.isEmpty { Text("XRLログなし").foregroundStyle(AMDOSDesign.muted) }
                    ForEach(rows.suffix(12)) { row in AMDOSLineItem(title: row.observedAt, subtitle: "TRL \(row.trl.map { String(format: "%.0f", $0) } ?? "—") · BRL \(row.brl.map { String(format: "%.0f", $0) } ?? "—") · GRL \(row.grl.map { String(format: "%.0f", $0) } ?? "—") · SRL \(row.srl.map { String(format: "%.0f", $0) } ?? "—") · HRL \(row.hrl.map { String(format: "%.0f", $0) } ?? "—")", status: row.bottleneck ?? "—") }
                }
            }
        }.task { await store.load() }
            .onChange(of: projection) { _, next in camera = .timelinePreset(next) }
    }
}

private struct AMDOSVentureTimelineStackedPlot: View {
    let ventures: [AMDOSVentureRecord]
    let projects: [AMDOSNativeVentureProject]
    let xrl: [AMDOSVentureXRLLog]
    @Binding var selectedID: String?
    let projection: String
    @Binding var camera: AMDOSNativeOrbitCamera
    let onSelectPreset: (String) -> Void
    @State private var dragStartCamera: AMDOSNativeOrbitCamera?
    @State private var magnifyStartZoom: CGFloat?
    private let keys: [(String, KeyPath<AMDOSVentureXRLLog, Double?>, Color)] = [("trl", \.trl, .cyan), ("brl", \.brl, .orange), ("hrl", \.hrl, .green), ("grl", \.grl, .purple), ("srl", \.srl, .pink)]

    var body: some View {
        GeometryReader { proxy in
            Canvas { context, size in
                let data = renderData
                let dates = data.flatMap { pair in
                    pair.rows.map { timelineDate($0.observedAt) } + (pair.venture.foundedAt.map { [timelineDate($0)] } ?? [])
                }
                guard let minDate = dates.min(), let rawMaxDate = dates.max() else { return }
                let maxDate = max(rawMaxDate, minDate.addingTimeInterval(365 * 24 * 60 * 60))
                let span = max(1, maxDate.timeIntervalSince(minDate))
                let scale = max(1, min(size.width, size.height) * 0.68)
                let center = SIMD3<Double>(repeating: 0.5)
                func time(_ date: Date) -> Double { min(1, max(0, date.timeIntervalSince(minDate) / span)) }
                drawWireCube(&context, size: size, center: center, scale: scale)
                for (index, pair) in data.enumerated() {
                    let depth = data.count == 1 ? 0.5 : Double(index) / Double(data.count - 1)
                    let selected = selectedID == pair.venture.id
                    let label = pair.venture.shortLabel ?? projects.first(where: { $0.id == pair.venture.id })?.name ?? pair.venture.id
                    let labelPoint = camera.project(.init(0, 0, depth), around: center, in: size, scale: scale)
                    context.draw(Text(label.uppercased()).font(.caption2.weight(selected ? .bold : .regular)).foregroundColor(selected ? AMDOSDesign.ink : AMDOSDesign.muted), at: .init(x: labelPoint.x - 8, y: labelPoint.y), anchor: .trailing)
                    var cumulative = Array(repeating: 0.0, count: pair.rows.count)
                    for (_, key, color) in keys {
                        let upper = pair.rows.enumerated().map { index, row -> CGPoint in
                            cumulative[index] += min(5, max(0, row[keyPath: key] ?? 0))
                            return camera.project(.init(time(timelineDate(row.observedAt)), cumulative[index] / 25, depth), around: center, in: size, scale: scale)
                        }
                        let lower = pair.rows.enumerated().map { index, row -> CGPoint in
                            let lowerValue = cumulative[index] - min(5, max(0, row[keyPath: key] ?? 0))
                            return camera.project(.init(time(timelineDate(row.observedAt)), lowerValue / 25, depth), around: center, in: size, scale: scale)
                        }
                        guard let first = lower.first else { continue }
                        var area = Path(); area.move(to: first); for point in lower.dropFirst() { area.addLine(to: point) }; for point in upper.reversed() { area.addLine(to: point) }; area.closeSubpath(); context.fill(area, with: .color(color.opacity(selected ? 0.88 : 0.62)))
                    }
                    for row in pair.rows where row.milestoneLabel?.trimmedNonEmpty != nil {
                        let total = keys.reduce(0.0) { $0 + min(5, max(0, row[keyPath: $1.1] ?? 0)) }
                        let point = camera.project(.init(time(timelineDate(row.observedAt)), total / 25, depth), around: center, in: size, scale: scale)
                        context.fill(Path(ellipseIn: CGRect(x: point.x - 3, y: point.y - 3, width: 6, height: 6)), with: .color(AMDOSDesign.warning))
                    }
                }
                context.draw(Text("T / SCORE / SU · DRAG rotate · ⌥ DRAG pan · SCROLL zoom").font(.caption2.monospaced()).foregroundColor(AMDOSDesign.muted), at: .init(x: 12, y: 12), anchor: .leading)
                context.draw(Text(projection).font(.caption2.monospaced()).foregroundColor(AMDOSDesign.muted), at: .init(x: size.width - 12, y: 12), anchor: .trailing)
            }
            .contentShape(Rectangle())
            .gesture(SpatialTapGesture().onEnded { tap in
                let data = renderData
                guard !data.isEmpty else { return }
                let center = SIMD3<Double>(repeating: 0.5)
                let scale = max(1, min(proxy.size.width, proxy.size.height) * 0.68)
                let nearest = data.enumerated().min { left, right in
                    let lDepth = data.count == 1 ? 0.5 : Double(left.offset) / Double(data.count - 1)
                    let rDepth = data.count == 1 ? 0.5 : Double(right.offset) / Double(data.count - 1)
                    let l = camera.project(.init(0.5, 0.5, lDepth), around: center, in: proxy.size, scale: scale)
                    let r = camera.project(.init(0.5, 0.5, rDepth), around: center, in: proxy.size, scale: scale)
                    return hypot(l.x - tap.location.x, l.y - tap.location.y) < hypot(r.x - tap.location.x, r.y - tap.location.y)
                }
                selectedID = nearest?.element.venture.id
            })
            .simultaneousGesture(orbitDrag)
            .simultaneousGesture(orbitMagnify)
            .background(AMDOSNativeCanvasScrollZoomCapture { camera.adjustZoom($0) }.allowsHitTesting(false))
            .overlay(alignment: .topTrailing) {
                AMDOSNativeTimelineAxisGizmo(activePreset: projection, onSelect: onSelectPreset)
                    .padding(12)
            }
        }
        .frame(minHeight: 440)
        .background(AMDOSDesign.panel, in: RoundedRectangle(cornerRadius: 14))
    }

    private var renderData: [(venture: AMDOSVentureRecord, rows: [AMDOSVentureXRLLog])] {
        ventures.compactMap { venture in
            let rows = xrl.filter { $0.projectId == venture.id }.sorted { $0.observedAt < $1.observedAt }
            return rows.count >= 2 ? (venture, rows) : nil
        }
    }

    private var orbitDrag: some Gesture {
        DragGesture(minimumDistance: 2).onChanged { value in
            if dragStartCamera == nil { dragStartCamera = camera }
            guard var next = dragStartCamera else { return }
            if NSEvent.modifierFlags.contains(.option) { next.pan(with: value.translation) }
            else { next.rotate(with: value.translation) }
            camera = next
        }.onEnded { _ in dragStartCamera = nil }
    }

    private var orbitMagnify: some Gesture {
        MagnifyGesture().onChanged { value in
            if magnifyStartZoom == nil { magnifyStartZoom = camera.zoom }
            var next = camera
            next.zoom = min(4.5, max(0.38, (magnifyStartZoom ?? 1) * (1 + value.magnification)))
            camera = next
        }.onEnded { _ in magnifyStartZoom = nil }
    }

    private func drawWireCube(_ context: inout GraphicsContext, size: CGSize, center: SIMD3<Double>, scale: CGFloat) {
        let vertices: [SIMD3<Double>] = [
            .init(0, 0, 0), .init(1, 0, 0), .init(1, 1, 0), .init(0, 1, 0),
            .init(0, 0, 1), .init(1, 0, 1), .init(1, 1, 1), .init(0, 1, 1)
        ]
        let edges = [(0, 1), (1, 2), (2, 3), (3, 0), (4, 5), (5, 6), (6, 7), (7, 4), (0, 4), (1, 5), (2, 6), (3, 7)]
        for (a, b) in edges {
            var line = Path()
            line.move(to: camera.project(vertices[a], around: center, in: size, scale: scale))
            line.addLine(to: camera.project(vertices[b], around: center, in: size, scale: scale))
            context.stroke(line, with: .color(AMDOSDesign.border.opacity(0.65)), lineWidth: 0.8)
        }
    }

    private func timelineDate(_ iso: String) -> Date {
        if let date = ISO8601DateFormatter().date(from: iso) { return date }
        let parts = iso.split(separator: "-").compactMap { Int($0) }
        guard parts.count >= 3 else { return .distantPast }
        return Calendar(identifier: .gregorian).date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2])) ?? .distantPast
    }
}

// MARK: - Venture Map parity

private struct AMDOSParityVentureLaneWeight: Codable, Sendable {
    let domain: String
    let weight: Double
}

private struct AMDOSParityVenture: Codable, Identifiable, Sendable {
    let projectId: String
    let shortLabel: String?
    let lane: String
    let lanes: [AMDOSParityVentureLaneWeight]?
    let foundedAt: String?
    let outcomePattern: String
    let originOrg: String?
    let originPi: String?
    let amdRole: String?
    let shortDescription: String?
    let isPublic: Bool
    let supportStartedAt: String?
    let supportEndedAt: String?

    var id: String { projectId }

    enum CodingKeys: String, CodingKey {
        case projectId = "project_id"
        case shortLabel = "short_label"
        case lane, lanes
        case foundedAt = "founded_at"
        case outcomePattern = "outcome_pattern"
        case originOrg = "origin_org"
        case originPi = "origin_pi"
        case amdRole = "amd_role"
        case shortDescription = "short_description"
        case isPublic = "is_public"
        case supportStartedAt = "amd_support_started_at"
        case supportEndedAt = "amd_support_ended_at"
    }
}

private struct AMDOSParityVentureProject: Codable, Identifiable, Sendable {
    let projectId: String
    let name: String?
    let status: String?

    var id: String { projectId }

    enum CodingKeys: String, CodingKey {
        case projectId = "project_id"
        case name = "project_name"
        case status
    }
}

private struct AMDOSParityVentureLaneWeightRow: Codable, Identifiable, Sendable {
    let lane: String
    let alpha: Double
    let beta: Double
    let gamma: Double
    let delta: Double
    let lambda: Double?
    let eta: Double?
    let computedAt: String
    let computedBy: String?

    var id: String { "\(lane)-\(computedAt)" }

    enum CodingKeys: String, CodingKey {
        case lane, alpha, beta, gamma, delta, lambda, eta
        case computedAt = "computed_at"
        case computedBy = "computed_by"
    }
}

private struct AMDOSParityVentureMacroRow: Codable, Identifiable, Sendable {
    let lane: String
    let observedAt: String
    let indexValue: Double
    let policyDensity: Double?
    let rawSignalCount: Int?

    var id: String { "\(lane)-\(observedAt)" }

    enum CodingKeys: String, CodingKey {
        case lane
        case observedAt = "observed_at"
        case indexValue = "index_value"
        case policyDensity = "policy_density"
        case rawSignalCount = "raw_signal_count"
    }
}

private struct AMDOSParityVenturePaperRow: Codable, Identifiable, Sendable {
    let lane: String
    let observedAt: String
    let paperCount: Int
    let source: String

    var id: String { "\(lane)-\(observedAt)-\(source)" }

    enum CodingKeys: String, CodingKey {
        case lane
        case observedAt = "observed_at"
        case paperCount = "paper_count"
        case source
    }
}

private struct AMDOSParityVentureMapLane: Identifiable, Sendable {
    let id: String
    let label: String
    let color: Color
}

private let amdOSParityVentureMapLanes = [
    AMDOSParityVentureMapLane(id: "gx_energy", label: "GX / エネルギー", color: Color(red: 22 / 255, green: 163 / 255, blue: 74 / 255)),
    AMDOSParityVentureMapLane(id: "gx_circular", label: "GX / サーキュラー", color: Color(red: 8 / 255, green: 145 / 255, blue: 178 / 255)),
    AMDOSParityVentureMapLane(id: "materials", label: "素材 / ナノマテリアル", color: Color(red: 161 / 255, green: 98 / 255, blue: 7 / 255)),
    AMDOSParityVentureMapLane(id: "life", label: "ライフ / 医療", color: Color(red: 190 / 255, green: 24 / 255, blue: 93 / 255)),
    AMDOSParityVentureMapLane(id: "robo", label: "ロボ / 農・モビリティ", color: Color(red: 124 / 255, green: 58 / 255, blue: 237 / 255))
]

private struct AMDOSParityVentureYearPoint: Sendable {
    let year: Int
    var macro: Double
    var papers: Double
}

private let amdOSParityVentureFallbackSeries: [String: [AMDOSParityVentureYearPoint]] = [
    "gx_energy": [
        .init(year: 2010, macro: 0.10, papers: 0.20), .init(year: 2012, macro: 0.12, papers: 0.25), .init(year: 2014, macro: 0.18, papers: 0.30), .init(year: 2016, macro: 0.25, papers: 0.38), .init(year: 2018, macro: 0.28, papers: 0.45), .init(year: 2020, macro: 0.42, papers: 0.55), .init(year: 2022, macro: 0.58, papers: 0.62), .init(year: 2023, macro: 0.66, papers: 0.66), .init(year: 2024, macro: 0.74, papers: 0.71), .init(year: 2025, macro: 0.80, papers: 0.74), .init(year: 2026, macro: 0.84, papers: 0.78)
    ],
    "gx_circular": [
        .init(year: 2010, macro: 0.05, papers: 0.10), .init(year: 2012, macro: 0.07, papers: 0.13), .init(year: 2014, macro: 0.10, papers: 0.18), .init(year: 2016, macro: 0.13, papers: 0.25), .init(year: 2018, macro: 0.20, papers: 0.32), .init(year: 2020, macro: 0.28, papers: 0.42), .init(year: 2022, macro: 0.45, papers: 0.55), .init(year: 2023, macro: 0.62, papers: 0.62), .init(year: 2024, macro: 0.78, papers: 0.66), .init(year: 2025, macro: 0.86, papers: 0.70), .init(year: 2026, macro: 0.92, papers: 0.72)
    ],
    "materials": [
        .init(year: 2010, macro: 0.18, papers: 0.40), .init(year: 2012, macro: 0.20, papers: 0.45), .init(year: 2014, macro: 0.22, papers: 0.50), .init(year: 2016, macro: 0.20, papers: 0.55), .init(year: 2018, macro: 0.18, papers: 0.58), .init(year: 2020, macro: 0.20, papers: 0.60), .init(year: 2022, macro: 0.25, papers: 0.62), .init(year: 2023, macro: 0.30, papers: 0.65), .init(year: 2024, macro: 0.40, papers: 0.66), .init(year: 2025, macro: 0.48, papers: 0.68), .init(year: 2026, macro: 0.55, papers: 0.70)
    ],
    "life": [
        .init(year: 2010, macro: 0.30, papers: 0.50), .init(year: 2012, macro: 0.32, papers: 0.52), .init(year: 2014, macro: 0.34, papers: 0.55), .init(year: 2016, macro: 0.36, papers: 0.58), .init(year: 2018, macro: 0.40, papers: 0.62), .init(year: 2020, macro: 0.48, papers: 0.66), .init(year: 2022, macro: 0.55, papers: 0.70), .init(year: 2023, macro: 0.58, papers: 0.74), .init(year: 2024, macro: 0.62, papers: 0.76), .init(year: 2025, macro: 0.66, papers: 0.78), .init(year: 2026, macro: 0.70, papers: 0.80)
    ],
    "robo": [
        .init(year: 2010, macro: 0.15, papers: 0.20), .init(year: 2012, macro: 0.18, papers: 0.22), .init(year: 2014, macro: 0.20, papers: 0.25), .init(year: 2016, macro: 0.25, papers: 0.30), .init(year: 2018, macro: 0.30, papers: 0.35), .init(year: 2020, macro: 0.40, papers: 0.40), .init(year: 2022, macro: 0.50, papers: 0.45), .init(year: 2023, macro: 0.55, papers: 0.48), .init(year: 2024, macro: 0.60, papers: 0.50), .init(year: 2025, macro: 0.66, papers: 0.52), .init(year: 2026, macro: 0.70, papers: 0.54)
    ]
]

private struct AMDOSParityVenturePolicyEvent: Sendable {
    let year: Double
    let label: String
    let appliesToAll: Bool
}

private let amdOSParityVenturePolicyEvents = [
    AMDOSParityVenturePolicyEvent(year: 2014, label: "ZEH/ZEB政策本格化", appliesToAll: false),
    AMDOSParityVenturePolicyEvent(year: 2016, label: "パリ協定発効", appliesToAll: true),
    AMDOSParityVenturePolicyEvent(year: 2020.83, label: "菅CN宣言", appliesToAll: true),
    AMDOSParityVenturePolicyEvent(year: 2022.7, label: "GX実行会議", appliesToAll: true),
    AMDOSParityVenturePolicyEvent(year: 2023.5, label: "GX推進法", appliesToAll: true),
    AMDOSParityVenturePolicyEvent(year: 2024, label: "EU CBAM段階導入", appliesToAll: false),
    AMDOSParityVenturePolicyEvent(year: 2025, label: "AMED 認知症重点", appliesToAll: false),
    AMDOSParityVenturePolicyEvent(year: 2026, label: "GX-ETS本格化", appliesToAll: true)
]

@MainActor
private final class AMDOSParityVentureMapStore: ObservableObject {
    @Published var ventures: [AMDOSParityVenture] = []
    @Published var projects: [AMDOSParityVentureProject] = []
    @Published var laneWeights: [AMDOSParityVentureLaneWeightRow] = []
    @Published var macroLog: [AMDOSParityVentureMacroRow] = []
    @Published var papersLog: [AMDOSParityVenturePaperRow] = []
    @Published var state: AMDOSFeatureLoadState = .idle

    func load() async {
        state = .loading
        do {
            async let ventures = AMDOSRESTClient.shared.fetchTable(
                AMDOSParityVenture.self,
                table: "project_ventures",
                select: "project_id,short_label,lane,lanes,founded_at,outcome_pattern,origin_org,origin_pi,amd_role,short_description,is_public,amd_support_started_at,amd_support_ended_at",
                filters: ["is_public": "eq.true"],
                order: "founded_at",
                limit: 500
            )
            async let projects = AMDOSRESTClient.shared.fetchTable(
                AMDOSParityVentureProject.self,
                table: "projects",
                select: "project_id,project_name,status",
                order: "project_name",
                limit: 500
            )
            async let weights = AMDOSRESTClient.shared.fetchTable(
                AMDOSParityVentureLaneWeightRow.self,
                table: "macro_lane_weights",
                select: "lane,alpha,beta,gamma,delta,lambda,eta,computed_at,computed_by",
                order: "computed_at.desc",
                limit: 500
            )
            async let macro = AMDOSRESTClient.shared.fetchTable(
                AMDOSParityVentureMacroRow.self,
                table: "macro_index_log",
                select: "lane,observed_at,index_value,policy_density,raw_signal_count",
                order: "observed_at",
                limit: 5_000
            )
            async let papers = AMDOSRESTClient.shared.fetchTable(
                AMDOSParityVenturePaperRow.self,
                table: "papers_log",
                select: "lane,observed_at,paper_count,source",
                order: "observed_at",
                limit: 5_000
            )
            self.ventures = try await ventures
            self.projects = try await projects
            let allWeights = try await weights
            var latestByLane: [String: AMDOSParityVentureLaneWeightRow] = [:]
            for row in allWeights where latestByLane[row.lane] == nil {
                latestByLane[row.lane] = row
            }
            self.laneWeights = amdOSParityVentureMapLanes.compactMap { latestByLane[$0.id] }
            self.macroLog = try await macro
            self.papersLog = try await papers
            state = self.ventures.isEmpty && self.macroLog.isEmpty && self.papersLog.isEmpty ? .empty : .loaded
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    func projectName(for projectId: String) -> String {
        projects.first(where: { $0.projectId == projectId })?.name?.trimmedNonEmpty ?? projectId
    }

    func projectStatus(for projectId: String) -> String {
        projects.first(where: { $0.projectId == projectId })?.status ?? "未設定"
    }

    var latestLearnedAt: String? {
        laneWeights.map(\.computedAt).max()
    }
}

struct AMDOSParityVentureMapView: View {
    let onSelectProject: (String) -> Void
    let onOpenVenture: (String) -> Void
    @StateObject private var store = AMDOSParityVentureMapStore()
    @State private var selectedLane = ""
    @State private var selectedVentureId: String?

    var body: some View {
        AMDOSPageScaffold(
            eyebrow: "VENTURE MAP",
            title: "Venture Map",
            subtitle: "PWAのView A〜Cを、project_ventures・macro_index_log・papers_log・macro_lane_weightsの実データから読む"
        ) {
            AMDOSStateNotice(state: store.state) { Task { await store.load() } }
            AMDOSParityVentureMapTrendSection(
                lanes: amdOSParityVentureMapLanes,
                macroLog: store.macroLog,
                papersLog: store.papersLog,
                ventures: store.ventures,
                projectName: store.projectName,
                selectedLane: $selectedLane,
                selectedVentureId: $selectedVentureId,
                onOpenVenture: onOpenVenture
            )
            AMDOSParityVentureSnapshotSection(
                lanes: amdOSParityVentureMapLanes,
                macroLog: store.macroLog,
                papersLog: store.papersLog
            )
            AMDOSParityVentureModelSection(
                lanes: amdOSParityVentureMapLanes,
                weights: store.laneWeights,
                lastLearnedAt: store.latestLearnedAt
            )
            AMDOSParityVentureListSection(
                ventures: store.ventures,
                projectName: store.projectName,
                projectStatus: store.projectStatus,
                selectedVentureId: $selectedVentureId,
                onOpenVenture: onOpenVenture
            )
        }
        .task { await store.load() }
    }
}

private struct AMDOSParityVentureMapTrendSection: View {
    let lanes: [AMDOSParityVentureMapLane]
    let macroLog: [AMDOSParityVentureMacroRow]
    let papersLog: [AMDOSParityVenturePaperRow]
    let ventures: [AMDOSParityVenture]
    let projectName: (String) -> String
    @Binding var selectedLane: String
    @Binding var selectedVentureId: String?
    let onOpenVenture: (String) -> Void

    var body: some View {
        AMDOSSectionCard("View A — マクロトレンド時系列マップ", systemImage: "chart.xyaxis.line") {
            Text("縦軸=マクロ指数（実線）/ 論文数（破線）、ピン=公開SUの設立タイミング。PWAと同じ基準系列を表示し、Supabase実測がある年だけその値で上書きする。")
                .font(.caption)
                .foregroundStyle(AMDOSDesign.muted)
            HStack {
                ForEach(lanes) { lane in
                    Button {
                        selectedLane = selectedLane == lane.id ? "" : lane.id
                    } label: {
                        Label(lane.label, systemImage: selectedLane == lane.id ? "circle.fill" : "circle")
                            .foregroundStyle(lane.color)
                    }
                    .buttonStyle(.plain)
                }
            }
            AMDOSParityVentureTrendPlot(
                lanes: lanes,
                macroLog: macroLog,
                papersLog: papersLog,
                ventures: ventures,
                projectName: projectName,
                selectedLane: selectedLane,
                selectedVentureId: $selectedVentureId,
                onOpenVenture: onOpenVenture
            )
            if let selectedVentureId,
               let venture = ventures.first(where: { $0.id == selectedVentureId }) {
                HStack(alignment: .top, spacing: 10) {
                    Text(outcomeEmoji(venture.outcomePattern))
                        .font(.title3)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(projectName(venture.projectId)).font(.headline)
                        Text([venture.lane, venture.foundedAt, venture.originOrg, venture.originPi]
                            .compactMap { $0?.trimmedNonEmpty }
                            .joined(separator: " · "))
                            .font(.caption)
                            .foregroundStyle(AMDOSDesign.muted)
                        if let description = venture.shortDescription?.trimmedNonEmpty {
                            Text(description).font(.caption)
                        }
                    }
                    Spacer()
                    Button("SU詳細を開く") { onOpenVenture(venture.projectId) }
                        .buttonStyle(.bordered)
                }
            }
        }
    }
}

private func outcomeEmoji(_ outcome: String) -> String {
    switch outcome {
    case "rocket": return "🚀"
    case "lifted": return "✈️"
    case "deep_pivot": return "🔄"
    case "burnout": return "🔥"
    default: return "💀"
    }
}

private struct AMDOSParityVentureTrendPlot: View {
    let lanes: [AMDOSParityVentureMapLane]
    let macroLog: [AMDOSParityVentureMacroRow]
    let papersLog: [AMDOSParityVenturePaperRow]
    let ventures: [AMDOSParityVenture]
    let projectName: (String) -> String
    let selectedLane: String
    @Binding var selectedVentureId: String?
    let onOpenVenture: (String) -> Void

    private let xMin = 2010.0
    private let xMax = 2027.0
    private let now = 2026.34

    var body: some View {
        GeometryReader { proxy in
            Canvas { context, size in
                let width = max(size.width - 50, 1)
                let height = max(size.height - 38, 1)
                func x(_ year: Double) -> CGFloat {
                    36 + CGFloat((year - xMin) / (xMax - xMin)) * width
                }
                func y(_ value: Double) -> CGFloat {
                    8 + (1 - CGFloat(min(max(value, 0), 1))) * height
                }
                for step in 0...4 {
                    let value = Double(step) / 4
                    var line = Path()
                    line.move(to: CGPoint(x: 36, y: y(value)))
                    line.addLine(to: CGPoint(x: size.width - 12, y: y(value)))
                    context.stroke(line, with: .color(AMDOSDesign.border), lineWidth: 1)
                    context.draw(Text(String(format: "%.2f", value)).font(.caption2), at: CGPoint(x: 18, y: y(value)))
                }
                for year in Int(xMin)...Int(xMax) {
                    context.draw(Text(String(year)).font(.caption2), at: CGPoint(x: x(Double(year)), y: size.height - 12))
                }
                for (index, event) in amdOSParityVenturePolicyEvents.enumerated() {
                    var marker = Path()
                    marker.move(to: CGPoint(x: x(event.year), y: 8))
                    marker.addLine(to: CGPoint(x: x(event.year), y: size.height - 38))
                    let color = event.appliesToAll ? Color(red: 245 / 255, green: 158 / 255, blue: 11 / 255) : Color.gray
                    context.stroke(marker, with: .color(color.opacity(0.5)), style: StrokeStyle(lineWidth: event.appliesToAll ? 1.4 : 1, dash: [3, 3]))
                    context.draw(Text(event.label).font(.caption2).foregroundColor(event.appliesToAll ? Color(red: 180 / 255, green: 83 / 255, blue: 9 / 255) : Color.gray), at: CGPoint(x: x(event.year) + 3, y: 14 + CGFloat(index % 4) * 14), anchor: .leading)
                }
                for lane in lanes {
                    let visible = selectedLane.isEmpty || selectedLane == lane.id
                    let opacity = visible ? 1.0 : 0.16
                    let points = series(for: lane.id)
                    drawLine(&context, points: points.map { (x(Double($0.year)), y($0.macro)) }, color: lane.color, width: 2.6, opacity: opacity, dashed: false)
                    drawLine(&context, points: points.map { (x(Double($0.year)), y($0.papers)) }, color: lane.color, width: 1.4, opacity: opacity * 0.5, dashed: true)
                }
                for venture in ventures where venture.foundedAt != nil && (selectedLane.isEmpty || selectedLane == venture.lane) {
                    guard let date = venture.foundedAt,
                          let founded = decimalYear(date),
                          let macro = interpolatedMacro(for: venture.lane, at: founded) else { continue }
                    let point = CGPoint(x: x(founded), y: y(macro))
                    let selected = selectedVentureId == venture.id
                    let radius: CGFloat = selected ? 8.5 : 6.5
                    context.fill(Path(ellipseIn: CGRect(x: point.x - radius, y: point.y - radius, width: radius * 2, height: radius * 2)), with: .color(outcomeColor(venture.outcomePattern)))
                    context.stroke(Path(ellipseIn: CGRect(x: point.x - radius, y: point.y - radius, width: radius * 2, height: radius * 2)), with: .color(.white), lineWidth: 1.5)
                    context.draw(Text(venture.shortLabel ?? projectName(venture.projectId)).font(.caption2), at: CGPoint(x: point.x, y: point.y - 14))
                }
                var nowMarker = Path()
                nowMarker.move(to: CGPoint(x: x(now), y: 8))
                nowMarker.addLine(to: CGPoint(x: x(now), y: size.height - 38))
                context.stroke(nowMarker, with: .color(.red.opacity(0.7)), style: StrokeStyle(lineWidth: 1.5, dash: [4, 2]))
                context.draw(Text("NOW").font(.caption2.weight(.semibold)).foregroundColor(.red), at: CGPoint(x: x(now) + 4, y: size.height - 25), anchor: .leading)
            }
            .contentShape(Rectangle())
            .gesture(SpatialTapGesture().onEnded { value in
                let plotWidth = max(proxy.size.width - 50, 1)
                let estimatedYear = xMin + Double((value.location.x - 36) / plotWidth) * (xMax - xMin)
                let candidates = ventures.compactMap { venture -> (String, Double)? in
                    guard let foundedAt = venture.foundedAt, let year = decimalYear(foundedAt), abs(year - estimatedYear) <= 1 else { return nil }
                    guard selectedLane.isEmpty || selectedLane == venture.lane else { return nil }
                    return (venture.id, year)
                }
                selectedVentureId = candidates.min(by: { abs($0.1 - estimatedYear) < abs($1.1 - estimatedYear) })?.0
            })
        }
        .frame(minHeight: 330)
        .background(AMDOSDesign.panel, in: RoundedRectangle(cornerRadius: 12))
        .overlay(alignment: .bottomLeading) {
            Text("実線: マクロ指数  /  破線: 論文数相対  /  点: SU設立  /  黄灰: 政策  /  赤: NOW")
                .font(.caption2)
                .foregroundStyle(AMDOSDesign.muted)
                .padding(10)
        }
    }

    private func series(for lane: String) -> [AMDOSParityVentureYearPoint] {
        var merged = amdOSParityVentureFallbackSeries[lane] ?? []
        let macroByYear = Dictionary(grouping: macroLog.filter { $0.lane == lane }) { Int($0.observedAt.prefix(4)) ?? 0 }
        let paperRows = papersLog.filter { $0.lane == lane }
        let papersByYear = Dictionary(grouping: paperRows) { Int($0.observedAt.prefix(4)) ?? 0 }
        let maxPaper = max(paperRows.map(\.paperCount).max() ?? 0, 1)
        for index in merged.indices {
            let year = merged[index].year
            if let values = macroByYear[year], !values.isEmpty {
                merged[index].macro = values.map(\.indexValue).reduce(0, +) / Double(values.count)
            }
            if let rows = papersByYear[year], !rows.isEmpty {
                merged[index].papers = min(1, Double(rows.map(\.paperCount).reduce(0, +)) / Double(maxPaper))
            }
        }
        return merged
    }

    private func decimalYear(_ iso: String) -> Double? {
        let parts = iso.split(separator: "-", maxSplits: 2).compactMap { Double($0) }
        guard let year = parts.first else { return nil }
        return year + ((parts.count > 1 ? parts[1] : 1) - 1) / 12
    }

    private func interpolatedMacro(for lane: String, at year: Double) -> Double? {
        let values = series(for: lane)
        guard let first = values.first, let last = values.last else { return nil }
        if year <= Double(first.year) { return first.macro }
        if year >= Double(last.year) { return last.macro }
        for index in values.indices.dropLast() {
            let current = values[index]
            let next = values[index + 1]
            if Double(current.year) <= year && year <= Double(next.year) {
                let progress = (year - Double(current.year)) / Double(next.year - current.year)
                return current.macro + progress * (next.macro - current.macro)
            }
        }
        return last.macro
    }

    private func outcomeColor(_ outcome: String) -> Color {
        switch outcome {
        case "rocket": return Color(red: 14 / 255, green: 165 / 255, blue: 233 / 255)
        case "lifted": return Color(red: 22 / 255, green: 163 / 255, blue: 74 / 255)
        case "deep_pivot": return Color(red: 139 / 255, green: 92 / 255, blue: 246 / 255)
        case "burnout": return Color(red: 239 / 255, green: 68 / 255, blue: 68 / 255)
        default: return Color(red: 107 / 255, green: 114 / 255, blue: 128 / 255)
        }
    }

    private func drawLine(_ context: inout GraphicsContext, points: [(CGFloat, CGFloat)], color: Color, width: CGFloat, opacity: Double, dashed: Bool) {
        guard points.count > 1 else { return }
        var path = Path()
        for (index, point) in points.enumerated() {
            if index == 0 { path.move(to: CGPoint(x: point.0, y: point.1)) }
            else { path.addLine(to: CGPoint(x: point.0, y: point.1)) }
        }
        context.stroke(path, with: .color(color.opacity(opacity)), style: StrokeStyle(lineWidth: width, lineCap: .round, lineJoin: .round, dash: dashed ? [5, 4] : []))
    }
}

private struct AMDOSParityVentureSnapshot: Identifiable, Sendable {
    let lane: String
    let macro: Double
    let papers: Double
    let policy: Double
    let invest: Double

    var id: String { lane }
    var compositeScore: Double { 0.4 * macro + 0.2 * papers + 0.2 * policy + 0.2 * invest }
}

private struct AMDOSParityVentureSnapshotSection: View {
    let lanes: [AMDOSParityVentureMapLane]
    let macroLog: [AMDOSParityVentureMacroRow]
    let papersLog: [AMDOSParityVenturePaperRow]

    private var snapshots: [AMDOSParityVentureSnapshot] {
        lanes.map { lane in
            let macroRows = macroLog.filter { $0.lane == lane.id }.sorted { $0.observedAt > $1.observedAt }.prefix(3)
            let macro = macroRows.isEmpty ? 0 : macroRows.map(\.indexValue).reduce(0, +) / Double(macroRows.count)
            let policy = macroRows.isEmpty ? 0 : macroRows.map { $0.policyDensity ?? 0 }.reduce(0, +) / Double(macroRows.count)
            let paperRows = papersLog.filter { $0.lane == lane.id }
            var latestPaper: (year: Int, count: Int)?
            for row in paperRows {
                guard let year = Int(row.observedAt.prefix(4)) else { continue }
                if latestPaper == nil || year > latestPaper!.year {
                    latestPaper = (year, row.paperCount)
                }
            }
            let maximum = max(paperRows.map(\.paperCount).max() ?? 0, 1)
            let papers = min(1, Double(latestPaper?.count ?? 0) / Double(maximum))
            return AMDOSParityVentureSnapshot(lane: lane.id, macro: macro, papers: papers, policy: policy, invest: (macro + papers) / 2)
        }.sorted { $0.compositeScore > $1.compositeScore }
    }

    var body: some View {
        AMDOSSectionCard("View B — 現時点スナップショット", systemImage: "thermometer.medium") {
            Text("PWAと同じ5領域の指標集計。総合温度 = 0.4·マクロ + 0.2·論文 + 0.2·政策 + 0.2·投資密度（投資密度はPWAの現行算出式どおりマクロと論文の中間値）。")
                .font(.caption)
                .foregroundStyle(AMDOSDesign.muted)
            if macroLog.isEmpty && papersLog.isEmpty {
                Label("スナップショットを算出する実データがありません", systemImage: "tray")
                    .foregroundStyle(AMDOSDesign.muted)
            } else {
                ForEach(Array(snapshots.enumerated()), id: \.element.id) { index, row in
                    let lane = lanes.first(where: { $0.id == row.lane })
                    AMDOSParityVentureSnapshotRow(row: row, lane: lane, isTop: index == 0)
                }
            }
        }
    }
}

private struct AMDOSParityVentureSnapshotRow: View {
    let row: AMDOSParityVentureSnapshot
    let lane: AMDOSParityVentureMapLane?
    let isTop: Bool

    var body: some View {
        AMDOSCard {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("●").foregroundStyle(lane?.color ?? AMDOSDesign.blue)
                    Text(lane?.label ?? row.lane).font(.headline)
                    Spacer()
                    Text("総合 \(Int((row.compositeScore * 100).rounded()))")
                        .font(.headline)
                        .foregroundStyle(isTop ? AMDOSDesign.warning : AMDOSDesign.ink)
                    if isTop { Text("🔥") }
                }
                HStack {
                    AMDOSParityVentureMetric(label: "マクロ", value: row.macro)
                    AMDOSParityVentureMetric(label: "論文", value: row.papers)
                    AMDOSParityVentureMetric(label: "政策", value: row.policy)
                    AMDOSParityVentureMetric(label: "投資", value: row.invest)
                    Spacer()
                    Text(judgement).font(.caption).foregroundStyle(judgementColor)
                }
            }
        }
    }

    private var judgement: String {
        if row.papers - row.macro > 0.15 { return "研究先行 / シーズ仕込み期" }
        if row.macro - row.papers > 0.15 { return "政策先行 / 研究集中要" }
        return "バランス"
    }

    private var judgementColor: Color {
        if row.papers - row.macro > 0.15 { return .purple }
        if row.macro - row.papers > 0.15 { return .orange }
        return AMDOSDesign.muted
    }
}

private struct AMDOSParityVentureMetric: View {
    let label: String
    let value: Double
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.caption2).foregroundStyle(AMDOSDesign.muted)
            Text(String(format: "%.2f", value)).font(.callout.monospacedDigit())
        }
        .frame(minWidth: 70, alignment: .leading)
    }
}

private struct AMDOSParityVentureModelSection: View {
    let lanes: [AMDOSParityVentureMapLane]
    let weights: [AMDOSParityVentureLaneWeightRow]
    let lastLearnedAt: String?

    var body: some View {
        AMDOSSectionCard("View C — モデル定式", systemImage: "function") {
            HStack(alignment: .top, spacing: 18) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("マクロトレンド指数")
                        .font(.headline)
                    Text("Mᵢ(t) = αᵢ∫Pᵢ(s)e⁻ˡᵃᵐᵇᵈᵃⁱ⁽ᵗ⁻ˢ⁾ds + βᵢBᵢ(t) + γᵢVᵢ(t) + δᵢRᵢ(t)")
                        .font(.system(.body, design: .monospaced))
                    Text("事業化適温度: Tᵢ(t) = Mᵢ(t) · Sᵢᵏ · (1 − Cᵢ(t))ᵉᵗᵃⁱ")
                        .font(.system(.caption, design: .monospaced))
                    Text("論文−政策乖離: Dᵢ(t) = dNᵢ/dt − dMᵢ/dt")
                        .font(.system(.caption, design: .monospaced))
                    Text("最終再学習: \(lastLearnedAt ?? "未学習")")
                        .font(.caption)
                        .foregroundStyle(AMDOSDesign.muted)
                }
                Divider()
                VStack(alignment: .leading, spacing: 6) {
                    Text("領域別パラメータ（最新推定値）").font(.headline)
                    if weights.isEmpty {
                        Text("重みデータがありません").font(.caption).foregroundStyle(AMDOSDesign.muted)
                    } else {
                        ForEach(lanes) { lane in
                            if let weight = weights.first(where: { $0.lane == lane.id }) {
                                AMDOSParityVentureWeightRow(lane: lane, weight: weight)
                            }
                        }
                    }
                }
            }
        }
    }
}

private struct AMDOSParityVentureWeightRow: View {
    let lane: AMDOSParityVentureMapLane
    let weight: AMDOSParityVentureLaneWeightRow
    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(lane.label).font(.caption.weight(.semibold)).foregroundStyle(lane.color)
            Text([weight.alpha, weight.beta, weight.gamma, weight.delta, weight.lambda ?? 0, weight.eta ?? 0]
                .map { String(format: "%.3f", $0) }
                .joined(separator: "  "))
                .font(.caption.monospacedDigit())
            Text("α  β  γ  δ  λ  η · \(weight.computedAt)")
                .font(.caption2)
                .foregroundStyle(AMDOSDesign.muted)
        }
    }
}

private struct AMDOSParityVentureListSection: View {
    let ventures: [AMDOSParityVenture]
    let projectName: (String) -> String
    let projectStatus: (String) -> String
    @Binding var selectedVentureId: String?
    let onOpenVenture: (String) -> Void

    var body: some View {
        AMDOSSectionCard("公開SU一覧", systemImage: "building.2") {
            if ventures.isEmpty {
                Text("公開SUがありません").foregroundStyle(AMDOSDesign.muted)
            } else {
                ForEach(ventures) { venture in
                    AMDOSCard {
                        Button {
                            selectedVentureId = venture.id
                        } label: {
                            HStack(alignment: .top, spacing: 12) {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(venture.shortLabel ?? projectName(venture.projectId)).font(.headline)
                                    Text(projectName(venture.projectId)).font(.caption).foregroundStyle(AMDOSDesign.muted)
                                    Text([venture.lane, venture.foundedAt ?? "", venture.outcomePattern, projectStatus(venture.projectId)]
                                        .compactMap { $0.trimmedNonEmpty }
                                        .joined(separator: " · "))
                                        .font(.caption)
                                        .foregroundStyle(AMDOSDesign.muted)
                                    if let description = venture.shortDescription?.trimmedNonEmpty {
                                        Text(description).font(.caption).lineLimit(3)
                                    }
                                }
                                Spacer()
                                VStack(alignment: .trailing, spacing: 6) {
                                    AMDOSStatusBadge(text: selectedVentureId == venture.id ? "選択中" : venture.outcomePattern)
                                    Button("SU詳細") { onOpenVenture(venture.projectId) }
                                        .buttonStyle(.bordered)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }
}

// MARK: - AMD Score parity

private struct AMDOSParityScoreInput: Codable, Identifiable, Sendable {
    let id: String
    let projectId: String
    let evaluatedAt: String
    let muA: Double?
    let muI: Double?
    let muG: Double?
    let trl: Double?
    let brl: Double?
    let grl: Double?
    let srl: Double?
    let hrl: Double?
    let frl: Double?
    let alqSelfAwareness: Double?
    let alqRelationalTransparency: Double?
    let alqBalancedProcessing: Double?
    let alqInternalizedMoral: Double?
    let frlGrit: Double?
    let frlResilience: Double?
    let frlCap: Double?
    let frlCapAmd: Double?
    let frlCesA: Double?
    let frlCesRho: Double?
    let prsPotential: Double?
    let prsRNet: Double?
    let frlNotes: String?
    let frlCapNotes: String?
    let notes: String?
    let evaluator: String?
    let shallowTechMode: Bool
    let muNotes: AMDOSParityScoreNotes?
    let xrlNotes: AMDOSParityScoreNotes?
    let xrlChecklist: [String: [String: [Bool]]]?

    enum CodingKeys: String, CodingKey {
        case id
        case projectId = "project_id"
        case evaluatedAt = "evaluated_at"
        case muA = "mu_a"
        case muI = "mu_i"
        case muG = "mu_g"
        case trl, brl, grl, srl, hrl, frl
        case alqSelfAwareness = "alq_self_awareness"
        case alqRelationalTransparency = "alq_relational_transparency"
        case alqBalancedProcessing = "alq_balanced_processing"
        case alqInternalizedMoral = "alq_internalized_moral"
        case frlGrit = "frl_grit"
        case frlResilience = "frl_resilience"
        case frlCap = "frl_cap"
        case frlCapAmd = "frl_cap_amd"
        case frlCesA = "frl_ces_a"
        case frlCesRho = "frl_ces_rho"
        case prsPotential = "prs_potential"
        case prsRNet = "prs_r_net"
        case frlNotes = "frl_notes"
        case frlCapNotes = "frl_cap_notes"
        case notes, evaluator
        case shallowTechMode = "shallow_tech_mode"
        case muNotes = "mu_notes"
        case xrlNotes = "xrl_notes"
        case xrlChecklist = "xrl_checklist"
    }
}

private struct AMDOSParityScoreNotes: Codable, Sendable {
    let values: [String: String]

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let values = try? container.decode([String: String].self) {
            self.values = values
        } else if let value = try? container.decode(String.self) {
            self.values = ["text": value]
        } else {
            self.values = [:]
        }
    }

    func value(for key: String) -> String? {
        values[key]?.trimmedNonEmpty ?? values["text"]?.trimmedNonEmpty
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(values)
    }
}

private struct AMDOSParityScoreProject: Codable, Identifiable, Sendable {
    let projectId: String
    let name: String?
    let status: String?
    var id: String { projectId }
    enum CodingKeys: String, CodingKey {
        case projectId = "project_id"
        case name = "project_name"
        case status
    }
}

private struct AMDOSParityScoreVenture: Codable, Identifiable, Sendable {
    let projectId: String
    let lane: String?
    let lanes: [AMDOSParityVentureLaneWeight]?
    let shortLabel: String?
    var id: String { projectId }
    enum CodingKeys: String, CodingKey {
        case projectId = "project_id"
        case lane, lanes
        case shortLabel = "short_label"
    }
}

private struct AMDOSParityActiveAlpha: Codable, Sendable {
    let alpha: [String: Double]
    let effectiveFrom: String
    let effectiveTo: String?
    let notes: String?
    enum CodingKeys: String, CodingKey {
        case alpha
        case effectiveFrom = "effective_from"
        case effectiveTo = "effective_to"
        case notes
    }
}

private struct AMDOSParityAlphaInsert: Encodable, Sendable {
    let alpha: [String: Double]
    let effectiveFrom: String
    let effectiveTo: String?
    let notes: String?
    enum CodingKeys: String, CodingKey {
        case alpha
        case effectiveFrom = "effective_from"
        case effectiveTo = "effective_to"
        case notes
    }
}

private struct AMDOSParityAlphaClose: Encodable, Sendable {
    let effectiveTo: String
    enum CodingKeys: String, CodingKey { case effectiveTo = "effective_to" }
}

private struct AMDOSParityScoreStoreData: Sendable {
    var projects: [AMDOSParityScoreProject] = []
    var ventures: [AMDOSParityScoreVenture] = []
    var inputs: [AMDOSParityScoreInput] = []
    var alpha: [String: Double] = AMDOSParityScoreMath.defaultAlpha
}

@MainActor
private final class AMDOSParityScoreStore: ObservableObject {
    @Published var data = AMDOSParityScoreStoreData()
    @Published var state: AMDOSFeatureLoadState = .idle
    @Published var message: String?

    func load() async {
        state = .loading
        do {
            async let projects = AMDOSRESTClient.shared.fetchTable(
                AMDOSParityScoreProject.self,
                table: "projects",
                select: "project_id,project_name,status",
                order: "project_name",
                limit: 500
            )
            async let ventures = AMDOSRESTClient.shared.fetchTable(
                AMDOSParityScoreVenture.self,
                table: "project_ventures",
                select: "project_id,short_label,lane,lanes",
                filters: ["is_public": "eq.true"],
                order: "project_id",
                limit: 500
            )
            async let inputs = AMDOSRESTClient.shared.fetchTable(
                AMDOSParityScoreInput.self,
                table: "amd_score_inputs",
                select: "id,project_id,evaluated_at,mu_a,mu_i,mu_g,trl,brl,grl,srl,hrl,frl,alq_self_awareness,alq_relational_transparency,alq_balanced_processing,alq_internalized_moral,frl_grit,frl_resilience,frl_notes,frl_cap,frl_cap_amd,frl_cap_notes,frl_ces_a,frl_ces_rho,prs_potential,prs_r_net,mu_notes,xrl_notes,xrl_checklist,shallow_tech_mode,evaluator,notes",
                order: "project_id,evaluated_at",
                limit: 5_000
            )
            async let alphaRows = AMDOSRESTClient.shared.fetchTable(
                AMDOSParityActiveAlpha.self,
                table: "amd_score_alpha",
                select: "alpha,effective_from,effective_to,notes",
                filters: ["effective_to": "is.null"],
                order: "effective_from.desc",
                limit: 1
            )
            let loadedProjects = try await projects
            let loadedVentures = try await ventures
            let loadedInputs = try await inputs
            let loadedAlphaRows = try await alphaRows
            data.projects = loadedProjects
            data.ventures = loadedVentures
            data.inputs = loadedInputs.sorted {
                if $0.projectId == $1.projectId { return $0.evaluatedAt < $1.evaluatedAt }
                return $0.projectId < $1.projectId
            }
            if let row = loadedAlphaRows.first {
                data.alpha = AMDOSParityScoreMath.normalizedAlpha(row.alpha)
            }
            state = data.ventures.isEmpty ? .empty : .loaded
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    func projectName(_ id: String) -> String {
        data.projects.first(where: { $0.projectId == id })?.name?.trimmedNonEmpty ?? id
    }

    func projectStatus(_ id: String) -> String {
        data.projects.first(where: { $0.projectId == id })?.status ?? "未設定"
    }

    func latestInput(for projectId: String) -> AMDOSParityScoreInput? {
        data.inputs.filter { $0.projectId == projectId }.last
    }

    func latestScorableInput(for projectId: String) -> AMDOSParityScoreInput? {
        let today = ISO8601DateFormatter().string(from: .now).prefix(10)
        return data.inputs.filter {
            $0.projectId == projectId && $0.muA != nil && $0.muI != nil && $0.muG != nil && $0.evaluatedAt.prefix(10) <= today
        }.last
    }

    func resolvedPrs(for row: AMDOSParityScoreInput) -> (p: Double?, rNet: Double?) {
        var p = row.prsPotential
        var r = row.prsRNet
        let history = data.inputs.filter { $0.projectId == row.projectId && $0.evaluatedAt <= row.evaluatedAt }.sorted { $0.evaluatedAt > $1.evaluatedAt }
        for candidate in history {
            if p == nil { p = candidate.prsPotential }
            if r == nil { r = candidate.prsRNet }
            if p != nil && r != nil { break }
        }
        return (p, r)
    }

    func savePrimaryInputs(_ row: AMDOSParityScoreInput, p: Double?, rNet: Double?) async {
        do {
            _ = try await AMDOSRESTClient.shared.patchTable(
                table: "amd_score_inputs",
                filters: ["id": "eq.\(row.id)"],
                body: AMDOSParityScorePrimaryPatch(prsPotential: p, prsRNet: rNet)
            )
            message = "SPS入力を保存したよ"
            await load()
        } catch {
            message = error.localizedDescription
        }
    }

    func saveAlpha(_ values: [String: Double]) async {
        do {
            let now = ISO8601DateFormatter().string(from: .now)
            _ = try await AMDOSRESTClient.shared.patchTable(
                table: "amd_score_alpha",
                filters: ["effective_to": "is.null"],
                body: AMDOSParityAlphaClose(effectiveTo: now)
            )
            _ = try await AMDOSRESTClient.shared.postTable(
                table: "amd_score_alpha",
                body: AMDOSParityAlphaInsert(alpha: AMDOSParityScoreMath.normalizedAlpha(values), effectiveFrom: now, effectiveTo: nil, notes: "AMD Score Retrofit (macOS)")
            )
            message = "新しいαを保存したよ"
            await load()
        } catch {
            message = error.localizedDescription
        }
    }
}

private struct AMDOSParityScorePrimaryPatch: Encodable, Sendable {
    let prsPotential: Double?
    let prsRNet: Double?
    enum CodingKeys: String, CodingKey {
        case prsPotential = "prs_potential"
        case prsRNet = "prs_r_net"
    }
}

/// `toAmdScoreInputUpsert` + `upsertAmdScoreInput` のNative写像。
/// XRL checklist保存時に未表示のALQ/FRL/根拠列を落とさないため、PWAと同じ評価行の全列を保持する。
private struct AMDOSParityScoreInputUpsert: Encodable, Sendable {
    let projectId: String
    let evaluatedAt: String
    let muA: Double?
    let muI: Double?
    let muG: Double?
    let trl: Double?
    let brl: Double?
    let grl: Double?
    let srl: Double?
    let hrl: Double?
    let frl: Double?
    let alqSelfAwareness: Double?
    let alqRelationalTransparency: Double?
    let alqBalancedProcessing: Double?
    let alqInternalizedMoral: Double?
    let frlGrit: Double?
    let frlResilience: Double?
    let frlNotes: String?
    let frlCap: Double?
    let frlCapAmd: Double?
    let frlCapNotes: String?
    let frlCesA: Double?
    let frlCesRho: Double?
    let prsPotential: Double?
    let prsRNet: Double?
    let muNotes: AMDOSParityScoreNotes?
    let xrlNotes: AMDOSParityScoreNotes?
    let xrlChecklist: [String: [String: [Bool]]]
    let shallowTechMode: Bool
    let evaluator: String?
    let notes: String?
    let updatedAt: String

    init(_ row: AMDOSParityScoreInput, checklist: [String: [String: [Bool]]], levels: [String: Double]) {
        projectId = row.projectId
        evaluatedAt = row.evaluatedAt
        muA = row.muA
        muI = row.muI
        muG = row.muG
        trl = levels["trl"]
        brl = levels["brl"]
        grl = levels["grl"]
        srl = levels["srl"]
        hrl = levels["hrl"]
        frl = row.frl
        alqSelfAwareness = row.alqSelfAwareness
        alqRelationalTransparency = row.alqRelationalTransparency
        alqBalancedProcessing = row.alqBalancedProcessing
        alqInternalizedMoral = row.alqInternalizedMoral
        frlGrit = row.frlGrit
        frlResilience = row.frlResilience
        frlNotes = row.frlNotes
        frlCap = row.frlCap
        frlCapAmd = row.frlCapAmd
        frlCapNotes = row.frlCapNotes
        frlCesA = row.frlCesA
        frlCesRho = row.frlCesRho
        prsPotential = row.prsPotential
        prsRNet = row.prsRNet
        muNotes = row.muNotes
        xrlNotes = row.xrlNotes
        xrlChecklist = checklist
        shallowTechMode = row.shallowTechMode
        evaluator = row.evaluator
        notes = row.notes
        updatedAt = ISO8601DateFormatter().string(from: .now)
    }

    enum CodingKeys: String, CodingKey {
        case projectId = "project_id"
        case evaluatedAt = "evaluated_at"
        case muA = "mu_a"
        case muI = "mu_i"
        case muG = "mu_g"
        case trl, brl, grl, srl, hrl, frl
        case alqSelfAwareness = "alq_self_awareness"
        case alqRelationalTransparency = "alq_relational_transparency"
        case alqBalancedProcessing = "alq_balanced_processing"
        case alqInternalizedMoral = "alq_internalized_moral"
        case frlGrit = "frl_grit"
        case frlResilience = "frl_resilience"
        case frlNotes = "frl_notes"
        case frlCap = "frl_cap"
        case frlCapAmd = "frl_cap_amd"
        case frlCapNotes = "frl_cap_notes"
        case frlCesA = "frl_ces_a"
        case frlCesRho = "frl_ces_rho"
        case prsPotential = "prs_potential"
        case prsRNet = "prs_r_net"
        case muNotes = "mu_notes"
        case xrlNotes = "xrl_notes"
        case xrlChecklist = "xrl_checklist"
        case shallowTechMode = "shallow_tech_mode"
        case evaluator, notes
        case updatedAt = "updated_at"
    }
}

private enum AMDOSParityScoreMath {
    static let axes = ["sigma_SU", "TRL", "BRL", "GRL", "SRL", "HRL", "FRL"]
    static let defaultAlpha: [String: Double] = ["sigma_SU": 1.3, "TRL": 1.0, "BRL": 0.6, "GRL": 0.3, "SRL": 0.2, "HRL": 1.1, "FRL": 1.5]

    static func normalizedAlpha(_ raw: [String: Double]) -> [String: Double] {
        var values = defaultAlpha
        for axis in axes where raw[axis].map({ $0.isFinite }) == true { values[axis] = raw[axis]! }
        return values
    }

    static func sigma(_ row: AMDOSParityScoreInput) -> Double {
        pow(max(0, (row.muA ?? 0) + 1) * max(0, (row.muI ?? 0) + 1) * max(0, (row.muG ?? 0) + 1), 1.0 / 3.0) - 1
    }

    static func frl(_ row: AMDOSParityScoreInput) -> Double {
        let character = min(max(row.frl ?? 0, 0), 9)
        guard let capability = row.frlCap, capability.isFinite else { return character }
        let a = min(max(row.frlCesA ?? 0.6, 0), 1)
        let rho = row.frlCesRho ?? -2
        let charX = character + 1
        let capX = min(max(capability, 0), 9) + 1
        if abs(rho) < 0.000001 { return min(9, max(0, pow(charX, a) * pow(capX, 1 - a) - 1)) }
        return min(9, max(0, pow(a * pow(charX, rho) + (1 - a) * pow(capX, rho), 1 / rho) - 1))
    }

    static func legacy(_ row: AMDOSParityScoreInput, alpha: [String: Double]) -> AMDOSParityLegacyScore {
        let shallow = row.shallowTechMode
        let values: [String: Double] = [
            "sigma_SU": sigma(row),
            "TRL": row.trl ?? 0,
            "BRL": row.brl ?? 0,
            "GRL": row.grl ?? 0,
            "SRL": row.srl ?? 0,
            "HRL": row.hrl ?? 0,
            "FRL": frl(row)
        ]
        let activeAxes = axes.filter { !(shallow && $0 == "TRL") }
        let alphaSum = activeAxes.reduce(0) { $0 + (alpha[$1] ?? 0) }
        let k = 100_000 / pow(10, alphaSum)
        var product = 1.0
        var contributions: [String: Double] = [:]
        for axis in activeAxes {
            let value = min(max(values[axis] ?? 0, 0), 9)
            let contribution = pow(value + 1, alpha[axis] ?? 0)
            contributions[axis] = contribution
            product *= contribution
        }
        var bottleneck = "sigma_SU"
        var highest = -Double.infinity
        for axis in activeAxes {
            let sensitivity = (alpha[axis] ?? 0) / (min(max(values[axis] ?? 0, 0), 9) + 1)
            if sensitivity > highest { highest = sensitivity; bottleneck = axis }
        }
        let macro = contributions["sigma_SU"] ?? 1
        let reach = ["TRL", "BRL", "GRL", "SRL", "HRL"].filter { !(shallow && $0 == "TRL") }.reduce(1) { $0 * (contributions[$1] ?? 1) }
        return AMDOSParityLegacyScore(score: k * product, sigma: values["sigma_SU"] ?? 0, k: k, macro: macro, reach: reach, survival: contributions["FRL"] ?? 1, bottleneck: bottleneck, values: values)
    }

    static func primary(_ row: AMDOSParityScoreInput, alpha: [String: Double], p: Double?, rNet: Double?) -> AMDOSParityPrimaryScore {
        let shallow = row.shallowTechMode
        let sigmaValue = sigma(row)
        let weights: [String: Double] = ["P": 1.0, "TRL": alpha["TRL"] ?? 1.0, "BRL": alpha["BRL"] ?? 0.6, "GRL": alpha["GRL"] ?? 0.3, "SRL": alpha["SRL"] ?? 0.2, "HRL": alpha["HRL"] ?? 1.1, "sigma_SU": alpha["sigma_SU"] ?? 1.3, "FRL": alpha["FRL"] ?? 1.5, "R_net": 0.8]
        let axisValues: [String: Double?] = ["P": p, "TRL": shallow ? nil : (row.trl ?? 0), "BRL": row.brl ?? 0, "GRL": row.grl ?? 0, "SRL": row.srl ?? 0, "HRL": row.hrl ?? 0, "sigma_SU": sigmaValue, "FRL": frl(row), "R_net": rNet]
        let missing = [p == nil ? "P" : nil, rNet == nil ? "R_net" : nil].compactMap { $0 }
        let activeAxes = weights.keys.filter { !(shallow && $0 == "TRL") }
        let alphaSum = activeAxes.reduce(0) { $0 + (weights[$1] ?? 0) }
        let k = 100_000 / pow(10, alphaSum)
        guard missing.isEmpty else { return AMDOSParityPrimaryScore(score: nil, status: "missing", missingAxes: missing, macro: nil, potential: nil, reach: nil, survival: nil, k: k, alphaSum: alphaSum) }
        var product = 1.0
        var contributions: [String: Double] = [:]
        for axis in activeAxes {
            let value = min(max((axisValues[axis] ?? 0) ?? 0, 0), 9)
            let contribution = pow(value + 1, weights[axis] ?? 0)
            contributions[axis] = contribution
            product *= contribution
        }
        return AMDOSParityPrimaryScore(score: k * product, status: "ready", missingAxes: [], macro: contributions["sigma_SU"] ?? 1, potential: contributions["P"] ?? 1, reach: ["TRL", "BRL", "GRL", "SRL", "HRL"].filter { !(shallow && $0 == "TRL") }.reduce(1) { $0 * (contributions[$1] ?? 1) }, survival: (contributions["FRL"] ?? 1) * (contributions["R_net"] ?? 1), k: k, alphaSum: alphaSum)
    }
}

private struct AMDOSParityLegacyScore: Sendable {
    let score: Double
    let sigma: Double
    let k: Double
    let macro: Double
    let reach: Double
    let survival: Double
    let bottleneck: String
    let values: [String: Double]
}

private struct AMDOSParityPrimaryScore: Sendable {
    let score: Double?
    let status: String
    let missingAxes: [String]
    let macro: Double?
    let potential: Double?
    let reach: Double?
    let survival: Double?
    let k: Double
    let alphaSum: Double
}

private struct AMDOSParityScoreListRow: Identifiable, Sendable {
    let id: String
    let projectId: String
    let projectName: String
    let status: String
    let lane: String
    let latest: AMDOSParityScoreInput?
    let legacy: AMDOSParityLegacyScore?
    let primary: AMDOSParityPrimaryScore?
}

struct AMDOSParityAMDScoreView: View {
    let onSelectProject: (String) -> Void
    @StateObject private var store = AMDOSParityScoreStore()
    @State private var sortMode = "score_desc"

    private var rows: [AMDOSParityScoreListRow] {
        store.data.ventures.map { venture in
            let latest = store.latestInput(for: venture.projectId)
            let legacy = latest.map { AMDOSParityScoreMath.legacy($0, alpha: store.data.alpha) }
            let resolved = latest.map { store.resolvedPrs(for: $0) }
            let primary = latest.flatMap { row in
                let values = resolved ?? (nil, nil)
                return AMDOSParityScoreMath.primary(row, alpha: store.data.alpha, p: values.p, rNet: values.rNet)
            }
            return AMDOSParityScoreListRow(
                id: venture.projectId,
                projectId: venture.projectId,
                projectName: store.projectName(venture.projectId),
                status: store.projectStatus(venture.projectId),
                lane: venture.lane ?? "未分類",
                latest: latest,
                legacy: legacy,
                primary: primary
            )
        }.sorted { left, right in
            switch sortMode {
            case "score_asc": return scoreSortValue(left) < scoreSortValue(right)
            case "name": return left.projectName.localizedStandardCompare(right.projectName) == .orderedAscending
            default: return scoreSortValue(left) > scoreSortValue(right)
            }
        }
    }

    var body: some View {
        AMDOSPageScaffold(
            eyebrow: "AMD SCORE",
            title: "SPS Primary / Legacy AMD",
            subtitle: "PWAのSPS primary一覧。P/R_net未入力はスコアを出さず、review待ちとして残す"
        ) {
            AMDOSStateNotice(state: store.state) { Task { await store.load() } }
            AMDOSSectionCard("Legacy AMD α（比較用）", systemImage: "slider.horizontal.3") {
                HStack {
                    ForEach(AMDOSParityScoreMath.axes, id: \.self) { axis in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(axis == "sigma_SU" ? "σ_SU" : axis).font(.caption2).foregroundStyle(AMDOSDesign.muted)
                            Text(String(format: "%.2f", store.data.alpha[axis] ?? 0)).font(.caption.monospacedDigit())
                        }
                    }
                }
            }
            HStack {
                Text("並び:").font(.caption).foregroundStyle(AMDOSDesign.muted)
                Picker("並び", selection: $sortMode) {
                    Text("Score 降順").tag("score_desc")
                    Text("Score 昇順").tag("score_asc")
                    Text("PJ名").tag("name")
                }
                .pickerStyle(.segmented)
                Spacer()
                Text("\(rows.count)件").font(.caption).foregroundStyle(AMDOSDesign.muted)
            }
            if rows.isEmpty && store.state == .loaded {
                Label("公開SUがありません", systemImage: "tray").foregroundStyle(AMDOSDesign.muted)
            } else {
                ForEach(rows) { row in
                    AMDOSParityAMDScoreListRowView(row: row) { onSelectProject(row.projectId) }
                }
            }
            Text("各PJを開くとSPSのP/R_net保存、M/P/R/S内訳、Legacy M×X×F、評価時系列、根拠を確認できる。")
                .font(.caption)
                .foregroundStyle(AMDOSDesign.muted)
        }
        .task { await store.load() }
    }

    private func scoreSortValue(_ row: AMDOSParityScoreListRow) -> Double {
        if row.primary?.status == "ready", let value = row.primary?.score { return 1_000_000 + value }
        return row.legacy?.score ?? -1
    }
}

private struct AMDOSParityAMDScoreListRowView: View {
    let row: AMDOSParityScoreListRow
    let onOpen: () -> Void

    var body: some View {
        Button(action: onOpen) {
            AMDOSCard {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(row.projectName).font(.headline)
                            Text("\(row.projectId) · \(row.lane) · \(row.status)")
                                .font(.caption)
                                .foregroundStyle(AMDOSDesign.muted)
                        }
                        Spacer()
                        AMDOSStatusBadge(text: row.primary?.status == "ready" ? "ready" : row.primary == nil ? "—" : "\(row.primary?.missingAxes.joined(separator: " / ") ?? "P / R_net") 入力待ち", tint: row.primary?.status == "ready" ? AMDOSDesign.success : AMDOSDesign.warning)
                    }
                    HStack(alignment: .bottom, spacing: 22) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("SPS primary").font(.caption2).foregroundStyle(AMDOSDesign.muted)
                            Text(scoreText(row.primary?.score)).font(.title3.monospacedDigit().weight(.semibold))
                        }
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Legacy AMD").font(.caption2).foregroundStyle(AMDOSDesign.muted)
                            Text(scoreText(row.legacy?.score)).font(.callout.monospacedDigit())
                        }
                        VStack(alignment: .leading, spacing: 2) {
                            Text("最終評価").font(.caption2).foregroundStyle(AMDOSDesign.muted)
                            Text(row.latest?.evaluatedAt.prefix(10) ?? "未登録").font(.caption.monospaced())
                        }
                        Spacer()
                        Image(systemName: "chevron.right").foregroundStyle(AMDOSDesign.muted)
                    }
                }
            }
        }
        .buttonStyle(.plain)
    }

    private func scoreText(_ score: Double?) -> String {
        guard let score else { return "—" }
        return score < 1 ? String(format: "%.2f", score) : String(Int(score.rounded()))
    }
}

struct AMDOSParityAMDScoreDetailView: View {
    let projectId: String?
    @StateObject private var store = AMDOSParityScoreStore()
    @State private var pDraft = ""
    @State private var rNetDraft = ""
    @State private var draftRowId = ""

    private var selectedId: String { projectId ?? store.data.ventures.first?.projectId ?? "" }
    private var latest: AMDOSParityScoreInput? { store.latestScorableInput(for: selectedId) }
    private var latestAny: AMDOSParityScoreInput? { store.latestInput(for: selectedId) }
    private var resolved: (p: Double?, rNet: Double?) { latest.map(store.resolvedPrs(for:)) ?? (nil, nil) }
    private var legacy: AMDOSParityLegacyScore? { latest.map { AMDOSParityScoreMath.legacy($0, alpha: store.data.alpha) } }
    private var primary: AMDOSParityPrimaryScore? { latest.map { AMDOSParityScoreMath.primary($0, alpha: store.data.alpha, p: resolved.p, rNet: resolved.rNet) } }

    var body: some View {
        AMDOSPageScaffold(
            eyebrow: "AMD SCORE DETAIL",
            title: store.projectName(selectedId),
            subtitle: "PWA AmdScoreViewのSPS hero、M/P/R/S・Legacy M×X×F、時系列、根拠、Tsukuyomi修正導線"
        ) {
            AMDOSStateNotice(state: store.state) { Task { await store.load() } }
            if selectedId.isEmpty {
                Label("表示するPJを選べません", systemImage: "exclamationmark.triangle").foregroundStyle(AMDOSDesign.warning)
            } else if latest == nil {
                AMDOSSectionCard("SPS primary", systemImage: "exclamationmark.circle") {
                    Text("評価行がありません。PWAと同じく、評価行がない状態ではSPSを算出しない。")
                }
            } else if let latest, let legacy, let primary {
                AMDOSParityScoreHero(
                    projectId: selectedId,
                    projectName: store.projectName(selectedId),
                    latest: latest,
                    legacy: legacy,
                    primary: primary,
                    pDraft: $pDraft,
                    rNetDraft: $rNetDraft,
                    onSavePrimary: savePrimary
                )
                AMDOSParityScoreSeriesView(inputs: store.data.inputs.filter { $0.projectId == selectedId }, alpha: store.data.alpha)
                AMDOSParityXRLChecklistPanel(
                    projectId: selectedId,
                    latestInput: latest,
                    onReload: { await store.load() },
                    onMessage: { store.message = $0 }
                )
                AMDOSParityScoreTsukuyomiPanel(
                    projectId: selectedId,
                    projectName: store.projectName(selectedId),
                    latest: latest,
                    onReload: { Task { await store.load() } },
                    onMessage: { store.message = $0 }
                )
                AMDOSParityScoreEvidenceView(latest: latest, legacy: legacy, primary: primary)
            } else {
                Text("評価値が未入力のため表示できるスコアがありません。NULLを0として偽装しない。")
                    .foregroundStyle(AMDOSDesign.muted)
            }
            if let message = store.message { Text(message).font(.caption).foregroundStyle(AMDOSDesign.warning) }
        }
        .task { await store.load() }
        .onChange(of: store.data.inputs.count) { _, _ in seedDraftsIfNeeded() }
        .onAppear { seedDraftsIfNeeded() }
    }

    private func seedDraftsIfNeeded() {
        guard let row = latest, row.id != draftRowId else { return }
        draftRowId = row.id
        let values = store.resolvedPrs(for: row)
        pDraft = values.p.map { String($0) } ?? ""
        rNetDraft = values.rNet.map { String($0) } ?? ""
    }

    private func parse(_ value: String) -> Double? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        return Double(trimmed).flatMap { $0.isFinite ? $0 : nil }
    }

    private func savePrimary() {
        guard let row = latest else { return }
        Task { await store.savePrimaryInputs(row, p: parse(pDraft), rNet: parse(rNetDraft)) }
    }

}

private struct AMDOSParityScoreHero: View {
    let projectId: String
    let projectName: String
    let latest: AMDOSParityScoreInput
    let legacy: AMDOSParityLegacyScore
    let primary: AMDOSParityPrimaryScore
    @Binding var pDraft: String
    @Binding var rNetDraft: String
    let onSavePrimary: () -> Void

    var body: some View {
        AMDOSSectionCard("SPS primary — \(projectName)", systemImage: "scope") {
            HStack(alignment: .top, spacing: 18) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(primary.status == "ready" ? scoreText(primary.score) : "review pending")
                        .font(.system(size: 38, weight: .bold, design: .rounded))
                        .foregroundStyle(primary.status == "ready" ? AMDOSDesign.success : AMDOSDesign.warning)
                    Text("score = k × M × P × R × S · k=\(String(format: "%.3f", primary.k))")
                        .font(.caption.monospaced())
                        .foregroundStyle(AMDOSDesign.muted)
                    Text("評価日 \(latest.evaluatedAt.prefix(10)) · \(projectId)").font(.caption).foregroundStyle(AMDOSDesign.muted)
                }
                Divider()
                VStack(alignment: .leading, spacing: 8) {
                    Text("P / R_net review入力").font(.headline)
                    HStack {
                        AMDOSTextField(title: "P", text: $pDraft)
                        AMDOSTextField(title: "R_net", text: $rNetDraft)
                        Button("SPS入力を保存", action: onSavePrimary).buttonStyle(.borderedProminent)
                    }
                    Text("空欄はNULLとして保存し、PWAと同じくスコアを表示しない。入力値は最新評価行へ保存する。")
                        .font(.caption2)
                        .foregroundStyle(AMDOSDesign.muted)
                }
            }
            HStack {
                AMDOSMetricTile(label: "M / Macro", value: factorText(primary.macro), detail: "σ_SU = \(String(format: "%.2f", legacy.sigma))")
                AMDOSMetricTile(label: "P / Potential", value: factorText(primary.potential), detail: pDraft.isEmpty ? "P入力待ち" : "P=\(pDraft)")
                AMDOSMetricTile(label: "R / Reach", value: factorText(primary.reach), detail: "TRL・BRL・GRL・SRL・HRL")
                AMDOSMetricTile(label: "S / Survival", value: factorText(primary.survival), detail: "FRL × R_net")
            }
        }
    }

    private func scoreText(_ value: Double?) -> String {
        guard let value else { return "—" }
        return value < 1 ? String(format: "%.2f", value) : String(Int(value.rounded()))
    }
    private func factorText(_ value: Double?) -> String { value.map { String(format: "%.2f", $0) } ?? "—" }
}

private struct AMDOSParityScoreTsukuyomiAxis: Identifiable {
    let id: String
    let label: String
    let value: String
    let note: String?
}

private struct AMDOSParityScoreTsukuyomiPanel: View {
    let projectId: String
    let projectName: String
    let latest: AMDOSParityScoreInput
    let onReload: () -> Void
    let onMessage: (String) -> Void
    @State private var selectedAxis: AMDOSParityScoreTsukuyomiAxis?

    private var axes: [AMDOSParityScoreTsukuyomiAxis] {
        [
            .init(id: "mu-a", label: "μ_A (学術)", value: latest.muA.map { String(format: "%.1f", $0) } ?? "未入力", note: latest.muNotes?.value(for: "a")),
            .init(id: "mu-i", label: "μ_I (産業)", value: latest.muI.map { String(format: "%.1f", $0) } ?? "未入力", note: latest.muNotes?.value(for: "i")),
            .init(id: "mu-g", label: "μ_G (政府)", value: latest.muG.map { String(format: "%.1f", $0) } ?? "未入力", note: latest.muNotes?.value(for: "g")),
            .init(id: "trl", label: "TRL", value: latest.trl.map { String(format: "%.1f", $0) } ?? "未入力", note: latest.xrlNotes?.value(for: "trl")),
            .init(id: "brl", label: "BRL", value: latest.brl.map { String(format: "%.1f", $0) } ?? "未入力", note: latest.xrlNotes?.value(for: "brl")),
            .init(id: "grl", label: "GRL", value: latest.grl.map { String(format: "%.1f", $0) } ?? "未入力", note: latest.xrlNotes?.value(for: "grl")),
            .init(id: "srl", label: "SRL", value: latest.srl.map { String(format: "%.1f", $0) } ?? "未入力", note: latest.xrlNotes?.value(for: "srl")),
            .init(id: "hrl", label: "HRL", value: latest.hrl.map { String(format: "%.1f", $0) } ?? "未入力", note: latest.xrlNotes?.value(for: "hrl")),
            .init(id: "frl", label: "FRL", value: latest.frl.map { String(format: "%.1f", $0) } ?? "未入力", note: latest.frlNotes)
        ]
    }

    var body: some View {
        AMDOSSectionCard("評価の修正依頼", systemImage: "moon.stars") {
            Text("PWAと同じく、値を直接書き換えずに各軸をクリックしてつくよみに根拠付きの修正を依頼する。")
                .font(.caption)
                .foregroundStyle(AMDOSDesign.muted)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 8)], spacing: 8) {
                ForEach(axes) { axis in
                    Button { selectedAxis = axis } label: {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(axis.label).font(.caption.weight(.semibold))
                            Text(axis.value).font(.title3.monospacedDigit().weight(.bold))
                            Text(axis.note?.trimmedNonEmpty ?? "根拠未入力").font(.caption2).lineLimit(2).foregroundStyle(AMDOSDesign.muted)
                        }.frame(maxWidth: .infinity, alignment: .leading).padding(10).background(AMDOSDesign.panel, in: RoundedRectangle(cornerRadius: 10))
                    }.buttonStyle(.plain)
                }
            }
            Text("評価日: \(latest.evaluatedAt.prefix(10))").font(.caption).foregroundStyle(AMDOSDesign.muted)
        }
        .sheet(item: $selectedAxis) { axis in
            AMDOSParityScoreTsukuyomiSheet(projectId: projectId, projectName: projectName, axis: axis, onReload: onReload, onMessage: onMessage)
        }
    }
}

private struct AMDOSParityTsukuyomiChatMessage: Encodable, Sendable { let role: String; let content: String }
private struct AMDOSParityTsukuyomiChatRequest: Encodable, Sendable {
    let sessionId: String
    let pagePath: String
    let projectId: String
    let messages: [AMDOSParityTsukuyomiChatMessage]
    enum CodingKeys: String, CodingKey { case sessionId = "session_id", pagePath = "page_path", projectId = "project_id", messages }
}
private struct AMDOSParityTsukuyomiChatResponse: Decodable, Sendable { let reply: String?; let error: String? }

private struct AMDOSParityScoreTsukuyomiSheet: View {
    let projectId: String
    let projectName: String
    let axis: AMDOSParityScoreTsukuyomiAxis
    let onReload: () -> Void
    let onMessage: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var message: String
    @State private var sending = false

    init(projectId: String, projectName: String, axis: AMDOSParityScoreTsukuyomiAxis, onReload: @escaping () -> Void, onMessage: @escaping (String) -> Void) {
        self.projectId = projectId
        self.projectName = projectName
        self.axis = axis
        self.onReload = onReload
        self.onMessage = onMessage
        _message = State(initialValue: "PJ \(projectName) の \(axis.label) = \(axis.value) の評価を見直したい。\n現在の根拠: \(axis.note?.trimmedNonEmpty ?? "（未入力）")\n\n（私のコメント: 例「論文 N 件しかないから 5 にして」「もう少し根拠を詳しく」など）")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("つくよみに評価修正を依頼").font(.title3.weight(.bold))
            Text("\(axis.label) の値を直接更新しない。PWAと同じつくよみの `update_amd_score_input` 経路に依頼する。").font(.caption).foregroundStyle(AMDOSDesign.muted)
            TextEditor(text: $message).font(.body).frame(minHeight: 170).overlay(RoundedRectangle(cornerRadius: 8).stroke(AMDOSDesign.border))
            HStack { Spacer(); Button("キャンセル") { dismiss() }; Button(sending ? "送信中…" : "依頼を送る", action: send).disabled(sending || message.trimmedNonEmpty == nil).buttonStyle(.borderedProminent) }
        }.padding(24).frame(width: 560)
    }

    private func send() {
        guard let content = message.trimmedNonEmpty else { return }
        sending = true
        Task {
            defer { sending = false }
            do {
                let data = try await AMDOSRESTClient.shared.sendPWA(
                    path: "/api/tsukuyomi/chat",
                    body: AMDOSParityTsukuyomiChatRequest(sessionId: UUID().uuidString, pagePath: "/venture-map/amd-score/\(projectId)", projectId: projectId, messages: [.init(role: "user", content: content)])
                )
                let response = try? JSONDecoder().decode(AMDOSParityTsukuyomiChatResponse.self, from: data)
                onMessage(response?.reply?.trimmedNonEmpty ?? response?.error?.trimmedNonEmpty ?? "つくよみへ修正依頼を送った。反映後に再読み込みする。")
                onReload()
                dismiss()
            } catch { onMessage(error.localizedDescription) }
        }
    }
}

// MARK: - XRL observation checklist parity

/// `pwa/src/lib/xrl-level-definitions.ts` の原典定義をそのままNativeで使う。
/// レベル文言・説明・観測項目をMac独自に短縮/再解釈しない。
private enum AMDOSParityXRLChecklistAxis: String, CaseIterable, Identifiable {
    case trl, brl, grl, srl, hrl
    var id: String { rawValue }
    var color: Color {
        switch self {
        case .trl: return Color(red: 14 / 255, green: 165 / 255, blue: 233 / 255)
        case .brl: return Color(red: 245 / 255, green: 158 / 255, blue: 11 / 255)
        case .grl: return Color(red: 71 / 255, green: 85 / 255, blue: 105 / 255)
        case .srl: return Color(red: 147 / 255, green: 51 / 255, blue: 234 / 255)
        case .hrl: return Color(red: 22 / 255, green: 163 / 255, blue: 74 / 255)
        }
    }
}

private struct AMDOSParityXRLLevelDefinition: Identifiable {
    let level: Int
    let label: String
    let description: String
    let checklist: [String]
    var id: Int { level }
}

private struct AMDOSParityXRLDefinition {
    let axis: AMDOSParityXRLChecklistAxis
    let axisName: String
    let axisDescription: String
    let source: String
    let maxLevel: Int
    let levels: [AMDOSParityXRLLevelDefinition]
}

private func amdOSParityXRLDefinition(
    _ axis: AMDOSParityXRLChecklistAxis,
    _ description: String,
    _ source: String,
    _ maxLevel: Int,
    _ levels: [(String, String, [String])]
) -> AMDOSParityXRLDefinition {
    .init(
        axis: axis,
        axisName: axis.rawValue.uppercased(),
        axisDescription: description,
        source: source,
        maxLevel: maxLevel,
        levels: levels.enumerated().map { index, item in .init(level: index + 1, label: item.0, description: item.1, checklist: item.2) }
    )
}

private let amdOSParityXRLDefinitions: [AMDOSParityXRLChecklistAxis: AMDOSParityXRLDefinition] = [
    .trl: amdOSParityXRLDefinition(
        .trl,
        "技術成熟度レベル — 必要な技術はどれくらい発展しているか。「ある技術」が社会の技術要求水準に達するまでの段階を示す指標。",
        "内閣府SIP 2023公募要領 図2 / Technology Readiness Level Definitions, NASA",
        9,
        [
            ("基礎研究", "科学的な基本原理・現象・知識が発見された状態。", ["対象技術の科学的な基本原理・現象・知識が（文献等で）発見・確認されている"]),
            ("仮説", "原理・現象の定式化、概念の基本的特性の定義化等の応用的な研究を通じて、技術コンセプトや実現的な用途と利用者にとっての価値に関する仮説が立てられている状態。", ["原理・現象を定式化した（概念の基本的特性を定義した）", "技術コンセプトの仮説がある", "実現的な用途と、利用者にとっての価値の仮説がある"]),
            ("検証", "技術コンセプトの実現可能性や技術用途の実用性が、実験・分析・シミュレーション等によって検証された状態。実用性が確認されるまで仮説と検証が繰り返されている状態。", ["技術コンセプトの実現可能性を実験・分析・シミュレーション等で検証した", "技術用途の実用性を検証している（仮説と検証を反復している）"]),
            ("研究室レベルでの初期テスト", "制御された環境下において、要素技術の基本的な機能・性能が実証された状態。", ["制御された（ラボ）環境で要素技術の基本的な機能を実証した", "要素技術の基本的な性能を実測した"]),
            ("想定使用環境でのテスト", "模擬的な運用環境下において、要素技術が満たすべき機能・性能が実証された状態。", ["模擬的な運用環境（想定使用条件）を用意した", "その環境で要素技術が満たすべき機能・性能を実証した"]),
            ("実証（システム）", "実運用環境下において、要求水準を満たすシステム*の機能・性能が実証された状態。 *システム：要素技術以外の構成要素を含む、サービスや製品としての機能を完備した要素群", ["要素技術以外の構成要素を含むシステム（製品・サービス相当）を構成した", "実運用環境下で、要求水準を満たすシステムの機能・性能を実証した"]),
            ("生産計画", "サービスや製品の供給に係る全ての詳細な技術情報が揃い、生産計画が策定された状態。（生産ラインの諸元、設計仕様等）", ["供給に係る詳細な技術情報（生産ラインの諸元・設計仕様等）が揃った", "生産計画が策定された"]),
            ("スケール（パイロットライン）", "初期の顧客需要を満たす、サービスや製品を供給することが可能な状態。", ["パイロットライン等で生産できる", "初期の顧客需要を満たす量のサービス・製品を供給できる"]),
            ("安定供給", "全ての顧客需要を満たす、サービスや製品を安定的に供給することが可能な状態。", ["全ての顧客需要を満たす量を供給できる", "安定的に供給できる体制がある"])
        ]
    ),
    .brl: amdOSParityXRLDefinition(
        .brl,
        "ビジネス成熟度レベル — ビジネスとしての継続可能性はどうか。「創出財を利用した事業」が安定した事業として成り立つ水準までの段階を示す指標。",
        "内閣府SIP 2023公募要領 図3 / The Business Readiness Levels, Ramsden & Chowdhury 2019 / Access2EIC",
        9,
        [
            ("基礎研究", "潜在的な課題、顧客、解決方法等が発見された状態。（任意の現場における観察・体験、エスノグラフィー等）", ["潜在的な課題を発見した（現場観察・体験等）", "潜在顧客・解決方法の候補を発見した"]),
            ("仮説", "課題と顧客が明確化され、提供価値（解決策の優位性）、リターン・コスト等の事業モデルに関する仮説が立てられている状態。（ビジネスモデルキャンバス等）", ["課題とターゲット顧客を明確化した", "提供価値（解決策の優位性）の仮説がある", "リターン・コスト等の事業モデル仮説がある（BMC等）"]),
            ("検証", "事業モデルの仮説が顧客にとって有望であることがペーパープロトタイプ※、プレゼンテーション、インタビュー、アンケート等のテストで検証された状態。顧客価値が確認されるまで仮説と検証が繰り返されている状態。※模型的な試作品", ["事業モデル仮説を顧客にテストした（インタビュー/アンケート/ペーパープロトタイプ/プレゼン等）", "顧客にとって有望であることが検証された（仮説と検証を反復している）"]),
            ("実用最小限の初期テスト", "一部で旧技術を使用するなど限定的な機能を有する試作品を用いた疑似体験によって、提供価値が想定顧客にとって有用であることが実証された状態。顧客価値が確認されるまで仮説、検証、初期テストが繰り返されている状態。", ["限定機能の試作品（MVP/疑似体験）を用意した", "想定顧客にとって提供価値が有用であることを実証した"]),
            ("想定顧客のフィードバックテスト", "想定顧客からフィードバックを得ながら、顧客要望を満たす機能・性能が定義・設計され、その設計条件で事業モデルの妥当性が実証された状態。", ["想定顧客からフィードバックを得ている", "顧客要望を満たす機能・性能を定義・設計した", "その設計条件で事業モデルの妥当性が実証された"]),
            ("実証", "サービスや製品が実際に初期顧客に提供され、設計した条件で事業モデルの成立性や高い顧客満足度が実証された状態。", ["実際に初期顧客にサービス・製品を提供した（実売上）", "設計条件で事業モデルの成立性が実証された", "高い顧客満足度が実証された"]),
            ("事業計画", "上記の事業モデルを基にした、事業ロードマップ、投資計画、収益予測等を含む事業計画が策定された状態。", ["事業ロードマップ・投資計画・収益予測を含む事業計画を策定した"]),
            ("スケール", "定期的な顧客からフィードバックをもとにサービスや製品が改善されている状態。サービスや製品が、新規顧客に展開可能な根拠がある状態。", ["定期顧客のフィードバックで製品・サービスを改善している", "新規顧客に展開可能な根拠（再現性データ）がある"]),
            ("安定成長", "プロダクトおよび提供者が良く知られ、売上高が健全に成長する状態。", ["プロダクトおよび提供者が広く知られている", "売上高が健全に成長している"])
        ]
    ),
    .grl: amdOSParityXRLDefinition(
        .grl,
        "ガバナンス成熟度レベル — 制度や規制は整っているか。「創出財」が社会に普及するために必要な制度・規制が完備（改善）するまでの段階を示す指標。",
        "内閣府SIP 2023公募要領 図4 / 慶應義塾大学 栗野研究室 ご提案",
        8,
        [
            ("基礎検討", "創出財が類型化（公共性の有無が検討）され、創出財の影響が及ぶ範囲を特定した状態。", ["創出財を類型化した（公共性の有無を検討した）", "創出財の影響が及ぶ範囲を特定した"]),
            ("制度に求める性質のコンセプト化", "ガバナンスに関する検討チームが形成され、現実的な制約（安全性、国際基準、法規等に加え社会・業界通念等）を踏まえて、制度に求める性質（効率性、公平性、インセンティブ条件）が整理された状態。", ["ガバナンスに関する検討チームを形成した", "現実的な制約（安全性・国際基準・法規・社会/業界通念等）を整理した", "制度に求める性質（効率性・公平性・インセンティブ条件）を整理した"]),
            ("評価", "制度に求める性質を現制度が満たしているかを評価している状態。", ["制度に求める性質を現行制度が満たしているかを評価している"]),
            ("制度のコンセプト化", "現制度で不十分な場合、レベル2で求める性質を満たす制度（法制度の解釈変更・規制改革、規格化・標準化、ガイドライン等）を考案できた状態。", ["現行制度の不足を特定した", "求める性質を満たす制度案（解釈変更/規制改革/規格化/標準化/ガイドライン等）を考案できた"]),
            ("実証", "実証実験（フィールド実験、被験者実験、シミュレーション実験等）を通して、レベル2で求める性質に適した制度が特定された状態。制度の有効性が確認されるまで、仮説と実証が繰り返されている状態。", ["制度案の実証実験を行った（フィールド/被験者/シミュレーション等）", "求める性質に適した制度が特定された（仮説と実証を反復している）"]),
            ("導入計画", "上記の実験結果を基に、省庁・自治体・民間企業等を含む関係機関が具体的な導入計画を策定できた状態。", ["関係機関（省庁/自治体/民間企業等）を巻き込んだ", "具体的な制度導入計画を策定できた"]),
            ("展開と評価", "上記ガバナンスに係る内容が実際に導入され、データに基づいて評価・改善されながら、段階的に展開されている状態。", ["制度が実際に導入された", "データに基づき評価・改善しながら段階的に展開している"]),
            ("安定運用", "上記ガバナンスに係る内容が社会全体に周知され、運用とチェック機能が適切に機能している状態。", ["制度が社会全体に周知された", "運用とチェック機能が適切に機能している"])
        ]
    ),
    .srl: amdOSParityXRLDefinition(
        .srl,
        "社会（コミュニティ）成熟度レベル — 受容しようと思えるか。「ある技術」そのもの、或いは創出財の社会（コミュニティ）受容性を高め、社会実装し、一定の普及水準に達する段階を示す指標。",
        "内閣府SIP 2023公募要領 図5 / 慶應義塾大学 栗野研究室 ご提案",
        8,
        [
            ("基礎検討", "創出財によって実現される社会像やその意義が示され、全ての人々に直接的に与えるリターン・コスト（倫理性・公平性を含む）が金銭・非金銭の両面から検討された状態。", ["創出財が実現する社会像・意義を示した", "人々に与えるリターン・コスト（倫理性・公平性含む）を金銭/非金銭の両面で検討した"]),
            ("仮説", "創出財が与えるリターンへの理解度、コストの許容度、実装の実現可能性を高めるための施策について仮説が立てられている状態。", ["リターンへの理解度・コストの許容度・実装可能性を高める施策の仮説がある"]),
            ("検証", "初期実装コミュニティの人々にとって、上記の施策が有効であることが、プレゼンテーション、インタビュー、アンケート等で検証されている状態。施策の有効性が確認されるまで、仮説と検証が繰り返されている状態。", ["初期実装コミュニティを特定した", "施策の有効性をプレゼン/インタビュー/アンケート等で検証している（仮説と検証を反復）"]),
            ("初期検討", "初期実装コミュニティの人々のリターンへの理解度、コストへの許容度を高める施策が（消費体験、消費疑似体験、説明会等）検討された状態。", ["理解度・許容度を高める施策（消費体験/疑似体験/説明会等）を検討した"]),
            ("実証", "初期実装コミュニティに上記の施策を実施・検証し、人々がリターン・コストを含めて創出財の受け入れを許容した状態。", ["初期実装コミュニティで施策を実施・検証した", "人々がリターン・コストを含めて創出財の受け入れを許容した"]),
            ("普及計画", "実証から得たフィードバックやデータを検証し、施策を改善しながら、より一般的にコミュニティの人々が創出財を許容するための普及計画が策定された状態。", ["実証のフィードバック/データを検証し施策を改善した", "より一般的な普及計画を策定した"]),
            ("スケール", "上記の普及計画が実行され、創出財が、コミュニティに合わせて修正・再発明されながら、受け入れが許容される範囲が拡大している状態。", ["普及計画を実行している", "創出財がコミュニティに合わせ修正・再発明され、受容範囲が拡大している"]),
            ("市場への浸透", "創出財が、最終的に目標とするスケールで受容され、継続的に生産・消費（利用）されている状態。", ["目標スケールで受容された", "継続的に生産・消費（利用）されている"])
        ]
    ),
    .hrl: amdOSParityXRLDefinition(
        .hrl,
        "人材成熟度レベル — 実装に必要な人材は揃っているか。「ある技術」を利用した事業が社会に普及するために必要な人的資源の涵養と活用の手順を示す指標。",
        "内閣府SIP 2023公募要領 図6 / 慶應義塾大学 栗野研究室 ご提案",
        8,
        [
            ("基礎検討", "創出財を作り出すうえで必要となるコア人材※のスキル要素が検討された状態。※財の特長に係るスキルを保有する人材", ["創出財を作るのに必要なコア人材のスキル要素を検討した"]),
            ("仮説", "コア人材のスキル要素に加え、事業モデルの実施に必要なスキル要素群の仮説が立てられた状態。目的に賛同し、スキル要素群や事業領域に精通した人材等でのチーミング、育成（学びなおし）等の対応策の仮説が立てられた状態。", ["事業モデル実施に必要なスキル要素群の仮説がある", "チーミング・育成（学びなおし）等の対応策の仮説がある"]),
            ("検証", "シュミレーションや実業務（OJT）等を通じて、上記の仮説や対応策（スキル要素群の過不足、チーミングの適正等）が検証されている状態。有効性が確認されるまで仮説と検証が繰り返されている状態。", ["シミュレーション/実業務（OJT）でスキル要素群の過不足・チーミング適正を検証している（仮説と検証を反復している）"]),
            ("初期テスト", "初期テストの実施を通して、上記の仮説や対応策が検討され、必要に応じて実装に重要な人材が補充された状態。育成（学びなおし）等の対応策が上記に連動して実施されている状態。", ["初期テストを通じて仮説・対応策を検討した", "必要に応じて実装に重要な人材を補充した", "育成（学びなおし）を連動して実施している"]),
            ("実証", "実証試験の実施を通して、上記の仮説や対応策が検討され、必要に応じて実装に重要な人材が補充された状態。育成（学びなおし）等の対応策が上記に連動して実施されている状態。", ["実証試験を通じて仮説・対応策を検討した", "必要に応じて実装に重要な人材を補充した", "育成を連動して実施している"]),
            ("実施計画", "当該領域において必要な人材のスキル要素群と必要量、教育方針と手段、マッチング手法が明らかとなり、実施に向けた計画が策定された状態。", ["必要な人材のスキル要素群と必要量を明確化した", "教育方針・手段・マッチング手法を定めた", "実施に向けた計画を策定した"]),
            ("スケール", "当該領域において必要な人材の教育環境の整備が進むとともに、それら人材が社会で最適にマッチングされながら活躍の場が拡がる状態。", ["必要人材の教育環境の整備が進んでいる", "人材が社会で最適にマッチングされ活躍の場が拡がっている"]),
            ("安定的な人材輩出", "当該領域において必要な人材の輩出が社会全体で行われ、適切な活用がなされている状態。また、スキル要素群の高度化が図られている状態。", ["必要人材の輩出が社会全体で行われている", "適切な活用がなされ、スキル要素群の高度化が図られている"])
        ]
    )
]

private struct AMDOSParityXRLChecklistPanel: View {
    let projectId: String
    let latestInput: AMDOSParityScoreInput?
    let onReload: () async -> Void
    let onMessage: (String) -> Void
    @State private var activeAxis: AMDOSParityXRLChecklistAxis = .trl
    @State private var checklist: [String: [String: [Bool]]] = [:]
    @State private var dirty = false
    @State private var saveState = "idle"
    @State private var errorMessage: String?

    private var definition: AMDOSParityXRLDefinition { amdOSParityXRLDefinitions[activeAxis]! }
    private var derivedLevels: [String: Double] {
        Dictionary(uniqueKeysWithValues: AMDOSParityXRLChecklistAxis.allCases.map { axis in
            (axis.rawValue, Double(derivedLevel(for: axis)))
        })
    }

    var body: some View {
        AMDOSSectionCard("XRL 観測チェックリスト", systemImage: "checklist") {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("内閣府 SIP 2023 公募要領の原典項目をチェックしてXRLを判定する。達成レベルは、下から全項目が連続して満たされた最大レベル。")
                        .font(.caption)
                        .foregroundStyle(AMDOSDesign.muted)
                    if latestInput == nil {
                        Text("評価行がまだない。PWAと同じく、先にAMD Scoreの評価行を作成してから使う。")
                            .font(.caption)
                            .foregroundStyle(AMDOSDesign.warning)
                    }
                    if let errorMessage { Text(errorMessage).font(.caption).foregroundStyle(.red) }
                }
                Spacer()
                Button(saveState == "saving" ? "保存中…" : (saveState == "done" && !dirty ? "保存済み ✓" : "チェックを保存"), action: save)
                    .buttonStyle(.borderedProminent)
                    .disabled(!dirty || saveState == "saving" || latestInput == nil)
            }
            HStack(spacing: 6) {
                ForEach(AMDOSParityXRLChecklistAxis.allCases) { axis in
                    let axisDefinition = amdOSParityXRLDefinitions[axis]!
                    Button {
                        activeAxis = axis
                    } label: {
                        Text("\(axis.rawValue.uppercased())  Lv.\(derivedLevel(for: axis))/\(axisDefinition.maxLevel)")
                            .font(.caption.monospacedDigit().weight(.semibold))
                            .padding(.horizontal, 9)
                            .padding(.vertical, 6)
                            .foregroundStyle(axis == activeAxis ? .white : axis.color)
                            .background(axis == activeAxis ? axis.color : Color.clear, in: RoundedRectangle(cornerRadius: 7))
                            .overlay(RoundedRectangle(cornerRadius: 7).stroke(axis.color.opacity(0.45)))
                    }
                    .buttonStyle(.plain)
                }
            }
            VStack(alignment: .leading, spacing: 3) {
                Text("\(definition.axisName)：\(definition.axisDescription)").font(.caption)
                Text("出典: \(definition.source)").font(.caption2).foregroundStyle(AMDOSDesign.muted)
            }
            ForEach(definition.levels) { level in
                let allChecked = level.checklist.indices.allSatisfy { isChecked(axis: activeAxis, level: level.level, item: $0) }
                let achieved = derivedLevel(for: activeAxis) >= level.level
                AMDOSCard {
                    VStack(alignment: .leading, spacing: 7) {
                        HStack(spacing: 7) {
                            Text("Lv.\(level.level)")
                                .font(.caption.monospacedDigit().weight(.bold))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 3)
                                .background(achieved ? AMDOSDesign.success : activeAxis.color, in: RoundedRectangle(cornerRadius: 5))
                            Text(level.label).font(.callout.weight(.semibold))
                            if allChecked { Text("✓ 達成").font(.caption).foregroundStyle(AMDOSDesign.success) }
                        }
                        Text(level.description).font(.caption).foregroundStyle(AMDOSDesign.muted)
                        ForEach(level.checklist.indices, id: \.self) { index in
                            Toggle(isOn: binding(axis: activeAxis, level: level, item: index)) {
                                Text(level.checklist[index]).font(.callout)
                            }
                            .toggleStyle(.checkbox)
                        }
                    }
                }
            }
        }
        .onAppear { reset(from: latestInput) }
        .onChange(of: latestInput?.id) { _, _ in reset(from: latestInput) }
    }

    private func derivedLevel(for axis: AMDOSParityXRLChecklistAxis) -> Int {
        guard let definition = amdOSParityXRLDefinitions[axis] else { return 0 }
        for level in definition.levels {
            let checks = checklist[axis.rawValue]?[String(level.level)]
            let complete = !level.checklist.isEmpty && level.checklist.indices.allSatisfy { checks?[safe: $0] == true }
            if !complete { return level.level - 1 }
        }
        return definition.maxLevel
    }

    private func isChecked(axis: AMDOSParityXRLChecklistAxis, level: Int, item: Int) -> Bool {
        checklist[axis.rawValue]?[String(level)]?[safe: item] == true
    }

    private func binding(axis: AMDOSParityXRLChecklistAxis, level: AMDOSParityXRLLevelDefinition, item: Int) -> Binding<Bool> {
        Binding(
            get: { isChecked(axis: axis, level: level.level, item: item) },
            set: { value in setChecked(axis: axis, level: level, item: item, value: value) }
        )
    }

    private func setChecked(axis: AMDOSParityXRLChecklistAxis, level: AMDOSParityXRLLevelDefinition, item: Int, value: Bool) {
        var next = checklist
        var byLevel = next[axis.rawValue] ?? [:]
        var values = byLevel[String(level.level)] ?? Array(repeating: false, count: level.checklist.count)
        while values.count < level.checklist.count { values.append(false) }
        values[item] = value
        byLevel[String(level.level)] = values
        next[axis.rawValue] = byLevel
        checklist = next
        dirty = true
        saveState = "idle"
        errorMessage = nil
    }

    private func reset(from input: AMDOSParityScoreInput?) {
        checklist = input?.xrlChecklist ?? [:]
        dirty = false
        saveState = "idle"
        errorMessage = nil
    }

    private func save() {
        guard let latestInput else {
            errorMessage = "評価行がないため保存できない"
            saveState = "error"
            return
        }
        let currentChecklist = checklist
        let currentLevels = derivedLevels
        saveState = "saving"
        errorMessage = nil
        Task {
            do {
                _ = try await AMDOSRESTClient.shared.upsertTable(
                    table: "amd_score_inputs",
                    onConflict: "project_id,evaluated_at",
                    body: AMDOSParityScoreInputUpsert(latestInput, checklist: currentChecklist, levels: currentLevels)
                )
                saveState = "done"
                dirty = false
                await onReload()
                onMessage("XRLチェックを保存して、PWAと同じ評価行を再読込したよ")
            } catch {
                saveState = "error"
                errorMessage = error.localizedDescription
                onMessage(error.localizedDescription)
            }
        }
    }
}

private extension Array {
    subscript(safe index: Int) -> Element? { indices.contains(index) ? self[index] : nil }
}

private struct AMDOSParityScoreEvidenceView: View {
    let latest: AMDOSParityScoreInput
    let legacy: AMDOSParityLegacyScore
    let primary: AMDOSParityPrimaryScore

    var body: some View {
        AMDOSSectionCard("評価の根拠と律速軸", systemImage: "doc.text.magnifyingglass") {
            HStack {
                AMDOSMetricTile(label: "Legacy score", value: String(Int(legacy.score.rounded())), detail: "K=\(String(format: "%.3f", legacy.k))")
                AMDOSMetricTile(label: "律速軸", value: legacy.bottleneck, detail: "α / (X+1) が最大", tint: AMDOSDesign.warning)
                AMDOSMetricTile(label: "P/R_net", value: primary.status == "ready" ? "ready" : "missing", detail: primary.missingAxes.joined(separator: " / "))
            }
            VStack(alignment: .leading, spacing: 5) {
                Text("μ根拠").font(.headline)
                ForEach([("μ_A", latest.muNotes?.value(for: "a")), ("μ_I", latest.muNotes?.value(for: "i")), ("μ_G", latest.muNotes?.value(for: "g"))], id: \.0) { label, note in
                    AMDOSLineItem(title: label, subtitle: note ?? "根拠未登録", status: note == nil ? "未登録" : "source")
                }
                Text("XRL / FRL根拠").font(.headline).padding(.top, 6)
                ForEach([("TRL", latest.xrlNotes?.value(for: "trl")), ("BRL", latest.xrlNotes?.value(for: "brl")), ("GRL", latest.xrlNotes?.value(for: "grl")), ("SRL", latest.xrlNotes?.value(for: "srl")), ("HRL", latest.xrlNotes?.value(for: "hrl")), ("FRL", latest.frlNotes), ("FRL capability", latest.frlCapNotes)], id: \.0) { label, note in
                    AMDOSLineItem(title: label, subtitle: note ?? "根拠未登録", status: note == nil ? "未登録" : "source")
                }
                if let notes = latest.notes?.trimmedNonEmpty { Text("評価メモ: \(notes)").font(.caption) }
                if let evaluator = latest.evaluator?.trimmedNonEmpty { Text("評価者: \(evaluator)").font(.caption).foregroundStyle(AMDOSDesign.muted) }
            }
        }
    }
}

private struct AMDOSParityScoreSeriesView: View {
    let inputs: [AMDOSParityScoreInput]
    let alpha: [String: Double]

    var body: some View {
        AMDOSSectionCard("評価時系列", systemImage: "chart.xyaxis.line") {
            if inputs.filter({ $0.muA != nil && $0.muI != nil && $0.muG != nil }).isEmpty {
                Text("評価時系列がありません").foregroundStyle(AMDOSDesign.muted)
            } else {
                Canvas { context, size in
                    let rows = inputs.filter { $0.muA != nil && $0.muI != nil && $0.muG != nil }
                    let scores = rows.map { AMDOSParityScoreMath.legacy($0, alpha: alpha).score }
                    let maxScore = max(scores.max() ?? 1, 1)
                    for step in 0...4 {
                        let y = size.height * CGFloat(step) / 4
                        var grid = Path(); grid.move(to: CGPoint(x: 0, y: y)); grid.addLine(to: CGPoint(x: size.width, y: y)); context.stroke(grid, with: .color(AMDOSDesign.border), lineWidth: 1)
                    }
                    var path = Path()
                    for (index, row) in rows.enumerated() {
                        let score = AMDOSParityScoreMath.legacy(row, alpha: alpha).score
                        let x = rows.count == 1 ? size.width / 2 : size.width * CGFloat(index) / CGFloat(rows.count - 1)
                        let y = size.height * (1 - CGFloat(log10(max(score, 1)) / log10(maxScore)))
                        if index == 0 { path.move(to: CGPoint(x: x, y: y)) } else { path.addLine(to: CGPoint(x: x, y: y)) }
                        context.fill(Path(ellipseIn: CGRect(x: x - 4, y: y - 4, width: 8, height: 8)), with: .color(AMDOSDesign.blue))
                        context.draw(Text(String(row.evaluatedAt.prefix(10))).font(.caption2), at: CGPoint(x: x, y: size.height - 8))
                    }
                    context.stroke(path, with: .color(AMDOSDesign.blue), lineWidth: 2)
                }
                .frame(minHeight: 230)
                .background(AMDOSDesign.panel, in: RoundedRectangle(cornerRadius: 12))
                Text("Legacy AMD score（対数目盛）。評価行の実データだけを描画する。SPSはP/R_netが揃った行だけ算出する。")
                    .font(.caption2)
                    .foregroundStyle(AMDOSDesign.muted)
            }
        }
    }
}

struct AMDOSParityAMDScoreRetrofitView: View {
    @StateObject private var store = AMDOSParityScoreStore()
    @State private var alpha: [String: Double] = AMDOSParityScoreMath.defaultAlpha

    private var rows: [AMDOSParityScoreListRow] {
        store.data.ventures.map { venture in
            let latest = store.latestInput(for: venture.projectId)
            let legacy = latest.map { AMDOSParityScoreMath.legacy($0, alpha: store.data.alpha) }
            let primary = latest.map { row in
                let resolved = store.resolvedPrs(for: row)
                return AMDOSParityScoreMath.primary(row, alpha: store.data.alpha, p: resolved.p, rNet: resolved.rNet)
            }
            return AMDOSParityScoreListRow(id: venture.projectId, projectId: venture.projectId, projectName: store.projectName(venture.projectId), status: store.projectStatus(venture.projectId), lane: venture.lane ?? "未分類", latest: latest, legacy: legacy, primary: primary)
        }
    }

    var body: some View {
        AMDOSPageScaffold(eyebrow: "AMD SCORE RETROFIT", title: "SPS Review / Legacy Alpha", subtitle: "PWA AmdScoreRetrofitと同じく、αを変更したときの全PJ Legacy scoreをシミュレーションし、保存する") {
            AMDOSStateNotice(state: store.state) { Task { await store.load(); alpha = store.data.alpha } }
            AMDOSSectionCard("Legacy AMD α（比較用）", systemImage: "slider.horizontal.3") {
                Text("αは全PJのlegacy AMD比較値に同時に効く。入力を動かすと下の各PJの新scoreを再計算し、保存は現役αを閉じて新しい行を挿入する。")
                    .font(.caption).foregroundStyle(AMDOSDesign.muted)
                ForEach(AMDOSParityScoreMath.axes, id: \.self) { axis in
                    HStack {
                        Text(axis == "sigma_SU" ? "α_σ" : "α_\(axis)").frame(width: 75, alignment: .leading).font(.caption.monospaced())
                        Slider(value: alphaBinding(axis), in: 0...2, step: 0.05)
                        Text(String(format: "%.2f", alpha[axis] ?? 0)).font(.caption.monospacedDigit()).frame(width: 48, alignment: .trailing)
                    }
                }
                HStack {
                    Text("Σα = \(String(format: "%.2f", activeAlphaSum)) · k = \(String(format: "%.4f", 100_000 / pow(10, activeAlphaSum)))").font(.caption.monospaced())
                    Spacer()
                    Button("現役αに戻す") { alpha = store.data.alpha }
                    Button("新しいαを保存") { Task { await store.saveAlpha(alpha) } }.buttonStyle(.borderedProminent)
                }
            }
            AMDOSSectionCard("全PJシミュレーション", systemImage: "chart.bar.xaxis") {
                ForEach(rows) { row in
                    let current = row.latest.map { AMDOSParityScoreMath.legacy($0, alpha: store.data.alpha) }
                    let proposed = row.latest.map { AMDOSParityScoreMath.legacy($0, alpha: alpha) }
                    AMDOSCard {
                        HStack {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(row.projectName).font(.headline)
                                Text("\(row.projectId) · \(row.lane) · \(row.primary?.status ?? "評価なし")").font(.caption).foregroundStyle(AMDOSDesign.muted)
                            }
                            Spacer()
                            VStack(alignment: .trailing, spacing: 3) {
                                Text("現役 \(formatScore(current?.score)) → 新 \(formatScore(proposed?.score))").font(.callout.monospacedDigit())
                                if let current, let proposed, current.score > 0 { Text(String(format: "%+.1f%%", (proposed.score - current.score) / current.score * 100)).font(.caption).foregroundStyle(proposed.score >= current.score ? AMDOSDesign.success : AMDOSDesign.warning) }
                            }
                        }
                    }
                }
            }
            if let message = store.message { Text(message).font(.caption).foregroundStyle(AMDOSDesign.warning) }
        }
        .task { await store.load(); alpha = store.data.alpha }
    }

    private var activeAlphaSum: Double { AMDOSParityScoreMath.axes.reduce(0) { $0 + (alpha[$1] ?? 0) } }
    private func alphaBinding(_ axis: String) -> Binding<Double> { Binding(get: { alpha[axis] ?? 0 }, set: { alpha[axis] = $0 }) }
    private func formatScore(_ value: Double?) -> String { guard let value else { return "—" }; return value < 1 ? String(format: "%.2f", value) : String(Int(value.rounded())) }
}
