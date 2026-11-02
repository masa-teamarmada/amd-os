"""Unapproved proposal's synthetic arithmetic; no production input or DB access."""

import json
import math
from itertools import permutations
from pathlib import Path


def verify_example():
    rate = 0.10
    annuity = sum(1 / (1 + rate) ** year for year in range(1, 6))
    before_customer = (annuity - 2) / (1 + rate)
    after_customer = (annuity - 1) / (1 + rate)
    n = 40
    values = {
        frozenset(): n * 0.10 * before_customer,
        frozenset(["technology"]): n * 0.10 * after_customer,
        frozenset(["reference"]): annuity + n * 0.30 * before_customer,
        frozenset(["technology", "reference"]): annuity + n * 0.30 * after_customer,
    }
    contributions = {name: 0.0 for name in ["technology", "reference"]}
    orders = list(permutations(contributions))
    for order in orders:
        held = frozenset()
        for name in order:
            updated = held | {name}
            contributions[name] += (values[updated] - values[held]) / len(orders)
            held = updated
    base = values[frozenset()]
    combined = values[frozenset(contributions)]
    cash_before, cash_after = 100.0, 50.0
    delta_resource = combined - base
    delta_y = cash_after + combined - cash_before - base
    threshold = (50.0 - annuity) / (
        0.30 * after_customer - 0.10 * before_customer
    )
    checks = {
        "contributions_sum_to_bundle_increment": math.isclose(
            sum(contributions.values()), delta_resource, abs_tol=1e-10
        ),
        "cash_and_resource_reconcile": math.isclose(
            delta_y, -50 + delta_resource, abs_tol=1e-10
        ),
        "77_candidates_not_break_even": annuity
        + 77 * (0.30 * after_customer - 0.10 * before_customer)
        < 50,
        "78_candidates_break_even": annuity
        + 78 * (0.30 * after_customer - 0.10 * before_customer)
        >= 50,
        "after_value_matches_explicit_dated_cash_flows": math.isclose(
            combined,
            sum(1 / 1.1 ** year for year in range(1, 6))
            + 12
            * (
                -1 / 1.1
                + sum(1 / 1.1 ** year for year in range(2, 7))
            ),
            abs_tol=1e-10,
        ),
    }
    assert all(checks.values()), checks
    return {
        "status": "synthetic_example_verified",
        "units": "million_JPY",
        "rate": rate,
        "annual_net_cash_per_customer": 1,
        "annual_revenue_per_customer": 2,
        "first_contract_pv": annuity,
        "follow_on_pv_before": before_customer,
        "follow_on_pv_after": after_customer,
        "bundle_before": base,
        "bundle_after": combined,
        "bundle_increment": delta_resource,
        "shapley_increment": contributions,
        "y_before": cash_before + base,
        "y_after": cash_after + combined,
        "y_increment": delta_y,
        "break_even_candidates": threshold,
        "minimum_integer_candidates": math.ceil(threshold),
        "separate_growth_option_before": 0.20 * 100,
        "separate_growth_option_after": 0.60 * 100,
        "y_before_with_growth_option": cash_before + base + 20,
        "y_after_with_growth_option": cash_after + combined + 60,
        "y_increment_with_growth_option": delta_y + 40,
        "arithmetic_checks": checks,
        "not_implemented_checks": [
            "production_Y_invariant_to_runway_only_change",
            "production_Y_invariant_to_X_label_only_change",
            "reject_duplicate_cash_flow_ids",
            "joint_capacity_and_correlated_scenario_validation",
            "missing_inputs_are_not_zero",
            "receivable_cash_debt_and_option_reclassification",
        ],
    }


if __name__ == "__main__":
    result = verify_example()
    encoded = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    output = Path(__file__).with_name("example_result.json")
    output.write_text(encoded, encoding="utf-8")
    print(encoded, end="")
