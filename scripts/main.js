// ===============================
// CAST COST MODULE (v13 SAFE)
// ===============================

console.log("Cast Cost module loaded");

// ===============================
// TOOLBAR BUTTON (SCENE CONTROLS)
// ===============================

Hooks.on("getSceneControlButtons", (controls) => {
  if (!game.user.isGM) return;

  const group = controls.find(c => c.name === "token") || controls[0];

  group.tools.push({
    name: "cast-cost",
    title: "Cast Cost",
    icon: "fas fa-coins",
    onClick: () => openActorSelector(),
    button: true
  });
});

// ===============================
// ACTOR SELECTOR POPUP
// ===============================

async function openActorSelector() {
  const actors = game.actors.filter(a => {
    if (a.type !== "character") return false;

    const owners = game.users.filter(u =>
      !u.isGM && a.testUserPermission(u, "OWNER")
    );

    return owners.length > 0;
  });

  if (!actors.length) {
    return ui.notifications.warn("No valid player characters found.");
  }

  let content = `<form><div style="max-height:300px; overflow:auto;">`;

  for (let actor of actors) {
    const owners = game.users
      .filter(u => !u.isGM && actor.testUserPermission(u, "OWNER"))
      .map(u => u.name)
      .join(", ");

    content += `
      <label style="display:block; margin-bottom:4px;">
        <input type="checkbox" name="actor" value="${actor.id}">
        ${actor.name} <span style="opacity:0.6;">(${owners})</span>
      </label>
    `;
  }

  content += `</div></form>`;

  new Dialog({
    title: "Cast Cost - Select Characters",
    content,
    buttons: {
      generate: {
        label: "Generate Report",
        callback: async (html) => {
          const selectedIds = html.find("input[name='actor']:checked")
            .map((i, el) => el.value)
            .get();

          if (!selectedIds.length) {
            return ui.notifications.warn("No characters selected.");
          }

          const actors = selectedIds.map(id => game.actors.get(id));
          const report = generateReport(actors);
          await createJournal(report);
        }
      },
      cancel: {
        label: "Cancel"
      }
    }
  }).render(true);
}

// ===============================
// SPELL COST DETECTION
// ===============================

function extractCost(materialText) {
  if (!materialText) return null;

  const match = materialText.match(/(\d+)\s?gp/i);
  if (!match) return null;

  return {
    cost: Number(match[1]),
    text: materialText
  };
}

// ===============================
// REPORT GENERATION
// ===============================

function generateReport(actors) {
  let content = `<h1>Cast Cost Report</h1>`;

  for (let actor of actors) {
    const spells = actor.items.filter(i => i.type === "spell");

    let valid = [];

    for (let spell of spells) {
      const material = spell.system.components?.materials?.value;
      const cost = extractCost(material);

      if (cost) {
        valid.push({
          name: spell.name,
          cost: cost.cost,
          material: cost.text
        });
      }
    }

    if (!valid.length) continue;

    content += `<h2>${actor.name}</h2><ul>`;

    for (let s of valid) {
      content += `<li><strong>${s.name}</strong> — ${s.cost} gp (${s.material})</li>`;
    }

    content += `</ul>`;
  }

  return content;
}

// ===============================
// JOURNAL CREATION (SAFE NAMING)
// ===============================

async function createJournal(content) {
  const date = new Date().toISOString().split("T")[0];

  let base = `Cast Cost – ${date}`;
  let name = base;
  let i = 1;

  while (game.journal.some(j => j.name === name)) {
    name = `${base} (${String(i).padStart(3, "0")})`;
    i++;
  }

  await JournalEntry.create({
    name,
    pages: [
      {
        name: "Report",
        type: "text",
        text: { content }
      }
    ]
  });

  ui.notifications.info(`Journal created: ${name}`);
}
