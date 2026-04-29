/** 098_MemberStatus_Titles.gs
 * メンバーステータス 称号判定ルール
 * スコア閾値 + メタ情報から自動付与
 */

var TITLE_RULES_ = [
  { key: "initiative_master", label: "イニシアチブマスター", check: function(s) { return s.initiative >= 80; }, reason: "先手力が80以上" },
  { key: "executor",          label: "エグゼキューター",     check: function(s) { return s.execution >= 80; }, reason: "実行力が80以上" },
  { key: "communicator",      label: "コミュニケーター",     check: function(s) { return s.communication >= 80; }, reason: "発信力が80以上" },
  { key: "connector",         label: "コネクター",           check: function(s) { return s.collaboration >= 80; }, reason: "連携力が80以上" },
  { key: "challenger",        label: "チャレンジャー",       check: function(s) { return s.growth >= 80; }, reason: "成長力が80以上" },
  { key: "all_rounder",       label: "オールラウンダー",     check: function(s) { return s.initiative >= 60 && s.execution >= 60 && s.communication >= 60 && s.collaboration >= 60 && s.growth >= 60; }, reason: "全5軸が60以上" },
  { key: "rising_star",       label: "ライジングスター",     check: function(s, meta) {
    if (!meta || !meta.tenureMonths) return false;
    return meta.tenureMonths <= 6 && (s.initiative >= 70 || s.execution >= 70 || s.communication >= 70 || s.collaboration >= 70 || s.growth >= 70);
  }, reason: "在籍6ヶ月以内でいずれかのスコアが70以上" }
];

function memberStatus_computeTitles_(scores, memberMeta) {
  var now = reward_repo_jstNow_();
  var titles = [];

  // 在籍月数を算出
  var tenureMonths = 0;
  if (memberMeta && memberMeta.joinYm) {
    var joinYm = String(memberMeta.joinYm).replace(/[-\/]/g, "").substring(0, 6);
    if (joinYm) {
      tenureMonths = memberStatus_ymDiff_(joinYm, memberStatus_currentYm_());
    }
  }
  var meta = { tenureMonths: tenureMonths };

  for (var i = 0; i < TITLE_RULES_.length; i++) {
    var rule = TITLE_RULES_[i];
    try {
      if (rule.check(scores, meta)) {
        titles.push({
          titleKey: rule.key,
          titleLabel: rule.label,
          reason: rule.reason,
          awardedAtJst: now
        });
      }
    } catch(e) {}
  }

  return titles;
}
