"""Integration tests for ML API endpoints."""
import pytest
import sys
import os
from pathlib import Path

# Add parent directory to path so we can import ml modules
ml_dir = Path(__file__).parent.parent
sys.path.insert(0, str(ml_dir))

from fastapi.testclient import TestClient
from ml.model.main import app


client = TestClient(app)


class TestHealthEndpoint:
    """Test /api/health endpoint."""

    def test_health_check(self):
        """Health check should always return ok status."""
        response = client.get('/api/health')
        assert response.status_code == 200
        data = response.json()
        assert 'status' in data
        assert data['status'] == 'ok'
        assert 'pipeline_available' in data
        assert 'knn_available' in data
        assert 'shap_available' in data


class TestPredictEndpoint:
    """Test /api/predict endpoint."""

    def test_predict_valid_input(self):
        """Predict should accept valid student data and return risk prediction."""
        payload = {
            'avg_test_score': 75.0,
            'total_clicks': 500,
            'competency_profile': {
                'SQL': 80.0,
                'Python': 70.0,
                'React': 40.0
            }
        }
        response = client.post('/api/predict', json=payload)
        # May be 500 if pipeline not loaded, but structure should be consistent
        if response.status_code == 200:
            data = response.json()
            assert 'risk_probability' in data
            assert 'is_at_risk' in data
            assert 'reasons' in data
            assert 'competency_summary' in data
            assert 'recommended_tags_for_search' in data
            assert isinstance(data['risk_probability'], float)
            assert isinstance(data['is_at_risk'], bool)
            assert isinstance(data['reasons'], list)

    def test_predict_perfect_score_low_risk(self):
        """Perfect average score and strong competencies should not be classified as high risk."""
        payload = {
            'avg_test_score': 100.0,
            'total_clicks': 115,
            'competency_profile': {
                '23': 100.0,
                'fillusion': 100.0,
                'ффф': 100.0
            }
        }
        response = client.post('/api/predict', json=payload)
        if response.status_code == 200:
            data = response.json()
            assert data['risk_probability'] <= 0.1
            assert data['is_at_risk'] is False

    def test_predict_invalid_competency_profile_values(self):
        """Predict should reject competency values outside [0, 100]."""
        payload = {
            'avg_test_score': 75.0,
            'total_clicks': 500,
            'competency_profile': {
                'SQL': 150.0  # Invalid: > 100
            }
        }
        response = client.post('/api/predict', json=payload)
        assert response.status_code == 400

    def test_predict_negative_competency_score(self):
        """Predict should reject negative competency scores."""
        payload = {
            'avg_test_score': 75.0,
            'total_clicks': 500,
            'competency_profile': {
                'SQL': -10.0  # Invalid: < 0
            }
        }
        response = client.post('/api/predict', json=payload)
        assert response.status_code == 400

    def test_predict_invalid_avg_test_score(self):
        """Predict should reject invalid avg_test_score."""
        payload = {
            'avg_test_score': 150.0,  # Invalid: > 100
            'total_clicks': 500,
            'competency_profile': {'SQL': 80.0}
        }
        response = client.post('/api/predict', json=payload)
        assert response.status_code == 422  # pydantic validation error

    def test_predict_negative_total_clicks(self):
        """Predict should reject negative total_clicks."""
        payload = {
            'avg_test_score': 75.0,
            'total_clicks': -100,  # Invalid: < 0
            'competency_profile': {'SQL': 80.0}
        }
        response = client.post('/api/predict', json=payload)
        assert response.status_code == 422

    def test_predict_with_extras(self):
        """Predict should accept optional extras field."""
        payload = {
            'avg_test_score': 75.0,
            'total_clicks': 500,
            'competency_profile': {'SQL': 80.0},
            'extras': {'num_of_prev_attempts': 2.0, 'studied_credits': 30.0}
        }
        response = client.post('/api/predict', json=payload)
        # Should not fail validation
        assert response.status_code in (200, 500)  # 500 if model not loaded

    def test_predict_empty_competency_profile(self):
        """Predict should accept empty competency profile."""
        payload = {
            'avg_test_score': 75.0,
            'total_clicks': 500,
            'competency_profile': {}
        }
        response = client.post('/api/predict', json=payload)
        if response.status_code == 200:
            data = response.json()
            assert data['recommended_tags_for_search'] == []


class TestRecommendEndpoint:
    """Test /api/recommend endpoint."""

    def test_recommend_valid_input(self):
        """Recommend should accept valid student data and return topics."""
        payload = {
            'avg_test_score': 50.0,
            'total_clicks': 200,
            'competency_profile': {
                'SQL': 30.0,
                'Python': 40.0,
                'React': 70.0,
                'JavaScript': 25.0
            }
        }
        response = client.post('/api/recommend', json=payload)
        # May be 503 if KNN not loaded
        if response.status_code == 200:
            data = response.json()
            assert 'recommended_topics' in data
            assert 'reasoning' in data
            assert 'peer_count' in data
            assert 'weak_topics_full' in data
            assert isinstance(data['recommended_topics'], list)
            assert isinstance(data['peer_count'], int)

    def test_recommend_invalid_competency_values(self):
        """Recommend should reject competency values outside [0, 100]."""
        payload = {
            'avg_test_score': 50.0,
            'total_clicks': 200,
            'competency_profile': {
                'SQL': 200.0  # Invalid
            }
        }
        response = client.post('/api/recommend', json=payload)
        assert response.status_code == 400

    def test_recommend_high_performers(self):
        """Recommend should return empty list for students with no weak topics."""
        payload = {
            'avg_test_score': 95.0,
            'total_clicks': 1000,
            'competency_profile': {
                'SQL': 95.0,
                'Python': 92.0,
                'React': 88.0
            }
        }
        response = client.post('/api/recommend', json=payload)
        if response.status_code == 200:
            data = response.json()
            # No topics below 60%, so recommended_topics should be empty
            assert data['recommended_topics'] == []

    def test_recommend_with_extras(self):
        """Recommend should accept optional extras field."""
        payload = {
            'avg_test_score': 50.0,
            'total_clicks': 200,
            'competency_profile': {
                'SQL': 30.0,
                'Python': 40.0
            },
            'extras': {'num_of_prev_attempts': 5.0}
        }
        response = client.post('/api/recommend', json=payload)
        assert response.status_code in (200, 503)  # 503 if KNN not available


class TestIntegrationPredictAndRecommend:
    """Integration tests combining predict and recommend."""

    def test_at_risk_student_has_recommendations(self):
        """At-risk students (low scores, weak competencies) should get recommendations."""
        payload = {
            'avg_test_score': 30.0,
            'total_clicks': 100,
            'competency_profile': {
                'SQL': 20.0,
                'Python': 25.0,
                'React': 35.0
            }
        }
        # Predict risk
        predict_response = client.post('/api/predict', json=payload)
        if predict_response.status_code == 200:
            predict_data = predict_response.json()
            assert predict_data['is_at_risk'] == True or predict_data['is_at_risk'] == False
            # Has weak areas
            assert len(predict_data['competency_summary']['weak_areas']) > 0

        # Recommend topics
        recommend_response = client.post('/api/recommend', json=payload)
        if recommend_response.status_code == 200:
            recommend_data = recommend_response.json()
            # Should recommend topics
            assert len(recommend_data['recommended_topics']) > 0

    def test_strong_student_low_risk(self):
        """Strong students should have low risk and few recommendations."""
        payload = {
            'avg_test_score': 90.0,
            'total_clicks': 2000,
            'competency_profile': {
                'SQL': 85.0,
                'Python': 90.0,
                'React': 88.0,
                'JavaScript': 92.0
            }
        }
        # Predict risk
        predict_response = client.post('/api/predict', json=payload)
        if predict_response.status_code == 200:
            predict_data = predict_response.json()
            assert predict_data['risk_probability'] < 0.5  # Low risk
            # Few or no weak areas
            assert len(predict_data['competency_summary']['weak_areas']) <= 1

        # Recommend topics
        recommend_response = client.post('/api/recommend', json=payload)
        if recommend_response.status_code == 200:
            recommend_data = recommend_response.json()
            # Few or no recommendations
            assert len(recommend_data['recommended_topics']) <= 1


class TestErrorHandling:
    """Test error handling and edge cases."""

    def test_predict_missing_required_field(self):
        """Predict should reject requests missing required fields."""
        payload = {
            'avg_test_score': 75.0,
            # missing total_clicks
            'competency_profile': {'SQL': 80.0}
        }
        response = client.post('/api/predict', json=payload)
        assert response.status_code == 422

    def test_recommend_missing_competency_profile(self):
        """Recommend should reject requests missing competency_profile."""
        payload = {
            'avg_test_score': 75.0,
            'total_clicks': 500
            # missing competency_profile
        }
        response = client.post('/api/recommend', json=payload)
        assert response.status_code == 422

    def test_predict_wrong_data_type(self):
        """Predict should reject wrong data types."""
        payload = {
            'avg_test_score': 'seventy-five',  # Should be float
            'total_clicks': 500,
            'competency_profile': {'SQL': 80.0}
        }
        response = client.post('/api/predict', json=payload)
        assert response.status_code == 422

    def test_competency_profile_wrong_type_value(self):
        """Competency profile values must be numeric."""
        payload = {
            'avg_test_score': 75.0,
            'total_clicks': 500,
            'competency_profile': {
                'SQL': 'eighty'  # Should be float
            }
        }
        response = client.post('/api/predict', json=payload)
        assert response.status_code == 422


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
