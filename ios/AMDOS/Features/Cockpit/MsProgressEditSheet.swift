import SwiftUI

struct MsProgressEditSheet: View {
    let projectId: String
    let milestones: [CockpitMilestone]
    let onSaved: () -> Void

    @State private var progressValues: [String: Double] = [:]
    @State private var isSaving = false
    @State private var saveError: String?
    @Environment(\.dismiss) private var dismiss

    private var targetYm: String { currentYm() }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(milestones) { ms in
                        msRow(ms)
                    }
                } header: {
                    Text("\(ymDisplay(targetYm))の進捗を更新")
                } footer: {
                    Text("スライダーを動かして各MSの累計進捗率を設定してください。5%単位で入力できます。")
                        .font(.caption)
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("MS進捗管理")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("キャンセル") { dismiss() }
                        .disabled(isSaving)
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    if isSaving {
                        ProgressView()
                    } else {
                        Button("保存") { Task { await save() } }
                            .fontWeight(.semibold)
                    }
                }
            }
            .alert("保存エラー", isPresented: .constant(saveError != nil), actions: {
                Button("OK") { saveError = nil }
            }, message: {
                Text(saveError ?? "")
            })
        }
        .onAppear {
            for ms in milestones {
                progressValues[ms.milestoneId] = ms.currentProgressPct
            }
        }
    }

    private func msRow(_ ms: CockpitMilestone) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                // Tag badge
                Text(ms.tagLabel)
                    .font(.system(size: 10, weight: .medium))
                    .padding(.horizontal, 5)
                    .padding(.vertical, 2)
                    .background(ms.tagColor.opacity(0.12))
                    .foregroundStyle(ms.tagColor)
                    .clipShape(RoundedRectangle(cornerRadius: 4))

                Text(ms.title)
                    .font(.subheadline)
                    .lineLimit(2)
                    .foregroundStyle(AMD.text)

                Spacer()

                Text("\(ms.points)pt")
                    .font(.caption)
                    .foregroundStyle(AMD.textSub)
            }

            HStack(spacing: 12) {
                Slider(
                    value: Binding(
                        get: { progressValues[ms.milestoneId] ?? 0 },
                        set: { progressValues[ms.milestoneId] = $0 }
                    ),
                    in: 0...100,
                    step: 5
                )
                .tint(ms.tagColor)

                Text("\(Int(progressValues[ms.milestoneId] ?? 0))%")
                    .font(.system(size: 16, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(AMD.blue)
                    .frame(width: 44, alignment: .trailing)
            }
        }
        .padding(.vertical, 6)
    }

    private func save() async {
        isSaving = true
        saveError = nil
        do {
            for ms in milestones {
                let pct = progressValues[ms.milestoneId] ?? ms.currentProgressPct
                try await SupabaseService.shared.upsertMilestoneProgress(
                    milestoneId: ms.milestoneId,
                    ym: targetYm,
                    progressPct: pct
                )
            }
            dismiss()
            onSaved()
        } catch {
            saveError = error.localizedDescription
        }
        isSaving = false
    }
}
