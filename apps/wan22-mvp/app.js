/**
 * WAN22 OS MVP - Contract Module
 * State management, views, and business logic
 */

class ContractApp {
  constructor() {
    this.state = {
      contracts: [],
      projects: [],
      tasks: [],
      costs: [],
      people: [],
      costItems: [],
      billingCycles: [],
      costTypes: [],
      ui: {
        currentView: 'contracts',
        expandedContracts: {},
        taskFilter: { projectId: null, serviceId: null },
        projectFilter: { contractId: null },
        expandedContractProjects: {},
        expandedProjects: {},
        expandedProjectContracts: {},
        expandedTaskProjects: {},
        costTypeFilter: '',
        contractDialog: { isOpen: false, mode: 'add', data: null },
        servicesDialog: { isOpen: false, contractId: null },
        paymentPlanDialog: { isOpen: false, contractId: null, draft: null },
        projectDialog: { isOpen: false, mode: 'add', data: null },
        taskDialog: { isOpen: false, mode: 'add', data: null },
        taskCostsDialog: { isOpen: false, taskId: null },
        projectFinancialsDialog: { isOpen: false, projectId: null },
        costDialog: { isOpen: false, mode: 'add', data: null },
        peopleDialog: { isOpen: false, mode: 'add', data: null },
        personRolesDialog: { isOpen: false, personId: null, editingRoleId: null },
        costItemDialog: { isOpen: false, mode: 'add', data: null },
        costItemTiersDialog: { isOpen: false, costItemId: null, editingTierId: null },
        confirmDialog: { isOpen: false, action: null, data: null }
      }
    };
    this.loadState();
  }

  /**
   * Load state from server or localStorage
   */
  loadState() {
    const defaultUI = this.state.ui;

    // Try to load from server endpoint
    fetch('/api/state')
      .then(res => res.json())
      .then(data => {
        this.state = { ...this.state, ...data, ui: { ...defaultUI, ...(data.ui || {}) } };
        this.ensureServiceIds();
        this.ensurePersonRoles();
        this.render();
      })
      .catch(() => {
        // Fallback to localStorage
        const saved = localStorage.getItem('wan22-state');
        if (saved) {
          const parsed = JSON.parse(saved);
          this.state = { ...this.state, ...parsed, ui: { ...defaultUI, ...(parsed.ui || {}) } };
        }
        this.ensureServiceIds();
        this.ensurePersonRoles();
        this.render();
      });
  }

  ensureServiceIds() {
    let changed = false;
    this.state.contracts.forEach(contract => {
      (contract.services || []).forEach(service => {
        if (!service.id) {
          service.id = `svc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          changed = true;
        }
      });
    });
    if (changed) this.saveState();
  }

  ensurePersonRoles() {
    let changed = false;
    this.state.people.forEach(person => {
      if (!person.roles) {
        person.roles = [{
          id: `role_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          position: person.position || '',
          responsibility: person.responsibility || '',
          rateType: person.rateType || 'monthly',
          rateValue: person.rateValue || 0
        }];
        delete person.position;
        delete person.responsibility;
        delete person.rateType;
        delete person.rateValue;
        changed = true;
      }
      person.roles.forEach(role => {
        if (!role.id) {
          role.id = `role_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          changed = true;
        }
      });
    });
    if (changed) this.saveState();
  }

  /**
   * Save state to server or localStorage
   */
  saveState() {
    fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.state)
    }).catch(() => {
      localStorage.setItem('wan22-state', JSON.stringify(this.state));
    });
  }

  /**
   * Main render function
   */
  render() {
    const container = document.getElementById('app-content');
    if (!container) return;

    switch (this.state.ui.currentView) {
      case 'contracts':
        container.innerHTML = this.renderContractList();
        this.attachContractListeners();
        break;
      case 'projects':
        container.innerHTML = this.renderProjectList();
        this.attachProjectListeners();
        break;
      case 'tasks':
        container.innerHTML = this.renderTaskList();
        this.attachTaskListeners();
        break;
      case 'costs':
        container.innerHTML = this.renderCostList();
        this.attachCostListeners();
        break;
      case 'people':
        container.innerHTML = this.renderPeopleList();
        this.attachPeopleListeners();
        break;
      default:
        container.innerHTML = '<p>Unknown view</p>';
    }

    document.querySelectorAll('.nav-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.view === this.state.ui.currentView);
    });

    this.renderDialogs();
  }

  /**
   * Attach nav bar listeners (switch views)
   */
  attachNavListeners() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = e.currentTarget.dataset.view;
        if (!view) return;
        this.state.ui.currentView = view;
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.render();
      });
    });
  }

  /**
   * Render Contract List View
   */
  renderContractList() {
    const contracts = this.state.contracts;
    const billingCycles = this.state.billingCycles;

    if (!this.state.ui.expandedContracts) {
      this.state.ui.expandedContracts = {};
    }
    if (!this.state.ui.expandedContractProjects) {
      this.state.ui.expandedContractProjects = {};
    }

    const getBillingLabel = (cycle) => {
      return billingCycles.find(b => b.value === cycle)?.label || cycle;
    };

    const getProgressPercent = (contractId) => {
      const contractProjects = this.state.projects.filter(p => p.contractId === contractId);
      if (contractProjects.length === 0) return 0;
      const totalProgress = contractProjects.reduce((sum, p) => sum + this.getProjectTaskStats(p.id).percent, 0);
      return Math.round(totalProgress / contractProjects.length);
    };

    const renderContractProjectsPanel = (contract) => {
      const contractProjects = this.state.projects.filter(p => p.contractId === contract.id);
      const allocatedBudget = contractProjects.reduce((sum, p) => sum + (Number(p.budgetValue) || 0), 0);

      return `
        <tr class="contract-projects-panel-row">
          <td colspan="9">
            <div class="contract-projects-panel">
              ${contractProjects.length === 0 ? `
                <p style="color:#999; margin: 0.5rem 0;">ยังไม่มีโปรเจคผูกกับสัญญานี้</p>
              ` : `
                <p class="field-hint" style="margin: 0 0 0.5rem;">
                  มูลค่าโปรเจคที่กำหนดรวม: <strong>${this.formatCurrency(allocatedBudget)}</strong> / มูลค่าสัญญา: <strong>${this.formatCurrency(contract.value)}</strong>
                </p>
                ${contractProjects.map(project => {
                const stats = this.getProjectTaskStats(project.id);
                const pStatusClass = project.status === 'completed' ? 'status-completed' : project.status === 'in-progress' ? 'status-progress' : 'status-pending';
                const pStatusLabel = project.status === 'completed' ? '✓ เสร็จสิ้น' : project.status === 'in-progress' ? '◆ ดำเนินการ' : '○ รอดำเนินการ';
                const fin = this.getProjectFinancials(project.id);
                return `
                  <div class="contract-project-item">
                    <button class="link-button btn-view-project-tasks" data-project-id="${project.id}" title="ดูงานทั้งหมดของโปรเจคนี้">
                      <strong>${project.name}</strong>
                    </button>
                    <span class="status-badge ${pStatusClass}">${pStatusLabel}</span>
                    <div class="progress-bar" style="width:120px;">
                      <div class="progress-fill" style="width: ${stats.percent}%"></div>
                    </div>
                    <small>${stats.percent}% (${stats.completed}/${stats.total} งาน)</small>
                    <button class="link-button btn-view-project-financials" data-project-id="${project.id}" title="ดูรายละเอียดการเงินของโปรเจคนี้">
                      ${fin.hasRevenue
                        ? `💹 <span class="${fin.margin >= 0 ? 'margin-positive' : 'margin-negative'}">${this.formatCurrency(fin.margin)}</span>`
                        : '💹 -'
                      }
                    </button>
                    <button class="btn-small btn-edit-project-inline" data-project-id="${project.id}" title="แก้ไขโปรเจค">✎</button>
                    <button class="btn-small btn-duplicate-project-inline" data-project-id="${project.id}" title="ทำซ้ำโปรเจค">📋+</button>
                    <button class="btn-small btn-delete-project-inline" data-project-id="${project.id}" title="ลบโปรเจค">🗑️</button>
                  </div>
                `;
                }).join('')}
              `}
              <button class="btn-small btn-secondary btn-quick-add-project" data-contract-id="${contract.id}" style="margin-top:0.5rem;">
                + เพิ่มโปรเจคให้สัญญานี้
              </button>
            </div>
          </td>
        </tr>
      `;
    };

    let html = `
      <div class="contracts-page">
        <div class="page-header">
          <h1>🏢 สัญญา (Contracts)</h1>
          <button id="btn-add-contract" class="btn btn-primary">
            + เพิ่มสัญญา
          </button>
        </div>

        <table class="contracts-table">
          <thead>
            <tr>
              <th>ชื่อสัญญา</th>
              <th>ลูกค้า</th>
              <th>สถานะ</th>
              <th>มูลค่าสัญญา</th>
              <th>ประเภทการบิล</th>
              <th>ความคืบหน้า</th>
              <th>วันเริ่ม</th>
              <th>วันสิ้นสุด</th>
              <th>การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            ${(() => { const rootContracts = contracts.filter(c => !c.parentContractId); return rootContracts
              .map((contract, rootIdx) => {
                const childIds = contract.childContractIds || [];
                const children = contracts.filter(c => childIds.includes(c.id));
                const isExpanded = this.state.ui.expandedContracts[contract.id];
                const contractProjectCount = this.state.projects.filter(p => p.contractId === contract.id).length;
                const isProjectsExpanded = this.state.ui.expandedContractProjects[contract.id];
                const progress = getProgressPercent(contract.id);
                const statusClass = contract.status === 'active' ? 'status-active' : 'status-draft';
                const statusLabel = contract.status === 'active' ? '✓ ใช้งาน' : '○ ฉบับร่าง';
                const billingLabel = getBillingLabel(contract.billingCycle);

                let html = `
                  <tr class="contract-row parent-contract" data-contract-id="${contract.id}">
                    <td class="contract-name">
                      <span class="contract-reorder">
                        <button class="btn-small btn-move-contract-up" data-contract-id="${contract.id}" title="เลื่อนขึ้น" ${rootIdx === 0 ? 'disabled' : ''}>▲</button>
                        <button class="btn-small btn-move-contract-down" data-contract-id="${contract.id}" title="เลื่อนลง" ${rootIdx === rootContracts.length - 1 ? 'disabled' : ''}>▼</button>
                      </span>
                      ${childIds.length > 0 ? `
                        <button class="btn-expand" data-contract-id="${contract.id}" title="${isExpanded ? 'ซ่อน' : 'แสดง'}ลูกสัญญา">
                          ${isExpanded ? '▼' : '▶'}
                        </button>
                      ` : '<span style="display:inline-block;width:24px;"></span>'}
                      <button class="link-button btn-view-contract-projects" data-contract-id="${contract.id}" title="ดูโปรเจคทั้งหมดของสัญญานี้">
                        <strong>${contract.name}</strong>
                      </button>
                      <button class="btn-toggle-projects" data-contract-id="${contract.id}" title="${isProjectsExpanded ? 'ซ่อน' : 'แสดง'}โปรเจคในตารางนี้">
                        📦 ${contractProjectCount} ${isProjectsExpanded ? '▲' : '▼'}
                      </button>
                    </td>
                    <td>${contract.clientName}</td>
                    <td>
                      <span class="status-badge ${statusClass}">
                        ${statusLabel}
                      </span>
                    </td>
                    <td>${this.formatCurrency(contract.value)}</td>
                    <td>${billingLabel}</td>
                    <td>
                      <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                      </div>
                      <small>${progress}%</small>
                    </td>
                    <td>${this.formatDate(contract.startDate)}</td>
                    <td>${this.formatDate(contract.endDate)}</td>
                    <td class="actions-cell">
                      <button class="btn-small btn-edit" data-contract-id="${contract.id}" title="แก้ไข">
                        ✎
                      </button>
                      <button class="btn-small btn-services" data-contract-id="${contract.id}" title="บริการ">
                        📋
                      </button>
                      <button class="btn-small btn-payment-plan" data-contract-id="${contract.id}" title="แผนชำระเงิน">
                        💳
                      </button>
                      <button class="btn-small btn-duplicate" data-contract-id="${contract.id}" title="ทำซ้ำ">
                        📋+
                      </button>
                      <button class="btn-small btn-child" data-contract-id="${contract.id}" title="สร้าง Child Contract">
                        ➕
                      </button>
                      <button class="btn-small btn-toggle-status" data-contract-id="${contract.id}" title="สลับสถานะ">
                        🔄
                      </button>
                      <button class="btn-small btn-delete" data-contract-id="${contract.id}" title="ลบ">
                        🗑️
                      </button>
                    </td>
                  </tr>
                `;

                if (isProjectsExpanded) {
                  html += renderContractProjectsPanel(contract);
                }

                if (isExpanded && children.length > 0) {
                  html += children.map((child, childIdx) => {
                    const childProgress = getProgressPercent(child.id);
                    const childStatusClass = child.status === 'active' ? 'status-active' : 'status-draft';
                    const childStatusLabel = child.status === 'active' ? '✓ ใช้งาน' : '○ ฉบับร่าง';
                    const childBillingLabel = getBillingLabel(child.billingCycle);
                    const childProjectCount = this.state.projects.filter(p => p.contractId === child.id).length;
                    const isChildProjectsExpanded = this.state.ui.expandedContractProjects[child.id];

                    let childHtml = `
                      <tr class="contract-row child-contract" data-contract-id="${child.id}">
                        <td class="contract-name contract-child-indent">
                          <span class="contract-reorder">
                            <button class="btn-small btn-move-contract-up" data-contract-id="${child.id}" title="เลื่อนขึ้น" ${childIdx === 0 ? 'disabled' : ''}>▲</button>
                            <button class="btn-small btn-move-contract-down" data-contract-id="${child.id}" title="เลื่อนลง" ${childIdx === children.length - 1 ? 'disabled' : ''}>▼</button>
                          </span>
                          └─ <button class="link-button btn-view-contract-projects" data-contract-id="${child.id}" title="ดูโปรเจคทั้งหมดของสัญญานี้">
                            <strong>${child.name}</strong>
                          </button>
                          <button class="btn-toggle-projects" data-contract-id="${child.id}" title="${isChildProjectsExpanded ? 'ซ่อน' : 'แสดง'}โปรเจคในตารางนี้">
                            📦 ${childProjectCount} ${isChildProjectsExpanded ? '▲' : '▼'}
                          </button>
                        </td>
                        <td>${child.clientName}</td>
                        <td>
                          <span class="status-badge ${childStatusClass}">
                            ${childStatusLabel}
                          </span>
                        </td>
                        <td>${this.formatCurrency(child.value || 0)}</td>
                        <td>${childBillingLabel}</td>
                        <td>
                          <div class="progress-bar">
                            <div class="progress-fill" style="width: ${childProgress}%"></div>
                          </div>
                          <small>${childProgress}%</small>
                        </td>
                        <td>${this.formatDate(child.startDate)}</td>
                        <td>${this.formatDate(child.endDate)}</td>
                        <td class="actions-cell">
                          <button class="btn-small btn-edit" data-contract-id="${child.id}" title="แก้ไข">
                            ✎
                          </button>
                          <button class="btn-small btn-services" data-contract-id="${child.id}" title="บริการ">
                            📋
                          </button>
                          <button class="btn-small btn-payment-plan" data-contract-id="${child.id}" title="แผนชำระเงิน">
                            💳
                          </button>
                          <button class="btn-small btn-duplicate" data-contract-id="${child.id}" title="ทำซ้ำ">
                            📋+
                          </button>
                          <button class="btn-small btn-toggle-status" data-contract-id="${child.id}" title="สลับสถานะ">
                            🔄
                          </button>
                          <button class="btn-small btn-delete" data-contract-id="${child.id}" title="ลบ">
                            🗑️
                          </button>
                        </td>
                      </tr>
                    `;

                    if (isChildProjectsExpanded) {
                      childHtml += renderContractProjectsPanel(child);
                    }

                    return childHtml;
                  }).join('');
                }

                return html;
              }).join(''); })()}
          </tbody>
        </table>
      </div>
    `;

    return html;
  }

  /**
   * Render Project List View
   */
  getProjectTaskStats(projectId) {
    const projectTasks = this.state.tasks.filter(t => t.projectId === projectId);
    const total = projectTasks.length;
    const completed = projectTasks.filter(t => t.status === 'completed').length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, percent };
  }

  renderProjectList() {
    const contracts = this.state.contracts;
    const filterContractId = this.state.ui.projectFilter?.contractId || null;
    const projects = filterContractId
      ? this.state.projects.filter(p => p.contractId === filterContractId)
      : this.state.projects;
    const filterContract = filterContractId ? contracts.find(c => c.id === filterContractId) : null;

    if (!this.state.ui.expandedProjects) {
      this.state.ui.expandedProjects = {};
    }

    const getContractName = (contractId) => {
      return contracts.find(c => c.id === contractId)?.name || 'Unknown Contract';
    };

    const renderProjectRow = (project, isChild) => {
      const contractName = getContractName(project.contractId);
      const stats = this.getProjectTaskStats(project.id);
      const statusClass = project.status === 'completed' ? 'status-completed' : project.status === 'in-progress' ? 'status-progress' : 'status-pending';
      const statusLabel = project.status === 'completed' ? '✓ เสร็จสิ้น' : project.status === 'in-progress' ? '◆ ดำเนินการ' : '○ รอดำเนินการ';
      const childIds = project.childProjectIds || [];
      const isExpanded = this.state.ui.expandedProjects[project.id];
      const siblings = project.parentProjectId
        ? projects.filter(p => p.parentProjectId === project.parentProjectId)
        : projects.filter(p => !p.parentProjectId && p.contractId === project.contractId);
      const siblingIdx = siblings.findIndex(p => p.id === project.id);

      return `
        <tr class="project-row ${isChild ? 'child-project' : 'parent-project'}" data-project-id="${project.id}">
          <td class="project-name ${isChild ? 'contract-child-indent' : ''}">
            ${isChild ? '<span style="display:inline-block;width:8px;"></span>└─ ' : ''}
            ${childIds.length > 0 ? `
              <button class="btn-expand" data-project-id="${project.id}" title="${isExpanded ? 'ซ่อน' : 'แสดง'}โปรเจคย่อย">
                ${isExpanded ? '▼' : '▶'}
              </button>
            ` : (isChild ? '' : '<span style="display:inline-block;width:24px;"></span>')}
            <button class="link-button btn-view-project-tasks" data-project-id="${project.id}" title="ดูงานทั้งหมดของโปรเจคนี้">
              <strong>${project.name}</strong>
            </button>
          </td>
          <td class="project-contract">
            <button class="link-button btn-view-contract" data-contract-id="${project.contractId}" title="ดูสัญญานี้">
              ${contractName}
            </button>
          </td>
          <td class="project-description" title="${project.description}">${project.description || '-'}</td>
          <td>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${stats.percent}%"></div>
            </div>
            <small>${stats.percent}%</small>
          </td>
          <td class="project-tasks">
            <span title="งานที่เสร็จ / งานทั้งหมด">${stats.completed}/${stats.total}</span>
          </td>
          <td class="project-financials">
            <button class="link-button btn-view-project-financials" data-project-id="${project.id}" title="ดูรายละเอียดการเงินของโปรเจคนี้">
              ${(() => {
                const fin = this.getProjectFinancials(project.id);
                if (!fin.hasRevenue) return '💹 -';
                const marginClass = fin.margin >= 0 ? 'margin-positive' : 'margin-negative';
                return `💹 <span class="${marginClass}">${this.formatCurrency(fin.margin)}</span>`;
              })()}
            </button>
          </td>
          <td>
            <span class="status-badge ${statusClass}">
              ${statusLabel}
            </span>
          </td>
          <td>${this.formatDate(project.startDate)}</td>
          <td>${this.formatDate(project.dueDate)}</td>
          <td class="actions-cell">
            <button class="btn-small btn-move-project-up" data-project-id="${project.id}" title="เลื่อนขึ้น" ${siblingIdx === 0 ? 'disabled' : ''}>▲</button>
            <button class="btn-small btn-move-project-down" data-project-id="${project.id}" title="เลื่อนลง" ${siblingIdx === siblings.length - 1 ? 'disabled' : ''}>▼</button>
            <button class="btn-small btn-edit" data-project-id="${project.id}" title="แก้ไข">
              ✎
            </button>
            <button class="btn-small btn-duplicate-project" data-project-id="${project.id}" title="ทำซ้ำ">
              📋+
            </button>
            <button class="btn-small btn-child-project" data-project-id="${project.id}" title="สร้างโปรเจคย่อย">
              ➕
            </button>
            <button class="btn-small btn-delete" data-project-id="${project.id}" title="ลบ">
              🗑️
            </button>
          </td>
        </tr>
      `;
    };

    let html = `
      <div class="projects-page">
        <div class="page-header">
          <h1>📦 โปรเจค (Projects)</h1>
          <button id="btn-add-project" class="btn btn-primary">
            + เพิ่มโปรเจค
          </button>
        </div>

        ${filterContract ? `
          <div class="filter-banner">
            🏢 กำลังแสดงโปรเจคของสัญญา: <strong>${filterContract.name}</strong>
            <button id="btn-clear-project-filter" class="btn-small btn-secondary">✕ ล้างตัวกรอง</button>
          </div>
        ` : ''}

        <table class="projects-table">
          <thead>
            <tr>
              <th>ชื่อโปรเจค</th>
              <th>สัญญา</th>
              <th>รายละเอียด</th>
              <th>ความคืบหน้า</th>
              <th>งาน</th>
              <th>การเงิน</th>
              <th>สถานะ</th>
              <th>วันเริ่ม</th>
              <th>วันครบ</th>
              <th>การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            ${(() => {
              const rootProjects = projects.filter(p => !p.parentProjectId);

              const renderRootProjectRows = (rootList) => rootList.map(project => {
                const childIds = project.childProjectIds || [];
                const children = projects.filter(p => childIds.includes(p.id));
                const isExpanded = this.state.ui.expandedProjects[project.id];

                let rowHtml = renderProjectRow(project, false);
                if (isExpanded && children.length > 0) {
                  rowHtml += children.map(child => renderProjectRow(child, true)).join('');
                }
                return rowHtml;
              }).join('');

              // When already scoped to one contract, no grouping needed
              if (filterContractId) {
                return renderRootProjectRows(rootProjects);
              }

              // Group root projects by contract, collapsed by default, so the list
              // doesn't grow endlessly as recurring monthly projects pile up.
              const contractGroups = {};
              rootProjects.forEach(p => {
                const key = (p.contractId && contracts.some(c => c.id === p.contractId)) ? p.contractId : '__none__';
                if (!contractGroups[key]) contractGroups[key] = [];
                contractGroups[key].push(p);
              });

              // Order groups to match the contracts' own order (so the same
              // move up/down used on the Contracts page also reorders here);
              // the "no contract" bucket always sorts last.
              const groupKeys = Object.keys(contractGroups).sort((a, b) => {
                if (a === '__none__') return 1;
                if (b === '__none__') return -1;
                return this.state.contracts.findIndex(c => c.id === a) - this.state.contracts.findIndex(c => c.id === b);
              });
              const movableGroupKeys = groupKeys.filter(k => k !== '__none__');

              return groupKeys.map(contractId => {
                const group = contractGroups[contractId];
                const contract = contractId !== '__none__' ? contracts.find(c => c.id === contractId) : null;
                const contractName = contract ? contract.name : 'ไม่ผูกกับสัญญา';
                const isExpanded = this.state.ui.expandedProjectContracts[contractId];
                const groupIdx = movableGroupKeys.indexOf(contractId);

                const allIdsInGroup = group.reduce((acc, p) => acc.concat(p.id, this.getProjectDescendantIds(p.id)), []);
                const allProjectsInGroup = projects.filter(p => allIdsInGroup.includes(p.id));
                const totalTasks = allProjectsInGroup.reduce((sum, p) => sum + this.getProjectTaskStats(p.id).total, 0);
                const completedTasks = allProjectsInGroup.reduce((sum, p) => sum + this.getProjectTaskStats(p.id).completed, 0);
                const percent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
                const totalRevenue = allProjectsInGroup.reduce((sum, p) => sum + (Number(p.budgetValue) || 0), 0);
                const totalCost = allProjectsInGroup.reduce((sum, p) => sum + this.getProjectCostTotal(p.id), 0);
                const hasRevenue = totalRevenue > 0;
                const margin = hasRevenue ? totalRevenue - totalCost : null;

                return `
                  <tr class="project-contract-group-row" data-contract-id="${contractId}">
                    <td colspan="10">
                      ${contractId !== '__none__' ? `
                        <button class="btn-small btn-move-project-group-up" data-contract-id="${contractId}" title="เลื่อนขึ้น" ${groupIdx === 0 ? 'disabled' : ''}>▲</button>
                        <button class="btn-small btn-move-project-group-down" data-contract-id="${contractId}" title="เลื่อนลง" ${groupIdx === movableGroupKeys.length - 1 ? 'disabled' : ''}>▼</button>
                      ` : ''}
                      <button class="link-button btn-expand-contract-group" data-contract-id="${contractId}">
                        ${isExpanded ? '▼' : '▶'} 🏢 <strong>${contractName}</strong>
                        <span class="field-hint" style="margin-left:0.5rem;">
                          ${group.length} โปรเจค · ${completedTasks}/${totalTasks} งาน (${percent}%)
                          ${hasRevenue ? ` · 💹 <span class="${margin >= 0 ? 'margin-positive' : 'margin-negative'}">${this.formatCurrency(margin)}</span>` : ''}
                        </span>
                      </button>
                    </td>
                  </tr>
                  ${isExpanded ? renderRootProjectRows(group) : ''}
                `;
              }).join('');
            })()}
          </tbody>
        </table>
      </div>
    `;

    return html;
  }

  /**
   * Render Task List View
   */
  getTaskLaborCost(task) {
    if (!task || !task.assigneeId || !task.assigneeRoleId) return 0;
    const person = this.state.people.find(p => p.id === task.assigneeId);
    const role = person ? (person.roles || []).find(r => r.id === task.assigneeRoleId) : null;
    if (!role) return 0;

    if (role.rateType === 'piece') {
      const qty = Number(task.laborQuantity) || 1;
      return role.rateValue * qty;
    }

    // Scoped to the same project: a monthly/lump-sum/daily/hourly rate is a full
    // allocation per period (project), so reusing the same role across separate
    // projects (e.g. recurring monthly projects) must not dilute the cost further.
    const taskCount = this.state.tasks.filter(t =>
      t.assigneeId === task.assigneeId && t.assigneeRoleId === task.assigneeRoleId && t.projectId === task.projectId
    ).length;
    return taskCount > 0 ? role.rateValue / taskCount : 0;
  }

  getTaskExplicitCostTotal(taskId) {
    return this.state.costs
      .filter(c => c.taskId === taskId)
      .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  }

  getCostItemTierLabel(tier) {
    const suffixes = { monthly: '/เดือน', daily: '/วัน', project: '/โปรเจค (เหมา)', piece: '/ชิ้น', hourly: '/ชั่วโมง' };
    return `${this.formatCurrency(tier.rateValue)}${suffixes[tier.rateType] || ''}`;
  }

  getCostItemTierBreakdown(costItemId, tierId) {
    const tasks = this.state.tasks.filter(t => t.costItemId === costItemId && t.costItemTierId === tierId);
    const taskCount = tasks.length;
    const costItem = this.state.costItems.find(ci => ci.id === costItemId);
    const tier = costItem ? (costItem.tiers || []).find(t => t.id === tierId) : null;
    const calcMode = tier?.calcMode || 'divide';

    if (calcMode === 'multiply') {
      const totalQuantity = tasks.reduce((sum, t) => sum + (Number(t.costItemQuantity) || 1), 0);
      const totalCost = tier ? tier.rateValue * totalQuantity : 0;
      return { taskCount, calcMode, totalQuantity, totalCost };
    }

    if (calcMode === 'flat') {
      const totalCost = tier ? tier.rateValue * taskCount : 0;
      return { taskCount, calcMode, totalCost };
    }

    const costPerTask = (tier && taskCount > 0) ? tier.rateValue / taskCount : 0;
    return { taskCount, calcMode, costPerTask };
  }

  getTaskCostItemCost(task) {
    if (!task || !task.costItemId || !task.costItemTierId) return 0;
    const costItem = this.state.costItems.find(ci => ci.id === task.costItemId);
    const tier = costItem ? (costItem.tiers || []).find(t => t.id === task.costItemTierId) : null;
    if (!tier) return 0;

    if (tier.calcMode === 'multiply') {
      const qty = Number(task.costItemQuantity) || 1;
      return tier.rateValue * qty;
    }

    if (tier.calcMode === 'flat') {
      return tier.rateValue;
    }

    const taskCount = this.state.tasks.filter(t =>
      t.costItemId === task.costItemId && t.costItemTierId === task.costItemTierId
    ).length;
    return taskCount > 0 ? tier.rateValue / taskCount : 0;
  }

  getTaskCostTotal(taskId) {
    const task = this.state.tasks.find(t => t.id === taskId);
    return this.getTaskExplicitCostTotal(taskId) + this.getTaskLaborCost(task) + this.getTaskCostItemCost(task);
  }

  getProjectCostTotal(projectId) {
    return this.state.tasks
      .filter(t => t.projectId === projectId)
      .reduce((sum, t) => sum + this.getTaskCostTotal(t.id), 0);
  }

  getProjectFinancials(projectId) {
    const project = this.state.projects.find(p => p.id === projectId);
    const revenue = Number(project?.budgetValue) || 0;
    const cost = this.getProjectCostTotal(projectId);
    const hasRevenue = revenue > 0;
    const margin = hasRevenue ? revenue - cost : null;
    const marginPercent = hasRevenue ? (margin / revenue) * 100 : null;

    let months = null;
    if (project?.startDate && project?.dueDate) {
      const start = new Date(project.startDate);
      const due = new Date(project.dueDate);
      const diffMonths = (due.getFullYear() - start.getFullYear()) * 12 + (due.getMonth() - start.getMonth()) + 1;
      months = diffMonths > 0 ? diffMonths : 1;
    }
    const monthlyRevenue = hasRevenue && months ? revenue / months : null;
    const monthlyMargin = hasRevenue && months ? margin / months : null;

    return { revenue, cost, hasRevenue, margin, marginPercent, months, monthlyRevenue, monthlyMargin };
  }

  /**
   * Suggest a default project revenue based on the contract's payment plan
   * (e.g. a contract split into 12 equal installments → suggest 1 installment's amount).
   * Returns null when the contract has no payment plan to derive a suggestion from.
   */
  getSuggestedProjectBudget(contractId) {
    const contract = this.state.contracts.find(c => c.id === contractId);
    const installments = contract?.paymentPlan?.installments || [];
    if (installments.length === 0) return null;
    const total = installments.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
    return total > 0 ? total / installments.length : null;
  }

  renderTaskList() {
    const projects = this.state.projects;
    const filterProjectId = this.state.ui.taskFilter?.projectId || null;
    const filterServiceId = this.state.ui.taskFilter?.serviceId || null;
    let tasks = this.state.tasks;
    if (filterProjectId) tasks = tasks.filter(t => t.projectId === filterProjectId);
    if (filterServiceId) tasks = tasks.filter(t => t.serviceId === filterServiceId);
    const filterProject = filterProjectId ? projects.find(p => p.id === filterProjectId) : null;

    let filterServiceName = null;
    if (filterServiceId) {
      for (const c of this.state.contracts) {
        const svc = (c.services || []).find(s => s.id === filterServiceId);
        if (svc) { filterServiceName = svc.name; break; }
      }
    }

    const getProjectName = (projectId) => {
      return projects.find(p => p.id === projectId)?.name || 'Unknown Project';
    };

    const statusLabels = {
      'pending': '○ รอดำเนินการ',
      'in-progress': '◆ ดำเนินการ',
      'completed': '✓ เสร็จสิ้น'
    };
    const statusClasses = {
      'pending': 'status-pending',
      'in-progress': 'status-progress',
      'completed': 'status-completed'
    };
    const priorityLabels = { 'high': '🔴 สูง', 'medium': '🟡 กลาง', 'low': '🟢 ต่ำ' };

    const completedCount = tasks.filter(t => t.status === 'completed').length;
    const overallPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
    const totalTaskCost = tasks.reduce((sum, t) => sum + this.getTaskCostTotal(t.id), 0);
    const projectFin = filterProject ? this.getProjectFinancials(filterProject.id) : null;

    let html = `
      <div class="tasks-page">
        <div class="page-header">
          <h1>✓ งาน (Tasks)</h1>
          <button id="btn-add-task" class="btn btn-primary">
            + เพิ่มงาน
          </button>
        </div>

        ${filterProject ? `
          <div class="filter-banner">
            📦 กำลังแสดงงานของโปรเจค: <strong>${filterProject.name}</strong>
            <button id="btn-clear-task-filter" class="btn-small btn-secondary">✕ ล้างตัวกรอง</button>
          </div>
        ` : ''}

        ${filterServiceName ? `
          <div class="filter-banner">
            📋 กำลังแสดงงานของบริการ: <strong>${filterServiceName}</strong>
            <button id="btn-clear-task-filter" class="btn-small btn-secondary">✕ ล้างตัวกรอง</button>
          </div>
        ` : ''}

        <div class="summary-widget">
          <div class="summary-card">
            <span class="summary-label">งานทั้งหมด</span>
            <span class="summary-value">${completedCount}/${tasks.length}</span>
          </div>
          <div class="summary-card">
            <span class="summary-label">ความสำเร็จโดยรวม</span>
            <span class="summary-value">${overallPercent}%</span>
          </div>
          <div class="summary-card">
            <span class="summary-label">ต้นทุนรวมทั้งหมด</span>
            <span class="summary-value">${this.formatCurrency(totalTaskCost)}</span>
          </div>
          ${projectFin && projectFin.hasRevenue ? `
            <div class="summary-card">
              <span class="summary-label">มูลค่าโปรเจค (รายได้)</span>
              <span class="summary-value">${this.formatCurrency(projectFin.revenue)}</span>
            </div>
            <div class="summary-card">
              <span class="summary-label">กำไร (Margin)</span>
              <span class="summary-value ${projectFin.margin >= 0 ? 'margin-positive' : 'margin-negative'}">
                ${this.formatCurrency(projectFin.margin)} (${projectFin.marginPercent.toFixed(1)}%)
              </span>
            </div>
          ` : filterProject ? `
            <div class="summary-card">
              <span class="summary-label">มูลค่าโปรเจค (รายได้)</span>
              <span class="summary-value" style="color:#999;">ยังไม่ระบุ</span>
            </div>
          ` : ''}
        </div>

        <table class="tasks-table">
          <thead>
            <tr>
              <th>ชื่องาน</th>
              <th>โปรเจค</th>
              <th>บริการ</th>
              <th>ผู้รับผิดชอบ</th>
              <th>ความสำคัญ</th>
              <th>สถานะ</th>
              <th>ต้นทุน</th>
              <th>วันเริ่มต้น</th>
              <th>วันครบกำหนด</th>
              <th>การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            ${(() => {
              const renderTaskRow = (task) => {
                const projectName = getProjectName(task.projectId);
                const costTotal = this.getTaskCostTotal(task.id);
                const person = this.state.people.find(p => p.id === task.assigneeId);
                const assigneeRole = person ? (person.roles || []).find(r => r.id === task.assigneeRoleId) : null;
                const contract = task.contractId ? this.state.contracts.find(c => c.id === task.contractId) : null;
                const service = contract ? (contract.services || []).find(s => s.id === task.serviceId) : null;

                return `
                  <tr class="task-row" data-task-id="${task.id}">
                    <td class="task-title">
                      <strong>${task.title}</strong>
                      ${task.description ? `<br><small style="color:#666">${task.description}</small>` : ''}
                    </td>
                    <td>${projectName}</td>
                    <td>${service ? service.name : '<span style="color:#999">-</span>'}</td>
                    <td>
                      ${person ? person.name : '-'}
                      ${assigneeRole ? `<br><small style="color:#666">${assigneeRole.position}</small>` : ''}
                    </td>
                    <td>${priorityLabels[task.priority] || task.priority}</td>
                    <td>
                      <span class="status-badge ${statusClasses[task.status] || ''}">
                        ${statusLabels[task.status] || task.status}
                      </span>
                    </td>
                    <td>
                      <button class="btn-small btn-view-task-costs" data-task-id="${task.id}" title="ดูต้นทุนของงานนี้">
                        💰 ${this.formatCurrency(costTotal)}
                      </button>
                    </td>
                    <td>${this.formatDate(task.startDate)}</td>
                    <td>${this.formatDate(task.dueDate)}</td>
                    <td class="actions-cell">
                      <button class="btn-small btn-edit" data-task-id="${task.id}" title="แก้ไข">
                        ✎
                      </button>
                      <button class="btn-small btn-delete" data-task-id="${task.id}" title="ลบ">
                        🗑️
                      </button>
                    </td>
                  </tr>
                `;
              };

              // Already scoped to one project/service — no grouping needed
              if (filterProjectId || filterServiceId) {
                return tasks.map(renderTaskRow).join('');
              }

              // Group by project, collapsed by default, so a growing task list
              // doesn't turn into one giant undifferentiated table.
              const taskProjectGroups = {};
              tasks.forEach(t => {
                const key = (t.projectId && projects.some(p => p.id === t.projectId)) ? t.projectId : '__none__';
                if (!taskProjectGroups[key]) taskProjectGroups[key] = [];
                taskProjectGroups[key].push(t);
              });

              const groupKeys = Object.keys(taskProjectGroups).sort((a, b) => {
                if (a === '__none__') return 1;
                if (b === '__none__') return -1;
                return this.state.projects.findIndex(p => p.id === a) - this.state.projects.findIndex(p => p.id === b);
              });

              return groupKeys.map(projectId => {
                const group = taskProjectGroups[projectId];
                const project = projectId !== '__none__' ? projects.find(p => p.id === projectId) : null;
                const groupName = project ? project.name : 'ไม่ผูกกับโปรเจค';
                const isExpanded = this.state.ui.expandedTaskProjects[projectId];

                const groupCompleted = group.filter(t => t.status === 'completed').length;
                const groupCost = group.reduce((sum, t) => sum + this.getTaskCostTotal(t.id), 0);

                return `
                  <tr class="task-project-group-row" data-project-id="${projectId}">
                    <td colspan="10">
                      <button class="link-button btn-expand-task-project-group" data-project-id="${projectId}">
                        ${isExpanded ? '▼' : '▶'} 📦 <strong>${groupName}</strong>
                        <span class="field-hint" style="margin-left:0.5rem;">
                          ${groupCompleted}/${group.length} งาน · 💰 ${this.formatCurrency(groupCost)}
                        </span>
                      </button>
                    </td>
                  </tr>
                  ${isExpanded ? group.map(renderTaskRow).join('') : ''}
                `;
              }).join('');
            })()}
          </tbody>
        </table>
      </div>
    `;

    return html;
  }

  /**
   * Render Cost List View (Costs Module - Simple)
   */
  renderCostList() {
    const allCosts = this.state.costs;
    const typeFilter = this.state.ui.costTypeFilter || '';
    const costs = typeFilter ? allCosts.filter(c => c.type === typeFilter) : allCosts;

    const getCostLineage = (cost) => {
      const task = this.state.tasks.find(t => t.id === cost.taskId);
      if (!task) return '<span style="color:#999">— (ยังไม่ผูกกับงาน)</span>';
      const project = this.state.projects.find(p => p.id === task.projectId);
      const contract = project ? this.state.contracts.find(c => c.id === project.contractId) : null;
      return `
        ${task.title}
        <br><small style="color:#666">
          ${project ? project.name : '-'} ${contract ? '· ' + contract.name : ''}
        </small>
      `;
    };

    const getCostTypeLabel = (type) => {
      return this.state.costTypes.find(t => t.value === type)?.label || type;
    };

    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(amount || 0);
    };

    const totalCost = costs.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

    const breakdownByType = this.state.costTypes.map(t => {
      const typeCosts = allCosts.filter(c => c.type === t.value);
      return {
        value: t.value,
        label: t.label,
        total: typeCosts.reduce((sum, c) => sum + (Number(c.amount) || 0), 0),
        count: typeCosts.length
      };
    }).filter(b => b.count > 0);

    let html = `
      <div class="costs-page">
        <div class="page-header">
          <h2>ต้นทุน</h2>
          <button id="btn-add-cost" class="btn btn-primary">+ เพิ่มต้นทุน</button>
        </div>

        <div class="cost-items-section">
          <div class="page-header" style="margin-bottom:0.75rem;">
            <h3 style="margin:0;">🗂️ รายการต้นทุนที่ใช้ซ้ำได้</h3>
            <button id="btn-add-cost-item" class="btn btn-secondary btn-small">+ เพิ่มรายการ</button>
          </div>
          ${this.state.costItems.length === 0 ? `
            <p style="color:#999; margin-bottom:1.5rem;">ยังไม่มีรายการต้นทุนที่ใช้ซ้ำได้ (เช่น ค่า Software License ที่ผูกกับหลายงานพร้อมกันได้)</p>
          ` : `
          <table class="people-table" style="margin-bottom:1.5rem;">
            <thead>
              <tr>
                <th>ชื่อรายการ</th>
                <th>Tier ราคา</th>
                <th>การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              ${this.state.costItems.map(item => `
                <tr class="cost-item-row" data-cost-item-id="${item.id}">
                  <td><strong>${item.name}</strong></td>
                  <td>
                    ${(item.tiers || []).length === 0 ? `
                      <span style="color:#999">ยังไม่มี Tier</span>
                    ` : item.tiers.map(tier => `
                      <div class="role-chip">${tier.label} — ${this.getCostItemTierLabel(tier)}</div>
                    `).join('')}
                  </td>
                  <td class="actions-cell">
                    <button class="btn-small btn-edit" data-cost-item-id="${item.id}" title="แก้ไขชื่อ">✎</button>
                    <button class="btn-small btn-manage-cost-item-tiers" data-cost-item-id="${item.id}" title="จัดการ Tier">🗂️ ${(item.tiers || []).length}</button>
                    <button class="btn-small btn-delete" data-cost-item-id="${item.id}" title="ลบ">🗑️</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          `}
        </div>

        <div class="summary-widget">
          <div class="summary-card">
            <span class="summary-label">รายการทั้งหมด</span>
            <span class="summary-value">${costs.length}</span>
          </div>
          <div class="summary-card">
            <span class="summary-label">ยอดรวมต้นทุน${typeFilter ? ' (ตัวกรอง)' : ''}</span>
            <span class="summary-value">${formatCurrency(totalCost)}</span>
          </div>
        </div>

        <div class="cost-breakdown">
          <span class="cost-breakdown-title">แยกตามประเภท:</span>
          ${breakdownByType.map(b => `
            <button class="cost-breakdown-chip ${typeFilter === b.value ? 'active' : ''}" data-type="${b.value}">
              ${b.label} · ${formatCurrency(b.total)} (${b.count})
            </button>
          `).join('')}
          ${typeFilter ? `<button class="cost-breakdown-chip clear-chip" data-type="">✕ ล้างตัวกรอง</button>` : ''}
        </div>

        ${costs.length === 0 ? `
          <div class="empty-state">
            <p>${typeFilter ? 'ไม่มีรายการต้นทุนประเภทนี้' : 'ยังไม่มีรายการต้นทุน'}</p>
          </div>
        ` : `
        <table class="contracts-table">
          <thead>
            <tr>
              <th>ชื่อรายการ</th>
              <th>งาน / โปรเจค / สัญญา</th>
              <th>ประเภท</th>
              <th>จำนวนเงิน</th>
              <th>วันที่</th>
              <th>การกระทำ</th>
            </tr>
          </thead>
          <tbody>
            ${costs.map(cost => `
              <tr class="contract-row" data-cost-id="${cost.id}">
                <td class="contract-name">${cost.name}</td>
                <td>${getCostLineage(cost)}</td>
                <td><span class="status-badge status-draft">${getCostTypeLabel(cost.type)}</span></td>
                <td>${formatCurrency(cost.amount)}</td>
                <td>${this.formatDate(cost.date)}</td>
                <td class="actions-cell">
                  <button class="btn-small btn-edit-cost" data-cost-id="${cost.id}" title="แก้ไข">✏️</button>
                  <button class="btn-small btn-delete-cost" data-cost-id="${cost.id}" title="ลบ">🗑️</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        `}
      </div>
    `;

    return html;
  }

  getRoleRateLabel(role) {
    const suffixes = { monthly: '/เดือน', daily: '/วัน', project: '/โปรเจค (เหมา)', piece: '/ชิ้น', hourly: '/ชั่วโมง' };
    const rateLabel = suffixes[role.rateType] || '';
    return `${this.formatCurrency(role.rateValue)}${rateLabel}`;
  }

  getRoleCostBreakdown(personId, roleId) {
    const tasks = this.state.tasks.filter(t => t.assigneeId === personId && t.assigneeRoleId === roleId);
    const taskCount = tasks.length;
    const person = this.state.people.find(p => p.id === personId);
    const role = person ? (person.roles || []).find(r => r.id === roleId) : null;
    const isPiece = role && role.rateType === 'piece';

    // Non-piece rates (monthly/daily/project/hourly) are a full allocation per
    // project (period) — group by project first so reusing the same role across
    // separate projects (e.g. recurring monthly projects) doesn't dilute the cost.
    const projectGroups = {};
    tasks.forEach(t => {
      if (!projectGroups[t.projectId]) projectGroups[t.projectId] = [];
      projectGroups[t.projectId].push(t);
    });
    const projectCount = Object.keys(projectGroups).length;

    const taskCostMap = {};
    if (isPiece) {
      tasks.forEach(t => {
        taskCostMap[t.id] = role.rateValue * (Number(t.laborQuantity) || 1);
      });
    } else {
      Object.values(projectGroups).forEach(group => {
        const perTask = role && group.length > 0 ? role.rateValue / group.length : 0;
        group.forEach(t => { taskCostMap[t.id] = perTask; });
      });
    }

    const groups = {};
    tasks.forEach(t => {
      const contract = t.contractId ? this.state.contracts.find(c => c.id === t.contractId) : null;
      const service = contract ? (contract.services || []).find(s => s.id === t.serviceId) : null;
      const label = service ? service.name : 'ไม่ผูกกับบริการ';
      if (!groups[label]) groups[label] = { count: 0, cost: 0 };
      groups[label].count += 1;
      groups[label].cost += taskCostMap[t.id] || 0;
    });

    const breakdown = Object.entries(groups).map(([name, g]) => ({
      name,
      count: g.count,
      cost: g.cost
    })).sort((a, b) => b.count - a.count);

    const totalCost = breakdown.reduce((sum, b) => sum + b.cost, 0);
    // A single flat "cost per task" only makes sense when everything sits in one project.
    const costPerTask = (!isPiece && projectCount <= 1 && taskCount > 0) ? role.rateValue / taskCount : null;

    return { taskCount, costPerTask, isPiece, projectCount, totalCost, breakdown };
  }

  /**
   * Render People List View
   */
  renderPeopleList() {
    const people = this.state.people;

    let html = `
      <div class="people-page">
        <div class="page-header">
          <h1>👤 บุคคล (People)</h1>
          <button id="btn-add-person" class="btn btn-primary">
            + เพิ่มบุคคล
          </button>
        </div>

        ${people.length === 0 ? `
          <div class="empty-state">
            <p>ยังไม่มีข้อมูลบุคคล</p>
          </div>
        ` : `
        <table class="people-table">
          <thead>
            <tr>
              <th>ชื่อ</th>
              <th>บทบาท / อัตราต้นทุน</th>
              <th>การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            ${people.map(person => `
              <tr class="person-row" data-person-id="${person.id}">
                <td><strong>${person.name}</strong></td>
                <td>
                  ${(person.roles || []).length === 0 ? `
                    <span style="color:#999">ยังไม่มีบทบาท</span>
                  ` : person.roles.map(role => `
                    <div class="role-chip">
                      <strong>${role.position}</strong>
                      <span style="color:#666"> — ${this.getRoleRateLabel(role)}</span>
                    </div>
                  `).join('')}
                </td>
                <td class="actions-cell">
                  <button class="btn-small btn-edit" data-person-id="${person.id}" title="แก้ไขชื่อ">✎</button>
                  <button class="btn-small btn-manage-roles" data-person-id="${person.id}" title="จัดการบทบาท">🎭 ${(person.roles || []).length}</button>
                  <button class="btn-small btn-delete" data-person-id="${person.id}" title="ลบ">🗑️</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        `}
      </div>
    `;

    return html;
  }

  /**
   * Attach listeners for cost list view
   */
  attachCostListeners() {
    document.getElementById('btn-add-cost')?.addEventListener('click', () => {
      this.openCostDialog('add', null);
    });

    document.querySelectorAll('.btn-edit-cost').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const costId = e.target.dataset.costId;
        const cost = this.state.costs.find(c => c.id === costId);
        this.openCostDialog('edit', cost);
      });
    });

    document.querySelectorAll('.btn-delete-cost').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const costId = e.target.dataset.costId;
        this.showConfirmDialog(
          'คุณแน่ใจว่าต้องการลบรายการต้นทุนนี้?',
          () => this.deleteCost(costId)
        );
      });
    });

    document.querySelectorAll('.cost-breakdown-chip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.state.ui.costTypeFilter = e.currentTarget.dataset.type || '';
        this.render();
      });
    });

    document.getElementById('btn-add-cost-item')?.addEventListener('click', () => {
      this.openCostItemDialog('add', null);
    });

    document.querySelectorAll('.cost-item-row .btn-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const costItemId = e.target.dataset.costItemId;
        const item = this.state.costItems.find(ci => ci.id === costItemId);
        this.openCostItemDialog('edit', item);
      });
    });

    document.querySelectorAll('.btn-manage-cost-item-tiers').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const costItemId = e.currentTarget.dataset.costItemId;
        this.openCostItemTiersDialog(costItemId);
      });
    });

    document.querySelectorAll('.cost-item-row .btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const costItemId = e.target.dataset.costItemId;
        this.showConfirmDialog(
          'คุณแน่ใจว่าต้องการลบรายการต้นทุนนี้? งานที่ผูกอยู่จะยังคงอยู่แต่จะไม่มีรายการต้นทุนนี้ผูกด้วย',
          () => this.deleteCostItem(costItemId)
        );
      });
    });
  }

  openCostDialog(mode, data) {
    this.state.ui.costDialog = { isOpen: true, mode, data };
    this.render();
  }

  closeCostDialog() {
    this.state.ui.costDialog = { isOpen: false, mode: 'add', data: null };
    this.render();
  }

  deleteCost(costId) {
    this.state.costs = this.state.costs.filter(c => c.id !== costId);
    this.saveState();
    this.render();
  }

  /**
   * Attach listeners for people list view
   */
  attachPeopleListeners() {
    document.getElementById('btn-add-person')?.addEventListener('click', () => {
      this.openPeopleDialog('add', null);
    });

    document.querySelectorAll('.person-row .btn-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const personId = e.target.dataset.personId;
        const person = this.state.people.find(p => p.id === personId);
        this.openPeopleDialog('edit', person);
      });
    });

    document.querySelectorAll('.person-row .btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const personId = e.target.dataset.personId;
        this.showConfirmDialog(
          'คุณแน่ใจว่าต้องการลบบุคคลนี้? งานที่มอบหมายให้บุคคลนี้จะยังคงอยู่แต่จะไม่มีผู้รับผิดชอบ',
          () => this.deletePerson(personId)
        );
      });
    });

    document.querySelectorAll('.btn-manage-roles').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const personId = e.currentTarget.dataset.personId;
        this.openPersonRolesDialog(personId);
      });
    });
  }

  openPeopleDialog(mode, data) {
    this.state.ui.peopleDialog = { isOpen: true, mode, data };
    this.render();
  }

  closePeopleDialog() {
    this.state.ui.peopleDialog = { isOpen: false, mode: 'add', data: null };
    this.render();
  }

  deletePerson(personId) {
    this.state.people = this.state.people.filter(p => p.id !== personId);
    this.state.tasks.forEach(t => {
      if (t.assigneeId === personId) {
        t.assigneeId = null;
        t.assigneeRoleId = null;
      }
    });
    this.saveState();
    this.render();
  }

  openPersonRolesDialog(personId) {
    this.state.ui.personRolesDialog = { isOpen: true, personId, editingRoleId: null };
    this.render();
  }

  closePersonRolesDialog() {
    this.state.ui.personRolesDialog = { isOpen: false, personId: null, editingRoleId: null };
    this.render();
  }

  deleteRole(personId, roleId) {
    const person = this.state.people.find(p => p.id === personId);
    if (!person) return;
    person.roles = (person.roles || []).filter(r => r.id !== roleId);
    this.state.tasks.forEach(t => {
      if (t.assigneeRoleId === roleId) t.assigneeRoleId = null;
    });
    this.saveState();
    this.render();
  }

  openCostItemDialog(mode, data) {
    this.state.ui.costItemDialog = { isOpen: true, mode, data };
    this.render();
  }

  closeCostItemDialog() {
    this.state.ui.costItemDialog = { isOpen: false, mode: 'add', data: null };
    this.render();
  }

  deleteCostItem(costItemId) {
    this.state.costItems = this.state.costItems.filter(ci => ci.id !== costItemId);
    this.state.tasks.forEach(t => {
      if (t.costItemId === costItemId) {
        t.costItemId = null;
        t.costItemTierId = null;
      }
    });
    this.saveState();
    this.render();
  }

  openCostItemTiersDialog(costItemId) {
    this.state.ui.costItemTiersDialog = { isOpen: true, costItemId, editingTierId: null };
    this.render();
  }

  closeCostItemTiersDialog() {
    this.state.ui.costItemTiersDialog = { isOpen: false, costItemId: null, editingTierId: null };
    this.render();
  }

  deleteCostItemTier(costItemId, tierId) {
    const item = this.state.costItems.find(ci => ci.id === costItemId);
    if (!item) return;
    item.tiers = (item.tiers || []).filter(t => t.id !== tierId);
    this.state.tasks.forEach(t => {
      if (t.costItemTierId === tierId) t.costItemTierId = null;
    });
    this.saveState();
    this.render();
  }

  /**
   * Render Dialogs
   */
  renderDialogs() {
    const { contractDialog, servicesDialog, costDialog, confirmDialog, paymentPlanDialog, projectDialog, taskDialog, taskCostsDialog, projectFinancialsDialog, peopleDialog, personRolesDialog, costItemDialog, costItemTiersDialog } = this.state.ui;
    let dialogHtml = '';

    // Cost Add/Edit Dialog
    if (costDialog.isOpen) {
      const data = costDialog.data || {
        name: '',
        taskId: '',
        type: this.state.costTypes[0]?.value || 'other',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        note: ''
      };

      dialogHtml += `
        <div class="modal-overlay" id="cost-dialog-overlay">
          <div class="modal-content">
            <h2>${costDialog.mode === 'add' ? 'เพิ่มต้นทุน' : 'แก้ไขต้นทุน'}</h2>
            <form id="cost-form">
              <div class="form-group">
                <label>ชื่อรายการ</label>
                <input type="text" name="name" value="${data.name}" required placeholder="เช่น ค่าจ้างนักออกแบบ" />
              </div>
              <div class="form-group">
                <label>งาน (Task)</label>
                <select name="taskId">
                  <option value="">-- ไม่ผูกกับงาน (Pool) --</option>
                  ${this.state.tasks.map(t => {
                    const proj = this.state.projects.find(p => p.id === t.projectId);
                    return `
                      <option value="${t.id}" ${data.taskId === t.id ? 'selected' : ''}>
                        ${t.title}${proj ? ` (${proj.name})` : ''}
                      </option>
                    `;
                  }).join('')}
                </select>
                <small class="field-hint">
                  💡 ถ้ายังไม่รู้ว่าจะผูกกับงานไหน สร้างแบบไม่ระบุไว้ก่อนได้ แล้วมาแก้ไขผูกทีหลัง
                </small>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>ประเภทต้นทุน</label>
                  <select name="type" required>
                    ${this.state.costTypes.map(t => `
                      <option value="${t.value}" ${data.type === t.value ? 'selected' : ''}>${t.label}</option>
                    `).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label>จำนวนเงิน (บาท)</label>
                  <input type="number" name="amount" value="${data.amount}" min="0" step="0.01" required />
                </div>
              </div>
              <div class="form-group">
                <label>วันที่</label>
                <input type="date" name="date" value="${data.date}" required />
              </div>
              <div class="form-group">
                <label>หมายเหตุ</label>
                <textarea name="note" rows="2" placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)">${data.note || ''}</textarea>
              </div>
              <div class="modal-actions">
                <button type="submit" class="btn btn-primary">บันทึก</button>
                <button type="button" class="btn btn-secondary" id="btn-cancel-cost">ยกเลิก</button>
              </div>
            </form>
          </div>
        </div>
      `;
    }

    // Contract Add/Edit Dialog
    if (contractDialog.isOpen) {
      const data = contractDialog.data || {
        name: '',
        clientName: '',
        startDate: '',
        endDate: '',
        value: '',
        billingCycle: 'monthly'
      };

      const existingClients = [...new Set(
        this.state.contracts
          .map(c => c.clientName)
          .filter(Boolean)
      )].sort((a, b) => a.localeCompare(b, 'th'));

      dialogHtml += `
        <div class="modal-overlay" id="contract-dialog-overlay">
          <div class="modal-content">
            <h2>${contractDialog.mode === 'add' ? 'เพิ่มสัญญา' : 'แก้ไขสัญญา'}</h2>
            <form id="contract-form">
              <div class="form-group">
                <label>ชื่อสัญญา</label>
                <input type="text" name="name" value="${data.name}" required />
              </div>
              <div class="form-group">
                <label>ชื่อลูกค้า</label>
                <input
                  type="text"
                  name="clientName"
                  value="${data.clientName}"
                  list="client-name-list"
                  placeholder="พิมพ์ชื่อลูกค้าใหม่ หรือเลือกจากลูกค้าเดิม"
                  autocomplete="off"
                  required
                />
                <datalist id="client-name-list">
                  ${existingClients.map(name => `<option value="${name}"></option>`).join('')}
                </datalist>
                <small class="field-hint">
                  💡 ถ้าเป็นสัญญาใหม่ของลูกค้าเดิม ให้เลือกชื่อจากรายการที่แนะนำ
                </small>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>วันเริ่มต้น</label>
                  <input type="date" name="startDate" value="${data.startDate}" required />
                </div>
                <div class="form-group">
                  <label>วันสิ้นสุด</label>
                  <input type="date" name="endDate" value="${data.endDate}" required />
                </div>
              </div>
              <div class="form-group">
                <label>มูลค่าสัญญา (บาท)</label>
                <input type="number" name="value" value="${data.value || ''}" min="0" step="0.01" placeholder="0.00" required />
              </div>
              <div class="form-group">
                <label>ประเภทการบิล</label>
                <select name="billingCycle" required>
                  ${this.state.billingCycles.map(cycle => `
                    <option value="${cycle.value}" ${data.billingCycle === cycle.value ? 'selected' : ''}>
                      ${cycle.label}
                    </option>
                  `).join('')}
                </select>
              </div>
              <div class="modal-actions">
                <button type="submit" class="btn btn-primary">บันทึก</button>
                <button type="button" class="btn btn-secondary" id="btn-cancel-contract">ยกเลิก</button>
              </div>
            </form>
          </div>
        </div>
      `;
    }

    // Services Dialog
    if (servicesDialog.isOpen) {
      const contract = this.state.contracts.find(c => c.id === servicesDialog.contractId);
      if (contract) {
        dialogHtml += `
          <div class="modal-overlay" id="services-dialog-overlay">
            <div class="modal-content">
              <h2>บริการสำหรับ: ${contract.name}</h2>
              <div class="services-list">
                ${contract.services.map((service, idx) => {
                  const linkedTaskCount = this.state.tasks.filter(t => t.serviceId === service.id).length;
                  return `
                  <div class="service-item">
                    <div class="service-reorder">
                      <button class="btn-small btn-move-service-up" data-service-idx="${idx}" data-contract-id="${contract.id}" title="เลื่อนขึ้น" ${idx === 0 ? 'disabled' : ''}>▲</button>
                      <button class="btn-small btn-move-service-down" data-service-idx="${idx}" data-contract-id="${contract.id}" title="เลื่อนลง" ${idx === contract.services.length - 1 ? 'disabled' : ''}>▼</button>
                    </div>
                    <div>
                      <strong>${service.name}</strong>
                      <p style="color:#666; font-size:0.9em">${service.description}</p>
                      <button class="btn-small btn-view-service-tasks" data-service-id="${service.id}" title="ดูงานที่ผูกกับบริการนี้">
                        ✓ ${linkedTaskCount} งาน
                      </button>
                    </div>
                    <button class="btn-small btn-delete" data-service-idx="${idx}" data-contract-id="${contract.id}">
                      🗑️
                    </button>
                  </div>
                `;
                }).join('')}
              </div>
              <form id="service-form">
                <div class="form-group">
                  <label>ชื่อบริการ</label>
                  <input type="text" name="serviceName" placeholder="เช่น UI/UX Design" required />
                </div>
                <div class="form-group">
                  <label>รายละเอียด</label>
                  <input type="text" name="serviceDesc" placeholder="รายละเอียดของบริการ" />
                </div>
                <button type="submit" class="btn btn-primary">เพิ่มบริการ</button>
              </form>
              <div class="modal-actions">
                <button type="button" class="btn btn-secondary" id="btn-close-services">ปิด</button>
              </div>
            </div>
          </div>
        `;
      }
    }

    // Payment Plan Dialog
    if (paymentPlanDialog.isOpen) {
      const ppContract = this.state.contracts.find(c => c.id === paymentPlanDialog.contractId);
      const draft = paymentPlanDialog.draft;
      if (ppContract && draft) {
        const depositAmount = this.getDepositAmount(ppContract, draft);
        const installmentsTotal = draft.installments.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
        const planTotal = depositAmount + installmentsTotal;
        const contractValue = ppContract.value || 0;
        const diff = Math.round((contractValue - planTotal) * 100) / 100;

        dialogHtml += `
          <div class="modal-overlay" id="payment-plan-dialog-overlay">
            <div class="modal-content" style="max-width: 600px;">
              <h2>แผนชำระเงิน: ${ppContract.name}</h2>
              <p style="color:#666; font-size:0.9em; margin-top:-0.5rem;">
                มูลค่าสัญญา: ${this.formatCurrency(contractValue)}
              </p>

              <div class="form-row">
                <div class="form-group">
                  <label>ค่ามัดจำ</label>
                  <select id="pp-deposit-type">
                    <option value="percent" ${draft.depositType === 'percent' ? 'selected' : ''}>เปอร์เซ็นต์ (%)</option>
                    <option value="amount" ${draft.depositType === 'amount' ? 'selected' : ''}>จำนวนเงิน (บาท)</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>&nbsp;</label>
                  <input type="number" id="pp-deposit-value" min="0" step="0.01" value="${draft.depositValue}" />
                </div>
              </div>
              <p style="color:#666; font-size:0.85em; margin-top:-0.5rem;">
                = ${this.formatCurrency(depositAmount)}
              </p>

              <div class="form-row" style="align-items:flex-end;">
                <div class="form-group">
                  <label>แบ่งจ่าย (จำนวนงวด)</label>
                  <div class="installment-count-input">
                    <input type="number" id="pp-installment-count" min="1" step="1" value="${draft.installmentCount}" />
                    <div class="installment-count-presets">
                      <button type="button" class="btn-small btn-preset-count" data-count="1">1</button>
                      <button type="button" class="btn-small btn-preset-count" data-count="3">3</button>
                      <button type="button" class="btn-small btn-preset-count" data-count="6">6</button>
                      <button type="button" class="btn-small btn-preset-count" data-count="12">12</button>
                    </div>
                  </div>
                </div>
                <div class="form-group">
                  <button type="button" class="btn btn-secondary" id="btn-generate-installments">
                    🔄 สร้างงวดอัตโนมัติ (แบ่งเท่ากัน)
                  </button>
                </div>
              </div>

              ${draft.installments.length > 0 ? `
                <div class="installment-bulk-bar">
                  <label class="installment-select-all">
                    <input type="checkbox" id="chk-select-all-installments" />
                    เลือกทั้งหมด
                  </label>
                  <button type="button" class="btn-small btn-delete" id="btn-delete-selected-installments" disabled>
                    🗑️ ลบที่เลือก (<span id="selected-installment-count">0</span>)
                  </button>
                </div>
              ` : ''}

              <div class="installments-list">
                ${draft.installments.length === 0 ? `
                  <p style="color:#999; text-align:center; padding: 1rem 0;">ยังไม่มีงวดชำระ กด "สร้างงวดอัตโนมัติ" หรือเพิ่มงวดเอง</p>
                ` : draft.installments.map((inst, idx) => `
                  <div class="installment-row" data-idx="${idx}">
                    <input type="checkbox" class="inst-select" data-idx="${idx}" />
                    <input type="text" class="inst-label" data-idx="${idx}" value="${inst.label}" placeholder="งวดที่ ${idx + 1}" />
                    <input type="date" class="inst-date" data-idx="${idx}" value="${inst.dueDate || ''}" />
                    <input type="number" class="inst-amount" data-idx="${idx}" min="0" step="0.01" value="${inst.amount}" />
                    <button type="button" class="btn-small btn-duplicate-installment" data-idx="${idx}" title="ทำซ้ำงวดนี้">📋+</button>
                    <button type="button" class="btn-small btn-delete btn-remove-installment" data-idx="${idx}" title="ลบงวดนี้">🗑️</button>
                  </div>
                `).join('')}
              </div>

              <div class="installment-add-bulk">
                <button type="button" class="btn btn-secondary" id="btn-add-installment">
                  + เพิ่มงวดเอง
                </button>
                <span style="color:#999; font-size:0.85rem;">หรือ</span>
                <input type="number" id="bulk-add-count" min="1" value="3" style="width:60px;" />
                <button type="button" class="btn btn-secondary" id="btn-add-installments-bulk">
                  + เพิ่มหลายงวดพร้อมกัน
                </button>
              </div>

              <div class="payment-plan-summary ${diff !== 0 ? 'mismatch' : ''}">
                มัดจำ + งวดรวม = ${this.formatCurrency(planTotal)}
                ${diff !== 0 ? `<strong> (${diff > 0 ? 'ขาดอีก' : 'เกินไป'} ${this.formatCurrency(Math.abs(diff))})</strong>` : ' ✓ ตรงกับมูลค่าสัญญา'}
              </div>

              <div class="modal-actions">
                <button type="button" class="btn btn-primary" id="btn-save-payment-plan">บันทึกแผนชำระเงิน</button>
                <button type="button" class="btn btn-secondary" id="btn-cancel-payment-plan">ยกเลิก</button>
              </div>
            </div>
          </div>
        `;
      }
    }

    // Project Dialog
    if (projectDialog.isOpen) {
      const data = {
        name: '',
        contractId: '',
        description: '',
        budgetValue: '',
        startDate: '',
        dueDate: '',
        status: 'in-progress',
        ...(projectDialog.data || {})
      };
      const stats = data.id ? this.getProjectTaskStats(data.id) : { total: 0, completed: 0, percent: 0 };
      const projectCostTotal = data.id ? this.getProjectCostTotal(data.id) : 0;
      const suggestedBudget = data.contractId ? this.getSuggestedProjectBudget(data.contractId) : null;
      if (!data.budgetValue && suggestedBudget) {
        data.budgetValue = suggestedBudget;
      }

      dialogHtml += `
        <div class="modal-overlay" id="project-dialog-overlay">
          <div class="modal-content">
            <h2>${projectDialog.mode === 'add' ? 'เพิ่มโปรเจค' : 'แก้ไขโปรเจค'}</h2>
            <form id="project-form">
              <div class="form-group">
                <label>ชื่อโปรเจค</label>
                <input type="text" name="name" value="${data.name}" placeholder="ชื่อโปรเจค" required />
              </div>
              <div class="form-group">
                <label>สัญญา</label>
                <select name="contractId" id="project-contract-select" required>
                  <option value="">-- เลือกสัญญา --</option>
                  ${this.state.contracts.map(c => `
                    <option value="${c.id}" data-suggested-budget="${this.getSuggestedProjectBudget(c.id) || ''}" ${data.contractId === c.id ? 'selected' : ''}>
                      ${c.name}
                    </option>
                  `).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>รายละเอียด</label>
                <textarea name="description" placeholder="รายละเอียดของโปรเจค" rows="3">${data.description}</textarea>
              </div>
              <div class="form-group">
                <label>มูลค่าโปรเจค (รายได้อ้างอิง)</label>
                <input type="number" name="budgetValue" id="project-budget-input" value="${data.budgetValue}" placeholder="เช่น 120000" min="0" step="0.01" />
                <small class="field-hint" id="project-budget-hint">
                  ${suggestedBudget
                    ? `เติมให้อัตโนมัติจากแผนการชำระเงินของสัญญา (แบ่งงวดเท่ากัน) — แก้ไขเองได้ถ้าโปรเจคนี้ไม่ได้ผูกกับงวดชำระแบบนั้น`
                    : `ถ้าไม่ระบุ จะไม่คำนวณกำไร (Margin) ให้ในโปรเจคนี้`
                  }
                </small>
              </div>
              <div class="form-group">
                <label>ความคืบหน้า</label>
                <p class="field-hint" style="margin-top:0;">
                  ${stats.completed}/${stats.total} งาน (${stats.percent}%) — คำนวณอัตโนมัติจากงานในเมนู "งาน" ไม่ต้องกรอกเอง
                </p>
                ${data.id ? `
                  <p class="field-hint" style="margin-top:0;">
                    ต้นทุนรวมของโปรเจคนี้ (จากงานทั้งหมด): <strong>${this.formatCurrency(projectCostTotal)}</strong>
                  </p>
                ` : ''}
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>สถานะ</label>
                  <select name="status" required>
                    <option value="in-progress" ${data.status === 'in-progress' ? 'selected' : ''}>ดำเนินการ</option>
                    <option value="completed" ${data.status === 'completed' ? 'selected' : ''}>เสร็จสิ้น</option>
                    <option value="pending" ${data.status === 'pending' ? 'selected' : ''}>รอดำเนินการ</option>
                  </select>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>วันเริ่มต้น</label>
                  <input type="date" name="startDate" value="${data.startDate}" required />
                </div>
                <div class="form-group">
                  <label>วันครบกำหนด</label>
                  <input type="date" name="dueDate" value="${data.dueDate}" required />
                </div>
              </div>
              <div class="modal-actions">
                <button type="submit" class="btn btn-primary">บันทึก</button>
                <button type="button" class="btn btn-secondary" id="btn-cancel-project">ยกเลิก</button>
              </div>
            </form>
          </div>
        </div>
      `;
    }

    // Task Dialog
    if (taskDialog.isOpen) {
      const data = {
        title: '',
        description: '',
        projectId: '',
        assigneeId: '',
        assigneeRoleId: '',
        costItemId: '',
        costItemTierId: '',
        costItemQuantity: '',
        serviceId: '',
        priority: 'medium',
        status: 'pending',
        startDate: '',
        dueDate: '',
        ...(taskDialog.data || {})
      };

      const taskSelectedProject = this.state.projects.find(p => p.id === data.projectId);
      const taskRelatedContract = taskSelectedProject
        ? this.state.contracts.find(c => c.id === taskSelectedProject.contractId)
        : null;
      const taskAvailableServices = taskRelatedContract ? (taskRelatedContract.services || []) : [];

      dialogHtml += `
        <div class="modal-overlay" id="task-dialog-overlay">
          <div class="modal-content">
            <h2>${taskDialog.mode === 'add' ? 'เพิ่มงาน' : 'แก้ไขงาน'}</h2>
            <form id="task-form">
              <div class="form-group">
                <label>ชื่องาน</label>
                <input type="text" name="title" id="task-title-input" value="${data.title}" placeholder="ชื่องาน" list="task-title-list" autocomplete="off" required />
                <datalist id="task-title-list">
                  ${[...new Set(
                    this.state.tasks
                      .filter(t => t.projectId === data.projectId)
                      .map(t => t.title)
                      .filter(Boolean)
                  )].map(title => `<option value="${title}"></option>`).join('')}
                </datalist>
              </div>
              <div class="form-group">
                <label>โปรเจค</label>
                <select name="projectId" id="task-project-select" required>
                  <option value="">-- เลือกโปรเจค --</option>
                  ${this.state.projects.map(p => `
                    <option value="${p.id}" ${data.projectId === p.id ? 'selected' : ''}>
                      ${p.name}
                    </option>
                  `).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>บริการที่เกี่ยวข้อง</label>
                <select name="serviceId" id="task-service-select">
                  <option value="">-- ไม่ผูกกับบริการ --</option>
                  ${taskAvailableServices.map(s => `
                    <option value="${s.id}" ${data.serviceId === s.id ? 'selected' : ''}>
                      ${s.name}
                    </option>
                  `).join('')}
                </select>
                ${taskAvailableServices.length === 0 ? `
                  <small class="field-hint">โปรเจคนี้ยังไม่มีบริการให้เลือก (เพิ่มได้ที่หน้าสัญญา → บริการ)</small>
                ` : ''}
              </div>
              <div class="form-group">
                <label>รายละเอียด</label>
                <textarea name="description" placeholder="รายละเอียดของงาน" rows="3">${data.description}</textarea>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>ผู้รับผิดชอบ</label>
                  <select name="assigneeId" id="task-assignee-select">
                    <option value="">-- ไม่ระบุ --</option>
                    ${this.state.people.map(p => `
                      <option value="${p.id}" ${data.assigneeId === p.id ? 'selected' : ''}>
                        ${p.name}
                      </option>
                    `).join('')}
                  </select>
                  ${this.state.people.length === 0 ? `
                    <small class="field-hint">ยังไม่มีข้อมูลบุคคล ไปเพิ่มที่เมนู "บุคคล" ก่อน</small>
                  ` : ''}
                </div>
                <div class="form-group">
                  <label>บทบาทของผู้รับผิดชอบ</label>
                  <select name="assigneeRoleId" id="task-assignee-role-select">
                    <option value="">-- ไม่ระบุ --</option>
                    ${(() => {
                      const assignedPerson = this.state.people.find(p => p.id === data.assigneeId);
                      const roles = assignedPerson ? (assignedPerson.roles || []) : [];
                      return roles.map(r => `
                        <option value="${r.id}" data-rate-type="${r.rateType || 'monthly'}" ${data.assigneeRoleId === r.id ? 'selected' : ''}>
                          ${r.position} (${this.getRoleRateLabel(r)})
                        </option>
                      `).join('');
                    })()}
                  </select>
                </div>
              </div>
              ${(() => {
                const assignedPerson = this.state.people.find(p => p.id === data.assigneeId);
                const assignedRole = assignedPerson ? (assignedPerson.roles || []).find(r => r.id === data.assigneeRoleId) : null;
                const showPieceQty = assignedRole && assignedRole.rateType === 'piece';
                return `
                  <div class="form-group" id="task-labor-quantity-group" style="${showPieceQty ? '' : 'display:none;'}">
                    <label>จำนวนชิ้นงาน</label>
                    <input type="number" name="laborQuantity" id="task-labor-quantity-input" value="${data.laborQuantity || 1}" min="1" step="1" />
                    <small class="field-hint">ค่าแรงจะคำนวณเป็น อัตรา/ชิ้น × จำนวนชิ้นนี้</small>
                  </div>
                `;
              })()}
              <div class="form-row">
                <div class="form-group">
                  <label>รายการต้นทุนที่เกี่ยวข้อง</label>
                  <select name="costItemId" id="task-cost-item-select">
                    <option value="">-- ไม่ผูกกับรายการต้นทุน --</option>
                    ${this.state.costItems.map(ci => `
                      <option value="${ci.id}" ${data.costItemId === ci.id ? 'selected' : ''}>
                        ${ci.name}
                      </option>
                    `).join('')}
                  </select>
                  ${this.state.costItems.length === 0 ? `
                    <small class="field-hint">ยังไม่มีรายการต้นทุน ไปเพิ่มที่เมนู "ต้นทุน" ก่อน</small>
                  ` : ''}
                </div>
                <div class="form-group">
                  <label>Tier ราคา</label>
                  <select name="costItemTierId" id="task-cost-item-tier-select">
                    <option value="">-- ไม่ระบุ --</option>
                    ${(() => {
                      const selectedCostItem = this.state.costItems.find(ci => ci.id === data.costItemId);
                      const tiers = selectedCostItem ? (selectedCostItem.tiers || []) : [];
                      return tiers.map(t => `
                        <option value="${t.id}" data-calc-mode="${t.calcMode || 'divide'}" ${data.costItemTierId === t.id ? 'selected' : ''}>
                          ${t.label} (${this.getCostItemTierLabel(t)})
                        </option>
                      `).join('');
                    })()}
                  </select>
                </div>
              </div>
              ${(() => {
                const selectedCostItem = this.state.costItems.find(ci => ci.id === data.costItemId);
                const selectedTier = selectedCostItem ? (selectedCostItem.tiers || []).find(t => t.id === data.costItemTierId) : null;
                const showQty = selectedTier && selectedTier.calcMode === 'multiply';
                return `
                  <div class="form-group" id="task-cost-item-quantity-group" style="${showQty ? '' : 'display:none;'}">
                    <label>จำนวนคน</label>
                    <input type="number" name="costItemQuantity" id="task-cost-item-quantity-input" value="${data.costItemQuantity || 1}" min="1" step="1" />
                    <small class="field-hint">ต้นทุนจะคำนวณเป็น อัตรา × จำนวนคนนี้</small>
                  </div>
                `;
              })()}
              <div class="form-group">
                <label>ความสำคัญ</label>
                <select name="priority" required>
                  <option value="high" ${data.priority === 'high' ? 'selected' : ''}>🔴 สูง</option>
                  <option value="medium" ${data.priority === 'medium' ? 'selected' : ''}>🟡 กลาง</option>
                  <option value="low" ${data.priority === 'low' ? 'selected' : ''}>🟢 ต่ำ</option>
                </select>
              </div>
              <div class="form-group">
                <label>สถานะ</label>
                <select name="status" required>
                  <option value="pending" ${data.status === 'pending' ? 'selected' : ''}>รอดำเนินการ</option>
                  <option value="in-progress" ${data.status === 'in-progress' ? 'selected' : ''}>ดำเนินการ</option>
                  <option value="completed" ${data.status === 'completed' ? 'selected' : ''}>เสร็จสิ้น</option>
                </select>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>วันเริ่มต้น</label>
                  <input type="date" name="startDate" value="${data.startDate}" />
                </div>
                <div class="form-group">
                  <label>วันครบกำหนด</label>
                  <input type="date" name="dueDate" value="${data.dueDate}" required />
                </div>
              </div>
              <div class="modal-actions">
                <button type="submit" class="btn btn-primary">บันทึก</button>
                <button type="button" class="btn btn-secondary" id="btn-cancel-task">ยกเลิก</button>
              </div>
            </form>
          </div>
        </div>
      `;
    }

    // Task Costs Dialog
    if (taskCostsDialog.isOpen) {
      const task = this.state.tasks.find(t => t.id === taskCostsDialog.taskId);
      if (task) {
        const taskCosts = this.state.costs.filter(c => c.taskId === task.id);
        const explicitTotal = this.getTaskExplicitCostTotal(task.id);
        const laborCost = this.getTaskLaborCost(task);
        const costItemCost = this.getTaskCostItemCost(task);
        const total = explicitTotal + laborCost + costItemCost;
        const getCostTypeLabel = (type) => this.state.costTypes.find(t => t.value === type)?.label || type;

        const person = task.assigneeId ? this.state.people.find(p => p.id === task.assigneeId) : null;
        const role = person ? (person.roles || []).find(r => r.id === task.assigneeRoleId) : null;
        const roleTaskCount = role ? this.state.tasks.filter(t =>
          t.assigneeId === task.assigneeId && t.assigneeRoleId === task.assigneeRoleId && t.projectId === task.projectId
        ).length : 0;

        const costItem = task.costItemId ? this.state.costItems.find(ci => ci.id === task.costItemId) : null;
        const costItemTier = costItem ? (costItem.tiers || []).find(t => t.id === task.costItemTierId) : null;
        const costItemTaskCount = costItemTier ? this.state.tasks.filter(t =>
          t.costItemId === task.costItemId && t.costItemTierId === task.costItemTierId
        ).length : 0;

        dialogHtml += `
          <div class="modal-overlay" id="task-costs-dialog-overlay">
            <div class="modal-content">
              <h2>ต้นทุนของงาน: ${task.title}</h2>
              ${taskCosts.length === 0 && !role && !costItemTier ? `
                <p style="color:#999; text-align:center; padding: 1rem 0;">ยังไม่มีต้นทุนผูกกับงานนี้</p>
              ` : `
                <div class="services-list">
                  ${role ? `
                    <div class="service-item">
                      <div>
                        <strong>👤 ค่าแรง: ${person.name} (${role.position})</strong>
                        <p style="color:#666; font-size:0.9em">
                          ${role.rateType === 'piece'
                            ? `${this.getRoleRateLabel(role)} × ${Number(task.laborQuantity) || 1} ชิ้น = ${this.formatCurrency(laborCost)}`
                            : `${this.getRoleRateLabel(role)} ÷ ${roleTaskCount} งาน = ${this.formatCurrency(laborCost)}`
                          }
                        </p>
                      </div>
                    </div>
                  ` : ''}
                  ${costItemTier ? `
                    <div class="service-item">
                      <div>
                        <strong>🗂️ ${costItem.name} (${costItemTier.label})</strong>
                        <p style="color:#666; font-size:0.9em">
                          ${costItemTier.calcMode === 'multiply'
                            ? `${this.getCostItemTierLabel(costItemTier)} × ${Number(task.costItemQuantity) || 1} คน = ${this.formatCurrency(costItemCost)}`
                            : costItemTier.calcMode === 'flat'
                            ? `${this.getCostItemTierLabel(costItemTier)} (คิดเต็มอัตราต่อคน) = ${this.formatCurrency(costItemCost)}`
                            : `${this.getCostItemTierLabel(costItemTier)} ÷ ${costItemTaskCount} งาน = ${this.formatCurrency(costItemCost)}`
                          }
                        </p>
                      </div>
                    </div>
                  ` : ''}
                  ${taskCosts.map(cost => `
                    <div class="service-item">
                      <div>
                        <strong>${cost.name}</strong>
                        <p style="color:#666; font-size:0.9em">
                          ${getCostTypeLabel(cost.type)} · ${this.formatCurrency(cost.amount)} · ${this.formatDate(cost.date)}
                        </p>
                      </div>
                    </div>
                  `).join('')}
                </div>
                <div class="payment-plan-summary">
                  รวมต้นทุนของงานนี้: ${this.formatCurrency(total)}
                </div>
              `}
              ${(() => {
                const project = task.projectId ? this.state.projects.find(p => p.id === task.projectId) : null;
                if (!project) return '';
                const fin = this.getProjectFinancials(project.id);
                return `
                  <div class="services-list" style="margin-top:0.75rem;">
                    <div class="service-item">
                      <div>
                        <strong>📦 การเงินของโปรเจค: ${project.name}</strong>
                        <p style="color:#666; font-size:0.9em">
                          ${fin.hasRevenue
                            ? `รายได้ ${this.formatCurrency(fin.revenue)} · ต้นทุนรวม ${this.formatCurrency(fin.cost)} · กำไร <span class="${fin.margin >= 0 ? 'margin-positive' : 'margin-negative'}">${this.formatCurrency(fin.margin)} (${fin.marginPercent.toFixed(1)}%)</span>`
                            : `ยังไม่ได้ระบุมูลค่าโปรเจค · ต้นทุนรวมของทั้งโปรเจค ${this.formatCurrency(fin.cost)}`
                          }
                        </p>
                      </div>
                      <button class="btn-small btn-view-project-financials-from-task" data-project-id="${project.id}" title="ดูรายละเอียดการเงินของโปรเจคนี้">💹</button>
                    </div>
                  </div>
                `;
              })()}
              <div class="modal-actions">
                <button type="button" class="btn btn-secondary" id="btn-close-task-costs">ปิด</button>
              </div>
            </div>
          </div>
        `;
      }
    }

    // Project Financials Dialog
    if (projectFinancialsDialog.isOpen) {
      const project = this.state.projects.find(p => p.id === projectFinancialsDialog.projectId);
      if (project) {
        const fin = this.getProjectFinancials(project.id);

        dialogHtml += `
          <div class="modal-overlay" id="project-financials-dialog-overlay">
            <div class="modal-content">
              <h2>การเงินของโปรเจค: ${project.name}</h2>
              ${!fin.hasRevenue ? `
                <p style="color:#999; text-align:center; padding: 1rem 0;">
                  ยังไม่ได้ระบุ "มูลค่าโปรเจค" — ไปกำหนดที่หน้าแก้ไขโปรเจคก่อน จึงจะคำนวณกำไรได้
                </p>
                <p class="field-hint">ต้นทุนรวมของโปรเจคนี้ (จากงานทั้งหมด): <strong>${this.formatCurrency(fin.cost)}</strong></p>
              ` : `
                <div class="services-list">
                  <div class="service-item">
                    <div>
                      <strong>💰 มูลค่าโปรเจค (รายได้)</strong>
                      <p style="color:#666; font-size:0.9em">${this.formatCurrency(fin.revenue)}</p>
                    </div>
                  </div>
                  <div class="service-item">
                    <div>
                      <strong>🧾 ต้นทุนรวม</strong>
                      <p style="color:#666; font-size:0.9em">${this.formatCurrency(fin.cost)}</p>
                    </div>
                  </div>
                  <div class="service-item">
                    <div>
                      <strong>${fin.margin >= 0 ? '📈' : '📉'} กำไร (Margin)</strong>
                      <p style="color:#666; font-size:0.9em">
                        ${this.formatCurrency(fin.margin)} (${fin.marginPercent.toFixed(1)}%)
                      </p>
                    </div>
                  </div>
                  ${fin.months ? `
                    <div class="service-item">
                      <div>
                        <strong>📅 เฉลี่ยต่อเดือน</strong>
                        <p style="color:#666; font-size:0.9em">
                          รายได้ ${this.formatCurrency(fin.monthlyRevenue)}/เดือน · กำไร ${this.formatCurrency(fin.monthlyMargin)}/เดือน (${fin.months} เดือน)
                        </p>
                      </div>
                    </div>
                  ` : ''}
                </div>
              `}
              <div class="modal-actions">
                <button type="button" class="btn btn-secondary" id="btn-close-project-financials">ปิด</button>
              </div>
            </div>
          </div>
        `;
      }
    }

    // People Dialog
    if (peopleDialog.isOpen) {
      const data = { name: '', ...(peopleDialog.data || {}) };

      dialogHtml += `
        <div class="modal-overlay" id="people-dialog-overlay">
          <div class="modal-content">
            <h2>${peopleDialog.mode === 'add' ? 'เพิ่มบุคคล' : 'แก้ไขชื่อบุคคล'}</h2>
            <form id="people-form">
              <div class="form-group">
                <label>ชื่อ</label>
                <input type="text" name="name" value="${data.name}" placeholder="ชื่อ-นามสกุล" required />
              </div>
              ${peopleDialog.mode === 'add' ? `
                <p class="field-hint" style="margin-top:0;">
                  💡 บันทึกชื่อก่อน แล้วกดปุ่ม "🎭 จัดการบทบาท" ที่รายการ เพื่อเพิ่มตำแหน่งและอัตราค่าจ้าง
                </p>
              ` : ''}
              <div class="modal-actions">
                <button type="submit" class="btn btn-primary">บันทึก</button>
                <button type="button" class="btn btn-secondary" id="btn-cancel-people">ยกเลิก</button>
              </div>
            </form>
          </div>
        </div>
      `;
    }

    // Person Roles Dialog
    if (personRolesDialog.isOpen) {
      const person = this.state.people.find(p => p.id === personRolesDialog.personId);
      if (person) {
        const editingRole = personRolesDialog.editingRoleId
          ? (person.roles || []).find(r => r.id === personRolesDialog.editingRoleId)
          : null;
        const roleFormData = editingRole || { position: '', responsibility: '', rateType: 'monthly', rateValue: '' };

        dialogHtml += `
          <div class="modal-overlay" id="person-roles-dialog-overlay">
            <div class="modal-content">
              <h2>บทบาทของ: ${person.name}</h2>
              <div class="services-list">
                ${(person.roles || []).length === 0 ? `
                  <p style="color:#999; text-align:center; padding: 1rem 0;">ยังไม่มีบทบาท เพิ่มด้านล่างได้เลย</p>
                ` : person.roles.map(role => {
                  const costInfo = this.getRoleCostBreakdown(person.id, role.id);
                  return `
                  <div class="service-item">
                    <div>
                      <strong>${role.position}</strong>
                      <p style="color:#666; font-size:0.9em">
                        ${role.responsibility || '-'} · ${this.getRoleRateLabel(role)}
                      </p>
                      ${costInfo.taskCount > 0 ? `
                        <div class="role-cost-breakdown">
                          <small>
                            ${costInfo.costPerTask === null
                              ? `📊 ${costInfo.taskCount} งาน${!costInfo.isPiece ? ` (${costInfo.projectCount} โปรเจค)` : ''} → ต้นทุนรวม: <strong>${this.formatCurrency(costInfo.totalCost)}</strong>`
                              : `📊 ${costInfo.taskCount} งาน → ต้นทุนเฉลี่ย/งาน: <strong>${this.formatCurrency(costInfo.costPerTask)}</strong>`
                            }
                          </small>
                          <ul class="role-cost-breakdown-list">
                            ${costInfo.breakdown.map(b => `
                              <li>${b.name}: ${b.count} งาน — ${this.formatCurrency(b.cost)}</li>
                            `).join('')}
                          </ul>
                        </div>
                      ` : `
                        <small style="color:#999;">ยังไม่มีงานที่ผูกกับบทบาทนี้</small>
                      `}
                    </div>
                    <button class="btn-small btn-edit-role" data-person-id="${person.id}" data-role-id="${role.id}" title="แก้ไขบทบาท">✎</button>
                    <button class="btn-small btn-delete-role" data-person-id="${person.id}" data-role-id="${role.id}" title="ลบบทบาท">🗑️</button>
                  </div>
                `;
                }).join('')}
              </div>
              <form id="role-form">
                <div class="form-group">
                  <label>ตำแหน่ง</label>
                  <input type="text" name="position" value="${roleFormData.position}" placeholder="เช่น UI/UX Designer" required />
                </div>
                <div class="form-group">
                  <label>ความรับผิดชอบ</label>
                  <textarea name="responsibility" placeholder="หน้าที่หลักที่รับผิดชอบในบทบาทนี้" rows="2">${roleFormData.responsibility}</textarea>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label>ประเภทอัตราต้นทุน</label>
                    <select name="rateType" required>
                      <option value="monthly" ${roleFormData.rateType === 'monthly' ? 'selected' : ''}>รายเดือน (พนักงานประจำ)</option>
                      <option value="daily" ${roleFormData.rateType === 'daily' ? 'selected' : ''}>รายวัน (ฟรีแลนซ์)</option>
                      <option value="project" ${roleFormData.rateType === 'project' ? 'selected' : ''}>รายครั้ง (เหมาโปรเจค)</option>
                      <option value="piece" ${roleFormData.rateType === 'piece' ? 'selected' : ''}>รายชิ้น</option>
                      <option value="hourly" ${roleFormData.rateType === 'hourly' ? 'selected' : ''}>รายชั่วโมง (OT/ล่วงเวลา)</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label>อัตราต้นทุน (บาท)</label>
                    <input type="number" name="rateValue" value="${roleFormData.rateValue}" min="0" step="0.01" required />
                  </div>
                </div>
                <div class="modal-actions">
                  <button type="submit" class="btn btn-primary">${editingRole ? 'บันทึกการแก้ไข' : '+ เพิ่มบทบาท'}</button>
                  ${editingRole ? `<button type="button" class="btn btn-secondary" id="btn-cancel-edit-role">ยกเลิกแก้ไข</button>` : ''}
                </div>
              </form>
              <div class="modal-actions">
                <button type="button" class="btn btn-secondary" id="btn-close-person-roles">ปิด</button>
              </div>
            </div>
          </div>
        `;
      }
    }

    // Cost Item Dialog
    if (costItemDialog.isOpen) {
      const data = { name: '', ...(costItemDialog.data || {}) };

      dialogHtml += `
        <div class="modal-overlay" id="cost-item-dialog-overlay">
          <div class="modal-content">
            <h2>${costItemDialog.mode === 'add' ? 'เพิ่มรายการต้นทุน' : 'แก้ไขชื่อรายการต้นทุน'}</h2>
            <form id="cost-item-form">
              <div class="form-group">
                <label>ชื่อรายการ</label>
                <input type="text" name="name" value="${data.name}" placeholder="เช่น Adobe Creative Cloud License" required />
              </div>
              ${costItemDialog.mode === 'add' ? `
                <p class="field-hint" style="margin-top:0;">
                  💡 บันทึกชื่อก่อน แล้วกดปุ่ม "🗂️ จัดการ Tier" ที่รายการ เพื่อเพิ่มตัวเลือกราคา
                </p>
              ` : ''}
              <div class="modal-actions">
                <button type="submit" class="btn btn-primary">บันทึก</button>
                <button type="button" class="btn btn-secondary" id="btn-cancel-cost-item">ยกเลิก</button>
              </div>
            </form>
          </div>
        </div>
      `;
    }

    // Cost Item Tiers Dialog
    if (costItemTiersDialog.isOpen) {
      const costItem = this.state.costItems.find(ci => ci.id === costItemTiersDialog.costItemId);
      if (costItem) {
        const editingTier = costItemTiersDialog.editingTierId
          ? (costItem.tiers || []).find(t => t.id === costItemTiersDialog.editingTierId)
          : null;
        const tierFormData = editingTier || { label: '', rateType: 'monthly', rateValue: '', calcMode: 'divide' };

        dialogHtml += `
          <div class="modal-overlay" id="cost-item-tiers-dialog-overlay">
            <div class="modal-content">
              <h2>Tier ราคาของ: ${costItem.name}</h2>
              <div class="services-list">
                ${(costItem.tiers || []).length === 0 ? `
                  <p style="color:#999; text-align:center; padding: 1rem 0;">ยังไม่มี Tier เพิ่มด้านล่างได้เลย</p>
                ` : costItem.tiers.map(tier => {
                  const breakdown = this.getCostItemTierBreakdown(costItem.id, tier.id);
                  const modeLabel = tier.calcMode === 'multiply' ? '✖️ คูณตามจำนวนคน' : tier.calcMode === 'flat' ? '👤 คิดเต็มอัตราต่อคน' : '➗ หารเฉลี่ยตามงานที่ใช้ร่วมกัน';
                  return `
                  <div class="service-item">
                    <div>
                      <strong>${tier.label}</strong>
                      <p style="color:#666; font-size:0.9em">
                        ${this.getCostItemTierLabel(tier)} · ${modeLabel}
                      </p>
                      ${breakdown.taskCount === 0 ? `
                        <small style="color:#999;">ยังไม่มีงานที่ผูกกับ Tier นี้</small>
                      ` : tier.calcMode === 'multiply' ? `
                        <small>📊 ${breakdown.taskCount} งาน · รวม ${breakdown.totalQuantity} คน → ต้นทุนรวม: <strong>${this.formatCurrency(breakdown.totalCost)}</strong></small>
                      ` : tier.calcMode === 'flat' ? `
                        <small>📊 ${breakdown.taskCount} งาน → ต้นทุนรวม: <strong>${this.formatCurrency(breakdown.totalCost)}</strong></small>
                      ` : `
                        <small>📊 ${breakdown.taskCount} งาน → ต้นทุนเฉลี่ย/งาน: <strong>${this.formatCurrency(breakdown.costPerTask)}</strong></small>
                      `}
                    </div>
                    <button class="btn-small btn-edit-cost-item-tier" data-cost-item-id="${costItem.id}" data-tier-id="${tier.id}" title="แก้ไข Tier">✎</button>
                    <button class="btn-small btn-delete-cost-item-tier" data-cost-item-id="${costItem.id}" data-tier-id="${tier.id}" title="ลบ Tier">🗑️</button>
                  </div>
                `;
                }).join('')}
              </div>
              <form id="cost-item-tier-form">
                <div class="form-group">
                  <label>ชื่อ Tier</label>
                  <input type="text" name="label" value="${tierFormData.label}" placeholder="เช่น 1 user, 5 users (ลดราคา)" required />
                </div>
                <div class="form-group">
                  <label>วิธีคำนวณ</label>
                  <select name="calcMode" required>
                    <option value="divide" ${tierFormData.calcMode === 'divide' ? 'selected' : ''}>➗ หารเฉลี่ยตามงานที่ใช้ร่วมกัน (เช่น ค่า Software ที่แชร์กัน)</option>
                    <option value="multiply" ${tierFormData.calcMode === 'multiply' ? 'selected' : ''}>✖️ คูณตามจำนวนคน (เช่น ค่าออกกองต่อหัว ระบุจำนวนคนเอง)</option>
                    <option value="flat" ${tierFormData.calcMode === 'flat' ? 'selected' : ''}>👤 คิดเต็มอัตราต่อคน ไม่หารไม่คูณ (เช่น ค่าอุปกรณ์ต่อคน 1 คน)</option>
                  </select>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label>ประเภทอัตราต้นทุน</label>
                    <select name="rateType" required>
                      <option value="monthly" ${tierFormData.rateType === 'monthly' ? 'selected' : ''}>รายเดือน</option>
                      <option value="daily" ${tierFormData.rateType === 'daily' ? 'selected' : ''}>รายวัน</option>
                      <option value="project" ${tierFormData.rateType === 'project' ? 'selected' : ''}>รายครั้ง (เหมาโปรเจค)</option>
                      <option value="piece" ${tierFormData.rateType === 'piece' ? 'selected' : ''}>รายชิ้น</option>
                      <option value="hourly" ${tierFormData.rateType === 'hourly' ? 'selected' : ''}>รายชั่วโมง</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label>อัตราต้นทุน (บาท)</label>
                    <input type="number" name="rateValue" value="${tierFormData.rateValue}" min="0" step="0.01" required />
                  </div>
                </div>
                <div class="modal-actions">
                  <button type="submit" class="btn btn-primary">${editingTier ? 'บันทึกการแก้ไข' : '+ เพิ่ม Tier'}</button>
                  ${editingTier ? `<button type="button" class="btn btn-secondary" id="btn-cancel-edit-cost-item-tier">ยกเลิกแก้ไข</button>` : ''}
                </div>
              </form>
              <div class="modal-actions">
                <button type="button" class="btn btn-secondary" id="btn-close-cost-item-tiers">ปิด</button>
              </div>
            </div>
          </div>
        `;
      }
    }

    // Confirm Dialog
    if (confirmDialog.isOpen) {
      dialogHtml += `
        <div class="modal-overlay" id="confirm-dialog-overlay">
          <div class="modal-content" style="max-width: 400px;">
            <h2>ยืนยัน</h2>
            <p>${confirmDialog.action.message}</p>
            <div class="modal-actions">
              <button type="button" class="btn btn-primary" id="btn-confirm-action">
                ยืนยัน
              </button>
              <button type="button" class="btn btn-secondary" id="btn-cancel-confirm">
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      `;
    }

    const dialogContainer = document.getElementById('dialogs');
    if (dialogContainer) {
      dialogContainer.innerHTML = dialogHtml;
      if (dialogHtml) {
        this.attachDialogListeners();
      }
    }
  }

  /**
   * Attach listeners to contract list items
   */
  attachContractListeners() {
    // Add contract button
    document.getElementById('btn-add-contract')?.addEventListener('click', () => {
      this.openContractDialog('add', null);
    });

    // Edit buttons
    document.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const contractId = e.target.dataset.contractId;
        const contract = this.state.contracts.find(c => c.id === contractId);
        this.openContractDialog('edit', contract);
      });
    });

    // Services buttons
    document.querySelectorAll('.btn-services').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const contractId = e.target.dataset.contractId;
        this.openServicesDialog(contractId);
      });
    });

    // Payment plan buttons
    document.querySelectorAll('.btn-payment-plan').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const contractId = e.target.dataset.contractId;
        this.openPaymentPlanDialog(contractId);
      });
    });

    // Expand/collapse buttons
    document.querySelectorAll('.btn-expand').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const contractId = e.target.dataset.contractId;
        this.toggleContractExpand(contractId);
      });
    });

    // View projects for contract (click contract name)
    document.querySelectorAll('.btn-view-contract-projects').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const contractId = e.currentTarget.dataset.contractId;
        this.viewProjectsForContract(contractId);
      });
    });

    // Toggle inline projects panel
    document.querySelectorAll('.btn-toggle-projects').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const contractId = e.currentTarget.dataset.contractId;
        this.toggleContractProjectsExpand(contractId);
      });
    });

    // Move contract up/down
    document.querySelectorAll('.btn-move-contract-up').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const contractId = e.currentTarget.dataset.contractId;
        this.moveContract(contractId, -1);
      });
    });

    document.querySelectorAll('.btn-move-contract-down').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const contractId = e.currentTarget.dataset.contractId;
        this.moveContract(contractId, 1);
      });
    });

    // Quick add project (from inline panel)
    document.querySelectorAll('.btn-quick-add-project').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const contractId = e.currentTarget.dataset.contractId;
        this.openProjectDialog('add', { contractId });
      });
    });

    // Edit project (from inline panel)
    document.querySelectorAll('.btn-edit-project-inline').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const projectId = e.currentTarget.dataset.projectId;
        const project = this.state.projects.find(p => p.id === projectId);
        this.openProjectDialog('edit', project);
      });
    });

    // Duplicate project (from inline panel)
    document.querySelectorAll('.btn-duplicate-project-inline').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const projectId = e.currentTarget.dataset.projectId;
        this.duplicateProject(projectId);
      });
    });

    // Delete project (from inline panel)
    document.querySelectorAll('.btn-delete-project-inline').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const projectId = e.currentTarget.dataset.projectId;
        this.showConfirmDialog(
          'คุณแน่ใจว่าต้องการลบโปรเจคนี้?',
          () => this.deleteProject(projectId)
        );
      });
    });

    // View tasks for project (from inline panel)
    document.querySelectorAll('.contract-projects-panel .btn-view-project-tasks').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const projectId = e.currentTarget.dataset.projectId;
        this.viewTasksForProject(projectId);
      });
    });

    // View project financials (from inline panel)
    document.querySelectorAll('.contract-projects-panel .btn-view-project-financials').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const projectId = e.currentTarget.dataset.projectId;
        this.openProjectFinancialsDialog(projectId);
      });
    });

    // Duplicate buttons
    document.querySelectorAll('.btn-duplicate').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const contractId = e.target.dataset.contractId;
        this.duplicateContract(contractId);
      });
    });

    // Create child contract buttons
    document.querySelectorAll('.btn-child').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const contractId = e.target.dataset.contractId;
        this.createChildContract(contractId);
      });
    });

    // Toggle status buttons
    document.querySelectorAll('.btn-toggle-status').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const contractId = e.target.dataset.contractId;
        this.toggleContractStatus(contractId);
      });
    });

    // Delete buttons
    document.querySelectorAll('.contract-row .btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const contractId = e.target.dataset.contractId;
        this.showConfirmDialog(
          `คุณแน่ใจว่าต้องการลบสัญญานี้?`,
          () => this.deleteContract(contractId)
        );
      });
    });
  }

  /**
   * Attach listeners to project list items
   */
  attachProjectListeners() {
    // Add project button
    document.getElementById('btn-add-project')?.addEventListener('click', () => {
      this.openProjectDialog('add', null);
    });

    // Expand/collapse contract group
    document.querySelectorAll('.btn-expand-contract-group').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const contractId = e.currentTarget.dataset.contractId;
        this.toggleProjectContractExpand(contractId);
      });
    });

    // Move contract group up/down (reorders the same underlying contract order
    // used on the Contracts page)
    document.querySelectorAll('.btn-move-project-group-up').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const contractId = e.currentTarget.dataset.contractId;
        this.moveContract(contractId, -1);
      });
    });

    document.querySelectorAll('.btn-move-project-group-down').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const contractId = e.currentTarget.dataset.contractId;
        this.moveContract(contractId, 1);
      });
    });

    // Move up/down buttons
    document.querySelectorAll('.project-row .btn-move-project-up').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const projectId = e.target.dataset.projectId;
        this.moveProject(projectId, -1);
      });
    });

    document.querySelectorAll('.project-row .btn-move-project-down').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const projectId = e.target.dataset.projectId;
        this.moveProject(projectId, 1);
      });
    });

    // Edit buttons
    document.querySelectorAll('.project-row .btn-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const projectId = e.target.dataset.projectId;
        const project = this.state.projects.find(p => p.id === projectId);
        this.openProjectDialog('edit', project);
      });
    });

    // Duplicate buttons
    document.querySelectorAll('.project-row .btn-duplicate-project').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const projectId = e.target.dataset.projectId;
        this.duplicateProject(projectId);
      });
    });

    // Delete buttons
    document.querySelectorAll('.project-row .btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const projectId = e.target.dataset.projectId;
        this.showConfirmDialog(
          `คุณแน่ใจว่าต้องการลบโปรเจคนี้?`,
          () => this.deleteProject(projectId)
        );
      });
    });

    // View tasks for project (click project name)
    document.querySelectorAll('.btn-view-project-tasks').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const projectId = e.currentTarget.dataset.projectId;
        this.viewTasksForProject(projectId);
      });
    });

    // View contract (click contract name in project row)
    document.querySelectorAll('.btn-view-contract').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const contractId = e.currentTarget.dataset.contractId;
        this.viewContract(contractId);
      });
    });

    // View project financials
    document.querySelectorAll('.btn-view-project-financials').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const projectId = e.currentTarget.dataset.projectId;
        this.openProjectFinancialsDialog(projectId);
      });
    });

    // Clear project filter button
    document.getElementById('btn-clear-project-filter')?.addEventListener('click', () => {
      this.clearProjectFilter();
    });

    // Expand/collapse child projects
    document.querySelectorAll('.project-row .btn-expand').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const projectId = e.target.dataset.projectId;
        this.toggleProjectExpand(projectId);
      });
    });

    // Create child project
    document.querySelectorAll('.project-row .btn-child-project').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const projectId = e.target.dataset.projectId;
        this.createChildProject(projectId);
      });
    });
  }

  /**
   * Attach listeners to task list items
   */
  attachTaskListeners() {
    // Add task button
    document.getElementById('btn-add-task')?.addEventListener('click', () => {
      this.openTaskDialog('add', null);
    });

    // Edit buttons
    document.querySelectorAll('.task-row .btn-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const taskId = e.target.dataset.taskId;
        const task = this.state.tasks.find(t => t.id === taskId);
        this.openTaskDialog('edit', task);
      });
    });

    // Delete buttons
    document.querySelectorAll('.task-row .btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const taskId = e.target.dataset.taskId;
        this.showConfirmDialog(
          `คุณแน่ใจว่าต้องการลบงานนี้?`,
          () => this.deleteTask(taskId)
        );
      });
    });

    // View task costs buttons
    document.querySelectorAll('.btn-view-task-costs').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const taskId = e.currentTarget.dataset.taskId;
        this.openTaskCostsDialog(taskId);
      });
    });

    // Clear task filter button
    document.getElementById('btn-clear-task-filter')?.addEventListener('click', () => {
      this.clearTaskFilter();
    });

    // Expand/collapse task project group
    document.querySelectorAll('.btn-expand-task-project-group').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const projectId = e.currentTarget.dataset.projectId;
        this.toggleTaskProjectExpand(projectId);
      });
    });
  }

  /**
   * Attach dialog listeners
   */
  attachDialogListeners() {
    // Contract form
    const contractForm = document.getElementById('contract-form');
    if (contractForm) {
      contractForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(contractForm);
        const { mode, data: contractData } = this.state.ui.contractDialog;

        const newContract = {
          id: contractData?.id || `c${Date.now()}`,
          name: formData.get('name'),
          clientName: formData.get('clientName'),
          startDate: formData.get('startDate'),
          endDate: formData.get('endDate'),
          value: parseFloat(formData.get('value')) || 0,
          billingCycle: formData.get('billingCycle'),
          status: contractData?.status || 'draft',
          services: contractData?.services || [],
          parentContractId: contractData?.parentContractId || null,
          childContractIds: contractData?.childContractIds || [],
          createdAt: contractData?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        if (mode === 'add') {
          this.state.contracts.push(newContract);
        } else {
          const idx = this.state.contracts.findIndex(c => c.id === newContract.id);
          this.state.contracts[idx] = newContract;
        }

        this.closeContractDialog();
        this.saveState();
        this.render();
      });

      document.getElementById('btn-cancel-contract')?.addEventListener('click', () => {
        this.closeContractDialog();
      });
    }

    // Cost form
    const costForm = document.getElementById('cost-form');
    if (costForm) {
      costForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(costForm);
        const { mode, data: costData } = this.state.ui.costDialog;

        const taskId = formData.get('taskId') || null;
        const task = taskId ? this.state.tasks.find(t => t.id === taskId) : null;

        const newCost = {
          id: costData?.id || `cost${Date.now()}`,
          name: formData.get('name'),
          taskId: taskId,
          projectId: task?.projectId || null,
          contractId: task?.contractId || null,
          type: formData.get('type'),
          amount: parseFloat(formData.get('amount')) || 0,
          date: formData.get('date'),
          note: formData.get('note') || '',
          createdAt: costData?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        if (mode === 'add') {
          this.state.costs.push(newCost);
        } else {
          const idx = this.state.costs.findIndex(c => c.id === newCost.id);
          this.state.costs[idx] = newCost;
        }

        this.closeCostDialog();
        this.saveState();
        this.render();
      });

      document.getElementById('btn-cancel-cost')?.addEventListener('click', () => {
        this.closeCostDialog();
      });
    }

    // Services form
    const serviceForm = document.getElementById('service-form');
    if (serviceForm) {
      serviceForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const contractId = this.state.ui.servicesDialog.contractId;
        const contract = this.state.contracts.find(c => c.id === contractId);

        if (contract) {
          const newService = {
            id: `s${Date.now()}`,
            name: serviceForm.elements.serviceName.value,
            description: serviceForm.elements.serviceDesc.value
          };
          contract.services.push(newService);
          this.saveState();
          this.render();
        }
      });

      document.getElementById('btn-close-services')?.addEventListener('click', () => {
        this.closeServicesDialog();
      });
    }

    // View tasks linked to a service
    document.querySelectorAll('.btn-view-service-tasks').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const serviceId = e.currentTarget.dataset.serviceId;
        this.viewTasksForService(serviceId);
      });
    });

    // Delete service
    document.querySelectorAll('.btn-delete[data-service-idx]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const serviceIdx = parseInt(e.target.dataset.serviceIdx);
        const contractId = e.target.dataset.contractId;
        const contract = this.state.contracts.find(c => c.id === contractId);
        if (contract) {
          contract.services.splice(serviceIdx, 1);
          this.saveState();
          this.render();
        }
      });
    });

    // Move service up/down
    document.querySelectorAll('.btn-move-service-up').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.serviceIdx);
        const contractId = e.currentTarget.dataset.contractId;
        this.moveService(contractId, idx, idx - 1);
      });
    });

    document.querySelectorAll('.btn-move-service-down').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.serviceIdx);
        const contractId = e.currentTarget.dataset.contractId;
        this.moveService(contractId, idx, idx + 1);
      });
    });

    // Payment plan dialog
    const ppDraft = this.state.ui.paymentPlanDialog.draft;
    if (ppDraft) {
      document.getElementById('pp-deposit-type')?.addEventListener('change', (e) => {
        ppDraft.depositType = e.target.value;
        this.render();
      });

      document.getElementById('pp-deposit-value')?.addEventListener('change', (e) => {
        ppDraft.depositValue = parseFloat(e.target.value) || 0;
        this.render();
      });

      document.getElementById('pp-installment-count')?.addEventListener('change', (e) => {
        ppDraft.installmentCount = Math.max(1, parseInt(e.target.value, 10) || 1);
      });

      document.querySelectorAll('.btn-preset-count').forEach(btn => {
        btn.addEventListener('click', (e) => {
          ppDraft.installmentCount = parseInt(e.currentTarget.dataset.count, 10);
          this.render();
        });
      });

      document.getElementById('btn-generate-installments')?.addEventListener('click', () => {
        this.generateInstallments(ppDraft.installmentCount || 1);
      });

      document.getElementById('btn-add-installment')?.addEventListener('click', () => {
        this.addInstallmentRow();
      });

      document.getElementById('btn-add-installments-bulk')?.addEventListener('click', () => {
        const count = Math.max(1, parseInt(document.getElementById('bulk-add-count')?.value, 10) || 1);
        this.addInstallmentRows(count);
      });

      document.querySelectorAll('.btn-remove-installment').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = parseInt(e.target.dataset.idx, 10);
          this.removeInstallmentRow(idx);
        });
      });

      document.querySelectorAll('.btn-duplicate-installment').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = parseInt(e.currentTarget.dataset.idx, 10);
          this.duplicateInstallmentRow(idx);
        });
      });

      const updateBulkDeleteState = () => {
        const checked = document.querySelectorAll('.inst-select:checked');
        const countEl = document.getElementById('selected-installment-count');
        const deleteBtn = document.getElementById('btn-delete-selected-installments');
        if (countEl) countEl.textContent = checked.length;
        if (deleteBtn) deleteBtn.disabled = checked.length === 0;
      };

      document.getElementById('chk-select-all-installments')?.addEventListener('change', (e) => {
        document.querySelectorAll('.inst-select').forEach(chk => {
          chk.checked = e.target.checked;
        });
        updateBulkDeleteState();
      });

      document.querySelectorAll('.inst-select').forEach(chk => {
        chk.addEventListener('change', updateBulkDeleteState);
      });

      document.getElementById('btn-delete-selected-installments')?.addEventListener('click', () => {
        const selectedIdxs = Array.from(document.querySelectorAll('.inst-select:checked'))
          .map(chk => parseInt(chk.dataset.idx, 10));
        this.removeInstallmentRows(selectedIdxs);
      });

      document.querySelectorAll('.inst-label').forEach(input => {
        input.addEventListener('change', (e) => {
          ppDraft.installments[parseInt(e.target.dataset.idx, 10)].label = e.target.value;
        });
      });

      document.querySelectorAll('.inst-date').forEach(input => {
        input.addEventListener('change', (e) => {
          ppDraft.installments[parseInt(e.target.dataset.idx, 10)].dueDate = e.target.value;
        });
      });

      document.querySelectorAll('.inst-amount').forEach(input => {
        input.addEventListener('change', (e) => {
          ppDraft.installments[parseInt(e.target.dataset.idx, 10)].amount = parseFloat(e.target.value) || 0;
          this.render();
        });
      });

      document.getElementById('btn-save-payment-plan')?.addEventListener('click', () => {
        this.savePaymentPlan();
      });

      document.getElementById('btn-cancel-payment-plan')?.addEventListener('click', () => {
        this.closePaymentPlanDialog();
      });
    }

    // Auto-fill suggested budget when contract changes (only if budget field is still empty)
    document.getElementById('project-contract-select')?.addEventListener('change', (e) => {
      const budgetInput = document.getElementById('project-budget-input');
      const budgetHint = document.getElementById('project-budget-hint');
      const selectedOption = e.target.options[e.target.selectedIndex];
      const suggested = selectedOption ? selectedOption.dataset.suggestedBudget : '';
      if (budgetInput && budgetInput.value.trim() === '' && suggested) {
        budgetInput.value = suggested;
      }
      if (budgetHint) {
        budgetHint.textContent = suggested
          ? 'เติมให้อัตโนมัติจากแผนการชำระเงินของสัญญา (แบ่งงวดเท่ากัน) — แก้ไขเองได้ถ้าโปรเจคนี้ไม่ได้ผูกกับงวดชำระแบบนั้น'
          : 'ถ้าไม่ระบุ จะไม่คำนวณกำไร (Margin) ให้ในโปรเจคนี้';
      }
    });

    // Project form
    const projectForm = document.getElementById('project-form');
    if (projectForm) {
      projectForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(projectForm);
        const { mode, data: projectData } = this.state.ui.projectDialog;

        const newProject = {
          ...(projectData || {}),
          id: projectData?.id || `proj_${Date.now()}`,
          name: formData.get('name'),
          contractId: formData.get('contractId'),
          description: formData.get('description'),
          budgetValue: parseFloat(formData.get('budgetValue')) || null,
          startDate: formData.get('startDate'),
          dueDate: formData.get('dueDate'),
          status: formData.get('status'),
          createdAt: projectData?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        if (mode === 'add') {
          this.state.projects.push(newProject);
        } else {
          const idx = this.state.projects.findIndex(p => p.id === newProject.id);
          this.state.projects[idx] = newProject;
        }

        this.closeProjectDialog();
        this.saveState();
        this.render();
      });

      document.getElementById('btn-cancel-project')?.addEventListener('click', () => {
        this.closeProjectDialog();
      });
    }

    // Task form
    const taskForm = document.getElementById('task-form');
    if (taskForm) {
      taskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(taskForm);
        const { mode, data: taskData } = this.state.ui.taskDialog;
        const projectId = formData.get('projectId');
        const project = this.state.projects.find(p => p.id === projectId);

        const newTask = {
          id: taskData?.id || `task_${Date.now()}`,
          title: formData.get('title'),
          description: formData.get('description'),
          projectId: projectId,
          contractId: project?.contractId || null,
          assigneeId: formData.get('assigneeId') || null,
          assigneeRoleId: formData.get('assigneeRoleId') || null,
          laborQuantity: parseFloat(formData.get('laborQuantity')) || null,
          costItemId: formData.get('costItemId') || null,
          costItemTierId: formData.get('costItemTierId') || null,
          costItemQuantity: parseFloat(formData.get('costItemQuantity')) || null,
          serviceId: formData.get('serviceId') || null,
          priority: formData.get('priority'),
          status: formData.get('status'),
          startDate: formData.get('startDate'),
          dueDate: formData.get('dueDate')
        };

        if (mode === 'add') {
          this.state.tasks.push(newTask);
        } else {
          const idx = this.state.tasks.findIndex(t => t.id === newTask.id);
          this.state.tasks[idx] = newTask;
        }

        this.closeTaskDialog();
        this.saveState();
        this.render();
      });

      document.getElementById('btn-cancel-task')?.addEventListener('click', () => {
        this.closeTaskDialog();
      });

      // Update available services when project selection changes
      document.getElementById('task-project-select')?.addEventListener('change', (e) => {
        const project = this.state.projects.find(p => p.id === e.target.value);
        const contract = project ? this.state.contracts.find(c => c.id === project.contractId) : null;
        const services = contract ? (contract.services || []) : [];
        const serviceSelect = document.getElementById('task-service-select');
        if (serviceSelect) {
          serviceSelect.innerHTML = '<option value="">-- ไม่ผูกกับบริการ --</option>' +
            services.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        }

        const titleList = document.getElementById('task-title-list');
        if (titleList) {
          const titles = [...new Set(
            this.state.tasks.filter(t => t.projectId === e.target.value).map(t => t.title).filter(Boolean)
          )];
          titleList.innerHTML = titles.map(title => `<option value="${title}"></option>`).join('');
        }
      });

      // Auto-fill task title from selected service if title is still empty
      document.getElementById('task-service-select')?.addEventListener('change', (e) => {
        const titleInput = document.getElementById('task-title-input');
        if (!titleInput || titleInput.value.trim() !== '') return;
        const selectedOption = e.target.options[e.target.selectedIndex];
        if (selectedOption && selectedOption.value) {
          titleInput.value = selectedOption.textContent.trim();
        }
      });

      // Update available roles when assignee selection changes
      document.getElementById('task-assignee-select')?.addEventListener('change', (e) => {
        const person = this.state.people.find(p => p.id === e.target.value);
        const roles = person ? (person.roles || []) : [];
        const roleSelect = document.getElementById('task-assignee-role-select');
        if (roleSelect) {
          roleSelect.innerHTML = '<option value="">-- ไม่ระบุ --</option>' +
            roles.map(r => `<option value="${r.id}" data-rate-type="${r.rateType || 'monthly'}">${r.position} (${this.getRoleRateLabel(r)})</option>`).join('');
        }
        const laborQtyGroup = document.getElementById('task-labor-quantity-group');
        if (laborQtyGroup) laborQtyGroup.style.display = 'none';
      });

      // Show/hide piece-quantity field based on selected role's rate type
      document.getElementById('task-assignee-role-select')?.addEventListener('change', (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        const rateType = selectedOption ? selectedOption.dataset.rateType : null;
        const laborQtyGroup = document.getElementById('task-labor-quantity-group');
        if (laborQtyGroup) {
          laborQtyGroup.style.display = rateType === 'piece' ? '' : 'none';
        }
      });

      // Update available tiers when cost item selection changes
      document.getElementById('task-cost-item-select')?.addEventListener('change', (e) => {
        const costItem = this.state.costItems.find(ci => ci.id === e.target.value);
        const tiers = costItem ? (costItem.tiers || []) : [];
        const tierSelect = document.getElementById('task-cost-item-tier-select');
        if (tierSelect) {
          tierSelect.innerHTML = '<option value="">-- ไม่ระบุ --</option>' +
            tiers.map(t => `<option value="${t.id}" data-calc-mode="${t.calcMode || 'divide'}">${t.label} (${this.getCostItemTierLabel(t)})</option>`).join('');
        }
        const qtyGroup = document.getElementById('task-cost-item-quantity-group');
        if (qtyGroup) qtyGroup.style.display = 'none';
      });

      // Show/hide quantity field based on selected tier's calc mode
      document.getElementById('task-cost-item-tier-select')?.addEventListener('change', (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        const calcMode = selectedOption ? selectedOption.dataset.calcMode : null;
        const qtyGroup = document.getElementById('task-cost-item-quantity-group');
        if (qtyGroup) {
          qtyGroup.style.display = calcMode === 'multiply' ? '' : 'none';
        }
      });
    }

    // Task costs dialog
    document.getElementById('btn-close-task-costs')?.addEventListener('click', () => {
      this.closeTaskCostsDialog();
    });

    // Jump from task costs dialog to full project financials dialog
    document.querySelector('.btn-view-project-financials-from-task')?.addEventListener('click', (e) => {
      const projectId = e.currentTarget.dataset.projectId;
      this.closeTaskCostsDialog();
      this.openProjectFinancialsDialog(projectId);
    });

    // Project financials dialog
    document.getElementById('btn-close-project-financials')?.addEventListener('click', () => {
      this.closeProjectFinancialsDialog();
    });

    // People form
    const peopleForm = document.getElementById('people-form');
    if (peopleForm) {
      peopleForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(peopleForm);
        const { mode, data: personData } = this.state.ui.peopleDialog;

        const newPerson = {
          id: personData?.id || `person_${Date.now()}`,
          name: formData.get('name'),
          roles: personData?.roles || [],
          createdAt: personData?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        if (mode === 'add') {
          this.state.people.push(newPerson);
        } else {
          const idx = this.state.people.findIndex(p => p.id === newPerson.id);
          this.state.people[idx] = newPerson;
        }

        this.closePeopleDialog();
        this.saveState();
        this.render();
      });

      document.getElementById('btn-cancel-people')?.addEventListener('click', () => {
        this.closePeopleDialog();
      });
    }

    // Role form (within Person Roles dialog)
    const roleForm = document.getElementById('role-form');
    if (roleForm) {
      roleForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(roleForm);
        const { personId, editingRoleId } = this.state.ui.personRolesDialog;
        const person = this.state.people.find(p => p.id === personId);
        if (!person) return;
        if (!person.roles) person.roles = [];

        const roleData = {
          position: formData.get('position'),
          responsibility: formData.get('responsibility'),
          rateType: formData.get('rateType'),
          rateValue: parseFloat(formData.get('rateValue')) || 0
        };

        if (editingRoleId) {
          const idx = person.roles.findIndex(r => r.id === editingRoleId);
          if (idx !== -1) person.roles[idx] = { ...person.roles[idx], ...roleData };
        } else {
          person.roles.push({ id: `role_${Date.now()}`, ...roleData });
        }

        this.state.ui.personRolesDialog.editingRoleId = null;
        this.saveState();
        this.render();
      });

      document.getElementById('btn-cancel-edit-role')?.addEventListener('click', () => {
        this.state.ui.personRolesDialog.editingRoleId = null;
        this.render();
      });
    }

    document.querySelectorAll('.btn-edit-role').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.state.ui.personRolesDialog.editingRoleId = e.currentTarget.dataset.roleId;
        this.render();
      });
    });

    document.querySelectorAll('.btn-delete-role').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const personId = e.currentTarget.dataset.personId;
        const roleId = e.currentTarget.dataset.roleId;
        this.showConfirmDialog(
          'คุณแน่ใจว่าต้องการลบบทบาทนี้?',
          () => this.deleteRole(personId, roleId)
        );
      });
    });

    document.getElementById('btn-close-person-roles')?.addEventListener('click', () => {
      this.closePersonRolesDialog();
    });

    // Cost item form
    const costItemForm = document.getElementById('cost-item-form');
    if (costItemForm) {
      costItemForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(costItemForm);
        const { mode, data: costItemData } = this.state.ui.costItemDialog;

        const newCostItem = {
          id: costItemData?.id || `costitem_${Date.now()}`,
          name: formData.get('name'),
          tiers: costItemData?.tiers || [],
          createdAt: costItemData?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        if (mode === 'add') {
          this.state.costItems.push(newCostItem);
        } else {
          const idx = this.state.costItems.findIndex(ci => ci.id === newCostItem.id);
          this.state.costItems[idx] = newCostItem;
        }

        this.closeCostItemDialog();
        this.saveState();
        this.render();
      });

      document.getElementById('btn-cancel-cost-item')?.addEventListener('click', () => {
        this.closeCostItemDialog();
      });
    }

    // Cost item tier form (within Cost Item Tiers dialog)
    const costItemTierForm = document.getElementById('cost-item-tier-form');
    if (costItemTierForm) {
      costItemTierForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(costItemTierForm);
        const { costItemId, editingTierId } = this.state.ui.costItemTiersDialog;
        const costItem = this.state.costItems.find(ci => ci.id === costItemId);
        if (!costItem) return;
        if (!costItem.tiers) costItem.tiers = [];

        const tierData = {
          label: formData.get('label'),
          rateType: formData.get('rateType'),
          rateValue: parseFloat(formData.get('rateValue')) || 0,
          calcMode: formData.get('calcMode') || 'divide'
        };

        if (editingTierId) {
          const idx = costItem.tiers.findIndex(t => t.id === editingTierId);
          if (idx !== -1) costItem.tiers[idx] = { ...costItem.tiers[idx], ...tierData };
        } else {
          costItem.tiers.push({ id: `tier_${Date.now()}`, ...tierData });
        }

        this.state.ui.costItemTiersDialog.editingTierId = null;
        this.saveState();
        this.render();
      });

      document.getElementById('btn-cancel-edit-cost-item-tier')?.addEventListener('click', () => {
        this.state.ui.costItemTiersDialog.editingTierId = null;
        this.render();
      });
    }

    document.querySelectorAll('.btn-edit-cost-item-tier').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.state.ui.costItemTiersDialog.editingTierId = e.currentTarget.dataset.tierId;
        this.render();
      });
    });

    document.querySelectorAll('.btn-delete-cost-item-tier').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const costItemId = e.currentTarget.dataset.costItemId;
        const tierId = e.currentTarget.dataset.tierId;
        this.showConfirmDialog(
          'คุณแน่ใจว่าต้องการลบ Tier นี้?',
          () => this.deleteCostItemTier(costItemId, tierId)
        );
      });
    });

    document.getElementById('btn-close-cost-item-tiers')?.addEventListener('click', () => {
      this.closeCostItemTiersDialog();
    });

    // Confirm dialog
    document.getElementById('btn-confirm-action')?.addEventListener('click', () => {
      if (this.state.ui.confirmDialog.action?.callback) {
        this.state.ui.confirmDialog.action.callback();
      }
      this.closeConfirmDialog();
    });

    document.getElementById('btn-cancel-confirm')?.addEventListener('click', () => {
      this.closeConfirmDialog();
    });

    // Close on overlay click
    document.getElementById('contract-dialog-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'contract-dialog-overlay') {
        this.closeContractDialog();
      }
    });

    document.getElementById('services-dialog-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'services-dialog-overlay') {
        this.closeServicesDialog();
      }
    });

    document.getElementById('confirm-dialog-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'confirm-dialog-overlay') {
        this.closeConfirmDialog();
      }
    });
  }

  /**
   * Dialog Actions
   */
  openContractDialog(mode, contract) {
    this.state.ui.contractDialog = {
      isOpen: true,
      mode: mode,
      data: contract
    };
    this.render();
  }

  closeContractDialog() {
    this.state.ui.contractDialog = { isOpen: false, mode: 'add', data: null };
    this.render();
  }

  openServicesDialog(contractId) {
    this.state.ui.servicesDialog = { isOpen: true, contractId };
    this.render();
  }

  closeServicesDialog() {
    this.state.ui.servicesDialog = { isOpen: false, contractId: null };
    this.render();
  }

  moveService(contractId, fromIdx, toIdx) {
    const contract = this.state.contracts.find(c => c.id === contractId);
    if (!contract || toIdx < 0 || toIdx >= contract.services.length) return;
    const [moved] = contract.services.splice(fromIdx, 1);
    contract.services.splice(toIdx, 0, moved);
    this.saveState();
    this.render();
  }

  openProjectDialog(mode, project) {
    this.state.ui.projectDialog = {
      isOpen: true,
      mode: mode,
      data: project
    };
    this.render();
  }

  closeProjectDialog() {
    this.state.ui.projectDialog = { isOpen: false, mode: 'add', data: null };
    this.render();
  }

  openTaskDialog(mode, task) {
    this.state.ui.taskDialog = {
      isOpen: true,
      mode: mode,
      data: task
    };
    this.render();
  }

  closeTaskDialog() {
    this.state.ui.taskDialog = { isOpen: false, mode: 'add', data: null };
    this.render();
  }

  openTaskCostsDialog(taskId) {
    this.state.ui.taskCostsDialog = { isOpen: true, taskId };
    this.render();
  }

  closeTaskCostsDialog() {
    this.state.ui.taskCostsDialog = { isOpen: false, taskId: null };
    this.render();
  }

  openProjectFinancialsDialog(projectId) {
    this.state.ui.projectFinancialsDialog = { isOpen: true, projectId };
    this.render();
  }

  closeProjectFinancialsDialog() {
    this.state.ui.projectFinancialsDialog = { isOpen: false, projectId: null };
    this.render();
  }

  /**
   * Payment Plan (installments + deposit) Actions
   */
  openPaymentPlanDialog(contractId) {
    const contract = this.state.contracts.find(c => c.id === contractId);
    if (!contract) return;

    const existing = contract.paymentPlan;
    const draft = existing
      ? JSON.parse(JSON.stringify(existing))
      : { depositType: 'percent', depositValue: 0, installmentCount: 3, installments: [] };
    draft.installmentCount = draft.installmentCount || 3;

    this.state.ui.paymentPlanDialog = { isOpen: true, contractId, draft };
    this.render();
  }

  closePaymentPlanDialog() {
    this.state.ui.paymentPlanDialog = { isOpen: false, contractId: null, draft: null };
    this.render();
  }

  toggleContractExpand(contractId) {
    if (!this.state.ui.expandedContracts[contractId]) {
      this.state.ui.expandedContracts[contractId] = true;
    } else {
      this.state.ui.expandedContracts[contractId] = false;
    }
    this.render();
  }

  toggleContractProjectsExpand(contractId) {
    this.state.ui.expandedContractProjects[contractId] = !this.state.ui.expandedContractProjects[contractId];
    this.render();
  }

  moveContract(contractId, direction) {
    const contract = this.state.contracts.find(c => c.id === contractId);
    if (!contract) return;

    const siblings = contract.parentContractId
      ? this.state.contracts.filter(c => c.parentContractId === contract.parentContractId)
      : this.state.contracts.filter(c => !c.parentContractId);

    const siblingIdx = siblings.findIndex(c => c.id === contractId);
    const targetIdx = siblingIdx + direction;
    if (targetIdx < 0 || targetIdx >= siblings.length) return;

    const other = siblings[targetIdx];
    const fullIdxA = this.state.contracts.indexOf(contract);
    const fullIdxB = this.state.contracts.indexOf(other);
    [this.state.contracts[fullIdxA], this.state.contracts[fullIdxB]] =
      [this.state.contracts[fullIdxB], this.state.contracts[fullIdxA]];

    this.saveState();
    this.render();
  }

  moveProject(projectId, direction) {
    const project = this.state.projects.find(p => p.id === projectId);
    if (!project) return;

    const siblings = project.parentProjectId
      ? this.state.projects.filter(p => p.parentProjectId === project.parentProjectId)
      : this.state.projects.filter(p => !p.parentProjectId && p.contractId === project.contractId);

    const siblingIdx = siblings.findIndex(p => p.id === projectId);
    const targetIdx = siblingIdx + direction;
    if (targetIdx < 0 || targetIdx >= siblings.length) return;

    const other = siblings[targetIdx];
    const fullIdxA = this.state.projects.indexOf(project);
    const fullIdxB = this.state.projects.indexOf(other);
    [this.state.projects[fullIdxA], this.state.projects[fullIdxB]] =
      [this.state.projects[fullIdxB], this.state.projects[fullIdxA]];

    this.saveState();
    this.render();
  }

  viewTasksForProject(projectId) {
    this.state.ui.taskFilter = { projectId, serviceId: null };
    this.state.ui.currentView = 'tasks';
    this.render();
  }

  viewTasksForService(serviceId) {
    this.state.ui.taskFilter = { projectId: null, serviceId };
    this.state.ui.currentView = 'tasks';
    this.render();
  }

  clearTaskFilter() {
    this.state.ui.taskFilter = { projectId: null, serviceId: null };
    this.render();
  }

  viewProjectsForContract(contractId) {
    this.state.ui.projectFilter = { contractId };
    this.state.ui.currentView = 'projects';
    this.render();
  }

  clearProjectFilter() {
    this.state.ui.projectFilter = { contractId: null };
    this.render();
  }

  viewContract(contractId) {
    const contract = this.state.contracts.find(c => c.id === contractId);
    if (contract?.parentContractId) {
      this.state.ui.expandedContracts[contract.parentContractId] = true;
    }
    this.state.ui.currentView = 'contracts';
    this.render();
  }

  getDepositAmount(contract, draft) {
    const value = contract?.value || 0;
    if (draft.depositType === 'percent') {
      return Math.round((value * (draft.depositValue || 0)) / 100 * 100) / 100;
    }
    return draft.depositValue || 0;
  }

  generateInstallments(count) {
    const { contractId, draft } = this.state.ui.paymentPlanDialog;
    const contract = this.state.contracts.find(c => c.id === contractId);
    if (!contract || !draft) return;

    const depositAmount = this.getDepositAmount(contract, draft);
    const remaining = Math.max((contract.value || 0) - depositAmount, 0);
    const baseAmount = Math.floor((remaining / count) * 100) / 100;
    const startDate = contract.startDate ? new Date(contract.startDate) : new Date();

    const installments = [];
    let allocated = 0;
    for (let i = 0; i < count; i++) {
      const isLast = i === count - 1;
      const amount = isLast ? Math.round((remaining - allocated) * 100) / 100 : baseAmount;
      allocated += amount;

      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + i + 1);

      installments.push({
        id: `ins_${Date.now()}_${i}`,
        label: `งวดที่ ${i + 1}`,
        dueDate: dueDate.toISOString().split('T')[0],
        amount
      });
    }

    draft.installments = installments;
    this.render();
  }

  addInstallmentRow() {
    const { draft } = this.state.ui.paymentPlanDialog;
    if (!draft) return;
    draft.installments.push({
      id: `ins_${Date.now()}`,
      label: `งวดที่ ${draft.installments.length + 1}`,
      dueDate: '',
      amount: 0
    });
    this.render();
  }

  addInstallmentRows(count) {
    const { draft } = this.state.ui.paymentPlanDialog;
    if (!draft) return;
    for (let i = 0; i < count; i++) {
      draft.installments.push({
        id: `ins_${Date.now()}_${i}`,
        label: `งวดที่ ${draft.installments.length + 1}`,
        dueDate: '',
        amount: 0
      });
    }
    this.render();
  }

  removeInstallmentRows(idxs) {
    const { draft } = this.state.ui.paymentPlanDialog;
    if (!draft || idxs.length === 0) return;
    const sorted = [...idxs].sort((a, b) => b - a);
    sorted.forEach(idx => draft.installments.splice(idx, 1));
    this.render();
  }

  removeInstallmentRow(idx) {
    const { draft } = this.state.ui.paymentPlanDialog;
    if (!draft) return;
    draft.installments.splice(idx, 1);
    this.render();
  }

  duplicateInstallmentRow(idx) {
    const { draft } = this.state.ui.paymentPlanDialog;
    if (!draft) return;
    const source = draft.installments[idx];

    let nextDueDate = source.dueDate;
    if (source.dueDate) {
      const d = new Date(source.dueDate);
      d.setMonth(d.getMonth() + 1);
      nextDueDate = d.toISOString().split('T')[0];
    }

    const duplicate = {
      id: `ins_${Date.now()}`,
      label: source.label,
      dueDate: nextDueDate,
      amount: source.amount
    };

    draft.installments.splice(idx + 1, 0, duplicate);
    this.render();
  }

  savePaymentPlan() {
    const { contractId, draft } = this.state.ui.paymentPlanDialog;
    const contract = this.state.contracts.find(c => c.id === contractId);
    if (!contract || !draft) return;

    contract.paymentPlan = JSON.parse(JSON.stringify(draft));
    contract.updatedAt = new Date().toISOString();
    this.closePaymentPlanDialog();
    this.saveState();
    this.render();
  }

  showConfirmDialog(message, callback) {
    this.state.ui.confirmDialog = {
      isOpen: true,
      action: { message, callback }
    };
    this.render();
  }

  closeConfirmDialog() {
    this.state.ui.confirmDialog = { isOpen: false, action: null };
    this.render();
  }

  /**
   * Contract Actions
   */
  duplicateContract(contractId) {
    const contract = this.state.contracts.find(c => c.id === contractId);
    if (contract) {
      const newContract = {
        ...JSON.parse(JSON.stringify(contract)),
        id: `c${Date.now()}`,
        name: `${contract.name} (Copy)`,
        parentContractId: null,
        childContractIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.state.contracts.push(newContract);
      this.saveState();
      this.render();
    }
  }

  createChildContract(parentContractId) {
    const parentContract = this.state.contracts.find(c => c.id === parentContractId);
    if (parentContract) {
      const childContract = {
        id: `c${Date.now()}`,
        name: `${parentContract.name} - Phase 2`,
        clientName: parentContract.clientName,
        status: 'draft',
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        billingCycle: parentContract.billingCycle,
        services: [],
        parentContractId: parentContractId,
        childContractIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.state.contracts.push(childContract);
      parentContract.childContractIds.push(childContract.id);
      this.saveState();
      this.render();
    }
  }

  toggleContractStatus(contractId) {
    const contract = this.state.contracts.find(c => c.id === contractId);
    if (contract) {
      contract.status = contract.status === 'active' ? 'draft' : 'active';
      contract.updatedAt = new Date().toISOString();
      this.saveState();
      this.render();
    }
  }

  getContractDescendantIds(contractId) {
    const contract = this.state.contracts.find(c => c.id === contractId);
    if (!contract) return [];
    const childIds = contract.childContractIds || [];
    return childIds.reduce((acc, id) => acc.concat(id, this.getContractDescendantIds(id)), []);
  }

  deleteContract(contractId) {
    const contract = this.state.contracts.find(c => c.id === contractId);
    if (!contract) return;

    if (contract.parentContractId) {
      const parent = this.state.contracts.find(c => c.id === contract.parentContractId);
      if (parent) {
        parent.childContractIds = (parent.childContractIds || []).filter(id => id !== contractId);
      }
    }

    const idsToDelete = new Set([contractId, ...this.getContractDescendantIds(contractId)]);
    this.state.contracts = this.state.contracts.filter(c => !idsToDelete.has(c.id));
    this.saveState();
    this.render();
  }

  getProjectDescendantIds(projectId) {
    const project = this.state.projects.find(p => p.id === projectId);
    if (!project) return [];
    const childIds = project.childProjectIds || [];
    return childIds.reduce((acc, id) => acc.concat(id, this.getProjectDescendantIds(id)), []);
  }

  deleteProject(projectId) {
    const project = this.state.projects.find(p => p.id === projectId);
    if (!project) return;

    if (project.parentProjectId) {
      const parent = this.state.projects.find(p => p.id === project.parentProjectId);
      if (parent) {
        parent.childProjectIds = (parent.childProjectIds || []).filter(id => id !== projectId);
      }
    }

    const idsToDelete = new Set([projectId, ...this.getProjectDescendantIds(projectId)]);
    this.state.projects = this.state.projects.filter(p => !idsToDelete.has(p.id));

    const taskIdsToDelete = new Set(
      this.state.tasks.filter(t => idsToDelete.has(t.projectId)).map(t => t.id)
    );
    this.state.tasks = this.state.tasks.filter(t => !idsToDelete.has(t.projectId));
    this.state.costs = this.state.costs.filter(c => !taskIdsToDelete.has(c.taskId));

    this.saveState();
    this.render();
  }

  duplicateProject(projectId) {
    const project = this.state.projects.find(p => p.id === projectId);
    if (project) {
      const newProjectId = `proj_${Date.now()}`;
      const newProject = {
        ...JSON.parse(JSON.stringify(project)),
        id: newProjectId,
        name: `${project.name} (Copy)`,
        parentProjectId: null,
        childProjectIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.state.projects.push(newProject);

      const projectTasks = this.state.tasks.filter(t => t.projectId === projectId);
      projectTasks.forEach((task, idx) => {
        const newTask = {
          ...JSON.parse(JSON.stringify(task)),
          id: `task_${Date.now()}_${idx}`,
          projectId: newProjectId,
          contractId: newProject.contractId,
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        this.state.tasks.push(newTask);
      });

      this.saveState();
      this.render();
    }
  }

  createChildProject(parentProjectId) {
    const parentProject = this.state.projects.find(p => p.id === parentProjectId);
    if (parentProject) {
      const childProject = {
        id: `proj_${Date.now()}`,
        name: `${parentProject.name} - Phase 2`,
        contractId: parentProject.contractId,
        description: '',
        startDate: new Date().toISOString().split('T')[0],
        dueDate: '',
        status: 'in-progress',
        parentProjectId: parentProjectId,
        childProjectIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      if (!parentProject.childProjectIds) parentProject.childProjectIds = [];
      this.state.projects.push(childProject);
      parentProject.childProjectIds.push(childProject.id);
      this.saveState();
      this.render();
    }
  }

  toggleProjectExpand(projectId) {
    if (!this.state.ui.expandedProjects) this.state.ui.expandedProjects = {};
    this.state.ui.expandedProjects[projectId] = !this.state.ui.expandedProjects[projectId];
    this.render();
  }

  toggleProjectContractExpand(contractId) {
    if (!this.state.ui.expandedProjectContracts) this.state.ui.expandedProjectContracts = {};
    this.state.ui.expandedProjectContracts[contractId] = !this.state.ui.expandedProjectContracts[contractId];
    this.render();
  }

  toggleTaskProjectExpand(projectId) {
    if (!this.state.ui.expandedTaskProjects) this.state.ui.expandedTaskProjects = {};
    this.state.ui.expandedTaskProjects[projectId] = !this.state.ui.expandedTaskProjects[projectId];
    this.render();
  }

  deleteTask(taskId) {
    this.state.tasks = this.state.tasks.filter(t => t.id !== taskId);
    this.saveState();
    this.render();
  }

  /**
   * Utility
   */
  formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH');
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(amount || 0);
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new ContractApp();
  window.app.attachNavListeners();
});
