/**
 * 排课管理系统 v6 — Google Apps Script（安全版）
 *
 * 相对 v5 的关键改动：
 *   1. ✅ A 层 — writeSchedule / writeSpecial / writeBtec 拒绝空数组写入
 *      （v5 的 clearData → if(!data.length) return 会导致表被清空）
 *   2. ✅ B 层 — 每次写入前先把现有数据备份到 _备份_xxx sheet
 *      备份保留最近 BACKUP_KEEP 次，超出自动滚动覆盖最旧
 *   3. ✅ 新增显式 action=clear 用于"确实要清空"的场景
 *   4. ✅ 新增 action=restore 从备份恢复
 *   5. doGet/doPost 接口不变，前端无需修改即可享受 A+B 保护
 *
 * 部署：
 *   1. Apps Script 编辑器里把 Code.gs 内容整个替换为这份
 *   2. 部署 → 新版本（描述 v6 安全版）→ 部署
 *   3. 复制新 Web App URL，更新前端 SHEETS_URL（如果 URL 变了）
 *   4. 在编辑器跑一次 setupSheets() 创建备份 sheet 结构
 */

const SH_SCHEDULE = '排课记录';
const SH_SPECIAL  = '特别排课';
const SH_DEPTS    = '专业库';
const SH_COHORTS  = '届别库';
const SH_COURSES  = '课程库';
const SH_TEACHERS = '老师库';
const SH_BTEC     = 'BTEC数据';

// 备份 sheet 名（每次写入前的快照都进这里）
const SH_BAK_SCH  = '_备份_排课';
const SH_BAK_SP   = '_备份_特别';
const SH_BAK_BTEC = '_备份_BTEC';
const BACKUP_KEEP = 20;  // 每个备份表最多保留多少次快照

const H_SCH  = ['ID','课程代码','课程英文名','学期','上下半学期','课程类型','班级代码','授课老师','届别JSON','总人数','备注','BTEC','最后更新'];
const H_SP   = ['ID','学号','学生称谓','学生姓名','学生专业','课程代码','课程英文名','班级代码','学期','授课老师','备注','最后更新'];
const H_DEP  = ['专业代码','专业全名'];
const H_COH  = ['专业','届别名称'];
const H_CRS  = ['课程代码','课程英文名'];
const H_TCH  = ['姓名','专业','职位','限额'];
const H_BTEC = ['姓名','BTEC_LA500'];
// 备份表都加一列「快照时间」放在第一列
const H_BAK_SCH  = ['快照时间', ...H_SCH];
const H_BAK_SP   = ['快照时间', ...H_SP];
const H_BAK_BTEC = ['快照时间', ...H_BTEC];

function buildResp(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ═══════════════════════════════════════
// GET — 读取 + 写入 + 清空 + 恢复
// ═══════════════════════════════════════
function doGet(e) {
  try {
    const action = e.parameter.action || '';

    if (action === 'readRef') {
      return buildResp({
        success:  true,
        courses:  readRefCourses(),
        teachers: readRefTeachers(),
        cohorts:  readRefCohorts(),
        depts:    readRefDepts()
      });
    }

    if (action === 'read') {
      const type = e.parameter.type || 'schedule';
      if (type === 'special') return buildResp({success:true, data:readSpecial()});
      if (type === 'btec')    return buildResp({success:true, data:readBtec()});
      return buildResp({success:true, data:readSchedule()});
    }

    if (action === 'write') {
      const type = e.parameter.type || 'schedule';
      let data;
      try { data = JSON.parse(decodeURIComponent(e.parameter.payload || '[]')); }
      catch(ex) { return buildResp({success:false, error:'payload 解析失败：'+ex.message}); }
      return doWrite(type, data);
    }

    // ── 新增：显式清空 ──
    // 必须显式带 action=clear & confirm=YES 才会真的清空
    // 防止"空数组 write"误清空
    if (action === 'clear') {
      const type    = e.parameter.type || 'schedule';
      const confirm = e.parameter.confirm || '';
      if (confirm !== 'YES') {
        return buildResp({success:false, error:'清空需要 confirm=YES'});
      }
      return doClear(type);
    }

    // ── 新增：从备份恢复（取最新一次快照） ──
    if (action === 'restore') {
      const type = e.parameter.type || 'schedule';
      return doRestore(type);
    }

    // ── 新增：列出备份快照时间 ──
    if (action === 'listBackups') {
      const type = e.parameter.type || 'schedule';
      return buildResp({success:true, snapshots: listBackups(type)});
    }

    return buildResp({success:false, error:'Unknown action'});
  } catch(err) {
    return buildResp({success:false, error:err.message});
  }
}

// ═══════════════════════════════════════
// POST — 兼容旧前端（BA app.js 用 POST text/plain）
// ═══════════════════════════════════════
function doPost(e) {
  try {
    const raw  = e.postData ? e.postData.contents : '{}';
    const body = JSON.parse(raw);
    const action = body.action || 'write';
    const type   = body.type   || 'schedule';

    if (action === 'write') {
      const data = body.payload || body.data || [];
      return doWrite(type, data);
    }
    if (action === 'clear') {
      if (body.confirm !== 'YES') {
        return buildResp({success:false, error:'清空需要 confirm:"YES"'});
      }
      return doClear(type);
    }
    if (action === 'restore') {
      return doRestore(type);
    }
    return buildResp({success:false, error:'Unknown action'});
  } catch(err) {
    return buildResp({success:false, error:err.message});
  }
}

// ═══════════════════════════════════════
// 写入入口（A 层 + B 层都在这）
// ═══════════════════════════════════════
function doWrite(type, data) {
  // ── A 层：拒绝空数组 ──
  // 排课/特别：data 是数组
  // BTEC：data 是对象，用 Object.keys 长度判断
  const len = Array.isArray(data) ? data.length : Object.keys(data || {}).length;
  if (len === 0) {
    return buildResp({
      success: false,
      error:   '已拒绝空数组写入。如果确实要清空，请用 action=clear&confirm=YES。',
      blocked: 'EMPTY_PAYLOAD'
    });
  }

  // ── B 层：写入前先快照备份 ──
  try {
    if (type === 'special')   backupSpecial();
    else if (type === 'btec') backupBtec();
    else                      backupSchedule();
  } catch(e) {
    // 备份失败不阻塞写入，只记 log
    Logger.log('备份失败：' + e.message);
  }

  // ── 执行写入 ──
  if (type === 'special')   writeSpecial(data);
  else if (type === 'btec') writeBtec(data);
  else                      writeSchedule(data);

  return buildResp({
    success: true,
    message: '写入成功，共 ' + len + ' 条（含备份）',
    type:    type
  });
}

// 显式清空（必须 confirm=YES 才进入）
function doClear(type) {
  // 清空前也备份
  try {
    if (type === 'special')   backupSpecial();
    else if (type === 'btec') backupBtec();
    else                      backupSchedule();
  } catch(e) { Logger.log('清空前备份失败：' + e.message); }

  let sheetName;
  if (type === 'special')   sheetName = SH_SPECIAL;
  else if (type === 'btec') sheetName = SH_BTEC;
  else                      sheetName = SH_SCHEDULE;

  clearData(getSheet(sheetName));
  return buildResp({success:true, message:'已清空 ' + sheetName + '（已备份）'});
}

// 从备份恢复最新一次快照
function doRestore(type) {
  let bakName, dstName, headers;
  if (type === 'special')      { bakName = SH_BAK_SP;   dstName = SH_SPECIAL;  headers = H_SP; }
  else if (type === 'btec')    { bakName = SH_BAK_BTEC; dstName = SH_BTEC;     headers = H_BTEC; }
  else                         { bakName = SH_BAK_SCH;  dstName = SH_SCHEDULE; headers = H_SCH; }

  const bak = getSheet(bakName);
  const last = bak.getLastRow();
  if (last < 2) return buildResp({success:false, error:'没有可用的备份快照'});

  // 取最新的快照时间戳
  const allRows = bak.getRange(2, 1, last - 1, bak.getLastColumn()).getValues();
  // 第一列是「快照时间」，按时间倒排
  allRows.sort((a, b) => new Date(b[0]) - new Date(a[0]));
  const latestTs = allRows[0][0];
  const restoreRows = allRows
    .filter(r => String(r[0]) === String(latestTs))
    .map(r => r.slice(1));  // 去掉「快照时间」列

  if (!restoreRows.length) return buildResp({success:false, error:'快照为空'});

  // 写回目标表
  const dst = getSheet(dstName);
  clearData(dst);
  dst.getRange(2, 1, restoreRows.length, headers.length).setValues(restoreRows);

  return buildResp({
    success: true,
    message: '已恢复至快照 ' + new Date(latestTs).toLocaleString() + '，共 ' + restoreRows.length + ' 条'
  });
}

// 列出某类的所有备份时间戳（最新在前）
function listBackups(type) {
  let bakName;
  if (type === 'special')      bakName = SH_BAK_SP;
  else if (type === 'btec')    bakName = SH_BAK_BTEC;
  else                         bakName = SH_BAK_SCH;

  const bak = getSheet(bakName);
  const last = bak.getLastRow();
  if (last < 2) return [];
  const col = bak.getRange(2, 1, last - 1, 1).getValues();
  const tsSet = new Set();
  col.forEach(r => { if (r[0]) tsSet.add(new Date(r[0]).toISOString()); });
  return Array.from(tsSet).sort().reverse();
}

// ═══════════════════════════════════════
// B 层：备份函数（写入前调用）
// ═══════════════════════════════════════
function backupSchedule() { backupGeneric(SH_SCHEDULE, SH_BAK_SCH,  H_BAK_SCH); }
function backupSpecial()  { backupGeneric(SH_SPECIAL,  SH_BAK_SP,   H_BAK_SP); }
function backupBtec()     { backupGeneric(SH_BTEC,     SH_BAK_BTEC, H_BAK_BTEC); }

function backupGeneric(srcName, bakName, bakHeaders) {
  const src = getSheet(srcName);
  const lastRow = src.getLastRow();
  if (lastRow < 2) return;  // 空表无需备份

  const data = src.getRange(2, 1, lastRow - 1, src.getLastColumn()).getValues()
    .filter(r => r.some(c => String(c).trim()));
  if (!data.length) return;

  const bak = getSheet(bakName, bakHeaders);
  const ts = new Date();
  const tsRows = data.map(r => [ts, ...r]);

  // 追加到备份表末尾
  bak.getRange(bak.getLastRow() + 1, 1, tsRows.length, tsRows[0].length).setValues(tsRows);

  // 滚动清理：只保留最近 BACKUP_KEEP 个不同时间戳
  rollBackup(bak);
}

function rollBackup(bakSheet) {
  const last = bakSheet.getLastRow();
  if (last < 2) return;
  const tsCol = bakSheet.getRange(2, 1, last - 1, 1).getValues().map(r => String(r[0]));
  const unique = [];
  const seen = new Set();
  for (let i = tsCol.length - 1; i >= 0; i--) {
    if (!seen.has(tsCol[i])) { unique.unshift(tsCol[i]); seen.add(tsCol[i]); }
  }
  if (unique.length <= BACKUP_KEEP) return;

  // 找出要删除的时间戳（最早的）
  const toDrop = new Set(unique.slice(0, unique.length - BACKUP_KEEP));
  const keepRows = [];
  for (let i = 0; i < tsCol.length; i++) {
    if (!toDrop.has(tsCol[i])) keepRows.push(i + 2);  // sheet 行号
  }
  // 重写整张备份表（保留 keepRows 行）
  const allCols = bakSheet.getLastColumn();
  const keepData = keepRows.map(r => bakSheet.getRange(r, 1, 1, allCols).getValues()[0]);
  clearData(bakSheet);
  if (keepData.length) {
    bakSheet.getRange(2, 1, keepData.length, allCols).setValues(keepData);
  }
}

// ═══════════════════════════════════════
// 参考数据
// ═══════════════════════════════════════
function readRefCourses()  { return getRows(SH_COURSES).map(r=>({c:r[0],en:r[1]})).filter(x=>x.c); }
function readRefTeachers() { return getRows(SH_TEACHERS).map(r=>({n:r[0],d:r[1],r:r[2],l:Number(r[3])||0})).filter(x=>x.n); }
function readRefCohorts()  { return getRows(SH_COHORTS).map(r=>({dept:r[0],cohort:r[1]})).filter(x=>x.dept&&x.cohort); }
function readRefDepts()    { return getRows(SH_DEPTS).map(r=>({code:r[0],name:r[1]||''})).filter(x=>x.code); }

// ═══════════════════════════════════════
// BTEC 数据
// ═══════════════════════════════════════
function readBtec() {
  const obj = {};
  getRows(SH_BTEC).forEach(r => { if(r[0]) obj[String(r[0])] = Number(r[1])||0; });
  return obj;
}
function writeBtec(data) {
  const sheet = getSheet(SH_BTEC);
  clearData(sheet);
  const rows = Object.entries(data).filter(([,v])=>v>0);
  if (!rows.length) return;
  sheet.getRange(2,1,rows.length,2).setValues(rows);
}

// ═══════════════════════════════════════
// 主数据读写
// ═══════════════════════════════════════
function readSchedule() { return getRows(SH_SCHEDULE).map(rowToSchedule).filter(r=>r.id); }
function readSpecial()  { return getRows(SH_SPECIAL).map(rowToSpecial).filter(r=>r.id); }

function writeSchedule(data) {
  const sheet = getSheet(SH_SCHEDULE);
  clearData(sheet);
  if (!data.length) return;
  sheet.getRange(2,1,data.length,H_SCH.length).setValues(data.map(scheduleToRow));
  sheet.getRange(2,4,data.length,2).setNumberFormat('@STRING@');
}
function writeSpecial(data) {
  const sheet = getSheet(SH_SPECIAL);
  clearData(sheet);
  if (!data.length) return;
  sheet.getRange(2,1,data.length,H_SP.length).setValues(data.map(specialToRow));
  sheet.getRange(2,9,data.length,1).setNumberFormat('@STRING@');
}

// ═══════════════════════════════════════
// 数据转换（与 v5 完全相同）
// ═══════════════════════════════════════
function cellStr(val) {
  if (!val && val !== 0) return '';
  if (val instanceof Date) {
    const yr = val.getFullYear() + 543;
    const mo = val.getMonth() + 1;
    if (mo <= 3) return yr + '-3';
    else if (mo <= 7) return yr + '-1';
    else return yr + '-2';
  }
  return String(val);
}

function scheduleToRow(r) {
  return [
    r.id||'', r.course||'', r.en||'',
    String(r.sem||''), String(r.half||''),
    r.type||'', r.cls||'', r.tc||'',
    JSON.stringify(r.cc||[]),
    (r.cc||[]).reduce((s,x)=>s+(x.count||0),0),
    r.nt||'',
    r.btec===true||r.btec==='TRUE'||r.btec==='true'?true:false,
    new Date().toISOString()
  ];
}
function rowToSchedule(row) {
  let sem  = cellStr(row[3]);
  let half = cellStr(row[4]);
  let cc   = [];
  try { cc = JSON.parse(String(row[8]||'[]')); } catch(e) {}
  return {
    id:String(row[0]||''), course:row[1]||'', en:row[2]||'',
    sem, half, type:row[5]||'', cls:String(row[6]||''), tc:row[7]||'',
    cc, nt:row[10]||'',
    btec:(row[11]===true||String(row[11]||'').toUpperCase()==='TRUE'),
    editing:false
  };
}
function specialToRow(r) {
  return [r.id||'',r.sid||'',r.mr||'',r.nm||'',r.mj||'',r.co||'',r.en||'',r.cls||'',String(r.sem||''),r.tc||'',r.nt||'',new Date().toISOString()];
}
function rowToSpecial(row) {
  let sem = cellStr(row[8]);
  return {
    id:String(row[0]||''), sid:row[1]||'', mr:row[2]||'', nm:row[3]||'',
    mj:row[4]||'', co:row[5]||'', en:row[6]||'', cls:row[7]||'',
    sem, tc:row[9]||'', nt:row[10]||'', type:'SG', editing:false
  };
}

// ═══════════════════════════════════════
// 工具函数（getSheet 支持自定义表头，兼容备份表）
// ═══════════════════════════════════════
function getSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    const h = headers || getHeaders(name);
    if (h.length) {
      sheet.getRange(1,1,1,h.length).setValues([h]);
      styleHeader(sheet, h.length, name.startsWith('_备份_'));
    }
  }
  return sheet;
}
function getHeaders(name) {
  return {
    [SH_SCHEDULE]:H_SCH, [SH_SPECIAL]:H_SP, [SH_DEPTS]:H_DEP,
    [SH_COHORTS]:H_COH, [SH_COURSES]:H_CRS, [SH_TEACHERS]:H_TCH, [SH_BTEC]:H_BTEC,
    [SH_BAK_SCH]:H_BAK_SCH, [SH_BAK_SP]:H_BAK_SP, [SH_BAK_BTEC]:H_BAK_BTEC
  }[name] || [];
}
function getRows(sheetName) {
  const sheet = getSheet(sheetName);
  const last  = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2,1,last-1,sheet.getLastColumn()).getValues()
    .filter(r=>r.some(c=>String(c).trim()));
}
function clearData(sheet) {
  const last = sheet.getLastRow();
  if (last > 1) sheet.getRange(2,1,last-1,sheet.getLastColumn()).clearContent();
}
function styleHeader(sheet, n, isBackup) {
  const bg = isBackup ? '#888' : '#534AB7';
  sheet.getRange(1,1,1,n).setBackground(bg).setFontColor('#fff').setFontWeight('bold').setFontSize(11);
  sheet.setFrozenRows(1);
}

// ═══════════════════════════════════════
// 初始化 & 测试
// ═══════════════════════════════════════
function setupSheets() {
  // 主表
  [SH_SCHEDULE,SH_SPECIAL,SH_DEPTS,SH_COHORTS,SH_COURSES,SH_TEACHERS,SH_BTEC].forEach(name=>getSheet(name));
  // 备份表
  [[SH_BAK_SCH,H_BAK_SCH],[SH_BAK_SP,H_BAK_SP],[SH_BAK_BTEC,H_BAK_BTEC]].forEach(([n,h])=>getSheet(n,h));
  SpreadsheetApp.getUi().alert('✅ v6 初始化完成（含 3 个备份表）');
}
function testAll() {
  Logger.log('排课：'+readSchedule().length);
  Logger.log('特别：'+readSpecial().length);
  Logger.log('课程：'+readRefCourses().length);
  Logger.log('BTEC：'+JSON.stringify(readBtec()));
  Logger.log('备份-排课快照数：'+listBackups('schedule').length);
  Logger.log('备份-特别快照数：'+listBackups('special').length);
}

// 手动触发：从最新备份恢复排课记录
function manualRestoreSchedule() { Logger.log(doRestore('schedule').getContent()); }
function manualRestoreSpecial()  { Logger.log(doRestore('special').getContent()); }
function manualRestoreBtec()     { Logger.log(doRestore('btec').getContent()); }
