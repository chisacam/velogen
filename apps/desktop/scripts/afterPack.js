/**
 * afterPack.js
 *
 * electron-builder의 afterPack 훅.
 * 빌드 후 앱 번들 안에 복사된 node_modules의 better-sqlite3를
 * Electron 버전에 맞게 @electron/rebuild로 재빌드합니다.
 *
 * 재빌드 대상:
 *   1. Resources/node_modules            (루트 node_modules)
 *   2. Resources/api/apps/api/node_modules  (NestJS API의 node_modules)
 *   3. Resources/app.asar.unpacked/node_modules  (asarUnpack으로 풀린 데스크탑 의존성)
 */

const path = require("node:path");
const fs = require("node:fs");
const { rebuild } = require("@electron/rebuild");

/**
 * @param {import('electron-builder').AfterPackContext} context
 */
exports.default = async function afterPack(context) {
    const { appOutDir, electronPlatformName, arch, packager } = context;

    // Electron 버전
    const electronVersion =
        packager.config.electronVersion ||
        require("electron/package.json").version;

    // Resources 디렉터리 위치
    let resourcesDir;
    if (electronPlatformName === "darwin") {
        resourcesDir = path.join(
            appOutDir,
            `${packager.appInfo.productName}.app`,
            "Contents",
            "Resources"
        );
    } else {
        resourcesDir = path.join(appOutDir, "resources");
    }

    // 재빌드 대상 목록: buildPath = package.json이 있어야 하는 디렉터리 (node_modules의 부모)
    const targets = [
        // 1. 루트 node_modules (extraResources로 복사된 것)
        {
            buildPath: resourcesDir,
            modulesDir: path.join(resourcesDir, "node_modules"),
        },
        // 2. NestJS API node_modules
        {
            buildPath: path.join(resourcesDir, "api", "apps", "api"),
            modulesDir: path.join(resourcesDir, "api", "apps", "api", "node_modules"),
        },
        // 3. asarUnpack으로 풀린 데스크탑 의존성
        {
            buildPath: path.join(resourcesDir, "app.asar.unpacked"),
            modulesDir: path.join(resourcesDir, "app.asar.unpacked", "node_modules"),
        },
    ];

    for (const { buildPath, modulesDir } of targets) {
        if (!fs.existsSync(modulesDir)) {
            console.log(`[afterPack] node_modules not found at ${modulesDir}, skipping.`);
            continue;
        }

        const betterSqlitePath = path.join(modulesDir, "better-sqlite3");
        if (!fs.existsSync(betterSqlitePath)) {
            console.log(`[afterPack] better-sqlite3 not found in ${modulesDir}, skipping.`);
            continue;
        }

        // @electron/rebuild은 buildPath에 package.json이 필요합니다.
        // package.json이 없는 디렉터리(ex. Resources/)에는 임시로 생성합니다.
        const pkgJsonPath = path.join(buildPath, "package.json");
        let createdTempPkg = false;
        if (!fs.existsSync(pkgJsonPath)) {
            fs.writeFileSync(pkgJsonPath, JSON.stringify({ name: "temp", version: "0.0.0" }));
            createdTempPkg = true;
        }

        try {
            console.log(
                `[afterPack] Rebuilding better-sqlite3 for Electron ${electronVersion} (${arch}) in:\n  ${buildPath}`
            );
            await rebuild({
                buildPath,
                electronVersion,
                arch,
                onlyModules: ["better-sqlite3"],
                force: true,
            });
            console.log(`[afterPack] ✓ Rebuild complete: ${modulesDir}`);
        } finally {
            // 임시로 만든 package.json 제거
            if (createdTempPkg && fs.existsSync(pkgJsonPath)) {
                fs.unlinkSync(pkgJsonPath);
            }
        }
    }
};
