import type { AgentProvider } from "@velogen/shared";
import { type SessionPanelProps } from "./panel-types";
import commonStyles from "./common-panel.module.css";

export function SessionPanel({
  sessionTitle,
  setSessionTitle,
  onCreateSession,
  selectedSessionId,
  setSelectedSessionId,
  sessions,
  provider,
  setProvider,
  selectedSession,
  onUpdateConfig,
  onDeleteSession
}: SessionPanelProps) {
  return (
    <div className={`${commonStyles.workspaceBody} ${commonStyles.card}`}>
      <div className="grid two">
        <div>
          <h3>Create Session</h3>
          <form
            onSubmit={(event) => {
              void onCreateSession(event);
            }}
            className="form"
          >
            <label>
              Session Title
              <input value={sessionTitle} onChange={(event) => setSessionTitle(event.target.value)} required />
            </label>
            <button type="submit">Create Session</button>
          </form>
        </div>

        <div>
          <h3>Session Control</h3>
          <label>
            Active Session
            <select value={selectedSessionId} onChange={(event) => setSelectedSessionId(event.target.value)}>
              <option value="">Select session</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.title}
                </option>
              ))}
            </select>
          </label>

          <label>
            Generator
            <select
              id="provider-select"
              value={provider}
              onChange={(event) => setProvider(event.target.value as AgentProvider)}
            >
              <option value="mock">🤖 Mock (로컬 테스트)</option>
              <option value="claude">🧠 Claude</option>
              <option value="codex">⚡ Codex</option>
              <option value="opencode">🛠 Opencode</option>
              <option value="gemini">🌟 Gemini</option>
            </select>
          </label>
          <div className="row">
            <button type="button" onClick={() => void onUpdateConfig()}>
              Save Options
            </button>
            <button type="button" className="ghost" onClick={() => void onDeleteSession()}>
              Delete Session
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
