import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const START_TIMEOUT_MS = 10_000;

async function allocatePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

async function waitForReady(baseUrl, child, output) {
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `API exited during startup (${child.exitCode})\n${output()}`,
      );
    }
    try {
      const response = await fetch(`${baseUrl}/v2`);
      if (response.ok) return;
    } catch {
      // The process has not bound its socket yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(
    `API did not become ready within ${START_TIMEOUT_MS}ms\n${output()}`,
  );
}

async function terminate(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  const exited = new Promise((resolve) => child.once("exit", resolve));
  const timedOut = new Promise((resolve) =>
    setTimeout(() => resolve("timeout"), 2_000),
  );
  if (
    (await Promise.race([exited, timedOut])) === "timeout" &&
    child.exitCode === null
  ) {
    child.kill("SIGKILL");
    await new Promise((resolve) => child.once("exit", resolve));
  }
}

export async function createApiFixture({ env = {} } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "blueballs-api-test-"));
  const databasePath = join(directory, "blueballs.sqlite");
  let child = null;
  let baseUrl = null;
  let logs = "";

  /** allocatePort() closes its probe socket before the child binds, so between
   *  those two moments the OS can hand the same ephemeral port to another test
   *  file running in parallel. That is a race, not a fixed failure: it shows up
   *  as one intermittently red suite. Retry on a bind collision with a fresh
   *  port rather than failing the run. */
  const START_ATTEMPTS = 5;

  async function start() {
    if (child && child.exitCode === null)
      throw new Error("API fixture is already running");
    for (let attempt = 1; ; attempt++) {
      try {
        return await startOnce();
      } catch (error) {
        const collided = /EADDRINUSE|address already in use/i.test(
          String(error?.message ?? error) + logs,
        );
        if (!collided || attempt >= START_ATTEMPTS) throw error;
        await terminate(child);
        child = null;
      }
    }
  }

  async function startOnce() {
    const port = await allocatePort();
    baseUrl = `http://127.0.0.1:${port}`;
    logs = "";
    child = spawn(process.execPath, ["src/server.js"], {
      cwd: new URL("../..", import.meta.url),
      env: {
        ...process.env,
        PORT: String(port),
        DB_PATH: databasePath,
        RATE_LIMIT_PER_MIN: "10000",
        ...env,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (chunk) => {
      logs += chunk;
    });
    child.stderr.on("data", (chunk) => {
      logs += chunk;
    });
    await waitForReady(baseUrl, child, () => logs);
    return fixture;
  }

  async function stop() {
    await terminate(child);
    child = null;
  }

  async function restart() {
    await stop();
    return start();
  }

  async function request(method, path, { key, body, headers = {} } = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(key ? { "x-api-key": key } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return {
      status: response.status,
      headers: response.headers,
      body: text ? JSON.parse(text) : null,
    };
  }

  async function signup(email) {
    const response = await request("POST", "/v2/auth/signup", {
      body: { email },
    });
    if (response.status !== 201) {
      throw new Error(
        `Signup failed (${response.status}): ${JSON.stringify(response.body)}`,
      );
    }
    return response.body;
  }

  async function close() {
    await stop();
    await rm(directory, { recursive: true, force: true });
  }

  const fixture = {
    get baseUrl() {
      return baseUrl;
    },
    get databasePath() {
      return databasePath;
    },
    get output() {
      return logs;
    },
    start,
    stop,
    restart,
    request,
    signup,
    close,
  };

  return start();
}
