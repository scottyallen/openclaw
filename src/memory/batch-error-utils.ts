type BatchOutputErrorLike = {
  error?: { message?: string };
  response?: {
    body?:
      | {
          error?: { message?: string };
        }
      | string;
  };
};

export function extractBatchErrorMessage(lines: BatchOutputErrorLike[]): string | undefined {
  const first = lines.find((line) => {
    if (line.error?.message) {
      return true;
    }
    const body = line.response?.body;
    if (typeof body === "string") {
      return body.length > 0;
    }
    return Boolean(body?.error?.message);
  });
  const responseBody = first?.response?.body;
  return (
    first?.error?.message ??
    (typeof responseBody === "string"
      ? responseBody
      : typeof responseBody?.error?.message === "string"
        ? responseBody.error.message
        : undefined)
  );
}

export function formatUnavailableBatchError(err: unknown): string | undefined {
  const message = err instanceof Error ? err.message : String(err);
  return message ? `error file unavailable: ${message}` : undefined;
}
