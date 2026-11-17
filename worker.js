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
7. Limbă și vocabular corecte. Nu traduce literal din engleză. "Bulion" în română înseamnă suc sau pastă de roșii, NU cub de supă: pentru cub folosește "cub de supă" sau "supă concentrată". Scrie corect cuvintele cu diacritice: țelină (nu "telină"), ardei, usturoi, pătrunjel, smântână, ceapă, brânză.
8. Dacă ingredientele sunt puține sau neobișnuite, alege rețeta clasică și cunoscută a ingredientului principal (ex: icre → salată de icre cu pâine și ceapă; țelină → supă cremă de țelină sau salată de țelină; ciuperci → ciuperci la tigaie cu usturoi). Nu inventa sandvișuri, rulouri sau combinații "creative" care nu există în bucătărie. Rețeta trebuie să sune firesc unui român care citește numele ei.
Răspunde STRICT cu un singur obiect JSON valid, fără text în afara lui, fără blocuri markdown și fără comentarii. Scrie în limba română corectă, cu toate diacriticele (ă, â, î, ș, ț) în titlu, ingrediente, pași și sfat. Structura exactă:
{
  "titlu": "string",
  "timp_preparare": "string, ex: 12 minute",
  "ingrediente": ["string cu cantitate", "..."],
  "pasi": ["primul pas", "al doilea pas", "..."],
  "nefolosite": ["ingrediente primite pe care nu le-ai folosit, sau listă goală"],
  "de_cumparat": ["maxim 3 ingrediente opționale pe care utilizatorul nu le-a menționat și care ar face mâncarea mai bună, sau listă goală"],
  "sfat_anti_risipa": "string: un sfat practic de păstrare sau reutilizare a resturilor, plus o estimare în lei a banilor economisiți prin folosirea acestor ingrediente în loc să fie aruncate"
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
        temperature: 0.5,
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
  return new Response(lastText, { status: 200, headers: { "Content-Type": "application/json" } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/recipe") {
      if (request.method !== "POST") return reply({ error: "Metodă nepermisă" }, 405);
      return handleRecipe(request, env);
    }
    return env.ASSETS.fetch(request);
  }
};
