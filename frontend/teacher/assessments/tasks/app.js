(() => {
  const searchInput = document.querySelector("#searchInput");
  const typeFilter = document.querySelector("#typeFilter");
  const scopeFilter = document.querySelector("#scopeFilter");
  const classFilter = document.querySelector("#classFilter");
  const statusFilter = document.querySelector("#statusFilter");
  const startDate = document.querySelector("#startDate");
  const endDate = document.querySelector("#endDate");
  const resetBtn = document.querySelector("#resetBtn");
  const rows = [...document.querySelectorAll(".task-row")];
  const groups = [...document.querySelectorAll(".task-group")];
  const emptyState = document.querySelector("#emptyState");
  const modalBackdrop = document.querySelector("#modalBackdrop");
  const modalTitle = document.querySelector("#modalTitle");
  const modalText = document.querySelector("#modalText");
  const modalMark = document.querySelector("#modalMark");
  const floatingMenu = document.querySelector("#floatingMenu");
  const toast = document.querySelector("#toast");
  let toastTimer;

  function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("show");
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  // ── LIVE_LOCAL: 筛选逻辑 ──
  function applyFilters() {
    const query = searchInput.value.trim().toLowerCase();
    const selectedType = typeFilter.value;
    const selectedScope = scopeFilter.value;
    const selectedClass = classFilter.value;
    const selectedStatus = statusFilter.value;
    let totalVisible = 0;

    rows.forEach((row) => {
      const matchesText = row.dataset.name.toLowerCase().includes(query);
      const matchesType = selectedType === "all" || row.dataset.type === selectedType;
      const matchesScope = selectedScope === "all" || row.dataset.scope === selectedScope;
      const matchesClass = selectedClass === "all" || row.dataset.class === selectedClass;
      const matchesStatus = selectedStatus === "all" || row.dataset.status === selectedStatus;
      row.hidden = !(matchesText && matchesType && matchesScope && matchesClass && matchesStatus);
      if (!row.hidden) totalVisible += 1;
    });

    groups.forEach((group) => {
      if (group.classList.contains("compact-group")) {
        group.hidden = selectedStatus !== "all" && group.dataset.group !== selectedStatus;
      } else {
        const visibleRows = [...group.querySelectorAll(".task-row")].filter((row) => !row.hidden);
        group.hidden = visibleRows.length === 0;
      }
    });

    emptyState.hidden = totalVisible !== 0 || selectedStatus === "all";
  }

  function openModal(type) {
    const content = {
      cancel: ["取消测评任务", "当前版本不支持取消测评任务，后端尚未实现取消接口。已提交的记录会被保留。", "!"],
    };
    const [title, text, mark] = content[type] || ["操作详情", "该功能暂未接入后端。", "✓"];
    modalTitle.textContent = title;
    modalText.textContent = text;
    modalMark.textContent = mark;
    modalBackdrop.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    modalBackdrop.hidden = true;
    document.body.style.overflow = "";
  }

  // ── LIVE_LOCAL: 筛选控件 ──
  [searchInput, typeFilter, scopeFilter, classFilter, statusFilter].forEach((control) => {
    control.addEventListener(control.tagName === "INPUT" ? "input" : "change", applyFilters);
  });

  resetBtn.addEventListener("click", () => {
    searchInput.value = "";
    typeFilter.value = "all";
    scopeFilter.value = "all";
    classFilter.value = "all";
    statusFilter.value = "all";
    startDate.value = "";
    endDate.value = "";
    applyFilters();
    showToast("筛选条件已重置");
  });

  // ── LIVE_LOCAL: 分组展开/折叠 ──
  document.querySelectorAll(".group-heading").forEach((heading) => {
    heading.addEventListener("click", () => {
      const group = heading.closest(".task-group");
      group.classList.toggle("collapsed");
      group.classList.toggle("expanded");
      const expanded = group.classList.contains("expanded");
      heading.setAttribute("aria-expanded", String(expanded));
      const chevron = heading.querySelector(".chevron, .compact-chevron");
      if (chevron) chevron.textContent = expanded ? "⌄" : "›";
    });
  });

  // ── LIVE_ROUTE: 路由跳转按钮（创建测评、查看分析、查看报告）──
  document.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => {
      location.href = button.dataset.route;
    });
  });

  // ── UNSUPPORTED: 禁用按钮提示 ──
  document.querySelectorAll("[data-unsupported]").forEach((button) => {
    button.style.opacity = ".55";
    button.style.cursor = "not-allowed";
    button.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const type = button.dataset.unsupported;
      const messages = {
        cancel: "当前版本不支持取消测评任务",
        "copy-task": "复制任务功能暂未开通，请联系管理员",
        export: "导出功能暂未开通，请联系管理员",
        qr: "二维码功能暂未开通",
        disable: "停用任务功能暂未开通",
      };
      showToast(messages[type] || "该功能暂未开通");
    });
  });

  // ── LIVE_LOCAL: 复制链接（使用真实URL） ──
  document.querySelectorAll("[data-action='copy-link']").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(location.href);
      } catch (_) {}
      showToast("当前页面链接已复制");
      floatingMenu.hidden = true;
    });
  });

  // ── LIVE_LOCAL: 更多菜单（浮动菜单开关） ──
  document.querySelectorAll("[data-menu]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const rect = button.getBoundingClientRect();
      floatingMenu.style.left = `${Math.min(rect.left - 100, window.innerWidth - 160)}px`;
      floatingMenu.style.top = `${rect.bottom + 6}px`;
      floatingMenu.hidden = false;
    });
  });

  document.addEventListener("click", (event) => {
    if (!floatingMenu.contains(event.target)) floatingMenu.hidden = true;
  });

  // ── LIVE_LOCAL: Modal 控件 ──
  // 保留 data-modal 仅用于可能仍存在的模态框触发（如 UNSUPPORTED 的 cancel）
  document.querySelectorAll("[data-modal]").forEach((button) => {
    button.addEventListener("click", () => openModal(button.dataset.modal));
  });

  document.querySelector("#modalClose").addEventListener("click", closeModal);
  document.querySelector("#modalCancel").addEventListener("click", closeModal);
  document.querySelector("#modalConfirm").addEventListener("click", () => {
    closeModal();
    showToast("操作已确认");
  });
  modalBackdrop.addEventListener("click", (event) => {
    if (event.target === modalBackdrop) closeModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modalBackdrop.hidden) closeModal();
  });

  // ── LIVE_LOCAL: 公益与支持链接（UNSUPPORTED） ──
  const supportLink = document.querySelector(".support-link[data-unsupported]");
  if (supportLink) {
    supportLink.addEventListener("click", (e) => {
      e.preventDefault();
      showToast("公益与支持页面暂未开通");
    });
  }

  applyFilters();
})();
