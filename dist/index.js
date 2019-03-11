"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Copyright 2015-present Ampersand Technologies, Inc.
 */
var Lint = require("tslint");
var ts = require("typescript");
var Rule = /** @class */ (function (_super) {
    __extends(Rule, _super);
    function Rule() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Rule.prototype.apply = function (sourceFile) {
        return this.applyWithWalker(new MyRuleWalker(sourceFile, this.getOptions()));
    };
    Rule.FAILURE_STRING = 'Lifecycle methods must call super';
    return Rule;
}(Lint.Rules.AbstractRule));
exports.Rule = Rule;
function getRequiredSuperMethods(heritageClauses, requiredSuperMethodsByClassname) {
    var res;
    for (var _i = 0, heritageClauses_1 = heritageClauses; _i < heritageClauses_1.length; _i++) {
        var hc = heritageClauses_1[_i];
        if (!hc || !hc.types) {
            continue;
        }
        for (var _a = 0, _b = hc.types; _a < _b.length; _a++) {
            var ty = _b[_a];
            var baseClassName = ty.expression.getText();
            if (requiredSuperMethodsByClassname[baseClassName]) {
                res = __assign({}, res, requiredSuperMethodsByClassname[baseClassName]);
            }
        }
    }
    return res;
}
// The walker takes care of all the work.
var MyRuleWalker = /** @class */ (function (_super) {
    __extends(MyRuleWalker, _super);
    function MyRuleWalker(sourceFile, options) {
        var _this = _super.call(this, sourceFile, options) || this;
        _this.lookingAtComponent = false;
        _this.currentMethodName = null;
        _this.foundSuperCall = false;
        _this.inConditional = 0;
        _this.requiredSuperMethodsByClassname = {};
        _this.requiredSuperMethodsByClassname = {};
        var classArgs = options.ruleArguments[1] || {};
        if (typeof classArgs === 'object') {
            for (var className in classArgs) {
                _this.requiredSuperMethodsByClassname[className] = {};
                var methods = classArgs[className];
                if (Array.isArray(methods)) {
                    for (var _i = 0, methods_1 = methods; _i < methods_1.length; _i++) {
                        var methodName = methods_1[_i];
                        if (typeof methodName === 'string') {
                            _this.requiredSuperMethodsByClassname[className][methodName] = 1;
                        }
                    }
                }
            }
        }
        return _this;
    }
    MyRuleWalker.prototype.visitClassDeclaration = function (node) {
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
    };
    MyRuleWalker.prototype.visitMethodDeclaration = function (node) {
        if (!this.lookingAtComponent) {
            return;
        }
        var methodName = node.name.getText();
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
    };
    MyRuleWalker.prototype.visitCallExpression = function (node) {
        if (node.expression.kind === ts.SyntaxKind.PropertyAccessExpression &&
            node.expression.expression.kind === ts.SyntaxKind.SuperKeyword &&
            node.expression.name.text === this.currentMethodName) {
            this.foundSuperCall = true;
            if (this.inConditional > 0) {
                this.addFailure(this.createFailure(node.getStart(), node.getWidth(), "Don't conditionally call super." + this.currentMethodName + "!"));
            }
        }
        node.kind;
    };
    MyRuleWalker.prototype.visitConditional = function (node) {
        this.inConditional += 1;
        this.walkChildren(node);
        this.inConditional -= 1;
    };
    MyRuleWalker.prototype.visitIfStatement = function (node) { return this.visitConditional(node); };
    MyRuleWalker.prototype.visitSwitchStatement = function (node) { return this.visitConditional(node); };
    MyRuleWalker.prototype.visitForStatement = function (node) { return this.visitConditional(node); };
    MyRuleWalker.prototype.visitForInStatement = function (node) { return this.visitConditional(node); };
    MyRuleWalker.prototype.visitForOfStatement = function (node) { return this.visitConditional(node); };
    MyRuleWalker.prototype.visitConditionalExpression = function (node) { return this.visitConditional(node); };
    MyRuleWalker.prototype.visitDoStatement = function (node) { return this.visitConditional(node); };
    return MyRuleWalker;
}(Lint.RuleWalker));
