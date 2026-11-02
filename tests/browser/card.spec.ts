import { test, expect } from "@playwright/test";
test("real SDK renders, HA values update without replacing the canvas, and more-info uses HA events", async ({
  page,
}) => {
  const external: string[] = [];
  page.on("request", (request) => {
    if (!request.url().startsWith("http://127.0.0.1:4176/"))
      external.push(request.url());
  });
  await page.goto("/tests/fixtures/");
  const card = page.locator("haus-blick-card");
  await expect(card.locator("canvas")).toBeVisible();
  await expect(card.locator(".entity-row").first()).toContainText("21,5 °C");
  await page.evaluate(() => {
    (window as any).originalCanvas = (
      window as any
    ).card.shadowRoot.querySelector("canvas");
    (window as any).setState("sensor.living_temperature", "24.2");
  });
  await expect(card.locator(".entity-row").first()).toContainText("24,2 °C");
  expect(
    await page.evaluate(
      () =>
        (window as any).originalCanvas ===
        (window as any).card.shadowRoot.querySelector("canvas"),
    ),
  ).toBe(true);
  await card.locator(".entity-row").first().click();
  expect(await page.evaluate(() => (window as any).events)).toEqual([
    { entityId: "sensor.living_temperature" },
  ]);
  await card.locator(".entity-row").first().focus();
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => (window as any).events.length)).toBe(2);
  await card.locator(".marker-label").first().click();
  expect(
    await page.evaluate(() => (window as any).events.at(-1).entityId),
  ).toBe("sensor.living_temperature");
  for (const label of await card.locator(".marker-label").all())
    await label.click();
  expect(
    await page.evaluate(() => (window as any).events.at(-1).entityId),
  ).toBe("light.kitchen");
  expect(external).toEqual([]);
});
test("unknown, missing and unavailable states stay distinct; entity text is not HTML", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/");
  const rows = page.locator("haus-blick-card .entity-row");
  await page.evaluate(() =>
    (window as any).setState("sensor.living_temperature", "unavailable"),
  );
  await expect(rows.first()).toHaveAttribute("data-status", "unavailable");
  await page.evaluate(() =>
    (window as any).setState("sensor.living_temperature", "unknown"),
  );
  await expect(rows.first()).toHaveAttribute("data-status", "unknown");
  await page.evaluate(() =>
    (window as any).setState("sensor.living_temperature", "22", {
      friendly_name: "<img src=x onerror=alert(1)>",
    }),
  );
  await expect(rows.first()).toContainText("<img src=x onerror=alert(1)>");
  await expect(page.locator("haus-blick-card img")).toHaveCount(0);
  await page.evaluate(() => {
    const c = (window as any).card;
    const h = { ...c.hass, states: { ...c.hass.states } };
    delete h.states["sensor.living_temperature"];
    c.hass = h;
  });
  await expect(rows.first()).toHaveAttribute("data-status", "missing");
  await expect(rows.first()).toBeDisabled();
});
test("native visual editor selects existing entities, persists through config-changed and rejects invalid dimensions", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/");
  await page.evaluate(() => (window as any).openEditor());
  const editor = page.locator("haus-blick-card-editor");
  await editor.locator('.general [name="title"]').fill("Unser Haus");
  await editor.locator('.general [name="title"]').press("Tab");
  await expect
    .poll(() => page.evaluate(() => (window as any).configEvents.at(-1)?.title))
    .toBe("Unser Haus");
  await editor
    .locator(".binding")
    .first()
    .locator('[name="entity"]')
    .fill("light.kitchen");
  await editor
    .locator(".binding")
    .first()
    .locator('[name="entity"]')
    .press("Tab");
  await expect(editor.locator('[role="alert"]')).toContainText("Doppelte");
  await editor
    .locator(".binding")
    .first()
    .locator('[name="entity"]')
    .fill("sensor.living_temperature");
  await editor
    .locator(".binding")
    .first()
    .locator('[name="entity"]')
    .press("Tab");
  await editor.locator(".room").first().locator('[name="width"]').fill("-1");
  await editor.locator(".room").first().locator('[name="width"]').press("Tab");
  await expect(editor.locator('[role="alert"]')).toContainText("room.width");
  expect(
    await page.evaluate(
      () => (window as any).configEvents.at(-1).rooms[0].width,
    ),
  ).toBe(6);
});
test("WebGL failure keeps values and HA details usable", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      type: any,
      ...args: any[]
    ) {
      if (String(type).startsWith("webgl")) return null;
      return (original as any).call(this, type, ...args);
    } as any;
  });
  await page.goto("/tests/fixtures/");
  const card = page.locator("haus-blick-card");
  await expect(card.locator(".fallback")).toContainText(
    "3D ist auf diesem Gerät nicht verfügbar",
  );
  await expect(card.locator(".entity-row").first()).toContainText("21,5 °C");
  await card.locator(".entity-row").first().click();
  expect(await page.evaluate(() => (window as any).events[0].entityId)).toBe(
    "sensor.living_temperature",
  );
});
test("disconnect disposes WebGL, reconnect creates one fresh viewer, and context loss falls back", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/");
  await expect(page.locator("haus-blick-card canvas")).toBeVisible();
  await page.evaluate(() => {
    const w = window as any;
    w.previousCanvas = w.card.shadowRoot.querySelector("canvas");
    w.previousContext = w.previousCanvas.getContext("webgl2");
    w.card.remove();
  });
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).previousContext.isContextLost()),
    )
    .toBe(true);
  await page.evaluate(() =>
    document.querySelector("#mount")!.append((window as any).card),
  );
  await expect(page.locator("haus-blick-card canvas")).toHaveCount(1);
  expect(
    await page.evaluate(
      () =>
        (window as any).previousCanvas !==
        (window as any).card.shadowRoot.querySelector("canvas"),
    ),
  ).toBe(true);
  await page
    .locator("haus-blick-card canvas")
    .dispatchEvent("webglcontextlost");
  await expect(page.locator("haus-blick-card .fallback")).toContainText(
    "3D-Kontext wurde unterbrochen",
  );
  await expect(
    page.locator("haus-blick-card .entity-row").first(),
  ).toContainText("21,5 °C");
});
test("mobile and reduced motion preserve scrolling and available controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/tests/fixtures/");
  await expect(page.locator("haus-blick-card canvas")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .locator("haus-blick-card .entity-row")
    .last()
    .scrollIntoViewIfNeeded();
  await page.locator("haus-blick-card .entity-row").last().click();
  expect(await page.evaluate(() => (window as any).events[0].entityId)).toBe(
    "light.kitchen",
  );
});

test("house views and floors preserve the viewer; outdoor values still open HA details", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/");
  const card = page.locator("haus-blick-card");
  await expect(card.locator("canvas")).toBeVisible();
  await page.evaluate(() => {
    const w = window as any;
    w.card.setConfig({
      ...w.config,
      rooms: [
        ...w.config.rooms,
        {
          id: "garden",
          name: "Garten",
          kind: "garden",
          x: 0,
          z: 4,
          width: 9,
          depth: 4,
        },
        {
          id: "upstairs",
          name: "OG",
          x: 0,
          z: 0,
          width: 6,
          depth: 4,
          elevation: 3,
        },
      ],
      building: { roof: "gable" },
      plants: [{ id: "tree", kind: "tree", x: 1, z: 6, size: 1 }],
      entities: [
        ...w.config.entities,
        { entity: "sensor.soil", room: "garden", x: 2, z: 2 },
      ],
    });
    w.setState("sensor.soil", "42", {
      friendly_name: "Bodenfeuchte",
      unit_of_measurement: "%",
    });
    w.originalCanvas = w.card.shadowRoot.querySelector("canvas");
    w.geometryBefore = w.card.context.renderer.info.memory.geometries;
  });
  await card.locator(".outside").click();
  await expect(card.locator(".outside")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(card.locator(".marker-label").first()).toHaveCSS(
    "visibility",
    "hidden",
  );
  await expect(card.locator(".marker-label").last()).toBeVisible();
  await card.locator(".marker-label").last().click();
  expect(
    await page.evaluate(() => (window as any).events.at(-1).entityId),
  ).toBe("sensor.soil");
  await card.locator(".floor").selectOption("3");
  await expect(card.locator(".marker-label").last()).toHaveCSS(
    "visibility",
    "hidden",
  );
  await card.locator(".inside").click();
  await card.locator(".floor").selectOption("all");
  await card.locator(".top").click();
  await expect(card.locator(".top")).toHaveAttribute("aria-pressed", "true");
  await card.locator(".inside").click();
  await page.evaluate(() => {
    const w = window as any;
    w.geometryBefore = w.card.context.renderer.info.memory.geometries;
    w.setState("sensor.soil", "55");
  });
  await expect(card.locator(".entity-row").last()).toContainText("55 %");
  expect(
    await page.evaluate(() => {
      const w = window as any;
      return (
        w.originalCanvas === w.card.shadowRoot.querySelector("canvas") &&
        w.card.context.renderer.info.memory.geometries === w.geometryBefore
      );
    }),
  ).toBe(true);
  // Repeated view changes replace, rather than accumulate, structural GPU objects.
  for (let i = 0; i < 3; i++) {
    await card.locator(".outside").click();
    await card.locator(".inside").click();
  }
  expect(
    await page.evaluate(() => {
      const w = window as any;
      return (
        w.card.context.renderer.info.memory.geometries <= w.geometryBefore + 2
      );
    }),
  ).toBe(true);
  await expect(card.locator(".fallback")).toBeHidden();
});

test("local import previews exact contours, cancels without saving and explicitly applies a valid plan", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/");
  await page.evaluate(() => {
    const w = window as any;
    w.config = { ...w.config, entities: [] };
    w.openEditor();
  });
  const editor = page.locator("haus-blick-card-editor");
  const plan = {
    schemaVersion: 1,
    name: "L-Haus",
    unit: "m",
    rooms: [
      {
        id: "living",
        name: "<script>untrusted</script>",
        polygon: [
          { x: 0, z: 0 },
          { x: 4, z: 0 },
          { x: 4, z: 2 },
          { x: 2, z: 2 },
          { x: 2, z: 4 },
          { x: 0, z: 4 },
        ],
      },
    ],
    walls: [
      {
        id: "wall-1",
        start: { x: 0, z: 0 },
        end: { x: 4, z: 0 },
        height: 2.7,
        thickness: 0.15,
      },
    ],
  };
  await editor.locator(".import-file").setInputFiles({
    name: "house.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(plan)),
  });
  await editor.locator(".preview-import").click();
  await expect(editor.locator(".import-preview svg polygon")).toHaveCount(1);
  await expect(editor.locator(".apply-import")).toBeEnabled();
  expect(await page.evaluate(() => (window as any).configEvents.length)).toBe(
    0,
  );
  await editor.locator(".cancel-import").click();
  await expect(editor.locator(".apply-import")).toBeDisabled();
  expect(await page.evaluate(() => (window as any).configEvents.length)).toBe(
    0,
  );
  await editor.locator(".preview-import").click();
  await editor.locator(".apply-import").click();
  expect(
    await page.evaluate(
      () => (window as any).configEvents.at(-1).rooms[0].polygon.length,
    ),
  ).toBe(6);
  await expect(editor.locator('.room input[name="name"]').first()).toHaveValue(
    "<script>untrusted</script>",
  );
  await expect(editor.locator("script")).toHaveCount(0);
  await page.evaluate(() => {
    const w = window as any;
    w.card.setConfig(w.configEvents.at(-1));
  });
  await expect(page.locator("haus-blick-card canvas")).toBeVisible();
  await expect(page.locator("haus-blick-card .fallback")).toBeHidden();
});

test("reimport with unresolved bindings is blocked and changing parameters invalidates the preview", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/");
  await page.evaluate(() => (window as any).openEditor());
  const editor = page.locator("haus-blick-card-editor");
  const plan = {
    schemaVersion: 1,
    name: "Other",
    unit: "m",
    walls: [],
    rooms: [
      {
        id: "other",
        name: "Neu",
        polygon: [
          { x: 0, z: 0 },
          { x: 4, z: 0 },
          { x: 4, z: 4 },
          { x: 0, z: 4 },
        ],
      },
    ],
  };
  await editor.locator(".import-file").setInputFiles({
    name: "other.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(plan)),
  });
  await editor.locator(".preview-import").click();
  await expect(editor.locator(".import-preview")).toContainText(
    "Übernahme gesperrt",
  );
  await expect(editor.locator(".apply-import")).toBeDisabled();
  expect(await page.evaluate(() => (window as any).configEvents.length)).toBe(
    0,
  );
  await editor.locator(".import-rotation").selectOption("90");
  await expect(editor.locator(".import-preview")).toBeEmpty();
});

test("import can explicitly remap existing entities before saving", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/");
  await page.evaluate(() => (window as any).openEditor());
  const editor = page.locator("haus-blick-card-editor");
  const plan = {
    schemaVersion: 1,
    name: "Neu",
    unit: "m",
    walls: [],
    rooms: [
      {
        id: "newroom",
        name: "Neuer Raum",
        polygon: [
          { x: 0, z: 0 },
          { x: 6, z: 0 },
          { x: 6, z: 4 },
          { x: 0, z: 4 },
        ],
      },
    ],
  };
  await editor
    .locator(".import-file")
    .setInputFiles({
      name: "new.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(plan)),
    });
  await editor.locator(".preview-import").click();
  await expect(editor.locator(".apply-import")).toBeDisabled();
  await expect(editor.locator(".import-binding")).toHaveCount(3);
  for (const row of await editor.locator(".import-binding").all())
    await row.locator("select").selectOption("newroom");
  await expect(editor.locator(".apply-import")).toBeEnabled();
  await editor.locator(".apply-import").click();
  expect(
    await page.evaluate(() =>
      (window as any).configEvents.at(-1).entities.map((e: any) => e.room),
    ),
  ).toEqual(["newroom", "newroom", "newroom"]);
  expect(
    await page.evaluate(
      () => (window as any).configEvents.at(-1).entities[0].entity,
    ),
  ).toBe("sensor.living_temperature");
});

test("visual editor adds garden objects and wall openings without writing HA services", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/");
  await page.evaluate(() => (window as any).openEditor());
  const editor = page.locator("haus-blick-card-editor");
  await editor
    .getByRole("button", { name: "Gartenobjekt hinzufügen", exact: true })
    .click();
  await expect(editor.locator(".plant")).toHaveCount(1);
  await editor.locator('.plant [name="kind"]').selectOption("pot");
  expect(
    await page.evaluate(
      () => (window as any).configEvents.at(-1).plants[0].kind,
    ),
  ).toBe("pot");
  await editor
    .getByRole("button", { name: "Öffnung hinzufügen", exact: true })
    .click();
  await expect(editor.locator(".opening")).toHaveCount(1);
  expect(
    await page.evaluate(
      () => (window as any).configEvents.at(-1).building.openings[0].sill,
    ),
  ).toBe(0);
  await editor.locator('.opening [name="width"]').fill("100");
  await editor.locator('.opening [name="width"]').press("Tab");
  await expect(editor.locator('[role="alert"]')).not.toBeEmpty();
});
