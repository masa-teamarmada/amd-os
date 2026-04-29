import SwiftUI

/// Step 2「報告会日程調整」ネイティブSheet
/// 3パターン表示:
///   - 未完了: 翌月第1週の空き枠一覧 → タップで会議登録
///   - done + no href: "cpShowMeetingInfo('ISO')" からISO日時をparseして確定済み表示
///   - done + href: CalendarURL直接open（このSheetには来ない）
struct MeetingStepView: View {
    let step: RoutineStep
    let projectId: String
    let bizYm: String

    @Environment(\.dismiss) private var dismiss

    // スロット選択モード
    @State private var isLoadingSlots = false
    @State private var slots: [MeetingSlot] = []
    @State private var loadError: String? = nil
    @State private var isScheduling = false
    @State private var toastMessage: String? = nil
    @State private var toastIsError = false
    @State private var pendingSlot: MeetingSlot? = nil

    private var ymLabel: String {
        guard bizYm.count == 6 else { return bizYm }
        let y = String(bizYm.prefix(4))
        let m = Int(bizYm.suffix(2)) ?? 0
        return "\(y)年\(m)月"
    }

    var body: some View {
        NavigationStack {
            Group {
                if step.isDone {
                    confirmedView
                } else {
                    schedulingView
                }
            }
            .navigationTitle("報告会日程調整")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("閉じる") { dismiss() }
                }
            }
        }
        .task {
            if !step.isDone { await loadSlots() }
        }
        .confirmationDialog(
            pendingSlot.map { "「\($0.label)〜（30分）」で報告会を登録しますか？" } ?? "",
            isPresented: Binding(get: { pendingSlot != nil }, set: { if !$0 { pendingSlot = nil } }),
            titleVisibility: .visible
        ) {
            if let slot = pendingSlot {
                Button("登録する") { Task { await confirmSchedule(slot) } }
                Button("キャンセル", role: .cancel) { pendingSlot = nil }
            }
        }
    }

    // MARK: - 確定済み表示

    private var confirmedView: some View {
        ScrollView {
            VStack(spacing: 20) {
                Image(systemName: "calendar.badge.checkmark")
                    .font(.system(size: 48))
                    .foregroundColor(.green)
                    .padding(.top, 32)

                if let isoDate = parseMeetingISO(step.action) {
                    VStack(spacing: 6) {
                        Text("報告会が確定しています")
                            .font(.headline)
                        Text(formatMeetingDate(isoDate))
                            .font(.title3).fontWeight(.semibold)
                            .foregroundColor(.primary)
                        Text("〜（30分）")
                            .font(.subheadline).foregroundStyle(.secondary)
                    }
                } else {
                    Text("報告会が確定済みです")
                        .font(.headline)
                }

                Text("🌙 お疲れさま！")
                    .font(.caption).foregroundStyle(.secondary)

                Spacer()
            }
            .frame(maxWidth: .infinity)
            .padding()
        }
    }

    // MARK: - スロット選択

    @ViewBuilder
    private var schedulingView: some View {
        if isLoadingSlots {
            ProgressView("空き枠を確認中...")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let err = loadError {
            VStack(spacing: 16) {
                Image(systemName: "exclamationmark.triangle")
                    .font(.largeTitle).foregroundColor(.orange)
                Text(err).multilineTextAlignment(.center)
                Button("再試行") { Task { await loadSlots() } }.buttonStyle(.bordered)
            }
            .padding()
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if slots.isEmpty {
            VStack(spacing: 16) {
                Image(systemName: "calendar.badge.exclamationmark")
                    .font(.system(size: 48)).foregroundColor(.orange)
                    .padding(.top, 32)
                Text("翌月第1週に空き枠が見つかりませんでした")
                    .font(.subheadline).multilineTextAlignment(.center)
                Text("直接カレンダーで日程を調整してください")
                    .font(.caption).foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding()
        } else {
            List {
                Section(header: sectionHeader) {
                    ForEach(slots) { slot in
                        slotRow(slot)
                    }
                }
                if let msg = toastMessage {
                    Section {
                        Text(msg)
                            .font(.caption)
                            .foregroundColor(toastIsError ? .red : .green)
                    }
                }
            }
            .listStyle(.insetGrouped)
        }
    }

    private var sectionHeader: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("\(ymLabel)の報告会日程を選択")
            Text("翌月第1週の空き枠（30分）")
                .font(.caption).foregroundStyle(.secondary)
        }
    }

    private func slotRow(_ slot: MeetingSlot) -> some View {
        Button {
            pendingSlot = slot
        } label: {
            HStack {
                Image(systemName: "calendar")
                    .foregroundColor(.accentColor)
                    .frame(width: 24)
                Text(slot.label)
                    .font(.body)
                Spacer()
                if isScheduling {
                    ProgressView()
                } else {
                    Image(systemName: "chevron.right")
                        .font(.caption).foregroundStyle(.tertiary)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(isScheduling)
    }

    // MARK: - API calls

    private func loadSlots() async {
        isLoadingSlots = true
        loadError = nil
        do {
            let result: MeetingSlotsData = try await SupabaseService.shared.callEdgeFunctionGET(
                "meeting-slots",
                params: ["projectId": projectId, "ym": bizYm]
            )
            if result.ok {
                slots = result.slots ?? []
            } else {
                loadError = result.message ?? "空き枠の取得に失敗しました"
            }
        } catch {
            loadError = error.localizedDescription
        }
        isLoadingSlots = false
    }

    private func confirmSchedule(_ slot: MeetingSlot) async {
        pendingSlot = nil
        isScheduling = true
        toastMessage = nil
        do {
            let result: ScheduleMeetingResult = try await SupabaseService.shared.callEdgeFunctionGET(
                "schedule-meeting",
                params: [
                    "projectId": projectId,
                    "ym": bizYm,
                    "startISO": slot.startISO,
                    "endISO": slot.endISO
                ]
            )
            if result.ok {
                toastMessage = result.message ?? "登録しました"
                toastIsError = false
                try? await Task.sleep(nanoseconds: 1_400_000_000)
                dismiss()
            } else {
                toastMessage = result.message ?? "登録に失敗しました"
                toastIsError = true
            }
        } catch {
            toastMessage = error.localizedDescription
            toastIsError = true
        }
        isScheduling = false
    }

    // MARK: - Helpers

    /// "cpShowMeetingInfo('2026-04-10T01:00:00.000Z')" → "2026-04-10T01:00:00.000Z"
    private func parseMeetingISO(_ action: String?) -> String? {
        guard let s = action,
              let start = s.range(of: "('"),
              let end = s.range(of: "')") else { return nil }
        let iso = String(s[start.upperBound..<end.lowerBound])
        return iso.isEmpty ? nil : iso
    }

    /// ISO → "4月10日（木）10:00" (JST)
    private func formatMeetingDate(_ iso: String) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = f.date(from: iso) else { return iso }
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "Asia/Tokyo")!
        let c = cal.dateComponents([.month, .day, .weekday, .hour, .minute], from: date)
        let weekdays = ["日", "月", "火", "水", "木", "金", "土"]
        let wd = c.weekday.map { weekdays[$0 - 1] } ?? ""
        return "\(c.month!)月\(c.day!)日（\(wd)）\(String(format: "%02d", c.hour!)):\(String(format: "%02d", c.minute!))"
    }
}
