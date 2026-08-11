// Resolves the function a handler calls by name, either within the same
// file or (when multi-file tracing is enabled) across the project via the
// ProjectFunctionIndex.

import path from "node:path";
import {
  ProjectFunctionIndex,
  type ResolvedProjectFunction,
} from "../tracing/project-index";
import { walkAst } from "./ast-helpers";

export const DEFAULT_MAX_HELPER_TRACE_DEPTH = 4;

export type HelperFunctionResolver = {
  resolve(
    fromFilePath: string,
    calleeName: string,
  ): ResolvedProjectFunction | null;
};

export type MultiFileTraceOptions = {
  filePath: string;
  projectFunctionIndex: ProjectFunctionIndex;
  maxTraceDepth: number;
};

function getProgramNode(node: any): any | null {
  let current = node;
  while (current?.parent) {
    current = current.parent;
  }

  if (current?.type !== "Program") return null;
  return current;
}

function collectNamedFunctionsInProgram(programNode: any): Map<string, any> {
  const functionsByName = new Map<string, any>();
  if (!programNode) return functionsByName;

  walkAst(programNode, (current) => {
    if (current.type === "FunctionDeclaration" && current.id?.name) {
      functionsByName.set(current.id.name, current);
      return;
    }

    if (
      current.type === "VariableDeclarator" &&
      current.id?.type === "Identifier" &&
      (current.init?.type === "ArrowFunctionExpression" ||
        current.init?.type === "FunctionExpression")
    ) {
      functionsByName.set(current.id.name, current.init);
    }
  });

  return functionsByName;
}

export function createHelperFunctionResolver(
  componentFunctionNode: any,
  multiFileTraceOptions: MultiFileTraceOptions | null,
  currentFilePath: string,
): HelperFunctionResolver {
  const programNode = getProgramNode(componentFunctionNode);
  const sameFileFunctionsByName = collectNamedFunctionsInProgram(programNode);

  if (!multiFileTraceOptions || !programNode) {
    return {
      resolve(_fromFilePath, calleeName) {
        const functionNode = sameFileFunctionsByName.get(calleeName);
        if (!functionNode) return null;

        return {
          filePath: currentFilePath,
          functionName: calleeName,
          node: functionNode,
        };
      },
    };
  }

  multiFileTraceOptions.projectFunctionIndex.seedProgram(
    currentFilePath,
    programNode,
  );

  return {
    resolve(fromFilePath, calleeName) {
      if (path.resolve(fromFilePath) === path.resolve(currentFilePath)) {
        const sameFileFunction = sameFileFunctionsByName.get(calleeName);
        if (sameFileFunction) {
          return {
            filePath: currentFilePath,
            functionName: calleeName,
            node: sameFileFunction,
          };
        }
      }

      return multiFileTraceOptions.projectFunctionIndex.resolveFunction(
        fromFilePath,
        calleeName,
      );
    },
  };
}
