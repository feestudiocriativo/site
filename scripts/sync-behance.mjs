// Sincroniza os projetos do Behance com a aba Cases do site.
// Lê o feed público do perfil, adiciona os projetos novos em site/projects.json
// e completa capa/link dos que já existem. Nunca apaga nada que já está no arquivo.
//
// Uso: BEHANCE_USER=seu-usuario node scripts/sync-behance.mjs

import { readFile, writeFile } from "node:fs/promises";

const USER = process.env.BEHANCE_USER;
const FILE = new URL("../site/projects.json", import.meta.url);

if (!USER || USER === "SEU-USUARIO-AQUI") {
  console.error("Defina BEHANCE_USER com o seu usuário do Behance (o que vem depois de behance.net/).");
  process.exit(1);
}

// Palavras no título → tipo de projeto (o primeiro que bater vence)
const TYPES = [
  ["Festival", /rock in rio|the town|lollapalooza|festival|oktoberfest|arena|show/i],
  ["Corporativo", /conven[cç][aã]o|summit|forum|fórum|congresso|palco|plen[aá]ria|confraria|estande|stand|feira/i],
  ["PDV / Showroom", /pdv|showroom|vip room|loja|varejo|vitrine/i],
  ["3D / Real-time", /unreal|real[- ]?time|3d|anima[cç][aã]o/i],
  ["Interiores", /bedroom|bathroom|kitchen|cozinha|quarto|gourmet|restaurante|resid/i],
  ["Ativação", /ativa[cç][aã]o|premi[eè]re|lan[cç]amento|baile|p[aá]scoa|garten|experi[eê]ncia|cine/i],
];
const guessType = (t) => (TYPES.find(([, re]) => re.test(t)) || ["Projetos"])[0];

const norm = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// "TV Globo - Globoplay | The Town 2023" → cliente "TV Globo", título "Globoplay | The Town 2023"
function splitTitle(full) {
  const m = full.split(/\s+[-–—]\s+/);
  if (m.length > 1) return { client: m[0].trim(), title: m.slice(1).join(" - ").trim() };
  return { client: full.trim(), title: "" };
}

const cdata = (s) => (s || "").replace(/^<!\[CDATA\[|\]\]>$/g, "").trim();
const tag = (xml, name) => cdata((xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`)) || [])[1]);

async function fetchFeed() {
  let xml;
  if (process.env.FEED_FILE) {
    xml = await readFile(process.env.FEED_FILE, "utf8"); // para testes locais
  } else {
    const url = `https://www.behance.net/feeds/user?username=${encodeURIComponent(USER)}`;
    const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (site sync)" } });
    if (!res.ok) throw new Error(`Behance respondeu ${res.status} para ${url}. Confira o usuário.`);
    xml = await res.text();
  }
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, it]) => {
    const full = tag(it, "title");
    const desc = tag(it, "description");
    let img = (desc.match(/<img[^>]+src=['"]([^'"]+)['"]/) || [])[1] || "";
    img = img.replace("/projects/404/", "/projects/808/"); // capa em resolução maior
    const text = desc.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const date = new Date(tag(it, "pubDate"));
    return { full, link: tag(it, "link"), img, text, date };
  });
}

const data = JSON.parse(await readFile(FILE, "utf8"));
const list = data.projects;
const feed = await fetchFeed();
let added = 0, updated = 0;

for (const p of feed) {
  const { client, title } = splitTitle(p.full);
  const key = norm(p.full);
  const existing = list.find(
    (x) => x.behance === p.link || norm(`${x.client} ${x.title}`) === key || norm(x.client) === key ||
      (x.url && norm(x.url.split("/").pop()) === norm(p.link.split("/").pop()))
  );
  if (existing) {
    let changed = false;
    if (!existing.behance) { existing.behance = p.link; changed = true; }
    if (!existing.img && p.img) { existing.img = p.img; changed = true; }
    if (changed) updated++;
    continue;
  }
  const year = Number((p.full.match(/\b(20\d{2})\b/) || [])[1]) || p.date.getFullYear();
  list.push({
    client, title, year,
    type: guessType(p.full + " " + p.text),
    img: p.img, url: p.link, behance: p.link,
    published: p.date.toISOString().slice(0, 10),
    source: "behance",
  });
  added++;
}

data.updated = new Date().toISOString();
await writeFile(FILE, JSON.stringify(data, null, 2) + "\n");
console.log(`Behance: ${feed.length} no feed · ${added} novos · ${updated} atualizados · ${list.length} no total`);
