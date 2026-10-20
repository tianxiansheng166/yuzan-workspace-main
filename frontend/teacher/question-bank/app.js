(() => {
  "use strict";

  const api = window.YuzanApi;
  const page = document.getElementById("question-bank-page");
  if (!api || !page) return;

  const form = document.getElementById("qb-form");
  const list = document.getElementById("qb-list");
  const feedback = document.getElementById("qb-feedback");
  const emptyState = document.getElementById("qb-editor-empty");
  const editorTitle = document.getElementById("qb-editor-title");
  const draftStatus = document.getElementById("qb-draft-status");
  const reviewStatus = document.getElementById("qb-review-status");
  const saveStatus = document.getElementById("qb-save-status");
  const count = document.getElementById("qb-count");
  const choiceFields = document.getElementById("qb-choice-fields");
  const textFields = document.getElementById("qb-text-fields");
  const search = document.getElementById("qb-search");
  const state = {
    items: [],
    current: null,
    hasForm: false,
    dirty: false,
    saving: false,
  };

  function value(name) {
    return form.elements.namedItem(name)?.value ?? "";
  }

  function setFeedback(message) {
    feedback.textContent = message;
    feedback.hidden = !message;
  }

  function explainError(error) {
    if (error?.status === 401) return "401｜登录已失效。请重新登录后再继续。";
    if (error?.status === 403) return "403｜当前账号没有本校教师题目管理权限。";
    if (error?.status === 404)
      return "404｜题目不存在或不属于当前教师，请从本人列表重新打开。";
    if (error?.status === 409)
      return "409｜草稿版本已变化或状态不允许编辑。当前输入仍保留，请从本人列表重新打开最新版本。";
    if (error?.status === 400)
      return "400｜题目内容校验未通过，请检查必填字段、选项和答案。";
    return error?.message || "保存请求失败，请检查网络后重试。";
  }

  function dateLabel(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "时间未知";
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function makeListItem(item) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "qb-list-item";
    button.dataset.versionId = item.questionVersionId;
    button.setAttribute(
      "aria-current",
      state.current?.questionVersionId === item.questionVersionId
        ? "true"
        : "false",
    );

    const title = document.createElement("strong");
    title.textContent = item.title || "未命名题目";
    const prompt = document.createElement("p");
    prompt.textContent = item.prompt || "没有题干内容";
    const meta = document.createElement("span");
    meta.className = "qb-list-meta";
    const updated = document.createElement("span");
    updated.textContent = dateLabel(item.updatedAt);
    const status = document.createElement("b");
    status.textContent = item.status;
    meta.append(updated, status);
    button.append(title, prompt, meta);
    button.addEventListener("click", () => {
      void openDraft(item.questionVersionId);
    });
    return button;
  }

  function renderList() {
    list.replaceChildren();
    count.textContent = String(state.items.length);
    const query = search.value.trim().toLocaleLowerCase();
    const visible = state.items.filter((item) =>
      `${item.title ?? ""} ${item.prompt ?? ""}`
        .toLocaleLowerCase()
        .includes(query),
    );
    if (visible.length === 0) {
      const empty = document.createElement("p");
      empty.className = "qb-list-state";
      empty.textContent =
        state.items.length === 0
          ? "还没有本人题目。新建并保存后，草稿会出现在这里。"
          : "没有符合搜索内容的本人题目。";
      list.append(empty);
      return;
    }
    visible.forEach((item) => list.append(makeListItem(item)));
  }

  async function loadDrafts() {
    setFeedback("");
    list.replaceChildren();
    const loading = document.createElement("p");
    loading.className = "qb-list-state";
    loading.textContent = "正在读取本人题目…";
    list.append(loading);
    try {
      const response = await api.listTeacherQuestionBankDrafts();
      state.items = Array.isArray(response?.items) ? response.items : [];
      renderList();
    } catch (error) {
      state.items = [];
      renderList();
      setFeedback(explainError(error));
    }
  }

  function setStatus(item, dirty = false) {
    if (!item) {
      draftStatus.textContent = state.hasForm
        ? dirty
          ? "未保存"
          : "新建草稿"
        : "尚未保存";
      reviewStatus.textContent = "审核：未提交";
      return;
    }
    draftStatus.textContent = item.status;
    reviewStatus.textContent =
      item.status === "DRAFT"
        ? "审核：未提交"
        : item.status === "PUBLISHED"
          ? "审核：已发布"
          : "审核：已退役";
  }

  function updateTypeFields() {
    const isChoice = value("itemType") === "CHOICE";
    choiceFields.hidden = !isChoice;
    textFields.hidden = isChoice;
  }

  function setFormDisabled(disabled) {
    Array.from(form.elements).forEach((element) => {
      element.disabled = disabled;
    });
  }

  function prepareNewDraft() {
    state.current = null;
    state.hasForm = true;
    state.dirty = false;
    form.reset();
    form.elements.namedItem("maxScore").value = "5";
    form.elements.namedItem("itemType").value = "CHOICE";
    form.elements.namedItem("domain").value = "READ";
    form.elements.namedItem("difficulty").value = "EASY";
    form.elements.namedItem("correctOption").value = "A";
    emptyState.hidden = true;
    form.hidden = false;
    setFormDisabled(false);
    editorTitle.textContent = "新建题目草稿";
    saveStatus.textContent = "尚未保存到题库";
    updateTypeFields();
    setStatus(null);
    setFeedback("");
    renderList();
    form.elements.namedItem("title").focus();
  }

  function fillForm(item) {
    form.elements.namedItem("title").value = item.title || "";
    form.elements.namedItem("prompt").value = item.prompt || "";
    form.elements.namedItem("itemType").value = item.itemType;
    form.elements.namedItem("domain").value = item.domain || "READ";
    form.elements.namedItem("difficulty").value = item.difficulty || "EASY";
    form.elements.namedItem("gradeBand").value = item.gradeBand || "";
    form.elements.namedItem("level").value = item.level || "";
    form.elements.namedItem("abilityCategory").value =
      item.abilityCategory || "";
    form.elements.namedItem("maxScore").value = item.maxScore ?? 5;
    form.elements.namedItem("optionA").value = "";
    form.elements.namedItem("optionB").value = "";
    form.elements.namedItem("optionC").value = "";
    form.elements.namedItem("optionD").value = "";
    (item.options || []).forEach((option) => {
      const key = String(option.key || "").toUpperCase();
      if (["A", "B", "C", "D"].includes(key))
        form.elements.namedItem(`option${key}`).value = option.text || "";
    });
    form.elements.namedItem("correctOption").value = item.correctOption || "A";
    form.elements.namedItem("acceptedAnswers").value = (
      item.acceptedAnswers || []
    ).join("\n");
    updateTypeFields();
  }

  async function openDraft(versionId) {
    if (
      state.dirty &&
      !window.confirm(
        "当前题目有未保存修改。确定放弃这些修改并重新打开服务器上的草稿吗？",
      )
    )
      return;
    setFeedback("");
    state.current = null;
    state.hasForm = false;
    state.dirty = false;
    form.hidden = true;
    emptyState.hidden = false;
    editorTitle.textContent = "正在重新打开草稿";
    saveStatus.textContent = "正在重新打开草稿…";
    setStatus(null);
    renderList();
    try {
      const item = await api.getTeacherQuestionBankDraft(versionId);
      state.current = item;
      state.hasForm = true;
      state.dirty = false;
      fillForm(item);
      emptyState.hidden = true;
      form.hidden = false;
      const editable = item.status === "DRAFT";
      setFormDisabled(!editable);
      editorTitle.textContent = item.title || "题目草稿";
      saveStatus.textContent = editable
        ? `已从服务器重新打开 · revision ${item.revision}`
        : "该版本为只读状态";
      setStatus(item);
      renderList();
    } catch (error) {
      saveStatus.textContent = "草稿未能打开";
      setFeedback(explainError(error));
    }
  }

  function collectPayload() {
    const payload = {
      title: value("title").trim(),
      prompt: value("prompt").trim(),
      itemType: value("itemType"),
      domain: value("domain"),
      difficulty: value("difficulty"),
      gradeBand: value("gradeBand").trim(),
      level: value("level").trim(),
      abilityCategory: value("abilityCategory").trim(),
      maxScore: Number(value("maxScore")),
    };
    if (payload.itemType === "CHOICE") {
      payload.options = ["A", "B", "C", "D"]
        .map((key) => ({ key, text: value(`option${key}`).trim() }))
        .filter((option) => option.text);
      payload.correctOption = value("correctOption");
      if (
        payload.options.length < 2 ||
        !payload.options.some((option) => option.key === payload.correctOption)
      ) {
        throw new Error(
          "选择题至少填写两个选项，并将正确选项设为已填写的选项。",
        );
      }
    } else {
      payload.acceptedAnswers = value("acceptedAnswers")
        .split(/\r?\n/)
        .map((answer) => answer.trim())
        .filter(Boolean);
      if (payload.acceptedAnswers.length === 0)
        throw new Error("文字作答题至少填写一个标准答案。");
    }
    return payload;
  }

  async function saveDraft(event) {
    event.preventDefault();
    if (state.saving) return;
    setFeedback("");
    let payload;
    try {
      payload = collectPayload();
    } catch (error) {
      setFeedback(error.message);
      return;
    }
    state.saving = true;
    const saveButton = form.querySelector(".qb-save");
    saveButton.disabled = true;
    saveStatus.textContent = "正在保存到题库…";
    try {
      const saved = state.current
        ? await api.updateTeacherQuestionBankDraft(
            state.current.questionVersionId,
            { ...payload, expectedRevision: state.current.revision },
          )
        : await api.createTeacherQuestionBankDraft(payload);
      state.current = saved;
      state.hasForm = true;
      state.dirty = false;
      editorTitle.textContent = saved.title;
      saveStatus.textContent = `已保存到题库 · revision ${saved.revision}`;
      setStatus(saved);
      await loadDrafts();
      setFeedback("");
    } catch (error) {
      saveStatus.textContent = error?.status === 409 ? "保存冲突" : "保存失败";
      setFeedback(explainError(error));
    } finally {
      state.saving = false;
      saveButton.disabled = Boolean(
        state.current && state.current.status !== "DRAFT",
      );
    }
  }

  page
    .querySelectorAll("[data-new-draft]")
    .forEach((button) => button.addEventListener("click", prepareNewDraft));
  page.querySelector("[data-refresh]")?.addEventListener("click", () => {
    void loadDrafts();
  });
  form.addEventListener("submit", (event) => {
    void saveDraft(event);
  });
  function markDirty() {
    if (!state.hasForm || state.saving) return;
    state.dirty = true;
    saveStatus.textContent = state.current
      ? `有未保存修改 · 当前 revision ${state.current.revision}`
      : "新题目尚未保存";
    setStatus(state.current, true);
    if (state.current?.status === "DRAFT")
      editorTitle.textContent = value("title").trim() || "未命名草稿";
  }

  form.addEventListener("input", markDirty);
  form.addEventListener("change", markDirty);
  form.elements
    .namedItem("itemType")
    .addEventListener("change", updateTypeFields);
  search.addEventListener("input", renderList);

  void loadDrafts();
})();
