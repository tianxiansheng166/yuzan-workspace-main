// 夜间执行：创建测试测评 session
// 用法：node docs/night-run/setup-session.mjs
// 输出：sessionId（用于后续浏览器测试）

const API = 'http://127.0.0.1:4000/api/v1';

async function main() {
  // 1. 管理员登录（canUpdateClass 仅允许 SCHOOL_ADMIN/PLATFORM_ADMIN）
  const loginResp = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin.test', password: 'YuzanTest!2026' }),
  });
  if (!loginResp.ok) throw new Error(`管理员登录失败: ${loginResp.status}`);
  const loginData = await loginResp.json();
  const teacherToken = loginData.data?.accessToken || loginData.accessToken;
  const teacherHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` };
  console.log('[ok] 管理员登录成功');

  // 2. 获取 /me 拿到 schoolId
  const meResp = await fetch(`${API}/me`, { headers: teacherHeaders });
  const meData = await meResp.json();
  const memberships = meData.data?.memberships || meData.memberships || [];
  const teacherMbr = memberships.find((m) => m.role === 'SCHOOL_ADMIN') || memberships[0];
  const schoolId = teacherMbr?.schoolId || meData.data?.activeSchoolId;
  console.log('[ok] schoolId =', schoolId);

  // 3. 切换到该 school（如有 /auth/select-school 端点）
  // 注意：select-school 会返回新的 accessToken，旧 token 会失效
  try {
    const selResp = await fetch(`${API}/auth/select-school`, {
      method: 'POST',
      headers: teacherHeaders,
      body: JSON.stringify({ schoolId }),
    });
    console.log('[ok] select-school:', selResp.status);
    if (selResp.ok) {
      const selData = await selResp.json();
      const newToken = selData.data?.accessToken;
      if (newToken) {
        teacherHeaders.Authorization = `Bearer ${newToken}`;
        console.log('[ok] 更新 teacher token');
      }
    }
  } catch (e) {
    console.log('[warn] select-school 跳过:', e.message);
  }

  // 4. 列出班级
  const classesResp = await fetch(`${API}/schools/${schoolId}/classes`, { headers: teacherHeaders });
  const classesData = await classesResp.json();
  const classes = classesData.data?.items || classesData.items || classesData.data || [];
  const classItem = classes.find((c) => c.name?.includes('真实流程')) || classes[0];
  if (!classItem) throw new Error('未找到班级');
  const classId = classItem.id;
  console.log('[ok] classId =', classId, `(${classItem.name})`);

  // 5. 列出学生 enrollment
  const enrollsResp = await fetch(`${API}/schools/${schoolId}/classes/${classId}/enrollments`, { headers: teacherHeaders });
  const enrollsData = await enrollsResp.json();
  const enrolls = enrollsData.data?.items || enrollsData.items || enrollsData.data || [];
  const studentEnroll = enrolls.find((e) => e.role === 'STUDENT') || enrolls[0];
  if (!studentEnroll) throw new Error('未找到学生 enrollment');
  const studentEnrollmentId = studentEnroll.id;
  console.log('[ok] studentEnrollmentId =', studentEnrollmentId);

  // 6. 查找 Question（朗读题）
  let questionIds = [];
  try {
    const cvResp = await fetch(`${API}/schools/${schoolId}/course-versions`, { headers: teacherHeaders });
    const cvData = await cvResp.json();
    const cvs = cvData.data?.items || cvData.items || cvData.data || [];
    if (cvs.length > 0) {
      const cvId = cvs[0].id;
      const cvDetailResp = await fetch(`${API}/schools/${schoolId}/course-versions/${cvId}`, { headers: teacherHeaders });
      const cvDetail = await cvDetailResp.json();
      const activities = cvDetail.data?.activities || cvDetail.activities || [];
      for (const act of activities) {
        if (act.questions?.length) {
          for (const q of act.questions) {
            questionIds.push(q.id);
          }
        }
      }
      console.log(`[ok] 通过 course-version 找到 ${questionIds.length} 个题目`);
    }
  } catch (e) {
    console.log('[warn] 查找题目失败:', e.message);
  }

  // 7. 创建测评 session（用 classes/:classId/assessments）
  // DTO 要求：type ∈ {READING, WRITTEN, MIXED}，enrollmentIds 必填，questionIds 可选
  const createResp = await fetch(`${API}/schools/${schoolId}/classes/${classId}/assessments`, {
    method: 'POST',
    headers: teacherHeaders,
    body: JSON.stringify({
      type: 'MIXED',
      title: '夜间执行验证测评',
      enrollmentIds: [studentEnrollmentId],
      ...(questionIds.length ? { questionIds: questionIds.slice(0, 4) } : {}),
    }),
  });
  const createText = await createResp.text();
  console.log('[dbg] create status =', createResp.status, 'body =', createText.slice(0, 400));
  if (!createResp.ok) throw new Error(`创建测评失败: ${createResp.status}`);

  const createData = JSON.parse(createText);
  const sessions = createData.data?.sessions || createData.sessions || createData.data || [];
  if (!Array.isArray(sessions) || sessions.length === 0) throw new Error('未返回 session 列表');
  const sessionId = sessions[0].id;
  console.log('[ok] sessionId =', sessionId);

  // 8. 学生登录
  const sLoginResp = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'student.test', password: 'YuzanTest!2026' }),
  });
  const sLoginData = await sLoginResp.json();
  const studentToken = sLoginData.data?.accessToken || sLoginData.accessToken;
  const studentHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` };

  // 9. 学生 select-school
  try {
    const sSelResp = await fetch(`${API}/auth/select-school`, {
      method: 'POST',
      headers: studentHeaders,
      body: JSON.stringify({ schoolId }),
    });
    if (sSelResp.ok) {
      const sSelData = await sSelResp.json();
      const newSToken = sSelData.data?.accessToken;
      if (newSToken) {
        studentHeaders.Authorization = `Bearer ${newSToken}`;
      }
    }
  } catch {}

  // 10. 学生查看 session 详情和 items
  const sResp = await fetch(`${API}/schools/${schoolId}/assessments/sessions/${sessionId}`, { headers: studentHeaders });
  console.log('[ok] student get session:', sResp.status);
  const sData = await sResp.json();
  console.log('[dbg] session status =', sData.data?.status || sData.status);

  const itemsResp = await fetch(`${API}/schools/${schoolId}/assessments/sessions/${sessionId}/items`, { headers: studentHeaders });
  console.log('[ok] list items:', itemsResp.status);
  const itemsData = await itemsResp.json();
  const items = itemsData.data || itemsData.items || itemsData || [];
  console.log('[dbg] items count =', Array.isArray(items) ? items.length : Object.keys(items).length);
  if (Array.isArray(items)) {
    for (const it of items) {
      console.log(`  - itemType=${it.itemType} id=${it.id} status=${it.status}`);
    }
  }

  // 11. 输出关键信息给后续浏览器测试使用
  console.log('\n=== OUTPUT FOR BROWSER TEST ===');
  console.log(JSON.stringify({
    schoolId,
    classId,
    studentEnrollmentId,
    sessionId,
    studentToken,
    studentLogin: 'student.test',
    studentPassword: 'YuzanTest!2026',
    items: Array.isArray(items) ? items.map((i) => ({ id: i.id, itemType: i.itemType })) : [],
  }, null, 2));
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});