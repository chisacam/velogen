const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("velogenDesktop", {
  runtime: "electron"
});
