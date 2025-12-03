// 使用 fetch + Supabase JS 组合的保活实现，支持 GitHub Actions 环境
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("缺少必要的环境变量 SUPABASE_URL / SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function keepAlive() {
  console.log(`[${new Date().toISOString()}] 开始执行保活任务`);
  let successCount = 0;
  const operations: Array<{ method: string; success: boolean; status?: number; error?: string }> = [];

  // 方法1: Auth 健康检查（无需密钥）
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, { method: "GET" });
    if (res.ok) {
      operations.push({ method: "Auth health", success: true, status: res.status });
      successCount++;
    } else {
      operations.push({ method: "Auth health", success: false, status: res.status });
    }
  } catch (e: any) {
    operations.push({ method: "Auth health", success: false, error: String(e) });
  }

  // 方法2: REST 查询（轻量）
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/songs?select=id&limit=1`, {
      method: "GET",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (res.ok) {
      operations.push({ method: "REST select songs", success: true, status: res.status });
      successCount++;
    } else {
      operations.push({ method: "REST select songs", success: false, status: res.status });
    }
  } catch (e: any) {
    operations.push({ method: "REST select songs", success: false, error: String(e) });
  }

  // 方法3: 使用 Supabase JS 进行一次 auth 检查（匿名预期返回缺少会话，视为成功）
  try {
    const { error } = await supabase.auth.getUser();
    if (!error || error.message === "Auth session missing!") {
      operations.push({ method: "Supabase JS auth.getUser", success: true });
      successCount++;
    } else {
      operations.push({ method: "Supabase JS auth.getUser", success: false, error: error.message });
    }
  } catch (e: any) {
    operations.push({ method: "Supabase JS auth.getUser", success: false, error: String(e) });
  }

  console.log(`[${new Date().toISOString()}] 保活任务执行完成`);
  console.log(`成功操作数: ${successCount}/${operations.length}`);
  console.log("操作详情:", JSON.stringify(operations, null, 2));

  if (successCount === 0) {
    console.error("所有保活操作都失败了");
    process.exit(1);
  }
}

keepAlive()
  .then(() => { console.log("保活脚本执行成功"); process.exit(0); })
  .catch((error) => { console.error("保活脚本执行失败:", error); process.exit(1); });
