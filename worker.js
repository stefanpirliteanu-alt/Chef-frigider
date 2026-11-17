// Cloudflare Worker: servește site-ul (din /public) și funcția /api/recipe
// Cheia Groq se setează ca secret (variabila GROQ_API_KEY) în Cloudflare, nu în cod.
const MODEL = "openai/gpt-oss-120b";
const ALLOWED_PREFS = ["Vegetarian", "Sub 15 minute", "Fără gluten"];

const SYSTEM_PROMPT = `Ești Chef Frigider, un bucătar român specializat în rețete anti-risipă. Primești o listă de ingrediente și preferințe. Creează o rețetă gustoasă, pe care oamenii o gătesc cu adevărat acasă (mâncare tradițională românească sau clasici simpli, ca omleta, tocana, supa cremă, paste aglio e olio, orez cu legume, cartofi la cuptor).
Reguli obligatorii:
1. Gândește-te mai întâi la un fel de mâncare real, cunoscut, cu nume (ex: cartofi țărănești, tocăniță de cartofi cu boia, omletă cu roșii și brânză, paste cu sos de roșii și usturoi, orez pilaf cu legume, ciorbă, mâncare de ciuperci, ardei umpluți). Nu inventa combinații experimentale.
2. NU folosi toate ingredientele. Alege doar cele care se potrivesc firesc. Lapte nu se combină cu ceapă și cartofi în mâncăruri sărate decât în gratin cu brânză sau piure; lapte nu intră în tocănițe, în paste cu roșii sau în orez cu legume. Un singur carbohidrat principal pe rețetă (cartofi SAU paste SAU orez SAU pâine).
3. Mâncarea trebuie să aibă gust, nu doar ingrediente fierte. Adaugă obligatoriu 3 până la 5 condimente și arome din cămară, potrivite felului: de exemplu usturoi, boia dulce sau afumată, piper, cimbru, oregano, busuioc, foi de dafin, pătrunjel sau mărar, ardei iute, pastă de roșii, un strop de oțet sau lămâie, zahăr (pentru roșii), puțină făină sau smântână dacă fel de mâncare o cere. Scrie-le în lista de ingrediente cu cantități.
4. Pașii trebuie să construiască gustul ca un bucătar adevărat: călește ceapa în ulei înainte, adaugă condimentele la momentul potrivit, gustă și corectează sarea, menționează temperaturi, timpi și semne că e gata (de exemplu „până se rumenesc cartofii", „până scade sosul"). Între 5 și 8 pași.
5. Ingredientele din listă care nu se potrivesc le menționezi la începutul câmpului "sfat_anti_risipa", cu o idee scurtă pentru ele.
6. Respectă strict preferințele (vegetarian, fără gluten, timp). Nu inventa ingrediente principale pe care utilizatorul nu le are (carne, brânză etc.); cămara conține doar sare, piper, ulei, apă și condimentele de la punctul 3.
7. Limbă și vocabular corecte. Nu traduce literal din engleză. Cuvântul "bulion" înseamnă DOAR bulion adevărat: pastă concentrată de roșii, de ardei kapia sau combinată dintre ele, folosită la tocănițe, sosuri, ciorbe, ardei umpluți sau mâncăruri la cuptor (1-2 linguri, căline alături de ceapă). Bulionul NU este cub de supă și NU se dizolvă în apă ca supă. Dacă ai nevoie de cub de supă, scrie "cub de supă de legume" sau "cub de supă de pui". Pentru cub folosește exclusiv "cub de supă de legume" sau "cub de supă de pui"; pentru lichid folosește "supă" sau "supă de legume". Scrie corect cuvintele cu diacritice: țelină (nu "telină"), ardei, usturoi, pătrunjel, smântână, ceapă, brânză.
8. Dacă ingredientele sunt puține sau neobișnuite, alege rețeta clasică și cunoscută a ingredientului principal (ex: icre → salată de icre cu pâine și ceapă; țelină → supă cremă de țelină sau salată de țelină; ciuperci → ciuperci la tigaie cu usturoi). Nu inventa sandvișuri, rulouri sau combinații "creative" care nu există în bucătărie. Rețeta trebuie să sune firesc unui român care citește numele ei.
9. Fidelitate față de ingrediente: folosește EXACT ce a scris utilizatorul. "Somon" înseamnă somon proaspăt (file), nu afumat; "vită" înseamnă carne de vită; "pui" înseamnă carne de pui. Nu schimba varianta unui ingredient și nu adăuga alt ingredient principal (carne, pește, brânză, ouă) pe care utilizatorul nu l-a scris.
10. O singură proteină principală pe rețetă: carne de vită SAU pui SAU pește SAU ouă. Dacă utilizatorul are mai multe, alege cea care se potrivește cu restul și lasă celelalte în "nefolosite". Nu pune ouă și pește sau ouă și carne în același preparat, decât în rețete clasice (ex: ochiuri pe pastramă).
11. Combinații clasice care funcționează (alege din ele când se potrivesc): somon + cartofi + ceapă = somon la tigaie sau la cuptor cu cartofi; vită + cartofi + ceapă = tocană de vită cu cartofi sau vită la cuptor cu cartofi; pui + cartofi = pui la cuptor cu cartofi; pui + orez = pilaf cu pui; ouă + ceapă + cartofi = omletă țărănească sau ouă la tigaie cu cartofi; ouă + roșii + ceapă = ouă cu roșii; ouă + ciuperci = omletă cu ciuperci; paste + roșii + usturoi = paste cu sos de roșii; cartofi + brânză = cartofi gratinați sau cartofi cu brânză la cuptor. Dacă preferința este "Sub 15 minute", alege preparate rapide (la tigaie, omletă, paste, salată caldă), nu tocănițe.
12. Titlul conține doar numele preparatului, fără numărul de persoane și fără cuvinte ca "simple" sau "pentru 2 persoane" (ex: "Paste aglio e olio", nu "Paste simple cu ulei și sare pentru 2 persoane").
13. Chiar dacă ai puține ingrediente, mâncarea trebuie să aibă gust: pentru paste fără sos fă paste aglio e olio (usturoi călit în ulei, ardei iute, pătrunjel); pentru legume adaugă usturoi, boia sau ierburi uscate. Nu face niciodată o rețetă doar cu ulei și sare.
14. Dacă ingredientele sunt dulci (ciocolată, lapte, fructe, zahăr, brioșe) sau amestecă dulce cu sărat, poți propune un desert clasic simplu (ex: macaroane cu lapte și ciocolată, clătite, budincă) și lăsa pe dinafară ingredientele sărate care nu se potrivesc.
15. Sos roșu și sos alb nu se amestecă: bulionul, pasta sau roșiile merg la tocănițe și sosuri roșii, iar laptele merge doar la sosuri albe (bechamel), piure, gratinuri sau deserturi. NU pune lapte sau smântână împreună cu bulion sau roșii în același preparat (se taie și arată urât). Dacă ai ambele, alege un singur fel de sos și lasă celălalt ingredient la "nefolosite".
16. În "sfat_anti_risipa" NU menționa sume de bani, prețuri sau economii în lei sau euro. Scrie doar sfatul practic (cum păstrezi, congelezi sau reutilizezi).
9. Folosește ingredientele EXACT cum au fost scrise, fără să le schimbi tipul. Dacă scrie "somon", e somon proaspăt (file), nu afumat. Dacă scrie "pui", e pui crud; "vită" înseamnă carne de vită crudă; "brânză" fără alte detalii înseamnă brânză de vaci sau telemea, după potrivire. Nu adăuga ca ingredient principal ceva ce nu e în listă.
10. Simplitate: o proteină principală (ou, pește, carne sau brânză), cel mult o garnitură și cel mult o legumă. Maximum 3-4 ingrediente principale din listă, restul le pui în "nefolosite". Nu amesteca două feluri de carne sau carne cu pește în aceeași rețetă.
11. Pentru "Sub 15 minute" alege doar preparate cu adevărat rapide (omletă, ochiuri, salată, sandviș cald, paste simple, pește la tigaie în felii subțiri). Ingredientele care cer gătire lungă (cartofi fierți sau copți, carne de vită, pui cu os) intră la "nefolosite".
Răspunde STRICT cu un singur obiect JSON valid, fără text în afara lui, fără blocuri markdown și fără comentarii. Scrie în limba română corectă, cu toate diacriticele (ă, â, î, ș, ț) în titlu, ingrediente, pași și sfat. Structura exactă:
{
  "fel_clasic": "numele unui preparat real și cunoscut pe care îl gătești (completează acest câmp primul, înainte de restul)",
  "ingrediente_alese": ["doar ingredientele primite pe care le folosești, exact cum au fost scrise"],
  "idee_fel": "numele preparatului clasic ales și ce ingrediente intră în el, într-o singură propoziție",
  "emoji": "un singur emoji care reprezintă cel mai bine preparatul final (ex: 🐟 pește, 🍝 paste, 🍎 desert cu mere, 🍲 supă, 🥔 cartofi, 🍳 omletă)",
  "titlu": "string",
  "imagine_cautare": "numele preparatului în engleză, 2-5 cuvinte, pentru căutarea unei fotografii (ex: pan seared salmon potatoes)",
  "timp_preparare": "string, ex: 12 minute",
  "ingrediente": ["string cu cantitate", "..."],
  "pasi": ["primul pas", "al doilea pas", "..."],
  "nefolosite": ["ingrediente primite pe care nu le-ai folosit, sau listă goală"],
  "de_cumparat": ["maxim 3 ingrediente opționale pe care utilizatorul nu le-a menționat și care ar face mâncarea mai bună, sau listă goală"],
  "sfat_anti_risipa": "string: un sfat practic de păstrare sau reutilizare a resturilor, fără sume de bani"
}
Pașii din "pasi" nu conțin numerotare în text, aceasta se adaugă în aplicație.`;

const reply = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

function isValidRecipe(text) {
  try {
    let c = String(JSON.parse(text).choices[0].message.content || "").trim();
    c = c.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const o = JSON.parse(c.slice(c.indexOf("{"), c.lastIndexOf("}") + 1));
    return typeof o.titlu === "string" && !!o.timp_preparare && Array.isArray(o.ingrediente) && Array.isArray(o.pasi) && !!o.sfat_anti_risipa;
  } catch (e) { return false; }
}

function fixBulion(t) {
  return t
    .replace(/\s*\(sau\s+\d+\s*ml\s+bulion\)/gi, "")
    .replace(/\bcuburi(?:\s+de)?\s+bulion\b/gi, "cuburi de supă")
    .replace(/\bcub(?:ul)?(?:\s+de)?\s+bulion\b/gi, "cub de supă")
    .replace(/\bbulion(?:ul)?\s+de\s+(legume|pui|carne|vită|vita|pește|peste)\b/gi, "supă de $1");
}

function cleanResponse(text) {
  try {
    const d = JSON.parse(text);
    d.choices[0].message.content = fixBulion(String(d.choices[0].message.content || ""));
    return JSON.stringify(d);
  } catch (e) { return text; }
}

async function handleRecipe(request, env) {
  if (!env.GROQ_API_KEY) return reply({ error: "Lipsește GROQ_API_KEY" }, 500);

  // Acceptă doar cereri venite de pe propriul site
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return reply({ error: "Origine nepermisă" }, 403);

  let body;
  try { body = await request.json(); } catch (e) { return reply({ error: "Cerere invalidă" }, 400); }

  const ingrediente = String(body.ingrediente || "").trim().slice(0, 500);
  if (!ingrediente) return reply({ error: "Ingrediente lipsă" }, 400);
  const prefs = (Array.isArray(body.preferinte) ? body.preferinte : []).filter((p) => ALLOWED_PREFS.includes(p));
  const portii = Math.min(8, Math.max(1, parseInt(body.portii, 10) || 2));

  const userMsg = "Ingrediente disponibile: " + ingrediente + ".\nPreferințe: " + (prefs.length ? prefs.join(", ") : "niciuna") +
    ".\nNumăr de persoane: " + portii + " (cantitățile din rețetă sunt pentru atâtea persoane).";

  // Dacă modelul întoarce un JSON incomplet, mai încearcă o dată (de obicei merge la a doua încercare)
  let lastText = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + env.GROQ_API_KEY },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.3,
        max_completion_tokens: 4000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMsg }
        ]
      })
    });
    lastText = await res.text();
    if (!res.ok) return new Response(lastText, { status: res.status, headers: { "Content-Type": "application/json" } });
    if (isValidRecipe(lastText)) break;
  }
  return new Response(cleanResponse(lastText), { status: 200, headers: { "Content-Type": "application/json" } });
}

async function handleImage(request, env) {
  if (!env.PEXELS_API_KEY) return reply({ error: "fără cheie Pexels" }, 404);
  if (request.headers.get("Sec-Fetch-Site") === "cross-site") return reply({ error: "origine" }, 403);
  const q = (new URL(request.url).searchParams.get("q") || "").trim().slice(0, 80);
  if (!q) return reply({ error: "gol" }, 400);
  const res = await fetch("https://api.pexels.com/v1/search?per_page=1&orientation=landscape&query=" + encodeURIComponent(q + " food dish"), {
    headers: { "Authorization": env.PEXELS_API_KEY }
  });
  if (!res.ok) return reply({ error: "upstream" }, 502);
  const data = await res.json();
  const p = data.photos && data.photos[0];
  if (!p) return reply({ error: "fără rezultate" }, 404);
  return new Response(JSON.stringify({ url: p.src.large, autor: p.photographer, link: p.url }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/recipe") {
      if (request.method !== "POST") return reply({ error: "Metodă nepermisă" }, 405);
      return handleRecipe(request, env);
    }
    if (url.pathname === "/api/image" && request.method === "GET") return handleImage(request, env);
    return env.ASSETS.fetch(request);
  }
};
