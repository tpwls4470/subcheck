import http from 'node:http';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const base='http://127.0.0.1:4320';
const upstream='http://127.0.0.1:4319';
const sessions=new Map();
function send(res,status,data,type='application/json; charset=utf-8'){
  res.writeHead(status,{'content-type':type,'cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff','content-security-policy':"default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; font-src 'self' https://cdn.jsdelivr.net data:; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'"});
  res.end(typeof data==='string'?data:JSON.stringify(data));
}
function session(req,res){
  const match=(req.headers.cookie||'').match(/(?:^|;\s*)subcheck_app=([A-Za-z0-9_-]+)/);
  let id=match?.[1];
  if(!id||!sessions.has(id)){id=crypto.randomBytes(24).toString('base64url');sessions.set(id,crypto.randomBytes(24).toString('base64url'));res.setHeader('set-cookie',`subcheck_app=${id}; HttpOnly; SameSite=Strict; Path=/`);}
  return sessions.get(id);
}
async function forward(req,path,options={}){
  // Same local SubCheck login session; no CLI credentials or provider tokens are read.
  return fetch(upstream+path,{...options,redirect:'error',signal:AbortSignal.timeout(25000),headers:{cookie:req.headers.cookie||'',...options.headers}});
}
const server=http.createServer(async(req,res)=>{
  try{
    if(req.headers.host!=='127.0.0.1:4320')return send(res,403,{message:'허용되지 않은 요청입니다.'});
    const csrf=session(req,res);
    if(req.method==='GET'&&req.url==='/'){
      const html=(await fs.readFile('public/index.html','utf8')).replace('APP_CSRF_TOKEN',csrf);
      return send(res,200,html,'text/html; charset=utf-8');
    }
    if(req.method==='GET'&&req.url==='/connect'){res.writeHead(302,{location:upstream+'/connect','cache-control':'no-store'});return res.end();}
    if(req.method==='GET'&&req.url==='/api/kling/status'){
      const r=await forward(req,'/status');
      if(!r.ok)throw Error('status');
      const cookie=r.headers.get('set-cookie');if(cookie)res.appendHeader('set-cookie',cookie);
      return send(res,200,await r.json());
    }
    if(req.method==='POST'&&req.url==='/api/kling/refresh'){
      if(req.headers['x-subcheck-csrf']!==csrf||req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&req.headers.origin!=='null'&&req.headers.origin!==base))return send(res,403,{message:'화면을 다시 열고 시도해주세요.'});
      // The existing auth server owns its session and CSRF check.
      const root=await forward(req,'/');
      const markup=await root.text();
      const token=markup.match(/name="csrf" value="([A-Za-z0-9_-]+)"/)?.[1];
      if(!token)return send(res,401,{message:'클링 연결이 만료됐어요. 다시 연결해주세요.'});
      const r=await forward(req,'/refresh',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',origin:upstream},body:new URLSearchParams({csrf:token})});
      await r.body?.cancel();
      if(!r.ok)return send(res,r.status===400?429:502,{message:'조회하지 못했어요. 잠시 후 다시 시도하거나 연결 상태를 확인해주세요.'});
      const status=await forward(req,'/status');
      if(!status.ok)throw Error('status');
      return send(res,200,await status.json());
    }
    return send(res,404,{message:'페이지를 찾을 수 없어요.'});
  }catch{return send(res,502,{message:'클링 연결에 응답이 없어요. 마지막 확인 정보를 유지합니다.'});}
});
server.listen(4320,'127.0.0.1',()=>console.log('SubCheck app: '+base));
