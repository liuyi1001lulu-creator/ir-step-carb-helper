(() => {
  'use strict';

  const RECORDS_KEY = 'ir-step-carb.records.v1';
  const DRAFT_KEY = 'ir-step-carb.draft.v1';
  const SYMPTOMS = [
    { key: 'dizzy', label: '头晕心慌' },
    { key: 'craving', label: '渴望甜食' },
    { key: 'hairLoss', label: '脱发增多' },
    { key: 'cold', label: '感冒' }
  ];
  const SLEEP_DURATIONS = {
    lt6: '<6 小时',
    '6to7': '6–7 小时',
    '7to8': '7–8 小时',
    gt8: '>8 小时'
  };
  const SLIDERS = [
    { key: 'mood', low: '😔', middle: '🙂', high: '😄' },
    { key: 'energy', low: '🪫', middle: '🔋', high: '⚡' },
    { key: 'sleep', low: '🥱', middle: '😴', high: '🌙' }
  ];
  const get = (id) => document.getElementById(id);
  const ui = {
    form: get('checkinForm'),
    weight: get('weightKg'),
    bodyFat: get('bodyFatPct'),
    mood: get('mood'),
    energy: get('energy'),
    sleepScore: get('sleepScore'),
    sleepDuration: get('sleepDuration'),
    formError: get('formError'),
    results: get('results'),
    leanMassValue: get('leanMassValue'),
    proteinValue: get('proteinValue'),
    fatValue: get('fatValue'),
    carbValue: get('carbValue'),
    adviceList: get('adviceList'),
    saveRecord: get('saveRecord'),
    historyList: get('historyList'),
    historyCount: get('historyCount'),
    clearHistory: get('clearHistory'),
    baseDate: get('baseDate'),
    currentDate: get('currentDate'),
    generateComparison: get('generateComparison'),
    compareEmpty: get('compareEmpty'),
    compareReport: get('compareReport'),
    storageWarning: get('storageWarning'),
    toast: get('toast')
  };
  const state = {
    records: [],
    currentPlan: null,
    storageReady: true,
    storageCorrupt: false,
    toastTimer: null
  };

  initialize();

  function initialize() {
    state.storageReady = storageAvailable();
    if (state.storageReady) {
      state.records = loadRecords();
      restoreDraft();
    }
    updateStorageWarning();
    updateFeedback();
    updateSymptomStyles();
    renderHistory();
    refreshCompareSelectors();
    switchTab('today');

    document.querySelectorAll('.tab').forEach((tab) => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
    ui.form.addEventListener('input', onFormInput);
    ui.form.addEventListener('submit', onFormSubmit);
    ui.saveRecord.addEventListener('click', saveRecord);
    ui.historyList.addEventListener('click', onHistoryClick);
    ui.clearHistory.addEventListener('click', clearHistory);
    ui.baseDate.addEventListener('change', clearComparison);
    ui.currentDate.addEventListener('change', clearComparison);
    ui.generateComparison.addEventListener('click', generateComparison);
  }

  function storageAvailable() {
    try {
      const probe = '__ir_step_carb_probe__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return true;
    } catch (error) {
      return false;
    }
  }

  function loadRecords() {
    try {
      const raw = localStorage.getItem(RECORDS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error('档案格式错误');
      const records = parsed.map(normalizeRecord);
      if (records.some((record) => record === null)) throw new Error('档案内容错误');
      const uniqueRecords = new Map();
      records.forEach((record) => uniqueRecords.set(record.date, record));
      return Array.from(uniqueRecords.values()).sort((left, right) => right.date.localeCompare(left.date));
    } catch (error) {
      state.storageCorrupt = true;
      return [];
    }
  }

  function normalizeRecord(record) {
    if (!record || typeof record !== 'object' || typeof record.date !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(record.date)) return null;
    const weightKg = Number(record.weightKg);
    const bodyFatPct = Number(record.bodyFatPct);
    const leanKg = Number(record.leanKg);
    const macros = record.macros || {};
    const scores = record.scores || {};
    if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 400 ||
        !Number.isFinite(bodyFatPct) || bodyFatPct < 1 || bodyFatPct > 75 ||
        !Number.isFinite(leanKg) || leanKg <= 0 ||
        !Number.isFinite(Number(macros.proteinG)) || Number(macros.proteinG) <= 0 ||
        !Number.isFinite(Number(macros.fatG)) || Number(macros.fatG) <= 0 ||
        !Number.isFinite(Number(macros.carbG)) || Number(macros.carbG) <= 0 ||
        !['mood', 'energy', 'sleep'].every((key) => Number.isInteger(scores[key]) && scores[key] >= 0 && scores[key] <= 10) ||
        !Object.prototype.hasOwnProperty.call(SLEEP_DURATIONS, record.sleepDuration) ||
        !Array.isArray(record.symptoms)) return null;
    return {
      date: record.date,
      savedAt: typeof record.savedAt === 'string' ? record.savedAt : '',
      weightKg,
      bodyFatPct,
      leanKg,
      macros: {
        proteinG: Number(macros.proteinG),
        fatG: Number(macros.fatG),
        carbG: Number(macros.carbG)
      },
      scores: { mood: scores.mood, energy: scores.energy, sleep: scores.sleep },
      sleepDuration: record.sleepDuration,
      symptoms: Array.from(new Set(record.symptoms.filter((key) => SYMPTOMS.some((symptom) => symptom.key === key))))
    };
  }

  function restoreDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (!draft || typeof draft !== 'object') return;
      if (draft.weightKg !== undefined) ui.weight.value = draft.weightKg;
      if (draft.bodyFatPct !== undefined) ui.bodyFat.value = draft.bodyFatPct;
      if (Object.prototype.hasOwnProperty.call(SLEEP_DURATIONS, draft.sleepDuration)) {
        ui.sleepDuration.value = draft.sleepDuration;
      }
      SLIDERS.forEach((slider) => {
        const value = Number(draft[slider.key]);
        if (Number.isInteger(value) && value >= 0 && value <= 10) {
          get(slider.key === 'sleep' ? 'sleepScore' : slider.key).value = value;
        }
      });
      if (Array.isArray(draft.symptoms)) {
        ui.form.querySelectorAll('input[name="symptom"]').forEach((checkbox) => {
          checkbox.checked = draft.symptoms.includes(checkbox.value);
        });
      }
    } catch (error) {
      return;
    }
  }

  function saveDraft() {
    if (!state.storageReady) return;
    const draft = {
      weightKg: ui.weight.value,
      bodyFatPct: ui.bodyFat.value,
      mood: Number(ui.mood.value),
      energy: Number(ui.energy.value),
      sleep: Number(ui.sleepScore.value),
      sleepDuration: ui.sleepDuration.value,
      symptoms: selectedSymptoms()
    };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch (error) {
      state.storageReady = false;
      updateStorageWarning();
    }
  }

  function updateStorageWarning() {
    if (!state.storageReady) {
      ui.storageWarning.textContent = '当前浏览器不允许本地存储。仍可计算，但无法保存档案；请在允许本地存储的浏览器中打开本页面。';
      ui.storageWarning.hidden = false;
    } else if (state.storageCorrupt) {
      ui.storageWarning.textContent = '本地历史数据格式异常。为避免覆盖原数据，已暂停保存；可在“历史档案”中确认清空损坏数据。';
      ui.storageWarning.hidden = false;
    } else {
      ui.storageWarning.hidden = true;
    }
    ui.saveRecord.disabled = !state.storageReady || state.storageCorrupt;
  }

  function switchTab(name) {
    document.querySelectorAll('.tab').forEach((tab) => {
      const active = tab.dataset.tab === name;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    ['today', 'history', 'compare'].forEach((panelName) => {
      get('panel-' + panelName).hidden = panelName !== name;
    });
  }

  function onFormInput() {
    state.currentPlan = null;
    ui.results.hidden = true;
    ui.formError.hidden = true;
    updateFeedback();
    updateSymptomStyles();
    saveDraft();
  }

  function updateFeedback() {
    SLIDERS.forEach((slider) => {
      const input = get(slider.key === 'sleep' ? 'sleepScore' : slider.key);
      const score = Number(input.value);
      const emoji = score <= 3 ? slider.low : score <= 6 ? slider.middle : slider.high;
      input.style.setProperty('--fill', String(score * 10) + '%');
      get(slider.key + 'Emoji').textContent = emoji;
      get(slider.key + 'Value').textContent = String(score) + ' 分';
    });
  }

  function updateSymptomStyles() {
    ui.form.querySelectorAll('.symptom').forEach((label) => {
      label.classList.toggle('checked', label.querySelector('input').checked);
    });
  }

  function selectedSymptoms() {
    return Array.from(ui.form.querySelectorAll('input[name="symptom"]:checked'), (checkbox) => checkbox.value);
  }

  function readForm() {
    const weightKg = Number(ui.weight.value);
    const bodyFatPct = Number(ui.bodyFat.value);
    if (!ui.weight.value || !Number.isFinite(weightKg) || weightKg < 20 || weightKg > 400) {
      throw new Error('请输入 20–400 kg 范围内的体重。');
    }
    if (!ui.bodyFat.value || !Number.isFinite(bodyFatPct) || bodyFatPct < 1 || bodyFatPct > 75) {
      throw new Error('请输入 1–75% 范围内的体脂率，例如 25。');
    }
    if (!Object.prototype.hasOwnProperty.call(SLEEP_DURATIONS, ui.sleepDuration.value)) {
      throw new Error('请选择昨晚的睡眠时长。');
    }
    return {
      weightKg,
      bodyFatPct,
      scores: {
        mood: Number(ui.mood.value),
        energy: Number(ui.energy.value),
        sleep: Number(ui.sleepScore.value)
      },
      sleepDuration: ui.sleepDuration.value,
      symptoms: selectedSymptoms()
    };
  }

  function calculatePlan(form) {
    const leanKg = form.weightKg * (1 - form.bodyFatPct / 100);
    return {
      form,
      leanKg,
      macros: {
        proteinG: leanKg * 2,
        fatG: leanKg * 0.8,
        carbG: leanKg * 3
      },
      advice: generateAdvice(form)
    };
  }

  function generateAdvice(form) {
    const advice = [];
    const symptoms = form.symptoms;
    if (symptoms.includes('dizzy')) {
      advice.push({
        level: 'urgent',
        title: '先处理头晕心慌',
        body: '先暂停继续降碳。头晕、心慌可能有多种原因，包括低血糖；若正使用降糖药，可按既有医疗方案测血糖并处理。症状持续、加重或明显不适时及时就医。'
      });
    }
    if (symptoms.includes('hairLoss')) {
      advice.push({
        level: 'watch',
        title: '脱发增多：暂停降碳',
        body: '先检查总能量、蛋白质及铁等营养摄入。持续脱发需要医生评估，不宜只靠增加某一种营养素解决。'
      });
    }
    if (form.scores.energy <= 3) {
      advice.push({
        level: 'watch',
        title: '精力偏低：先别继续减碳',
        body: '先确认是否规律进餐、摄入是否充足。若只是轻度乏力，可在正餐增加一小份全谷物或豆类等碳水，并观察身体反应。'
      });
    }
    if (form.scores.mood <= 3) {
      advice.push({
        level: 'watch',
        title: '情绪偏低：关注饮食压力',
        body: '避免进一步压低碳水摄入；尽量保持规律三餐。若情绪低落持续或影响生活，寻求专业支持。'
      });
    }
    if (form.scores.sleep <= 3 || form.sleepDuration === 'lt6') {
      advice.push({
        level: 'watch',
        title: '睡眠欠佳：优先恢复',
        body: '先保证睡眠时间与总能量。若近期脂肪摄入很少，可在正餐加入少量坚果、橄榄油等健康脂肪；这不等于治疗睡眠问题。'
      });
    }
    if (symptoms.includes('craving')) {
      advice.push({
        level: 'watch',
        title: '想吃甜食：观察饥饿与餐次',
        body: '单凭渴望甜食无法判断碳水不足。优先规律进餐、选择高纤维主食；若饥饿明显，可适当增加一小份复合碳水。'
      });
    }
    if (symptoms.includes('cold')) {
      advice.push({
        level: 'watch',
        title: '感冒期间：先照顾恢复',
        body: '先保证正常进食、饮水和休息，暂缓进一步减少食物或碳水；症状明显或持续时就医。'
      });
    }
    if (advice.length === 0) {
      advice.push({
        level: 'good',
        title: '今天未触发额外预警',
        body: '继续观察多日趋势。单次评分和体脂率不能证明当前配比一定适合你，也无需根据一天的波动急着调整。'
      });
    }
    return advice;
  }

  function onFormSubmit(event) {
    event.preventDefault();
    try {
      state.currentPlan = calculatePlan(readForm());
      renderPlan(state.currentPlan);
      ui.formError.hidden = true;
      ui.results.hidden = false;
      ui.saveRecord.textContent = state.records.some((record) => record.date === localDate())
        ? '📁 更新今日档案'
        : '📁 保存为今日档案';
      ui.results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      state.currentPlan = null;
      ui.results.hidden = true;
      ui.formError.textContent = error.message;
      ui.formError.hidden = false;
    }
  }

  function renderPlan(plan) {
    ui.leanMassValue.textContent = oneDecimal(plan.leanKg);
    ui.proteinValue.textContent = oneDecimal(plan.macros.proteinG);
    ui.fatValue.textContent = oneDecimal(plan.macros.fatG);
    ui.carbValue.textContent = oneDecimal(plan.macros.carbG);
    ui.adviceList.replaceChildren();
    plan.advice.forEach((item) => {
      const card = make('div', 'advice-item ' + item.level);
      card.append(make('strong', '', item.title), make('p', '', item.body));
      ui.adviceList.append(card);
    });
  }

  function localDate() {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return String(today.getFullYear()) + '-' + month + '-' + day;
  }

  function saveRecord() {
    if (!state.currentPlan || !state.storageReady || state.storageCorrupt) return;
    const date = localDate();
    const existing = state.records.some((record) => record.date === date);
    if (existing && !window.confirm('今天已有一份档案。确定用当前数据更新吗？')) return;
    const plan = state.currentPlan;
    const record = {
      date,
      savedAt: new Date().toISOString(),
      weightKg: plan.form.weightKg,
      bodyFatPct: plan.form.bodyFatPct,
      leanKg: plan.leanKg,
      macros: { ...plan.macros },
      scores: { ...plan.form.scores },
      sleepDuration: plan.form.sleepDuration,
      symptoms: [...plan.form.symptoms]
    };
    const nextRecords = [record, ...state.records.filter((item) => item.date !== date)]
      .sort((left, right) => right.date.localeCompare(left.date));
    if (commitRecords(nextRecords)) {
      ui.saveRecord.textContent = '📁 更新今日档案';
      flash(existing ? '今日档案已更新' : '今日档案已保存');
    }
  }

  function commitRecords(records) {
    try {
      localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
      state.records = records;
      renderHistory();
      refreshCompareSelectors();
      return true;
    } catch (error) {
      flash('保存失败：浏览器本地存储不可用或空间不足', true);
      return false;
    }
  }

  function renderHistory() {
    ui.historyList.replaceChildren();
    ui.historyCount.textContent = '共 ' + state.records.length + ' 份档案 · 同一天再次保存会更新当天记录';
    ui.clearHistory.disabled = !state.storageReady || (state.records.length === 0 && !state.storageCorrupt);
    if (state.records.length === 0) {
      const empty = make('div', 'empty');
      empty.append(make('span', 'empty-icon', '📁'), make('strong', '', '还没有历史档案'),
        make('p', '', '去“今日打卡”生成结果，点击保存即可开始记录。'));
      ui.historyList.append(empty);
      return;
    }
    state.records.forEach((record) => {
      const card = make('article', 'archive');
      const header = make('div', 'archive-head');
      const heading = make('div');
      heading.append(make('strong', 'archive-date', displayDate(record.date)),
        make('span', 'archive-sub', '睡眠时长 ' + SLEEP_DURATIONS[record.sleepDuration]));
      const deleteButton = make('button', 'small-btn', '删除');
      deleteButton.type = 'button';
      deleteButton.dataset.deleteDate = record.date;
      deleteButton.setAttribute('aria-label', '删除 ' + displayDate(record.date) + ' 的档案');
      header.append(heading, deleteButton);
      card.append(header);
      const metrics = make('div', 'archive-metrics');
      [
        '体重 ' + oneDecimal(record.weightKg) + ' kg',
        '体脂 ' + oneDecimal(record.bodyFatPct) + '%',
        '瘦体重 ' + oneDecimal(record.leanKg) + ' kg',
        '蛋白 ' + oneDecimal(record.macros.proteinG) + ' g',
        '脂肪 ' + oneDecimal(record.macros.fatG) + ' g',
        '碳水 ' + oneDecimal(record.macros.carbG) + ' g'
      ].forEach((value) => metrics.append(make('span', '', value)));
      card.append(metrics);
      card.append(make('div', 'archive-feedback',
        '情绪 ' + record.scores.mood + ' 分 · 精力 ' + record.scores.energy +
        ' 分 · 睡眠 ' + record.scores.sleep + ' 分'));
      const symptoms = make('div', 'archive-symptoms');
      if (record.symptoms.length === 0) {
        symptoms.append(make('span', 'symptom-chip', '无已选异常症状'));
      } else {
        record.symptoms.forEach((key) => {
          const symptom = SYMPTOMS.find((item) => item.key === key);
          symptoms.append(make('span', 'symptom-chip', symptom.label));
        });
      }
      card.append(symptoms);
      ui.historyList.append(card);
    });
  }

  function onHistoryClick(event) {
    const button = event.target.closest('[data-delete-date]');
    if (!button) return;
    const date = button.dataset.deleteDate;
    if (!window.confirm('确定删除 ' + displayDate(date) + ' 的档案吗？此操作不可恢复。')) return;
    const nextRecords = state.records.filter((record) => record.date !== date);
    if (commitRecords(nextRecords)) {
      flash('档案已删除');
      if (date === localDate() && state.currentPlan) ui.saveRecord.textContent = '📁 保存为今日档案';
    }
  }

  function clearHistory() {
    if (!state.storageReady) return;
    if (!window.confirm('确定清空所有历史档案吗？此操作不可恢复。')) return;
    try {
      localStorage.removeItem(RECORDS_KEY);
      state.records = [];
      state.storageCorrupt = false;
      updateStorageWarning();
      renderHistory();
      refreshCompareSelectors();
      if (state.currentPlan) ui.saveRecord.textContent = '📁 保存为今日档案';
      flash('历史档案已清空');
    } catch (error) {
      flash('清空失败，请检查浏览器的存储权限', true);
    }
  }

  function refreshCompareSelectors() {
    const oldBase = ui.baseDate.value;
    const oldCurrent = ui.currentDate.value;
    [ui.baseDate, ui.currentDate].forEach((select) => {
      select.replaceChildren(new Option('请选择日期', ''));
      state.records.forEach((record) => {
        select.add(new Option(displayDate(record.date), record.date));
      });
    });
    const knownDates = state.records.map((record) => record.date);
    ui.baseDate.value = knownDates.includes(oldBase) ? oldBase : (knownDates[1] || '');
    ui.currentDate.value = knownDates.includes(oldCurrent) ? oldCurrent : (knownDates[0] || '');
    if (ui.baseDate.value === ui.currentDate.value && knownDates.length >= 2) {
      ui.baseDate.value = knownDates.find((date) => date !== ui.currentDate.value);
    }
    ui.generateComparison.disabled = state.records.length < 2;
    ui.compareEmpty.hidden = state.records.length >= 2;
    clearComparison();
  }

  function clearComparison() {
    ui.compareReport.hidden = true;
    ui.compareReport.replaceChildren();
  }

  function generateComparison() {
    const base = state.records.find((record) => record.date === ui.baseDate.value);
    const current = state.records.find((record) => record.date === ui.currentDate.value);
    if (!base || !current || base.date === current.date) {
      flash('请选择两个不同日期的档案', true);
      return;
    }
    const changes = {
      weight: current.weightKg - base.weightKg,
      bodyFat: current.bodyFatPct - base.bodyFatPct,
      lean: current.leanKg - base.leanKg,
      mood: current.scores.mood - base.scores.mood,
      energy: current.scores.energy - base.scores.energy,
      sleep: current.scores.sleep - base.scores.sleep
    };
    const overall = evaluateComparison(base, current, changes);
    ui.compareReport.replaceChildren();
    const summary = make('div', 'report-top ' + overall.level);
    summary.append(make('strong', '', overall.title), make('p', '', overall.text));
    ui.compareReport.append(summary);
    ui.compareReport.append(make('p', 'report-period',
      displayDate(base.date) + ' → ' + displayDate(current.date)));
    const grid = make('div', 'report-grid');
    [
      ['体重', oneDecimal(base.weightKg) + ' → ' + oneDecimal(current.weightKg) + ' kg', signedDecimal(changes.weight) + ' kg'],
      ['体脂率', oneDecimal(base.bodyFatPct) + '% → ' + oneDecimal(current.bodyFatPct) + '%', signedDecimal(changes.bodyFat) + ' 个百分点'],
      ['瘦体重', oneDecimal(base.leanKg) + ' → ' + oneDecimal(current.leanKg) + ' kg', signedDecimal(changes.lean) + ' kg'],
      ['情绪指数', base.scores.mood + ' → ' + current.scores.mood + ' 分', signedInteger(changes.mood) + ' 分'],
      ['精力指数', base.scores.energy + ' → ' + current.scores.energy + ' 分', signedInteger(changes.energy) + ' 分'],
      ['睡眠质量', base.scores.sleep + ' → ' + current.scores.sleep + ' 分', signedInteger(changes.sleep) + ' 分']
    ].forEach((metric) => {
      const card = make('div', 'report-metric');
      card.append(make('small', '', metric[0]), make('strong', '', metric[1]), make('span', '', metric[2]));
      grid.append(card);
    });
    ui.compareReport.append(grid, make('h3', 'report-subhead', '异常症状变化'));
    const symptomList = make('div', 'symptom-change-list');
    SYMPTOMS.forEach((symptom) => {
      const before = base.symptoms.includes(symptom.key);
      const after = current.symptoms.includes(symptom.key);
      const status = !before && after ? 'new' : before && !after ? 'resolved' : '';
      const row = make('div', 'symptom-change ' + status);
      row.append(make('span', '', symptom.label),
        make('strong', '', (before ? '有' : '无') + ' → ' + (after ? '有' : '无')));
      symptomList.append(row);
    });
    ui.compareReport.append(symptomList);
    ui.compareReport.append(make('p', 'report-note',
      '瘦体重由体重与体脂率推算，体脂秤读数可能受水分和测量条件影响。请尽量在相似条件下测量，避免依据一次对比做医疗判断。'));
    ui.compareReport.hidden = false;
    ui.compareReport.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function evaluateComparison(base, current, changes) {
    const newSymptoms = current.symptoms.filter((key) => !base.symptoms.includes(key));
    if (current.symptoms.includes('dizzy')) {
      return {
        level: 'urgent',
        title: '先关注头晕心慌，再考虑降碳',
        text: '当前档案记录了头晕心慌。体重和营养素变化无法解释这一症状；先暂停进一步降碳，并根据实际情况测血糖或就医。'
      };
    }
    if (current.symptoms.includes('hairLoss') || changes.energy <= -2 ||
        changes.sleep <= -2 || changes.mood <= -2 || newSymptoms.length > 0) {
      return {
        level: 'watch',
        title: '身体反馈出现需要关注的变化',
        text: '有症状新增或主观状态下降。建议先检查睡眠、进食是否充足，并暂停进一步减少碳水；如症状持续，请咨询专业人员。'
      };
    }
    if (changes.weight < -0.1 && changes.lean < -0.3) {
      return {
        level: 'watch',
        title: '体重下降，同时估算瘦体重也下降',
        text: '可先复核体脂测量条件，并关注蛋白质、总摄入量和力量活动。单次差异不能确认真实肌肉流失。'
      };
    }
    if (changes.weight < -0.1 && changes.lean >= -0.3 &&
        changes.mood >= 0 && changes.energy >= 0 && changes.sleep >= 0 &&
        newSymptoms.length === 0) {
      return {
        level: 'good',
        title: '体重下降，主观状态未变差',
        text: '这是值得继续观察的趋势，但两次记录仍不足以判断当前碳水配比“完美”。建议保持规律记录，不急于进一步降碳。'
      };
    }
    return {
      level: 'good',
      title: '继续观察多日趋势',
      text: '体重、体脂和主观状态的短期变化可能不同步。建议结合更多日期与症状变化，再决定是否调整饮食。'
    };
  }

  function displayDate(date) {
    const parts = date.split('-');
    return parts[0] + ' 年 ' + Number(parts[1]) + ' 月 ' + Number(parts[2]) + ' 日';
  }

  function oneDecimal(value) {
    return Number(value).toFixed(1);
  }

  function signedDecimal(value) {
    const rounded = Math.abs(value) < 0.05 ? 0 : value;
    return (rounded > 0 ? '+' : '') + oneDecimal(rounded);
  }

  function signedInteger(value) {
    return (value > 0 ? '+' : '') + String(value);
  }

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function flash(message, isError) {
    clearTimeout(state.toastTimer);
    ui.toast.textContent = message;
    ui.toast.className = 'toast show' + (isError ? ' error' : '');
    state.toastTimer = setTimeout(() => {
      ui.toast.className = 'toast';
    }, 3200);
  }
})();
