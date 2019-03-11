/**
 * Copyright 2015-present Ampersand Technologies, Inc.
 */
import * as Lint from 'tslint';
import * as ts from 'typescript';

export class Rule extends Lint.Rules.AbstractRule {
  public static FAILURE_STRING = 'Lifecycle methods must call super';

  public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
    return this.applyWithWalker(new MyRuleWalker(sourceFile, this.getOptions()));
  }
}

type RequiredMethodsMask = {[k: string]: 1};

function getRequiredSuperMethods(heritageClauses: ts.NodeArray<ts.HeritageClause>, requiredSuperMethodsByClassname: {[k: string]: RequiredMethodsMask}): RequiredMethodsMask | undefined {
  let res: RequiredMethodsMask | undefined;
  for (const hc of heritageClauses) {
    if (!hc || !hc.types) {
      continue;
    }
    for (const ty of hc.types) {
      let baseClassName = ty.expression.getText();
      if (requiredSuperMethodsByClassname[baseClassName]) {
        res = {...res, ...requiredSuperMethodsByClassname[baseClassName]};
      }
    }
  }
  return res;
}

// The walker takes care of all the work.
class MyRuleWalker extends Lint.RuleWalker {
  lookingAtComponent: boolean = false;
  currentMethodName: string|null = null;
  foundSuperCall: boolean = false;
  inConditional: number = 0;

  curRequiredSuperMethods: RequiredMethodsMask | undefined;

  requiredSuperMethodsByClassname: {[k: string]: RequiredMethodsMask} = {};

  constructor(sourceFile: ts.SourceFile, options: Lint.IOptions) {
    super(sourceFile, options);

    this.requiredSuperMethodsByClassname = {};
    const classArgs = options.ruleArguments[1] || {};
    if (typeof classArgs === 'object') {
      for (const className in classArgs) {
        this.requiredSuperMethodsByClassname[className] = {};

        const methods = classArgs[className];
        if (Array.isArray(methods)) {
          for (const methodName of methods) {
            if (typeof methodName === 'string') {
              this.requiredSuperMethodsByClassname[className][methodName] = 1;
            }
          }
        }
      }
    }
  }

  public visitClassDeclaration(node: ts.ClassDeclaration) {
    if (!node.heritageClauses) {
      return;
    }

    this.curRequiredSuperMethods = getRequiredSuperMethods(node.heritageClauses, this.requiredSuperMethodsByClassname);
    if (this.curRequiredSuperMethods) {
      this.lookingAtComponent = true;
      this.walkChildren(node);
      this.lookingAtComponent = false;
      this.curRequiredSuperMethods = undefined;
    }
  }

  public visitMethodDeclaration(node: ts.MethodDeclaration) {
    if (!this.lookingAtComponent) {
      return;
    }

    const methodName = node.name.getText();

    if (!this.curRequiredSuperMethods || !this.curRequiredSuperMethods[methodName]) {
      return;
    }

    this.currentMethodName = methodName;
    this.foundSuperCall = false;
    this.walkChildren(node);
    this.currentMethodName = null;

    if (!this.foundSuperCall) {
      this.addFailure(this.createFailure(node.getStart(), node.getWidth(), Rule.FAILURE_STRING));
    }
  }

  public visitCallExpression(node: ts.CallExpression) {
    if (node.expression.kind === ts.SyntaxKind.PropertyAccessExpression &&
      (node.expression as ts.PropertyAccessExpression).expression.kind === ts.SyntaxKind.SuperKeyword &&
      (node.expression as ts.PropertyAccessEntityNameExpression).name.text === this.currentMethodName
    ) {
      this.foundSuperCall = true;
      if (this.inConditional > 0) {
        this.addFailure(this.createFailure(node.getStart(), node.getWidth(), `Don't conditionally call super.${this.currentMethodName}!`));
      }
    }
    node.kind;
  }

  private visitConditional(node: ts.Node) {
    this.inConditional += 1;
    this.walkChildren(node);
    this.inConditional -= 1;
  }

  public visitIfStatement(node: ts.IfStatement)                     { return this.visitConditional(node); }
  public visitSwitchStatement(node: ts.SwitchStatement)             { return this.visitConditional(node); }
  public visitForStatement(node: ts.ForStatement)                   { return this.visitConditional(node); }
  public visitForInStatement(node: ts.ForInStatement)               { return this.visitConditional(node); }
  public visitForOfStatement(node: ts.ForOfStatement)               { return this.visitConditional(node); }
  public visitConditionalExpression(node: ts.ConditionalExpression) { return this.visitConditional(node); }
  public visitDoStatement(node: ts.DoStatement)                     { return this.visitConditional(node); }
}
