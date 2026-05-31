# ML System: Student Performance Prediction & Topic Recommendations

## Overview

This directory contains the machine learning system for:

1. **Predicting student failure risk** using XGBoost
2. **Recommending topics to study** based on weak competencies and peer success patterns (KNN)

## Directory Structure

```
ml/
├── model/                       # Raw training data and API
│   ├── studentAssessment.csv   # Assessment scores
│   ├── studentInfo.csv         # Student demographics
│   ├── studentVle.csv          # VLE activity (clicks, engagement)
│   └── main.py                 # FastAPI application
├── models/                      # Trained artifacts (auto-generated)
│   ├── xgb_pipeline.joblib     # Sklearn Pipeline with preprocessor + XGBoost model
│   └── metadata.json           # Model metadata (features, CV metrics)
├── preprocessing.py             # Feature aggregation & ColumnTransformer
├── recommend.py                # KNN-based recommendation engine
├── train.py                    # Training script with 5-fold CV
├── requirements.txt            # Python dependencies
├── tests/                      # Integration tests
│   └── test_api.py            # FastAPI endpoint tests
├── __init__.py                # Package marker
└── README.md                  # This file
```

## Installation

### 1. Install dependencies

```bash
pip install -r ml/requirements.txt
```

### 2. Train the model

From the repository root:

```bash
python -m ml.train
```

Or from the `ml/` directory:

```bash
cd ml
python train.py
```

This will:

- Load raw CSV files from `ml/model/`
- Aggregate features per student (avg test scores, VLE activity, demographics)
- Run 5-fold Stratified Cross-Validation with XGBoost
- Save:
  - `ml/models/xgb_pipeline.joblib` — complete sklearn Pipeline
  - `ml/models/metadata.json` — training metrics and feature list

**Output:**

```
CV ROC-AUC per fold: [0.85 0.82 0.88 0.80 0.84]
Mean ROC-AUC: 0.838
Saved pipeline to /path/to/ml/models/xgb_pipeline.joblib
```

## API Usage

### Start the API server

From the repository root:

```bash
uvicorn ml.model.main:app --reload --host 127.0.0.1 --port 8000
```

The API will load:

- `ml/models/xgb_pipeline.joblib` (risk prediction)
- Raw CSVs from `ml/model/` (for KNN recommendations)
- SHAP explainer (if available)

### Health Check

```bash
curl http://localhost:8000/api/health
```

Response:

```json
{
  "status": "ok",
  "pipeline_available": true,
  "knn_available": true,
  "shap_available": true
}
```

### Predict Student Risk

**Endpoint:** `POST /api/predict`

**Request:**

```json
{
  "avg_test_score": 65.5,
  "total_clicks": 1200,
  "competency_profile": {
    "SQL": 45.0,
    "Python": 72.0,
    "React": 88.0,
    "JavaScript": 55.0
  },
  "extras": {
    "num_of_prev_attempts": 2.0,
    "studied_credits": 60.0
  }
}
```

**Response:**

```json
{
  "risk_probability": 0.627,
  "is_at_risk": true,
  "reasons": ["Критическое непонимание тем: SQL, JavaScript, Python"],
  "competency_summary": {
    "weak_areas": ["SQL", "JavaScript", "Python"],
    "strong_areas": ["React"]
  },
  "recommended_tags_for_search": ["SQL", "JavaScript", "Python"]
}
```

**Parameters:**

- `avg_test_score` (float, [0, 100]): average test score
- `total_clicks` (int, ≥ 0): total VLE activity/engagement
- `competency_profile` (dict): topic → competency score (0-100)
- `extras` (optional dict): additional features (e.g., `num_of_prev_attempts`, `studied_credits`)

### Get Topic Recommendations

**Endpoint:** `POST /api/recommend`

**Request:**

```json
{
  "avg_test_score": 50.0,
  "total_clicks": 800,
  "competency_profile": {
    "SQL": 35.0,
    "Python": 42.0,
    "React": 75.0,
    "JavaScript": 28.0
  }
}
```

**Response:**

```json
{
  "recommended_topics": ["JavaScript", "SQL", "Python"],
  "reasoning": "Рекомендуем изучить 3 самых слабых тем на основе анализа компетенций и сравнения с 5 похожими успешными студентами.",
  "peer_count": 5,
  "weak_topics_full": [
    ["JavaScript", 28.0],
    ["SQL", 35.0],
    ["Python", 42.0],
    ["React", 75.0]
  ]
}
```

**Logic:**

1. Finds 5 nearest successful students (using KNN on numeric features)
2. Identifies weak topics (competency < 60%)
3. Returns top-3 weakest topics sorted by score

## Running Tests

```bash
pytest ml/tests/test_api.py -v
```

**Test coverage:**

- Health check endpoint
- Predict validation (valid/invalid inputs, edge cases)
- Recommend validation (valid/invalid inputs, edge cases)
- Integration tests (at-risk vs. strong students)
- Error handling (missing fields, wrong types)

**Example output:**

```
ml/tests/test_api.py::TestHealthEndpoint::test_health_check PASSED
ml/tests/test_api.py::TestPredictEndpoint::test_predict_valid_input PASSED
ml/tests/test_api.py::TestPredictEndpoint::test_predict_invalid_competency_profile_values PASSED
ml/tests/test_api.py::TestRecommendEndpoint::test_recommend_valid_input PASSED
...
```

## Model Architecture

### Preprocessing Pipeline

**Input:** Raw CSV files (assessments, VLE, student info)

**Processing:**

1. Aggregate per-student features:
   - `avg_test_score`: mean assessment score
   - `total_clicks`: sum of VLE engagement
   - Demographics: gender, region, education level, age band, previous attempts, credits, disability

2. Missing value handling:
   - Numeric: median imputation + standardization (StandardScaler)
   - Categorical: constant imputation ('missing') + one-hot encoding

3. Feature selection: drop target and non-predictive columns

**Output:** Numeric feature matrix ready for XGBoost

### Risk Prediction Model (XGBoost)

```
Input: [avg_test_score, total_clicks, demographics, one-hot encoded features]
           ↓
    XGBClassifier (150 estimators, depth=5, lr=0.05)
           ↓
    Output: P(risk_of_failure)  where risk = {Fail, Withdrawn} vs {Pass, Distinction}
```

**Hyperparameters:**

- `n_estimators`: 150
- `max_depth`: 5
- `learning_rate`: 0.05
- `eval_metric`: logloss
- `random_state`: 42 (reproducibility)

**Evaluation:**

- Metric: ROC-AUC (Area Under the Receiver Operating Characteristic Curve)
- Strategy: 5-fold Stratified Cross-Validation

### KNN Recommendation Engine

```
Successful students (final_result = Pass or Distinction)
    ↓
Build feature vectors: [avg_test_score, total_clicks, num_attempts, studied_credits]
    ↓
Train KNN (k=5, metric=cosine)
    ↓
At prediction time:
  1. Find 5 nearest successful students to the current student
  2. Identify student's weak topics (competency < 60%)
  3. Rank by weakness score (ascending)
  4. Return top-3 weakest topics as recommendations
```

## Data Requirements

### Raw CSV Schemas

#### studentAssessment.csv

```
id_assessment, id_student, date_submitted, is_banked, score
```

- `score`: assessment score (0-100)

#### studentVle.csv

```
code_module, code_presentation, id_student, id_site, date, sum_click
```

- `sum_click`: cumulative clicks on a VLE site by a student

#### studentInfo.csv

```
code_module, code_presentation, id_student, gender, region, highest_education,
imd_band, age_band, num_of_prev_attempts, studied_credits, disability, final_result
```

- `final_result`: {Pass, Fail, Withdrawn, Distinction}

### Competency Profile Format

Expected from the frontend or computed server-side:

```python
competency_profile = {
    'SQL': 65.0,           # % of correct answers on SQL questions
    'Python': 78.5,
    'React': 42.0,
    'REST_API': 55.0
}
```

Topics should be consistent (e.g., question tags in the system).

## Production Deployment

### Docker

Create `ml/Dockerfile`:

```dockerfile
FROM python:3.10-slim

WORKDIR /app
COPY ml/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY ml/ .

CMD ["uvicorn", "model.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Build and run:

```bash
docker build -f ml/Dockerfile -t ml-api:latest .
docker run -p 8000:8000 ml-api:latest
```

### Model Updates

To retrain the model:

```bash
# Update raw CSVs in ml/model/
python -m ml.train  # Creates/updates ml/models/xgb_pipeline.joblib

# Restart API to load new model
# (or implement hot-reload if needed)
```

## Troubleshooting

### API returns "Model pipeline not available"

**Cause:** `ml/models/xgb_pipeline.joblib` not found  
**Solution:** Run `python -m ml.train` to create it

### API returns "Recommendation engine not available"

**Cause:** KNN failed to load (e.g., raw CSVs missing)  
**Solution:** Ensure `ml/model/studentAssessment.csv`, `studentVle.csv`, `studentInfo.csv` exist

### OneHotEncoder error with different sklearn versions

**Status:** Fixed in `ml/preprocessing.py` (auto-detects `sparse` vs `sparse_output`)

### SHAP not available

**Cause:** `shap` package not installed or old scikit-learn version  
**Impact:** SHAP explanations won't be included in reasons; API still works  
**Solution:** Install latest SHAP: `pip install shap --upgrade`

## Next Steps

- [ ] **Competency profile computation:** Add server-side function to compute `competency_profile` from student answer logs
- [ ] **Content indexing:** Map recommended topics to test IDs / learning resources
- [ ] **Retraining pipeline:** Add scheduled/automated model retraining
- [ ] **Monitoring:** Track prediction performance on new data; alert on AUC drop
- [ ] **A/B testing:** Compare KNN recommendations vs. simple rule-based recommendations
- [ ] **Feature engineering:** Add temporal features (recency, frequency) and per-module engagement
- [ ] **Hyperparameter tuning:** Use Optuna/GridSearch for XGBoost parameter optimization
- [ ] **Explainability:** Generate student-friendly explanations of recommendations

## References

- **XGBoost:** https://xgboost.readthedocs.io/
- **Scikit-learn Pipeline:** https://scikit-learn.org/stable/modules/compose.html
- **SHAP:** https://shap.readthedocs.io/
- **FastAPI:** https://fastapi.tiangolo.com/
- **Pytest:** https://docs.pytest.org/
