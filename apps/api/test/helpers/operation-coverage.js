import { appendFileSync } from "node:fs";
import { FAMILIES } from "../../../../src/endpoints.ts";

const opId = (verb, path) =>
  verb.toLowerCase() +
  path
    .replace(/^\/v2/, "")
    .replace(/[:/]+([a-zA-Z])/g, (_, c) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, "");

const matchers = FAMILIES.flatMap(({ name: family, endpoints }) =>
  endpoints.map((endpoint) => ({
    ...endpoint,
    family,
    operationId: opId(endpoint.verb, endpoint.path),
    regex: new RegExp(
      "^" +
        endpoint.path
          .split("/")
          .map((part) =>
            part.startsWith(":") ? "[^/]+" : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          )
          .join("/") +
        "$",
    ),
  })),
);

export function operationFor(method, requestPath) {
  const pathname = new URL(requestPath, "http://blueballs.test").pathname;
  return matchers.find(
    (candidate) => candidate.verb === method && candidate.regex.test(pathname),
  );
}

export function recordSuccessfulOperation(method, requestPath, status) {
  if (status < 200 || status >= 300) return;
  const file = process.env.OPERATION_COVERAGE_FILE;
  if (!file) return;
  const operation = operationFor(method, requestPath);
  if (!operation) return;
  appendFileSync(
    file,
    JSON.stringify({
      operationId: operation.operationId,
      verb: operation.verb,
      path: operation.path,
      family: operation.family,
      status,
    }) + "\n",
    "utf8",
  );
}
