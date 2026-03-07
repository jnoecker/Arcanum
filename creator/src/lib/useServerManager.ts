import { useCallback, useRef } from "react";
import { Command, type Child } from "@tauri-apps/plugin-shell";
import { useProjectStore } from "@/stores/projectStore";
import { useServerStore } from "@/stores/serverStore";

export function useServerManager() {
  const project = useProjectStore((s) => s.project);
  const setStatus = useServerStore((s) => s.setStatus);
  const setPid = useServerStore((s) => s.setPid);
  const setLastError = useServerStore((s) => s.setLastError);
  const addLog = useServerStore((s) => s.addLog);

  // Track the child process for cleanup
  const childRef = useRef<Child | null>(null);

  const startServer = useCallback(async () => {
    if (!project) return;

    const { mudDir } = project;
    const gradlew = "gradlew.bat"; // Windows; future: detect platform

    setStatus("starting");
    setLastError(null);
    addLog("INFO", `Starting server: ${mudDir}/${gradlew} run`);

    try {
      const command = Command.create("cmd", ["/C", gradlew, "run"], {
        cwd: mudDir,
      });

      command.stdout.on("data", (line) => {
        addLog("STDOUT", line);
        // Detect server ready
        if (line.includes("Server started") || line.includes("Listening on")) {
          setStatus("running");
        }
      });

      command.stderr.on("data", (line) => {
        addLog("STDOUT", line);
      });

      command.on("close", (data) => {
        addLog("INFO", `Server process exited with code ${data.code}`);
        setPid(null);
        childRef.current = null;

        const currentStatus = useServerStore.getState().status;
        if (currentStatus === "stopping") {
          setStatus("stopped");
        } else if (data.code !== 0 && data.code !== null) {
          setStatus("error");
          setLastError(`Process exited with code ${data.code}`);
        } else {
          setStatus("stopped");
        }
      });

      command.on("error", (error) => {
        addLog("ERROR", `Server error: ${error}`);
        setStatus("error");
        setLastError(error);
      });

      const child = await command.spawn();
      childRef.current = child;
      setPid(child.pid);
      addLog("INFO", `Server process started (PID: ${child.pid})`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      addLog("ERROR", `Failed to start server: ${message}`);
      setStatus("error");
      setLastError(message);
    }
  }, [project, setStatus, setPid, setLastError, addLog]);

  const stopServer = useCallback(async () => {
    const child = childRef.current;
    if (!child) {
      setStatus("stopped");
      return;
    }

    setStatus("stopping");
    addLog("INFO", "Stopping server...");

    try {
      await child.kill();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      addLog("ERROR", `Failed to stop server: ${message}`);
      setStatus("error");
      setLastError(message);
    }
  }, [setStatus, setLastError, addLog]);

  return { startServer, stopServer };
}
