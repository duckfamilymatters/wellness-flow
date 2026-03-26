const STORAGE_KEY = "wellness_flow_v1";
const STARTER_EXERCISES_URL = "starter_exercises.txt";
const PT_TZ = "America/Los_Angeles";

const initialState = {
  exercises: [],
  logs: {},
  todayPick: {},
};

const state = loadState();
let calendarDate = ptNowDate();

const els = {
  exerciseForm: byId("exercise-form"),
  exerciseName: byId("exercise-name"),
  exerciseGuidance: byId("exercise-guidance"),
  exerciseFile: byId("exercise-file"),
  importExercises: byId("import-exercises"),
  importStatus: byId("import-status"),
  exerciseList: byId("exercise-list"),
  exerciseCount: byId("exercise-count"),
  pickExercise: byId("pick-exercise"),
  selectedExercise: byId("selected-exercise"),
  logForm: byId("log-form"),
  moodRating: byId("mood-rating"),
  logNote: byId("log-note"),
  markComplete: byId("mark-complete"),
  markIncomplete: byId("mark-incomplete"),
  stats: byId("stats"),
  monthLabel: byId("month-label"),
  prevMonth: byId("prev-month"),
  nextMonth: byId("next-month"),
  calendarLegend: byId("calendar-legend"),
  calendar: byId("calendar"),
  dayDetail: byId("day-detail"),
};

bindEvents();
registerServiceWorker();
initializeApp();

function byId(id) {
  return document.getElementById(id);
}

function bindEvents() {
  els.exerciseForm?.addEventListener("submit", addExercise);
  els.importExercises?.addEventListener("click", importExercisesFromFile);
  els.pickExercise?.addEventListener("click", pickExerciseForToday);
  els.markComplete?.addEventListener("click", () => saveLog("complete"));
  els.markIncomplete?.addEventListener("click", () => saveLog("incomplete"));
  els.prevMonth?.addEventListener("click", () => shiftMonth(-1));
  els.nextMonth?.addEventListener("click", () => shiftMonth(1));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(initialState);
    return { ...structuredClone(initialState), ...JSON.parse(raw) };
  } catch {
    return structuredClone(initialState);
  }
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function initializeApp() {
  await ensureStarterExercises();
  renderAll();
}

function renderAll() {
  renderExercises();
  renderTodayPick();
  renderStats();
  renderCalendar();
}

async function ensureStarterExercises() {
  try {
    const response = await fetch(STARTER_EXERCISES_URL, { cache: "no-cache" });
    if (!response.ok) return;

    const text = await response.text();
    const starterExercises = parseExercisesFromText(text);
    if (!starterExercises.length) return;

    const existing = new Set(
      state.exercises.map((exercise) => normalizeExerciseKey(exercise.title, exercise.guidance)),
    );

    let changed = false;
    starterExercises.forEach((exercise) => {
      const key = normalizeExerciseKey(exercise.title, exercise.guidance);
      if (existing.has(key)) return;

      state.exercises.push({
        id: crypto.randomUUID(),
        title: exercise.title,
        guidance: exercise.guidance,
      });
      existing.add(key);
      changed = true;
    });

    if (!changed) return;
    persistState();
  } catch {
    // Keep app usable even if starter content cannot be fetched.
  }
}

function addExercise(event) {
  event.preventDefault();
  const title = els.exerciseName?.value.trim();
  const guidance = els.exerciseGuidance?.value.trim();
  if (!title || !guidance) return;

  state.exercises.push({
    id: crypto.randomUUID(),
    title,
    guidance,
  });

  persistState();
  els.exerciseForm.reset();
  renderExercises();
}

async function importExercisesFromFile() {
  const file = els.exerciseFile?.files?.[0];
  if (!file) {
    setImportStatus("请先选择文件。");
    return;
  }

  setImportStatus(`正在读取 ${file.name}...`);

  try {
    const text = await extractTextFromUpload(file);
    const parsed = parseExercisesFromText(text);
    if (!parsed.length) {
      setImportStatus("没有识别到练习。请确认标题行以 練習： 开头，并用空行分隔每个练习。");
      return;
    }

    const existing = new Set(
      state.exercises.map((exercise) => normalizeExerciseKey(exercise.title, exercise.guidance)),
    );

    let added = 0;
    let duplicates = 0;

    parsed.forEach((item) => {
      const key = normalizeExerciseKey(item.title, item.guidance);
      if (existing.has(key)) {
        duplicates += 1;
        return;
      }

      state.exercises.push({
        id: crypto.randomUUID(),
        title: item.title,
        guidance: item.guidance,
      });
      existing.add(key);
      added += 1;
    });

    persistState();
    renderExercises();
    if (els.exerciseFile) els.exerciseFile.value = "";
    setImportStatus(`已导入 ${added} 个练习，跳过 ${duplicates} 个重复项。`);
  } catch (error) {
    setImportStatus(`导入失败：${error.message}`);
  }
}

function setImportStatus(text) {
  if (els.importStatus) {
    els.importStatus.textContent = text;
  }
}

async function extractTextFromUpload(file) {
  const name = file.name.toLowerCase();

  if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".text")) {
    return file.text();
  }

  if (name.endsWith(".docx")) {
    return extractDocxPlainText(await file.arrayBuffer());
  }

  throw new Error("不支持的格式，请上传 .docx、.txt 或 .md 文件。");
}

function parseExercisesFromText(text) {
  const lines = text
    .replaceAll("\u2028", "\n")
    .replaceAll("\u2029", "\n")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .split("\n");
  const items = [];
  let index = 0;

  while (index < lines.length) {
    const titleMatch = lines[index].trim().match(/^練習[:：]\s*(.+?)\s*$/);
    if (!titleMatch) {
      index += 1;
      continue;
    }

    const title = titleMatch[1].trim();
    index += 1;
    const guidanceLines = [];

    while (index < lines.length && !lines[index].trim().match(/^練習[:：]\s*/)) {
      if (lines[index].trim()) {
        guidanceLines.push(lines[index].trim());
      }
      index += 1;
    }

    const guidance = guidanceLines.join("\n").trim();
    if (title && guidance) {
      items.push({ title, guidance });
    }
  }

  return items;
}

function normalizeExerciseKey(title, guidance) {
  return `${title.trim().toLowerCase()}||${guidance.trim().toLowerCase()}`;
}

function removeExercise(id) {
  state.exercises = state.exercises.filter((exercise) => exercise.id !== id);

  const today = ptTodayKey();
  if (state.todayPick[today]?.id === id) {
    delete state.todayPick[today];
  }

  persistState();
  renderAll();
}

function renderExercises() {
  if (!els.exerciseList) return;

  els.exerciseList.innerHTML = "";
  if (els.exerciseCount) {
    els.exerciseCount.textContent = `共 ${state.exercises.length} 个练习`;
  }

  if (!state.exercises.length) {
    const li = document.createElement("li");
    li.textContent = "当前还没有练习。你可以手动添加，或导入现有练习集。";
    els.exerciseList.appendChild(li);
    return;
  }

  state.exercises.forEach((exercise) => {
    const li = document.createElement("li");
    const top = document.createElement("div");
    top.className = "top";

    const title = document.createElement("strong");
    title.textContent = exercise.title;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "ghost";
    removeBtn.textContent = "删除";
    removeBtn.addEventListener("click", () => removeExercise(exercise.id));

    const guidance = document.createElement("p");
    guidance.textContent = exercise.guidance;

    top.append(title, removeBtn);
    li.append(top, guidance);
    els.exerciseList.appendChild(li);
  });
}

function pickExerciseForToday() {
  if (!state.exercises.length) {
    if (els.selectedExercise) {
      els.selectedExercise.textContent = "请先到“编辑练习集”中添加至少一个练习，再抽取今日练习。";
    }
    return;
  }

  const today = ptTodayKey();
  const randomIndex = Math.floor(Math.random() * state.exercises.length);
  state.todayPick[today] = state.exercises[randomIndex];
  persistState();
  renderTodayPick();
}

function renderTodayPick() {
  if (!(els.selectedExercise && els.logForm)) return;

  const today = ptTodayKey();
  const pick = state.todayPick[today];
  const existingLog = state.logs[today];

  if (!pick) {
    els.selectedExercise.innerHTML = `
      <strong>今天还没有抽取练习。</strong>
      <p>准备好了就抽取一个练习。练习集可以在单独页面中编辑。</p>
    `;
    els.logForm.classList.add("hidden");
    return;
  }

  els.selectedExercise.innerHTML = `
    <strong>${escapeHtml(pick.title)}</strong>
    <p>${escapeHtml(pick.guidance)}</p>
  `;

  els.logForm.classList.remove("hidden");
  if (els.moodRating) els.moodRating.value = existingLog?.mood || "";
  if (els.logNote) els.logNote.value = existingLog?.note || "";
}

function saveLog(status) {
  const today = ptTodayKey();
  const pick = state.todayPick[today];
  if (!pick) return;

  state.logs[today] = {
    date: today,
    status,
    exerciseId: pick.id,
    exerciseTitle: pick.title,
    mood: els.moodRating?.value || "",
    note: els.logNote?.value.trim() || "",
  };

  persistState();
  renderStats();
  renderCalendar();
  if (els.dayDetail) {
    els.dayDetail.textContent = `${today} 已保存为“${status === "complete" ? "已完成" : "未完成"}”。`;
  }
}

function renderStats() {
  if (!els.stats) return;

  const today = ptTodayKey();
  const weekKeys = getPastDays(6, today);
  const weekLogs = weekKeys.map((key) => state.logs[key]).filter(Boolean);

  const completedThisWeek = weekLogs.filter((log) => log.status === "complete").length;
  const attemptedThisWeek = weekLogs.length;
  const streak = computeCompletionStreak(today);

  els.stats.innerHTML = `
    <div class="item"><span class="value">${completedThisWeek}</span>本周已完成</div>
    <div class="item"><span class="value">${attemptedThisWeek}</span>本周已记录天数</div>
    <div class="item"><span class="value">${streak}</span>当前连续完成天数</div>
  `;
}

function computeCompletionStreak(todayKey) {
  let streak = 0;
  let cursor = todayKey;

  while (true) {
    const log = state.logs[cursor];
    if (!log || log.status !== "complete") break;
    streak += 1;
    cursor = shiftDateKey(cursor, -1);
  }

  return streak;
}

function renderCalendar() {
  if (!(els.monthLabel && els.calendar)) return;

  const year = Number(calendarDate.slice(0, 4));
  const month = Number(calendarDate.slice(5, 7)) - 1;
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  els.monthLabel.textContent = firstOfMonth.toLocaleDateString("zh-CN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  if (els.calendarLegend) {
    els.calendarLegend.textContent = "已完成的日期按心情评分显示深浅不同的绿色：1 最浅，5 最深。未完成、缺失和未来日期保持中性。";
  }

  const weekdayOrder = ["日", "一", "二", "三", "四", "五", "六"];
  els.calendar.innerHTML = "";

  weekdayOrder.forEach((day) => {
    const cell = document.createElement("div");
    cell.className = "day-name";
    cell.textContent = day;
    els.calendar.appendChild(cell);
  });

  const firstWeekday = firstOfMonth.getUTCDay();
  for (let index = 0; index < firstWeekday; index += 1) {
    const empty = document.createElement("div");
    empty.className = "day empty";
    els.calendar.appendChild(empty);
  }

  const today = ptTodayKey();

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${year}-${pad2(month + 1)}-${pad2(day)}`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "day";
    btn.textContent = String(day);

    const log = state.logs[dateKey];
    if (log?.status === "complete") {
      const mood = Number(log.mood);
      if (Number.isInteger(mood) && mood >= 1 && mood <= 5) {
        btn.classList.add(`complete-${mood}`);
      } else {
        btn.classList.add("complete-unrated");
      }
    }
    if (dateKey === today) {
      btn.classList.add("today");
    }

    btn.addEventListener("click", () => showDayDetail(dateKey));
    els.calendar.appendChild(btn);
  }
}

function showDayDetail(dateKey) {
  if (!els.dayDetail) return;

  const log = state.logs[dateKey];
  if (!log) {
    els.dayDetail.textContent = `${dateKey}：暂无记录。`;
    return;
  }

  const statusText = log.status === "complete" ? "已完成" : "未完成";
  const mood = log.mood ? ` 心情：${log.mood}。` : "";
  const note = log.note ? ` 备注：${log.note}` : "";
  els.dayDetail.textContent = `${dateKey}：${statusText}。练习：${log.exerciseTitle}。${mood}${note}`;
}

function shiftMonth(delta) {
  const year = Number(calendarDate.slice(0, 4));
  const month = Number(calendarDate.slice(5, 7)) - 1;
  const date = new Date(Date.UTC(year, month + delta, 1));
  calendarDate = `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-01`;
  renderCalendar();
}

function ptNowDate() {
  const today = ptTodayKey();
  return `${today.slice(0, 7)}-01`;
}

function ptTodayKey() {
  const parts = ptNowParts();
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function ptNowParts() {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: PT_TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const parts = formatter.formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value || "00";

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

async function extractDocxPlainText(buffer) {
  const xml = await readZipEntryText(buffer, "word/document.xml");
  const rawText = xml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "");
  return decodeXmlEntities(rawText);
}

async function readZipEntryText(buffer, entryPath) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const eocdOffset = findEndOfCentralDirectory(bytes);
  if (eocdOffset === -1) {
    throw new Error("无法读取 .docx 文件（ZIP 结构无效）。");
  }

  const centralDirOffset = view.getUint32(eocdOffset + 16, true);
  const centralDirSize = view.getUint32(eocdOffset + 12, true);
  let pointer = centralDirOffset;
  const limit = centralDirOffset + centralDirSize;

  while (pointer < limit) {
    if (view.getUint32(pointer, true) !== 0x02014b50) break;

    const compressionMethod = view.getUint16(pointer + 10, true);
    const compressedSize = view.getUint32(pointer + 20, true);
    const fileNameLength = view.getUint16(pointer + 28, true);
    const extraLength = view.getUint16(pointer + 30, true);
    const commentLength = view.getUint16(pointer + 32, true);
    const localHeaderOffset = view.getUint32(pointer + 42, true);

    const fileNameBytes = bytes.slice(pointer + 46, pointer + 46 + fileNameLength);
    const fileName = new TextDecoder("utf-8").decode(fileNameBytes);

    if (fileName === entryPath) {
      return extractLocalFileText(view, bytes, localHeaderOffset, compressedSize, compressionMethod);
    }

    pointer += 46 + fileNameLength + extraLength + commentLength;
  }

  throw new Error(`在 .docx 文件中找不到条目：${entryPath}`);
}

async function extractLocalFileText(view, bytes, localHeaderOffset, compressedSize, compressionMethod) {
  if (view.getUint32(localHeaderOffset, true) !== 0x04034b50) {
    throw new Error(".docx 文件的本地文件头无效。");
  }

  const localNameLength = view.getUint16(localHeaderOffset + 26, true);
  const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
  const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
  const compressed = bytes.slice(dataStart, dataStart + compressedSize);

  if (compressionMethod === 0) {
    return new TextDecoder("utf-8").decode(compressed);
  }

  if (compressionMethod === 8) {
    if (typeof DecompressionStream === "undefined") {
      throw new Error("当前浏览器无法解压 .docx 文件。请先从 Google Docs 导出为 .txt。");
    }

    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    const inflated = await new Response(stream).arrayBuffer();
    return new TextDecoder("utf-8").decode(inflated);
  }

  throw new Error(`不支持的 .docx 压缩方式：${compressionMethod}`);
}

function findEndOfCentralDirectory(bytes) {
  for (let index = bytes.length - 22; index >= 0; index -= 1) {
    if (
      bytes[index] === 0x50 &&
      bytes[index + 1] === 0x4b &&
      bytes[index + 2] === 0x05 &&
      bytes[index + 3] === 0x06
    ) {
      return index;
    }
  }
  return -1;
}

function decodeXmlEntities(text) {
  const parser = document.createElement("textarea");
  parser.innerHTML = text;
  return parser.value;
}

function getPastDays(daysBack, startKey) {
  const keys = [];
  for (let index = daysBack; index >= 0; index -= 1) {
    keys.push(shiftDateKey(startKey, -index));
  }
  return keys;
}

function shiftDateKey(key, deltaDays) {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function escapeHtml(str) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
}
