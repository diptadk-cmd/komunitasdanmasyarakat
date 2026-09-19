import test from "node:test";
import assert from "node:assert/strict";
import {
  collectCoverage,
  routerMatcher,
  roleChecklist,
} from "../scripts/feature-coverage.mjs";

const report = await collectCoverage();

test("all nine application roles have navigation extracted from production source", () => {
  const actual = [
    ...new Set(
      report.applications.flatMap((app) =>
        app.navigation.map((item) => item.role),
      ),
    ),
  ].sort();
  assert.deepEqual(actual, roleChecklist.map((role) => role.role).sort());
});

for (const app of report.applications) {
  test(`${app.id}: every explicit Route path is statically inventoried`, () => {
    assert.ok(app.routes.length > 0);
    assert.deepEqual(app.unresolvedRoutes, []);
    assert.equal(
      new Set(app.routes.map((route) => route.pattern)).size,
      app.routes.length,
      "duplicate patterns can shadow a page",
    );
  });

  test(`${app.id}: every role menu resolves to its authorized declared route`, () => {
    const missing = app.navigation.filter((item) => !item.route);
    assert.deepEqual(
      missing,
      [],
      "menu targets must match a real Route, not NotFound",
    );
    const forbidden = app.navigation.filter((item) => {
      const route = app.routes.find(
        (candidate) => candidate.pattern === item.route,
      );
      return !route.roles.includes(item.role);
    });
    assert.deepEqual(
      forbidden,
      [],
      "menu points to a route guarded for a different role",
    );
    const unique = new Set(
      app.navigation.map((item) => `${item.role}:${item.href}`),
    );
    assert.equal(
      unique.size,
      app.navigation.length,
      "duplicate href in the same role menu",
    );
  });

  test(`${app.id}: static internal navigation targets match production Wouter routes`, () => {
    const missing = app.links
      .filter((link) => link.result === "missing-route")
      .map(({ target, file, line }) => ({ target, file, line }));
    assert.deepEqual(missing, []);
  });

  test(`${app.id}: route parameters and wildcard paths work with the installed router`, async () => {
    const matches = await routerMatcher(app.id);
    for (const route of app.routes) {
      const sample = route.pattern
        .replace(/:([A-Za-z0-9_]+)\??/g, "coverage-item-123")
        .replace(/\*\??/g, "coverage/deep/item");
      assert.equal(
        matches(route.pattern, sample),
        true,
        `${route.pattern} rejects a concrete parameter path ${sample}`,
      );
      assert.equal(
        matches(route.pattern, `${sample}?tab=detail#section`),
        true,
      );
      if (!route.parameterized) {
        const first = app.routes.find((candidate) =>
          matches(candidate.pattern, sample),
        );
        assert.equal(
          first.pattern,
          route.pattern,
          `${route.pattern} is shadowed by earlier ${first.pattern}`,
        );
        assert.equal(
          matches(
            route.pattern,
            `${sample === "/" ? "" : sample}/unexpected-extra-segment`,
          ),
          false,
          "static routes must not match extra segments",
        );
      }
      if (route.pattern.endsWith("/*?"))
        assert.equal(
          matches(route.pattern, route.pattern.slice(0, -3)),
          true,
          "optional wildcard must also match its root",
        );
    }
  });

  test(`${app.id}: every static target has an explicit result and unsafe schemes are not silently whitelisted`, () => {
    assert.ok(app.links.every((link) => typeof link.result === "string"));
    assert.deepEqual(
      app.links.filter((link) => /^javascript:/i.test(link.target)),
      [],
    );
  });
}
