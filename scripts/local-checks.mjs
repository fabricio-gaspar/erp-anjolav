import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const projectPath = (...parts) => resolve(projectRoot, ...parts);
export const readProjectFile = (...parts) => readFileSync(projectPath(...parts), "utf8");

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function stringArrayConstant(sourceText, name) {
  const source = ts.createSourceFile(name, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.name.getText(source) !== name || !declaration.initializer) continue;
      let expression = declaration.initializer;
      while (ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression)) expression = expression.expression;
      assert(ts.isArrayLiteralExpression(expression), `${name} deve ser um array literal`);
      return expression.elements.map((element) => {
        assert(ts.isStringLiteral(element), `${name} deve conter apenas strings`);
        return element.text;
      });
    }
  }
  throw new Error(`Constante ${name} não encontrada`);
}

export function propertyStringsInArray(sourceText, name, propertyName) {
  const source = ts.createSourceFile(name, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.name.getText(source) !== name || !declaration.initializer) continue;
      let expression = declaration.initializer;
      while (ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression)) expression = expression.expression;
      assert(ts.isArrayLiteralExpression(expression), `${name} deve ser um array literal`);
      return expression.elements.map((element) => {
        assert(ts.isObjectLiteralExpression(element), `${name} deve conter objetos`);
        const property = element.properties.find((member) =>
          ts.isPropertyAssignment(member) && member.name.getText(source) === propertyName
        );
        assert(property && ts.isPropertyAssignment(property) && ts.isStringLiteral(property.initializer),
          `${name} precisa da propriedade ${propertyName} literal`);
        return property.initializer.text;
      });
    }
  }
  throw new Error(`Constante ${name} não encontrada`);
}
