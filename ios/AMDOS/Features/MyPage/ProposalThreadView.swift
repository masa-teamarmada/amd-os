import SwiftUI

struct ProposalThreadView: View {
    let proposal: MsProgressProposal
    let myMemberId: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                statusBadge
                if let pct = proposal.suggestedPct {
                    Text("提案進捗 \(Int(pct))%")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(.blue)
                }
                Spacer()
                if let date = proposal.createdAt {
                    Text(formatDate(date))
                        .font(.system(size: 9))
                        .foregroundStyle(.tertiary)
                }
            }
            VStack(alignment: .leading, spacing: 6) {
                ForEach(proposal.messages) { msg in
                    bubble(for: msg)
                }
            }
        }
        .padding(10)
        .background(Color(.tertiarySystemBackground))
        .cornerRadius(10)
    }

    @ViewBuilder
    private var statusBadge: some View {
        switch proposal.status {
        case .pending:
            Label("確認待ち", systemImage: "hourglass")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(.orange)
        case .approved:
            Label("反映済", systemImage: "checkmark.seal.fill")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(.green)
        case .rejected:
            Label("差し戻し", systemImage: "arrow.uturn.left.circle.fill")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(.red)
        }
    }

    @ViewBuilder
    private func bubble(for msg: MsProposalMessage) -> some View {
        let isMine = msg.senderKind == .member
        HStack(alignment: .bottom, spacing: 6) {
            if !isMine {
                avatar(for: msg.senderKind)
            }
            VStack(alignment: isMine ? .trailing : .leading, spacing: 2) {
                if !isMine {
                    Text(senderLabel(for: msg.senderKind))
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(.secondary)
                }
                Text(msg.body)
                    .font(.system(size: 12))
                    .foregroundStyle(isMine ? .white : .primary)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 7)
                    .background(isMine ? Color.blue : Color(.systemGray5))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .frame(maxWidth: 260, alignment: isMine ? .trailing : .leading)
            }
            if isMine { Spacer(minLength: 0) } else { Spacer(minLength: 0) }
            // No avatar on the right side
        }
        .frame(maxWidth: .infinity, alignment: isMine ? .trailing : .leading)
    }

    private func avatar(for kind: MsProposalSenderKind) -> some View {
        let symbol: String = {
            switch kind {
            case .tsukuyomi: return "moon.stars.fill"
            case .admin:     return "person.crop.circle.badge.checkmark"
            case .member:    return "person.fill"
            }
        }()
        let bg: Color = {
            switch kind {
            case .tsukuyomi: return .indigo
            case .admin:     return .gray
            case .member:    return .blue
            }
        }()
        return Image(systemName: symbol)
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(.white)
            .frame(width: 22, height: 22)
            .background(bg.opacity(0.85))
            .clipShape(Circle())
    }

    private func senderLabel(for kind: MsProposalSenderKind) -> String {
        switch kind {
        case .tsukuyomi: return "つくよみ"
        case .admin:     return "Admin"
        case .member:    return "あなた"
        }
    }

    private func formatDate(_ date: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ja_JP")
        f.dateFormat = "M/d HH:mm"
        return f.string(from: date)
    }
}
