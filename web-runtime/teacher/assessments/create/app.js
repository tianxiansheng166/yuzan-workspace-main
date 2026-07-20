(() => {
  'use strict';

  const steps = [...document.querySelectorAll(".steps li")];
  const panels = [...document.querySelectorAll(".step-panel")];
  const typeCards = [...document.querySelectorAll(".type-card")];
  const dimensionButtons = [...document.querySelectorAll("#dimensionList button[data-dimension]")];
  const nextBtn = document.querySelector("#nextBtn");
  const previousBtn = document.querySelector("#previousBtn");
  const publishBtn = document.querySelector("#publishBtn");
  const publishMenuBtn = document.querySelector("#publishMenuBtn");
  const publishDropdown = document.querySelector("#publishDropdown");
  const nameInput = document.querySelector("#assessmentName");
  const goalInput = document.querySelector("#assessmentGoal");
  const nameCount = document.querySelector("#nameCount");
  const goalCount = document.querySelector("#goalCount");
  const modalBackdrop = document.querySelector("#modalBackdrop");
  const modalTitle = document.querySelector("#modalTitle");
  const modalText = document.querySelector("#modalText");
  const modalMark = document.querySelector("#modalMark");
  const toast = document.querySelector("#toast");
  const startTime = document.querySelector("#startTime");
  const endTime = document.querySelector("#endTime");
  const autosaveHint = document.querySelector("#autosaveHint");
  let currentStep = 1;
  let materialConfigured = false;
  let toastTimer;

  // 真实数据
  let schoolId = '';
  let classList = [];
  let selectedClassId = '';
  let isPublishing = false;

  function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("show");
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function updateAutosaveHint() {
    if (!autosaveHint) return;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    autosaveHint.innerHTML = '<i>✓</i>草稿已自动保存 ' + hh + ':' + mm;
    autosaveHint.hidden = false;
  }

  function setStep(step) {
    currentStep = Math.max(1, Math.min(4, step));
    steps.forEach((item, index) => {
      const number = index + 1;
      item.classList.toggle("active", number === currentStep);
      item.classList.toggle("done", number < currentStep);
      item.querySelector("span").textContent = number < currentStep ? "✓" : String(number);
    });
    panels.forEach((panel) => panel.classList.toggle("active-panel", Number(panel.dataset.panel) === currentStep));
    previousBtn.disabled = currentStep === 1;
    previousBtn.style.opacity = currentStep === 1 ? ".55" : "1";
    nextBtn.textContent = currentStep === 4 ? "完成配置" : "下一步";
    document.querySelector(".creator-column").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function updateCounts() {
    nameCount.textContent = nameInput.value.length;
    goalCount.textContent = goalInput.value.length;
    const hasNameGoal = Boolean(nameInput.value.trim() && goalInput.value.trim());
    const hasDimensions = dimensionButtons.some((button) => button.classList.contains("selected"));
    const hasTime = Boolean(startTime.value && endTime.value);

    let normal = 1 + Number(hasNameGoal) + Number(hasDimensions) + Number(materialConfigured) + Number(hasTime);
    let risks = Number(!materialConfigured) + Number(!hasTime);

    document.querySelector("#normalCount").textContent = String(normal);
    document.querySelector("#normalHeaderCount").textContent = String(normal);
    document.querySelector("#riskCount").textContent = String(risks);
    document.querySelector("#riskHeaderCount").textContent = String(risks);
    document.querySelector("#materialRisk").classList.toggle("resolved", materialConfigured);
    document.querySelector("#timeRisk").classList.toggle("resolved", hasTime);
  }

  function openModal(type) {
    const data = {
      dimension: ["自定义能力维度", "输入新的能力维度后，可在当前测评中单独启用。此演示会添加"朗读感染力"。", "＋"],
      help: ["如何创建有效测评", "先明确测评目标，再选择可验证的能力维度；材料难度、时间和学生范围应与目标保持一致。", "?"],
      publish: ["发布测评", "发布前仍有风险项未解决。可继续返回配置，或以草稿形式保存。", "!"],
      cancel: ["取消创建", "当前内容已自动保存为草稿，离开后仍可继续编辑。", "×"],
      material: ["选择测评材料", "已为当前页面演示关联《春天的足迹》朗读材料。", "✓"],
      students: ["选择班级与学生", selectedClassId ? `已选择班级，共 ${classList.find(c => c.id === selectedClassId)?.studentCount || '?'} 名学生。` : "请先选择一个班级。", "✓"],
    };
    const [title, text, mark] = data[type] || ["操作详情", "该功能已连接到本地交互演示。", "✓"];
    modalTitle.textContent = title;
    modalText.textContent = text;
    modalMark.textContent = mark;
    modalBackdrop.hidden = false;
    document.body.style.overflow = "hidden";
    modalBackdrop.dataset.type = type;
  }

  function closeModal() {
    modalBackdrop.hidden = true;
    document.body.style.overflow = "";
  }

  async function init() {
    if (!YuzanApi.getToken()) {
      showToast('请先登录');
      location.href = '/login';
      return;
    }
    schoolId = YuzanApi.getActiveSchoolId();
    if (!schoolId) {
      showToast('请先选择学校');
      location.href = '/select-school';
      return;
    }

    // 加载教师的班级列表
    try {
      const result = await YuzanApi.listClasses();
      classList = result.items || result || [];
      if (classList.length > 0) {
        selectedClassId = classList[0].id || '';
      }
    } catch (err) {
      console.warn('[assessment-create] 加载班级失败:', err);
    }
  }

  typeCards.forEach((card) => {
    card.addEventListener("click", () => {
      typeCards.forEach((item) => {
        item.classList.remove("selected");
        item.setAttribute("aria-checked", "false");
        const check = item.querySelector(".selected-check");
        if (check) check.remove();
      });
      card.classList.add("selected");
      card.setAttribute("aria-checked", "true");
      const check = document.createElement("span");
      check.className = "selected-check";
      check.textContent = "✓";
      card.appendChild(check);
      showToast(`已选择${card.dataset.type}`);
      updateCounts();
    });
  });

  dimensionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      button.classList.toggle("selected");
      const icon = button.querySelector("i");
      if (button.classList.contains("selected")) {
        if (!icon) {
          const newIcon = document.createElement("i");
          newIcon.textContent = "✓";
          button.prepend(newIcon);
        }
      } else if (icon) {
        icon.remove();
      }
      updateCounts();
    });
  });

  nameInput.addEventListener("input", updateCounts);
  goalInput.addEventListener("input", updateCounts);
  startTime.addEventListener("change", updateCounts);
  endTime.addEventListener("change", updateCounts);

  nextBtn.addEventListener("click", () => {
    if (currentStep < 4) setStep(currentStep + 1);
    else {
      updateCounts();
      showToast("四步配置已完成，可进行发布前检查");
    }
  });
  previousBtn.addEventListener("click", () => setStep(currentStep - 1));
  steps.forEach((item) => item.addEventListener("click", () => setStep(Number(item.dataset.step))));

  publishBtn.addEventListener("click", () => openModal("publish"));
  publishMenuBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    publishDropdown.hidden = !publishDropdown.hidden;
  });
  document.addEventListener("click", () => {
    publishDropdown.hidden = true;
  });
  publishDropdown.addEventListener("click", (event) => event.stopPropagation());

  document.querySelectorAll("[data-modal]").forEach((button) => {
    button.addEventListener("click", () => openModal(button.dataset.modal));
  });

  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      if (action === "material") {
        materialConfigured = true;
        updateCounts();
        openModal("material");
      }
      if (action === "students") openModal("students");
      if (action === "save") {
        // 草稿保存到本机，不保存到平台
        const draft = {
          type: document.querySelector('.type-card.selected')?.dataset.type || '',
          title: nameInput.value,
          goal: goalInput.value,
          savedAt: Date.now(),
        };
        localStorage.setItem('assessment-draft', JSON.stringify(draft));
        updateAutosaveHint();
        showToast('草稿已保存到本机');
      }
      if (action === "cancel") openModal("cancel");
      if (action === "publish-now") openModal("publish");
      // "schedule" — 按钮已 disabled，此处为兜底
      if (action === "schedule") {
        showToast("定时发布功能暂未开通");
      }
      // "preview" — 不打开弹窗，直接提示
      if (action === "preview") {
        showToast("发布前预览功能暂未开通");
      }
    });
  });

  document.querySelector("#modalClose").addEventListener("click", closeModal);
  document.querySelector("#modalCancel").addEventListener("click", closeModal);
  document.querySelector("#modalConfirm").addEventListener("click", async () => {
    const modalType = modalBackdrop.dataset.type;

    if (modalType === "dimension") {
      const button = document.createElement("button");
      button.className = "selected";
      button.dataset.dimension = "朗读感染力";
      button.innerHTML = "<i>✓</i>朗读感染力";
      document.querySelector("#dimensionList .add-dimension").before(button);
      showToast("已添加自定义维度");
      closeModal();
      updateCounts();
      return;
    }

    if (modalType === "publish") {
      // 真实发布测评
      const selectedType = document.querySelector('.type-card.selected')?.dataset.type || 'READING';
      const title = nameInput.value.trim() || '朗读测评';

      if (!selectedClassId) {
        showToast('请先选择班级');
        closeModal();
        return;
      }

      if (isPublishing) return;
      isPublishing = true;
      publishBtn.disabled = true;
      publishBtn.textContent = '发布中…';
      closeModal();

      try {
        await YuzanApi.createClassAssessment(selectedClassId, {
          type: selectedType,
          title,
          // P0-CONTRACT-CONVERGENCE-001: enrollmentIds/questionIds 省略是契约支持的合法行为。
          // 省略 enrollmentIds → service 取班级全部 ACTIVE 学生；
          // 省略 questionIds → service 从班级最新 assignment 的 courseVersion 解析默认题目。
          // service 端强制非空：无课程/无题目抛 PRACTICE_CONTENT_EMPTY，解析后空抛 ASSESSMENT_HAS_NO_ITEMS，
          // 因此前端不可能创建出 0-item 空测评。
        });
        showToast('测评已发布');
        setTimeout(() => location.href = '/teacher/assessments', 1000);
      } catch (err) {
        publishBtn.disabled = false;
        publishBtn.textContent = '发布测评';
        // 按稳定错误码分支，而非依赖 HTTP 状态码或 message 文案。
        const code = err.code || '';
        if (code === 'PRACTICE_CONTENT_EMPTY') {
          showToast('当前班级未关联课程或课程无题目，请先在课程管理中配置题目');
        } else if (code === 'ASSESSMENT_HAS_NO_ITEMS') {
          showToast('测评必须包含至少一道题目，无法创建空测评');
        } else if (code === 'FORBIDDEN_RESOURCE') {
          showToast('您无权在该班级发布测评');
        } else if (code === 'VALIDATION_FAILED') {
          showToast('参数校验失败：' + (err.message || '请检查输入'));
        } else {
          showToast(err.message || '发布失败，请重试');
        }
      } finally {
        isPublishing = false;
      }
      return;
    }

    // 其他模态类型：按类型分别处理
    if (modalType === "cancel") {
      closeModal();
      location.href = '/teacher/assessments';
      return;
    }
    if (modalType === "preview") {
      closeModal();
      showToast("发布前预览功能暂未开通");
      return;
    }
    // material / students / help — 仅关闭弹窗
    closeModal();
    updateCounts();
  });
  modalBackdrop.addEventListener("click", (event) => {
    if (event.target === modalBackdrop) closeModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modalBackdrop.hidden) closeModal();
  });

  setStep(1);
  updateCounts();
  init();
})();