export type AnswerOption = {
  answer_option_id: number;
  option_text: string;
  is_correct: boolean;
  order_number: number | null;
};

export type Question = {
  question_id: number;
  question_text: string;
  question_type: 'single' | 'multiple' | 'text';
  points: number;
  order_number: number | null;
  created_at: string;
  updated_at: string;
  options: AnswerOption[];
};

export type Test = {
  test_id: number;
  test_title: string;
  subject_id: number | null;
  time_limit_minutes: number | null;
  passing_score: number | null;
  deadline: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  questions: Question[];
};

export type Chapter = {
  id: number | null;
  name: string | null;
  test: Test;
};

export type Row = {
  test_id: number;
  test_title: string;
  subject_id: number | null;
  time_limit_minutes: number | null;
  passing_score: number | null;
  deadline: string;
  test_is_active: 0 | 1;
  test_created_at: string;
  test_updated_at: string;
  chapter_id: number | null;
  chapter_name: string | null;
  question_id: number | null;
  question_text: string | null;
  question_type: 'single' | 'multiple' | 'text' | null;
  question_points: number | null;
  question_order: number | null;
  question_created_at: string | null;
  question_updated_at: string | null;
  answer_option_id: number | null;
  option_text: string | null;
  option_is_correct: 0 | 1 | null;
  option_order: number | null;
};
