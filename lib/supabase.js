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

// 관리자 비밀번호 확인
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
// 학습 데이터 관련 함수
// ═══════════════════════════════════════════════════════════

// 학습 데이터 조회 (기본 + 특정 학교)
export async function getTrainingData(schoolId = null) {
  let query = supabase
    .from("training_data")
    .select("*")
    .order("created_at", { ascending: true });

  if (schoolId) {
    // 기본 데이터 + 해당 학교 데이터
    query = query.or(`school_id.eq.${DEFAULT_SCHOOL_ID},school_id.eq.${schoolId}`);
  } else {
    // 기본 데이터만
    query = query.eq("school_id", DEFAULT_SCHOOL_ID);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// 특정 동작의 학습 데이터 조회
export async function getTrainingDataByMotion(motionId, schoolId = null) {
  let query = supabase
    .from("training_data")
    .select("*")
    .eq("motion_id", motionId)
    .order("step_index", { ascending: true });

  if (schoolId) {
    query = query.or(`school_id.eq.${DEFAULT_SCHOOL_ID},school_id.eq.${schoolId}`);
  } else {
    query = query.eq("school_id", DEFAULT_SCHOOL_ID);
  }

  const { data, error } = await query;
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
