/**
 * ShopVibe DDNS 脚本
 * ========================================
 * 每 5 分钟检查一次公网 IP，变了就自动更新 DNS 记录
 * 
 * 使用方式：
 * 1. 在 https://console.dnspod.cn 获取 API Token（DNSPod Token）
 * 2. 填好下面的配置
 * 3. node ddns.js
 * 
 * 建议用 pm2 让它在后台一直跑：
 *   npm install -g pm2
 *   pm2 start ddns.js --name ddns
 */

const https = require('https');
const http = require('http');

// ====== 配置 ======
const CONFIG = {
  // 你的域名信息（去 DNSPod 控制台看）
  domain: 'shopvibe.xyz',         // 你的域名
  subDomain: 'api',               // 子域名（api.shopvibe.xyz）
  recordId: '',                   // 记录 ID（首次手动获取后填入）
  
  // DNSPod Token（在 https://console.dnspod.cn 创建）
  // 格式：ID,Token
  dnspodToken: '',                // 例如 '12345,abcdef123456'
  
  // 检查间隔（毫秒）
  interval: 5 * 60 * 1000,        // 5 分钟
};

// ====== 获取当前公网 IP ======
function getPublicIP() {
  return new Promise((resolve, reject) => {
    http.get('http://ipv4.icanhazip.com', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data.trim()));
    }).on('error', reject);
  });
}

// ====== 调用 DNSPod API ======
function dnspodApi(action, params) {
  return new Promise((resolve, reject) => {
    const data = new URLSearchParams({
      login_token: CONFIG.dnspodToken,
      format: 'json',
      ...params,
    });

    const req = https.request({
      hostname: 'dnsapi.cn',
      path: `/${action}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'ShopVibe-DDNS/1.0',
      },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error('Parse failed: ' + body));
        }
      });
    });

    req.on('error', reject);
    req.write(data.toString());
    req.end();
  });
}

// ====== 获取记录列表（用来找 recordId）=====
async function getRecordId() {
  if (CONFIG.recordId) return CONFIG.recordId;
  
  const result = await dnspodApi('Record.List', {
    domain: CONFIG.domain,
    sub_domain: CONFIG.subDomain,
  });
  
  if (result.records && result.records.length > 0) {
    CONFIG.recordId = result.records[0].id;
    console.log(`[DDNS] 找到记录 ID: ${CONFIG.recordId}`);
    return CONFIG.recordId;
  }
  
  // 记录不存在，创建一条
  console.log('[DDNS] 记录不存在，正在创建...');
  const createResult = await dnspodApi('Record.Create', {
    domain: CONFIG.domain,
    sub_domain: CONFIG.subDomain,
    record_type: 'A',
    record_line: '默认',
    value: '0.0.0.0',  // 临时值，后续更新
  });
  
  if (createResult.record) {
    CONFIG.recordId = createResult.record.id;
    console.log(`[DDNS] 创建成功，记录 ID: ${CONFIG.recordId}`);
    return CONFIG.recordId;
  }
  
  throw new Error('无法获取或创建 DNS 记录');
}

// ====== 更新 DNS 记录 ======
async function updateDns(currentIP) {
  const recordId = await getRecordId();
  
  const result = await dnspodApi('Record.Ddns', {
    domain: CONFIG.domain,
    record_id: recordId,
    sub_domain: CONFIG.subDomain,
    record_type: 'A',
    record_line: '默认',
    value: currentIP,
  });
  
  return result.status && result.status.code === '1';
}

// ====== 主循环 ======
async function checkAndUpdate() {
  try {
    if (!CONFIG.dnspodToken || CONFIG.dnspodToken === '') {
      throw new Error('请先配置 DNSPod Token');
    }

    const currentIP = await getPublicIP();
    console.log(`[DDNS] 当前公网 IP: ${currentIP}`);

    // 用 global 变量记住上一次的 IP，避免重复更新
    if (global.__lastIP === currentIP) {
      console.log('[DDNS] IP 未变化，跳过更新');
      return;
    }

    const success = await updateDns(currentIP);
    if (success) {
      global.__lastIP = currentIP;
      console.log(`[DDNS] ✅ DNS 已更新: ${CONFIG.subDomain}.${CONFIG.domain} → ${currentIP}`);
    } else {
      console.log('[DDNS] ❌ 更新失败');
    }
  } catch (err) {
    console.error(`[DDNS] 错误: ${err.message}`);
  }
}

// ====== 启动 ======
console.log('=================================');
console.log('  ShopVibe DDNS 客户端');
console.log(`  域名: ${CONFIG.subDomain}.${CONFIG.domain}`);
console.log(`  检查间隔: ${CONFIG.interval / 1000} 秒`);
console.log('=================================');

// 立即执行一次
checkAndUpdate();

// 定时执行
setInterval(checkAndUpdate, CONFIG.interval);
