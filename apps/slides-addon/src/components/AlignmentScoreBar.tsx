import type { AlignmentScore } from "@magistrat/compiler-core";

export interface AlignmentScoreBarProps {
  score: AlignmentScore;
}

function tierForScore(score: number): "good" | "fair" | "poor" {
  if (score >= 80) {
    return "good";
  }
  if (score >= 50) {
    return "fair";
  }
  return "poor";
}

export function AlignmentScoreBar({ score }: AlignmentScoreBarProps) {
  const tier = tierForScore(score.score);
  return (
    <div className="alignment-score">
      <div className="alignment-score__header">
        <span className="alignment-score__label">Alignment</span>
        <span className="alignment-score__value">{score.score}%</span>
      </div>
      <div className="alignment-score__bar">
        <div
          className={`alignment-score__fill alignment-score__fill--${tier}`}
          style={{ width: `${score.score}%` }}
        />
      </div>
      <p className="alignment-score__detail">
        {score.passingObjects} of {score.analyzedObjects} objects aligned
      </p>
    </div>
  );
}
