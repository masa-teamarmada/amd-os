"""SOL sensitivity study: source-backed plans plus labelled deterministic stress cases.

No empirical resource value, success probability, or cash balance is imputed.
Grid proportions are not probabilities. This does not write to the OS database.
"""

from itertools import product
import json
import math
from pathlib import Path

ROOT = Path(__file__).parent
j = json.loads((ROOT / 'inputs.json').read_text())
p = j['planning_inputs']
s = j['stress_inputs']
rate = j['discount_rate']


def df(month):
    return (1 + rate) ** (-month / 12)


def cost_pv(amount, timing):
    if timing == 'first':
        return amount * df(5)
    if timing == 'last':
        return amount * df(17)
    return amount * sum(df(m) for m in range(5, 18)) / 13


def extra_salary_pv(delay_months, retention_share):
    return sum(p['monthly_three_people_yen'] * retention_share * df(m)
               for m in range(18, 18 + delay_months))


def benefit_weight(delay, life_regime):
    if life_regime == 'fixed_60months':
        # Same monthly earning rate, fixed expiry: delayed operating months are lost.
        return sum(df(m) for m in range(delay+1,61))/sum(df(m) for m in range(1,61))
    return df(delay)


def full_margin_and_threshold(cost, timing, delay, retention, outside, friction, affected, life, benefit):
    operating = extra_salary_pv(delay, retention)
    spend = cost_pv(cost, timing)
    extra = friction * cost * df(5)
    weight = df(17) * ((1-affected) + affected * benefit_weight(delay,life))
    total_cost = spend + operating + outside*df(17) + extra
    return benefit*weight-total_cost, total_cost/weight


full = []
for values in product(p['development_cash_yen'], s['payment_timings'], s['delay_months'],
                      s['retention_shares'], s['outside_option_at_completion_yen'],
                      s['additional_execution_fee_shares'], s['affected_benefit_shares'],s['life_regimes']):
    cost, timing, delay, retention, outside, friction, affected,life = values
    margins = {str(b): full_margin_and_threshold(*values, b)[0] for b in s['benefit_at_completion_yen']}
    threshold = full_margin_and_threshold(*values, 0)[1]
    full.append(dict(zip(['development_yen','timing','delay_months','retention_share',
                         'outside_option_yen','fee_share','affected_share','life_regime'], values),
                     threshold_benefit_yen=threshold, margins_yen=margins))

simple = []
for cost, timing in product(p['development_cash_yen'], s['payment_timings']):
    simple.append({'development_yen':cost,'timing':timing,
                   'pv_cost_yen':cost_pv(cost,timing),
                   'required_benefit_at_completion_yen':cost_pv(cost,timing)/df(17)})

two = []
for delay, retention, residual_share, affected_value, extra_cash, purchase_month,life in product(
        s['delay_months'], s['retention_shares'], s['two_unit_residual_shares'],
        s['two_unit_affected_value_yen'], p['two_unit_extra_cash_range_yen'], s['purchase_months'],s['life_regimes']):
    avoided = p['two_unit_avoided_purchase_yen']*df(purchase_month)
    extras = extra_cash*df(17)
    salary = extra_salary_pv(delay,retention)
    residual = residual_share*p['two_unit_avoided_purchase_yen']*df(17)
    delay_loss = affected_value*df(17)*(1-benefit_weight(delay,life))
    two.append({'delay_months':delay,'retention_share':retention,
                'residual_share':residual_share,'affected_value_yen':affected_value,
                'extra_cash_yen':extra_cash,'purchase_month':purchase_month,'life_regime':life,
                'two_minus_four_yen':avoided-extras-salary-residual-delay_loss})


def two_case(delay, retention, residual, affected_value=0, extra_cash=750_000, purchase_month=5,life='movable'):
    return (p['two_unit_avoided_purchase_yen']*df(purchase_month) - extra_cash*df(17)
            - extra_salary_pv(delay,retention)
            - residual*p['two_unit_avoided_purchase_yen']*df(17)
            - affected_value*df(17)*(1-benefit_weight(delay,life)))


def stage_case(stop_chance, delay, good_value, failed_equipment_value, extra_fee,life='movable'):
    equipment=p['ten_l_four_units_yen']
    # Before signal, actions are fixed. Only the stop/continue signal permits branching.
    avoided=equipment*df(5)-(1-stop_chance)*equipment*df(8)
    forfeited=stop_chance*failed_equipment_value*df(17)
    delayed=(1-stop_chance)*good_value*df(17)*(1-benefit_weight(delay,life))
    return avoided-forfeited-delayed-extra_fee*df(8)


stages=[]
for stop,delay,good,residual,fee,life in product(s['stop_chances'], s['delay_months'],
        s['stage_good_value_yen'], s['stage_failed_residual_shares'], s['stage_extra_fees_yen'],s['life_regimes']):
    stages.append({'stop_chance':stop,'delay_months':delay,'good_value_yen':good,
                   'failed_residual_share':residual,'extra_fee_yen':fee,'life_regime':life,
                   'stage_minus_upfront_yen':stage_case(stop,delay,good,
                        residual*p['ten_l_four_units_yen'],fee,life)})

uniform_other=p['other_sales_supply_operations_yen']*sum(df(m) for m in range(5,23))/18
scope=[]
for cost in p['development_cash_yen']:
    a=cost_pv(cost,'uniform')
    repair=p['retest_reserve_yen']*df(17)
    scope.append({'development_yen':cost,'development_pv_yen':a,
                   'other_pv_yen':uniform_other,
                   'whole_base_nominal_yen':cost+p['other_sales_supply_operations_yen'],
                   'whole_base_pv_yen':a+uniform_other,
                   'whole_base_required_benefit_at_completion_yen':(a+uniform_other)/df(17),
                   'whole_if_all_retests_required_benefit_yen':(a+uniform_other+repair)/df(17)})

# Analytical invariants and endpoint counterexamples; no scenario fit to a preferred conclusion.
checks={}
checks['source_salary_reconciles']=p['monthly_three_people_yen']*13==p['thirteen_month_salary_yen']
checks['budget_low_reconciles']=p['base_development_yen']-p['old_license_yen']+p['new_license_cash_yen'][0]==p['development_cash_yen'][0]
checks['budget_high_reconciles']=p['base_development_yen']-p['old_license_yen']+p['new_license_cash_yen'][1]==p['development_cash_yen'][1]
checks['two_units_nominal_saving']=p['two_unit_avoided_purchase_yen']-750_000==4_750_000
checks['four_extra_months_nominal_salary']=p['monthly_three_people_yen']*4==6_900_000
checks['source_allocation_low_reconciles']=p['development_cash_yen'][0]+p['other_sales_supply_operations_yen']+p['retest_reserve_yen']+p['liquidity_reserve_yen']==159_450_000
checks['source_allocation_high_reconciles']=p['development_cash_yen'][1]+p['other_sales_supply_operations_yen']+p['retest_reserve_yen']+p['liquidity_reserve_yen']==169_450_000

anchor_checks=[]
for b in s['common_anchor_value_at_completion_yen']:
    for v1,v0 in [(100_000_000,30_000_000),(40_000_000,80_000_000)]:
        anchor_checks.append(math.isclose((v1-b)-(v0-b),v1-v0,abs_tol=1e-8))
checks['common_anchor_cancels_in_pairwise_difference']=all(anchor_checks)

checks['scope_reconciliation_same_cashflows']=all(math.isclose(
    (200_000_000-uniform_other/df(17))*df(17)-cost_pv(c,'uniform'),
    200_000_000*df(17)-uniform_other-cost_pv(c,'uniform'),abs_tol=1e-6)
    for c in p['development_cash_yen'])
checks['minimal_friction_is_a_condition_not_funding_income']=all(
    math.isclose(full_margin_and_threshold(c,'uniform',0,0,0,0,0,'movable',100_000_000)[0],
        100_000_000*df(17)-cost_pv(c,'uniform'),abs_tol=1e-6)
    for c in p['development_cash_yen'])
checks['large_common_cost_cancels']=all(math.isclose(
    (100_000_000-common)-(80_000_000-common),20_000_000,abs_tol=1e-6)
    for common in [0,20_000_000,100_000_000])
checks['free_signal_without_delay_never_worse']=all(
    stage_case(stop,0,100_000_000,0,0)>=-1e-6 for stop in s['stop_chances'])
checks['stage_rank_can_reverse']=min(x['stage_minus_upfront_yen'] for x in stages)<0<max(x['stage_minus_upfront_yen'] for x in stages)
checks['two_unit_rank_can_reverse']=min(x['two_minus_four_yen'] for x in two)<0<max(x['two_minus_four_yen'] for x in two)
checks['unobserved_resource_values_remain_unobserved']=j['observed_current_y_yen'] is None and j['observed_benefit_value_yen'] is None
checks['positive_common_seed_chance_preserves_sign_without_preentry_cost']=all(
    math.copysign(1,pseed*v)==math.copysign(1,v)
    for pseed,v in product([.1,.5,1],[-20_000_000,20_000_000]))
checks['marginal_salary_only_for_overrun']=extra_salary_pv(0,1)==0
checks['fixed_expiry_loses_at_least_as_much_as_movable_life']=all(benefit_weight(d,'fixed_60months') <= benefit_weight(d,'movable')+1e-9 for d in s['delay_months'])
checks['fixed_expiry_zero_delay_matches']=math.isclose(benefit_weight(0,'fixed_60months'),1)
assert all(checks.values()),checks

for benefit in s['benefit_at_completion_yen']:
    margins=[x['margins_yen'][str(benefit)] for x in full]
    # Fractions of this arbitrary grid would not be estimated probabilities.

results={
    'status':'conditional_sensitivity_not_empirical_valuation',
    'conclusion':'Investment ranking is not established as stable by the available SOL inputs.',
    'scenario_counts':{'full':len(full),'two_units':len(two),'staged':len(stages)},
    'simple_cost_timing_cases':simple,
    'full_threshold_min':min(full,key=lambda x:x['threshold_benefit_yen']),
    'full_threshold_max':max(full,key=lambda x:x['threshold_benefit_yen']),
    'full_margins_by_hypothetical_benefit':{
        str(b):{'min':min(x['margins_yen'][str(b)] for x in full),
                'max':max(x['margins_yen'][str(b)] for x in full)}
        for b in s['benefit_at_completion_yen']},
    'two_unit_examples':{
        'same_end_no_lost_residual':two_case(0,0,0),
        'four_month_overrun_full_team_no_other_loss':two_case(4,1,0),
        'same_end_full_independent_equipment_residual':two_case(0,0,1),
        'four_month_half_team_100m_affected':two_case(4,.5,0,100_000_000),
        'four_month_half_team_100m_fixed_expiry':two_case(4,.5,0,100_000_000,life='fixed_60months')},
    'two_unit_grid_range_yen':[min(x['two_minus_four_yen'] for x in two),max(x['two_minus_four_yen'] for x in two)],
    'staged_examples':{
        'stop25_no_delay_no_residual_fee500k':stage_case(.25,0,100_000_000,0,500_000),
        'stop10_delay4_no_residual_fee500k':stage_case(.1,4,100_000_000,0,500_000),
        'stop25_delay4_half_failed_residual_fee500k':stage_case(.25,4,100_000_000,5_500_000,500_000)},
    'staged_grid_range_yen':[min(x['stage_minus_upfront_yen'] for x in stages),max(x['stage_minus_upfront_yen'] for x in stages)],
    'budget_scope_cases':scope,
    'delay_value_weights':{life:{str(d):benefit_weight(d,life) for d in s['delay_months']} for life in s['life_regimes']},
    'checks':checks,'passed':sum(checks.values()),
    'current_y_yen':None,'benefit_value_yen':None,
    'robustness_domain':'Only the explicitly registered grid. No probability or complete uncertainty set is claimed.',
}
(ROOT/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(results,ensure_ascii=False,indent=2))
