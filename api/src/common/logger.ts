export type LogFields = Record<string, string | number | boolean>;

export const logger = {
  info(message: string, fields: LogFields = {}): void {
    process.stderr.write(JSON.stringify({ level: "info", message, ...fields }) + "\n");
  },
  error(message: string, error: unknown, fields: LogFields = {}): void {
    process.stderr.write(JSON.stringify({
      level: "error",
      message,
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { value: String(error) },
      ...fields
    }) + "\n");
  }
};
