"use strict";
const electron = require("electron");
const path = require("path");
const axios = require("axios");
const crypto = require("crypto");
const fs = require("fs-extra");
const AdmZip = require("adm-zip");
const child_process = require("child_process");
const uuid = require("uuid");
const os = require("os");
const discordRpc = require("discord-rpc");
const Store = require("electron-store");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const path__namespace = /* @__PURE__ */ _interopNamespaceDefault(path);
const fs__namespace = /* @__PURE__ */ _interopNamespaceDefault(fs);
const os__namespace = /* @__PURE__ */ _interopNamespaceDefault(os);
const MS_CLIENT_ID = "00000000402b5328";
const XBOX_URL = "https://user.auth.xboxlive.com/user/authenticate";
const XSTS_URL = "https://xsts.auth.xboxlive.com/xsts/authorize";
const MC_URL = "https://api.minecraftservices.com/authentication/login_with_xbox";
const PROF_URL = "https://api.minecraftservices.com/minecraft/profile";
async function getMSToken() {
  const dcRes = await axios.post(
    "https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode",
    new URLSearchParams({
      client_id: MS_CLIENT_ID,
      scope: "XboxLive.SignIn XboxLive.offline_access"
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 15e3 }
  );
  const { device_code, user_code, verification_uri, expires_in, interval } = dcRes.data;
  electron.shell.openExternal(`${verification_uri}?otc=${user_code}`);
  return JSON.stringify({ device_code, user_code, verification_uri, expires_in, interval });
}
async function pollMSToken(device_code, interval) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const deadline = Date.now() + 6e5;
  const pollMs = Math.max((interval || 5) * 1e3, 5e3);
  while (Date.now() < deadline) {
    await wait(pollMs);
    try {
      const res = await axios.post(
        "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
        new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          client_id: MS_CLIENT_ID,
          device_code
        }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 1e4 }
      );
      return res.data.access_token;
    } catch (e) {
      const err = e.response?.data?.error;
      if (err === "authorization_pending") continue;
      if (err === "slow_down") {
        await wait(5e3);
        continue;
      }
      throw new Error(err || "Auth failed");
    }
  }
  throw new Error("Login timed out");
}
async function xboxAuth(msToken) {
  const xbl = await axios.post(XBOX_URL, {
    Properties: { AuthMethod: "RPS", SiteName: "user.auth.xboxlive.com", RpsTicket: `d=${msToken}` },
    RelyingParty: "http://auth.xboxlive.com",
    TokenType: "JWT"
  }, { headers: { "Content-Type": "application/json", Accept: "application/json" }, timeout: 15e3 });
  const xsts = await axios.post(XSTS_URL, {
    Properties: { SandboxId: "RETAIL", UserTokens: [xbl.data.Token] },
    RelyingParty: "rp://api.minecraftservices.com/",
    TokenType: "JWT"
  }, { headers: { "Content-Type": "application/json", Accept: "application/json" }, timeout: 15e3 });
  return { token: xsts.data.Token, userHash: xsts.data.DisplayClaims.xui[0].uhs };
}
async function mcAuth(xstsToken, userHash) {
  const res = await axios.post(
    MC_URL,
    { identityToken: `XBL3.0 x=${userHash};${xstsToken}` },
    { headers: { "Content-Type": "application/json" }, timeout: 15e3 }
  );
  return res.data.access_token;
}
async function mcProfile(mcToken) {
  const res = await axios.get(PROF_URL, {
    headers: { Authorization: `Bearer ${mcToken}` },
    timeout: 15e3
  });
  const d = res.data;
  let skinUrl;
  try {
    const texProp = d.properties?.find((p) => p.name === "textures");
    if (texProp) {
      const texData = JSON.parse(Buffer.from(texProp.value, "base64").toString());
      skinUrl = texData?.textures?.SKIN?.url;
    }
  } catch {
  }
  return { uuid: d.id, username: d.name, skinUrl };
}
function genOfflineUUID(username) {
  const hash = crypto.createHash("md5").update("OfflinePlayer:" + username).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-3${hash.slice(13, 16)}-${(parseInt(hash.slice(16, 18), 16) & 63 | 128).toString(16)}${hash.slice(18, 20)}-${hash.slice(20, 32)}`;
}
function setupAuthHandlers(ipcMain, store2) {
  ipcMain.handle("auth:microsoft-start", async () => {
    try {
      const info = await getMSToken();
      return { success: true, info: JSON.parse(info) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  ipcMain.handle("auth:microsoft-poll", async (_, { device_code, interval }) => {
    try {
      const msToken = await pollMSToken(device_code, interval);
      const { token: xstsToken, userHash } = await xboxAuth(msToken);
      const mcToken = await mcAuth(xstsToken, userHash);
      const profile = await mcProfile(mcToken);
      const account = {
        type: "microsoft",
        username: profile.username,
        uuid: profile.uuid,
        accessToken: mcToken,
        skinUrl: profile.skinUrl,
        expiresAt: Date.now() + 864e5
      };
      store2.set("account", account);
      return { success: true, account };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  ipcMain.handle("auth:offline-login", async (_, username) => {
    if (!username?.trim() || username.length < 3 || username.length > 16)
      return { success: false, error: "Username: 3-16 characters, letters/numbers/underscore" };
    if (!/^[a-zA-Z0-9_]+$/.test(username))
      return { success: false, error: "Only letters, numbers, underscore allowed" };
    const account = {
      type: "offline",
      username: username.trim(),
      uuid: genOfflineUUID(username.trim()),
      accessToken: "0",
      skinUrl: null
    };
    store2.set("account", account);
    return { success: true, account };
  });
  ipcMain.handle("auth:logout", async () => {
    store2.delete("account");
    return { success: true };
  });
  ipcMain.handle("auth:get-account", async () => store2.get("account", null));
  ipcMain.handle("auth:get-skin-head", async (_, uuid2) => {
    try {
      const cleanUuid = uuid2.replace(/-/g, "");
      return { success: true, url: `https://crafatar.com/avatars/${cleanUuid}?size=64&overlay=true` };
    } catch {
      return { success: false };
    }
  });
}
const MANIFEST_URL = "https://launchermeta.mojang.com/mc/game/version_manifest_v2.json";
const RESOURCES_URL = "https://resources.download.minecraft.net";
const VERSION_ID_MAP = {
  "26.1.1": "26.1.1",
  "26.1": "26.1"
};
function getGameDir$2() {
  return path__namespace.join(electron.app.getPath("appData"), ".kazuki");
}
async function downloadFile(url, dest, onProgress) {
  await fs__namespace.ensureDir(path__namespace.dirname(dest));
  if (await fs__namespace.pathExists(dest)) {
    const stat = await fs__namespace.stat(dest);
    if (stat.size > 0) return;
  }
  const response = await axios({ method: "GET", url, responseType: "stream", timeout: 6e4 });
  parseInt(response.headers["content-length"] || "0", 10);
  let downloaded = 0;
  await new Promise((resolve, reject) => {
    const writer = fs__namespace.createWriteStream(dest);
    response.data.on("data", (chunk) => {
      downloaded += chunk.length;
    });
    response.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}
async function downloadLibraries(libraries, gameDir, win) {
  const validLibs = libraries.filter((lib) => {
    if (!lib.downloads?.artifact) return false;
    if (lib.rules) {
      for (const rule of lib.rules) {
        if (rule.os) {
          if (rule.action === "allow" && rule.os?.name !== "windows") return false;
          if (rule.action === "disallow" && rule.os?.name === "windows") return false;
        }
      }
    }
    return true;
  });
  for (let i = 0; i < validLibs.length; i++) {
    const lib = validLibs[i];
    const artifact = lib.downloads.artifact;
    const dest = path__namespace.join(gameDir, "libraries", artifact.path);
    win?.webContents.send("download:progress", {
      name: `Lib: ${lib.name.split(":")[1]}`,
      downloaded: i + 1,
      total: validLibs.length,
      percent: Math.round((i + 1) / validLibs.length * 100)
    });
    try {
      await downloadFile(artifact.url, dest);
    } catch (e) {
      console.error(`Library failed: ${artifact.url}`);
    }
  }
}
async function downloadAssets(assetIndex, assetIndexId, gameDir, win) {
  const assetIndexPath = path__namespace.join(gameDir, "assets", "indexes", `${assetIndexId}.json`);
  await downloadFile(assetIndex.url, assetIndexPath);
  const indexData = await fs__namespace.readJson(assetIndexPath);
  const objects = Object.values(indexData.objects);
  let done = 0;
  const total = objects.length;
  const CONCURRENCY = 5;
  const queue = [...objects];
  async function worker() {
    while (queue.length > 0) {
      const obj = queue.pop();
      const prefix = obj.hash.substring(0, 2);
      const dest = path__namespace.join(gameDir, "assets", "objects", prefix, obj.hash);
      try {
        await downloadFile(`${RESOURCES_URL}/${prefix}/${obj.hash}`, dest);
      } catch (e) {
        console.error(`Asset failed: ${obj.hash}`);
      }
      done++;
      if (done % 20 === 0) {
        win?.webContents.send("download:progress", {
          name: "Downloading Assets...",
          downloaded: done,
          total,
          percent: Math.round(done / total * 100)
        });
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}
function setupVersionHandlers(ipcMain, store2) {
  ipcMain.handle("versions:get-list", async () => {
    try {
      const res = await axios.get(MANIFEST_URL, { timeout: 15e3 });
      const manifest = res.data;
      const supported = manifest.versions.filter((v) => {
        if (v.type !== "release") return false;
        const id = v.id;
        if (/^\d{2,}\./.test(id)) return true;
        const [, minor] = id.split(".").map(Number);
        return minor >= 12;
      });
      return { success: true, versions: supported, latest: manifest.latest.release };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  ipcMain.handle("versions:install", async (event, versionId) => {
    const win = electron.BrowserWindow.fromWebContents(event.sender);
    const gameDir = getGameDir$2();
    try {
      win?.webContents.send("download:progress", { name: "Fetching manifest...", downloaded: 0, total: 1, percent: 5 });
      const manifestRes = await axios.get(MANIFEST_URL, { timeout: 3e4 });
      const lookupId = VERSION_ID_MAP[versionId] || versionId;
      const versionMeta = manifestRes.data.versions.find((v) => v.id === lookupId || v.id === versionId);
      if (!versionMeta) throw new Error(`Version ${versionId} not found in manifest. Check connection.`);
      win?.webContents.send("download:progress", { name: "Downloading version data...", downloaded: 0, total: 1, percent: 10 });
      const versionRes = await axios.get(versionMeta.url, { timeout: 3e4 });
      const versionData = versionRes.data;
      const actualId = versionData.id || versionId;
      const versionDir = path__namespace.join(gameDir, "versions", actualId);
      await fs__namespace.ensureDir(versionDir);
      await fs__namespace.writeJson(path__namespace.join(versionDir, `${actualId}.json`), versionData);
      if (versionId !== actualId) {
        store2.set(`versionIdMap.${versionId}`, actualId);
      }
      win?.webContents.send("download:progress", { name: "Downloading client.jar...", downloaded: 0, total: 1, percent: 15 });
      const clientJarPath = path__namespace.join(versionDir, `${actualId}.jar`);
      await downloadFile(versionData.downloads.client.url, clientJarPath);
      await downloadLibraries(versionData.libraries, gameDir, win);
      await downloadAssets(versionData.assetIndex, versionData.assetIndex.id, gameDir, win);
      const nativesDir = path__namespace.join(versionDir, "natives");
      await fs__namespace.ensureDir(nativesDir);
      for (const lib of versionData.libraries) {
        if (lib.downloads?.classifiers) {
          const native = lib.downloads.classifiers["natives-windows"] || lib.downloads.classifiers["natives-windows-64"];
          if (native) {
            const nativeJar = path__namespace.join(gameDir, "libraries", native.path);
            if (await fs__namespace.pathExists(nativeJar)) {
              try {
                const zip = new AdmZip(nativeJar);
                zip.getEntries().forEach((entry) => {
                  if (!entry.entryName.startsWith("META-INF") && entry.entryName.endsWith(".dll")) {
                    zip.extractEntryTo(entry, nativesDir, false, true);
                  }
                });
              } catch {
              }
            }
          }
        }
      }
      store2.set(`installed.${versionId}`, { id: versionId, actualId, installedAt: Date.now() });
      win?.webContents.send("download:progress", { name: "Complete!", downloaded: 1, total: 1, percent: 100 });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}
const activeProcesses = /* @__PURE__ */ new Map();
electron.app.on("before-quit", () => {
  for (const [id, child] of activeProcesses.entries()) {
    try {
      child.kill("SIGKILL");
    } catch (e) {
    }
  }
});
function getGameDir$1() {
  return path__namespace.join(electron.app.getPath("appData"), ".kazuki");
}
function getRequiredJavaVersion(mcVersion) {
  if (!mcVersion) return 17;
  const parts = mcVersion.split(".");
  const minor = parseInt(parts[1] || "0");
  const patch = parseInt(parts[2] || "0");
  if (minor >= 21 || minor === 20 && patch >= 5) return 21;
  if (minor >= 17) return 17;
  return 8;
}
async function ensureJavaRuntime(mcVersion, gameDir) {
  const javaVer = getRequiredJavaVersion(mcVersion);
  const runtimeDir = path__namespace.join(gameDir, "runtime", `java-${javaVer}`);
  const findJavaw = async (dir) => {
    if (!await fs__namespace.pathExists(dir)) return null;
    const entries = await fs__namespace.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path__namespace.join(dir, e.name);
      if (e.isDirectory()) {
        const res = await findJavaw(full);
        if (res) return res;
      } else if (e.name.toLowerCase() === "javaw.exe") {
        return full;
      }
    }
    return null;
  };
  const existing = await findJavaw(runtimeDir);
  if (existing) return existing;
  await fs__namespace.ensureDir(runtimeDir);
  const apiUrl = `https://api.adoptium.net/v3/binary/latest/${javaVer}/ga/windows/x64/jre/hotspot/normal/eclipse`;
  const zipPath = path__namespace.join(runtimeDir, "temp.zip");
  try {
    const response = await axios({
      method: "GET",
      url: apiUrl,
      responseType: "arraybuffer"
    });
    await fs__namespace.writeFile(zipPath, response.data);
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(runtimeDir, true);
    await fs__namespace.remove(zipPath);
    const extracted = await findJavaw(runtimeDir);
    if (!extracted) throw new Error(`Java ${javaVer} binary missing after extraction.`);
    return extracted;
  } catch (error) {
    throw new Error(`Failed to download Java ${javaVer}. Check your internet connection. Detail: ${error.message}`);
  }
}
function buildJvmArgs(minRam, maxRam, nativesDir, custom, mcVersion) {
  const safeMax = Math.min(Math.max(maxRam, 1024), 12288);
  const safeMin = Math.min(Math.max(minRam, 256), safeMax);
  const isNewVersion = mcVersion && /^\d{2}\./.test(mcVersion);
  const base = [
    `-Xms${safeMin}M`,
    `-Xmx${safeMax}M`,
    isNewVersion ? "-XX:+UseZGC" : "-XX:+UseG1GC",
    `-XX:+UnlockExperimentalVMOptions`,
    `-XX:MaxGCPauseMillis=200`,
    `-XX:+ParallelRefProcEnabled`,
    `-XX:+DisableExplicitGC`,
    `-XX:SurvivorRatio=32`,
    `-XX:+PerfDisableSharedMem`,
    `-XX:MaxTenuringThreshold=1`,
    `-Dlog4j2.formatMsgNoLookups=true`,
    `-Djava.library.path=${nativesDir}`,
    `-Dminecraft.launcher.brand=KazukiClient`,
    `-Dminecraft.launcher.version=1.0.0`,
    `-Dfml.ignoreInvalidMinecraftCertificates=true`,
    `-Dfml.ignorePatchDiscrepancies=true`
  ];
  if (custom?.trim()) base.push(...custom.split(" ").filter(Boolean));
  return base;
}
function buildClasspath(libraries, gameDir, versionId) {
  const paths = [];
  for (const lib of libraries) {
    if (!lib.downloads?.artifact) continue;
    if (lib.rules) {
      let ok = false;
      for (const r of lib.rules) {
        if (r.action === "allow" && (!r.os || r.os.name === "windows")) ok = true;
        if (r.action === "disallow" && r.os?.name === "windows") {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
    }
    const p = path__namespace.join(gameDir, "libraries", lib.downloads.artifact.path);
    if (fs__namespace.existsSync(p)) paths.push(p);
  }
  const jar = path__namespace.join(gameDir, "versions", versionId, `${versionId}.jar`);
  if (fs__namespace.existsSync(jar)) paths.push(jar);
  return paths.join(path__namespace.delimiter);
}
function resolveArgs(args, rep) {
  return args.map((a) => {
    let r = a;
    for (const [k, v] of Object.entries(rep)) {
      r = r.replace(new RegExp(`\\$\\{${k}\\}`, "g"), v);
    }
    return r;
  });
}
function setupInstanceHandlers(ipcMain, store2, _win) {
  ipcMain.handle("instance:create", async (_, data) => {
    try {
      const inst = { ...data, id: uuid.v4(), createdAt: Date.now() };
      const instances = store2.get("instances", []);
      instances.push(inst);
      store2.set("instances", instances);
      const dir = path__namespace.join(getGameDir$1(), "instances", inst.id);
      await Promise.all([
        fs__namespace.ensureDir(path__namespace.join(dir, "mods")),
        fs__namespace.ensureDir(path__namespace.join(dir, "resourcepacks")),
        fs__namespace.ensureDir(path__namespace.join(dir, "saves")),
        fs__namespace.ensureDir(path__namespace.join(dir, "config")),
        fs__namespace.ensureDir(path__namespace.join(dir, "logs")),
        fs__namespace.ensureDir(path__namespace.join(dir, "crash-reports")),
        fs__namespace.ensureDir(path__namespace.join(dir, "screenshots")),
        fs__namespace.ensureDir(path__namespace.join(dir, "shaderpacks"))
      ]);
      const optFile = path__namespace.join(dir, "options.txt");
      if (!await fs__namespace.pathExists(optFile)) {
        await fs__namespace.writeFile(optFile, "version:3\nautoJump:false\nrenderDistance:8\nmaxFps:260\nfboEnable:true\nlang:en_us\n");
      }
      return { success: true, instance: inst };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  ipcMain.handle("instance:get-all", async () => ({ success: true, instances: store2.get("instances", []) }));
  ipcMain.handle("instance:delete", async (_, id) => {
    try {
      const all = store2.get("instances", []);
      store2.set("instances", all.filter((i) => i.id !== id));
      await fs__namespace.remove(path__namespace.join(getGameDir$1(), "instances", id));
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  ipcMain.handle("instance:open-folder", async (_, instanceId) => {
    try {
      const dir = path__namespace.join(getGameDir$1(), "instances", instanceId);
      await fs__namespace.ensureDir(dir);
      await electron.shell.openPath(dir);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  ipcMain.handle("instance:launch", async (event, instanceId) => {
    try {
      const all = store2.get("instances", []);
      const inst = all.find((i) => i.id === instanceId);
      if (!inst) throw new Error("Instance not found");
      const account = store2.get("account");
      if (!account) throw new Error("Not logged in. Click your avatar to sign in.");
      const settings = store2.get("settings", {});
      const gameDir = getGameDir$1();
      const meta = store2.get(`installed.${inst.mcVersion}`);
      const actualId = meta?.actualId || inst.mcVersion;
      const versionDir = path__namespace.join(gameDir, "versions", actualId);
      const versionJson = path__namespace.join(versionDir, `${actualId}.json`);
      if (!await fs__namespace.pathExists(versionJson)) {
        throw new Error(`Minecraft ${inst.mcVersion} not installed. Delete this instance and create a new one.`);
      }
      const vd = await fs__namespace.readJson(versionJson);
      const nativesDir = path__namespace.join(versionDir, "natives");
      const instDir = path__namespace.join(gameDir, "instances", instanceId);
      await fs__namespace.ensureDir(instDir);
      await fs__namespace.ensureDir(nativesDir);
      await fs__namespace.ensureDir(path__namespace.join(instDir, "logs"));
      const classpath = buildClasspath(vd.libraries, gameDir, actualId);
      if (!classpath.trim()) throw new Error("Libraries missing. Reinstall instance with active internet connection.");
      const javaPath = await ensureJavaRuntime(actualId, gameDir);
      const jvmArgs = buildJvmArgs(inst.minRam || 512, inst.maxRam || 2048, nativesDir, inst.customJvmArgs, inst.mcVersion);
      const uuid2 = (account.uuid || "").replace(/-/g, "") || "0".repeat(32);
      const rep = {
        auth_player_name: account.username,
        version_name: actualId,
        game_directory: instDir,
        assets_root: path__namespace.join(gameDir, "assets"),
        assets_index_name: vd.assetIndex?.id || actualId,
        auth_uuid: uuid2,
        auth_access_token: account.accessToken || "0",
        clientid: "0",
        auth_xuid: "0",
        user_type: account.type === "microsoft" ? "msa" : "legacy",
        version_type: vd.type || "release",
        resolution_width: "1280",
        resolution_height: "720",
        classpath
      };
      const rawArgs = [];
      if (vd.arguments?.game) {
        for (const a of vd.arguments.game) {
          if (typeof a === "string") rawArgs.push(a);
        }
      } else if (vd.minecraftArguments) {
        rawArgs.push(...vd.minecraftArguments.split(" "));
      }
      const gameArgs = resolveArgs(rawArgs, rep);
      const fullArgs = [...jvmArgs, "-cp", classpath, vd.mainClass, ...gameArgs];
      const win = electron.BrowserWindow.fromWebContents(event.sender);
      const child = child_process.spawn(javaPath, fullArgs, { cwd: instDir, stdio: "ignore" });
      activeProcesses.set(instanceId, child);
      child.on("exit", (code) => {
        activeProcesses.delete(instanceId);
        if (win && !win.isDestroyed()) {
          win.webContents.send("instance:exit", { instanceId, code });
        }
      });
      const idx = all.findIndex((i) => i.id === instanceId);
      if (idx !== -1) {
        all[idx].lastPlayed = Date.now();
        store2.set("instances", all);
      }
      if (settings.minimizeOnGame) win?.minimize();
      return { success: true, pid: child.pid };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
}
const API_BASE = "https://api.modrinth.com/v2";
function getGameDir() {
  return path__namespace.join(electron.app.getPath("appData"), ".kazuki");
}
function setupModHandlers(ipcMain, store2) {
  ipcMain.handle("mods:search", async (_, { query, source, mcVersion, projectType, category, offset = 0 }) => {
    try {
      const loader = source.toLowerCase();
      const facets = [
        [`versions:${mcVersion}`],
        [`project_type:${projectType}`]
      ];
      if (projectType === "mod") facets.push([`categories:${loader}`]);
      if (category && category !== "all") facets.push([`categories:${category}`]);
      const res = await axios.get(`${API_BASE}/search`, {
        params: {
          query: query || "",
          facets: JSON.stringify(facets),
          index: "downloads",
          limit: 30,
          offset
          // PAGINATION ADDED
        },
        timeout: 1e4
      });
      return { success: true, results: res.data.hits, total: res.data.total_hits };
    } catch (error) {
      return { success: false, error: "Failed to search Modrinth." };
    }
  });
  ipcMain.handle("mods:install", async (_, { mod, instanceId }) => {
    try {
      const all = store2.get("instances", []);
      const inst = all.find((i) => i.id === instanceId);
      if (!inst) throw new Error("Instance not found");
      const loaders = mod.project_type === "mod" ? JSON.stringify([inst.loader]) : void 0;
      const verRes = await axios.get(`${API_BASE}/project/${mod.project_id}/version`, {
        params: { loaders, game_versions: JSON.stringify([inst.mcVersion]) },
        timeout: 1e4
      });
      if (verRes.data.length === 0) throw new Error(`No compatible version found for ${inst.mcVersion}.`);
      const file = verRes.data[0].files.find((f) => f.primary) || verRes.data[0].files[0];
      let folderName = "mods";
      if (mod.project_type === "resourcepack") folderName = "resourcepacks";
      if (mod.project_type === "shader") folderName = "shaderpacks";
      const targetDir = path__namespace.join(getGameDir(), "instances", instanceId, folderName);
      await fs__namespace.ensureDir(targetDir);
      const dest = path__namespace.join(targetDir, file.filename);
      const response = await axios({ method: "GET", url: file.url, responseType: "stream" });
      const writer = fs__namespace.createWriteStream(dest);
      response.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });
      return { success: true, file: file.filename, folder: folderName };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("mods:get-installed", async (_, instanceId) => {
    try {
      const instDir = path__namespace.join(getGameDir(), "instances", instanceId);
      const folders = ["mods", "resourcepacks", "shaderpacks"];
      let items = [];
      for (const folder of folders) {
        const p = path__namespace.join(instDir, folder);
        if (await fs__namespace.pathExists(p)) {
          const files = await fs__namespace.readdir(p);
          const valid = files.filter((f) => f.endsWith(".jar") || f.endsWith(".zip"));
          items.push(...valid.map((f) => ({ id: f, filename: f, name: f.split(".")[0], folder })));
        }
      }
      return { success: true, mods: items };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("mods:remove", async (_, { modId, instanceId, folder }) => {
    try {
      const targetFolder = folder || "mods";
      const file = path__namespace.join(getGameDir(), "instances", instanceId, targetFolder, modId);
      await fs__namespace.remove(file);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}
function getDefaultGameDir() {
  return path__namespace.join(electron.app.getPath("appData"), ".kazuki");
}
function getAutoRam() {
  const totalRamGB = os__namespace.totalmem() / 1024 / 1024 / 1024;
  const recommended = Math.floor(totalRamGB * 0.5) * 1024;
  return Math.min(Math.max(recommended, 2048), 6144);
}
function getDefaultSettings() {
  return {
    closeOnLaunch: false,
    discordRpc: true,
    autoUpdate: true,
    defaultMaxRam: getAutoRam(),
    defaultMinRam: 512,
    javaPath: "",
    gameDir: getDefaultGameDir(),
    sendCrashReports: true,
    theme: "dark"
  };
}
function setupSettingsHandlers(ipcMain, store2) {
  ipcMain.handle("settings:get", async () => {
    const defaults = getDefaultSettings();
    const stored = store2.get("settings", {});
    const settings = { ...defaults, ...stored };
    return { success: true, settings };
  });
  ipcMain.handle("settings:set", async (_, { key, value }) => {
    const defaults = getDefaultSettings();
    const stored = store2.get("settings", {});
    const settings = { ...defaults, ...stored, [key]: value };
    store2.set("settings", settings);
    return { success: true };
  });
  ipcMain.handle("settings:system-info", async () => {
    const totalRam = Math.round(os__namespace.totalmem() / 1024 / 1024 / 1024);
    const cpus = os__namespace.cpus();
    const cpu = cpus[0]?.model || "Unknown";
    const platform = os__namespace.platform();
    const arch = os__namespace.arch();
    const autoRam = getAutoRam();
    return { totalRam, cpu, platform, arch, autoRam };
  });
}
const CLIENT_ID = "1521010841774981160";
class KazukiRPCManager {
  constructor() {
    this.client = null;
    this.isReady = false;
    this.reconnectTimeout = null;
    this.connect();
  }
  async connect() {
    if (this.client) {
      try {
        await this.client.destroy();
      } catch (e) {
      }
      this.client = null;
    }
    this.isReady = false;
    this.client = new discordRpc.Client({ transport: "ipc" });
    this.client.on("ready", () => {
      this.isReady = true;
      console.log("SUCCESS: Discord RPC connected automatically.");
      this.updateActivity("Kazuki Client v1.0", "In Launcher");
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
    });
    this.client.on("error", (err) => {
      console.error("RPC Error:", err.message);
      this.scheduleReconnect();
    });
    try {
      await this.client.login({ clientId: CLIENT_ID });
    } catch (err) {
      this.scheduleReconnect();
    }
  }
  scheduleReconnect() {
    if (this.reconnectTimeout) return;
    this.isReady = false;
    console.log("Auto-reconnecting to Discord in 15s...");
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, 15e3);
  }
  updateActivity(details, state) {
    if (!this.isReady || !this.client) return;
    this.client.setActivity({
      details,
      state,
      startTimestamp: Date.now(),
      largeImageKey: "kazuki_logo",
      largeImageText: "Kazuki Client",
      smallImageKey: "minecraft",
      smallImageText: "Minecraft",
      instance: false,
      buttons: [
        { label: "Get Kazuki Client", url: "https://github.com/kazuki-client" },
        { label: "Discord Server", url: "https://discord.gg/T3AEpEjA9m" }
      ]
    }).catch(() => {
    });
  }
  destroy() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.client) {
      this.client.destroy().catch(() => {
      });
      this.client = null;
    }
    this.isReady = false;
  }
}
const rpcManager = new KazukiRPCManager();
function setupDiscordHandlers(ipcMain) {
  ipcMain.handle("discord:get-config", () => ({
    success: true,
    config: { enabled: true, details: "Kazuki Client", state: "Launcher" }
  }));
  ipcMain.handle("discord:set-config", (_, cfg) => {
    rpcManager.updateActivity(cfg.details || "Kazuki Client", cfg.state);
    return { success: true };
  });
  ipcMain.handle("discord:set-state", (_, { state, details }) => {
    rpcManager.updateActivity(details, state);
    return { success: true };
  });
  ipcMain.handle("discord:reconnect", async () => {
    if (!rpcManager.isReady) await rpcManager.connect();
    return { success: rpcManager.isReady };
  });
  ipcMain.handle("discord:get-status", () => ({
    connected: rpcManager.isReady,
    clientId: CLIENT_ID
  }));
}
const store = new Store();
let mainWindow = null;
const isDev = !electron.app.isPackaged;
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1200,
    height: 720,
    minWidth: 960,
    minHeight: 600,
    frame: false,
    transparent: false,
    backgroundColor: "#010205",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false
    },
    show: false
  });
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  if (isDev) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"] || "http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    electron.shell.openExternal(url);
    return { action: "deny" };
  });
  electron.ipcMain.on("window:minimize", () => mainWindow?.minimize());
  electron.ipcMain.on("window:maximize", () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  electron.ipcMain.on("window:close", () => mainWindow?.close());
}
electron.app.whenReady().then(() => {
  createWindow();
  setupAuthHandlers(electron.ipcMain, store);
  setupVersionHandlers(electron.ipcMain, store);
  setupInstanceHandlers(electron.ipcMain, store);
  setupModHandlers(electron.ipcMain, store);
  setupSettingsHandlers(electron.ipcMain, store);
  setupDiscordHandlers(electron.ipcMain);
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
