import { sqlInjectionRule } from "./sql";
import { xssRule } from "./xss";
import { hardcodedSecretRule } from "./secret";
import { commandInjectionRule } from "./command";
import { pathTraversalRule } from "./pathTraversal";

export const securityRules = [
  sqlInjectionRule,
  xssRule,
  hardcodedSecretRule,
  commandInjectionRule,
  pathTraversalRule
];