// Picstyle Loon sign-in. Credentials remain in local script storage.
const BASE = 'https://picstyle.duomiao.pro';
const KEY = 'picstyle.token.v1';
function notify(message) {
  console.log(message);
  $notification.post('风格转换器签到', '', message);
}
function call(method, path, token) {
  return new Promise((resolve, reject) => {
    const options = {url: BASE + path, headers: {token, 'Content-Type': 'application/json'}, timeout: 15};
    if (method === 'post') options.body = '{}';
    $httpClient[method](options, (error, response, body) => {
      if (error) return reject(new Error('网络请求失败'));
      if (!response || response.status < 200 || response.status >= 300) return reject(new Error('HTTP 请求未成功'));
      try { resolve(JSON.parse(body)); } catch (_) { reject(new Error('响应不是有效 JSON')); }
    });
  });
}
async function main() {
  if (typeof $request !== 'undefined') {
    if (!/^https:\/\/picstyle\.duomiao\.pro\/styles(?:\?|$)/.test($request.url)) return;
    const headers = $request.headers || {};
    const name = Object.keys(headers).find(k => k.toLowerCase() === 'token');
    const token = name ? headers[name] : '';
    if (typeof token !== 'string' || !token.trim()) {
      console.log('已匹配首页请求，但未发现非空 token 请求头。');
      return;
    }
    if ($persistentStore.read(KEY) === token) {
      console.log('本机已有相同登录信息，无需重复保存。');
      return;
    }
    notify($persistentStore.write(token, KEY) ? '登录信息已保存在本机，请手动运行签到任务验证。' : '登录信息保存失败。');
    return;
  }
  const token = $persistentStore.read(KEY);
  if (!token) return notify('尚未获取登录信息，请打开小程序首页。');
  const before = await call('get', '/styles?tag_id=&offset=0', token);
  if (before.status === 'not_login') return notify('登录已过期，请重新打开小程序更新登录信息。');
  const sign = before.data && before.data.sign;
  if (before.status !== 'success' || !sign || typeof sign.today_signed !== 'boolean') {
    return notify('无法确认签到状态，未提交签到。');
  }
  if (sign.today_signed) return notify('今日已签到，无需重复提交。');
  const result = await call('post', '/sign-in', token);
  if (result.status === 'not_login') return notify('登录已过期，请重新打开小程序。');
  if (result.status !== 'success') return notify('签到接口未返回成功，未自动重试。');
  const after = await call('get', '/styles?tag_id=&offset=0', token);
  const confirmed = after.data && after.data.sign;
  if (after.status === 'success' && confirmed && confirmed.today_signed === true) {
    notify('签到成功' + (typeof confirmed.running_days === 'number' ? '，连续 ' + confirmed.running_days + ' 天' : '') + (typeof confirmed.today_points === 'number' ? '，今日 ' + confirmed.today_points + ' 金币。' : '。'));
  } else notify('接口返回成功，但未能复核签到状态，请在小程序确认。');
}
main().catch(() => notify('请求或解析失败，未自动重试，请检查网络或接口。')).finally(() => $done({}));
