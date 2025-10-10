export type AnswerOption = {
  id: number;
  question_id: number;
  option_text: string;
  is_correct: boolean;
  order_number: number | null;
};

export type Question = {
  id: number;
  test_id: number;
  question_text: string;
  question_type: 'single' | 'multiple' | 'text';
  points: number;
  order_number: number | null;
  created_at: string;
  updated_at: string;
  answer_options: AnswerOption[];
};

export type Chapter = {
  id: number;
  subject_id: number;
  name: string;
  order_number: number | null;
};

export type Test = {
  id: number;
  title: string;
  subject_id: number;
  time_limit_minutes: number | null;
  passing_score: number | null;
  deadline: string;
  order_number: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  chapters: Chapter[];
  questions: Question[];
};

export type Row = {
  test_id: number;
  test_title: string;
  subject_id: number;
  time_limit_minutes: number | null;
  passing_score: number | null;
  deadline: string;
  test_order: number | null;
  test_is_active: 0 | 1;
  test_created_at: string;
  test_updated_at: string;

  chapter_id: number | null;
  chapter_name: string | null;
  chapter_order: number | null;

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
