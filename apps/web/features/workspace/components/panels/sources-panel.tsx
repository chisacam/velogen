import { type SourcesPanelProps } from "./panel-types";
import commonStyles from "./common-panel.module.css";

type PeriodSliderProps = {
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ label: string; value: string }>;
};

function PeriodSlider({ value, onChange, options }: PeriodSliderProps) {
  return (
    <div className="periodSlider">
      <span className="periodSliderLabel">기간 설정</span>
      <div className="periodSliderTrack">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`periodSliderOption ${value === option.value ? "active" : ""}`}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SourcesPanel({
  sources,
  sessionSources,
  repoName,
  setRepoName,
  repoPath,
  setRepoPath,
  repoUrl,
  setRepoUrl,
  repoMonths,
  setRepoMonths,
  repoCommitters,
  setRepoCommitters,
  notionName,
  setNotionName,
  notionPageId,
  setNotionPageId,
  notionToken,
  setNotionToken,
  notionMonths,
  setNotionMonths,
  PERIOD_OPTIONS,
  onCreateRepoSource,
  onCreateNotionSource,
  onAttachSource,
  onDetachSource,
  onDeleteSource,
  onSyncSource,
  onFormatSourceDisplay
}: SourcesPanelProps) {
  return (
    <div className={`${commonStyles.workspaceBody} ${commonStyles.card}`}>
      <div className="grid two">
        <div>
          <h3>Add Repo Source</h3>
          <form
            onSubmit={(event) => {
              void onCreateRepoSource(event);
            }}
            className="form"
          >
            <label>
              Source Name
              <input value={repoName} onChange={(event) => setRepoName(event.target.value)} required />
            </label>
            <label>
              Local Repo Path
              <input value={repoPath} onChange={(event) => setRepoPath(event.target.value)} placeholder="/Users/name/project" />
            </label>
            <label>
              Remote Repo URL
              <input value={repoUrl} onChange={(event) => setRepoUrl(event.target.value)} placeholder="https://github.com/org/repo.git" />
            </label>
            <PeriodSlider value={repoMonths} onChange={setRepoMonths} options={PERIOD_OPTIONS} />
            <label>
              Committers
              <input value={repoCommitters} onChange={(event) => setRepoCommitters(event.target.value)} placeholder="alice,bob" />
            </label>
            <button type="submit">Save Repo Source</button>
          </form>
        </div>

        <div>
          <h3>Add Notion Source</h3>
          <form
            onSubmit={(event) => {
              void onCreateNotionSource(event);
            }}
            className="form"
          >
            <label>
              Source Name
              <input value={notionName} onChange={(event) => setNotionName(event.target.value)} required />
            </label>
            <label>
              Notion Page ID
              <input value={notionPageId} onChange={(event) => setNotionPageId(event.target.value)} required />
            </label>
            <label>
              Notion Token
              <input value={notionToken} onChange={(event) => setNotionToken(event.target.value)} required />
            </label>
            <PeriodSlider value={notionMonths} onChange={setNotionMonths} options={PERIOD_OPTIONS} />
            <button type="submit">Save Notion Source</button>
          </form>
        </div>
      </div>

      <h3>Source Pool</h3>
      <div className="tableLike">
        {sources.length === 0 ? (
          <p>No sources yet.</p>
        ) : (
          sources.map((source) => {
            const attached = sessionSources.some((sessionSource) => sessionSource.sourceId === source.id);
            return (
              <div key={source.id} className="entry">
                <div>
                  <strong>{source.name}</strong>
                  <p>
                    <span className={commonStyles.accentText}>{source.type}</span> | {onFormatSourceDisplay(source)}
                  </p>
                </div>
                <div className="row">
                  {attached ? (
                    <button type="button" onClick={() => void onDetachSource(source.id)}>
                      Detach
                    </button>
                  ) : (
                    <button type="button" onClick={() => void onAttachSource(source.id)}>
                      Attach
                    </button>
                  )}
                  <button type="button" className="ghost" onClick={() => void onDeleteSource(source.id)}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <h3>Attached Sources</h3>
      <div className="tableLike">
        {sessionSources.length === 0 ? (
          <p>No attached sources.</p>
        ) : (
          sessionSources.map((sessionSource) => {
            const fullSource = sources.find((source) => source.id === sessionSource.sourceId);
            return (
              <div key={sessionSource.sourceId} className="entry">
                <div>
                  <strong>{sessionSource.name}</strong>
                  <p>
                    <span className={commonStyles.accentText}>{sessionSource.type}</span> | {fullSource ? onFormatSourceDisplay(fullSource) : sessionSource.sourceId}
                  </p>
                </div>
                <div className="row">
                  <button type="button" onClick={() => void onSyncSource(sessionSource.sourceId)}>
                    Sync
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
