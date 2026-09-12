import { test } from "node:test";
import assert from "node:assert/strict";
import { io } from "socket.io-client";
import { adminToken, activateTestTeacher } from "./admin-session";

const base = process.env.TEST_URL || "http://localhost";
test(
  "administración: aprobación, permisos, revocación HTTP/polling y borrado",
  { timeout: 30000 },
  async () => {
    const admin = await adminToken(base);
    async function request(
      path: string,
      method = "GET",
      body?: unknown,
      token = admin,
    ) {
      const response = await fetch(base + "/api" + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: response.status, data: await response.json() };
    }
    const email = `admin-test-${Date.now()}@example.test`;
    const credentials = { email, password: "Administration-test-12345" };
    const registered = await request(
      "/auth/register",
      "POST",
      { ...credentials, name: "Prueba de administración" },
      "",
    );
    assert.equal(registered.status, 201);
    assert.equal(registered.data.pendingActivation, true);
    assert.equal(registered.data.token, undefined);
    assert.equal(
      (await request("/auth/login", "POST", credentials, "")).status,
      403,
    );
    assert.equal(
      (
        await request(
          "/auth/register",
          "POST",
          { ...credentials, role: "admin", name: "Escalada" },
          "",
        )
      ).status,
      400,
    );
    const listing = await request("/admin/teachers?search=" + email);
    const teacher = listing.data.teachers[0] as { id: number };
    assert.ok(teacher.id);
    assert.equal("passwordHash" in teacher, false);
    assert.equal(
      (await request("/admin/teachers", "GET", undefined, "")).status,
      401,
    );
    await activateTestTeacher(base, email);
    const login = await request("/auth/login", "POST", credentials, "");
    const token = login.data.token as string;
    assert.equal(
      (await request("/admin/teachers", "GET", undefined, token)).status,
      403,
    );
    assert.equal(
      (
        await request(
          `/admin/teachers/${teacher.id}`,
          "PUT",
          { isActive: false },
          token,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await request(
          `/admin/teachers/${teacher.id}`,
          "DELETE",
          undefined,
          token,
        )
      ).status,
      403,
    );
    const me = await request("/auth/me");
    assert.equal(
      (await request(`/admin/teachers/${me.data.id}`, "DELETE")).status,
      403,
    );
    assert.equal(
      (
        await request(`/admin/teachers/${me.data.id}`, "PUT", {
          isActive: false,
        })
      ).status,
      403,
    );
    const game = await request(
      "/games",
      "POST",
      { questionCount: 1, questionDurationSeconds: 10 },
      token,
    );
    assert.equal(game.status, 201);
    const socket = io(base, {
      transports: ["polling"],
      upgrade: false,
      reconnection: false,
      auth: { token, kind: "teacher", gameId: game.data.id },
    });
    try {
      await new Promise<void>((resolve, reject) => {
        socket.once("connect", resolve);
        socket.once("connect_error", reject);
      });
      const disconnected = new Promise<void>((resolve) =>
        socket.once("disconnect", () => resolve()),
      );
      assert.equal(
        (
          await request(`/admin/teachers/${teacher.id}`, "PUT", {
            isActive: false,
          })
        ).status,
        200,
      );
      await disconnected;
      assert.equal(
        (await request("/games", "GET", undefined, token)).status,
        403,
      );
      assert.equal(
        (await request("/auth/login", "POST", credentials, "")).status,
        403,
      );
      await request(`/admin/teachers/${teacher.id}`, "PUT", { isActive: true });
      assert.equal(
        (await request("/games", "GET", undefined, token)).status,
        401,
      );
      const newLogin = await request("/auth/login", "POST", credentials, "");
      assert.equal(newLogin.status, 200);
      assert.equal(
        (await request(`/admin/teachers/${teacher.id}`, "DELETE")).status,
        200,
      );
      assert.equal(
        (await request("/games", "GET", undefined, newLogin.data.token)).status,
        401,
      );
      assert.equal(
        (await request("/auth/login", "POST", credentials, "")).status,
        401,
      );
      assert.equal(
        (await request("/admin/teachers?search=" + email)).data.total,
        0,
      );
      assert.equal(
        (
          await request(`/admin/teachers/${teacher.id}`, "PUT", {
            isActive: true,
          })
        ).status,
        404,
      );
    } finally {
      socket.disconnect();
    }
  },
);
