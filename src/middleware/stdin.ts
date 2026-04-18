/**
 * Read stdin for piped input.
 * Used by: `sn run-script -`, `sn batch create -f -`, etc.
 */

export async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    throw new Error("Expected piped input on stdin");
  }

  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

/**
 * Resolve a value that may be a file path, "-" for stdin, or a literal string.
 * Returns the resolved string content.
 */
export async function resolveInput(value: string): Promise<string> {
  if (value === "-") return readStdin();
  const fs = await import("fs");
  return fs.readFileSync(value, "utf-8");
}
