import Foundation

/// GAS API レスポンスを UserDefaults にキャッシュする軽量サービス
/// - キャッシュキー: action + params の組み合わせ（自動生成）
/// - TTL: デフォルト 10 分（`listProjects` は 10 分、`routineFlowFull` は 5 分）
/// - 書き込み系アクション成功後は `invalidate` で対象キーを削除する
actor CacheService {
    static let shared = CacheService()
    private let defaults = UserDefaults.standard

    // MARK: - Read

    func get(key: String, ttl: TimeInterval) -> Data? {
        let ts = defaults.double(forKey: tsKey(key))
        guard ts > 0, Date().timeIntervalSince1970 - ts < ttl else { return nil }
        return defaults.data(forKey: dataKey(key))
    }

    // MARK: - Write

    func set(key: String, data: Data) {
        defaults.set(data, forKey: dataKey(key))
        defaults.set(Date().timeIntervalSince1970, forKey: tsKey(key))
    }

    // MARK: - Invalidate

    func invalidate(key: String) {
        defaults.removeObject(forKey: dataKey(key))
        defaults.removeObject(forKey: tsKey(key))
    }

    /// action + params の組み合わせからキャッシュキーを生成する
    static func makeKey(action: String, params: [String: String] = [:]) -> String {
        guard !params.isEmpty else { return action }
        let sorted = params.sorted { $0.key < $1.key }.map { "\($0.key)=\($0.value)" }.joined(separator: "&")
        return "\(action)?\(sorted)"
    }

    // MARK: - Private helpers

    private func dataKey(_ key: String) -> String { "gas_cache_data_\(key)" }
    private func tsKey(_ key: String)  -> String { "gas_cache_ts_\(key)" }
}
