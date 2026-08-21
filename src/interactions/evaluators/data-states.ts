import type { AsyncCollectionSource } from "../collectors/data-sources";

export type DataStateFinding = {
  node: any;
  message: string;
};

const REQUIREMENTS: Array<{
  has: (source: AsyncCollectionSource) => boolean;
  ruleId: string;
  message: string;
}> = [
  {
    has: (source) => source.hasLoadingBranch,
    ruleId: "DATA-LOADING-001",
    message:
      "Collection is rendered from an async source with no loading branch. " +
      "Show that data is on its way, or the user sees an empty list while it loads.",
  },
  {
    has: (source) => source.hasEmptyBranch,
    ruleId: "DATA-EMPTY-001",
    message:
      "Collection is rendered from an async source with no empty branch. " +
      "Say why there is nothing here and what to do next, rather than rendering nothing.",
  },
  {
    has: (source) => source.hasErrorBranch,
    ruleId: "DATA-ERROR-001",
    message:
      "Collection is rendered from an async source with no error branch. " +
      "A failed fetch is otherwise indistinguishable from having no data.",
  },
];

export function evaluateAsyncCollectionSources(
  sources: AsyncCollectionSource[],
): DataStateFinding[] {
  const findings: DataStateFinding[] = [];

  for (const source of sources) {
    // The component has to render the collection itself. If it hands the data
    // to a child, that child is where the branches belong and it is linted on
    // its own file.
    if (!source.rendersCollection) continue;

    for (const requirement of REQUIREMENTS) {
      if (requirement.has(source)) continue;
      findings.push({
        node: source.node,
        message: `[${requirement.ruleId}] ${requirement.message}`,
      });
    }
  }

  return findings;
}
