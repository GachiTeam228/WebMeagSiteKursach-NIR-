import os
import json
import argparse
from datetime import datetime

import pandas as pd
import joblib
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.pipeline import Pipeline
import xgboost as xgb

# support running from repository root (`python -m ml.train`) and from `ml/` folder (`python train.py`)
try:
    from ml.preprocessing import build_feature_table, make_preprocessor, FeatureSelector
except ModuleNotFoundError:
    from preprocessing import build_feature_table, make_preprocessor, FeatureSelector


def load_raw(model_dir: str):
    assessments = pd.read_csv(os.path.join(model_dir, 'studentAssessment.csv'))
    vle = pd.read_csv(os.path.join(model_dir, 'studentVle.csv'))
    info = pd.read_csv(os.path.join(model_dir, 'studentInfo.csv'))
    return assessments, vle, info


def train_and_save(model_dir: str, out_dir: str):
    assessments, vle, info = load_raw(model_dir)
    df = build_feature_table(assessments, vle, info)

    # feature list: keep only the features available from the application
    feature_cols = ['avg_test_score', 'total_clicks']

    X = df[feature_cols]
    y = df['y']

    preprocessor = make_preprocessor(X)

    clf = xgb.XGBClassifier(n_estimators=150, max_depth=5, learning_rate=0.05, use_label_encoder=False, eval_metric='logloss', random_state=42)

    pipeline = Pipeline(steps=[
        ('selector', FeatureSelector(feature_cols)),
        ('preproc', preprocessor),
        ('clf', clf)
    ])

    # cross-validated ROC-AUC
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    scores = cross_val_score(pipeline, X, y, cv=cv, scoring='roc_auc', n_jobs=1)
    print('CV ROC-AUC per fold:', scores)
    print('Mean ROC-AUC:', scores.mean())

    # fit on full data and persist
    pipeline.fit(X, y)

    os.makedirs(out_dir, exist_ok=True)
    model_path = os.path.join(out_dir, 'xgb_pipeline.joblib')
    joblib.dump(pipeline, model_path)

    meta = {
        'created_at': datetime.utcnow().isoformat() + 'Z',
        'model_path': model_path,
        'cv_mean_roc_auc': float(scores.mean()),
        'n_features': len(feature_cols),
        'feature_columns': feature_cols,
        'xgboost_params': {
            'n_estimators': 150,
            'max_depth': 5,
            'learning_rate': 0.05
        }
    }
    with open(os.path.join(out_dir, 'metadata.json'), 'w', encoding='utf8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print('Saved pipeline to', model_path)


def main():
    parser = argparse.ArgumentParser(description='Train student-performance model')
    parser.add_argument('--model-dir', default=os.path.join(os.path.dirname(__file__), 'model'), help='Path to raw CSVs')
    parser.add_argument('--out-dir', default=os.path.join(os.path.dirname(__file__), 'models'), help='Output dir for artifacts')
    args = parser.parse_args()

    train_and_save(args.model_dir, args.out_dir)


if __name__ == '__main__':
    main()
