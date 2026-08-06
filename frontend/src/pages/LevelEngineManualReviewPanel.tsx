import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  buildLevelEngineManualReviewExport,
  createEmptyLevelEngineManualReviewStore,
  createLevelEngineManualReview,
  createLevelEngineManualReviewExportFileName,
  draftFromLevelEngineManualReview,
  findLevelEngineManualReview,
  loadLevelEngineManualReviewStore,
  persistLevelEngineManualReviewStore,
  removeLevelEngineManualReview,
  summarizeLevelEngineManualReviews,
  upsertLevelEngineManualReview,
  type LevelEngineManualReviewDraft,
  type LevelEngineManualReviewReasonCode,
  type LevelEngineManualReviewStore,
  type LevelEngineManualReviewVerdict,
} from '@/shared/level-engine/levelEngineManualReview';
import type {
  LevelEngineFrozenSample,
  LevelEngineFrozenSampleItem,
} from '@/shared/api/runtime/levelEngineFrozenSampleApi';

import styles from './LevelEngineManualReviewPanel.module.css';

interface LevelEngineManualReviewPanelProps {
  readonly sample:
    LevelEngineFrozenSample;
  readonly item:
    LevelEngineFrozenSampleItem;
}

const TEXT = {
  eyebrow:
    '\u0420\u0423\u0427\u041d\u0410\u042f \u041f\u0420\u041e\u0412\u0415\u0420\u041a\u0410',
  title:
    '\u041e\u0446\u0435\u043d\u043a\u0430 \u0443\u0440\u043e\u0432\u043d\u044f',
  description:
    '\u0420\u0430\u0437\u043c\u0435\u0442\u043a\u0430 \u0445\u0440\u0430\u043d\u0438\u0442\u0441\u044f \u0442\u043e\u043b\u044c\u043a\u043e \u0432 \u044d\u0442\u043e\u043c \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435 \u0438 \u043d\u0435 \u043c\u0435\u043d\u044f\u0435\u0442 \u0430\u043b\u0433\u043e\u0440\u0438\u0442\u043c.',
  correct:
    '\u0412\u0435\u0440\u043d\u043e',
  incorrect:
    '\u041e\u0448\u0438\u0431\u043a\u0430',
  needsReview:
    '\u041d\u0443\u0436\u043d\u0430 \u043f\u043e\u0432\u0442\u043e\u0440\u043d\u0430\u044f \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0430',
  reason:
    '\u041f\u0440\u0438\u0447\u0438\u043d\u0430',
  reasonPlaceholder:
    '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043f\u0440\u0438\u0447\u0438\u043d\u0443',
  comment:
    '\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439',
  commentPlaceholder:
    '\u0427\u0442\u043e \u0438\u043c\u0435\u043d\u043d\u043e \u0432\u0435\u0440\u043d\u043e \u0438\u043b\u0438 \u043d\u0435\u0432\u0435\u0440\u043d\u043e?',
  save:
    '\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u043e\u0446\u0435\u043d\u043a\u0443',
  remove:
    '\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u043e\u0446\u0435\u043d\u043a\u0443',
  export:
    '\u042d\u043a\u0441\u043f\u043e\u0440\u0442 JSON',
  saved:
    '\u041e\u0446\u0435\u043d\u043a\u0430 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0430 \u043b\u043e\u043a\u0430\u043b\u044c\u043d\u043e.',
  removed:
    '\u041e\u0446\u0435\u043d\u043a\u0430 \u0443\u0434\u0430\u043b\u0435\u043d\u0430.',
  total:
    '\u0412\u0441\u0435\u0433\u043e',
  reviewed:
    '\u041f\u0440\u043e\u0432\u0435\u0440\u0435\u043d\u043e',
  remaining:
    '\u041e\u0441\u0442\u0430\u043b\u043e\u0441\u044c',
} as const;

const REASON_LABELS:
Record<
  LevelEngineManualReviewReasonCode,
  string
> = {
  zone_geometry:
    '\u0413\u0435\u043e\u043c\u0435\u0442\u0440\u0438\u044f \u0437\u043e\u043d\u044b',
  touch_episodes:
    '\u042d\u043f\u0438\u0437\u043e\u0434\u044b \u043a\u0430\u0441\u0430\u043d\u0438\u044f',
  lifecycle_split:
    '\u0420\u0430\u0437\u0434\u0435\u043b\u0435\u043d\u0438\u0435 lifecycle',
  transition_role:
    '\u0420\u043e\u043b\u044c origin / flip / reclaim',
  break_detection:
    '\u041e\u043f\u0440\u0435\u0434\u0435\u043b\u0435\u043d\u0438\u0435 \u043f\u0440\u043e\u0431\u043e\u044f',
  causal_timing:
    '\u0412\u0440\u0435\u043c\u044f \u043e\u0431\u043d\u0430\u0440\u0443\u0436\u0435\u043d\u0438\u044f',
  market_noise:
    '\u0420\u044b\u043d\u043e\u0447\u043d\u044b\u0439 \u0448\u0443\u043c',
  missing_context:
    '\u041d\u0435\u0434\u043e\u0441\u0442\u0430\u0442\u043e\u0447\u043d\u043e \u043a\u043e\u043d\u0442\u0435\u043a\u0441\u0442\u0430',
  other:
    '\u0414\u0440\u0443\u0433\u043e\u0435',
};

const REASON_CODES =
  Object.keys(
    REASON_LABELS,
  ) as LevelEngineManualReviewReasonCode[];

function createInitialStore():
LevelEngineManualReviewStore {
  if (
    typeof window === 'undefined'
    || !window.localStorage
  ) {
    return createEmptyLevelEngineManualReviewStore();
  }

  return loadLevelEngineManualReviewStore(
    window.localStorage,
  );
}

function downloadJson(
  fileName: string,
  value: unknown,
): void {
  const blob =
    new Blob(
      [
        JSON.stringify(
          value,
          null,
          2,
        ),
      ],
      {
        type:
          'application/json;charset=utf-8',
      },
    );
  const url =
    URL.createObjectURL(blob);
  const link =
    document.createElement('a');

  link.href =
    url;
  link.download =
    fileName;
  link.click();

  URL.revokeObjectURL(url);
}

export function LevelEngineManualReviewPanel({
  sample,
  item,
}: LevelEngineManualReviewPanelProps) {
  const [
    store,
    setStore,
  ] =
    useState<LevelEngineManualReviewStore>(
      createInitialStore,
    );
  const [
    draft,
    setDraft,
  ] =
    useState<LevelEngineManualReviewDraft>({
      verdict: '',
      reasonCode: '',
      comment: '',
    });
  const [
    message,
    setMessage,
  ] =
    useState('');
  const [
    error,
    setError,
  ] =
    useState('');

  const currentAnnotation =
    useMemo(
      () =>
        findLevelEngineManualReview(
          store,
          sample.id,
          item.id,
        ),
      [
        item.id,
        sample.id,
        store,
      ],
    );

  const summary =
    useMemo(
      () =>
        summarizeLevelEngineManualReviews(
          sample,
          store,
        ),
      [
        sample,
        store,
      ],
    );

  useEffect(
    () => {
      setDraft(
        draftFromLevelEngineManualReview(
          currentAnnotation,
        ),
      );
      setMessage('');
      setError('');
    },
    [
      currentAnnotation,
      item.id,
      sample.id,
    ],
  );

  const updateStore = (
    nextStore:
      LevelEngineManualReviewStore,
  ) => {
    persistLevelEngineManualReviewStore(
      window.localStorage,
      nextStore,
    );
    setStore(nextStore);
  };

  const selectVerdict = (
    verdict:
      LevelEngineManualReviewVerdict,
  ) => {
    setDraft(
      (current) => ({
        ...current,
        verdict,
        reasonCode:
          verdict === 'correct'
            ? ''
            : current.reasonCode,
      }),
    );
    setMessage('');
    setError('');
  };

  const saveReview = () => {
    try {
      const annotation =
        createLevelEngineManualReview(
          sample,
          item,
          draft,
        );
      const nextStore =
        upsertLevelEngineManualReview(
          store,
          annotation,
        );

      updateStore(nextStore);
      setMessage(TEXT.saved);
      setError('');
    } catch (nextError) {
      setMessage('');
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Manual review save failed',
      );
    }
  };

  const removeReview = () => {
    const nextStore =
      removeLevelEngineManualReview(
        store,
        sample.id,
        item.id,
      );

    updateStore(nextStore);
    setDraft({
      verdict: '',
      reasonCode: '',
      comment: '',
    });
    setMessage(TEXT.removed);
    setError('');
  };

  const exportReviews = () => {
    const exported =
      buildLevelEngineManualReviewExport(
        sample,
        store,
      );

    downloadJson(
      createLevelEngineManualReviewExportFileName(
        sample,
      ),
      exported,
    );
  };

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div>
          <p>{TEXT.eyebrow}</p>
          <h2>{TEXT.title}</h2>
          <span>{TEXT.description}</span>
        </div>

        <div className={styles.summary}>
          <div>
            <span>{TEXT.total}</span>
            <strong>{summary.total}</strong>
          </div>
          <div>
            <span>{TEXT.reviewed}</span>
            <strong>{summary.reviewed}</strong>
          </div>
          <div>
            <span>{TEXT.remaining}</span>
            <strong>{summary.remaining}</strong>
          </div>
        </div>
      </header>

      <div className={styles.verdicts}>
        <button
          type="button"
          data-verdict="correct"
          aria-pressed={
            draft.verdict === 'correct'
          }
          onClick={() => {
            selectVerdict('correct');
          }}
        >
          {TEXT.correct}
        </button>

        <button
          type="button"
          data-verdict="incorrect"
          aria-pressed={
            draft.verdict === 'incorrect'
          }
          onClick={() => {
            selectVerdict('incorrect');
          }}
        >
          {TEXT.incorrect}
        </button>

        <button
          type="button"
          data-verdict="needs_review"
          aria-pressed={
            draft.verdict === 'needs_review'
          }
          onClick={() => {
            selectVerdict('needs_review');
          }}
        >
          {TEXT.needsReview}
        </button>
      </div>

      <div className={styles.fields}>
        <label>
          <span>{TEXT.reason}</span>
          <select
            value={draft.reasonCode}
            disabled={
              draft.verdict === 'correct'
            }
            onChange={(event) => {
              setDraft(
                (current) => ({
                  ...current,
                  reasonCode:
                    event.target.value as (
                      LevelEngineManualReviewReasonCode
                      | ''
                    ),
                }),
              );
              setMessage('');
              setError('');
            }}
          >
            <option value="">
              {TEXT.reasonPlaceholder}
            </option>

            {REASON_CODES.map(
              (reasonCode) => (
                <option
                  key={reasonCode}
                  value={reasonCode}
                >
                  {REASON_LABELS[reasonCode]}
                </option>
              ),
            )}
          </select>
        </label>

        <label className={styles.comment}>
          <span>{TEXT.comment}</span>
          <textarea
            value={draft.comment}
            maxLength={2_000}
            placeholder={
              TEXT.commentPlaceholder
            }
            onChange={(event) => {
              setDraft(
                (current) => ({
                  ...current,
                  comment:
                    event.target.value,
                }),
              );
              setMessage('');
              setError('');
            }}
          />
        </label>
      </div>

      <footer className={styles.footer}>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.save}
            onClick={saveReview}
          >
            {TEXT.save}
          </button>

          <button
            type="button"
            className={styles.secondary}
            disabled={!currentAnnotation}
            onClick={removeReview}
          >
            {TEXT.remove}
          </button>

          <button
            type="button"
            className={styles.secondary}
            disabled={
              summary.reviewed === 0
            }
            onClick={exportReviews}
          >
            {TEXT.export}
          </button>
        </div>

        <div
          className={
            error
              ? styles.error
              : styles.message
          }
          role="status"
        >
          {error || message}
        </div>
      </footer>
    </section>
  );
}
