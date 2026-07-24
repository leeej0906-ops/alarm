const newsBtn = document.getElementById("newsBtn");
const newsListEl = document.getElementById("newsList");
const newsBriefingListEl = document.getElementById("newsBriefingList");

const ORDINAL_WORDS = ["첫번째", "두번째", "세번째", "네번째", "다섯번째"];

function stripHtmlTags(str) {
  return String(str).replace(/<[^>]*>/g, "");
}

const NEWS_FETCH_TIMEOUT_MS = 5000;

async function fetchRecentNews(keyword, count = 5) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NEWS_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(SUPABASE_NEWS_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ keyword }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Edge Function responded with status ${res.status}`);
    }

    const data = await res.json();
    if (data && Array.isArray(data.items)) {
      data.items = data.items.slice(0, count);
    }
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildFormattedDateText(pubDate) {
  const d = new Date(pubDate);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildNewsCardElement(item) {
  const card = document.createElement("li");
  card.className = "news-card";
  card.innerHTML = `
    <div class="news-card-title">${stripHtmlTags(item.title)}</div>
    <p class="news-card-desc">${stripHtmlTags(item.description)}</p>
    <div class="news-card-date">${buildFormattedDateText(item.pubDate)}</div>
    <a class="news-card-link" href="${item.link}" target="_blank" rel="noopener noreferrer">원문보기</a>
  `;
  return card;
}

function renderNewsList(items) {
  newsListEl.innerHTML = "";
  items.forEach((item) => {
    newsListEl.appendChild(buildNewsCardElement(item));
  });
}

function renderNewsLoading() {
  newsListEl.innerHTML = `<li class="news-loading">불러오는 중...</li>`;
}

function renderNewsError() {
  newsListEl.innerHTML = `<li class="news-error">뉴스를 불러올 수 없습니다.</li>`;
}

function renderNewsEmpty() {
  newsListEl.innerHTML = `<li class="news-empty">표시할 뉴스가 없습니다.</li>`;
}

function renderNewsTimeout(keyword) {
  newsListEl.innerHTML = "";
  const item = document.createElement("li");
  item.className = "news-timeout";
  item.innerHTML = `
    <p>요청 시간이 초과되었습니다.</p>
    <button type="button" class="news-retry-btn">재시도</button>
  `;
  item.querySelector(".news-retry-btn").addEventListener("click", () => {
    fetchAndRenderNews(keyword);
  });
  newsListEl.appendChild(item);
}

async function fetchAndRenderNews(keyword) {
  renderNewsLoading();
  try {
    const data = await fetchRecentNews(keyword);
    if (!data || !Array.isArray(data.items)) {
      renderNewsError();
      return;
    }
    if (data.items.length === 0) {
      renderNewsEmpty();
      return;
    }
    renderNewsList(data.items);
  } catch (e) {
    if (e.name === "AbortError") {
      renderNewsTimeout(keyword);
    } else {
      renderNewsError();
    }
  }
}

newsBtn.addEventListener("click", () => {
  const keyword = window.prompt("검색할 뉴스 키워드를 입력하세요.");
  if (!keyword) return;
  fetchAndRenderNews(keyword);
});

function buildBriefingText(items) {
  return items
    .map((item, i) => {
      const ordinal = ORDINAL_WORDS[i] || `${i + 1}번째`;
      return `${ordinal} 뉴스, ${stripHtmlTags(item.title)}.`;
    })
    .join(" ");
}

function renderNewsBriefing(items) {
  newsBriefingListEl.innerHTML = "";
  items.forEach((item) => {
    newsBriefingListEl.appendChild(buildNewsCardElement(item));
  });
}

function speakBriefing(text) {
  if (!("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ko-KR";
  window.speechSynthesis.speak(utterance);
}

function stopBriefing() {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
}
