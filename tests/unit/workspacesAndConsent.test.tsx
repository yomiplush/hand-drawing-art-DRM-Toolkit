import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProjectConsentModal } from '../../src/components/ProjectConsentModal';
import { SimpleWorkspace } from '../../src/components/workspaces/SimpleWorkspace';
import { AdvancedWorkspace } from '../../src/components/workspaces/AdvancedWorkspace';

describe('ProjectConsentModal, SimpleWorkspace & AdvancedWorkspace', () => {
  it('blocks execution until user explicitly clicks Agree & Merge in ProjectConsentModal', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ProjectConsentModal
        open={true}
        fileName="artwork.psd"
        fileSizeBytes={4096}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByTestId('project-consent-modal')).toBeInTheDocument();
    expect(screen.getByText(/100% local in-browser processing/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('consent-agree-merge-btn'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('renders SimpleWorkspace with ? progressive disclosure tooltip', () => {
    render(
      <SimpleWorkspace
        stage="idle"
        inspection={null}
        mergeResult={null}
        previewUrl={null}
        signedProof={null}
        errorMessage={null}
        onFileSelected={vi.fn()}
        onCertify={vi.fn()}
        onDownloadPng={vi.fn()}
        onAddToGalleryDeck={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByTestId('simple-workspace')).toBeInTheDocument();
    const helpBtn = screen.getByTestId('help-tip-why-native-project-files');
    expect(helpBtn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(helpBtn);
    expect(helpBtn).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders AdvancedWorkspace 3-pane cockpit with key backup warning', () => {
    render(
      <AdvancedWorkspace
        stage="idle"
        inspection={null}
        hashProgress={null}
        mergeResult={null}
        previewUrl={null}
        draftPayload={null}
        signedProof={null}
        authorKeys={[
          {
            id: 'k1',
            label: 'Primary Key',
            publicKeyBase64Url: 'abc',
            fingerprintHex: 'deadbeef',
            fingerprintShort: 'deadbeef',
            createdAt: Date.now(),
            storageMode: 'indexeddb-webcrypto',
          } as never,
        ]}
        selectedKeyId="k1"
        keyBackedUp={false}
        artworkTitle=""
        authorName=""
        errorMessage={null}
        onSelectKey={vi.fn()}
        onChangeTitle={vi.fn()}
        onChangeAuthorName={vi.fn()}
        onFileSelected={vi.fn()}
        onCertify={vi.fn()}
        onDownloadPng={vi.fn()}
        onAddToGalleryDeck={vi.fn()}
        onExportChmExchange={vi.fn()}
        onBackupKeyClick={vi.fn()}
      />,
    );

    expect(screen.getByTestId('advanced-left-pane')).toBeInTheDocument();
    expect(screen.getByTestId('advanced-center-pane')).toBeInTheDocument();
    expect(screen.getByTestId('advanced-right-pane')).toBeInTheDocument();
    expect(screen.getByTestId('key-backup-warning')).toBeInTheDocument();
  });
});
