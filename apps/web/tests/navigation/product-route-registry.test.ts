import { existsSync, readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  productRouteRegistry,
  routePatternMatches,
} from "../../app/routing/product-route-registry";

const appRoot = resolve(import.meta.dirname, "../../app");
const pagesRoot = resolve(appRoot, "pages");

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function nuxtRoute(file: string) {
  const segments = relative(pagesRoot, file)
    .replaceAll("\\", "/")
    .replace(/\.vue$/, "")
    .split("/")
    .filter((segment) => segment !== "index")
    .map((segment) => segment.replace(/^\[([^\]]+)\]$/, ":$1"));
  return segments.length ? `/${segments.join("/")}` : "/";
}

const pageFiles = walk(pagesRoot).filter((file) => file.endsWith(".vue"));
const pageRoutes = pageFiles.map(nuxtRoute);
const sourceFiles = walk(appRoot).filter((file) => /\.(?:vue|ts)$/.test(file));
const sources = sourceFiles.map((file) => ({
  file,
  source: readFileSync(file, "utf8"),
}));

function stripLocation(value: string) {
  return value.split(/[?#]/, 1)[0] || "/";
}

function generatedLinkPatterns() {
  const patterns: string[] = [];
  const dynamicAttribute = /(?::to|:href)=["']\s*`([^`]+)`["']/g;
  const dynamicNavigation =
    /(?:navigateTo|router\.(?:push|replace))\(\s*`([^`]+)`/g;
  for (const { source } of sources) {
    for (const regex of [dynamicAttribute, dynamicNavigation]) {
      for (const match of source.matchAll(regex)) {
        const value = match[1];
        if (!value?.startsWith("/")) continue;
        patterns.push(stripLocation(value.replace(/\$\{[^}]+\}/g, ":dynamic")));
      }
    }
  }
  return patterns;
}

function staticLinks() {
  const links: Array<{ file: string; path: string }> = [];
  const attributes = /(?:to|href)=["'](\/[^"']*)["']/g;
  const navigation =
    /(?:navigateTo|router\.(?:push|replace))\(\s*["'](\/[^"']*)["']/g;
  for (const { file, source } of sources) {
    for (const regex of [attributes, navigation]) {
      for (const match of source.matchAll(regex)) {
        const path = match[1];
        if (path) links.push({ file, path: stripLocation(path) });
      }
    }
  }
  return links;
}

describe("product route registry connectivity", () => {
  it("registers every Nuxt page exactly once", () => {
    expect(new Set(pageRoutes).size).toBe(pageRoutes.length);
    expect(new Set(productRouteRegistry.map((entry) => entry.path)).size).toBe(
      productRouteRegistry.length,
    );
    expect([...new Set(pageRoutes)].sort()).toEqual(
      [...productRouteRegistry.map((entry) => entry.path)].sort(),
    );
  });

  it("keeps every production route connected to a parent or role entry", () => {
    const ids = new Set(productRouteRegistry.map((entry) => entry.id));
    for (const entry of productRouteRegistry.filter(
      (route) => !route.developmentOnly,
    )) {
      expect(entry.roles.length, entry.path).toBeGreaterThan(0);
      if (entry.parentId)
        expect(ids.has(entry.parentId), entry.path).toBe(true);
      if (!entry.parentId && entry.path !== "/") {
        expect(entry.entryForRole.length, entry.path).toBeGreaterThan(0);
      }
      if (entry.navigationVisible)
        expect(entry.deepLinkOnly, entry.path).toBe(false);
    }
  });

  it("has an actual generated link for every deep-link-only production page", () => {
    const generated = generatedLinkPatterns();
    for (const entry of productRouteRegistry.filter(
      (route) => route.deepLinkOnly && !route.developmentOnly,
    )) {
      expect(
        generated.some((pattern) => routePatternMatches(entry.path, pattern)),
        `${entry.path} has no generated upstream link`,
      ).toBe(true);
    }
  });

  it("maps all static internal links to a real route", () => {
    for (const link of staticLinks()) {
      expect(
        productRouteRegistry.some((entry) =>
          routePatternMatches(entry.path, link.path),
        ),
        `${relative(appRoot, link.file)} -> ${link.path}`,
      ).toBe(true);
    }
  });

  it("maps all dynamic Nuxt links to a real route pattern", () => {
    for (const pattern of generatedLinkPatterns()) {
      expect(
        productRouteRegistry.some((entry) =>
          routePatternMatches(entry.path, pattern),
        ),
        `dynamic link -> ${pattern}`,
      ).toBe(true);
    }
  });

  it("keeps development pages out of navigation and products as redirect-only", () => {
    expect(
      productRouteRegistry.find((entry) => entry.path === "/design/icons"),
    ).toMatchObject({ developmentOnly: true, navigationVisible: false });
    const products = productRouteRegistry.find(
      (entry) => entry.path === "/products",
    );
    expect(products).toMatchObject({
      featureStatus: "COMPATIBILITY",
      fallbackRoute: "/plans",
      navigationVisible: false,
    });
    const source = readFileSync(resolve(pagesRoot, "products.vue"), "utf8");
    expect(source).toContain('navigateTo("/plans"');
    expect(existsSync(resolve(pagesRoot, "reports/[reportId].vue"))).toBe(true);
  });
});
