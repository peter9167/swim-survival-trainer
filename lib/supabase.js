import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ekpqrpmborzgzdgrgtba.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrcHFycG1ib3J6Z3pkZ3JndGJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNzc3NzEsImV4cCI6MjA4Nzc1Mzc3MX0.KcG2FVJ67k_NuOfipGJ0z1unEn--2UVHToUVqecKFQE";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 기본 학교 ID (개발자가 관리하는 기본 학습 데이터)
export const DEFAULT_SCHOOL_ID = "00000000-0000-0000-0000-000000000000";

// ═══════════════════════════════════════════════════════════
// 학교 관련 함수
// ═══════════════════════════════════════════════════════════

// 모든 학교 목록 조회
export async function getSchools() {
  const { data, error } = await supabase
    .from("schools")
    .select("id, name, created_at")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

// 학교 생성
export async function createSchool(name, adminPassword) {
  const { data, error } = await supabase
    .from("schools")
    .insert({ name, admin_password: adminPassword })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * 학교 목록 (비밀번호 포함) — root/sub-admin 전용
 * getSchools()는 password 미포함, 이건 관리 화면 전용
 */
export async function listSchoolsWithSecrets() {
  const { data, error } = await supabase
    .from("schools")
    .select("id, name, admin_password, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

/**
 * 학교 삭제 — 학습 데이터도 CASCADE로 함께 삭제됨
 * 기본 학교(DEFAULT_SCHOOL_ID)는 삭제 불가
 */
export async function deleteSchool(schoolId) {
  if (schoolId === DEFAULT_SCHOOL_ID) {
    throw new Error("기본 학교는 삭제할 수 없습니다");
  }
  const { error } = await supabase.from("schools").delete().eq("id", schoolId);
  if (error) throw error;
}

/**
 * 학교 관리자 비밀번호 변경
 */
export async function updateSchoolPassword(schoolId, newPassword) {
  if (!newPassword || newPassword.length < 4) {
    throw new Error("비밀번호는 4자 이상이어야 합니다");
  }
  const { error } = await supabase
    .from("schools")
    .update({ admin_password: newPassword })
    .eq("id", schoolId);
  if (error) throw error;
}

// 학교 관리자 비밀번호 확인 (기존 학교별 계정)
export async function verifyAdminPassword(schoolId, password) {
  const { data, error } = await supabase
    .from("schools")
    .select("admin_password")
    .eq("id", schoolId)
    .single();

  if (error) throw error;
  return data.admin_password === password;
}

// ═══════════════════════════════════════════════════════════
// 시스템 관리자 (root / sub) 관련 함수
// ═══════════════════════════════════════════════════════════

/**
 * 시스템 관리자 로그인 (username/password)
 * 성공시 admin 객체 반환, 실패시 null
 */
export async function loginAdmin(username, password) {
  const { data, error } = await supabase
    .from("admins")
    .select("id, username, password, role, created_at")
    .eq("username", username)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  if (data.password !== password) return null;

  return { id: data.id, username: data.username, role: data.role, created_at: data.created_at };
}

/**
 * 통합 로그인 — 아이디로 admins 먼저 조회, 없으면 학교명(schools.name)으로 조회
 * 반환 타입:
 *   {kind: "admin", admin: {...}}        — root/sub 로그인 성공
 *   {kind: "school", school: {id, name}} — 학교 관리자 로그인 성공
 *   null                                  — 실패
 */
export async function unifiedLogin(identifier, password) {
  if (!identifier || !password) return null;
  const id = identifier.trim();

  // 1) admins 테이블 시도
  const { data: adminRow, error: adminErr } = await supabase
    .from("admins")
    .select("id, username, password, role, created_at")
    .eq("username", id)
    .maybeSingle();

  if (adminErr) throw adminErr;
  if (adminRow && adminRow.password === password) {
    return {
      kind: "admin",
      admin: {
        id: adminRow.id,
        username: adminRow.username,
        role: adminRow.role,
        created_at: adminRow.created_at,
      },
    };
  }

  // 2) schools 테이블에서 학교명으로 시도
  const { data: schoolRow, error: schoolErr } = await supabase
    .from("schools")
    .select("id, name, admin_password")
    .eq("name", id)
    .maybeSingle();

  if (schoolErr) throw schoolErr;
  if (schoolRow && schoolRow.admin_password === password) {
    return {
      kind: "school",
      school: { id: schoolRow.id, name: schoolRow.name },
    };
  }

  return null;
}

/**
 * 모든 관리자 조회 — password 포함 (root 전용, UI에서 root일 때만 호출)
 */
export async function listAdmins() {
  const { data, error } = await supabase
    .from("admins")
    .select("id, username, password, role, created_at, created_by")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * 서브 관리자 생성 (root 전용)
 * @param username 아이디
 * @param password 비밀번호 (평문 저장 — root가 열람 가능)
 * @param createdBy 생성자 admin id
 */
export async function createSubAdmin(username, password, createdBy) {
  if (!username || !password) throw new Error("아이디와 비밀번호를 입력하세요");
  if (username.length < 3) throw new Error("아이디는 3자 이상이어야 합니다");
  if (password.length < 6) throw new Error("비밀번호는 6자 이상이어야 합니다");

  const { data, error } = await supabase
    .from("admins")
    .insert({
      username: username.trim(),
      password,
      role: "sub",
      created_by: createdBy,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") throw new Error("이미 존재하는 아이디입니다");
    throw error;
  }
  return data;
}

/**
 * 관리자 삭제 (root 전용, root 자신은 삭제 불가)
 */
export async function deleteAdmin(adminId) {
  // root 삭제 방지
  const { data: target, error: readErr } = await supabase
    .from("admins")
    .select("role")
    .eq("id", adminId)
    .single();
  if (readErr) throw readErr;
  if (target.role === "root") throw new Error("root 계정은 삭제할 수 없습니다");

  const { error } = await supabase.from("admins").delete().eq("id", adminId);
  if (error) throw error;
}

/**
 * 관리자 비밀번호 변경 (root 전용, 또는 본인)
 */
export async function updateAdminPassword(adminId, newPassword) {
  if (!newPassword || newPassword.length < 6) {
    throw new Error("비밀번호는 6자 이상이어야 합니다");
  }
  const { error } = await supabase
    .from("admins")
    .update({ password: newPassword })
    .eq("id", adminId);
  if (error) throw error;
}

// ═══════════════════════════════════════════════════════════
// 학습 데이터 관련 함수
// ═══════════════════════════════════════════════════════════

// 학습 데이터 조회 — 학교별 완전 격리
// schoolId 지정시 그 학교만, null이면 DEFAULT(root)만. 절대 섞지 않음.
export async function getTrainingData(schoolId = null) {
  const targetSchoolId = schoolId || DEFAULT_SCHOOL_ID;
  const { data, error } = await supabase
    .from("training_data")
    .select("*")
    .eq("school_id", targetSchoolId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

// 특정 동작의 학습 데이터 조회 — 학교별 완전 격리
export async function getTrainingDataByMotion(motionId, schoolId = null) {
  const targetSchoolId = schoolId || DEFAULT_SCHOOL_ID;
  const { data, error } = await supabase
    .from("training_data")
    .select("*")
    .eq("motion_id", motionId)
    .eq("school_id", targetSchoolId)
    .order("step_index", { ascending: true });
  if (error) throw error;
  return data;
}

// 학습 데이터 저장
export async function saveTrainingData(motionId, stepIndex, features, schoolId) {
  const { data, error } = await supabase
    .from("training_data")
    .insert({
      motion_id: motionId,
      step_index: stepIndex,
      features: features,
      school_id: schoolId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// 특정 학교의 특정 동작 학습 데이터 삭제
export async function deleteTrainingData(motionId, schoolId) {
  const { error } = await supabase
    .from("training_data")
    .delete()
    .eq("motion_id", motionId)
    .eq("school_id", schoolId);

  if (error) throw error;
}

// 특정 학교의 모든 학습 데이터 삭제
export async function deleteAllTrainingDataBySchool(schoolId) {
  const { error } = await supabase
    .from("training_data")
    .delete()
    .eq("school_id", schoolId);

  if (error) throw error;
}

// 학습 데이터 통계 조회
export async function getTrainingStats(schoolId = null) {
  const data = await getTrainingData(schoolId);

  const stats = {};
  for (const item of data) {
    const key = `${item.motion_id}_${item.step_index}`;
    if (!stats[key]) {
      stats[key] = { motionId: item.motion_id, stepIndex: item.step_index, count: 0 };
    }
    stats[key].count++;
  }

  return Object.values(stats);
}
