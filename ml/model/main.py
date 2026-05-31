from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, List, Optional
import pandas as pd
import joblib
import os
import json
import sys
import numpy as np
import traceback

# Ensure the repository root is on the import path so joblib can unpickle pipeline objects
BASE = os.path.dirname(__file__)
REPO_ROOT = os.path.abspath(os.path.join(BASE, '..', '..'))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

# Try to import recommend module; if it fails, graceful fallback
try:
    from ml.recommend import load_or_build_knn, recommend_topics_by_peer_weakness
except ModuleNotFoundError:
    try:
        from recommend import load_or_build_knn, recommend_topics_by_peer_weakness
    except ModuleNotFoundError:
        load_or_build_knn = None
        recommend_topics_by_peer_weakness = None

app = FastAPI(title="ML API: Многоуровневый анализ компетенций")


# --- Load artifacts (pipeline + metadata) ---
BASE = os.path.dirname(__file__)
MODEL_DIR = os.path.abspath(os.path.join(BASE, '..', 'models'))
RAW_DATA_DIR = os.path.abspath(os.path.join(BASE, '..', 'model'))  # raw CSVs for KNN
PIPELINE_PATH = os.path.join(MODEL_DIR, 'xgb_pipeline.joblib')
META_PATH = os.path.join(MODEL_DIR, 'metadata.json')

pipeline = None
metadata = {}
shap_explainer = None
knn_model = None
knn_successful_students = None
knn_feature_cols = None

if os.path.exists(META_PATH):
    try:
        with open(META_PATH, 'r', encoding='utf8') as f:
            metadata = json.load(f)
    except Exception:
        metadata = {}

# try standard model path first, then fallback to metadata path if available
for candidate_path in [PIPELINE_PATH, os.path.abspath(metadata.get('model_path', ''))]:
    if not candidate_path:
        continue
    if os.path.exists(candidate_path):
        try:
            pipeline = joblib.load(candidate_path)
            print(f"Loaded ML pipeline from {candidate_path}")
            break
        except Exception:
            pipeline = None
            print(f"Failed to load ML pipeline from {candidate_path}")
            traceback.print_exc()

if pipeline is None:
    print(f"ML pipeline unavailable. Checked paths: {PIPELINE_PATH}, {metadata.get('model_path')}")

try:
    import shap
    # attempt to build explainer if pipeline and classifier exist
    if pipeline is not None and hasattr(pipeline, 'named_steps') and 'clf' in pipeline.named_steps:
        try:
            clf = pipeline.named_steps['clf']
            # create explainer on the model (background not provided -> use TreeExplainer)
            shap_explainer = shap.TreeExplainer(clf)
        except Exception:
            shap_explainer = None
except Exception:
    shap = None
    shap_explainer = None

# Load KNN model for recommendations
if load_or_build_knn is not None and os.path.exists(RAW_DATA_DIR):
    try:
        knn_model, knn_successful_students, knn_feature_cols = load_or_build_knn(RAW_DATA_DIR, n_neighbors=5)
    except Exception:
        knn_model = None
        knn_successful_students = None
        knn_feature_cols = None


class StudentData(BaseModel):
    avg_test_score: float = Field(..., ge=0.0, le=100.0)
    total_clicks: int = Field(..., ge=0)
    # competency_profile: {"SQL": 40.5, "JOIN": 15.0, "React": 90.0}
    competency_profile: Dict[str, float]
    # optional: allow passing extra known fields (e.g., num_of_prev_attempts)
    extras: Optional[Dict[str, float]] = None


def _build_input_df(student: StudentData):
    # construct a DataFrame matching feature_columns from metadata (fallback to minimal)
    feature_cols = metadata.get('feature_columns') if metadata.get('feature_columns') else ['avg_test_score', 'total_clicks']
    row = {c: np.nan for c in feature_cols}
    # fill known
    row['avg_test_score'] = student.avg_test_score
    row['total_clicks'] = student.total_clicks
    # extras may override or add
    if student.extras:
        for k, v in student.extras.items():
            if k in row:
                row[k] = v
    return pd.DataFrame([row])


def _build_knn_feature_vector(student: StudentData) -> Optional[np.ndarray]:
    """Build numeric feature vector for KNN (avg_test_score, total_clicks, etc.)."""
    if knn_feature_cols is None:
        return None
    features = []
    for col in knn_feature_cols:
        if col == 'avg_test_score':
            features.append(student.avg_test_score)
        elif col == 'total_clicks':
            features.append(student.total_clicks)
        elif col in (student.extras or {}):
            features.append(student.extras[col])
        else:
            features.append(0.0)  # fallback to 0
    return np.array([features])
    """Build numeric feature vector for KNN (avg_test_score, total_clicks, etc.)."""
    if knn_feature_cols is None:
        return None
    features = []
    for col in knn_feature_cols:
        if col == 'avg_test_score':
            features.append(student.avg_test_score)
        elif col == 'total_clicks':
            features.append(student.total_clicks)
        elif col in (student.extras or {}):
            features.append(student.extras[col])
        else:
            features.append(0.0)  # fallback to 0
    return np.array([features])


@app.post('/api/predict')
def predict_risk(student: StudentData):
    # validate competency_profile values
    for k, v in student.competency_profile.items():
        if not isinstance(k, str) or not isinstance(v, (int, float)):
            raise HTTPException(status_code=400, detail='competency_profile must be Dict[str,float]')
        if v < 0 or v > 100:
            raise HTTPException(status_code=400, detail='competency values must be in [0,100]')

    input_df = _build_input_df(student)

    if pipeline is None:
        raise HTTPException(status_code=500, detail='Model pipeline not available on server')

    # Override clearly low-risk cases where the student has near-perfect average and no weak competencies.
    strong_scores = list(student.competency_profile.values())
    if (
        student.avg_test_score >= 95.0
        and strong_scores
        and all(score >= 90.0 for score in strong_scores)
    ):
        risk_prob = 0.01
    else:
        try:
            proba = pipeline.predict_proba(input_df)[0][1]
            risk_prob = float(proba)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f'Prediction failed: {e}')

    # competency weak/strong tags
    weak_tags = []
    strong_tags = []
    for tag, score in student.competency_profile.items():
        if score < 60.0:
            weak_tags.append({'tag': tag, 'score': float(score)})
        else:
            strong_tags.append({'tag': tag, 'score': float(score)})
    weak_tags = sorted(weak_tags, key=lambda x: x['score'])
    critical_weak_tags = [t['tag'] for t in weak_tags[:3]]

    # explanations: try SHAP on preprocessed features if available
    reasons = []
    if shap_explainer is not None:
        try:
            # obtain preprocessed array: selector -> preproc
            preproc = pipeline.named_steps.get('preproc')
            selector = pipeline.named_steps.get('selector')
            if selector is not None and preproc is not None:
                X_sel = selector.transform(input_df)
                X_pre = preproc.transform(X_sel)
                shap_vals = shap_explainer.shap_values(X_pre)
                # shap_vals shape depends on model; use heuristic on first two features if available
                if isinstance(shap_vals, (list, tuple)) and len(shap_vals) > 0:
                    sv = shap_vals[0]
                else:
                    sv = shap_vals
                # interpret contributions (simple thresholds)
                if sv.ndim == 2 and sv.shape[1] >= 2:
                    if float(sv[0, 0]) < -0.1:
                        reasons.append('Низкий вклад среднего балла в прогноз')
                    if float(sv[0, 1]) < -0.1:
                        reasons.append('Низкая вовлеченность по активности')
        except Exception:
            pass

    # add competency-based reason
    if critical_weak_tags:
        reasons.append(f"Критическое непонимание тем: {', '.join(critical_weak_tags)}")

    return {
        'risk_probability': round(risk_prob, 3),
        'is_at_risk': risk_prob > 0.5,
        'reasons': reasons,
        'competency_summary': {
            'weak_areas': critical_weak_tags,
            'strong_areas': [t['tag'] for t in strong_tags]
        },
        'recommended_tags_for_search': critical_weak_tags
    }


@app.post('/api/recommend')
def recommend_topics(student: StudentData):
    """Recommend topics to study based on peer success patterns (KNN) and weak competencies."""
    # validate competency_profile values
    for k, v in student.competency_profile.items():
        if not isinstance(k, str) or not isinstance(v, (int, float)):
            raise HTTPException(status_code=400, detail='competency_profile must be Dict[str,float]')
        if v < 0 or v > 100:
            raise HTTPException(status_code=400, detail='competency values must be in [0,100]')

    # check if KNN available
    if knn_model is None or recommend_topics_by_peer_weakness is None:
        raise HTTPException(status_code=503, detail='Recommendation engine not available')

    # build KNN feature vector
    student_features = _build_knn_feature_vector(student)
    if student_features is None or len(student_features[0]) == 0:
        raise HTTPException(status_code=400, detail='Cannot build feature vector for KNN')

    try:
        result = recommend_topics_by_peer_weakness(
            student_features[0],
            student.competency_profile,
            knn_model,
            knn_successful_students,
            weak_threshold=60.0,
            top_k=3
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Recommendation failed: {e}')


@app.get('/api/health')
def health_check():
    """Health check endpoint."""
    return {
        'status': 'ok',
        'pipeline_available': pipeline is not None,
        'knn_available': knn_model is not None,
        'shap_available': shap_explainer is not None
    }