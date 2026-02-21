"use client";

import {
  EditorPanel,
  FloatingGenerationPanel,
  PostsPanel,
  SessionPanel,
  SourcesPanel,
  ToastStack,
  WorkspaceHeader,
  WorkspaceSidebar
} from "../features/workspace/components/workspace-ui";
import { useWorkspaceController } from "../features/workspace/use-workspace-controller";

export default function HomePage() {
  const controller = useWorkspaceController();

  return (
    <main className="appShell">
      <WorkspaceSidebar
        activePanel={controller.activePanel}
        navItems={controller.navItems}
        sessionSources={controller.sessionSources}
        posts={controller.posts}
        selectedSession={controller.selectedSession}
        statusText={controller.status}
        setPanel={controller.setPanel}
      />

      <section className="workspace">
        <WorkspaceHeader activePanel={controller.activePanel} postTitleDraft={controller.postTitleDraft} />

        <ToastStack toasts={controller.toasts} />

        {controller.activePanel === "session" ? (
          <SessionPanel
            sessionTitle={controller.sessionTitle}
            setSessionTitle={controller.setSessionTitle}
            onCreateSession={controller.onCreateSession}
            selectedSessionId={controller.selectedSessionId}
            setSelectedSessionId={controller.setSelectedSessionId}
            sessions={controller.sessions}
            tone={controller.tone}
            setTone={controller.setTone}
            format={controller.format}
            setFormat={controller.setFormat}
            provider={controller.provider}
            setProvider={controller.setProvider}
            selectedSession={controller.selectedSession}
            onUpdateConfig={controller.onUpdateConfig}
            onDeleteSession={controller.onDeleteSession}
          />
        ) : null}

        {controller.activePanel === "sources" ? (
          <SourcesPanel
            sources={controller.sources}
            sessionSources={controller.sessionSources}
            repoName={controller.repoName}
            setRepoName={controller.setRepoName}
            repoPath={controller.repoPath}
            setRepoPath={controller.setRepoPath}
            repoUrl={controller.repoUrl}
            setRepoUrl={controller.setRepoUrl}
            repoMonths={controller.repoMonths}
            setRepoMonths={controller.setRepoMonths}
            repoCommitters={controller.repoCommitters}
            setRepoCommitters={controller.setRepoCommitters}
            notionName={controller.notionName}
            setNotionName={controller.setNotionName}
            notionPageId={controller.notionPageId}
            setNotionPageId={controller.setNotionPageId}
            notionToken={controller.notionToken}
            setNotionToken={controller.setNotionToken}
            notionMonths={controller.notionMonths}
            setNotionMonths={controller.setNotionMonths}
            PERIOD_OPTIONS={controller.PERIOD_OPTIONS}
            onCreateRepoSource={controller.onCreateRepoSource}
            onCreateNotionSource={controller.onCreateNotionSource}
            onAttachSource={controller.onAttachSource}
            onDetachSource={controller.onDetachSource}
            onDeleteSource={controller.onDeleteSource}
            onSyncSource={controller.onSyncSource}
            onFormatSourceDisplay={controller.onFormatSourceDisplay}
          />
        ) : null}

        {controller.activePanel === "editor" ? (
          <EditorPanel
            generatedPost={controller.generatedPost}
            isGenerating={controller.isGenerating}
            editorMode={controller.editorMode}
            setEditorMode={controller.setEditorMode}
            postBodyDraft={controller.postBodyDraft}
            setPostBodyDraft={controller.setPostBodyDraft}
            flashHeading={controller.flashHeading}
            flashCitation={controller.flashCitation}
            revisions={controller.revisions}
            onLoadRevision={controller.onLoadRevision}
          />
        ) : null}

        {controller.activePanel === "posts" ? <PostsPanel posts={controller.posts} selectPost={controller.selectPost} /> : null}

        <FloatingGenerationPanel
          genPanelOpen={controller.genPanelOpen}
          setGenPanelOpen={controller.setGenPanelOpen}
          generateMode={controller.generateMode}
          setGenerateMode={controller.setGenerateMode}
          postStatusDraft={controller.postStatusDraft}
          setPostStatusDraft={controller.setPostStatusDraft}
          autoGenerateImages={controller.autoGenerateImages}
          setAutoGenerateImages={controller.setAutoGenerateImages}
          isGenerating={controller.isGenerating}
          isGeneratingImages={controller.isGeneratingImages}
          onGenerate={controller.onGenerate}
          onSavePost={controller.onSavePost}
          onExportMarkdown={controller.onExportMarkdown}
          userInstruction={controller.userInstruction}
          setUserInstruction={controller.setUserInstruction}
          generatedPost={controller.generatedPost}
          selectedPostId={controller.selectedPostId}
          postBodyDraft={controller.postBodyDraft}
        />
      </section>
    </main>
  );
}
