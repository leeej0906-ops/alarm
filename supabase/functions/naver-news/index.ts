const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  let keyword;
  try {
    const body = await req.json();
    keyword = body?.keyword;
  } catch (_e) {
    keyword = undefined;
  }

  if (!keyword || typeof keyword !== "string") {
    return new Response(JSON.stringify({ error: "keyword is required" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const clientId = Deno.env.get("NAVER_CLIENT_ID");
  const clientSecret = Deno.env.get("NAVER_CLIENT_SECRET");

  const url = new URL("https://openapi.naver.com/v1/search/news.json");
  url.searchParams.set("query", keyword);
  url.searchParams.set("display", "5");
  url.searchParams.set("sort", "date");

  try {
    const naverRes = await fetch(url, {
      headers: {
        "X-Naver-Client-Id": clientId ?? "",
        "X-Naver-Client-Secret": clientSecret ?? "",
      },
    });

    if (!naverRes.ok) {
      throw new Error(`Naver API responded with status ${naverRes.status}`);
    }

    const data = await naverRes.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (_e) {
    return new Response(JSON.stringify({ error: "Failed to fetch news from Naver API" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
