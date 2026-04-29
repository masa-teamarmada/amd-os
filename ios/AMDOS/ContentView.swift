import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authService: AuthService

    var body: some View {
        Group {
            if authService.isSignedIn {
                MainTabView()
            } else {
                LoginView()
            }
        }
    }
}
