const CHARACTER_RULES = [
  { key: "lowercase", label: "lowercase letter", pattern: /[a-z]/ },
  { key: "uppercase", label: "uppercase letter", pattern: /[A-Z]/ },
  { key: "number", label: "number", pattern: /[0-9]/ },
  { key: "special", label: "special character", pattern: /[^A-Za-z0-9]/ },
];

/** Keep client feedback aligned with CH_Auth_Controller::is_strong_password(). */
export function evaluatePassword(password) {
  const byteLength = new TextEncoder().encode(password).length;
  const rules = Object.fromEntries(
    CHARACTER_RULES.map(({ key, pattern }) => [key, pattern.test(password)]),
  );
  const metRuleCount = Object.values(rules).filter(Boolean).length;

  return {
    minimumLengthMet: byteLength >= 12,
    maximumLengthMet: byteLength <= 128,
    rules,
    metRuleCount,
    requiredRuleCount: 3,
    valid: byteLength >= 12 && byteLength <= 128 && metRuleCount >= 3,
    missingRules: CHARACTER_RULES.filter(({ key }) => !rules[key]).map(({ label }) => label),
  };
}

export function passwordErrorMessage(password) {
  const result = evaluatePassword(password);
  if (!result.minimumLengthMet) return "Password must contain at least 12 characters.";
  if (!result.maximumLengthMet) return "Password must be no more than 128 characters.";
  if (result.metRuleCount < result.requiredRuleCount) {
    const needed = result.requiredRuleCount - result.metRuleCount;
    const types = result.missingRules.join(", ");
    return `Add ${needed} more character type${needed === 1 ? "" : "s"} from: ${types}.`;
  }
  return null;
}

export const PASSWORD_CHARACTER_RULES = CHARACTER_RULES.map(({ key, label }) => ({ key, label }));
