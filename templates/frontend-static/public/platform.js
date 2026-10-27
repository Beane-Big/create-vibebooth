// 和平台打交道的地方都收在这里：取当前用户和他的权限。
// 没有后端（第 0 级）或者取不到时返回本地用户，页面照样能用；以后接入平台只改这个文件。
// all 只在后端开独立模式（npm run standalone）时为 true：本地用户拥有全部权限。
// 按钮能不能点只是界面上的提示，真正的检查在后端。
const localUser = { name: "", menus: [], perms: [], all: true };

async function getMe() {
  if (!hasBackend) return localUser;
  try {
    const me = await request("/api/__ID__/me");
    // 没有任何权限时后端返回 null。
    return { ...me, menus: me.menus ?? [], perms: me.perms ?? [] };
  } catch {
    return localUser;
  }
}

// can 判断当前用户有没有某项功能权限（module.yaml 的 permissions），用来隐藏没权限的按钮。
function can(me, perm) {
  return me.all || me.perms.includes(perm);
}
