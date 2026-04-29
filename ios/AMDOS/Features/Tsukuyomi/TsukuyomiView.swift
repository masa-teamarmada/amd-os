import SwiftUI

struct TsukuyomiView: View {
    @State private var messages: [TsukuyomiMessage] = []
    @State private var inputText: String = ""
    @State private var selectedProjectId: String? = nil

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // プロジェクト選択（つくよみは全社 or PJ別で回答を変える）
                ProjectSelectorBar(selectedProjectId: $selectedProjectId)

                Divider()

                // メッセージリスト
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            if messages.isEmpty {
                                Text("つくよみに何でも聞いてみて")
                                    .foregroundStyle(.secondary)
                                    .padding(.top, 40)
                            }
                            ForEach(messages) { msg in
                                MessageBubble(message: msg)
                                    .id(msg.id)
                            }
                        }
                        .padding()
                    }
                    .onChange(of: messages.count) {
                        if let last = messages.last {
                            proxy.scrollTo(last.id, anchor: .bottom)
                        }
                    }
                }

                Divider()

                // 入力エリア
                HStack(spacing: 12) {
                    TextField("メッセージ...", text: $inputText, axis: .vertical)
                        .lineLimit(1...5)
                        .textFieldStyle(.roundedBorder)

                    Button {
                        sendMessage()
                    } label: {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.title2)
                    }
                    .disabled(inputText.trimmingCharacters(in: .whitespaces).isEmpty)
                }
                .padding()
            }
            .navigationTitle("つくよみ")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private func sendMessage() {
        let text = inputText.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return }
        inputText = ""
        // TODO: GASApiClient経由でつくよみチャットAPIを叩く
    }
}

struct ProjectSelectorBar: View {
    @Binding var selectedProjectId: String?

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ProjectChip(title: "全社", isSelected: selectedProjectId == nil) {
                    selectedProjectId = nil
                }
                // TODO: プロジェクト一覧をAPIから取得して並べる
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
        }
    }
}

struct ProjectChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.caption)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(isSelected ? Color.accentColor : Color(.systemGray5))
                .foregroundStyle(isSelected ? .white : .primary)
                .clipShape(Capsule())
        }
    }
}

struct MessageBubble: View {
    let message: TsukuyomiMessage

    var body: some View {
        HStack {
            if message.role == .user { Spacer() }
            Text(message.content)
                .padding(12)
                .background(message.role == .user ? Color.accentColor : Color(.systemGray5))
                .foregroundStyle(message.role == .user ? .white : .primary)
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .frame(maxWidth: 280, alignment: message.role == .user ? .trailing : .leading)
            if message.role == .assistant { Spacer() }
        }
    }
}
