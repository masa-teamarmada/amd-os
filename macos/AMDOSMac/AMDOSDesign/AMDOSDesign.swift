import SwiftUI

enum AMDOSDesign {
    static let blue = Color(red: 0.0, green: 0.51, blue: 0.89)
    static let blueDark = Color(red: 0.0, green: 0.34, blue: 0.62)
    static let page = Color(nsColor: .windowBackgroundColor)
    static let panel = Color(nsColor: .controlBackgroundColor)
    static let ink = Color.primary
    static let muted = Color.secondary
    static let border = Color.primary.opacity(0.10)
    static let warning = Color.orange
    static let success = Color.green

    static let spacing: CGFloat = 16
    static let radius: CGFloat = 12

    static func statusColor(_ status: AMDOSParityStatus) -> Color {
        switch status {
        case .implemented: return success
        case .shell: return warning
        case .pending: return muted
        }
    }
}

struct AMDOSCard<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) { self.content = content() }

    var body: some View {
        content
            .padding(AMDOSDesign.spacing)
            .background(AMDOSDesign.panel)
            .overlay(RoundedRectangle(cornerRadius: AMDOSDesign.radius).stroke(AMDOSDesign.border))
            .clipShape(RoundedRectangle(cornerRadius: AMDOSDesign.radius))
    }
}

struct AMDOSStatusBadge: View {
    let status: AMDOSParityStatus

    var body: some View {
        Label(status.rawValue, systemImage: status == .implemented ? "checkmark.circle.fill" : "circle.dashed")
            .font(.caption.weight(.semibold))
            .foregroundStyle(AMDOSDesign.statusColor(status))
            .padding(.horizontal, 8)
            .padding(.vertical, 5)
            .background(AMDOSDesign.statusColor(status).opacity(0.12), in: Capsule())
    }
}

