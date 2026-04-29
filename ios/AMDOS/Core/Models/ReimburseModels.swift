import Foundation

// MARK: - リスト

struct ReimburseListData: Decodable {
    let ok: Bool
    let items: [ReimburseItem]
}

struct ReimburseItem: Decodable, Identifiable {
    var id: String { reimbursementId }
    let reimbursementId: String
    let date: String
    let projectId: String
    let projectName: String
    let category: String
    let categoryLabel: String
    let amount: Double
    let taxRate: Double
    let desc: String
    let status: String
    let statusLabel: String
    let pmApproved: Bool
    let pmApprovedByLabel: String?
    let pmApprovedAt: String?
    let adminApproved: Bool
    let adminApprovedByLabel: String?
    let adminApprovedAt: String?
    let canEdit: Bool
    let canDelete: Bool
    let transportMode: String?
    let transportFrom: String?
    let transportTo: String?
    let transportTrip: String?

    init(reimbursementId: String, date: String, projectId: String, projectName: String,
         category: String, categoryLabel: String, amount: Double, taxRate: Double,
         desc: String, status: String, statusLabel: String,
         pmApproved: Bool, pmApprovedByLabel: String?, pmApprovedAt: String?,
         adminApproved: Bool, adminApprovedByLabel: String?, adminApprovedAt: String?,
         canEdit: Bool, canDelete: Bool,
         transportMode: String?, transportFrom: String?, transportTo: String?, transportTrip: String?) {
        self.reimbursementId = reimbursementId; self.date = date
        self.projectId = projectId; self.projectName = projectName
        self.category = category; self.categoryLabel = categoryLabel
        self.amount = amount; self.taxRate = taxRate; self.desc = desc
        self.status = status; self.statusLabel = statusLabel
        self.pmApproved = pmApproved; self.pmApprovedByLabel = pmApprovedByLabel; self.pmApprovedAt = pmApprovedAt
        self.adminApproved = adminApproved; self.adminApprovedByLabel = adminApprovedByLabel; self.adminApprovedAt = adminApprovedAt
        self.canEdit = canEdit; self.canDelete = canDelete
        self.transportMode = transportMode; self.transportFrom = transportFrom
        self.transportTo = transportTo; self.transportTrip = transportTrip
    }

    /// 表示用金額（整数円）
    var amountForDisplay: Int { Int(amount) }

    /// 往復の場合、入力時の片道金額に戻す
    var amountForEdit: Double {
        if (transportTrip ?? "") == "round" && amount > 0 { return amount / 2 }
        return amount
    }

    var statusColor: StatusColor {
        switch status {
        case "submitted":  return .orange
        case "pmApproved": return .blue
        case "approved":   return .green
        case "rejected":   return .red
        case "paid":       return .purple
        default:           return .gray
        }
    }

    enum StatusColor { case orange, blue, green, red, purple, gray }
}

// MARK: - 保存 / 更新 / 削除

struct SaveReimburseResult: Decodable {
    let ok: Bool
    let reimbursementId: String?
    let message: String?
}

struct UpdateReimburseResult: Decodable {
    let ok: Bool
    let message: String?
}

struct DeleteReimburseResult: Decodable {
    let ok: Bool
    let message: String?
}

// MARK: - フォーム入力値

struct ReimburseFormInput {
    var projectId: String = ""
    var projectName: String = ""
    var date: Date = Date()
    var category: ReimburseCategory = .other
    var amount: String = ""
    var taxRate: TaxRate = .ten
    var desc: String = ""
    // 交通費専用
    var transportMode: TransportMode = .train
    var transportFrom: String = ""
    var transportTo: String = ""
    var transportTrip: TransportTrip = .oneway

    var amountDouble: Double? { Double(amount.replacingOccurrences(of: ",", with: "")) }

    var params: [String: String] {
        var p: [String: String] = [
            "projectId": projectId,
            "date": dateString,
            "category": category.rawValue,
            "amount": String(amountDouble ?? 0),
            "taxRate": taxRate.rawValue,
            "desc": desc
        ]
        if category == .transport {
            p["transportMode"] = transportMode.rawValue
            p["transportFrom"] = transportFrom
            p["transportTo"]   = transportTo
            p["transportTrip"] = transportTrip.rawValue
        }
        return p
    }

    var dateString: String {
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd"
        return fmt.string(from: date)
    }

    var validationError: String? {
        if projectId.isEmpty { return "PJを選んで" }
        if desc.isEmpty      { return "摘要が空っぽ" }
        guard let amt = amountDouble, amt > 0 else { return "金額が変（0より大きくして）" }
        if category == .transport {
            if transportFrom.isEmpty { return "出発が空っぽ" }
            if transportTo.isEmpty   { return "到着が空っぽ" }
        }
        return nil
    }
}

// MARK: - Enums

enum ReimburseCategory: String, CaseIterable {
    case transport = "transport"
    case lodging   = "lodging"
    case supplies  = "supplies"
    case meal      = "meal"
    case other     = "other"

    var label: String {
        switch self {
        case .transport: return "交通費"
        case .lodging:   return "宿泊"
        case .supplies:  return "消耗品"
        case .meal:      return "会議費"
        case .other:     return "その他"
        }
    }
}

enum TaxRate: String, CaseIterable {
    case ten    = "0.1"
    case eight  = "0.08"
    case zero   = "0"

    var label: String {
        switch self {
        case .ten:   return "10%"
        case .eight: return "8%"
        case .zero:  return "非課税"
        }
    }

    var doubleValue: Double {
        switch self {
        case .ten:   return 0.10
        case .eight: return 0.08
        case .zero:  return 0
        }
    }

    static func from(_ d: Double) -> TaxRate {
        if d == 0.08 { return .eight }
        if d == 0    { return .zero }
        return .ten
    }
}

enum TransportMode: String, CaseIterable {
    case train = "train"
    case bus   = "bus"
    case taxi  = "taxi"
    case car   = "car"
    case other = "other"

    var label: String {
        switch self {
        case .train: return "電車"
        case .bus:   return "バス"
        case .taxi:  return "タクシー"
        case .car:   return "自家用車"
        case .other: return "その他"
        }
    }
}

enum TransportTrip: String, CaseIterable {
    case oneway = "oneway"
    case round  = "round"

    var label: String {
        switch self {
        case .oneway: return "片道"
        case .round:  return "往復"
        }
    }
}
