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

// "Tostitos | Rock in Rio 2024 | Rio de Janeiro" → cliente, projeto e local
// Também aceita o formato "Cliente - Projeto".
function splitTitle(full) {
  const parts = full.split(/\s+[|–—-]\s+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length === 1) return { client: parts[0], title: "", place: "" };
  return { client: parts[0], title: parts[1], place: parts.slice(2).join(", ") };
}

// O projeto do Behance é o mesmo que já está no site?
function sameProject(x, client, title, link) {
  if (x.behance && x.behance === link) return true;
  const xc = norm(x.client), c = norm(client);
  if (!xc || !c || !(xc === c || xc.includes(c) || c.includes(xc))) return false;
  const xt = norm(x.title), t = norm(title);
  if (!xt || !t) return xt === t;
  return xt.includes(t) || t.includes(xt);
}

const isOldSite = (u) => !u || /fevieira\.com/.test(u);

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
let list = data.projects;
const feed = await fetchFeed();
let added = 0, updated = 0, merged = 0;

// Ajusta entradas antigas do Behance gravadas antes do formato "Cliente | Projeto | Local"
// e junta com o projeto equivalente que já estava no site, se houver.
for (const b of list.filter((x) => x.source === "behance" && / \| /.test(x.client))) {
  Object.assign(b, splitTitle(b.client));
}
for (const b of list.filter((x) => x.source === "behance")) {
  const twin = list.find((x) => x !== b && x.source !== "behance" && sameProject(x, b.client, b.title, b.behance));
  if (!twin) continue;
  twin.behance = b.behance;
  if (!twin.img) twin.img = b.img;
  if (isOldSite(twin.url)) twin.url = b.behance;
  if (!twin.place && b.place) twin.place = b.place;
  list = list.filter((x) => x !== b);
  merged++;
}

for (const p of feed) {
  const { client, title, place } = splitTitle(p.full);
  const existing = list.find((x) => sameProject(x, client, title, p.link));
  if (existing) {
    let changed = false;
    if (!existing.behance) { existing.behance = p.link; changed = true; }
    // A capa do site é sempre a capa do projeto no Behance
    // (a menos que o projeto tenha "keepImg": true no projects.json).
    if (p.img && existing.img !== p.img && !existing.keepImg) { existing.img = p.img; changed = true; }
    if (isOldSite(existing.url)) { existing.url = p.link; changed = true; }
    if (!existing.place && place) { existing.place = place; changed = true; }
    if (changed) updated++;
    continue;
  }
  const year = Number((p.full.match(/\b(20\d{2})\b/) || [])[1]) || p.date.getFullYear();
  list.push({
    client, title, place, year,
    type: guessType(p.full + " " + p.text),
    img: p.img, url: p.link, behance: p.link,
    published: p.date.toISOString().slice(0, 10),
    source: "behance",
  });
  added++;
}

// O site mostra só o acervo do Behance: remove o que não tiver link de lá.
data.projects = list.filter((x) => x.behance);
data.profile = `https://www.behance.net/${USER}`;
data.updated = new Date().toISOString();
await writeFile(FILE, JSON.stringify(data, null, 2) + "\n");
console.log(`Behance: ${feed.length} no feed · ${added} novos · ${updated} atualizados · ${merged} duplicados juntados · ${list.length} no total`);
