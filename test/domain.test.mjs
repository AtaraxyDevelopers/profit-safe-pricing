import test from "node:test";
import assert from "node:assert/strict";
import { config, example, analyze } from "../src/domain.mjs";
import { validateState } from "../src/lib.mjs";
test("Documented sample results match independently specified expectations", () => {
  const report = analyze(example.records, example.settings, config.asOf);
  for (const [label, value] of [
    ["Offers evaluated", 2],
    ["Below target", 1],
    ["Required margin (%)", 20],
  ])
    assert.equal(
      report.metrics.find((m) => m.label === label).value,
      value,
      label,
    );
});
test("Business edge cases", () => {
  (function edge(records, s, analyze, validate) {
    const row = analyze([records[0]], s).rows[0];
    assert.equal(row["Profit / unit"], "27.30");
    assert.equal(row["Minimum price"], "77.93");
    assert.throws(
      () =>
        validate(
          { ...example, settings: { ...s, targetMargin: 98, feeRate: 3 } },
          config,
        ),
      /below 100/,
    );
  })(example.records, example.settings, analyze, validateState);
});

test("A rounded percentage cannot hide a margin shortfall", () => {
  const report = analyze(
    [
      {
        ...example.records[0],
        ...{ unitCost: 40.001, overhead: 0, price: 50, discount: 0 },
      },
    ],
    { ...example.settings, ...{ targetMargin: 20, feeRate: 0 } },
    config.asOf,
  );
  assert.equal(report.rows[0]["Margin (%)"], 20);
  assert.equal(report.metrics.find((m) => m.label === "Below target").value, 1);
});
