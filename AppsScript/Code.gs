/**
 * 排课管理系统 v5 — Google Apps Script
 *
 * 改动说明：doGet 加入 write 支持，彻底绕开 CORS preflight。
 *   doGet  → 读取（readRef / read）+ 写入（write）
 *   doPost → 保留兼容，逻辑同 doGet
 *
 * 部署：以 Web App 方式部署，执行身份 = 我（脚本拥有者），访问权限 = 任何人
 * 前端通过 fetch GET 调用：
 *   ?action=readRef
 *   ?action=read&type=schedule|special|btec
 *   ?action=write&type=schedule|special|btec&payload=<encodeURIComponent(JSON)>
 */

// ═══════════════════════════════════════
// 表格名 & 表头定义
// ═══════════════════════════════════════
const SH_SCHEDULE = '排课记录';
const SH_SPECIAL  = '特别排课';
const SH_DEPTS    = '专业库';
const SH_COHORTS  = '届别库';
const SH_COURSES  = '课程库';
const SH_TEACHERS = '老师库';
const SH_BTEC     = 'BTEC数据';

const H_SCH  = ['ID','课程代码','课程英文名','学期','上下半学期','课程类型','班级代码','授课老师','届别JSON','总人数','备注','BTEC','最后更新'];
const H_SP   = ['ID','学号','学生称谓','学生姓名','学生专业','课程代码','课程英文名','班级代码','学期','授课老师','备注','最后更新'];
const H_DEP  = ['专业代码','专业全名'];
const H_COH  = ['专业','届别名称'];
const H_CRS  = ['课程代码','课程英文名'];
const H_TCH  = ['姓名','专业','职位','限额'];
const H_BTEC = ['姓名','BTEC_LA500'];

function buildResp(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ═══════════════════════════════════════
// GET — 读取 + 写入（统一入口，无 preflight）
// ═══════════════════════════════════════
function doGet(e) {
  try {
    const action = e.parameter.action || '';

    // ── 读取参考数据 ──
    if (action === 'readRef') {
      return buildResp({
        success:  true,
        courses:  readRefCourses(),
        teachers: readRefTeachers(),
        cohorts:  readRefCohorts(),
        depts:    readRefDepts()
      });
    }

    // ── 读取主数据 ──
    if (action === 'read') {
      const type = e.parameter.type || 'schedule';
      if (type === 'special') return buildResp({success:true, data:readSpecial()});
      if (type === 'btec')    return buildResp({success:true, data:readBtec()});
      return buildResp({success:true, data:readSchedule()});
    }

    // ── 写入（GET 版，payload 参数放 JSON 字符串）──
    if (action === 'write') {
      const type    = e.parameter.type || 'schedule';
      const rawData = e.parameter.payload || '[]';
      let data;
      try { data = JSON.parse(decodeURIComponent(rawData)); } catch(ex) { data = []; }

      if (type === 'special')   writeSpecial(data);
      else if (type === 'btec') writeBtec(data);
      else                      writeSchedule(data);

      const count = Array.isArray(data) ? data.length : Object.keys(data).length;
      return buildResp({success:true, message:'写入成功，共 '+count+' 条', type});
    }

    return buildResp({success:false, error:'Unknown action'});
  } catch(err) {
    return buildResp({success:false, error:err.message});
  }
}

// ═══════════════════════════════════════
// POST — 保留兼容（旧前端仍可用）
// ═══════════════════════════════════════
function doPost(e) {
  try {
    const raw  = e.postData ? e.postData.contents : '{}';
    const body = JSON.parse(raw);
    const action = body.action || 'write';
    const type   = body.type   || 'schedule';
    const data   = body.payload || body.data || [];

    if (action === 'write') {
      if (type === 'special')   writeSpecial(data);
      else if (type === 'btec') writeBtec(data);
      else                      writeSchedule(data);
      const count = Array.isArray(data) ? data.length : Object.keys(data).length;
      return buildResp({success:true, message:'写入成功，共 '+count+' 条', type});
    }
    return buildResp({success:false, error:'Unknown action'});
  } catch(err) {
    return buildResp({success:false, error:err.message});
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
// 数据转换
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
// 工具函数
// ═══════════════════════════════════════
function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    const headers = getHeaders(name);
    if (headers.length) {
      sheet.getRange(1,1,1,headers.length).setValues([headers]);
      styleHeader(sheet, headers.length);
    }
  }
  return sheet;
}
function getHeaders(name) {
  return {[SH_SCHEDULE]:H_SCH,[SH_SPECIAL]:H_SP,[SH_DEPTS]:H_DEP,
          [SH_COHORTS]:H_COH,[SH_COURSES]:H_CRS,[SH_TEACHERS]:H_TCH,[SH_BTEC]:H_BTEC}[name]||[];
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
function styleHeader(sheet, n) {
  sheet.getRange(1,1,1,n).setBackground('#534AB7').setFontColor('#fff').setFontWeight('bold').setFontSize(11);
  sheet.setFrozenRows(1);
}

// ═══════════════════════════════════════
// 初始化 & 测试
// ═══════════════════════════════════════
function setupSheets() {
  [SH_SCHEDULE,SH_SPECIAL,SH_DEPTS,SH_COHORTS,SH_COURSES,SH_TEACHERS,SH_BTEC].forEach(name=>getSheet(name));
  SpreadsheetApp.getUi().alert('✅ 初始化完成！');
}
function testAll() {
  Logger.log('排课：'+readSchedule().length);
  Logger.log('特别：'+readSpecial().length);
  Logger.log('课程：'+readRefCourses().length);
  Logger.log('BTEC：'+JSON.stringify(readBtec()));
}
