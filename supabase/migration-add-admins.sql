-- ═══════════════════════════════════════════════════════════
-- Migration: admins 테이블 추가 (역할 계층 도입)
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- ═══════════════════════════════════════════════════════════
-- 구조:
--   root  = 최고 관리자 (전체 권한 + 관리자 생성/삭제)
--   sub   = 서브 관리자 (전체 권한, 단 관리자 관리 불가)
-- 기존 schools.admin_password 는 그대로 유지 (학교 담당자 계정)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS admins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('root', 'sub')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES admins(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username);
CREATE INDEX IF NOT EXISTS idx_admins_role ON admins(role);

-- Row Level Security
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- 앱에서 아이디/비밀번호 검증하므로 anon key로 SELECT/INSERT/UPDATE/DELETE 허용
-- (프로덕션 강화 필요시 Supabase Auth 도입 검토)
CREATE POLICY "Anyone can read admins" ON admins FOR SELECT USING (true);
CREATE POLICY "Anyone can insert admins" ON admins FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update admins" ON admins FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete admins" ON admins FOR DELETE USING (true);

-- Root 초기 계정 삽입은 이 파일에 포함하지 않음
-- (자격증명은 ROOT_CREDENTIALS.md 참조 — gitignore로 저장소 밖에 있음)
