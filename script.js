const STORAGE_KEY = "simple-alarm-app:alarms";

const clockTimeEl = document.getElementById("clockTime");
const clockDateEl = document.getElementById("clockDate");
const alarmTimeInput = document.getElementById("alarmTimeInput");
const alarmLabelInput = document.getElementById("alarmLabelInput");
const repeatDaysEl = document.getElementById("repeatDays");
const addAlarmBtn = document.getElementById("addAlarmBtn");
const alarmListEl = document.getElementById("alarmList");
const emptyMsgEl = document.getElementById("emptyMsg");
const ringingOverlay = document.getElementById("ringingOverlay");
const ringingTimeEl = document.getElementById("ringingTime");
const ringingLabelEl = document.getElementById("ringingLabel");
const snoozeBtn = document.getElementById("snoozeBtn");
const stopBtn = document.getElementById("stopBtn");

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
let selectedDays = new Set();
let alarms = loadAlarms();
let firedKey = null;
let ringingAlarmId = null;
let audioCtx = null;
let alarmIntervalId = null;

const ALARM_NEWS_KEYWORD = "속보";
const ALARM_NEWS_COUNT = 3;

function loadAlarms() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveAlarms() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alarms));
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function updateClock() {
  const now = new Date();
  clockTimeEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  clockDateEl.textContent = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 ${DAY_NAMES[now.getDay()]}요일`;
  checkAlarms(now);
}

function checkAlarms(now) {
  if (ringingAlarmId !== null) return;
  const hh = pad(now.getHours());
  const mm = pad(now.getMinutes());
  const currentTime = `${hh}:${mm}`;
  const minuteKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${currentTime}`;
  if (firedKey === minuteKey) return;

  const day = now.getDay();
  const match = alarms.find((a) => {
    if (!a.enabled) return false;
    if (a.time !== currentTime) return false;
    if (a.days.length > 0 && !a.days.includes(day)) return false;
    return true;
  });

  if (match) {
    firedKey = minuteKey;
    triggerAlarm(match);
  }
}

function triggerAlarm(alarm) {
  ringingAlarmId = alarm.id;
  ringingTimeEl.textContent = alarm.time;
  ringingLabelEl.textContent = alarm.label || "";
  ringingOverlay.classList.add("show");
  startSound();
  briefRecentNews();

  if (alarm.days.length === 0) {
    alarm.enabled = false;
    saveAlarms();
    renderAlarms();
  }
}

async function briefRecentNews() {
  try {
    const data = await fetchRecentNews(ALARM_NEWS_KEYWORD, ALARM_NEWS_COUNT);
    if (!data || !Array.isArray(data.items) || data.items.length === 0) return;
    renderNewsBriefing(data.items);
    speakBriefing(buildBriefingText(data.items));
  } catch (e) {
    // 뉴스 브리핑은 부가 기능이므로 실패해도 알람 소리에는 영향을 주지 않는다.
  }
}

function startSound() {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    return;
  }
  playBeepLoop();
}

function playBeepLoop() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.3, audioCtx.currentTime + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.4);
  alarmIntervalId = setTimeout(playBeepLoop, 600);
}

function stopSound() {
  if (alarmIntervalId) {
    clearTimeout(alarmIntervalId);
    alarmIntervalId = null;
  }
  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
  }
}

function dismissRinging() {
  ringingOverlay.classList.remove("show");
  stopSound();
  stopBriefing();
  ringingAlarmId = null;
}

stopBtn.addEventListener("click", dismissRinging);

snoozeBtn.addEventListener("click", () => {
  const alarm = alarms.find((a) => a.id === ringingAlarmId);
  dismissRinging();
  if (!alarm) return;
  const snoozeTime = new Date(Date.now() + 5 * 60 * 1000);
  const snoozed = {
    id: Date.now() + Math.random(),
    time: `${pad(snoozeTime.getHours())}:${pad(snoozeTime.getMinutes())}`,
    label: alarm.label ? `${alarm.label} (스누즈)` : "스누즈",
    days: [],
    enabled: true,
  };
  alarms.push(snoozed);
  saveAlarms();
  renderAlarms();
});

repeatDaysEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".day-btn");
  if (!btn) return;
  const day = Number(btn.dataset.day);
  if (selectedDays.has(day)) {
    selectedDays.delete(day);
    btn.classList.remove("active");
  } else {
    selectedDays.add(day);
    btn.classList.add("active");
  }
});

addAlarmBtn.addEventListener("click", () => {
  const time = alarmTimeInput.value;
  if (!time) {
    alarmTimeInput.focus();
    return;
  }
  const alarm = {
    id: Date.now() + Math.random(),
    time,
    label: alarmLabelInput.value.trim(),
    days: Array.from(selectedDays).sort(),
    enabled: true,
  };
  alarms.push(alarm);
  alarms.sort((a, b) => a.time.localeCompare(b.time));
  saveAlarms();
  renderAlarms();

  alarmLabelInput.value = "";
  selectedDays.clear();
  repeatDaysEl.querySelectorAll(".day-btn").forEach((b) => b.classList.remove("active"));
});

function formatDays(days) {
  if (days.length === 0) return "한 번";
  if (days.length === 7) return "매일";
  return days.map((d) => DAY_NAMES[d]).join(", ");
}

function renderAlarms() {
  alarmListEl.innerHTML = "";
  emptyMsgEl.style.display = alarms.length === 0 ? "block" : "none";

  alarms.forEach((alarm) => {
    const li = document.createElement("li");
    li.className = "alarm-item" + (alarm.enabled ? "" : " disabled");

    li.innerHTML = `
      <div class="alarm-info">
        <div class="alarm-time">${alarm.time}</div>
        ${alarm.label ? `<div class="alarm-label">${escapeHtml(alarm.label)}</div>` : ""}
        <div class="alarm-days">${formatDays(alarm.days)}</div>
      </div>
      <div class="alarm-controls">
        <label class="switch">
          <input type="checkbox" ${alarm.enabled ? "checked" : ""} data-id="${alarm.id}" class="toggle-input">
          <span class="slider"></span>
        </label>
        <button type="button" class="delete-btn" data-id="${alarm.id}">✕</button>
      </div>
    `;
    alarmListEl.appendChild(li);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

alarmListEl.addEventListener("change", (e) => {
  if (!e.target.classList.contains("toggle-input")) return;
  const id = Number(e.target.dataset.id);
  const alarm = alarms.find((a) => a.id === id);
  if (alarm) {
    alarm.enabled = e.target.checked;
    saveAlarms();
    renderAlarms();
  }
});

alarmListEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".delete-btn");
  if (!btn) return;
  const id = Number(btn.dataset.id);
  alarms = alarms.filter((a) => a.id !== id);
  saveAlarms();
  renderAlarms();
});

renderAlarms();
updateClock();
setInterval(updateClock, 1000);

const WEATHER_URL = "https://api.openweathermap.org/data/2.5/weather?lat=37.5665&lon=126.9780&units=metric&appid=aafbe71f69d7ebca5e1b4171349021dc";
const weatherTempEl = document.getElementById("weatherTemp");

async function loadWeather() {
  try {
    const res = await fetch(WEATHER_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const temp = data?.main?.temp;
    if (typeof temp !== "number") throw new Error("기온 정보 없음");
    weatherTempEl.textContent = `서울 기온: ${Math.round(temp * 10) / 10}°C`;
  } catch (e) {
    weatherTempEl.textContent = "기온 정보를 불러올 수 없습니다.";
  }
}

loadWeather();
