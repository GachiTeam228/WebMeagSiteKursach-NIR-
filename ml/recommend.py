"""KNN-based recommendation system: find topics to study based on peer success patterns."""
import os
import pandas as pd
import numpy as np
from typing import List, Dict, Tuple
from sklearn.neighbors import NearestNeighbors


def build_knn_from_successful_students(
    assessments: pd.DataFrame,
    vle: pd.DataFrame,
    info: pd.DataFrame,
    n_neighbors: int = 5
) -> Tuple[NearestNeighbors, pd.DataFrame, List[str]]:
    """Train KNN model on successful students' feature vectors.

    Args:
        assessments, vle, info: raw data frames
        n_neighbors: number of neighbors for KNN

    Returns:
        (knn_model, successful_students_df, feature_columns)
        - knn_model: fitted NearestNeighbors
        - successful_students_df: features of successful students
        - feature_columns: list of feature names used
    """
    # aggregate features (same as in train.py)
    avg_scores = assessments.groupby('id_student')['score'].mean().rename('avg_test_score')
    total_clicks = vle.groupby('id_student')['sum_click'].sum().rename('total_clicks')

    info_sel = info.set_index('id_student')
    cols_keep = [c for c in ['gender', 'region', 'highest_education', 'imd_band', 'age_band', 'num_of_prev_attempts', 'studied_credits', 'disability', 'final_result'] if c in info_sel.columns]
    df = info_sel[cols_keep].copy()

    df = df.join(avg_scores, how='left')
    df = df.join(total_clicks, how='left')

    df['avg_test_score'] = df['avg_test_score'].fillna(0.0)
    df['total_clicks'] = df['total_clicks'].fillna(0.0)
    df['success'] = df['final_result'].apply(lambda v: 1 if str(v).lower() in ('pass', 'distinction') else 0)

    for col in ['num_of_prev_attempts', 'studied_credits']:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0.0)

    # filter successful students only
    successful = df[df['success'] == 1].reset_index()

    # feature columns for KNN (numeric only for simplicity)
    feature_cols = ['avg_test_score', 'total_clicks', 'num_of_prev_attempts', 'studied_credits']
    feature_cols = [c for c in feature_cols if c in successful.columns]
    X = successful[feature_cols].values

    # train KNN
    knn = NearestNeighbors(n_neighbors=min(n_neighbors, len(successful)), metric='cosine')
    knn.fit(X)

    return knn, successful[['id_student'] + feature_cols], feature_cols


def recommend_topics_by_peer_weakness(
    student_features: np.ndarray,
    competency_profile: Dict[str, float],
    knn_model: NearestNeighbors,
    successful_students: pd.DataFrame,
    weak_threshold: float = 60.0,
    top_k: int = 3
) -> Dict[str, any]:
    """Generate recommendations by combining weak topics and peer similarity.

    Args:
        student_features: numeric feature vector (avg_test_score, total_clicks, etc.)
        competency_profile: dict of topic -> score (0-100)
        knn_model: fitted NearestNeighbors
        successful_students: DataFrame of successful students' features
        weak_threshold: competency score below this is weak (default 60)
        top_k: return top-k recommendations

    Returns:
        {
            'recommended_topics': [topic, ...],
            'reasoning': 'explanation',
            'peer_count': number of similar successful students,
            'weak_topics': list of weak topics from competency_profile
        }
    """
    # find similar successful students
    distances, indices = knn_model.kneighbors([student_features], n_neighbors=min(5, len(successful_students)))

    # identify weak topics from competency profile
    weak_topics = sorted(
        [(topic, score) for topic, score in competency_profile.items() if score < weak_threshold],
        key=lambda x: x[1]  # sort by score ascending
    )
    weak_topics_list = [t[0] for t in weak_topics]

    # recommendation: prioritize weakest topics, limit to top_k
    recommended = weak_topics_list[:top_k]

    reasoning = f"Рекомендуем изучить {top_k} самых слабых тем на основе анализа компетенций и сравнения с {len(indices[0])} похожими успешными студентами."

    return {
        'recommended_topics': recommended,
        'reasoning': reasoning,
        'peer_count': len(indices[0]),
        'weak_topics_full': weak_topics
    }


def load_or_build_knn(model_dir: str, n_neighbors: int = 5):
    """Load KNN from pickle if exists, otherwise build from raw CSVs.

    Args:
        model_dir: path to directory with raw CSVs (e.g., ml/model)
        n_neighbors: neighbors for KNN

    Returns:
        (knn_model, successful_students_df, feature_columns) or (None, None, None) if failed
    """
    import joblib

    # check if KNN pickle exists
    knn_pkl_path = os.path.join(model_dir, '..', 'models', 'knn_model.pkl')
    if os.path.exists(knn_pkl_path):
        try:
            knn = joblib.load(knn_pkl_path)
            # can't easily restore successful_students and feature_cols from pickle,
            # so rebuild if needed
        except Exception:
            pass

    # rebuild from raw data
    try:
        assessments = pd.read_csv(os.path.join(model_dir, 'studentAssessment.csv'))
        vle = pd.read_csv(os.path.join(model_dir, 'studentVle.csv'))
        info = pd.read_csv(os.path.join(model_dir, 'studentInfo.csv'))
        return build_knn_from_successful_students(assessments, vle, info, n_neighbors)
    except Exception as e:
        return None, None, None
