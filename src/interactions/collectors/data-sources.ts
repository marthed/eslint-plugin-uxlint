// Finds components that render a collection fetched from an async data hook,
// and records which of the non-success branches they handle.
//
// The catalog states this requirement three times independently: Data Table
// lists a loading indicator and an empty state as *required* components,
// Search Results says to "specify empty, loading, and failure states alongside
// the default interaction", and Command Palette says to "plan empty, loading,
// and error states in the same container". A list that only renders the happy
// path leaves the user staring at nothing on every other outcome.
//
// Scope is deliberately narrow, in the same spirit as the toggle collector:
// only a recognised data hook counts as an async source, and the component
// must render the collection itself. Anything it cannot resolve is left alone.

import { walkAst } from "./ast-helpers";
import {
  getObjectPatternPropertyKeyName,
  unwrapAssignmentPattern,
} from "./ast-helpers";

// React Query, tRPC, SWR, and Apollo all expose the same shape.
const DATA_HOOK_NAMES = new Set([
  "useQuery",
  "useSuspenseQuery",
  "useInfiniteQuery",
  "useSWR",
  "useSWRInfinite",
]);

const LOADING_FIELDS = new Set([
  "isLoading",
  "isPending",
  "isFetching",
  "loading",
  "isValidating",
]);
const ERROR_FIELDS = new Set(["error", "isError", "isLoadingError"]);
const DATA_FIELDS = new Set(["data", "items", "results"]);

import type { AsyncCollectionSource } from "../types";

export type { AsyncCollectionSource };

function isDataHookCall(node: any): boolean {
  if (node?.type !== "CallExpression") return false;

  const callee = node.callee;
  if (callee?.type === "Identifier") return DATA_HOOK_NAMES.has(callee.name);

  // tRPC and generated clients: trpc.posts.list.useQuery()
  return (
    callee?.type === "MemberExpression" &&
    callee.computed === false &&
    callee.property?.type === "Identifier" &&
    DATA_HOOK_NAMES.has(callee.property.name)
  );
}

type SourceNames = {
  dataNames: Set<string>;
  loadingNames: Set<string>;
  errorNames: Set<string>;
};

// Resolves the local names a hook result is available under, for both
// `const { data, isLoading } = useQuery()` and `const q = useQuery()`.
function getSourceNames(declarator: any): SourceNames | null {
  const names: SourceNames = {
    dataNames: new Set(),
    loadingNames: new Set(),
    errorNames: new Set(),
  };

  if (declarator.id?.type === "Identifier") {
    const base = declarator.id.name;
    for (const field of DATA_FIELDS) names.dataNames.add(`${base}.${field}`);
    for (const field of LOADING_FIELDS)
      names.loadingNames.add(`${base}.${field}`);
    for (const field of ERROR_FIELDS) names.errorNames.add(`${base}.${field}`);
    return names;
  }

  if (declarator.id?.type !== "ObjectPattern") return null;

  for (const property of declarator.id.properties ?? []) {
    const key = getObjectPatternPropertyKeyName(property);
    if (!key) continue;

    const value = unwrapAssignmentPattern(property.value);
    if (value?.type !== "Identifier") continue;

    if (DATA_FIELDS.has(key)) names.dataNames.add(value.name);
    else if (LOADING_FIELDS.has(key)) names.loadingNames.add(value.name);
    else if (ERROR_FIELDS.has(key)) names.errorNames.add(value.name);
  }

  return names.dataNames.size > 0 ? names : null;
}

// Full dotted path of a non-computed member chain, so `query.data` and a bare
// `data` are comparable against the same name set.
function nameOf(node: any): string | null {
  if (node?.type === "Identifier") return node.name;

  if (
    node?.type === "MemberExpression" &&
    node.computed === false &&
    node.property?.type === "Identifier"
  ) {
    const objectName = nameOf(node.object);
    return objectName ? `${objectName}.${node.property.name}` : null;
  }

  return null;
}

function referencesAny(node: any, names: Set<string>): boolean {
  if (names.size === 0) return false;

  let found = false;
  walkAst(node, (current) => {
    if (found) return;
    const name = nameOf(current);
    if (name && names.has(name)) found = true;
  });

  return found;
}

// Real code says "empty" in more ways than a length test: a derived boolean
// (`isEmpty`), or simply rendering an EmptyState component. Both are matched
// by name, which is safe here because the effect is to *suppress* a finding —
// the same fail-safe direction as feedbackFunctions and labelComponents.
const EMPTY_NAME =
  /(^|[._])(is)?(empty|no[A-Z_]?(results|data|items|records))/i;
const EMPTY_COMPONENT_NAME = /(empty|no[-_]?(results|data|items))/i;

function looksLikeEmptyName(node: any): boolean {
  let found = false;
  walkAst(node, (current) => {
    if (found) return;
    if (current.type === "Identifier" && EMPTY_NAME.test(current.name)) {
      found = true;
    }
  });
  return found;
}

// `{x ? <EmptyState/> : <List/>}` — the branch itself names the state.
function rendersEmptyComponent(node: any): boolean {
  let found = false;
  walkAst(node, (current) => {
    if (found) return;
    if (current.type !== "JSXOpeningElement") return;
    const name = current.name;
    if (
      name?.type === "JSXIdentifier" &&
      EMPTY_COMPONENT_NAME.test(name.name)
    ) {
      found = true;
    }
  });
  return found;
}

// A `.length` test on the data, in a condition position: the empty branch.
function testsCollectionLength(node: any, dataNames: Set<string>): boolean {
  let found = false;

  walkAst(node, (current) => {
    if (found) return;
    if (current.type !== "MemberExpression") return;
    if (current.computed !== false) return;
    if (current.property?.type !== "Identifier") return;
    if (current.property.name !== "length") return;

    const objectName = nameOf(current.object);
    if (objectName && dataNames.has(objectName)) found = true;
  });

  return found;
}

// True when any of `names` is referenced somewhere other than inside the
// declarator that introduced them.
function usesOutsideDeclarator(
  componentFunctionNode: any,
  declarator: any,
  names: Set<string>,
): boolean {
  if (names.size === 0) return false;

  let found = false;
  walkAst(componentFunctionNode.body ?? componentFunctionNode, (current) => {
    if (found) return;
    if (current === declarator) return;
    if (declarator.range && current.range) {
      const insideDeclarator =
        current.range[0] >= declarator.range[0] &&
        current.range[1] <= declarator.range[1];
      if (insideDeclarator) return;
    }

    const name = nameOf(current);
    if (name && names.has(name)) found = true;
  });

  return found;
}

export function collectAsyncCollectionSources(
  componentFunctionNode: any,
): AsyncCollectionSource[] {
  const sources: AsyncCollectionSource[] = [];

  walkAst(componentFunctionNode.body ?? componentFunctionNode, (current) => {
    if (current.type !== "VariableDeclarator") return;
    if (!isDataHookCall(current.init)) return;

    const names = getSourceNames(current);
    if (!names) return;

    let rendersCollection = false;
    // A loading or error value is "handled" if the component uses it at all
    // outside the declaration that produced it — as a condition, a `loading`
    // prop, or anything else. Requiring a conditional specifically missed
    // <Combobox loading={isLoading} />, which is a perfectly good treatment.
    let hasLoadingBranch = usesOutsideDeclarator(
      componentFunctionNode,
      current,
      names.loadingNames,
    );
    let hasErrorBranch = usesOutsideDeclarator(
      componentFunctionNode,
      current,
      names.errorNames,
    );
    let hasEmptyBranch = false;

    if (rendersEmptyComponent(componentFunctionNode)) hasEmptyBranch = true;

    walkAst(componentFunctionNode.body ?? componentFunctionNode, (inner) => {
      // Rendering the collection: data.map(...) anywhere in the component.
      if (
        inner.type === "CallExpression" &&
        inner.callee?.type === "MemberExpression" &&
        inner.callee.computed === false &&
        inner.callee.property?.type === "Identifier" &&
        inner.callee.property.name === "map"
      ) {
        const objectName = nameOf(inner.callee.object);
        if (objectName && names.dataNames.has(objectName)) {
          rendersCollection = true;
        }
        // data?.map(...) and (data ?? []).map(...) reach the data too.
        if (
          !objectName &&
          referencesAny(inner.callee.object, names.dataNames)
        ) {
          rendersCollection = true;
        }
      }

      // Branches are conditions: `x && <A/>` or `x ? <A/> : <B/>`.
      const condition =
        inner.type === "LogicalExpression"
          ? inner.left
          : inner.type === "ConditionalExpression"
            ? inner.test
            : inner.type === "IfStatement"
              ? inner.test
              : null;
      if (!condition) return;

      if (referencesAny(condition, names.loadingNames)) hasLoadingBranch = true;
      if (referencesAny(condition, names.errorNames)) hasErrorBranch = true;
      if (
        testsCollectionLength(condition, names.dataNames) ||
        looksLikeEmptyName(condition)
      ) {
        hasEmptyBranch = true;
      }
    });

    sources.push({
      node: current.init,
      rendersCollection,
      hasLoadingBranch,
      hasErrorBranch,
      hasEmptyBranch,
    });
  });

  return sources;
}
