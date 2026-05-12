from fastapi import FastAPI
from pydantic import BaseModel
from typing import Dict, List
import pandas as pd
import joblib

app = FastAPI(title="ML API: Многоуровневый анализ компетенций")

# Загружаем базовую модель риска
model = joblib.load('xgboost_model.pkl')
explainer = joblib.load('shap_explainer.pkl')

class StudentData(BaseModel):
    avg_test_score: float
    total_clicks: int
    # Профиль компетенций: {"SQL": 40.5, "JOIN": 15.0, "React": 90.0}
    competency_profile: Dict[str, float] 

@app.post("/api/predict")
def predict_risk(student: StudentData):
    # 1. МАКРО-УРОВЕНЬ: Прогнозирование общего риска (XGBoost)
    input_features = pd.DataFrame([{
        "avg_test_score": student.avg_test_score,
        "total_clicks": student.total_clicks
    }])
    
    risk_prob = float(model.predict_proba(input_features)[0][1])
    
    # 2. МИКРО-УРОВЕНЬ: Анализ профиля компетенций (Тегов)
    weak_tags = []
    strong_tags = []
    
    # Разбираем каждый тег и процент успешности по нему
    for tag, score in student.competency_profile.items():
        if score < 60.0:  # Порог (если правильных ответов меньше 60%)
            weak_tags.append({"tag": tag, "score": score})
        else:
            strong_tags.append({"tag": tag, "score": score})
            
    # Сортируем проблемные теги: от самых низких баллов к более высоким
    weak_tags = sorted(weak_tags, key=lambda x: x["score"])
    
    # Берем ТОП-3 самых "западающих" микро-навыков
    critical_weak_tags = [item["tag"] for item in weak_tags[:3]]
    
    # 3. ФОРМИРОВАНИЕ ОБЪЯСНЕНИЙ (SHAP + Теги)
    shap_values = explainer.shap_values(input_features)
    reasons = []
    
    # Интерпретация базовых метрик
    if shap_values[0][0] > 0.1:
        reasons.append("Общий средний балл ниже нормы")
    if shap_values[0][1] > 0.1:
        reasons.append("Низкий уровень вовлеченности (кликов) в системе")
        
    # Добавление микро-причин
    if critical_weak_tags:
        reasons.append(f"Критическое непонимание тем: {', '.join(critical_weak_tags)}")

    # 4. РЕЗУЛЬТАТ ДЛЯ NEXT.JS
    return {
        "risk_probability": round(risk_prob, 3),
        "is_at_risk": risk_prob > 0.5,
        "reasons": reasons,
        # Развернутый профиль для отрисовки графиков на фронтенде
        "competency_summary": {
            "weak_areas": critical_weak_tags,
            "strong_areas": [item["tag"] for item in strong_tags]
        },
        # Массив тегов для SQL-запроса в Next.js (чтобы найти тесты)
        "recommended_tags_for_search": critical_weak_tags
    }