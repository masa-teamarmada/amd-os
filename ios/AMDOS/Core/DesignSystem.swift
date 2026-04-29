import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

enum AMD {
    // Brand
    static let blue     = Color(r: 0,   g: 130, b: 227)   // #0082E3 (logo)
    static let blueDark = Color(r: 0,   g: 107, b: 190)   // #006BBE
    static let blueTint = Color(r: 230, g: 242, b: 252)   // #E6F2FC
    static let gray     = Color(r: 85,  g: 85,  b: 85)    // #555555 (logo gray)

    // Surfaces
    static let bgPage   = Color(r: 245, g: 247, b: 251)   // #F5F7FB
    static let bgDeep   = Color(r: 238, g: 242, b: 247)   // #EEF2F7
    static let card     = Color(.systemBackground)
    static let divider  = Color(red: 60/255, green: 60/255, blue: 67/255).opacity(0.10)

    // Text hierarchy
    static let text          = Color(r: 14,  g: 22,  b: 36)    // #0E1624
    static let textSub       = Color(r: 91,  g: 101, b: 115)   // #5B6573
    static let textTertiary  = Color(r: 138, g: 148, b: 163)   // #8A94A3
    static let textQuat      = Color(r: 174, g: 182, b: 194)   // #AEB6C2

    // Status token — (bg: tint surface, ink: dark for icons/text, solid: saturated fill)
    struct StatusToken { let bg: Color; let ink: Color; let solid: Color }

    static func status(_ key: String) -> StatusToken {
        switch key {
        case "done":
            return StatusToken(
                bg:    Color(r: 230, g: 242, b: 252),
                ink:   Color(r: 0,   g: 107, b: 190),
                solid: blue
            )
        case "current":
            return StatusToken(bg: blue, ink: .white, solid: blue)
        case "warn":
            return StatusToken(
                bg:    Color(r: 255, g: 243, b: 219),
                ink:   Color(r: 138, g: 79,  b: 0),
                solid: Color(r: 242, g: 167, b: 46)
            )
        case "overdue":
            return StatusToken(
                bg:    Color(r: 255, g: 240, b: 224),  // warm orange tint, no red
                ink:   Color(r: 139, g: 48,  b: 0),   // dark deep orange
                solid: Color(r: 230, g: 90,  b: 30)   // deep orange solid
            )
        case "deferred":
            return StatusToken(
                bg:    Color(r: 238, g: 241, b: 245),
                ink:   Color(r: 91,  g: 101, b: 115),
                solid: Color(r: 174, g: 182, b: 194)
            )
        default: // upcoming / future
            return StatusToken(
                bg:    Color(r: 245, g: 247, b: 251),
                ink:   Color(r: 91,  g: 101, b: 115),
                solid: Color(r: 199, g: 205, b: 214)
            )
        }
    }
}

extension Color {
    init(r: Double, g: Double, b: Double) {
        self.init(red: r / 255, green: g / 255, blue: b / 255)
    }
}

// MARK: - Keyboard helpers

#if canImport(UIKit)
/// 入力欄以外をタップしたときにキーボードを閉じるためのフリー関数。
/// Form / ScrollView でも使える。
func amdHideKeyboard() {
    UIApplication.shared.sendAction(
        #selector(UIResponder.resignFirstResponder),
        to: nil, from: nil, for: nil
    )
}

extension View {
    /// 入力欄以外をタップしたらキーボードを閉じる（背景レイヤで吸収するので Form の行タップは生きる）。
    func dismissKeyboardOnTapOutside() -> some View {
        self.background(
            Color.clear
                .contentShape(Rectangle())
                .onTapGesture { amdHideKeyboard() }
                .accessibilityHidden(true)
        )
    }
}
#endif
