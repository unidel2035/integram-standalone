/**
 * Code Parser for KAG Service
 *
 * Parses JavaScript, Vue, TypeScript, and Python files to extract:
 * - Imports/exports
 * - Function definitions
 * - Class definitions
 * - Variable declarations
 * - Function calls
 *
 * Issue #5073
 */

import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import { parse as parseVue } from '@vue/compiler-sfc';
import logger from '../../utils/logger.js';

export class CodeParser {
  constructor() {
    this.supportedExtensions = ['.js', '.vue', '.ts', '.jsx', '.tsx', '.py'];
  }

  /**
   * Parse a code file and extract structure
   * @param {string} filePath - File path
   * @param {string} content - File content
   * @returns {Object} Parsed structure
   */
  parseFile(filePath, content) {
    const ext = filePath.substring(filePath.lastIndexOf('.'));

    try {
      if (ext === '.vue') {
        return this.parseVueFile(filePath, content);
      } else if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
        return this.parseJavaScriptFile(filePath, content);
      } else if (ext === '.py') {
        return this.parsePythonFile(filePath, content);
      }

      return null;
    } catch (error) {
      logger.warn(`Failed to parse ${filePath}`, { error: error.message });
      return null;
    }
  }

  /**
   * Parse Vue file
   * @param {string} filePath - File path
   * @param {string} content - File content
   * @returns {Object} Parsed structure
   */
  parseVueFile(filePath, content) {
    const result = {
      type: 'VueComponent',
      imports: [],
      exports: [],
      functions: [],
      classes: [],
      variables: [],
      calls: [],
      template: null,
      script: null,
      style: null
    };

    try {
      const parsed = parseVue(content, { filename: filePath });

      // Extract template
      if (parsed.descriptor.template) {
        result.template = {
          content: parsed.descriptor.template.content,
          lang: parsed.descriptor.template.lang || 'html'
        };
      }

      // Extract script content and parse it
      if (parsed.descriptor.script || parsed.descriptor.scriptSetup) {
        const scriptContent = parsed.descriptor.scriptSetup?.content || parsed.descriptor.script?.content;
        if (scriptContent) {
          result.script = {
            content: scriptContent,
            lang: parsed.descriptor.scriptSetup?.lang || parsed.descriptor.script?.lang || 'js',
            setup: !!parsed.descriptor.scriptSetup
          };

          // Parse the script as JavaScript
          const scriptStructure = this.parseJavaScriptFile(filePath, scriptContent);
          if (scriptStructure) {
            result.imports = scriptStructure.imports;
            result.exports = scriptStructure.exports;
            result.functions = scriptStructure.functions;
            result.classes = scriptStructure.classes;
            result.variables = scriptStructure.variables;
            result.calls = scriptStructure.calls;
          }
        }
      }

      // Extract styles
      if (parsed.descriptor.styles && parsed.descriptor.styles.length > 0) {
        result.style = parsed.descriptor.styles.map(style => ({
          content: style.content,
          lang: style.lang || 'css',
          scoped: style.scoped
        }));
      }
    } catch (error) {
      logger.warn(`Failed to parse Vue file ${filePath}`, { error: error.message });
    }

    return result;
  }

  /**
   * Parse JavaScript/TypeScript file
   * @param {string} filePath - File path
   * @param {string} content - File content
   * @returns {Object} Parsed structure
   */
  parseJavaScriptFile(filePath, content) {
    const result = {
      type: 'JavaScriptModule',
      imports: [],
      exports: [],
      functions: [],
      classes: [],
      variables: [],
      calls: [],
      functionCalls: [], // New: track which function calls which function
      classExtensions: [] // New: track class inheritance
    };

    // Track current context for function calls
    let currentFunction = null;
    const self = this;

    try {
      // Parse with acorn (supports ES2022+)
      const ast = acorn.parse(content, {
        ecmaVersion: 'latest',
        sourceType: 'module',
        locations: true
      });

      // Walk the AST
      walk.simple(ast, {
        ImportDeclaration(node) {
          const importInfo = {
            source: node.source.value,
            specifiers: node.specifiers.map(spec => {
              if (spec.type === 'ImportDefaultSpecifier') {
                return { type: 'default', name: spec.local.name };
              } else if (spec.type === 'ImportNamespaceSpecifier') {
                return { type: 'namespace', name: spec.local.name };
              } else {
                return {
                  type: 'named',
                  imported: spec.imported.name,
                  local: spec.local.name
                };
              }
            })
          };
          result.imports.push(importInfo);
        },

        ExportNamedDeclaration(node) {
          if (node.declaration) {
            if (node.declaration.type === 'FunctionDeclaration') {
              result.exports.push({
                type: 'function',
                name: node.declaration.id?.name
              });
            } else if (node.declaration.type === 'ClassDeclaration') {
              result.exports.push({
                type: 'class',
                name: node.declaration.id?.name
              });
            } else if (node.declaration.type === 'VariableDeclaration') {
              node.declaration.declarations.forEach(decl => {
                result.exports.push({
                  type: 'variable',
                  name: decl.id.name
                });
              });
            }
          } else if (node.specifiers) {
            node.specifiers.forEach(spec => {
              result.exports.push({
                type: 'named',
                exported: spec.exported.name,
                local: spec.local.name
              });
            });
          }
        },

        ExportDefaultDeclaration(node) {
          result.exports.push({
            type: 'default',
            declaration: node.declaration.type
          });
        },

        FunctionDeclaration(node) {
          if (node.id) {
            result.functions.push({
              name: node.id.name,
              params: node.params.map(p => p.name || 'anonymous'),
              line: node.loc?.start.line
            });
          }
        },

        ClassDeclaration(node) {
          if (node.id) {
            const className = node.id.name;
            const methods = [];

            // Track class inheritance
            if (node.superClass) {
              const superClassName = node.superClass.name ||
                (node.superClass.type === 'Identifier' ? node.superClass.name : null);
              if (superClassName) {
                result.classExtensions.push({
                  class: className,
                  extends: superClassName,
                  line: node.loc?.start.line
                });
              }
            }

            node.body.body.forEach(member => {
              if (member.type === 'MethodDefinition') {
                methods.push({
                  name: member.key.name,
                  kind: member.kind,
                  static: member.static
                });
              }
            });

            result.classes.push({
              name: className,
              methods,
              superClass: node.superClass?.name || null,
              line: node.loc?.start.line
            });
          }
        },

        VariableDeclaration(node) {
          node.declarations.forEach(decl => {
            if (decl.id.type === 'Identifier') {
              result.variables.push({
                name: decl.id.name,
                kind: node.kind,
                line: node.loc?.start.line
              });
            }
          });
        },

        CallExpression(node) {
          let calleeName = null;
          if (node.callee.type === 'Identifier') {
            calleeName = node.callee.name;
          } else if (node.callee.type === 'MemberExpression') {
            calleeName = self.getMemberExpressionName(node.callee);
          }

          if (calleeName) {
            result.calls.push({
              callee: calleeName,
              line: node.loc?.start.line
            });
          }
        }
      });

      // Second pass: Track function calls within functions and methods
      walk.ancestor(ast, {
        FunctionDeclaration(node, ancestors) {
          if (node.id) {
            const funcName = node.id.name;
            self.trackFunctionCalls(node.body, funcName, result);
          }
        },

        ClassDeclaration(node, ancestors) {
          if (node.id) {
            const className = node.id.name;
            node.body.body.forEach(member => {
              if (member.type === 'MethodDefinition' && member.value.body) {
                const methodName = `${className}.${member.key.name}`;
                self.trackFunctionCalls(member.value.body, methodName, result);
              }
            });
          }
        },

        // Also track arrow functions assigned to variables
        VariableDeclarator(node, ancestors) {
          if (node.id.type === 'Identifier' &&
              (node.init?.type === 'ArrowFunctionExpression' ||
               node.init?.type === 'FunctionExpression')) {
            const funcName = node.id.name;
            if (node.init.body.type === 'BlockStatement') {
              self.trackFunctionCalls(node.init.body, funcName, result);
            }
          }
        }
      });
    } catch (error) {
      logger.warn(`Failed to parse JavaScript file ${filePath}`, {
        error: error.message,
        line: error.loc?.line,
        column: error.loc?.column
      });
    }

    return result;
  }

  /**
   * Parse Python file (basic regex-based parsing)
   * @param {string} filePath - File path
   * @param {string} content - File content
   * @returns {Object} Parsed structure
   */
  parsePythonFile(filePath, content) {
    const result = {
      type: 'PythonModule',
      imports: [],
      exports: [],
      functions: [],
      classes: [],
      variables: [],
      functionCalls: [], // New: track function calls
      classExtensions: [] // New: track class inheritance
    };

    try {
      const lines = content.split('\n');
      let currentFunction = null;
      let currentClass = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        const indent = line.search(/\S/);

        // Parse imports
        if (trimmedLine.startsWith('import ') || trimmedLine.startsWith('from ')) {
          const importMatch = trimmedLine.match(/^(?:from\s+(\S+)\s+)?import\s+(.+)$/);
          if (importMatch) {
            result.imports.push({
              source: importMatch[1] || null,
              names: importMatch[2].split(',').map(n => n.trim())
            });
          }
        }

        // Parse class definitions
        const classMatch = trimmedLine.match(/^class\s+(\w+)(?:\((.*?)\))?:/);
        if (classMatch) {
          const className = classMatch[1];
          const bases = classMatch[2] ? classMatch[2].split(',').map(b => b.trim()).filter(b => b) : [];

          result.classes.push({
            name: className,
            bases: bases,
            line: i + 1
          });

          // Track class inheritance
          bases.forEach(baseClass => {
            result.classExtensions.push({
              class: className,
              extends: baseClass,
              line: i + 1
            });
          });

          currentClass = className;
          currentFunction = null;
        }

        // Parse function/method definitions
        const funcMatch = trimmedLine.match(/^def\s+(\w+)\s*\((.*?)\)/);
        if (funcMatch) {
          const funcName = funcMatch[1];
          const fullName = currentClass ? `${currentClass}.${funcName}` : funcName;

          result.functions.push({
            name: funcName,
            fullName: fullName,
            params: funcMatch[2].split(',').map(p => p.trim()).filter(p => p),
            line: i + 1,
            class: currentClass
          });

          currentFunction = fullName;
        }

        // Track function calls (simple pattern matching)
        if (currentFunction && trimmedLine) {
          // Match function calls like: functionName(...) or object.method(...)
          const callMatches = trimmedLine.matchAll(/(\w+(?:\.\w+)*)\s*\(/g);
          for (const match of callMatches) {
            const calleeName = match[1];
            // Skip common keywords and constructors
            if (!['if', 'while', 'for', 'elif', 'with', 'class', 'def', 'return', 'print'].includes(calleeName)) {
              result.functionCalls.push({
                caller: currentFunction,
                callee: calleeName,
                line: i + 1
              });
            }
          }
        }

        // Reset context when indentation goes back to module level
        if (indent === 0 && trimmedLine && !trimmedLine.startsWith('#')) {
          if (!classMatch && !funcMatch && !trimmedLine.startsWith('import') && !trimmedLine.startsWith('from')) {
            currentClass = null;
            currentFunction = null;
          }
        }
      }
    } catch (error) {
      logger.warn(`Failed to parse Python file ${filePath}`, { error: error.message });
    }

    return result;
  }

  /**
   * Track function calls within a function body
   * @param {Object} bodyNode - Function body AST node
   * @param {string} callerName - Name of the calling function
   * @param {Object} result - Result object to store calls
   */
  trackFunctionCalls(bodyNode, callerName, result) {
    walk.simple(bodyNode, {
      CallExpression: (node) => {
        let calleeName = null;
        if (node.callee.type === 'Identifier') {
          calleeName = node.callee.name;
        } else if (node.callee.type === 'MemberExpression') {
          calleeName = this.getMemberExpressionName(node.callee);
        }

        if (calleeName) {
          result.functionCalls.push({
            caller: callerName,
            callee: calleeName,
            line: node.loc?.start.line
          });
        }
      }
    });
  }

  /**
   * Get name from MemberExpression (e.g., obj.method)
   * @param {Object} node - AST node
   * @returns {string} Expression name
   */
  getMemberExpressionName(node) {
    if (node.object.type === 'Identifier') {
      return `${node.object.name}.${node.property.name}`;
    } else if (node.object.type === 'MemberExpression') {
      return `${this.getMemberExpressionName(node.object)}.${node.property.name}`;
    }
    return node.property.name;
  }

  /**
   * Check if file extension is supported
   * @param {string} filePath - File path
   * @returns {boolean} True if supported
   */
  isSupported(filePath) {
    const ext = filePath.substring(filePath.lastIndexOf('.'));
    return this.supportedExtensions.includes(ext);
  }
}

export default CodeParser;
