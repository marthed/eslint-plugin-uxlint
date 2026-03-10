import fs from "node:fs";
import path from "node:path";

const SUPPORTED_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"] as const;

export type ParserLike = {
  parse?: (code: string, options?: Record<string, unknown>) => any;
  parseForESLint?: (
    code: string,
    options?: Record<string, unknown>,
  ) => { ast?: any } | any;
};

type ImportBinding = {
  sourceFilePath: string;
  importedName: string;
};

type FileSymbolRecord = {
  filePath: string;
  functionsByName: Map<string, any>;
  exportsByName: Map<string, string>;
  importedBindingsByLocalName: Map<string, ImportBinding>;
};

export type ResolvedProjectFunction = {
  filePath: string;
  functionName: string;
  node: any;
};

function isAstNode(value: unknown): value is { type: string } {
  return Boolean(
    value &&
    typeof value === "object" &&
    "type" in (value as Record<string, unknown>) &&
    typeof (value as Record<string, unknown>).type === "string",
  );
}

function attachParentPointers(
  node: unknown,
  parent: any,
  visited = new Set<object>(),
) {
  if (!isAstNode(node)) return;

  const objectNode = node as Record<string, unknown>;
  if (visited.has(objectNode)) return;

  visited.add(objectNode);
  (objectNode as any).parent = parent;

  for (const [key, value] of Object.entries(objectNode)) {
    if (key === "parent" || key === "loc" || key === "range") continue;

    if (Array.isArray(value)) {
      for (const item of value) {
        attachParentPointers(item, objectNode, visited);
      }
      continue;
    }

    attachParentPointers(value, objectNode, visited);
  }
}

function getIdentifierName(node: any): string | null {
  if (!node) return null;

  if (node.type === "Identifier") return node.name;
  if (node.type === "Literal" && typeof node.value === "string") {
    return node.value;
  }

  return null;
}

function isFunctionInitializer(node: any): boolean {
  return (
    node?.type === "FunctionExpression" ||
    node?.type === "ArrowFunctionExpression"
  );
}

function collectFunctionDeclarationsFromStatement(statement: any): Array<{
  name: string;
  node: any;
}> {
  const declarations: Array<{ name: string; node: any }> = [];

  if (statement?.type === "FunctionDeclaration" && statement.id?.name) {
    declarations.push({ name: statement.id.name, node: statement });
    return declarations;
  }

  if (statement?.type !== "VariableDeclaration") return declarations;

  for (const declarator of statement.declarations ?? []) {
    if (declarator.id?.type !== "Identifier") continue;
    if (!isFunctionInitializer(declarator.init)) continue;

    declarations.push({
      name: declarator.id.name,
      node: declarator.init,
    });
  }

  return declarations;
}

function isRelativeImportSource(sourceValue: string): boolean {
  return sourceValue.startsWith("./") || sourceValue.startsWith("../");
}

function isWithinProjectRoot(
  projectRoot: string,
  candidatePath: string,
): boolean {
  const relativePath = path.relative(projectRoot, candidatePath);
  if (!relativePath) return true;
  if (relativePath.startsWith("..")) return false;
  if (path.isAbsolute(relativePath)) return false;
  return true;
}

function hasSupportedExtension(filePath: string): boolean {
  return SUPPORTED_EXTENSIONS.some((extension) => filePath.endsWith(extension));
}

function resolveRelativeImportPath(
  fromFilePath: string,
  importSource: string,
  projectRoot: string,
): string | null {
  if (!isRelativeImportSource(importSource)) return null;

  const sourceDirectory = path.dirname(fromFilePath);
  const unresolvedPath = path.resolve(sourceDirectory, importSource);

  const candidates: string[] = [];
  if (hasSupportedExtension(unresolvedPath)) {
    candidates.push(unresolvedPath);
  } else {
    for (const extension of SUPPORTED_EXTENSIONS) {
      candidates.push(`${unresolvedPath}${extension}`);
    }
    for (const extension of SUPPORTED_EXTENSIONS) {
      candidates.push(path.join(unresolvedPath, `index${extension}`));
    }
  }

  for (const candidatePath of candidates) {
    if (!isWithinProjectRoot(projectRoot, candidatePath)) continue;
    if (candidatePath.includes(`${path.sep}node_modules${path.sep}`)) continue;
    if (!fs.existsSync(candidatePath)) continue;
    if (!fs.statSync(candidatePath).isFile()) continue;

    return path.resolve(candidatePath);
  }

  return null;
}

function parseProgramAst(
  parser: ParserLike | undefined,
  parserOptions: Record<string, unknown> | undefined,
  filePath: string,
): any | null {
  if (!parser) return null;
  if (!fs.existsSync(filePath)) return null;

  const code = fs.readFileSync(filePath, "utf8");
  const parseOptions: Record<string, unknown> = {
    ...(parserOptions ?? {}),
    filePath,
    sourceType: "module",
    loc: true,
    range: true,
  };

  if (typeof parser.parseForESLint === "function") {
    const parsed = parser.parseForESLint(code, parseOptions);
    const ast =
      parsed && typeof parsed === "object" && "ast" in parsed
        ? (parsed as { ast?: any }).ast
        : parsed;
    if (!ast) return null;
    attachParentPointers(ast, null);
    return ast;
  }

  if (typeof parser.parse === "function") {
    const ast = parser.parse(code, parseOptions);
    if (!ast) return null;
    attachParentPointers(ast, null);
    return ast;
  }

  return null;
}

function collectFileSymbolRecord(
  programNode: any,
  filePath: string,
  projectRoot: string,
): FileSymbolRecord {
  const functionsByName = new Map<string, any>();
  const exportsByName = new Map<string, string>();
  const importedBindingsByLocalName = new Map<string, ImportBinding>();
  const bodyStatements = Array.isArray(programNode?.body)
    ? programNode.body
    : [];

  for (const statement of bodyStatements) {
    if (statement?.type === "ImportDeclaration") {
      if (statement.importKind === "type") continue;

      const sourceValue =
        statement.source?.type === "Literal" &&
        typeof statement.source.value === "string"
          ? statement.source.value
          : null;
      if (!sourceValue) continue;

      const sourceFilePath = resolveRelativeImportPath(
        filePath,
        sourceValue,
        projectRoot,
      );
      if (!sourceFilePath) continue;

      for (const specifier of statement.specifiers ?? []) {
        if (specifier.type !== "ImportSpecifier") continue;
        if (specifier.importKind === "type") continue;

        const importedName = getIdentifierName(specifier.imported);
        const localName = getIdentifierName(specifier.local);
        if (!importedName || !localName) continue;

        importedBindingsByLocalName.set(localName, {
          sourceFilePath,
          importedName,
        });
      }

      continue;
    }

    if (statement?.type === "ExportNamedDeclaration") {
      if (statement.declaration) {
        for (const declaration of collectFunctionDeclarationsFromStatement(
          statement.declaration,
        )) {
          functionsByName.set(declaration.name, declaration.node);
          exportsByName.set(declaration.name, declaration.name);
        }
      }

      if (!statement.source) {
        for (const specifier of statement.specifiers ?? []) {
          if (specifier.type !== "ExportSpecifier") continue;

          const localName = getIdentifierName(specifier.local);
          const exportedName = getIdentifierName(specifier.exported);
          if (!localName || !exportedName) continue;

          exportsByName.set(exportedName, localName);
        }
      }

      continue;
    }

    for (const declaration of collectFunctionDeclarationsFromStatement(
      statement,
    )) {
      functionsByName.set(declaration.name, declaration.node);
    }
  }

  return {
    filePath,
    functionsByName,
    exportsByName,
    importedBindingsByLocalName,
  };
}

export class ProjectFunctionIndex {
  private fileRecords = new Map<string, FileSymbolRecord>();

  constructor(
    private readonly options: {
      projectRoot: string;
      parser?: ParserLike;
      parserOptions?: Record<string, unknown>;
    },
  ) {}

  seedProgram(filePath: string, programNode: any) {
    const resolvedFilePath = path.resolve(filePath);
    const record = collectFileSymbolRecord(
      programNode,
      resolvedFilePath,
      this.options.projectRoot,
    );
    this.fileRecords.set(resolvedFilePath, record);
  }

  private loadFileRecord(filePath: string): FileSymbolRecord | null {
    const resolvedFilePath = path.resolve(filePath);
    const existingRecord = this.fileRecords.get(resolvedFilePath);
    if (existingRecord) return existingRecord;

    const parsedProgram = parseProgramAst(
      this.options.parser,
      this.options.parserOptions,
      resolvedFilePath,
    );
    if (!parsedProgram) return null;

    const record = collectFileSymbolRecord(
      parsedProgram,
      resolvedFilePath,
      this.options.projectRoot,
    );
    this.fileRecords.set(resolvedFilePath, record);
    return record;
  }

  private resolveExportedFunction(
    filePath: string,
    exportName: string,
    visited = new Set<string>(),
  ): ResolvedProjectFunction | null {
    const cycleKey = `${filePath}::${exportName}`;
    if (visited.has(cycleKey)) return null;
    visited.add(cycleKey);

    const record = this.loadFileRecord(filePath);
    if (!record) return null;

    const localFunctionName = record.exportsByName.get(exportName);
    if (!localFunctionName) return null;

    const functionNode = record.functionsByName.get(localFunctionName);
    if (!functionNode) return null;

    return {
      filePath: record.filePath,
      functionName: localFunctionName,
      node: functionNode,
    };
  }

  resolveFunction(
    filePath: string,
    calleeName: string,
  ): ResolvedProjectFunction | null {
    const record = this.loadFileRecord(filePath);
    if (!record) return null;

    const localNode = record.functionsByName.get(calleeName);
    if (localNode) {
      return {
        filePath: record.filePath,
        functionName: calleeName,
        node: localNode,
      };
    }

    const importedBinding = record.importedBindingsByLocalName.get(calleeName);
    if (!importedBinding) return null;

    return this.resolveExportedFunction(
      importedBinding.sourceFilePath,
      importedBinding.importedName,
    );
  }
}
