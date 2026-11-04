const LANGUAGE_NAMES={"ru":"Русский","en":"English","kk":"Қазақша","es":"Español","fr":"Français","de":"Deutsch","pt":"Português","it":"Italiano","zh":"中文","ja":"日本語","ko":"한국어","ar":"العربية","hi":"हिन्दी","bn":"বাংলা","ur":"اردو","pa":"ਪੰਜਾਬੀ","tr":"Türkçe","vi":"Tiếng Việt","th":"ไทย","id":"Bahasa Indonesia","ms":"Bahasa Melayu","fa":"فارسی","sw":"Kiswahili","ta":"தமிழ்","te":"తెలుగు","mr":"मराठी","gu":"ગુજરાતી","kn":"ಕನ್ನಡ","ml":"മലയാളം","or":"ଓଡ଼ିଆ","ne":"नेपाली","si":"සිංහල","my":"မြန်မာဘာသာ","km":"ខ្មែរ","lo":"ລາວ","mn":"Монгол","uz":"Oʻzbek","tg":"Тоҷикӣ","ky":"Кыргызча","tk":"Türkmençe","az":"Azərbaycanca","hy":"Հայերեն","ka":"ქართული","he":"עברית","el":"Ελληνικά","nl":"Nederlands","pl":"Polski","uk":"Українська","be":"Беларуская","cs":"Čeština","sk":"Slovenčina","hu":"Magyar","ro":"Română","bg":"Български","sr":"Српски","hr":"Hrvatski","bs":"Bosanski","sl":"Slovenščina","sq":"Shqip","mk":"Македонски","sv":"Svenska","no":"Norsk","da":"Dansk","fi":"Suomi","is":"Íslenska","et":"Eesti","lv":"Latviešu","lt":"Lietuvių","ga":"Gaeilge","cy":"Cymraeg","mt":"Malti","eu":"Euskara","ca":"Català","gl":"Galego","af":"Afrikaans","am":"አማርኛ","om":"Afaan Oromoo","so":"Soomaali","ha":"Hausa","yo":"Yorùbá","ig":"Igbo","zu":"isiZulu","xh":"isiXhosa","st":"Sesotho","ny":"Chichewa","rw":"Kinyarwanda","mg":"Malagasy","sn":"chiShona","ps":"پښتو","ku":"Kurdî","sd":"سنڌي","ug":"ئۇيغۇرچە","bo":"བོད་སྐད་","fil":"Filipino","jv":"Basa Jawa","su":"Basa Sunda","ceb":"Cebuano","mi":"Te Reo Māori","ht":"Kreyòl ayisyen","lb":"Lëtzebuergesch"};
const SYSTEM_PROMPT = `Ты — AUTOHELP AI, автомобильный технический помощник. Отвечай на русском языке, понятно и структурированно.

ПРАВИЛА ДИАГНОСТИКИ:
- Учитывай все симптомы и обстоятельства, указанные пользователем. Не задавай повторно вопросы, на которые уже есть ответы.
- Отделяй известные факты от предположений. Не выдумывай сведения об автомобиле.
- Не выдавай предположение за подтверждённый диагноз.
- Ранжируй 2–4 наиболее подходящие причины от вероятных к менее вероятным. Объясняй, почему они подходят и как их проверить.
- Если данных недостаточно, задай максимум 3 новых уточняющих вопроса.
- Сначала предлагай простые и безопасные проверки, затем проверки на СТО.
- Не выдумывай цены, нормы, коды ошибок и сроки ремонта.
- Стоимость указывай только при достаточных данных о городе, неисправности и объёме работ. Иначе честно сообщи, что данных недостаточно.
- Отдельно указывай срочность: наблюдение, диагностика в ближайшее время или остановка и вызов помощи.
- При проблемах с тормозами, рулём, перегреве, утечке топлива, дыме в салоне или красных предупреждениях советуй безопасно остановиться.
- При подозрении на попадание охлаждающей жидкости в цилиндры, сильном дыме или перегреве не советуй продолжать движение до проверки.
- Не предлагай отключать системы безопасности.
- Это предварительная справка, а не подтверждённый диагноз.

ФОРМАТ ОТВЕТА:
1. Что известно.
2. Наиболее вероятные причины — с объяснением и способом проверки.
3. Что проверить сначала — отдельно самостоятельно и на СТО.
4. Срочность и рекомендации.
5. Уточняющие вопросы — только если нужны.

Пиши конкретно, без повторов и длинных общих лекций. При поступлении новых сведений пересматривай причины с учётом всей информации.`;

export default async (request) => {
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options":"nosniff" };

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Используй POST-запрос." }), { status: 405, headers });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Не настроен OPENAI_API_KEY в Netlify." }), { status: 503, headers });
  }

  let body;
  try {
    const size = Number(request.headers.get("content-length") || 0);
    if (size > 12000) return new Response(JSON.stringify({error:"Запрос слишком большой."}),{status:413,headers});
    const raw = await request.text();
    if (raw.length > 12000) return new Response(JSON.stringify({error:"Запрос слишком большой."}),{status:413,headers});
    body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid body");
  } catch {
    return new Response(JSON.stringify({ error: "Некорректные данные." }), { status: 400, headers });
  }

  const language = typeof body.language === "string" && Object.hasOwn(LANGUAGE_NAMES,body.language) ? body.language : "ru";
  const vehicle = typeof body.vehicle === "string" ? body.vehicle.trim() : "";
  const mileage = typeof body.mileage === "string" ? body.mileage.trim() : "";
  const symptoms = typeof body.symptoms === "string" ? body.symptoms.trim() : "";

  if (vehicle.length > 160 || mileage.length > 40 || symptoms.length > 3000) {
    return new Response(JSON.stringify({error:"Превышена допустимая длина текста."}),{status:413,headers});
  }
  if (!vehicle || !symptoms) {
    return new Response(JSON.stringify({ error: "Укажи автомобиль и симптомы." }), { status: 400, headers });
  }

  // Validate Supabase session and consume an atomic per-user daily quota before AI spending.
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return new Response(JSON.stringify({error:"Войди в аккаунт, чтобы пользоваться AI-диагностикой."}),{status:401,headers});
  const supabaseUrl="https://qhhccricgwdkpnlmazed.supabase.co";
  const publishableKey="sb_publishable_Ntim2FW-MYjti8HiaCtWEg_su1qeDpj";
  const authHeaders={apikey:publishableKey,Authorization:"Bearer "+token};
  try {
    const userResponse=await fetch(supabaseUrl+"/auth/v1/user",{headers:authHeaders,signal:AbortSignal.timeout(8000)});
    if(!userResponse.ok)return new Response(JSON.stringify({error:"Сессия истекла. Войди в аккаунт повторно."}),{status:401,headers});
    const user=await userResponse.json();
    if(!user?.id)return new Response(JSON.stringify({error:"Не удалось проверить аккаунт."}),{status:401,headers});
    const quotaResponse=await fetch(supabaseUrl+"/rest/v1/rpc/consume_ai_quota",{method:"POST",headers:{...authHeaders,"Content-Type":"application/json"},body:"{}",signal:AbortSignal.timeout(8000)});
    if(!quotaResponse.ok)return new Response(JSON.stringify({error:"Не удалось проверить лимит AI. Попробуй позже."}),{status:503,headers});
    const quota=await quotaResponse.json();
    if(!quota?.allowed)return new Response(JSON.stringify({error:"Дневной лимит AI исчерпан ("+quota.limit+" запросов). Попробуй завтра или перейди на PRO.",remaining:0,limit:quota.limit}),{status:429,headers});
  }catch{return new Response(JSON.stringify({error:"Не удалось проверить аккаунт и лимит. Попробуй позже."}),{status:503,headers});}

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: AbortSignal.timeout(35000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        instructions: SYSTEM_PROMPT + `\nIMPORTANT: Respond exclusively in ${LANGUAGE_NAMES[language]} (language code ${language}). Translate all headings, safety guidance and questions into that language. Preserve OBD codes unchanged.`,
        input: `Автомобиль: ${vehicle}
Пробег: ${mileage || "не указан"}
Симптомы и обстоятельства:
${symptoms}`,
        max_output_tokens: 1100,
        store: false
      })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      return new Response(JSON.stringify({
        error: response.status===429 ? "AI временно перегружен. Попробуй позже." : "Сервис AI временно недоступен. Попробуй позже."
      }), { status: 502, headers });
    }

    const answer = (Array.isArray(result.output) ? result.output : [])
      .flatMap(item => Array.isArray(item.content) ? item.content : [])
      .filter(part => part.type === "output_text")
      .map(part => typeof part.text === "string" ? part.text : "")
      .join("\n")
      .trim();

    if (!answer) {
      return new Response(JSON.stringify({ error: "AI не вернул ответ." }), { status: 502, headers });
    }

    return new Response(JSON.stringify({ answer }), {
      status: 200,
      headers: { ...headers, "Cache-Control": "no-store" }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: error?.name === "TimeoutError" ? "AI отвечает слишком долго. Попробуй ещё раз." : "Не удалось связаться с AI-сервисом. Попробуй позже."
    }), { status: 502, headers });
  }
};
