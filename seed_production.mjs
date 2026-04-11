import { createPool } from "mysql2/promise";

const pool = createPool({ uri: process.env.DATABASE_URL, ssl: { rejectUnauthorized: true } });

async function seed() {
  const conn = await pool.getConnection();
  try {
    // Check if sectors already exist
    const [existing] = await conn.query("SELECT COUNT(*) as cnt FROM production_sectors");
    if (existing[0].cnt > 0) {
      console.log("Sectors already seeded, skipping...");
      return;
    }

    const sectors = [
      { ordem: 1, nome: "Multilâmina", unidade_medida: "m³", unidade_label: "Metro cúbico consumido", tipo_equipamento: "maquina", qtd_equipamentos: 2, is_sequencial: true, cor: "#2563eb" },
      { ordem: 2, nome: "Vareteira", unidade_medida: "sacos", unidade_label: "Sacos produzidos", tipo_equipamento: "maquina", qtd_equipamentos: 5, is_sequencial: true, cor: "#7c3aed" },
      { ordem: 3, nome: "Seletoras Toco", unidade_medida: "sacos", unidade_label: "Sacos produzidos", tipo_equipamento: "maquina", qtd_equipamentos: 3, is_sequencial: true, cor: "#0891b2" },
      { ordem: 4, nome: "Seleção Automática", unidade_medida: "sacos", unidade_label: "Sacos selecionados", tipo_equipamento: "maquina", qtd_equipamentos: 6, is_sequencial: false, cor: "#059669" },
      { ordem: 5, nome: "Seleção Visual", unidade_medida: "formas", unidade_label: "Formas selecionadas", tipo_equipamento: "mesa", qtd_equipamentos: 7, is_sequencial: false, cor: "#d97706" },
      { ordem: 6, nome: "Flow Pack", unidade_medida: "caixas", unidade_label: "Caixas embaladas", tipo_equipamento: "maquina", qtd_equipamentos: 5, is_sequencial: false, cor: "#dc2626" },
      { ordem: 7, nome: "Ponteira", unidade_medida: "caixas", unidade_label: "Caixas produzidas", tipo_equipamento: "maquina", qtd_equipamentos: 1, is_sequencial: false, cor: "#be185d" },
      { ordem: 8, nome: "Embalagem", unidade_medida: "caixas", unidade_label: "Caixas embaladas", tipo_equipamento: null, qtd_equipamentos: 0, is_sequencial: false, cor: "#92400e" },
      { ordem: 9, nome: "Máquina Pirografar", unidade_medida: "caixas", unidade_label: "Caixas pirografadas", tipo_equipamento: "maquina", qtd_equipamentos: 3, is_sequencial: false, cor: "#4338ca" },
    ];

    for (const s of sectors) {
      const [result] = await conn.query(
        `INSERT INTO production_sectors (ordem, nome, unidade_medida, unidade_label, tipo_equipamento, quantidade_equipamentos, is_sequencial, cor) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [s.ordem, s.nome, s.unidade_medida, s.unidade_label, s.tipo_equipamento, s.qtd_equipamentos, s.is_sequencial, s.cor]
      );
      const sectorId = result.insertId;
      console.log(`Setor ${s.ordem}: ${s.nome} (ID: ${sectorId})`);

      // Create machines/tables for this sector
      if (s.tipo_equipamento && s.qtd_equipamentos > 0) {
        for (let i = 1; i <= s.qtd_equipamentos; i++) {
          const label = s.tipo_equipamento === "mesa" ? "Mesa" : "Máquina";
          await conn.query(
            `INSERT INTO production_machines (sector_id, ordem, nome) VALUES (?, ?, ?)`,
            [sectorId, i, `${label} ${i}`]
          );
        }
        console.log(`  -> ${s.qtd_equipamentos} ${s.tipo_equipamento === "mesa" ? "mesas" : "máquinas"} criadas`);
      }
    }

    console.log("\nSeed concluído com sucesso!");
  } finally {
    conn.release();
    await pool.end();
  }
}

seed().catch(console.error);
