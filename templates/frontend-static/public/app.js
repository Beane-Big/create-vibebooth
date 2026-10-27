// 调用本模块后端的对内接口；登录 Cookie 由浏览器自动带上，网关负责校验。
async function request(path, init) {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json" } });
  if (res.status === 401) {
    location.href = "/login?next=" + encodeURIComponent(location.pathname);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "请求失败");
  }
  return res.json();
}

function showError(err) {
  const el = document.getElementById("error");
  el.textContent = err.message;
  el.hidden = false;
}

function renderNote(note, prepend) {
  const li = document.createElement("li");
  li.textContent = note.text;
  const author = document.createElement("span");
  author.className = "muted";
  author.textContent = " · " + note.author;
  li.append(author);
  const list = document.getElementById("notes");
  prepend ? list.prepend(li) : list.append(li);
}

async function load() {
  const me = await getMe();
  if (me.name) document.getElementById("greeting").textContent = "你好，" + me.name;
  if (!hasData) return;
  try {
    document.getElementById("notes-card").hidden = false;
    (await request("/api/__ID__/notes")).forEach((n) => renderNote(n, false));
  } catch (err) {
    showError(err);
  }
}

document.getElementById("note-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("note-text");
  if (!input.value.trim()) return;
  try {
    renderNote(await request("/api/__ID__/notes", { method: "POST", body: JSON.stringify({ text: input.value }) }), true);
    input.value = "";
  } catch (err) {
    showError(err);
  }
});

load();
