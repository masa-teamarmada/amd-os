import SwiftUI

struct HomeView: View {
    @EnvironmentObject var authService: AuthService

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // 今月のサマリー（ym表示）
                    HomeSummaryCard()

                    // 直近のアクション必要項目
                    HomeActionItems()
                }
                .padding()
            }
            .navigationTitle("AMD OS")
            .navigationBarTitleDisplayMode(.large)
        }
    }
}

struct HomeSummaryCard: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("今月のサマリー")
                .font(.headline)
            Text("データを読み込み中...")
                .foregroundStyle(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

struct HomeActionItems: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("アクション必要")
                .font(.headline)
            Text("承認待ちタスクや請求確認があればここに表示されます")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}
