-- ═══════════════════════════════════════════════════════════
-- Swim Trainer - Supabase 스키마
-- ═══════════════════════════════════════════════════════════

-- 학교 테이블
CREATE TABLE schools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  admin_password TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 학습 데이터 테이블
CREATE TABLE training_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  motion_id TEXT NOT NULL,
  step_index INTEGER NOT NULL,
  features JSONB NOT NULL,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 (조회 성능 향상)
CREATE INDEX idx_training_motion ON training_data(motion_id);
CREATE INDEX idx_training_school ON training_data(school_id);

-- RLS 정책 (Row Level Security)
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_data ENABLE ROW LEVEL SECURITY;

-- 읽기: 모든 사용자 허용
CREATE POLICY "Anyone can read schools" ON schools FOR SELECT USING (true);
CREATE POLICY "Anyone can read training_data" ON training_data FOR SELECT USING (true);

-- 쓰기: 모든 사용자 허용 (앱에서 비밀번호 검증)
CREATE POLICY "Anyone can insert schools" ON schools FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert training_data" ON training_data FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete training_data" ON training_data FOR DELETE USING (true);

-- 기본 학교 (기본 학습 데이터용)
INSERT INTO schools (id, name, admin_password)
VALUES ('00000000-0000-0000-0000-000000000000', '기본', 'admin1234');
