
const SYSTEM_PROMPT = `Ты — AUTOHELP AI, автомобильный технический помощник. Отвечай на русском языке, понятно и структурированно. Не утверждай диагноз без подтверждения. Разделяй вероятные причины по приоритету, объясняй безопасные проверки и указывай, какие данные нужны дальше. Всегда отмечай срочные риски. При неисправностях тормозов, рулевого управления, перегреве, утечке топлива, дыме в салоне, красных предупреждениях или опасной вибрации советуй безопасно остановиться и вызвать помощь. Не предлагай отключать системы безопасности или продолжать опасное движение. Если данных мало — задай до 3 уточняющих вопросов. Не выдумывай нормы, коды и цены. Это предварительная справка, не замена осмотру механика.`;

export default async (request) => {
  const headers = { "Content-Type": "application/json" };

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Используй POST-запрос." }), { status: 405, headers });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Не настроен OPENAI_API_KEY в Netlify." }), { status: 503, headers });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Некорректные данные." }), { status: 400, headers });
  }

  const vehicle = String(body.vehicle || "").trim().slice(0, 160);
  const mileage = String(body.mileage || "").trim().slice(0, 40);
  const symptoms = String(body.symptoms || "").trim().slice(0, 3000);

  if (!vehicle || !symptoms) {
    return new Response(JSON.stringify({ error: "Укажи автомобиль и симптомы." }), { status: 400, headers });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        instructions: SYSTEM_PROMPT,
        input: `Автомобиль: ${vehicle}\nПробег: ${mileage || "не указан"}\nСимптомы: ${symptoms}`,
        max_output_tokens: 900,
        store: false
      })
    });

    const result = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({
        error: result?.error?.message || "Ошибка AI API. Проверь доступ и оплату."
      }), { status: 502, headers });
    }

    const answer = (result.output || [])
      .flatMap(item => item.content || [])
      .filter(part => part.type === "output_text")
      .map(part => part.text)
      .join("\n")
      .trim();

    if (!answer) {
      return new Response(JSON.stringify({ error: "AI не вернул ответ." }), { status: 502, headers });
    }

    return new Response(JSON.stringify({ answer }), {
      status: 200,
      headers: { ...headers, "Cache-Control": "no-store" }
    });

  } catch {
    return new Response(JSON.stringify({
      error: "Не удалось связаться с AI-сервисом. Попробуй позже."
    }), { status: 502, headers });
  }
};
