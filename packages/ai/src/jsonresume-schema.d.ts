declare module '@jsonresume/schema' {
  export interface JsonResumeSchemaError {
    property?: string;
    message?: string;
    stack?: string;
  }

  export function validate(
    resume: unknown,
    callback: (errors: JsonResumeSchemaError[] | null, valid: boolean) => void,
  ): void;

  export const schema: unknown;
  export const jobSchema: unknown;
}
