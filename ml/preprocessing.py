import pandas as pd
import numpy as np
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import OneHotEncoder, StandardScaler


def build_feature_table(assessments: pd.DataFrame, vle: pd.DataFrame, info: pd.DataFrame) -> pd.DataFrame:
    """Create aggregated per-student feature table and target column.

    - avg_test_score: mean of assessment `score` per student
    - total_clicks: sum of `sum_click` per student
    - includes selected demographic/numeric fields from `info`
    - target `y`: 1 for Fail/Withdrawn, 0 otherwise
    """
    # aggregate assessments
    if 'id_student' not in assessments.columns:
        raise ValueError('assessments must contain id_student')
    avg_scores = assessments.groupby('id_student')['score'].mean().rename('avg_test_score')

    # aggregate VLE activity
    if 'id_student' not in vle.columns:
        raise ValueError('vle must contain id_student')
    total_clicks = vle.groupby('id_student')['sum_click'].sum().rename('total_clicks')

    # select useful columns from info
    info_sel = info.set_index('id_student')
    cols_keep = [c for c in ['gender', 'region', 'highest_education', 'imd_band', 'age_band', 'num_of_prev_attempts', 'studied_credits', 'disability', 'final_result'] if c in info_sel.columns]
    df = info_sel[cols_keep].copy()

    # join aggregates
    df = df.join(avg_scores, how='left')
    df = df.join(total_clicks, how='left')

    # basic missing value handling
    df['avg_test_score'] = df['avg_test_score'].fillna(0.0)
    df['total_clicks'] = df['total_clicks'].fillna(0.0)

    # target: risk_of_failure
    df['y'] = df['final_result'].apply(lambda v: 1 if str(v).lower() in ('fail', 'withdrawn') else 0)

    # numeric conversions
    for col in ['num_of_prev_attempts', 'studied_credits']:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')

    return df.reset_index()


def make_preprocessor(df: pd.DataFrame) -> ColumnTransformer:
    """Create an sklearn ColumnTransformer for numeric and categorical features.

    Returns a fitted ColumnTransformer (unfitted transformers are OK; fitting happens in a Pipeline during train).
    """
    numeric_features = [c for c in ['avg_test_score', 'total_clicks', 'num_of_prev_attempts', 'studied_credits'] if c in df.columns]
    categorical_features = [c for c in ['gender', 'region', 'highest_education', 'imd_band', 'age_band', 'disability'] if c in df.columns]

    numeric_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='median')),
        ('scaler', StandardScaler())
    ])

    # OneHotEncoder parameter name changed across sklearn versions ('sparse' -> 'sparse_output')
    try:
        onehot = OneHotEncoder(handle_unknown='ignore', sparse_output=False)
    except TypeError:
        onehot = OneHotEncoder(handle_unknown='ignore', sparse=False)

    categorical_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='constant', fill_value='missing')),
        ('onehot', onehot)
    ])

    preprocessor = ColumnTransformer(transformers=[
        ('num', numeric_transformer, numeric_features),
        ('cat', categorical_transformer, categorical_features)
    ], remainder='drop')

    return preprocessor


class FeatureSelector(BaseEstimator, TransformerMixin):
    """Select a list of columns by name from a DataFrame-like input.

    NOTE: keep constructor parameters unmodified so sklearn.clone can reproduce the
    estimator during cross-validation. Any conversion to list is done at transform time.
    """
    def __init__(self, columns=None):
        self.columns = columns

    def fit(self, X, y=None):
        return self

    def transform(self, X):
        if self.columns is None:
            return X
        cols = list(self.columns)
        return X[cols]
