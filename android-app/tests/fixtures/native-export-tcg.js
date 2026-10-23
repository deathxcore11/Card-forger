  A.tExportColl = () => {
    const G = g(),
      rows = [["Quantity", "Name", "Set", "Printing", "Rarity/Version", "Edition", "Condition", "Price USD"]];
    for (const e of gs(G).collection) {
      const card = cardOf(G, e.cardId);
      rows.push([e.qty, e.name, setLabel({ e, c: card }), e.printing || card?.set?.number || "", e.rarity || e.variantLabel || e.variant || "", e.edition || "", e.condition || "", entryPrice(card, e) ?? ""]);
    }
    download(`CardStashy_${GAMES[G].short.replace(/\W/g, "")}_collection.csv`, rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n") + "\n", "text/csv");
  };

  A.tDeckExport = (t) => {
    const G = g(),
      d = gs(G).decks.find((x) => x.id === t.dataset.id);
    download(d.name.replace(/[^a-z0-9]+/gi, "_") + "." + SOURCES[G].exportExt, SOURCES[G].exportText(d, (id) => cardOf(G, id)));
  };
