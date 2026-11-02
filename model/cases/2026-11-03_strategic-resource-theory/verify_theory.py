"""Counterexamples for the proposed monetary resource measure; synthetic, not SOL values.

These check accounting/decision consistency. They do not validate empirical prices,
counterfactual probabilities, the chosen financing premise, or causal effects.
"""

from itertools import combinations
import json
import math
from pathlib import Path


def best_joint_policy(options, capacity):
    """A fixed common resource prevents adding mutually exclusive alternatives."""
    best = 0
    for n in range(len(options) + 1):
        for chosen in combinations(options, n):
            if sum(a['capacity'] for a in chosen) <= capacity:
                receipts = {k: v for a in chosen for k, v in a['receipts'].items()}
                best = max(best, sum(receipts.values()) - sum(a['cost'] for a in chosen))
    return best


results = {}
checks = {}

# Accounting identity: exercisable option is already a resource before exercise.
cash, exercise_price, asset_value = 100_000_000, 50_000_000, 100_000_000
before = cash + max(0, asset_value - exercise_price)
after = cash - exercise_price + asset_value
results['option_exercise'] = {'before_yen': before, 'after_yen': after,
                             'policy_gain_over_lapse_yen': before - cash}
checks['exercise_transfers_existing_option_value'] = before == after == 150_000_000
checks['cash_one_yen_normalization'] = (cash + 1 + max(0, asset_value-exercise_price)) - before == 1

# Borrowing at par changes gross cash and matched liability, not the net stock.
principal = 30_000_000
checks['borrowing_at_par_net_identity'] = cash + principal - principal == cash

# Complementarity: the two standalone values vanish; their bundle is valuable.
v = {frozenset(): 0, frozenset({'technology'}): 0, frozenset({'reference'}): 0,
     frozenset({'technology', 'reference'}): 10_000_000}
tech = (v[frozenset({'technology'})] - v[frozenset()]
        + v[frozenset({'technology', 'reference'})] - v[frozenset({'reference'})]) / 2
reference = (v[frozenset({'reference'})] - v[frozenset()]
             + v[frozenset({'technology', 'reference'})] - v[frozenset({'technology'})]) / 2
checks['complementarity_retained_in_bundle'] = v[frozenset({'technology', 'reference'})] > sum([v[frozenset({'technology'})], v[frozenset({'reference'})]])
checks['allocation_matches_bundle'] = tech + reference == 10_000_000
results['complementarity'] = {'joint_yen': 10_000_000, 'technology_allocation_yen': tech,
                            'reference_allocation_yen': reference}

a = {'capacity': 1, 'receipts': {'customer-A': 20_000_000}, 'cost': 0}
b = {'capacity': 1, 'receipts': {'customer-B': 30_000_000}, 'cost': 0}
exclusive = best_joint_policy([a, b], 1)
checks['exclusive_uses_are_not_added'] = exclusive == 30_000_000
duplicate = {'capacity': 0, 'receipts': {'customer-A': 20_000_000}, 'cost': 0}
checks['renaming_the_same_receipt_does_not_increase_value'] = best_joint_policy([dict(a, capacity=0), duplicate], 1) == 20_000_000

# Future results cannot determine today's action. Only the signal justifies branching.
probabilities = [0.5, 0.5]
payoffs = {'invest': [100_000_000, -40_000_000], 'stop': [0, 0]}
without_information = max(sum(p*x for p, x in zip(probabilities, xs)) for xs in payoffs.values())
with_information = sum(p * max(xs[state] for xs in payoffs.values()) for state, p in enumerate(probabilities))
experiment_cost = 5_000_000
results['information'] = {'before_signal_yen': without_information,
                          'free_signal_yen': with_information,
                          'after_experiment_cost_yen': with_information - experiment_cost}
checks['nonanticipatory_policy_excludes_foresight'] = without_information == 30_000_000
checks['valuable_information_can_justify_an_experiment'] = with_information-experiment_cost == 45_000_000 > without_information
checks['unfavorable_signal_can_lower_realized_value'] = max(xs[1] for xs in payoffs.values()) == 0 < without_information

# Funding chance is conditional on a continuing project. Actual runway is a separate field.
growth_npv = 80_000_000
opportunity_before, opportunity_after = 0.2*growth_npv, 0.6*growth_npv
checks['funding_opportunity_values_net_investment_not_raise_principal'] = math.isclose(opportunity_after-opportunity_before, 32_000_000)
results['funding_opportunity'] = {'conditional_before_yen': opportunity_before,
                                 'conditional_after_yen': opportunity_after,
                                 'change_yen': opportunity_after-opportunity_before}

# SOL source reconciliation is budget arithmetic, not a valuation of the remaining grant.
direct = [21_482_000, 38_516_000]
indirect = [6_444_600, 11_554_800]
checks['sol_gap_direct_budget'] = sum(direct) == 59_998_000
checks['sol_gap_indirect_budget'] = sum(indirect) == 17_999_400
checks['sol_gap_total_budget'] = sum(direct+indirect) == 77_997_400
results['sol_gap_budget_only'] = {'direct_yen': sum(direct), 'indirect_yen': sum(indirect),
                                 'total_yen': sum(direct+indirect), 'remaining_yen': None,
                                 'current_resource_value_yen': None}
checks['unknown_current_grant_and_y_remain_unknown'] = results['sol_gap_budget_only']['remaining_yen'] is None and results['sol_gap_budget_only']['current_resource_value_yen'] is None

assert all(checks.values()), checks
out = {'status': 'synthetic_consistency_checks_only', 'checks': checks,
       'passed': sum(checks.values()), 'total': len(checks), 'examples': results,
       'not_validated': ['empirical SOL resource values', 'causal effects', 'probability calibration',
                         'valuation baseline', 'common continuation-financing premise',
                         'cash-timing and legal-label invariance in a future production evaluator']}
Path(__file__).with_name('verification_result.json').write_text(json.dumps(out, ensure_ascii=False, indent=2)+'\n')
print(json.dumps({'passed': out['passed'], 'total': out['total'], 'examples': results}, ensure_ascii=False, indent=2))
