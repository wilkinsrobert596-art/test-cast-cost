// ===============================
// CAST COST MODULE
// ===============================

Hooks.on("getSceneControlButtons", (controls) => {
  if (!game.user.isGM) return;

  controls.push({
    name: "cast-cost",
    title: "Cast Cost",
    icon: "fas fa-coins",
    layer: "controls",
    tools: [
      {
        name: "generate-cast-cost",
        title: "Generate Cast Cost Report",
        icon: "fas fa-file-alt",
        onClick: () => openActorSelector(),
        button: true
      }
    ]
  });
});

// ===============================
// ACTOR SELECTOR
// ===============================

async function openActorSelector() {
  const actors = game.actors.filter(a => {
    if (a.type !== "character") return false;

    // Only actors owned by NON-GM users
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
    title: "Select Characters",
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

          const selectedActors = selectedIds.map(id => game.actors.get(id));
          const report = generateReport(selectedActors);
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
// SPELL SCANNER
// ===============================

function extractCost(materialText) {
  if (!materialText) return null;

  const match = materialText.match(/(\d+)\s?gp/i);
  if (!match) return null;

  return {
    cost: parseInt(match[1]),
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

    let validSpells = [];

    for (let spell of spells) {
      const material = spell.system.components?.materials?.value;
      const costData = extractCost(material);

      if (costData) {
        validSpells.push({
          name: spell.name,
          cost: costData.cost,
          material: costData.text
        });
      }
    }

    if (!validSpells.length) continue;

    content += `<h2>${actor.name}</h2><ul>`;

    for (let s of validSpells) {
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

  let baseName = `Cast Cost – ${date}`;
  let name = baseName;
  let counter = 1;

  while (game.journal.some(j => j.name === name)) {
    name = `${baseName} (${String(counter).padStart(3, "0")})`;
    counter++;
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

  ui.notifications.info(`Cast Cost journal created: ${name}`);
}