const { app, BrowserWindow, protocol, net } = require("electron");
const { spawn, execSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const url = require("node:url");

protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: true } }
]);

let apiProcess = null;
/** 사용자 로그인 쉘에서 가져온 PATH (캐시) */
let resolvedShellPath = null;

/**
 * macOS/Linux에서 사용자의 로그인 쉘을 실행하여 실제 $PATH를 가져옵니다.
 * Electron 앱이 Dock/Finder에서 실행되면 /usr/bin:/bin 같은 최소 PATH만 상속받기 때문에
 * npm 글로벌 패키지로 설치된 CLI 도구(claude, codex, gemini 등)를 찾을 수 없습니다.
 */
function getShellPath() {
  if (resolvedShellPath) return resolvedShellPath;
  if (process.platform === "win32") return process.env.PATH;

  try {
    const shell = process.env.SHELL || "/bin/zsh";
    // 로그인 쉘을 인터랙티브로 실행하여 .zshrc / .bash_profile 등을 거친 PATH 추출
    const result = execSync(`${shell} -ilc 'echo -n "$PATH"'`, {
      encoding: "utf8",
      timeout: 5000,
      env: { ...process.env },
    }).trim();
    if (result.length > 0) {
      resolvedShellPath = result;
      return resolvedShellPath;
    }
  } catch {
    // fallback: 쉘 실행 실패 시 현재 PATH 사용
  }
  return process.env.PATH;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 760,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (!app.isPackaged) {
    win.loadURL("http://localhost:3000");
    return;
  }
  win.loadURL("app://-/index.html");
}

function startApi() {
  const apiMain = app.isPackaged
    ? path.join(process.resourcesPath, "api", "apps", "api", "src", "main.js")
    : path.join(__dirname, "..", "api", "dist", "apps", "api", "src", "main.js");

  const dbPath = path.join(app.getPath("userData"), "velogen.sqlite");
  const nodeModulesPath = app.isPackaged
    ? path.join(process.resourcesPath, "node_modules")
    : path.join(__dirname, "..", "..", "node_modules");

  const shellPath = getShellPath();

  const env = {
    ...process.env,
    PORT: "4000",
    DB_PATH: dbPath,
    ELECTRON_RUN_AS_NODE: "1",
    NODE_PATH: nodeModulesPath,
    PATH: shellPath,
  };

  apiProcess = spawn(process.execPath, [apiMain], {
    env,
    stdio: "pipe"
  });

  apiProcess.stdout.on("data", (data) => {
    fs.appendFileSync(path.join(app.getPath("userData"), "api-out.log"), data);
  });

  apiProcess.stderr.on("data", (data) => {
    fs.appendFileSync(path.join(app.getPath("userData"), "api-err.log"), data);
  });
}

async function waitForApi(maxRetries = 80) {
  for (let i = 0; i < maxRetries; i += 1) {
    try {
      const res = await fetch("http://localhost:4000/sessions", { method: "GET" });
      if (res.ok) {
        return;
      }
    } catch {
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

function stopApi() {
  if (!apiProcess) {
    return;
  }
  apiProcess.kill();
  apiProcess = null;
}

app.whenReady().then(async () => {
  if (app.isPackaged) {
    protocol.handle("app", (request) => {
      const requestUrl = new URL(request.url);
      let pathname = requestUrl.pathname;
      if (pathname === "/") {
        pathname = "/index.html";
      }
      pathname = decodeURIComponent(pathname);

      let filePath = path.join(process.resourcesPath, "web", pathname);

      if (!fs.existsSync(filePath) && fs.existsSync(filePath + ".html")) {
        filePath += ".html";
      }

      return net.fetch(url.pathToFileURL(filePath).toString());
    });

    startApi();
    await waitForApi();
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopApi();
});
