export interface PasswordEvaluation {
  minimumLengthMet: boolean;
  maximumLengthMet: boolean;
  rules: Record<"lowercase" | "uppercase" | "number" | "special", boolean>;
  metRuleCount: number;
  requiredRuleCount: 3;
  valid: boolean;
  missingRules: string[];
}

export function evaluatePassword(password: string): PasswordEvaluation;
export function passwordErrorMessage(password: string): string | null;
export const PASSWORD_CHARACTER_RULES: Array<{
  key: "lowercase" | "uppercase" | "number" | "special";
  label: string;
}>;
